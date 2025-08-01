// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/IAmountGetter.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IPreInteraction.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IPostInteraction.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAggregationRouter.sol";

/// @notice Interface for Aave v3 flash loan receiver
interface IFlashLoanReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}


/**
 * @title GasStation
 * @notice Gas Station extension for 1inch Limit Order Protocol that allows gasless trading
 * @dev Enables Makers to trade stablecoins -> WETH without owning ETH for gas fees.
 *      Takers pay gas upfront and get reimbursed via flash loan, swap, and repayment mechanism.
 */
contract GasStation is IAmountGetter, IPreInteraction, IPostInteraction, IFlashLoanReceiver {
    using AddressLib for Address;

    /// @notice Fixed taker fee in basis points (1% = 100 bps)
    uint256 public immutable takerFeeBps;
    
    /// @notice Gas stipend used for gas cost estimation (e.g., 150k gas)
    uint256 public immutable gasStipend;
    
    /// @notice Address of the 1inch Aggregation Router for price discovery and swaps
    address public immutable aggregationRouter;
    
    /// @notice Address of WETH token contract
    address public immutable weth;
    
    /// @notice Address of Aave v3 Pool for flash loans
    address public immutable aavePool;
    
    /// @notice Address of the FlashLoanAdapter for delegatecall compatibility
    address public immutable flashLoanAdapter;
    
    /// @notice Current flash loan state
    struct FlashLoanState {
        bool isActive;
        address asset;
        uint256 amount;
        uint256 premium;
        address taker;
    }
    
    /// @notice Current flash loan execution state
    FlashLoanState private _flashLoanState;

    /// @notice Events
    event FlashLoanExecuted(address indexed taker, uint256 amount);
    event SwapExecuted(address indexed makerAsset, uint256 amountIn, uint256 amountOut);
    event TakerReimbursed(address indexed taker, uint256 gasReimbursement, uint256 fee);

    /// @notice Errors
    error InsufficientOutputAmount();
    error FlashLoanFailed();
    error SwapFailed();
    error OnlyTakerAssetWeth();
    error ZeroAmount();
    error UnauthorizedFlashLoan();
    error FlashLoanAlreadyActive();
    error InvalidFlashLoanCallback();

    /**
     * @notice Constructor to set immutable configuration
     * @param _takerFeeBps Fixed taker fee in basis points (e.g., 100 for 1%)
     * @param _gasStipend Gas stipend for cost estimation (e.g., 150000)
     * @param _aggregationRouter Address of 1inch Aggregation Router
     * @param _weth Address of WETH token
     * @param _aavePool Address of Aave v3 Pool
     * @param _flashLoanAdapter Address of the FlashLoanAdapter contract
     */
    constructor(
        uint256 _takerFeeBps,
        uint256 _gasStipend,
        address _aggregationRouter,
        address _weth,
        address _aavePool,
        address _flashLoanAdapter
    ) {
        require(_takerFeeBps <= 10000, "GasStation: fee too high"); // Max 100%
        require(_gasStipend > 0, "GasStation: invalid gas stipend");
        require(_aggregationRouter != address(0), "GasStation: invalid aggregator");
        require(_weth != address(0), "GasStation: invalid WETH");
        require(_aavePool != address(0), "GasStation: invalid Aave pool");
        require(_flashLoanAdapter != address(0), "GasStation: invalid adapter");

        takerFeeBps = _takerFeeBps;
        gasStipend = _gasStipend;
        aggregationRouter = _aggregationRouter;
        weth = _weth;
        aavePool = _aavePool;
        flashLoanAdapter = _flashLoanAdapter;
    }

    /**
     * @notice Calculates actual making amount based on dynamic pricing
     * @dev This function calculates how much WETH the maker should receive
     *      after deducting taker fees, gas costs, and flash loan fees
     */
    function getMakingAmount(
        IOrderMixin.Order calldata order,
        bytes calldata extension,
        bytes32 orderHash,
        address taker,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external view override returns (uint256) {
        // Validate that taker asset is WETH
        if (order.takerAsset.get() != weth) {
            revert OnlyTakerAssetWeth();
        }
        
        if (takingAmount == 0) {
            revert ZeroAmount();
        }
        
        // Get spot price from maker asset to WETH
        uint256 expectedWethOut = _getSpotPrice(order.makerAsset.get(), takingAmount);
        
        // Calculate total costs that need to be deducted
        uint256 totalCosts = _calculateTotalCosts(tx.gasprice, expectedWethOut);
        
        // Maker receives expected WETH minus all costs
        if (expectedWethOut <= totalCosts) {
            revert InsufficientOutputAmount();
        }
        
        return expectedWethOut - totalCosts;
    }

    /**
     * @notice Calculates actual taking amount based on dynamic pricing
     * @dev This function calculates how much of the maker asset should be taken
     *      to provide the requested WETH amount after all deductions
     */
    function getTakingAmount(
        IOrderMixin.Order calldata order,
        bytes calldata extension,
        bytes32 orderHash,
        address taker,
        uint256 makingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external view override returns (uint256) {
        // Validate that taker asset is WETH
        if (order.takerAsset.get() != weth) {
            revert OnlyTakerAssetWeth();
        }
        
        if (makingAmount == 0) {
            revert ZeroAmount();
        }
        
        // Calculate total costs that need to be covered
        uint256 totalCosts = _calculateTotalCosts(tx.gasprice, makingAmount);
        
        // Total WETH needed = making amount for maker + all costs
        uint256 totalWethNeeded = makingAmount + totalCosts;
        
        // Calculate how much maker asset we need to swap to get total WETH needed
        uint256 requiredMakerAsset = _getRequiredInputAmount(order.makerAsset.get(), totalWethNeeded);
        
        return requiredMakerAsset;
    }

    /**
     * @notice Pre-interaction hook to execute flash loan
     * @dev Called before asset transfers to borrow WETH from Aave v3
     */
    function preInteraction(
        IOrderMixin.Order calldata order,
        bytes calldata extension,
        bytes32 orderHash,
        address taker,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external override {
        // Ensure no flash loan is currently active
        if (_flashLoanState.isActive) {
            revert FlashLoanAlreadyActive();
        }
        
        // Validate that taker asset is WETH
        if (order.takerAsset.get() != weth) {
            revert OnlyTakerAssetWeth();
        }
        
        // Calculate total WETH needed for the operation
        uint256 totalCosts = _calculateTotalCosts(tx.gasprice, makingAmount);
        uint256 flashLoanAmount = makingAmount + totalCosts;
        
        // Set flash loan state
        _flashLoanState = FlashLoanState({
            isActive: true,
            asset: weth,
            amount: flashLoanAmount,
            premium: 0, // Will be set in executeOperation callback
            taker: taker
        });
        
        // Prepare parameters for flash loan callback
        bytes memory params = abi.encode(order, makingAmount, takingAmount, taker);
        
        // Execute flash loan via delegatecall to FlashLoanAdapter
        (bool success, bytes memory result) = flashLoanAdapter.delegatecall(
            abi.encodeWithSignature(
                "executeFlashLoan(address,address,uint256,address,bytes)",
                aavePool,
                weth,
                flashLoanAmount,
                address(this),
                params
            )
        );
        
        if (!success) {
            // Reset state on failure
            _flashLoanState.isActive = false;
            revert FlashLoanFailed();
        }
        
        emit FlashLoanExecuted(taker, flashLoanAmount);
    }

    /**
     * @notice Post-interaction hook to execute swap and repayment
     * @dev Called after asset transfers to swap maker asset and repay flash loan
     */
    function postInteraction(
        IOrderMixin.Order calldata order,
        bytes calldata extension,
        bytes32 orderHash,
        address taker,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external override {
        // Verify flash loan is active and this is the expected taker
        if (!_flashLoanState.isActive || _flashLoanState.taker != taker) {
            revert InvalidFlashLoanCallback();
        }
        
        // Get the maker asset that was transferred to us
        address makerAsset = order.makerAsset.get();
        
        // At this point, we should have:
        // 1. Received the flash loan WETH (handled in executeOperation)
        // 2. Received the maker asset from the order (handled by LOP)
        
        // Calculate amounts needed for repayment and reimbursement
        uint256 flashLoanAmount = _flashLoanState.amount;
        uint256 flashLoanPremium = _flashLoanState.premium;
        uint256 totalFlashLoanRepayment = flashLoanAmount + flashLoanPremium;
        
        // Calculate gas reimbursement and taker fee
        uint256 gasReimbursement = gasStipend * tx.gasprice;
        uint256 takerFee = (flashLoanAmount * takerFeeBps) / 10000;
        
        // Total WETH needed = flash loan repayment + gas reimbursement + taker fee
        uint256 totalWethNeeded = totalFlashLoanRepayment + gasReimbursement + takerFee;
        
        // Swap maker asset to WETH
        uint256 wethReceived = _swapToWeth(makerAsset, takingAmount);
        
        // Verify we have enough WETH to cover all obligations
        if (wethReceived < totalWethNeeded) {
            revert InsufficientOutputAmount();
        }
        
        // Repay flash loan (approval was set in executeOperation)
        // The Aave Pool will automatically pull the repayment amount
        
        // Reimburse taker with gas + fee
        uint256 takerReimbursement = gasReimbursement + takerFee;
        if (takerReimbursement > 0) {
            IERC20(weth).transfer(taker, takerReimbursement);
        }
        
        // Reset flash loan state
        _resetFlashLoanState();
        
        // Emit events
        emit SwapExecuted(makerAsset, takingAmount, wethReceived);
        emit TakerReimbursed(taker, gasReimbursement, takerFee);
    }

    /**
     * @notice Helper function to calculate total costs (gas + fees + flash loan fee)
     * @param gasPrice Current gas price
     * @param flashLoanAmount Amount to borrow via flash loan
     * @return Total costs in WETH
     */
    function _calculateTotalCosts(
        uint256 gasPrice, 
        uint256 flashLoanAmount
    ) internal view returns (uint256) {
        // Gas reimbursement = gasStipend * gasPrice
        uint256 gasReimbursement = gasStipend * gasPrice;
        
        // Aave v3 flash loan fee is 0.05% (5 basis points)
        uint256 flashLoanFee = (flashLoanAmount * 5) / 10000;
        
        // Taker fee based on flash loan amount
        uint256 takerFee = (flashLoanAmount * takerFeeBps) / 10000;
        
        return gasReimbursement + flashLoanFee + takerFee;
    }

    /**
     * @notice Get spot price for swapping maker asset to WETH
     * @dev Integrates with 1inch Aggregator v6 for real price discovery
     * @param makerAsset The token to swap from
     * @param amountIn Amount of maker asset to swap
     * @return expectedWethOut Expected WETH output amount
     */
    function _getSpotPrice(address makerAsset, uint256 amountIn) internal view returns (uint256) {
        // Basic validation
        if (amountIn == 0) return 0;
        
        // Same asset case (shouldn't happen in practice but safety check)
        if (makerAsset == weth) return amountIn;
        
        // Try to get price from 1inch Aggregator
        try IAggregationRouter(aggregationRouter).getExpectedReturn(
            makerAsset,
            weth,
            amountIn
        ) returns (uint256 expectedOut, uint256[] memory /* distribution */) {
            // Validate we got a reasonable response
            if (expectedOut > 0) {
                return expectedOut;
            }
        } catch {
            // Aggregator call failed, use fallback
        }
        
        // Fallback: Use simplified 1:1 ratio for stablecoins
        // This assumes both tokens have similar value (~$1) and 18 decimals
        // In production, you might want to:
        // 1. Use Chainlink price feeds as secondary oracle
        // 2. Revert if no reliable price is available
        // 3. Apply a safety margin for price volatility
        return amountIn;
    }

    /**
     * @notice Calculate required input amount to get desired WETH output
     * @dev Uses 1inch Aggregator for reverse price discovery
     * @param makerAsset The token to swap from
     * @param desiredWethOut Desired WETH output amount
     * @return requiredMakerAsset Required maker asset input amount
     */
    function _getRequiredInputAmount(address makerAsset, uint256 desiredWethOut) internal view returns (uint256) {
        // Basic validation
        if (desiredWethOut == 0) return 0;
        
        // Same asset case
        if (makerAsset == weth) return desiredWethOut;
        
        // For reverse pricing, we need to estimate the input amount
        // Since 1inch doesn't have a direct "getAmountIn" function, we can:
        // 1. Use binary search to find the required input
        // 2. Use a simplified calculation based on current spot price
        // 3. Apply a safety margin for slippage
        
        // Method 1: Use current spot price with safety margin
        try IAggregationRouter(aggregationRouter).getExpectedReturn(
            makerAsset,
            weth,
            desiredWethOut // Start with 1:1 estimate
        ) returns (uint256 spotOut, uint256[] memory /* distribution */) {
            if (spotOut > 0) {
                // Calculate required input with inverse ratio + 5% safety margin
                uint256 estimatedInput = (desiredWethOut * desiredWethOut) / spotOut;
                return (estimatedInput * 105) / 100; // Add 5% safety margin
            }
        } catch {
            // Aggregator call failed, use fallback
        }
        
        // Fallback: Use simplified 1:1 ratio with safety margin
        return (desiredWethOut * 105) / 100; // Add 5% safety margin
    }

    /**
     * @notice Aave v3 flash loan callback function
     * @dev This function is called by Aave Pool during flash loan execution
     * @param asset The address of the flash-borrowed asset
     * @param amount The amount of the flash-borrowed asset  
     * @param premium The fee of the flash-borrowed asset
     * @param initiator The address of the flashloan initiator
     * @param params The byte-encoded params passed when initiating the flashloan
     * @return True if the execution of the operation succeeds, false otherwise
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Verify this is called by Aave Pool
        if (msg.sender != aavePool) {
            revert UnauthorizedFlashLoan();
        }
        
        // Verify flash loan state
        if (!_flashLoanState.isActive || _flashLoanState.asset != asset || _flashLoanState.amount != amount) {
            revert InvalidFlashLoanCallback();
        }
        
        // Update premium in state
        _flashLoanState.premium = premium;
        
        // At this point, we have received the flash loan
        // The actual swap and repayment logic will be handled in postInteraction
        // For now, we just ensure we have the funds and approve repayment
        
        // Calculate total repayment amount
        uint256 totalRepayment = amount + premium;
        
        // Approve Aave Pool to pull the repayment amount
        IERC20(asset).approve(aavePool, totalRepayment);
        
        return true;
    }

    /**
     * @notice Swap maker asset to WETH using 1inch Aggregator
     * @dev For PoC, this uses a simplified approach. In production, integrate with 1inch Aggregator
     * @param makerAsset The token to swap from
     * @param amount Amount of maker asset to swap
     * @return wethReceived Amount of WETH received from the swap
     */
    function _swapToWeth(address makerAsset, uint256 amount) internal returns (uint256 wethReceived) {
        // Basic validation
        if (amount == 0) {
            revert ZeroAmount();
        }
        
        // Production Implementation: Integrate with 1inch Aggregator v6
        //
        // The actual implementation would:
        // 1. Approve aggregationRouter to spend makerAsset
        // 2. Use getExpectedReturn to validate minimum output
        // 3. Call aggregationRouter.swap() with proper swap data
        // 4. Validate slippage and return actual WETH received
        //
        // For PoC: We simulate the swap process but in production this would be:
        //
        // IERC20(makerAsset).approve(aggregationRouter, amount);
        // 
        // IAggregationRouter.SwapDescription memory desc = IAggregationRouter.SwapDescription({
        //     srcToken: makerAsset,
        //     dstToken: weth,
        //     srcReceiver: address(this),
        //     dstReceiver: address(this),
        //     amount: amount,
        //     minReturnAmount: expectedWethOut * 95 / 100, // 5% slippage tolerance
        //     flags: 0
        // });
        // 
        // (uint256 returnAmount,) = IAggregationRouter(aggregationRouter).swap(
        //     address(this), // executor
        //     desc,
        //     "", // permit data
        //     swapData // encoded swap route data
        // );
        // 
        // wethReceived = returnAmount;
        
        // Check we have the maker asset to swap
        uint256 makerAssetBalance = IERC20(makerAsset).balanceOf(address(this));
        if (makerAssetBalance < amount) {
            revert SwapFailed();
        }
        
        // Check current WETH balance before swap
        uint256 wethBefore = IERC20(weth).balanceOf(address(this));
        
        // For PoC: simulate the swap by assuming 1:1 conversion for stablecoins
        // This assumes both tokens have 18 decimals and similar value (~$1)
        // Real implementation must call 1inch Aggregator for actual market rates
        wethReceived = amount;
        
        // In production, this is where we would:
        // 1. Check if we have enough WETH from the flash loan to "simulate" receiving it
        // 2. Or actually call the 1inch router to perform the real swap
        
        // For PoC: validate we have enough WETH available (from flash loan) to simulate this swap
        uint256 availableWeth = IERC20(weth).balanceOf(address(this));
        if (availableWeth < wethReceived) {
            revert InsufficientOutputAmount();
        }
        
        // The actual WETH is already available from the flash loan
        // In production, this would be the result of the actual swap
        return wethReceived;
    }

    /**
     * @notice Reset flash loan state (internal helper)
     * @dev Called after flash loan is completed or failed
     */
    function _resetFlashLoanState() internal {
        _flashLoanState.isActive = false;
        _flashLoanState.asset = address(0);
        _flashLoanState.amount = 0;
        _flashLoanState.premium = 0;
        _flashLoanState.taker = address(0);
    }
} 