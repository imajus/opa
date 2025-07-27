import { describe, it, expect } from 'vitest';
import gasStation from '../../src/extensions/gas-station.js';
import { HookType } from '../../src/constants.js';

describe('Gas Station Extension Wrapper', function () {
  // Gas Station has static configuration - no dynamic parameters needed
  const emptyConfig = {};

  describe('wrapper structure', function () {
    it('should have correct meta information', function () {
      expect(gasStation.meta).to.deep.equal({
        name: 'Gas Station',
        description:
          'Enables gasless trading where makers can trade stablecoins to WETH without owning ETH for gas fees',
        version: '1.0.0',
      });
    });

    it('should have correct hook schemas', function () {
      expect(gasStation.schemas).to.have.property(HookType.MAKER_AMOUNT);
      expect(gasStation.schemas).to.have.property(HookType.TAKER_AMOUNT);
      expect(gasStation.schemas).to.have.property(HookType.PRE_INTERACTION);
      expect(gasStation.schemas).to.have.property(HookType.POST_INTERACTION);
    });

    it('should have build and validate functions', function () {
      expect(gasStation.build).to.be.a('function');
      expect(gasStation.validate).to.be.a('function');
    });
  });

  describe('parameter validation', function () {
    it('should validate empty parameters (no configuration needed)', function () {
      const errors = gasStation.validate(emptyConfig);
      expect(errors).to.be.null;
    });

    it('should accept any parameters since Gas Station uses static config', function () {
      const anyConfig = {
        [HookType.MAKER_AMOUNT]: {},
        [HookType.TAKER_AMOUNT]: {},
        [HookType.PRE_INTERACTION]: {},
        [HookType.POST_INTERACTION]: {},
      };
      const errors = gasStation.validate(anyConfig);
      expect(errors).to.be.null;
    });
  });

  describe('extension building', function () {
    it('should build a valid Extension instance', function () {
      const extension = gasStation.build(emptyConfig);

      expect(extension).to.be.an('object');
      expect(extension).to.have.property('type', 'Extension');
      expect(extension).to.have.property('name', 'GasStation');
      expect(extension).to.have.property('data');
      expect(extension).to.have.property('encode');
      expect(extension).to.have.property('isEmpty');
      expect(extension).to.have.property('keccak256');

      // Verify it's not empty
      expect(extension.isEmpty()).to.be.false;

      // Verify encode returns hex string
      expect(extension.encode()).to.be.a('string');

      // Verify keccak256 returns bigint
      expect(extension.keccak256()).to.be.a('bigint');
    });

    it('should work with any parameters since configuration is static', function () {
      const anyConfig = { [HookType.MAKER_AMOUNT]: { some: 'data' } };
      const extension = gasStation.build(anyConfig);
      expect(extension).to.be.an('object');
      expect(extension.type).to.equal('Extension');
    });

    it('should include all required hook configurations', function () {
      const extension = gasStation.build(emptyConfig);

      expect(extension.data).to.have.property('makingAmountData');
      expect(extension.data).to.have.property('takingAmountData');
      expect(extension.data).to.have.property('preInteraction');
      expect(extension.data).to.have.property('postInteraction');

      // Verify addresses are set to the static contract address
      expect(extension.data.makingAmountData.address).to.equal(
        '0x0000000000000000000000000000000000000000'
      );
      expect(extension.data.takingAmountData.address).to.equal(
        '0x0000000000000000000000000000000000000000'
      );
    });
  });

  describe('integration scenarios', function () {
    it('should work in gasless trading scenario', function () {
      const extension = gasStation.build(emptyConfig);
      expect(extension).to.be.an('object');
      expect(extension.type).to.equal('Extension');
      expect(extension.isEmpty()).to.be.false;
    });

    it('should create consistent extensions', function () {
      const extension1 = gasStation.build({});
      const extension2 = gasStation.build({ [HookType.MAKER_AMOUNT]: {} });

      // Both should reference the same contract address since config is static
      expect(extension1.data.preInteraction.target.toString()).to.equal(
        extension2.data.preInteraction.target.toString()
      );
      expect(extension1.data.preInteraction.target.toString()).to.equal(
        '0x0000000000000000000000000000000000000000'
      );
    });
  });
});
