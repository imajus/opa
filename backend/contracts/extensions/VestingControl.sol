// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/IPreInteraction.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VestingControl
 * @notice Vesting Control extension for 1inch Limit Order Protocol that enables token vesting with cliffs and periodic unlocks
 * @dev Allows projects/founders to create vesting schedules for investors with customizable cliff periods and unlock schedules.
 *      Orders can only be filled according to the vesting timeline, with each fill representing an unlock period.
 *      Vesting parameters are encoded in the extension data and no state is stored in the contract.
 */
contract VestingControl is IPreInteraction {
    using AddressLib for Address;

    /// @notice Vesting schedule configuration (encoded in extension data)
    struct VestingParams {
        uint256 vestingPeriod;      // Duration between each unlock in seconds  
        uint256 totalPeriods;       // Total number of unlock periods
        uint256 startTime;          // When vesting can begin (after cliff period)
    }

    /// @notice Events
    event VestingUnlock(
        address indexed taker,
        uint256 amount,
        uint256 period,
        uint256 timestamp
    );

    /// @notice Errors
    error VestingNotStarted();
    error InvalidUnlockAmount();
    error InvalidVestingParameters();
    error VestingAlreadyCompleted();

    /**
     * @notice Decode vesting parameters from extension data
     * @param extension Encoded vesting parameters
     * @return params Decoded vesting parameters
     */
    function decodeVestingParams(bytes calldata extension) public pure returns (VestingParams memory params) {
        return abi.decode(extension, (VestingParams));
    }

    /**
     * @notice Pre-interaction hook to validate vesting conditions and emit unlock events
     * @dev Called before asset transfers to ensure vesting schedule is respected
     */
    function preInteraction(
        IOrderMixin.Order calldata order,
        bytes calldata,
        bytes32,
        address taker,
        uint256 makingAmount,
        uint256,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external override {
        // Decode vesting parameters from extension data (last argument)
        VestingParams memory params = decodeVestingParams(extraData);
        
        // Validate parameters
        if (params.totalPeriods == 0 || params.vestingPeriod == 0) {
            revert InvalidVestingParameters();
        }

        // Check if vesting has started (startTime is after cliff period)
        if (block.timestamp < params.startTime) {
            revert VestingNotStarted();
        }

        // Calculate the original total amount from remainingMakingAmount + already filled
        uint256 totalAmount = order.makingAmount;
        uint256 alreadyFilled = totalAmount - remainingMakingAmount;

        // Check if vesting is already completed
        if (alreadyFilled >= totalAmount) {
            revert VestingAlreadyCompleted();
        }

        // Calculate which vesting period we should be in
        uint256 timeSinceStart = block.timestamp - params.startTime;
        uint256 currentPeriod = (timeSinceStart / params.vestingPeriod) + 1;
        
        // Ensure we don't exceed total periods
        if (currentPeriod > params.totalPeriods) {
            currentPeriod = params.totalPeriods;
        }

        // Calculate how much should be vested by now
        uint256 amountPerPeriod = totalAmount / params.totalPeriods;
        uint256 shouldBeVested = currentPeriod * amountPerPeriod;
        
        // Handle rounding for the last period
        if (currentPeriod == params.totalPeriods) {
            shouldBeVested = totalAmount;
        }

        // Check if this fill would exceed what should be vested
        if (alreadyFilled + makingAmount > shouldBeVested) {
            revert InvalidUnlockAmount();
        }

        // Ensure we're not trying to fill more than one period at a time
        if (makingAmount > amountPerPeriod) {
            revert InvalidUnlockAmount();
        }

        // Emit vesting unlock event
        emit VestingUnlock(
            taker,
            makingAmount,
            currentPeriod,
            block.timestamp
        );
    }
}