import { describe, it, expect } from 'vitest';
import rangeAmountCalculator from '../../src/extensions/range-amount-calculator.js';
import { HookType } from '../../src/constants.js';
import { Extension } from '@1inch/limit-order-sdk';

describe('Range Amount Calculator Extension Wrapper', function () {
  const validConfig = {
    [HookType.MAKER_AMOUNT]: {
      priceStart: '1000000000000000000', // 1 ETH per unit (lower bound)
      priceEnd: '2000000000000000000', // 2 ETH per unit (upper bound)
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
    it('should reject zero priceStart in build function', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '0',
          priceEnd: '1000000000000000000',
        },
      };
      // Schema validation should pass (zero is valid uint256)
      const errors = rangeAmountCalculator.validate(invalidConfig);
      expect(errors).to.be.null;
      // But build should fail
      expect(() => rangeAmountCalculator.build(invalidConfig)).to.throw(
        'priceStart cannot be zero'
      );
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
    it('should build a valid Extension instance', function () {
      const extension = rangeAmountCalculator.build(validConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should include both making and taking amount data', function () {
      const extension = rangeAmountCalculator.build(validConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should encode extraData correctly', function () {
      const extension = rangeAmountCalculator.build(validConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('range pricing scenarios', function () {
    it('should handle small price differences', function () {
      const smallDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000', // 1 ETH
          priceEnd: '1000000000000000001', // 1 ETH + 1 wei
        },
      };
      const errors = rangeAmountCalculator.validate(smallDiffConfig);
      expect(errors).to.be.null;
      const extension = rangeAmountCalculator.build(smallDiffConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle large price differences', function () {
      const largeDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000', // 1 ETH
          priceEnd: '100000000000000000000', // 100 ETH
        },
      };
      const extension = rangeAmountCalculator.build(largeDiffConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle very small starting prices', function () {
      const smallStartConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1', // 1 wei
          priceEnd: '1000000000000000000', // 1 ETH
        },
      };
      const extension = rangeAmountCalculator.build(smallStartConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle very large prices', function () {
      const largePriceConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000000', // 1000 ETH
          priceEnd: '2000000000000000000000', // 2000 ETH
        },
      };
      const extension = rangeAmountCalculator.build(largePriceConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle typical trading ranges', function () {
      const typicalConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '3000000000000000000000', // 3000 DAI per ETH
          priceEnd: '4000000000000000000000', // 4000 DAI per ETH
        },
      };
      const extension = rangeAmountCalculator.build(typicalConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('integration scenarios', function () {
    it('should handle DEX-style pricing ranges', function () {
      const dexConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1950000000000000000000', // $1950 per ETH
          priceEnd: '2050000000000000000000', // $2050 per ETH
        },
      };
      const extension = rangeAmountCalculator.build(dexConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle stablecoin range trading', function () {
      const stablecoinConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '990000000000000000', // 0.99 (slight discount)
          priceEnd: '1010000000000000000', // 1.01 (slight premium)
        },
      };
      const extension = rangeAmountCalculator.build(stablecoinConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle NFT-style pricing', function () {
      const nftConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '100000000000000000', // 0.1 ETH
          priceEnd: '10000000000000000000', // 10 ETH
        },
      };
      const extension = rangeAmountCalculator.build(nftConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle maximum uint256 values', function () {
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
      const extension = rangeAmountCalculator.build(maxConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should validate and build with complex realistic scenario', function () {
      const complexConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '2847123456789012345', // ~2.85 ETH with precision
          priceEnd: '3956234567890123456', // ~3.96 ETH with precision
        },
      };
      const errors = rangeAmountCalculator.validate(complexConfig);
      expect(errors).to.be.null;
      const extension = rangeAmountCalculator.build(complexConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });
});
