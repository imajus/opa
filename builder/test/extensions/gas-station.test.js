import { describe, it, expect } from 'vitest';
import gasStation from '../../lib/extensions/gas-station.js';
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

    it('should not accept any parameters except undefined', function () {
      const anyConfig = {
        [HookType.MAKER_AMOUNT]: {},
        [HookType.TAKER_AMOUNT]: {},
        [HookType.PRE_INTERACTION]: {},
        [HookType.POST_INTERACTION]: {},
      };
      const errors = gasStation.validate(anyConfig);
      expect(errors)
        .to.have.property('makerAmount')
        .that.is.an('array')
        .with.deep.nested.property('[0].code', 'invalid_type');
      expect(errors)
        .to.have.property('takerAmount')
        .that.is.an('array')
        .with.deep.nested.property('[0].code', 'invalid_type');
      expect(errors)
        .to.have.property('preInteraction')
        .that.is.an('array')
        .with.deep.nested.property('[0].code', 'invalid_type');
      expect(errors)
        .to.have.property('postInteraction')
        .that.is.an('array')
        .with.deep.nested.property('[0].code', 'invalid_type');
    });
  });

  describe('extension building', function () {
    it('should build a valid Extension instance', function () {
      const extension = gasStation.build(emptyConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
      expect(extension.preInteraction).to.not.equal('0x');
      expect(extension.postInteraction).to.not.equal('0x');
    });

    it('should include all required hook configurations', function () {
      const extension = gasStation.build(emptyConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
      expect(extension.preInteraction).to.not.equal('0x');
      expect(extension.postInteraction).to.not.equal('0x');
    });
  });

  describe('integration scenarios', function () {
    it('should work in gasless trading scenario', function () {
      const extension = gasStation.build(emptyConfig);
      expect(extension).to.be.instanceOf(Extension);
      expect(extension.makingAmountData).to.not.equal('0x');
      expect(extension.takingAmountData).to.not.equal('0x');
      expect(extension.preInteraction).to.not.equal('0x');
      expect(extension.postInteraction).to.not.equal('0x');
    });
  });
});
