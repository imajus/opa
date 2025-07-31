/**
 * Common field types for extension schemas
 * Each type implements ExtensionSchemaFieldType interface with validate and parse methods
 */

import { parseUnits } from 'ethers';

/**
 * Ethereum address field type
 * Validates and parses Ethereum addresses
 * @type {ExtensionSchemaFieldType}
 */
export const address = {
  validate(value) {
    if (typeof value !== 'string') {
      throw new Error('Address must be a string');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error('Invalid Ethereum address format');
    }
  },
  parse(value) {
    return value.toLowerCase();
  },
};

/**
 * 256-bit unsigned integer field type
 * Validates and parses uint256 values
 * @type {ExtensionSchemaFieldType}
 */
export const uint256 = {
  validate(value) {
    if (value === undefined || value === null) {
      throw new Error('Value cannot be undefined or null');
    }
    let bigIntValue;
    try {
      bigIntValue = BigInt(value);
    } catch (error) {
      throw new Error('Value must be convertible to BigInt');
    }
    if (bigIntValue < 0n) {
      throw new Error('Value must be non-negative');
    }
    if (bigIntValue >= 2n ** 256n) {
      throw new Error('Value exceeds uint256 maximum');
    }
  },
  parse(value) {
    return BigInt(value).toString();
  },
};

/**
 * Boolean field type
 * Validates and parses boolean values
 * @type {ExtensionSchemaFieldType}
 */
export const boolean = {
  validate(value) {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      throw new Error('Value must be a boolean or "true"/"false" string');
    }
  },
  parse(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  },
};

/**
 * Unix timestamp field type
 * Validates and parses timestamp values
 * @type {ExtensionSchemaFieldType}
 */
export const timestamp = {
  validate(value) {
    if (value === undefined || value === null) {
      throw new Error('Timestamp cannot be undefined or null');
    }
    let numValue;
    try {
      numValue = Number(value);
    } catch (error) {
      throw new Error('Timestamp must be convertible to number');
    }
    if (!Number.isInteger(numValue)) {
      throw new Error('Timestamp must be an integer');
    }
    if (numValue < 0) {
      throw new Error('Timestamp must be non-negative');
    }
    // Check for reasonable timestamp bounds (not too far in the future)
    const maxTimestamp =
      Math.floor(Date.now() / 1000) + 100 * 365 * 24 * 60 * 60; // ~100 years from now
    if (numValue > maxTimestamp) {
      throw new Error('Timestamp is too far in the future');
    }
  },
  parse(value) {
    return Math.floor(Number(value));
  },
};

/**
 * Maker token amount field type
 * Validates and parses token amounts for maker assets
 * @type {ExtensionSchemaFieldType}
 */
export const makerTokenAmount = {
  validate(value) {
    if (isNaN(value)) {
      throw new Error('Token amount must be a number');
    }
    if (Number(value) <= 0) {
      throw new Error('Token amount must be positive');
    }
  },
  async parse(value, context) {
    return parseUnits(value, await context.makerAsset.decimals());
  },
};

/**
 * Taker token amount field type
 * Validates and parses token amounts for taker assets
 * @type {ExtensionSchemaFieldType}
 */
export const takerTokenAmount = {
  validate(value) {
    if (isNaN(value)) {
      throw new Error('Token amount must be a number');
    }
    if (Number(value) <= 0) {
      throw new Error('Token amount must be positive');
    }
  },
  async parse(value, context) {
    return parseUnits(value, await context.takerAsset.decimals());
  },
};
