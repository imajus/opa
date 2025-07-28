import { z } from 'zod';

/**
 * Ethereum address validation (0x + 40 hex characters)
 */
export const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address');

/**
 * uint256 validation - accepts string representation of large numbers
 */
export const uint256 = z
  .string()
  .regex(/^[0-9]+$/, 'Must be a valid uint256 string')
  .refine((val) => {
    try {
      const bigInt = BigInt(val);
      return bigInt >= 0n && bigInt <= 2n ** 256n - 1n;
    } catch {
      return false;
    }
  }, 'Must be a valid uint256 value');

/**
 * Bytes32 validation (0x + 64 hex characters)
 */
export const bytes32 = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid bytes32 value');

/**
 * Bytes validation (0x + even number of hex characters)
 */
export const bytes = z
  .string()
  .regex(/^0x([a-fA-F0-9]{2})*$/, 'Must be valid hex bytes');

/**
 * Boolean validation - accepts various boolean representations
 */
export const boolean = z.union([
  z.boolean(),
  z.string().transform((val) => val.toLowerCase() === 'true'),
  z.number().transform((val) => val !== 0),
]);

/**
 * Timestamp validation (Unix timestamp)
 */
export const timestamp = z
  .number()
  .int()
  .nonnegative()
  .or(
    z
      .string()
      .regex(/^[0-9]+$/)
      .transform(Number)
  );

/**
 * Percentage validation (0-100)
 */
export const percentage = z
  .number()
  .min(0, 'Percentage must be >= 0')
  .max(100, 'Percentage must be <= 100');

/**
 * Basis points validation (0-10000, where 10000 = 100%)
 */
export const basisPoints = z
  .number()
  .int()
  .min(0, 'Basis points must be >= 0')
  .max(10000, 'Basis points must be <= 10000');
