import { describe, it, expect } from 'vitest';
import dutchAuctionCalculator from '../../src/extensions/dutch-auction-calculator.js';
import { HookType } from '../../src/constants.js';

describe('Dutch Auction Calculator Extension Wrapper', function () {
  const currentTime = Math.floor(Date.now() / 1000);
  const validConfig = {
    [HookType.MAKER_AMOUNT]: {
      startTime: currentTime + 3600, // 1 hour from now
      endTime: currentTime + 7200, // 2 hours from now
      startAmount: '2000000000000000000', // 2 ETH (higher price)
      endAmount: '1000000000000000000', // 1 ETH (lower price)
    },
  };

  describe('wrapper structure', function () {
    it('should have correct meta information', function () {
      expect(dutchAuctionCalculator.meta).to.deep.equal({
        name: 'Dutch Auction Calculator',
        description:
          'Time-based price decay from start price to end price, implementing Dutch auction mechanics',
        version: '1.0.0',
      });
    });

    it('should have correct hook schemas', function () {
      expect(dutchAuctionCalculator.schemas).to.have.property(
        HookType.MAKER_AMOUNT
      );
      expect(dutchAuctionCalculator.schemas).to.have.property(
        HookType.TAKER_AMOUNT
      );
    });

    it('should have build and validate functions', function () {
      expect(dutchAuctionCalculator.build).to.be.a('function');
      expect(dutchAuctionCalculator.validate).to.be.a('function');
    });
  });

  describe('parameter validation', function () {
    it('should validate correct parameters', function () {
      const errors = dutchAuctionCalculator.validate(validConfig);
      expect(errors).to.be.null;
    });

    it('should reject invalid timestamp format', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: 'invalid-timestamp',
          endTime: currentTime + 7200,
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      const errors = dutchAuctionCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject invalid amount format', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: 'invalid-amount',
          endAmount: '1000000000000000000',
        },
      };
      const errors = dutchAuctionCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });

    it('should reject negative timestamps', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: -1000,
          endTime: currentTime + 7200,
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      const errors = dutchAuctionCalculator.validate(invalidConfig);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property(HookType.MAKER_AMOUNT);
    });
  });

  describe('auction logic validation', function () {
    it('should reject startTime >= endTime', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 7200, // Later than end time
          endTime: currentTime + 3600,
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      expect(() => dutchAuctionCalculator.build(invalidConfig)).to.throw(
        'Auction start time must be before end time'
      );
    });

    it('should reject startAmount <= endAmount', function () {
      const invalidConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: '1000000000000000000', // Same as end amount
          endAmount: '1000000000000000000',
        },
      };
      expect(() => dutchAuctionCalculator.build(invalidConfig)).to.throw(
        'Start amount must be greater than end amount for price decay'
      );
    });

    it('should accept equal timestamps edge case validation in schema', function () {
      const edgeConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 3600, // Same time
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      // Schema validation should pass
      const errors = dutchAuctionCalculator.validate(edgeConfig);
      expect(errors).to.be.null;

      // But build should fail
      expect(() => dutchAuctionCalculator.build(edgeConfig)).to.throw(
        'Auction start time must be before end time'
      );
    });
  });

  describe('extension building', function () {
    it('should build a valid Extension instance', function () {
      const extension = dutchAuctionCalculator.build(validConfig);

      expect(extension).to.be.an('object');
      expect(extension).to.have.property('type', 'Extension');
      expect(extension).to.have.property('name', 'DutchAuctionCalculator');
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
      const extension = dutchAuctionCalculator.build(validConfig);

      expect(extension.data).to.have.property('makingAmountData');
      expect(extension.data).to.have.property('takingAmountData');

      // Both should have the same address (contract address)
      expect(extension.data.makingAmountData.address).to.equal(
        extension.data.takingAmountData.address
      );

      // Both should have extraData
      expect(extension.data.makingAmountData.data).to.be.a('string');
      expect(extension.data.takingAmountData.data).to.be.a('string');
    });

    it('should encode extraData correctly', function () {
      const extension = dutchAuctionCalculator.build(validConfig);
      const extraData = extension.data.makingAmountData.data;

      // Should be a hex string
      expect(extraData).to.match(/^0x[0-9a-f]+$/i);

      // Should be exactly 192 characters (0x + 64*3 hex chars for 3 uint256 values)
      expect(extraData).to.have.length(194); // 0x + 192 hex chars
    });
  });

  describe('integration scenarios', function () {
    it('should handle realistic auction timing', function () {
      const realisticConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 300, // 5 minutes from now
          endTime: currentTime + 3900, // 65 minutes from now (1 hour auction)
          startAmount: '3000000000000000000', // 3 ETH
          endAmount: '2500000000000000000', // 2.5 ETH
        },
      };

      const errors = dutchAuctionCalculator.validate(realisticConfig);
      expect(errors).to.be.null;

      const extension = dutchAuctionCalculator.build(realisticConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle very small price differences', function () {
      const smallDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: '1000000000000000001', // 1 ETH + 1 wei
          endAmount: '1000000000000000000', // 1 ETH
        },
      };

      const extension = dutchAuctionCalculator.build(smallDiffConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle large amounts', function () {
      const largeAmountConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: '1000000000000000000000', // 1000 ETH
          endAmount: '100000000000000000000', // 100 ETH
        },
      };

      const extension = dutchAuctionCalculator.build(largeAmountConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle past start time but future end time', function () {
      const pastStartConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime - 1800, // 30 minutes ago
          endTime: currentTime + 1800, // 30 minutes from now
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };

      const extension = dutchAuctionCalculator.build(pastStartConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle long auction duration', function () {
      const longAuctionConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 90000, // 25 hours later
          startAmount: '5000000000000000000', // 5 ETH
          endAmount: '1000000000000000000', // 1 ETH
        },
      };

      const extension = dutchAuctionCalculator.build(longAuctionConfig);
      expect(extension.isEmpty()).to.be.false;
    });

    it('should handle string timestamps', function () {
      const stringTimestampConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: String(currentTime + 3600),
          endTime: String(currentTime + 7200),
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };

      const errors = dutchAuctionCalculator.validate(stringTimestampConfig);
      expect(errors).to.be.null;

      const extension = dutchAuctionCalculator.build(stringTimestampConfig);
      expect(extension.isEmpty()).to.be.false;
    });
  });
});
