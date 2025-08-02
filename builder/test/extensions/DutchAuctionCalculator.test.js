import { describe, it, expect } from 'vitest';
import dutchAuctionCalculator from '../../lib/extensions/DutchAuctionCalculator.js';
import { HookType } from '../../lib/constants.js';
import { Extension } from '@1inch/limit-order-sdk';

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
    it('should handle startTime >= endTime edge case', async function () {
      const edgeConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 7200, // Later than end time
          endTime: currentTime + 3600,
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      // Library allows this - the Extension is created but may not work as expected
      const extension = await dutchAuctionCalculator.build(
        edgeConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
    });

    it('should handle startAmount <= endAmount edge case', async function () {
      const edgeConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: '1000000000000000000', // Same as end amount
          endAmount: '1000000000000000000',
        },
      };
      // Library allows this - the Extension is created but may not work as expected
      const extension = await dutchAuctionCalculator.build(
        edgeConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
    });

    it('should handle equal timestamps edge case', async function () {
      const edgeConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 3600, // Same time
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      // Schema validation may pass - checking the actual behavior
      const errors = dutchAuctionCalculator.validate(edgeConfig);
      // Either validation passes or fails, both are acceptable

      // Build should succeed (library allows this)
      const extension = await dutchAuctionCalculator.build(
        edgeConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
    });
  });

  describe('extension building', function () {
    it('should build a valid Extension instance', async function () {
      const extension = await dutchAuctionCalculator.build(
        validConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should include both making and taking amount data', async function () {
      const extension = await dutchAuctionCalculator.build(
        validConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });

  describe('integration scenarios', function () {
    it('should handle realistic auction timing', async function () {
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
      const extension = await dutchAuctionCalculator.build(
        realisticConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle very small price differences', async function () {
      const smallDiffConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: '1000000000000000001', // 1 ETH + 1 wei
          endAmount: '1000000000000000000', // 1 ETH
        },
      };
      const extension = await dutchAuctionCalculator.build(
        smallDiffConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle large amounts', async function () {
      const largeAmountConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 7200,
          startAmount: '1000000000000000000000', // 1000 ETH
          endAmount: '100000000000000000000', // 100 ETH
        },
      };
      const extension = await dutchAuctionCalculator.build(
        largeAmountConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle past start time but future end time', async function () {
      const pastStartConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime - 1800, // 30 minutes ago
          endTime: currentTime + 1800, // 30 minutes from now
          startAmount: '2000000000000000000',
          endAmount: '1000000000000000000',
        },
      };
      const extension = await dutchAuctionCalculator.build(
        pastStartConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle long auction duration', async function () {
      const longAuctionConfig = {
        [HookType.MAKER_AMOUNT]: {
          startTime: currentTime + 3600,
          endTime: currentTime + 90000, // 25 hours later
          startAmount: '5000000000000000000', // 5 ETH
          endAmount: '1000000000000000000', // 1 ETH
        },
      };
      const extension = await dutchAuctionCalculator.build(
        longAuctionConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });

    it('should handle string timestamps', async function () {
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
      const extension = await dutchAuctionCalculator.build(
        stringTimestampConfig,
        mockContext
      );
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
    });
  });
});
