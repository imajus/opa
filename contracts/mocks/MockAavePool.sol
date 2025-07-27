// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MockAavePool
 * @notice Mock implementation of Aave v3 Pool for testing FlashLoanAdapter
 * @dev This contract simulates the flashLoanSimple function for unit testing
 */
contract MockAavePool {
    /// @notice Events
    event FlashLoanSimpleExecuted(
        address indexed receivingAddress,
        address indexed asset,
        uint256 amount,
        bytes params,
        uint16 referralCode
    );

    /// @notice Flag to simulate flash loan failures
    bool public shouldFail = false;

    /// @notice Error for simulating flash loan failures
    error FlashLoanSimulatedFailure();

    /**
     * @notice Mock implementation of Aave v3 flashLoanSimple
     * @param receivingAddress The address that will receive the flash loan
     * @param asset The address of the asset to flash loan
     * @param amount The amount to flash loan
     * @param params Additional parameters for the flash loan
     * @param referralCode Referral code for the flash loan
     */
    function flashLoanSimple(
        address receivingAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Simulate failure if flag is set
        if (shouldFail) {
            revert FlashLoanSimulatedFailure();
        }

        // Emit event to verify the call was made
        emit FlashLoanSimpleExecuted(receivingAddress, asset, amount, params, referralCode);

        // In a real implementation, this would:
        // 1. Transfer the asset to receivingAddress
        // 2. Call executeOperation on receivingAddress
        // 3. Pull back amount + premium from receivingAddress
        
        // For testing, we just emit the event to verify parameters
    }

    /**
     * @notice Set the failure flag for testing error conditions
     * @param _shouldFail Whether the flash loan should fail
     */
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
} 