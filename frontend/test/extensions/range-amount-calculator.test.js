import { describe, it, expect } from 'vitest';
import rangeAmountCalculator from '../../src/extensions/range-amount-calculator.js';
import { HookType } from '../../src/constants.js';

describe('Range Amount Calculator Extension Wrapper', function () {
  const validConfig = {
    [HookType.MAKER_AMOUNT]: {
      priceStart: '1000000000000000000', // 1 ETH per unit (lower bound)
      priceEnd: '2000000000000000000', // 2 ETH per unit (upper bound)
    },
  };

  describe('wrapper structure', function () {
    it('should have correct meta information', function () {
      expect(rangeAmountCalculator.meta).to.deep.equal({
        name: 'Range Amount Calculator',
        description:
          'Linear price progression within a specified range as the order gets filled',
        version: '1.0.0',
      });
    });

    it('should have correct hook schemas', function () {
      expect(rangeAmountCalculator.schemas).to.have.property(
        HookType.MAKER_AMOUNT
      );
      expect(rangeAmountCalculator.schemas).to.have.property(
        HookType.TAKER_AMOUNT
      );
    });

    it('should have build and validate functions', function () {
      expect(rangeAmountCalculator.build).to.be.a('function');
      expect(rangeAmountCalculator.validate).to.be.a('function');
    });
  });

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

      expect(extension).to.be.an('object');
      expect(extension).to.have.property('type', 'Extension');
      expect(extension).to.have.property('name', 'RangeAmountCalculator');
      expect(extension).to.have.property('data');
      expect(extension).to.have.property('encode');
      expect(extension).to.have.property('isEmpty');
      expect(extension).to.have.property('keccak256');

      // Verify it's not empty
      expect(extension.isEmpty()).to.be.false;

      // Verify encode returns hex string
      expect(extension.encode()).to.be.a('string');
      expect(extension.encode()).to.equal('0x');

      // Verify keccak256 returns bigint
      expect(extension.keccak256()).to.be.a('bigint');
    });

    it('should include both making and taking amount data', function () {
      const extension = rangeAmountCalculator.build(validConfig);

      expect(extension.data).to.have.property('makingAmountData');
      expect(extension.data).to.have.property('takingAmountData');

      // Both should have the same address (contract address)
      expect(extension.data.makingAmountData.address).to.equal(
        extension.data.takingAmountData.address
      );

      // Both should have extraData
      expect(extension.data.makingAmountData.data).to.be.a('string');
      expect(extension.data.takingAmountData.data).to.be.a('string');

      // ExtraData should be the same for both (same configuration)
      expect(extension.data.makingAmountData.data).to.equal(
        extension.data.takingAmountData.data
      );
    });

    it('should encode extraData correctly', function () {
      const extension = rangeAmountCalculator.build(validConfig);
      const extraData = extension.data.makingAmountData.data;

      // Should be a hex string
      expect(extraData).to.match(/^0x[0-9a-f]+$/i);

      // Should be exactly 128 characters (0x + 64*2 hex chars for 2 uint256 values)
      expect(extraData).to.have.length(130); // 0x + 128 hex chars
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
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle large price differences', function () {
      const largeDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000', // 1 ETH
          priceEnd: '100000000000000000000', // 100 ETH
        },
      };

      const extension = rangeAmountCalculator.build(largeDiffConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle very small starting prices', function () {
      const smallStartConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1', // 1 wei
          priceEnd: '1000000000000000000', // 1 ETH
        },
      };

      const extension = rangeAmountCalculator.build(smallStartConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle very large prices', function () {
      const largePriceConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '1000000000000000000000', // 1000 ETH
          priceEnd: '2000000000000000000000', // 2000 ETH
        },
      };

      const extension = rangeAmountCalculator.build(largePriceConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle typical trading ranges', function () {
      const typicalConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '3000000000000000000000', // 3000 DAI per ETH
          priceEnd: '4000000000000000000000', // 4000 DAI per ETH
        },
      };

      const extension = rangeAmountCalculator.build(typicalConfig);
      expect(extension.isEmpty()).to.be.false;
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
      expect(extension.isEmpty()).to.be.false;
      expect(extension.data.makingAmountData.address).to.equal(
        extension.data.takingAmountData.address
      );
    });

    it('should handle stablecoin range trading', function () {
      const stablecoinConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '990000000000000000', // 0.99 (slight discount)
          priceEnd: '1010000000000000000', // 1.01 (slight premium)
        },
      };

      const extension = rangeAmountCalculator.build(stablecoinConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle NFT-style pricing', function () {
      const nftConfig = {
        [HookType.MAKER_AMOUNT]: {
          priceStart: '100000000000000000', // 0.1 ETH
          priceEnd: '10000000000000000000', // 10 ETH
        },
      };

      const extension = rangeAmountCalculator.build(nftConfig);
      expect(extension.isEmpty()).to.be.false;
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
      expect(extension.isEmpty()).to.be.false;
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
      expect(extension).to.be.an('object');
      expect(extension.type).to.equal('Extension');
      expect(extension.isEmpty()).to.be.false;

      // Verify the extraData encoding includes both prices
      const extraData = extension.data.makingAmountData.data;
      expect(extraData).to.be.a('string');
      expect(extraData.length).to.equal(130); // 0x + 128 hex chars for 2 uint256s
    });
  });
});
