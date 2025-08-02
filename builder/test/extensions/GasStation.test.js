import { describe, it, expect } from 'vitest';
import gasStation from '../../lib/extensions/GasStation.js';
import { HookType } from '../../lib/constants.js';
import { Extension } from '@1inch/limit-order-sdk';

describe('Gas Station Extension Wrapper', function () {
  // Gas Station has static configuration - no dynamic parameters needed
  const emptyConfig = {};

  describe('parameter validation', function () {
    it('should validate empty parameters (no configuration needed)', function () {
      const errors = gasStation.validate(emptyConfig);
      expect(errors).to.be.null;
    });

    it('should accept empty objects for pre/post interaction hooks', function () {
      const configWithEmptyHooks = {
        [HookType.PRE_INTERACTION]: {},
        [HookType.POST_INTERACTION]: {},
      };
      const errors = gasStation.validate(configWithEmptyHooks);
      expect(errors).to.be.null;
    });

    it('should accept any parameters since schemas are empty', function () {
      const configWithAnyParams = {
        [HookType.PRE_INTERACTION]: { anyField: 'anyValue', number: 123 },
        [HookType.POST_INTERACTION]: {
          anotherField: true,
          nested: { data: 'test' },
        },
      };
      const errors = gasStation.validate(configWithAnyParams);
      expect(errors).to.be.null;
    });
  });

  describe('extension building', function () {
    it('should build a valid Extension instance', async function () {
      const extension = await gasStation.build(emptyConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.preInteraction).to.not.equal('0x');
      expect(extension.postInteraction).to.not.equal('0x');
    });

    it('should include all required hook configurations', async function () {
      const extension = await gasStation.build(emptyConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.preInteraction).to.not.equal('0x');
      expect(extension.postInteraction).to.not.equal('0x');
    });
  });

  describe('integration scenarios', function () {
    it('should work in gasless trading scenario', async function () {
      const extension = await gasStation.build(emptyConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.preInteraction).to.not.equal('0x');
      expect(extension.postInteraction).to.not.equal('0x');
    });
  });
});
