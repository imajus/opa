import { describe, it, expect } from 'vitest';
import chainlinkCalculator from '../../src/extensions/chainlink-calculator.js';
import { HookType } from '../../src/constants.js';
import { Extension } from '@1inch/limit-order-sdk';

describe('Chainlink Calculator Extension Wrapper', function () {
  const singleOracleConfig = {
    [HookType.MAKER_AMOUNT]: {
      type: 'single',
      config: {
        oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD feed
        spread: '1000000', // 0.1%
        inverse: false,
      },
    },
  };

  const doubleOracleConfig = {
    [HookType.MAKER_AMOUNT]: {
      type: 'double',
      config: {
        oracle1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
        oracle2: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', // DAI/USD
        decimalsScale: 0,
        spread: '5000000', // 0.5%
      },
    },
  };

  describe('single oracle configuration', function () {
    it('should validate correct single oracle parameters', function () {
      const errors = chainlinkCalculator.validate(singleOracleConfig);
      expect(errors).to.be.null;
    });

    it('should reject invalid oracle address', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'single',
          config: {
            oracle: 'invalid-address',
            spread: '1000000',
            inverse: false,
          },
        },
      };
      const errors = chainlinkCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject invalid spread value', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'single',
          config: {
            oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            spread: 'invalid-spread',
            inverse: false,
          },
        },
      };
      const errors = chainlinkCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should build valid Extension for single oracle', function () {
      const extension = chainlinkCalculator.build(singleOracleConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle inverse flag correctly', function () {
      const inverseConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'single',
          config: {
            oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            spread: '1000000',
            inverse: true,
          },
        },
      };

      const errors = chainlinkCalculator.validate(inverseConfig);
      expect(errors).to.be.null;
      const extension = chainlinkCalculator.build(inverseConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('double oracle configuration', function () {
    it('should validate correct double oracle parameters', function () {
      const errors = chainlinkCalculator.validate(doubleOracleConfig);
      expect(errors).to.be.null;
    });

    it('should reject invalid oracle addresses', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'double',
          config: {
            oracle1: 'invalid-address1',
            oracle2: 'invalid-address2',
            decimalsScale: 0,
            spread: '5000000',
          },
        },
      };
      const errors = chainlinkCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should handle negative decimals scale', function () {
      const negativeScaleConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'double',
          config: {
            oracle1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            oracle2: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
            decimalsScale: -6,
            spread: '5000000',
          },
        },
      };
      const errors = chainlinkCalculator.validate(negativeScaleConfig);
      expect(errors).to.be.null;
      const extension = chainlinkCalculator.build(negativeScaleConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should build valid Extension for double oracle', function () {
      const extension = chainlinkCalculator.build(doubleOracleConfig);
      expect(extension).to.be.instanceOf(Extension);
      // Verify both making and taking amount data are set
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('configuration type validation', function () {
    it('should reject unknown configuration type', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'unknown',
          config: {
            oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            spread: '1000000',
          },
        },
      };
      const errors = chainlinkCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject missing type field', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          config: {
            oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            spread: '1000000',
          },
        },
      };
      const errors = chainlinkCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });
  });

  describe('integration scenarios', function () {
    it('should handle real mainnet oracle addresses', function () {
      const mainnetConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'single',
          config: {
            oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // Real ETH/USD feed
            spread: '2000000', // 0.2%
            inverse: false,
          },
        },
      };

      const extension = chainlinkCalculator.build(mainnetConfig);
      expect(extension.isEmpty()).to.be.false;
      expect(extension.makingAmountData).to.exist;
      expect(extension.takingAmountData).to.exist;
    });

    it('should handle cross-asset pricing with double oracle', function () {
      const crossAssetConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'double',
          config: {
            oracle1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
            oracle2: '0x773616E4d11A78F511299002da57A0a94577F1f4', // BTC/USD
            decimalsScale: 10, // 18 - 8 decimals difference
            spread: '10000000', // 1%
          },
        },
      };

      const extension = chainlinkCalculator.build(crossAssetConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle minimal spread values', function () {
      const minimalSpreadConfig = {
        [HookType.MAKER_AMOUNT]: {
          type: 'single',
          config: {
            oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            spread: '1', // Very small spread
            inverse: false,
          },
        },
      };

      const errors = chainlinkCalculator.validate(minimalSpreadConfig);
      expect(errors).to.be.null;

      const extension = chainlinkCalculator.build(minimalSpreadConfig);
      expect(extension.isEmpty()).to.be.false;
    });
  });
});
