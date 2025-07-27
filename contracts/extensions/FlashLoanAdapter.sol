// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Aave v3 Pool interface for flash loans
interface IPool {
    /**
     * @notice Allows smartcontracts to access the liquidity of the pool within one transaction,
     * as long as the amount taken plus a fee is returned.
     * @param asset The address of the asset to be borrowed
     * @param amount The amount to be borrowed
     * @param params Variadic packed params to pass to the receiver as extra information
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *                     0 if the action is executed directly by the user, without any middle-man
     */
    function flashLoanSimple(
        address receivingAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

/**
 * @title FlashLoanAdapter
 * @notice Minimal adapter that wraps Aave v3 flashLoanSimple for delegatecall from pre-interaction
 * @dev This contract is designed to be called via delegatecall from the Gas Station extension
 */
contract FlashLoanAdapter {

    /// @notice Events
    event FlashLoanRequested(address indexed asset, uint256 amount, address indexed receiver);

    /// @notice Errors
    error FlashLoanFailed();
    error InvalidPool();
    error InvalidAmount();

    /**
     * @notice Execute flash loan via Aave v3 Pool
     * @dev This function is designed to be called via delegatecall from Gas Station
     * @param pool Address of Aave v3 Pool contract
     * @param asset Address of the asset to borrow (should be WETH)
     * @param amount Amount to borrow
     * @param receiver Address to receive the flash loan (should be Gas Station)
     * @param params Extra parameters to pass to the flash loan callback
     */
    function executeFlashLoan(
        address pool,
        address asset,
        uint256 amount,
        address receiver,
        bytes memory params
    ) external {
        // Validate inputs
        if (pool == address(0)) revert InvalidPool();
        if (amount == 0) revert InvalidAmount();

        // Emit event for monitoring
        emit FlashLoanRequested(asset, amount, receiver);

        // Call Aave v3 flashLoanSimple
        // referralCode = 0 (no referral)
        try IPool(pool).flashLoanSimple(receiver, asset, amount, params, 0) {
            // Flash loan initiated successfully
        } catch {
            revert FlashLoanFailed();
        }
    }

    /**
     * @notice Callback function for Aave v3 flash loan
     * @dev This function is called by Aave Pool during flash loan execution.
     *      Since this adapter is used via delegatecall, this callback should never be called directly.
     *      The actual executeOperation will be handled by the calling contract (Gas Station).
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
    ) external pure returns (bool) {
        // This function should never be called directly when using delegatecall pattern
        // The Gas Station contract will handle the actual executeOperation callback
        // This exists only to satisfy the interface requirements
        return false;
    }

    /**
     * @notice Get flash loan fee for a given amount
     * @dev Aave v3 typically charges 0.05% (5 basis points)
     * @param amount The flash loan amount
     * @return The fee amount
     */
    function getFlashLoanFee(uint256 amount) external pure returns (uint256) {
        // Aave v3 flash loan fee is 0.05% (5 basis points)
        return (amount * 5) / 10000;
    }

    /**
     * @notice Calculate total repayment amount (principal + fee)
     * @dev Helper function for repayment accounting
     * @param principal The original borrowed amount
     * @return totalRepayment The total amount that needs to be repaid
     */
    function calculateTotalRepayment(uint256 principal) external pure returns (uint256 totalRepayment) {
        // Aave v3 flash loan fee is 0.05% (5 basis points)
        uint256 fee = (principal * 5) / 10000;
        return principal + fee;
    }

    /**
     * @notice Validate flash loan parameters before execution
     * @dev Ensures the flash loan request is properly structured
     * @param pool The Aave v3 Pool address
     * @param asset The asset to borrow
     * @param amount The amount to borrow
     * @param receiver The receiver of the flash loan
     * @return isValid True if parameters are valid
     */
    function validateFlashLoanParams(
        address pool,
        address asset,
        uint256 amount,
        address receiver
    ) external pure returns (bool isValid) {
        return pool != address(0) && 
               asset != address(0) && 
               amount > 0 && 
               receiver != address(0);
    }
} 