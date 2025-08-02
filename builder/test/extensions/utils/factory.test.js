import { describe, it, expect } from 'vitest';
import {
  createWrapper,
  createSchema,
} from '../../../lib/extensions/utils/factory.js';
import { address, uint256 } from '../../../lib/extensions/utils/types.js';

describe('Factory Utils', function () {
  describe('createWrapper', function () {
    const validConfig = {
      name: 'testExtension',
      description: 'Test extension for validation',
      hooks: {
        makerAmount: createSchema({
          fields: {
            minAmount: { type: uint256 },
            maxAmount: { type: uint256 },
          },
        }),
        preInteraction: createSchema({
          fields: {
            target: { type: address },
            data: { type: { validate: () => {}, parse: (v) => v } },
          },
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

    it('should build extension with validated parameters', async function () {
      const wrapper = createWrapper(validConfig);
      const params = {
        makerAmount: {
          minAmount: '1000',
          maxAmount: '2000',
        },
      };
      const extension = await wrapper.build(params);

      expect(extension).to.have.property('type', 'Extension');
      expect(extension).to.have.property('params');
      expect(extension.params).to.have.property('makerAmount');
    });

    it('should throw on invalid build parameters', async function () {
      const wrapper = createWrapper(validConfig);
      const invalidParams = {
        makerAmount: {
          minAmount: 'invalid',
          maxAmount: '2000',
        },
      };

      await expect(wrapper.build(invalidParams)).rejects.toThrow();
    });

    it('should handle empty parameters gracefully', async function () {
      const wrapper = createWrapper(validConfig);
      const extension = await wrapper.build({});

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
          makerAmount: createSchema({
            fields: {
              config: {
                type: {
                  validate(value) {
                    if (!value.addresses || !value.amounts) {
                      throw new Error('Missing addresses or amounts');
                    }
                    value.addresses.forEach((addr) => address.validate(addr));
                    value.amounts.forEach((amount) => uint256.validate(amount));
                  },
                  parse: (value) => value,
                },
              },
            },
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
