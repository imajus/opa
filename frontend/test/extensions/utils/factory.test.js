import { describe, it } from 'mocha';
import { expect } from 'chai';
import { z } from 'zod';
import { createWrapper } from '../../../src/extensions/utils/factory.js';
import { address, uint256 } from '../../../src/schemas/common.js';

describe('Factory Utils', function () {
  describe('createWrapper', function () {
    const validConfig = {
      name: 'testExtension',
      description: 'Test extension for validation',
      hooks: {
        makerAmount: z.object({
          minAmount: uint256,
          maxAmount: uint256,
        }),
        preInteraction: z.object({
          target: address,
          data: z.string(),
        }),
      },
      build: (params) => ({ type: 'Extension', params }),
    };

    it('should create a valid wrapper with correct structure', function () {
      const wrapper = createWrapper(validConfig);
      expect(wrapper).to.have.property('meta');
      expect(wrapper).to.have.property('schemas');
      expect(wrapper).to.have.property('build');
      expect(wrapper).to.have.property('validate');
    });

    it('should have correct meta information', function () {
      const wrapper = createWrapper(validConfig);
      expect(wrapper.meta).to.deep.equal({
        name: 'testExtension',
        description: 'Test extension for validation',
        version: '1.0.0',
      });
    });

    it('should expose hook schemas correctly', function () {
      const wrapper = createWrapper(validConfig);
      expect(wrapper.schemas).to.have.property('makerAmount');
      expect(wrapper.schemas).to.have.property('preInteraction');
      expect(Object.keys(wrapper.schemas)).to.have.length(2);
    });

    it('should validate parameters correctly', function () {
      const wrapper = createWrapper(validConfig);
      const validParams = {
        makerAmount: {
          minAmount: '1000',
          maxAmount: '2000',
        },
        preInteraction: {
          target: '0x1234567890123456789012345678901234567890',
          data: '0xabcdef',
        },
      };
      const errors = wrapper.validate(validParams);
      expect(errors).to.be.null;
    });

    it('should return validation errors for invalid parameters', function () {
      const wrapper = createWrapper(validConfig);
      const invalidParams = {
        makerAmount: {
          minAmount: 'invalid',
          maxAmount: '2000',
        },
        preInteraction: {
          target: 'invalid-address',
          data: '0xabcdef',
        },
      };
      const errors = wrapper.validate(invalidParams);
      expect(errors).to.not.be.null;
      expect(errors).to.have.property('makerAmount');
      expect(errors).to.have.property('preInteraction');
    });

    it('should build extension with validated parameters', function () {
      const wrapper = createWrapper(validConfig);
      const params = {
        makerAmount: {
          minAmount: '1000',
          maxAmount: '2000',
        },
      };
      const extension = wrapper.build(params);
      expect(extension).to.have.property('type', 'Extension');
      expect(extension).to.have.property('params');
      expect(extension.params).to.have.property('makerAmount');
    });

    it('should throw on invalid build parameters', function () {
      const wrapper = createWrapper(validConfig);
      const invalidParams = {
        makerAmount: {
          minAmount: 'invalid',
          maxAmount: '2000',
        },
      };
      expect(() => wrapper.build(invalidParams)).to.throw();
    });

    it('should handle empty parameters gracefully', function () {
      const wrapper = createWrapper(validConfig);
      const extension = wrapper.build({});
      expect(extension).to.have.property('type', 'Extension');
      expect(extension.params).to.deep.equal({});
    });

    it('should reject invalid wrapper configuration', function () {
      const invalidConfigs = [
        { name: '', description: 'test', hooks: {}, build: () => {} },
        { name: 'test', description: '', hooks: {}, build: () => {} },
        { name: 'test', description: 'test', hooks: {}, build: 'not-function' },
        { description: 'test', hooks: {}, build: () => {} },
      ];
      invalidConfigs.forEach((config) => {
        expect(() => createWrapper(config)).to.throw();
      });
    });

    it('should handle complex nested validation', function () {
      const complexConfig = {
        name: 'complexExtension',
        description: 'Complex validation test',
        hooks: {
          makerAmount: z.object({
            config: z.object({
              addresses: z.array(address),
              amounts: z.array(uint256),
            }),
          }),
        },
        build: (params) => params,
      };
      const wrapper = createWrapper(complexConfig);
      const validParams = {
        makerAmount: {
          config: {
            addresses: ['0x1234567890123456789012345678901234567890'],
            amounts: ['1000'],
          },
        },
      };
      const errors = wrapper.validate(validParams);
      expect(errors).to.be.null;
      expect(() => wrapper.build(validParams)).to.not.throw();
    });
  });
});
