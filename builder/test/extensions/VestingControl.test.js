import { describe, it, expect, beforeEach } from 'vitest';
import vestingControlWrapper from '../../lib/extensions/VestingControl.js';
import { HookType } from '../../lib/constants.js';

describe('VestingControl Extension Wrapper', () => {
  let params;

  beforeEach(() => {
    params = {
      [HookType.PRE_INTERACTION]: {
        vestingPeriod: 2592000, // 30 days
        totalPeriods: 12, // 12 months
        startTime: Math.floor(Date.now() / 1000) + 7776000, // 90 days from now (cliff)
      },
    };
  });

  describe('Metadata', () => {
    it('should have correct name and description', () => {
      expect(vestingControlWrapper.meta.name).toBe('Vesting Control');
      expect(vestingControlWrapper.meta.description).toContain('token vesting');
      expect(vestingControlWrapper.meta.version).toBe('1.0.0');
    });
  });

  describe('Schema Validation', () => {
    it('should validate valid vesting parameters', () => {
      const errors = vestingControlWrapper.validate(params);
      expect(errors).toBeNull();
    });

    it('should reject invalid vesting period', () => {
      params[HookType.PRE_INTERACTION].vestingPeriod = 0;
      const errors = vestingControlWrapper.validate(params);
      expect(errors).not.toBeNull();
      expect(errors[HookType.PRE_INTERACTION].message).toContain('positive');
    });

    it('should reject invalid total periods', () => {
      params[HookType.PRE_INTERACTION].totalPeriods = 0;
      const errors = vestingControlWrapper.validate(params);
      expect(errors).not.toBeNull();
      expect(errors[HookType.PRE_INTERACTION].message).toContain('positive');
    });

    it('should reject start time in the past', () => {
      params[HookType.PRE_INTERACTION].startTime =
        Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const errors = vestingControlWrapper.validate(params);
      expect(errors).not.toBeNull();
      expect(errors[HookType.PRE_INTERACTION].message).toContain('past');
    });

    it('should reject excessively long vesting periods', () => {
      params[HookType.PRE_INTERACTION].vestingPeriod = 365 * 24 * 60 * 60; // 1 year per period
      params[HookType.PRE_INTERACTION].totalPeriods = 100; // 100 years total
      const errors = vestingControlWrapper.validate(params);
      expect(errors).not.toBeNull();
      expect(errors[HookType.PRE_INTERACTION].message).toContain('20 years');
    });

    it('should reject too many periods', () => {
      params[HookType.PRE_INTERACTION].totalPeriods = 1001;
      const errors = vestingControlWrapper.validate(params);
      expect(errors).not.toBeNull();
      expect(errors[HookType.PRE_INTERACTION].message).toContain('1000');
    });

    it('should reject too short vesting periods', () => {
      params[HookType.PRE_INTERACTION].vestingPeriod = 1800; // 30 minutes
      const errors = vestingControlWrapper.validate(params);
      expect(errors).not.toBeNull();
      expect(errors[HookType.PRE_INTERACTION].message).toContain('1 hour');
    });
  });

  describe('Parameter Parsing', () => {
    it('should parse vesting period as integer', async () => {
      const parsed = await vestingControlWrapper.schemas[
        HookType.PRE_INTERACTION
      ].parse({
        vestingPeriod: '2592000.5', // Should floor to integer
        totalPeriods: '12',
        startTime: String(Math.floor(Date.now() / 1000) + 7776000),
      });

      expect(parsed.vestingPeriod).toBe(2592000);
      expect(typeof parsed.vestingPeriod).toBe('number');
    });

    it('should parse total periods as integer', async () => {
      const parsed = await vestingControlWrapper.schemas[
        HookType.PRE_INTERACTION
      ].parse({
        vestingPeriod: '2592000',
        totalPeriods: '12.9', // Should floor to integer
        startTime: String(Math.floor(Date.now() / 1000) + 7776000),
      });

      expect(parsed.totalPeriods).toBe(12);
      expect(typeof parsed.totalPeriods).toBe('number');
    });

    it('should parse start time as integer timestamp', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 7776000;
      const parsed = await vestingControlWrapper.schemas[
        HookType.PRE_INTERACTION
      ].parse({
        vestingPeriod: '2592000',
        totalPeriods: '12',
        startTime: String(futureTime),
      });

      expect(parsed.startTime).toBe(futureTime);
      expect(typeof parsed.startTime).toBe('number');
    });
  });

  describe('Real-world Examples', () => {
    it('should handle startup vesting scenario', () => {
      const startupParams = {
        [HookType.PRE_INTERACTION]: {
          vestingPeriod: 2592000, // 30 days
          totalPeriods: 48, // 4 years monthly
          startTime: Math.floor(Date.now() / 1000) + 31536000, // 1 year cliff
        },
      };

      const errors = vestingControlWrapper.validate(startupParams);
      expect(errors).toBeNull();
    });

    it('should handle investor protection schedule', () => {
      const investorParams = {
        [HookType.PRE_INTERACTION]: {
          vestingPeriod: 7776000, // 90 days (quarterly)
          totalPeriods: 8, // 2 years quarterly
          startTime: Math.floor(Date.now() / 1000) + 7776000, // 3 month cliff
        },
      };

      const errors = vestingControlWrapper.validate(investorParams);
      expect(errors).toBeNull();
    });

    it('should handle weekly vesting schedule', () => {
      const weeklyParams = {
        [HookType.PRE_INTERACTION]: {
          vestingPeriod: 604800, // 7 days
          totalPeriods: 52, // 1 year weekly
          startTime: Math.floor(Date.now() / 1000) + 86400, // 1 day from now (minimal cliff)
        },
      };

      const errors = vestingControlWrapper.validate(weeklyParams);
      expect(errors).toBeNull();
    });
  });
});
