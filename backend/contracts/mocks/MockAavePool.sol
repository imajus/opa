// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Interface for flash loan receiver callback
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
 * @title MockAavePool
 * @notice Mock implementation of Aave v3 Pool for testing Gas Station flash loans
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

        // Simulate real Aave flash loan behavior:
        // 1. Transfer the asset to receivingAddress
        IERC20(asset).transfer(receivingAddress, amount);
        
        // 2. Call executeOperation on receivingAddress
        uint256 premium = (amount * 5) / 10000; // 0.05% fee
        bool success = IFlashLoanReceiver(receivingAddress).executeOperation(
            asset,
            amount,
            premium,
            msg.sender,
            params
        );
        
        require(success, "Flash loan execution failed");
        
        // 3. For simplicity in testing, we'll defer the repayment pull
        // In a real implementation, this would be enforced at the end of the transaction
    }

    /**
     * @notice Set the failure flag for testing error conditions
     * @param _shouldFail Whether the flash loan should fail
     */
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    /**
     * @notice Manual repayment function for testing
     * @param asset The asset to repay
     * @param amount The amount to repay (including premium)
     * @param from The address to pull repayment from
     */
    function repayFlashLoan(address asset, uint256 amount, address from) external {
        IERC20(asset).transferFrom(from, address(this), amount);
    }
} 