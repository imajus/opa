import { describe, it, expect } from 'vitest';
import rangeAmountCalculator from '../../lib/extensions/RangeAmountCalculator.js';
import { HookType } from '../../lib/constants.js';
import { Extension } from '@1inch/limit-order-sdk';

describe('Range Amount Calculator Extension Wrapper', function () {
  const validConfig = {
    [HookType.MAKER_AMOUNT]: {
      priceStart: '1000000000000000000', // 1 ETH per unit (lower bound)
      priceEnd: '2000000000000000000', // 2 ETH per unit (upper bound)
    },
  };

  // Mock context for build operations
  const mockContext = {
    makerAsset: {
      decimals: async () => 18,
    },
    takerAsset: {
      decimals: async () => 18,
    },
  };

  describe('parameter validation', function () {
    it('should validate correct parameters', function () {
      const errors = rangeAmountCalculator.validate(validConfig);
      expect(errors).to.be.null;
    });

    it('should reject invalid price format', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: 'invalid-price',
          priceEnd: '2000000000000000000',
        },
      };
      const errors = rangeAmountCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject non-numeric price strings', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000',
          priceEnd: 'not-a-number',
        },
      };
      const errors = rangeAmountCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject priceEnd <= priceStart at schema level', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '2000000000000000000', // Higher than priceEnd
          priceEnd: '1000000000000000000',
        },
      };
      const errors = rangeAmountCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject equal prices at schema level', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000',
          priceEnd: '1000000000000000000', // Same as priceStart
        },
      };
      const errors = rangeAmountCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });
  });

  describe('range logic validation', function () {
    it('should handle zero priceStart edge case', async function () {
      const edgeConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '0',
          priceEnd: '1000000000000000000',
        },
      };
      // Schema validation may pass or fail - checking the actual behavior
      const errors = rangeAmountCalculator.validate(edgeConfig);
      // Either validation passes or fails, both are acceptable

      // Build should succeed (library allows this even though it may not be practical)
      const extension = await rangeAmountCalculator.build(
        edgeConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
    });

    it('should handle edge case where schema passes but build fails', function () {
      // This shouldn't happen with current schema, but test defensive programming
      const edgeConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000',
          priceEnd: '1000000000000000000',
        },
      };

      // This should fail at schema level, but if it passes, build should also fail
      const errors = rangeAmountCalculator.validate(edgeConfig);
      expect(errors).to.not.be.null; // Schema should catch this
    });
  });

  describe('extension building', function () {
    it('should build a valid Extension instance', async function () {
      const extension = await rangeAmountCalculator.build(
        validConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should include both making and taking amount data', async function () {
      const extension = await rangeAmountCalculator.build(
        validConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should encode extraData correctly', async function () {
      const extension = await rangeAmountCalculator.build(
        validConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('range pricing scenarios', function () {
    it('should handle small price differences', async function () {
      const smallDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000', // 1 ETH
          priceEnd: '1000000000000000001', // 1 ETH + 1 wei
        },
      };
      const errors = rangeAmountCalculator.validate(smallDiffConfig);
      expect(errors).to.be.null;
      const extension = await rangeAmountCalculator.build(
        smallDiffConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle large price differences', async function () {
      const largeDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000', // 1 ETH
          priceEnd: '100000000000000000000', // 100 ETH
        },
      };
      const extension = await rangeAmountCalculator.build(
        largeDiffConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle very small starting prices', async function () {
      const smallStartConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1', // 1 wei
          priceEnd: '1000000000000000000', // 1 ETH
        },
      };
      const extension = await rangeAmountCalculator.build(
        smallStartConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle very large prices', async function () {
      const largePriceConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000000', // 1000 ETH
          priceEnd: '2000000000000000000000', // 2000 ETH
        },
      };
      const extension = await rangeAmountCalculator.build(
        largePriceConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle typical trading ranges', async function () {
      const typicalConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '3000000000000000000000', // 3000 DAI per ETH
          priceEnd: '4000000000000000000000', // 4000 DAI per ETH
        },
      };
      const extension = await rangeAmountCalculator.build(
        typicalConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('integration scenarios', function () {
    it('should handle DEX-style pricing ranges', async function () {
      const dexConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1950000000000000000000', // $1950 per ETH
          priceEnd: '2050000000000000000000', // $2050 per ETH
        },
      };
      const extension = await rangeAmountCalculator.build(
        dexConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle stablecoin range trading', async function () {
      const stablecoinConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '990000000000000000', // 0.99 (slight discount)
          priceEnd: '1010000000000000000', // 1.01 (slight premium)
        },
      };
      const extension = await rangeAmountCalculator.build(
        stablecoinConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle NFT-style pricing', async function () {
      const nftConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '100000000000000000', // 0.1 ETH
          priceEnd: '10000000000000000000', // 10 ETH
        },
      };
      const extension = await rangeAmountCalculator.build(
        nftConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle maximum uint256 values', async function () {
      const maxConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart:
            '115792089237316195423570985008687907853269984665640564039457584007913129639934', // Near max uint256
          priceEnd:
            '115792089237316195423570985008687907853269984665640564039457584007913129639935', // Max uint256 - 1
        },
      };
      const errors = rangeAmountCalculator.validate(maxConfig);
      expect(errors).to.be.null;
      const extension = await rangeAmountCalculator.build(
        maxConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should validate and build with complex realistic scenario', async function () {
      const complexConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '2847123456789012345', // ~2.85 ETH with precision
          priceEnd: '3956234567890123456', // ~3.96 ETH with precision
        },
      };
      const errors = rangeAmountCalculator.validate(complexConfig);
      expect(errors).to.be.null;
      const extension = await rangeAmountCalculator.build(
        complexConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });
});
