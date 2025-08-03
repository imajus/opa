import { ExtensionBuilder, Interaction, Address } from '@1inch/limit-order-sdk';
import { createWrapper, createSchema } from './utils/factory.js';
import { timestamp, uint256 } from './utils/types.js';
import { HookType } from '../constants.js';
import Config from '../config.js';

/**
 * VestingControl extension wrapper for 1inch Limit Order Protocol
 *
 * Enables token vesting with configurable cliff periods and periodic unlocks.
 * Validates that fills respect vesting schedule timing and per-period limits.
 */

/**
 * Encodes vesting parameters for VestingControl extension
 * @param {Object} config - Vesting configuration
 * @param {number} config.vestingPeriod - Duration between unlocks in seconds
 * @param {number} config.totalPeriods - Total number of unlock periods
 * @param {number} config.startTime - When vesting begins (after cliff)
 * @returns {string} ABI-encoded extension data
 */
function encodeVestingParams({ vestingPeriod, totalPeriods, startTime }) {
  // ABI encode the three uint256 values: vestingPeriod, totalPeriods, startTime
  const vestingPeriodHex = BigInt(vestingPeriod).toString(16).padStart(64, '0');
  const totalPeriodsHex = BigInt(totalPeriods).toString(16).padStart(64, '0');
  const startTimeHex = BigInt(startTime).toString(16).padStart(64, '0');
  return '0x' + vestingPeriodHex + totalPeriodsHex + startTimeHex;
}

/**
 * Custom field type for vesting period (duration in seconds)
 */
export const vestingPeriod = {
  validate(value) {
    if (isNaN(value)) {
      throw new Error('Vesting period must be a number');
    }
    const numValue = Number(value);
    if (numValue <= 0) {
      throw new Error('Vesting period must be positive');
    }
    if (numValue < 3600) {
      // 1 hour minimum
      throw new Error('Vesting period must be at least 1 hour (3600 seconds)');
    }
    if (numValue > 10 * 365 * 24 * 60 * 60) {
      // 10 years maximum
      throw new Error('Vesting period cannot exceed 10 years');
    }
  },
  parse: (value) => Math.floor(Number(value)),
};

/**
 * Custom field type for total periods count
 */
export const totalPeriods = {
  validate(value) {
    if (isNaN(value)) {
      throw new Error('Total periods must be a number');
    }
    const numValue = Number(value);
    if (!Number.isInteger(numValue)) {
      throw new Error('Total periods must be an integer');
    }
    if (numValue <= 0) {
      throw new Error('Total periods must be positive');
    }
    if (numValue > 1000) {
      throw new Error('Total periods cannot exceed 1000');
    }
  },
  parse: (value) => Math.floor(Number(value)),
};

/**
 * VestingControl extension wrapper
 * Provides token vesting functionality with cliff periods and periodic unlocks
 */
const vestingControlWrapper = createWrapper({
  name: 'Vesting Control',
  description:
    'Enables token vesting with configurable cliff periods and periodic unlocks, ensuring fills respect timing and amount constraints',
  hooks: {
    [HookType.PRE_INTERACTION]: createSchema({
      hint: 'Vesting schedule configuration for validation and unlock timing',
      fields: {
        vestingPeriod: {
          label: 'Vesting Period',
          type: vestingPeriod,
          hint: 'Duration between each unlock in seconds (e.g., 2592000 for 30 days)',
        },
        totalPeriods: {
          label: 'Total Periods',
          type: totalPeriods,
          hint: 'Total number of unlock periods (e.g., 12 for monthly unlocks over 1 year)',
        },
        startTime: {
          label: 'Start Time',
          type: timestamp,
          hint: 'When vesting begins (Unix timestamp). Set to current time + cliff duration.',
        },
      },
      validate: ({ vestingPeriod, totalPeriods, startTime }) => {
        const currentTime = Math.floor(Date.now() / 1000);
        // Validate start time is not in the past (allow 5 minute buffer)
        // if (Number(startTime) < currentTime) {
        //   throw new Error('Start time cannot be in the past');
        // }
        // Validate total vesting duration is reasonable
        const totalDuration = Number(vestingPeriod) * Number(totalPeriods);
        if (totalDuration > 20 * 365 * 24 * 60 * 60) {
          // 20 years
          throw new Error('Total vesting duration cannot exceed 20 years');
        }
        // Validate end time is not too far in the future
        const endTime = Number(startTime) + totalDuration;
        const maxEndTime = currentTime + 20 * 365 * 24 * 60 * 60; // 20 years from now
        if (endTime > maxEndTime) {
          throw new Error('Vesting end time is too far in the future');
        }
      },
    }),
  },

  /**
   * Build function that creates an Extension instance for VestingControl
   * @param {Object} params - Validated parameters
   * @param {Object} params.preInteraction - Pre-interaction configuration
   * @returns {Extension} 1inch SDK Extension instance
   */
  build(params) {
    const { address } = Config.extensions.vestingControl;
    const target = new Address(address);
    const builder = new ExtensionBuilder();
    // Get vesting configuration from pre-interaction params
    const vestingConfig = params[HookType.PRE_INTERACTION];
    // Encode vesting parameters for extension data
    const extensionData = encodeVestingParams(vestingConfig);
    // Set pre-interaction for validation
    const interaction = new Interaction(target, extensionData);
    builder.withPreInteraction(interaction);
    // Build and return the Extension
    return builder.build();
  },
});

export default vestingControlWrapper;
