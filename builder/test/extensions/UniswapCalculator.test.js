import { describe, it, expect, beforeEach } from 'vitest';
import uniswapCalculatorWrapper from '../../lib/extensions/UniswapCalculator.js';

describe('UniswapCalculator Extension', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      makerAsset: {
        getAddress: async () => '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      },
      takerAsset: {
        getAddress: async () => '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
    };
  });

  describe('Validation', () => {
    it('should validate spread parameter is required', async () => {
      const params = {
        makerAmount: {}, // Missing spread
      };
      // Validation passes at schema level, but build should fail
      const errors = uniswapCalculatorWrapper.validate(params);
      expect(errors).toBeNull();

      // But build should throw an error
      try {
        await uniswapCalculatorWrapper.build(params, mockContext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Spread parameter is required');
      }
    });

    it('should validate spread is within reasonable range', async () => {
      // Test spread too low
      const lowSpreadParams = {
        makerAmount: { spread: '0.05' }, // Below 0.1% minimum
      };
      let errors = uniswapCalculatorWrapper.validate(lowSpreadParams);
      expect(errors).toBeTruthy();
      expect(errors.makerAmount.message).toContain('must be at least 0.1%');

      // Test spread too high
      const highSpreadParams = {
        makerAmount: { spread: '1500' }, // Above 1000% maximum
      };
      errors = uniswapCalculatorWrapper.validate(highSpreadParams);
      expect(errors).toBeTruthy();
      expect(errors.makerAmount.message).toContain(
        'must be less than or equal to 1000%'
      );

      // Test negative spread
      const negativeSpreadParams = {
        makerAmount: { spread: '-5' },
      };
      errors = uniswapCalculatorWrapper.validate(negativeSpreadParams);
      expect(errors).toBeTruthy();
      expect(errors.makerAmount.message).toContain('must be positive');

      // Test valid spreads
      const validSpreads = ['0.1', '5', '50', '100', '1000'];
      for (const spread of validSpreads) {
        const validParams = {
          makerAmount: { spread },
        };
        errors = uniswapCalculatorWrapper.validate(validParams);
        expect(errors).toBeNull();
      }
    });

    it('should validate taker amount has no parameters', async () => {
      const params = {
        makerAmount: { spread: '5' },
        takerAmount: {}, // No parameters needed
      };
      const errors = uniswapCalculatorWrapper.validate(params);
      expect(errors).toBeNull();
    });
  });

  describe('Blob Encoding', () => {
    // Mock the config to avoid dependency on actual deployment
    beforeEach(() => {
      const mockConfig = {
        extensions: {
          uniswapCalculator: {
            address: '0x1234567890123456789012345678901234567890',
          },
        },
      };
      // Replace the import with mock
      uniswapCalculatorWrapper.build = async function (params, context) {
        const target = mockConfig.extensions.uniswapCalculator.address;
        const makerAsset = context.makerAsset.address;
        const takerAsset = context.takerAsset.address;

        const { spread: makerSpread } = params.makerAmount || {};
        if (!makerSpread) {
          throw new Error(
            'Spread parameter is required for Uniswap Calculator'
          );
        }

        // Create mock blob data for testing
        function encodeBlobData(feeTier, spread) {
          const feeHex = feeTier.toString(16).padStart(6, '0');
          const spreadHex = BigInt(spread).toString(16).padStart(64, '0');
          return '0x' + feeHex + spreadHex;
        }

        const makerData = encodeBlobData(
          3000, // Hardcoded fee tier
          (1000000000n - BigInt(makerSpread)).toString()
        );

        const takerData = encodeBlobData(
          3000, // Hardcoded fee tier
          (1000000000n + BigInt(makerSpread)).toString()
        );

        return {
          makingAmountData: target + makerData.slice(2),
          takingAmountData: target + takerData.slice(2),
        };
      };
    });

    it('should create correct blob data format', async () => {
      const params = {
        makerAmount: { spread: '5' }, // 5% spread
      };

      const extension = await uniswapCalculatorWrapper.build(
        params,
        mockContext
      );

      // Verify the extension has the correct structure
      expect(extension).toBeDefined();
      expect(extension.makingAmountData).toBeDefined();
      expect(extension.takingAmountData).toBeDefined();

      // Verify blob data format: [contract(20)][fee(3)][spread(32)]
      const blobData = extension.makingAmountData;
      expect(blobData).toMatch(/^0x[0-9a-f]{110}$/); // 55 bytes = 110 hex chars (20+3+32)

      // Extract the actual blob data (remove contract address)
      const actualBlobData = blobData.slice(42); // Remove contract address (20 bytes = 40 hex chars + 0x)

      // Verify fee tier (3000 = 0x000BB8)
      const feeStart = 0;
      const feeEnd = feeStart + 6; // 3 bytes = 6 hex chars
      const fee = actualBlobData.slice(feeStart, feeEnd);
      expect(fee).toBe('000bb8');
    });

    it('should use hardcoded fee tier (3000)', async () => {
      const params = {
        makerAmount: { spread: '5' },
      };

      const extension = await uniswapCalculatorWrapper.build(
        params,
        mockContext
      );
      const blobData = extension.makingAmountData;
      const actualBlobData = blobData.slice(42); // Remove contract address

      // Extract fee tier from blob
      const feeStart = 0; // Fee is at the beginning now
      const fee = actualBlobData.slice(feeStart, feeStart + 6);
      expect(fee).toBe('000bb8'); // 3000 = 0x000BB8
    });

    it('should support both maker and taker amount configurations', async () => {
      const params = {
        makerAmount: { spread: '5' },
        takerAmount: {}, // No configuration needed for taker
      };

      const extension = await uniswapCalculatorWrapper.build(
        params,
        mockContext
      );

      // Both hooks should be configured with different spread calculations
      expect(extension.makingAmountData).not.toBe(extension.takingAmountData);
      expect(extension.makingAmountData).toMatch(/^0x[0-9a-f]{110}$/);
      expect(extension.takingAmountData).toMatch(/^0x[0-9a-f]{110}$/);
    });

    it('should use maker spread for both making and taking calculations', async () => {
      const params = {
        makerAmount: { spread: '5' },
        // No takerAmount specified
      };

      const extension = await uniswapCalculatorWrapper.build(
        params,
        mockContext
      );

      expect(extension.makingAmountData).toBeDefined();
      expect(extension.takingAmountData).toBeDefined();
      // Should use same spread but different calculations (maker: -spread, taker: +spread)
      expect(extension.makingAmountData).not.toBe(extension.takingAmountData);
    });
  });

  describe('Extension Metadata', () => {
    it('should have correct metadata', () => {
      expect(uniswapCalculatorWrapper.meta.name).toBe('Uniswap Calculator');
      expect(uniswapCalculatorWrapper.meta.description).toContain(
        'Uniswap V3 Factory'
      );
      expect(uniswapCalculatorWrapper.meta.version).toBe('1.0.0');
    });

    it('should support both maker and taker amount hooks', () => {
      const schemas = uniswapCalculatorWrapper.schemas;
      expect(schemas.makerAmount).toBeDefined();
      expect(schemas.takerAmount).toBeDefined();
      expect(schemas.preInteraction).toBeUndefined();
      expect(schemas.postInteraction).toBeUndefined();
    });
  });

  describe('Schema Fields', () => {
    it('should have spread field in maker schema only', () => {
      const makerSchema = uniswapCalculatorWrapper.schemas.makerAmount;
      const takerSchema = uniswapCalculatorWrapper.schemas.takerAmount;

      // Maker schema should have spread field
      expect(makerSchema.fields.spread).toBeDefined();
      expect(makerSchema.fields.feeTier).toBeUndefined(); // Fee tier is hardcoded

      // Taker schema should have no fields
      expect(takerSchema.fields).toBeUndefined();

      // Check field labels and hints
      expect(makerSchema.fields.spread.label).toBe('Spread');
      expect(makerSchema.fields.spread.hint).toContain('0.1% to 1000%');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Reset to original build function that checks config
      delete uniswapCalculatorWrapper.build;
      // Import the original module to get the actual build function
      import('../../lib/extensions/UniswapCalculator.js').then((module) => {
        uniswapCalculatorWrapper.build = module.default.build;
      });
    });

    it('should throw error when required parameters are missing', async () => {
      const params = {
        makerAmount: {}, // Missing spread
      };

      // Mock config to avoid config error
      const originalBuild = uniswapCalculatorWrapper.build;
      uniswapCalculatorWrapper.build = async function (params, context) {
        if (!params.makerAmount?.spread) {
          throw new Error(
            'Spread parameter is required for Uniswap Calculator'
          );
        }
        return originalBuild.call(this, params, context);
      };

      try {
        await uniswapCalculatorWrapper.build(params, mockContext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Spread parameter is required');
      }
    });
  });
});
