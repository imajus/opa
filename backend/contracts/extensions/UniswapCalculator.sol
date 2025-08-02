// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/IAmountGetter.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "../libraries/FullMath.sol";
import "../libraries/FixedPoint96.sol";
import "../libraries/SqrtPriceMath.sol";

/**
 * @title UniswapCalculator
 * @notice Extension for 1inch Limit Order Protocol that uses Uniswap V3 Factory for price discovery
 * @dev Calculates amounts based on real-time market prices from Uniswap V3 pools
 *      Blob format: [flags(1)][makerToken(20)][takerToken(20)][fee(3)][spread(32)]
 *      Flags: 0x00 = normal, 0x80 = inverse price calculation
 */
contract UniswapCalculator is IAmountGetter {
    /// @notice Address of the Uniswap V3 Factory for pool discovery
    address public immutable uniswapFactory;
    
    /// @notice Spread denominator (1e9 = 1 billion)
    uint256 private constant _SPREAD_DENOMINATOR = 1e9;
    

    
    /// @notice Valid Uniswap V3 fee tiers
    uint24 private constant _FEE_TIER_500 = 500;     // 0.05%
    uint24 private constant _FEE_TIER_3000 = 3000;   // 0.3%
    uint24 private constant _FEE_TIER_10000 = 10000; // 1%
    
    /// @notice Errors
    error InvalidBlobLength();
    error ZeroAmount();
    error PriceDiscoveryFailed();
    error InsufficientLiquidity();
    error InvalidFeeTier();
    error PoolNotFound();

    /**
     * @notice Constructor to set the Uniswap V3 Factory address
     * @param _uniswapFactory Address of Uniswap V3 Factory
     */
    constructor(address _uniswapFactory) {
        require(_uniswapFactory != address(0), "UniswapCalculator: invalid factory");
        uniswapFactory = _uniswapFactory;
    }

    /**
     * @notice Calculates the making amount based on taking amount and current market price
     * @param takingAmount Amount being taken
     * @param extraData Blob containing fee tier and spread
     * @return The calculated making amount
     */
    function getMakingAmount(
        IOrderMixin.Order calldata order,
        bytes calldata /* extension */,
        bytes32 /* orderHash */,
        address /* taker */,
        uint256 takingAmount,
        uint256 /* remainingMakingAmount */,
        bytes calldata extraData
    ) external view override returns (uint256) {
        if (takingAmount == 0) {
            revert ZeroAmount();
        }
        
        // For making amount: takerToken -> makerToken
        address srcToken = AddressLib.get(order.takerAsset);
        address dstToken = AddressLib.get(order.makerAsset);
        return _getSpreadedAmount(srcToken, dstToken, takingAmount, extraData);
    }

    /**
     * @notice Calculates the taking amount based on making amount and current market price
     * @param makingAmount Amount being made
     * @param extraData Blob containing fee tier and spread
     * @return The calculated taking amount
     */
    function getTakingAmount(
        IOrderMixin.Order calldata order,
        bytes calldata /* extension */,
        bytes32 /* orderHash */,
        address /* taker */,
        uint256 makingAmount,
        uint256 /* remainingMakingAmount */,
        bytes calldata extraData
    ) external view override returns (uint256) {
        if (makingAmount == 0) {
            revert ZeroAmount();
        }
        
        // For taking amount: makerToken -> takerToken
        address srcToken = AddressLib.get(order.makerAsset);
        address dstToken = AddressLib.get(order.takerAsset);
        return _getSpreadedAmount(srcToken, dstToken, makingAmount, extraData);
    }

    /**
     * @notice Calculates amount with spread applied based on Uniswap V3 market price
     * @dev Blob format: [fee(3)][spread(32)]
     * @param srcToken Source token address
     * @param dstToken Destination token address
     * @param amount Base amount to calculate from
     * @param blob Encoded data containing fee tier and spread
     * @return Amount with spread applied based on current market price
     */
    function _getSpreadedAmount(address srcToken, address dstToken, uint256 amount, bytes calldata blob) internal view returns (uint256) {
        // Validate blob length: 3 (fee) + 32 (spread) = 35 bytes
        if (blob.length != 35) {
            revert InvalidBlobLength();
        }
        
        // Decode blob data
        uint24 fee = uint24(bytes3(blob[:3]));
        uint256 spread = uint256(bytes32(blob[3:35]));
        
        // Validate fee tier
        if (fee != _FEE_TIER_500 && fee != _FEE_TIER_3000 && fee != _FEE_TIER_10000) {
            revert InvalidFeeTier();
        }
        
        // Get current market price from Uniswap V3
        uint256 marketPrice = _getMarketPrice(srcToken, dstToken, fee, amount);
        
        // Apply spread
        uint256 spreadedAmount = (marketPrice * spread) / _SPREAD_DENOMINATOR;
        
        return spreadedAmount;
    }

    /**
     * @notice Get current market price from Uniswap V3 Factory and Pool
     * @param srcToken Source token address
     * @param dstToken Destination token address
     * @param fee Fee tier for the pool
     * @param amount Amount of source tokens
     * @return Expected output amount in destination tokens
     */
    function _getMarketPrice(
        address srcToken,
        address dstToken,
        uint24 fee,
        uint256 amount
    ) internal view returns (uint256) {
        // Same token case
        if (srcToken == dstToken) {
            return amount;
        }
        
        // Get pool address from factory
        address pool = IUniswapV3Factory(uniswapFactory).getPool(srcToken, dstToken, fee);
        if (pool == address(0)) {
            revert PoolNotFound();
        }
        
        // Get current sqrt price from pool
        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(pool).slot0();
        
        if (sqrtPriceX96 == 0) {
            revert InsufficientLiquidity();
        }
        
        // Calculate output amount using SqrtPriceMath library
        address token0 = IUniswapV3Pool(pool).token0();
        bool zeroForOne = srcToken == token0;
        
        uint256 outputAmount = SqrtPriceMath.getAmountOut(sqrtPriceX96, amount, zeroForOne);
        
        if (outputAmount == 0) {
            revert InsufficientLiquidity();
        }
        
        return outputAmount;
    }

    /**
     * @notice Check if a fee tier is valid
     * @param fee Fee tier to validate
     * @return True if fee tier is valid
     */
    function isValidFeeTier(uint24 fee) external pure returns (bool) {
        return fee == _FEE_TIER_500 || fee == _FEE_TIER_3000 || fee == _FEE_TIER_10000;
    }

    /**
     * @notice Get all supported fee tiers
     * @return Array of supported fee tiers
     */
    function getSupportedFeeTiers() external pure returns (uint24[] memory) {
        uint24[] memory tiers = new uint24[](3);
        tiers[0] = _FEE_TIER_500;
        tiers[1] = _FEE_TIER_3000;
        tiers[2] = _FEE_TIER_10000;
        return tiers;
    }
}