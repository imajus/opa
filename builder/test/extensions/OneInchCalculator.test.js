import { describe, it, expect, beforeEach } from 'vitest';
import oneInchCalculatorWrapper from '../../lib/extensions/OneInchCalculator.js';

describe('OneInchCalculator Extension', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      makerAsset: {
        // address: '0x4200000000000000000000000000000000000006',
        getAddress: async () => '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      },
      takerAsset: {
        // address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
        getAddress: async () => '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      },
    };
  });

  describe('Validation', () => {
    it('should validate spread parameter is required', async () => {
      const params = {};
      const errors = oneInchCalculatorWrapper.validate(params);
      expect(errors).toBeTruthy();
      expect(errors.makerAmount).toBeTruthy();
      // takerAmount doesn't require spread parameter
      expect(errors.takerAmount).toBeUndefined();
    });

    it('should validate spread is within reasonable range', async () => {
      // Test spread too low
      const lowSpreadParams = {
        makerAmount: { spread: '-5' }, // Negative spread
      };
      let errors = oneInchCalculatorWrapper.validate(lowSpreadParams);
      expect(errors).toBeTruthy();
      // Test spread too high
      const highSpreadParams = {
        makerAmount: { spread: '150' }, // 150% spread
      };
      errors = oneInchCalculatorWrapper.validate(highSpreadParams);
      expect(errors).toBeTruthy();

      // Test valid spread
      const validParams = {
        makerAmount: { spread: '5' }, // 5% spread
      };

      errors = oneInchCalculatorWrapper.validate(validParams);
      expect(errors).toBeNull();
    });
  });

  describe('Blob Encoding', () => {
    it('should create correct blob data format', async () => {
      const params = {
        makerAmount: { spread: '5' }, // 5% spread
      };
      const extension = await oneInchCalculatorWrapper.build(
        params,
        mockContext
      );
      // Verify the extension has the correct structure
      expect(extension).toBeDefined();
      expect(extension.makingAmountData).toBeDefined();
      expect(extension.takingAmountData).toBeDefined();
      // Verify blob data format: [contract(20)][flags(1)][makerToken(20)][takerToken(20)][spread(32)]
      const blobData = extension.makingAmountData;
      expect(blobData).toMatch(/^0x[0-9a-f]{186}$/); // 93 bytes = 186 hex chars (20+1+20+20+32)
      // Extract the actual blob data (remove contract address)
      const contractAddress = blobData.slice(0, 42); // 20 bytes = 40 hex chars + 0x
      const actualBlobData = blobData.slice(42); // Remove contract address
      // Verify flags byte is 0x00 (normal calculation)
      expect(actualBlobData.slice(0, 2)).toBe('00');
      // Verify maker token address (DAI)
      const makerTokenStart = 2; // After flags byte
      const makerTokenEnd = makerTokenStart + 40; // 20 bytes = 40 hex chars
      const makerToken = actualBlobData.slice(makerTokenStart, makerTokenEnd);
      expect(makerToken).toBe('6b175474e89094c44da98b954eedeac495271d0f');
      // Verify taker token address (WETH)
      const takerTokenStart = makerTokenEnd;
      const takerTokenEnd = takerTokenStart + 40;
      const takerToken = actualBlobData.slice(takerTokenStart, takerTokenEnd);
      expect(takerToken).toBe('c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
      // Verify spread (5% = 1050000000 = 0x3E8D4A51)
      const spreadStart = takerTokenEnd;
      const spreadEnd = spreadStart + 64; // 32 bytes = 64 hex chars
      const spread = actualBlobData.slice(spreadStart, spreadEnd);
      expect(spread).toBe(
        '00000000000000000000000000000000000000000000000000000000389fd980'
      );
    });

    it('should reuse spread parameter for both hooks', async () => {
      const params = {
        makerAmount: { spread: '10' }, // 10% spread
      };
      const extension = await oneInchCalculatorWrapper.build(
        params,
        mockContext
      );
      // Both hooks should use the same spread but with different calculations
      expect(extension.makingAmountData).not.toBe(extension.takingAmountData);
      // Verify they have the same structure but different spread values
      expect(extension.makingAmountData).toMatch(/^0x[0-9a-f]{186}$/);
      expect(extension.takingAmountData).toMatch(/^0x[0-9a-f]{186}$/);
    });
  });

  describe('Extension Metadata', () => {
    it('should have correct metadata', () => {
      expect(oneInchCalculatorWrapper.meta.name).toBe('OneInch Calculator');
      expect(oneInchCalculatorWrapper.meta.description).toContain(
        'real-time price discovery'
      );
      expect(oneInchCalculatorWrapper.meta.version).toBe('1.0.0');
    });

    it('should support both maker and taker amount hooks', () => {
      const schemas = oneInchCalculatorWrapper.schemas;
      expect(schemas.makerAmount).toBeDefined();
      expect(schemas.takerAmount).toBeDefined();
      expect(schemas.preInteraction).toBeUndefined();
      expect(schemas.postInteraction).toBeUndefined();
    });
  });

  describe('Schema Fields', () => {
    it('should have spread field with correct configuration', () => {
      const makerSchema = oneInchCalculatorWrapper.schemas.makerAmount;
      const takerSchema = oneInchCalculatorWrapper.schemas.takerAmount;
      expect(makerSchema.fields.spread).toBeDefined();
      expect(takerSchema.fields).toBeUndefined(); // takerAmount has no fields
      expect(makerSchema.fields.spread.label).toBe('Spread');
      expect(makerSchema.fields.spread.hint).toContain('Spread in %');
    });
  });
});
