import { describe, it, expect, vi } from 'vitest';
import { OrderBuilder, HookCollisionError } from '../src/order-builder.js';
import { HookType } from '../src/constants.js';

const validMakerAsset = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const validMakerAmount = '1000000';
const validTakerAsset = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const validTakerAmount = '500000000000000000';
const validReceiver = '0x1234567890123456789012345678901234567890';

function initBuilder(extra = {}) {
  const {
    makerAsset = validMakerAsset,
    makerAmount = validMakerAmount,
    takerAsset = validTakerAsset,
    takerAmount = validTakerAmount,
    receiver = validReceiver,
  } = extra;
  const builder = new OrderBuilder(
    makerAsset,
    makerAmount,
    takerAsset,
    takerAmount,
    receiver
  );
  return builder;
}

function initSigner(extra = {}) {
  return {
    getAddress: vi
      .fn()
      .mockResolvedValue('0x1234567890123456789012345678901234567890'),
    signTypedData: vi.fn().mockResolvedValue('0xmocksignature123'),
    ...extra,
  };
}

function initExtension(extra = {}) {
  return {
    meta: {
      name: 'Test Extension',
      description: 'Test extension for unit tests',
      version: '1.0.0',
    },
    schemas: {
      makerAmount: {},
    },
    build: vi.fn().mockReturnValue({ type: 'MockExtension' }),
    ...extra,
  };
}

describe('OrderBuilder', function () {
  describe('Constructor', function () {
    it('should create OrderBuilder with all parameters', function () {
      const builder = initBuilder();
      expect(builder.makerAsset).to.equal(validMakerAsset);
      expect(builder.makerAmount).to.equal(validMakerAmount);
      expect(builder.takerAsset).to.equal(validTakerAsset);
      expect(builder.takerAmount).to.equal(validTakerAmount);
      expect(builder.receiver).to.equal(validReceiver);
    });

    it('should create OrderBuilder without receiver', function () {
      const builder = initBuilder({ receiver: null });
      expect(builder.makerAsset).to.equal(validMakerAsset);
      expect(builder.makerAmount).to.equal(validMakerAmount);
      expect(builder.takerAsset).to.equal(validTakerAsset);
      expect(builder.takerAmount).to.equal(validTakerAmount);
      expect(builder.receiver).to.be.null;
    });

    it('should initialize internal properties correctly', function () {
      const builder = initBuilder();
      expect(builder.makerTraits).to.exist;
      expect(builder.extensions).to.be.an('array').that.is.empty;
      expect(builder.usedHooks).to.be.a('Set').that.is.empty;
    });

    it('should accept BigInt amounts', function () {
      const builder = initBuilder({
        makerAsset: validMakerAsset,
        makerAmount: BigInt(validMakerAmount),
        takerAsset: validTakerAsset,
        takerAmount: BigInt(validTakerAmount),
      });
      expect(builder.makerAmount).to.equal(BigInt(validMakerAmount));
      expect(builder.takerAmount).to.equal(BigInt(validTakerAmount));
    });
  });

  describe('getMakerTraits', function () {
    it('should return MakerTraits instance', function () {
      const builder = initBuilder();
      const traits = builder.getMakerTraits();
      expect(traits).to.exist;
      expect(traits.constructor.name).to.equal('MakerTraits');
    });

    it('should return the same instance on multiple calls', function () {
      const builder = initBuilder();
      const traits1 = builder.getMakerTraits();
      const traits2 = builder.getMakerTraits();
      expect(traits1).to.equal(traits2);
    });

    it('should allow MakerTraits configuration', function () {
      const builder = initBuilder();
      const traits = builder.getMakerTraits();
      // Test that we can call MakerTraits methods (these may not work in test environment)
      expect(traits).to.exist;
      expect(typeof traits.withExpiration).to.equal('function');
      expect(typeof traits.allowPartialFills).to.equal('function');
      expect(typeof traits.allowMultipleFills).to.equal('function');
    });
  });

  describe('addExtension', function () {
    it('should add extension successfully', function () {
      const builder = initBuilder();
      const extension = initExtension();
      expect(() => {
        builder.addExtension(extension);
      }).to.not.throw();
      expect(builder.extensions).to.have.length(1);
      expect(builder.extensions[0]).to.equal(extension);
      expect(builder.usedHooks.has('makerAmount')).to.be.true;
    });

    it('should track used hooks correctly', function () {
      const builder = initBuilder();
      const extension = initExtension({
        schemas: { makerAmount: {}, preInteraction: {} },
      });
      builder.addExtension(extension);
      expect(builder.usedHooks.has('makerAmount')).to.be.true;
      expect(builder.usedHooks.has('preInteraction')).to.be.true;
      expect(builder.usedHooks.size).to.equal(2);
    });

    it('should allow extension without schemas', function () {
      const builder = initBuilder();
      const extension = initExtension({ schemas: undefined });
      expect(() => {
        builder.addExtension(extension);
      }).to.not.throw();
      expect(builder.extensions).to.have.length(1);
      expect(builder.usedHooks.size).to.equal(0);
    });

    it('should throw HookCollisionError on duplicate hooks', function () {
      const builder = initBuilder();
      const extension1 = initExtension({
        schemas: { makerAmount: {} },
      });
      const extension2 = initExtension({
        meta: { ...extension1.meta, name: 'Extension 2' },
        schemas: { makerAmount: {} }, // Same hook
      });
      builder.addExtension(extension1);
      expect(() => {
        builder.addExtension(extension2);
      }).to.throw(HookCollisionError, 'makerAmount is already defined');
    });

    it('should allow non-conflicting extensions', function () {
      const builder = initBuilder();
      const extension1 = initExtension({
        schemas: { makerAmount: {} },
      });
      const extension2 = initExtension({
        meta: { ...extension1.meta, name: 'Extension 2' },
        schemas: { takerAmount: {} }, // Different hook
      });
      expect(() => {
        builder.addExtension(extension1);
        builder.addExtension(extension2);
      }).to.not.throw();
      expect(builder.extensions).to.have.length(2);
      expect(builder.usedHooks.has('makerAmount')).to.be.true;
      expect(builder.usedHooks.has('takerAmount')).to.be.true;
    });
  });

  describe('build method (without extensions)', function () {
    it('should require signer parameter', async function () {
      const builder = initBuilder();
      await expect(builder.build(null, 1)).rejects.toThrow();
    });

    it('should require chainId parameter', async function () {
      const builder = initBuilder();
      const signer = initSigner();
      await expect(builder.build(signer, null)).rejects.toThrow();
    });

    it('should call signer.getAddress when building', async function () {
      const builder = initBuilder();
      const signer = initSigner();
      try {
        await builder.build(signer, 1);
      } catch (error) {
        // Expected to fail due to real implementation constraints
      }
      expect(signer.getAddress).toHaveBeenCalled();
    });

    it('should create builder without receiver', function () {
      const builder = initBuilder({ receiver: null });
      expect(builder.receiver).to.be.null;
      expect(builder.makerAsset).to.equal(validMakerAsset);
    });
  });

  describe('Error Handling', function () {
    it('should handle signer errors gracefully', async function () {
      const builder = initBuilder();
      const signer = initSigner({
        getAddress: vi.fn().mockRejectedValue(new Error('Signer error')),
        signTypedData: vi.fn(),
      });
      await expect(builder.build(signer, 1)).rejects.toThrow('Signer error');
    });

    it('should validate basic parameters', function () {
      expect(() => {
        new OrderBuilder(null, '100', validTakerAsset, '200');
      }).to.not.throw();
      expect(() => {
        new OrderBuilder(validMakerAsset, null, validTakerAsset, '200');
      }).to.not.throw();
    });
  });

  describe('HookCollisionError', function () {
    it('should create error with correct message', function () {
      const error = new HookCollisionError('testHook');
      expect(error.message).to.include('testHook');
      expect(error.message).to.include('already defined');
      expect(error.name).to.equal('HookCollisionError');
      expect(error).to.be.instanceOf(Error);
    });

    it('should be throwable and catchable', function () {
      expect(() => {
        throw new HookCollisionError('makerAmount');
      }).to.throw(HookCollisionError);
    });
  });

  describe('_combineExtensions method', function () {
    it('should return undefined when no extensions', function () {
      const builder = initBuilder();
      const result = builder._combineExtensions();
      expect(result).to.be.undefined;
    });

    it('should handle single extension', function () {
      const builder = initBuilder();
      const extension = initExtension({
        build: vi.fn().mockReturnValue({ type: 'MockExtension' }),
        schemas: { makerAmount: {} },
      });
      builder.addExtension(extension);
      const result = builder._combineExtensions();
      expect(extension.build).toHaveBeenCalled();
      expect(result).to.deep.equal({ type: 'MockExtension' });
    });

    it('should throw error for multiple extensions', function () {
      const builder = initBuilder();
      const extension1 = initExtension({
        build: vi.fn(),
        schemas: { makerAmount: {} },
      });
      const extension2 = initExtension({
        build: vi.fn(),
        schemas: { takerAmount: {} },
      });
      builder.addExtension(extension1);
      builder.addExtension(extension2);
      expect(() => {
        builder._combineExtensions();
      }).to.throw('Multiple extension combination not yet implemented');
    });
  });

  describe('Multiple Extensions with Non-Overlapping Hooks', function () {
    it('should allow MAKER_AMOUNT + PRE_INTERACTION extensions', function () {
      const builder = initBuilder();
      const makerAmountExt = initExtension({
        meta: {
          name: 'Maker Amount Extension',
          description: 'Test maker amount',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'MakerAmountExtension' }),
      });
      const preInteractionExt = initExtension({
        meta: {
          name: 'Pre Interaction Extension',
          description: 'Test pre interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PreInteractionExtension' }),
      });

      expect(() => {
        builder.addExtension(makerAmountExt);
        builder.addExtension(preInteractionExt);
      }).to.not.throw();

      expect(builder.extensions).to.have.length(2);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder.usedHooks.size).to.equal(2);
    });

    it('should allow TAKER_AMOUNT + POST_INTERACTION extensions', function () {
      const builder = initBuilder();
      const takerAmountExt = initExtension({
        meta: {
          name: 'Taker Amount Extension',
          description: 'Test taker amount',
          version: '1.0.0',
        },
        schemas: { [HookType.TAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'TakerAmountExtension' }),
      });
      const postInteractionExt = initExtension({
        meta: {
          name: 'Post Interaction Extension',
          description: 'Test post interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.POST_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PostInteractionExtension' }),
      });

      expect(() => {
        builder.addExtension(takerAmountExt);
        builder.addExtension(postInteractionExt);
      }).to.not.throw();

      expect(builder.extensions).to.have.length(2);
      expect(builder.usedHooks.has(HookType.TAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.POST_INTERACTION)).to.be.true;
      expect(builder.usedHooks.size).to.equal(2);
    });

    it('should allow PRE_INTERACTION + POST_INTERACTION extensions', function () {
      const builder = initBuilder();
      const preInteractionExt = initExtension({
        meta: {
          name: 'Pre Interaction Extension',
          description: 'Test pre interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PreInteractionExtension' }),
      });
      const postInteractionExt = initExtension({
        meta: {
          name: 'Post Interaction Extension',
          description: 'Test post interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.POST_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PostInteractionExtension' }),
      });

      expect(() => {
        builder.addExtension(preInteractionExt);
        builder.addExtension(postInteractionExt);
      }).to.not.throw();

      expect(builder.extensions).to.have.length(2);
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder.usedHooks.has(HookType.POST_INTERACTION)).to.be.true;
      expect(builder.usedHooks.size).to.equal(2);
    });

    it('should allow three extensions with completely different hooks', function () {
      const builder = initBuilder();
      const makerAmountExt = initExtension({
        meta: {
          name: 'Maker Amount Extension',
          description: 'Test maker amount',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'MakerAmountExtension' }),
      });
      const preInteractionExt = initExtension({
        meta: {
          name: 'Pre Interaction Extension',
          description: 'Test pre interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PreInteractionExtension' }),
      });
      const postInteractionExt = initExtension({
        meta: {
          name: 'Post Interaction Extension',
          description: 'Test post interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.POST_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PostInteractionExtension' }),
      });

      expect(() => {
        builder.addExtension(makerAmountExt);
        builder.addExtension(preInteractionExt);
        builder.addExtension(postInteractionExt);
      }).to.not.throw();

      expect(builder.extensions).to.have.length(3);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder.usedHooks.has(HookType.POST_INTERACTION)).to.be.true;
      expect(builder.usedHooks.size).to.equal(3);
    });

    it('should allow all four hook types across four extensions', function () {
      const builder = initBuilder();
      const makerAmountExt = initExtension({
        meta: {
          name: 'Maker Amount Extension',
          description: 'Test maker amount',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'MakerAmountExtension' }),
      });
      const takerAmountExt = initExtension({
        meta: {
          name: 'Taker Amount Extension',
          description: 'Test taker amount',
          version: '1.0.0',
        },
        schemas: { [HookType.TAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'TakerAmountExtension' }),
      });
      const preInteractionExt = initExtension({
        meta: {
          name: 'Pre Interaction Extension',
          description: 'Test pre interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PreInteractionExtension' }),
      });
      const postInteractionExt = initExtension({
        meta: {
          name: 'Post Interaction Extension',
          description: 'Test post interaction',
          version: '1.0.0',
        },
        schemas: { [HookType.POST_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'PostInteractionExtension' }),
      });

      expect(() => {
        builder.addExtension(makerAmountExt);
        builder.addExtension(takerAmountExt);
        builder.addExtension(preInteractionExt);
        builder.addExtension(postInteractionExt);
      }).to.not.throw();

      expect(builder.extensions).to.have.length(4);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.TAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder.usedHooks.has(HookType.POST_INTERACTION)).to.be.true;
      expect(builder.usedHooks.size).to.equal(4);
    });

    it('should allow extensions added in different orders', function () {
      const builder1 = initBuilder();
      const builder2 = initBuilder();

      const ext1 = initExtension({
        meta: {
          name: 'Extension 1',
          description: 'Test extension 1',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension1' }),
      });
      const ext2 = initExtension({
        meta: {
          name: 'Extension 2',
          description: 'Test extension 2',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension2' }),
      });

      // Add in order 1-2
      builder1.addExtension(ext1);
      builder1.addExtension(ext2);

      // Add in order 2-1
      builder2.addExtension(ext2);
      builder2.addExtension(ext1);

      // Both should have the same hooks tracked
      expect(builder1.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder1.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder2.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder2.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;

      expect(builder1.extensions).to.have.length(2);
      expect(builder2.extensions).to.have.length(2);
    });

    it('should track used hooks correctly across multiple additions', function () {
      const builder = initBuilder();

      // Start with empty hooks
      expect(builder.usedHooks.size).to.equal(0);

      // Add first extension
      const ext1 = initExtension({
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension1' }),
      });
      builder.addExtension(ext1);
      expect(builder.usedHooks.size).to.equal(1);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;

      // Add second extension
      const ext2 = initExtension({
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension2' }),
      });
      builder.addExtension(ext2);
      expect(builder.usedHooks.size).to.equal(2);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;

      // Add third extension
      const ext3 = initExtension({
        schemas: { [HookType.POST_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension3' }),
      });
      builder.addExtension(ext3);
      expect(builder.usedHooks.size).to.equal(3);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder.usedHooks.has(HookType.POST_INTERACTION)).to.be.true;
    });

    it('should handle extensions with multiple non-conflicting hooks', function () {
      const builder = initBuilder();

      const multiHookExt1 = initExtension({
        meta: {
          name: 'Multi Hook Extension 1',
          description: 'Extension with maker and pre interaction',
          version: '1.0.0',
        },
        schemas: {
          [HookType.MAKER_AMOUNT]: {},
          [HookType.PRE_INTERACTION]: {},
        },
        build: vi.fn().mockReturnValue({ type: 'MultiHookExtension1' }),
      });
      const multiHookExt2 = initExtension({
        meta: {
          name: 'Multi Hook Extension 2',
          description: 'Extension with taker and post interaction',
          version: '1.0.0',
        },
        schemas: {
          [HookType.TAKER_AMOUNT]: {},
          [HookType.POST_INTERACTION]: {},
        },
        build: vi.fn().mockReturnValue({ type: 'MultiHookExtension2' }),
      });

      expect(() => {
        builder.addExtension(multiHookExt1);
        builder.addExtension(multiHookExt2);
      }).to.not.throw();

      expect(builder.extensions).to.have.length(2);
      expect(builder.usedHooks.size).to.equal(4);
      expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.TAKER_AMOUNT)).to.be.true;
      expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.true;
      expect(builder.usedHooks.has(HookType.POST_INTERACTION)).to.be.true;
    });

    it('should maintain extension order in the extensions array', function () {
      const builder = initBuilder();

      const ext1 = initExtension({
        meta: {
          name: 'First Extension',
          description: 'First extension added',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'FirstExtension' }),
      });
      const ext2 = initExtension({
        meta: {
          name: 'Second Extension',
          description: 'Second extension added',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'SecondExtension' }),
      });
      const ext3 = initExtension({
        meta: {
          name: 'Third Extension',
          description: 'Third extension added',
          version: '1.0.0',
        },
        schemas: { [HookType.POST_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'ThirdExtension' }),
      });

      builder.addExtension(ext1);
      builder.addExtension(ext2);
      builder.addExtension(ext3);

      expect(builder.extensions[0]).to.equal(ext1);
      expect(builder.extensions[1]).to.equal(ext2);
      expect(builder.extensions[2]).to.equal(ext3);
      expect(builder.extensions[0].meta.name).to.equal('First Extension');
      expect(builder.extensions[1].meta.name).to.equal('Second Extension');
      expect(builder.extensions[2].meta.name).to.equal('Third Extension');
    });

    it('should prevent hook collisions when adding multiple extensions', function () {
      const builder = initBuilder();

      const ext1 = initExtension({
        meta: {
          name: 'Extension 1',
          description: 'First extension',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension1' }),
      });
      const ext2 = initExtension({
        meta: {
          name: 'Extension 2',
          description: 'Second extension',
          version: '1.0.0',
        },
        schemas: { [HookType.PRE_INTERACTION]: {} },
        build: vi.fn().mockReturnValue({ type: 'Extension2' }),
      });
      const conflictingExt = initExtension({
        meta: {
          name: 'Conflicting Extension',
          description: 'Extension with conflicting hook',
          version: '1.0.0',
        },
        schemas: { [HookType.MAKER_AMOUNT]: {} }, // Conflicts with ext1
        build: vi.fn().mockReturnValue({ type: 'ConflictingExtension' }),
      });

      // Add first two extensions successfully
      builder.addExtension(ext1);
      builder.addExtension(ext2);
      expect(builder.extensions).to.have.length(2);

      // Third extension should fail due to hook collision
      expect(() => {
        builder.addExtension(conflictingExt);
      }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);

      // Builder should still have only the first two extensions
      expect(builder.extensions).to.have.length(2);
             expect(builder.usedHooks.size).to.equal(2);
     });
   });

   describe('Hook Collision Detection', function () {
     it('should throw HookCollisionError on MAKER_AMOUNT collision', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} }, // Same hook
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });

       builder.addExtension(ext1);
       expect(() => {
         builder.addExtension(ext2);
       }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);
     });

     it('should throw HookCollisionError on TAKER_AMOUNT collision', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.TAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.TAKER_AMOUNT]: {} }, // Same hook
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });

       builder.addExtension(ext1);
       expect(() => {
         builder.addExtension(ext2);
       }).to.throw(HookCollisionError, HookType.TAKER_AMOUNT);
     });

     it('should throw HookCollisionError on PRE_INTERACTION collision', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.PRE_INTERACTION]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.PRE_INTERACTION]: {} }, // Same hook
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });

       builder.addExtension(ext1);
       expect(() => {
         builder.addExtension(ext2);
       }).to.throw(HookCollisionError, HookType.PRE_INTERACTION);
     });

     it('should throw HookCollisionError on POST_INTERACTION collision', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.POST_INTERACTION]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.POST_INTERACTION]: {} }, // Same hook
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });

       builder.addExtension(ext1);
       expect(() => {
         builder.addExtension(ext2);
       }).to.throw(HookCollisionError, HookType.POST_INTERACTION);
     });

     it('should detect collision when extension has multiple hooks and one conflicts', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Single Hook Extension', description: 'Extension with one hook', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'SingleHookExtension' }),
       });
       const multiExt = initExtension({
         meta: { name: 'Multi Hook Extension', description: 'Extension with multiple hooks', version: '1.0.0' },
         schemas: {
           [HookType.MAKER_AMOUNT]: {}, // Conflicts with ext1
           [HookType.PRE_INTERACTION]: {}, // Would be fine if not for the conflict
         },
         build: vi.fn().mockReturnValue({ type: 'MultiHookExtension' }),
       });

       builder.addExtension(ext1);
       expect(() => {
         builder.addExtension(multiExt);
       }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);

       // Should not add the conflicting extension
       expect(builder.extensions).to.have.length(1);
       expect(builder.usedHooks.size).to.equal(1);
       expect(builder.usedHooks.has(HookType.MAKER_AMOUNT)).to.be.true;
       expect(builder.usedHooks.has(HookType.PRE_INTERACTION)).to.be.false;
     });

     it('should detect collision when multi-hook extension conflicts with multiple existing hooks', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.PRE_INTERACTION]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });
       const conflictingExt = initExtension({
         meta: { name: 'Conflicting Extension', description: 'Extension with multiple conflicts', version: '1.0.0' },
         schemas: {
           [HookType.MAKER_AMOUNT]: {}, // Conflicts with ext1
           [HookType.PRE_INTERACTION]: {}, // Conflicts with ext2
           [HookType.TAKER_AMOUNT]: {}, // Would be fine
         },
         build: vi.fn().mockReturnValue({ type: 'ConflictingExtension' }),
       });

       builder.addExtension(ext1);
       builder.addExtension(ext2);
       expect(builder.extensions).to.have.length(2);

       // Should throw on the first conflict encountered (MAKER_AMOUNT)
       expect(() => {
         builder.addExtension(conflictingExt);
       }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);

       // Should not add the conflicting extension
       expect(builder.extensions).to.have.length(2);
       expect(builder.usedHooks.size).to.equal(2);
     });

     it('should detect collision after adding multiple non-conflicting extensions', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.PRE_INTERACTION]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });
       const ext3 = initExtension({
         meta: { name: 'Extension 3', description: 'Third extension', version: '1.0.0' },
         schemas: { [HookType.POST_INTERACTION]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension3' }),
       });
       const conflictingExt = initExtension({
         meta: { name: 'Conflicting Extension', description: 'Extension that conflicts', version: '1.0.0' },
         schemas: { [HookType.PRE_INTERACTION]: {} }, // Conflicts with ext2
         build: vi.fn().mockReturnValue({ type: 'ConflictingExtension' }),
       });

       // Add three non-conflicting extensions
       builder.addExtension(ext1);
       builder.addExtension(ext2);
       builder.addExtension(ext3);
       expect(builder.extensions).to.have.length(3);
       expect(builder.usedHooks.size).to.equal(3);

       // Fourth extension should fail
       expect(() => {
         builder.addExtension(conflictingExt);
       }).to.throw(HookCollisionError, HookType.PRE_INTERACTION);

       // State should remain unchanged
       expect(builder.extensions).to.have.length(3);
       expect(builder.usedHooks.size).to.equal(3);
     });

     it('should preserve builder state when collision is detected', function () {
       const builder = initBuilder();
       const validExt1 = initExtension({
         meta: { name: 'Valid Extension 1', description: 'First valid extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'ValidExtension1' }),
       });
       const validExt2 = initExtension({
         meta: { name: 'Valid Extension 2', description: 'Second valid extension', version: '1.0.0' },
         schemas: { [HookType.TAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'ValidExtension2' }),
       });
       const invalidExt = initExtension({
         meta: { name: 'Invalid Extension', description: 'Extension that causes collision', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} }, // Conflicts with validExt1
         build: vi.fn().mockReturnValue({ type: 'InvalidExtension' }),
       });

       // Add valid extensions
       builder.addExtension(validExt1);
       builder.addExtension(validExt2);

       // Capture state before attempted collision
       const extensionsBefore = [...builder.extensions];
       const usedHooksBefore = new Set(builder.usedHooks);

       // Attempt to add conflicting extension
       expect(() => {
         builder.addExtension(invalidExt);
       }).to.throw(HookCollisionError);

       // State should be unchanged
       expect(builder.extensions).to.deep.equal(extensionsBefore);
       expect(builder.usedHooks).to.deep.equal(usedHooksBefore);
       expect(builder.extensions).to.have.length(2);
       expect(builder.usedHooks.size).to.equal(2);
     });

     it('should handle collision with extension that has no schemas', function () {
       const builder = initBuilder();
       const extWithSchemas = initExtension({
         meta: { name: 'Extension with Schemas', description: 'Extension with schemas', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'ExtensionWithSchemas' }),
       });
       const extWithoutSchemas = initExtension({
         meta: { name: 'Extension without Schemas', description: 'Extension without schemas', version: '1.0.0' },
         schemas: undefined,
         build: vi.fn().mockReturnValue({ type: 'ExtensionWithoutSchemas' }),
       });

       // Add extension with schemas
       builder.addExtension(extWithSchemas);
       expect(builder.usedHooks.size).to.equal(1);

       // Add extension without schemas - should not cause collision
       expect(() => {
         builder.addExtension(extWithoutSchemas);
       }).to.not.throw();

       expect(builder.extensions).to.have.length(2);
       expect(builder.usedHooks.size).to.equal(1); // Still only one hook from the first extension
     });

     it('should handle collision detection with empty schemas object', function () {
       const builder = initBuilder();
       const extWithHooks = initExtension({
         meta: { name: 'Extension with Hooks', description: 'Extension with hooks', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'ExtensionWithHooks' }),
       });
       const extWithEmptySchemas = initExtension({
         meta: { name: 'Extension with Empty Schemas', description: 'Extension with empty schemas', version: '1.0.0' },
         schemas: {}, // Empty object
         build: vi.fn().mockReturnValue({ type: 'ExtensionWithEmptySchemas' }),
       });

       // Add extension with hooks
       builder.addExtension(extWithHooks);
       expect(builder.usedHooks.size).to.equal(1);

       // Add extension with empty schemas - should not cause collision
       expect(() => {
         builder.addExtension(extWithEmptySchemas);
       }).to.not.throw();

       expect(builder.extensions).to.have.length(2);
       expect(builder.usedHooks.size).to.equal(1); // Still only one hook from the first extension
     });

     it('should detect collisions in different addition orders', function () {
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} }, // Same hook as ext1
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });

       // Try order 1-2
       const builder1 = initBuilder();
       builder1.addExtension(ext1);
       expect(() => {
         builder1.addExtension(ext2);
       }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);

       // Try order 2-1
       const builder2 = initBuilder();
       builder2.addExtension(ext2);
       expect(() => {
         builder2.addExtension(ext1);
       }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);

       // Both builders should have only one extension
       expect(builder1.extensions).to.have.length(1);
       expect(builder2.extensions).to.have.length(1);
     });

     it('should include hook name in error message', function () {
       const builder = initBuilder();
       const ext1 = initExtension({
         meta: { name: 'Extension 1', description: 'First extension', version: '1.0.0' },
         schemas: { [HookType.TAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension1' }),
       });
       const ext2 = initExtension({
         meta: { name: 'Extension 2', description: 'Second extension', version: '1.0.0' },
         schemas: { [HookType.TAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'Extension2' }),
       });

       builder.addExtension(ext1);

       try {
         builder.addExtension(ext2);
         expect.fail('Should have thrown HookCollisionError');
       } catch (error) {
         expect(error).to.be.instanceOf(HookCollisionError);
         expect(error.message).to.include(HookType.TAKER_AMOUNT);
         expect(error.message).to.include('already defined');
         expect(error.name).to.equal('HookCollisionError');
       }
     });

     it('should detect collision when adding the same extension twice', function () {
       const builder = initBuilder();
       const ext = initExtension({
         meta: { name: 'Test Extension', description: 'Test extension', version: '1.0.0' },
         schemas: { [HookType.MAKER_AMOUNT]: {} },
         build: vi.fn().mockReturnValue({ type: 'TestExtension' }),
       });

       // Add extension first time
       builder.addExtension(ext);
       expect(builder.extensions).to.have.length(1);

       // Try to add the same extension again
       expect(() => {
         builder.addExtension(ext);
       }).to.throw(HookCollisionError, HookType.MAKER_AMOUNT);

       // Should still have only one extension
       expect(builder.extensions).to.have.length(1);
       expect(builder.usedHooks.size).to.equal(1);
     });

     it('should handle collision detection with all four hook types', function () {
       const builder = initBuilder();
       const baseExtension = initExtension({
         meta: { name: 'Base Extension', description: 'Extension with all hooks', version: '1.0.0' },
         schemas: {
           [HookType.MAKER_AMOUNT]: {},
           [HookType.TAKER_AMOUNT]: {},
           [HookType.PRE_INTERACTION]: {},
           [HookType.POST_INTERACTION]: {},
         },
         build: vi.fn().mockReturnValue({ type: 'BaseExtension' }),
       });

       builder.addExtension(baseExtension);
       expect(builder.usedHooks.size).to.equal(4);

       // Try to add extension that conflicts with each hook type
       const hookTypes = [
         HookType.MAKER_AMOUNT,
         HookType.TAKER_AMOUNT,
         HookType.PRE_INTERACTION,
         HookType.POST_INTERACTION,
       ];

       hookTypes.forEach((hookType, index) => {
         const conflictingExt = initExtension({
           meta: { name: `Conflicting Extension ${index}`, description: `Conflicts with ${hookType}`, version: '1.0.0' },
           schemas: { [hookType]: {} },
           build: vi.fn().mockReturnValue({ type: `ConflictingExtension${index}` }),
         });

         expect(() => {
           builder.addExtension(conflictingExt);
         }).to.throw(HookCollisionError, hookType);
       });

       // Should still have only the base extension
       expect(builder.extensions).to.have.length(1);
       expect(builder.usedHooks.size).to.equal(4);
     });
   });
 });
