import {
  MakerTraits,
  LimitOrder,
  Address,
  ExtensionBuilder,
} from '@1inch/limit-order-sdk';
import { TypedDataEncoder } from 'ethers';

/**
 * Error thrown when extension wrappers have overlapping hooks
 */
export class HookCollisionError extends Error {
  constructor(hookName) {
    super(
      `Hook collision detected: ${hookName} is already defined by another extension`
    );
    this.name = 'HookCollisionError';
  }
}

/**
 * OrderBuilder class for creating, configuring, and signing 1inch Limit Orders
 */
export class OrderBuilder {
  /**
   * Create a new OrderBuilder instance
   * @param {string} makerAsset - ERC-20 address of the asset being offered
   * @param {string} makerAmount - Amount of maker asset being offered
   * @param {string} takerAsset - ERC-20 address of the asset being requested
   * @param {string} takerAmount - Amount of taker asset being requested
   * @param {string} [receiver] - Optional receiver address for the filled order
   */
  constructor(makerAsset, makerAmount, takerAsset, takerAmount, receiver) {
    this.makerAsset = makerAsset;
    this.makerAmount = makerAmount;
    this.takerAsset = takerAsset;
    this.takerAmount = takerAmount;
    this.receiver = receiver;

    // Initialize MakerTraits instance
    this.makerTraits = new MakerTraits();

    // Storage for extension wrappers and hook collision detection
    this.extensions = [];
    this.usedHooks = new Set();
  }

  /**
   * Get the internal MakerTraits instance for external configuration
   * @returns {MakerTraits} The MakerTraits instance
   */
  getMakerTraits() {
    return this.makerTraits;
  }

  /**
   * Add an extension wrapper to the order
   * @param {Object} wrapper - Extension wrapper that may implement LOP hook types
   * @throws {HookCollisionError} If wrapper defines a hook already present in another wrapper
   */
  addExtension(wrapper) {
    // Check for hook collisions with previously added extensions
    if (wrapper.schemas) {
      const newHooks = Object.keys(wrapper.schemas);
      for (const hookName of newHooks) {
        if (this.usedHooks.has(hookName)) {
          throw new HookCollisionError(hookName);
        }
      }

      // Add new hooks to the used hooks set
      for (const hookName of newHooks) {
        this.usedHooks.add(hookName);
      }
    }

    // Store wrapper for later use in build()
    this.extensions.push(wrapper);
  }

  /**
   * Build and sign the limit order
   * @param {Object} signer - Ethers.js signer (EOA only)
   * @param {number} chainId - Chain ID for EIP-712 domain separation
   * @returns {Promise<{order: Object, orderHash: string, signature: string}>} Serializable order data
   */
  async build(signer, chainId) {
    // Get the maker address from the signer
    const makerAddress = new Address(await signer.getAddress());

    // Create Address instances for assets
    const makerAsset = new Address(this.makerAsset);
    const takerAsset = new Address(this.takerAsset);

    // Create receiver address (defaults to maker if not specified)
    const receiver = this.receiver ? new Address(this.receiver) : makerAddress;

    // Combine all extensions into a single Extension instance
    const combinedExtension = this._combineExtensions();

    // Create the order info object
    const orderInfo = {
      maker: makerAddress,
      makerAsset,
      takerAsset,
      makingAmount: BigInt(this.makerAmount),
      takingAmount: BigInt(this.takerAmount),
      receiver,
    };

    // Construct LimitOrder with current params and combined extensions
    const order = new LimitOrder(
      orderInfo,
      this.makerTraits,
      combinedExtension
    );

    // Compute order hash using EIP-712 typed data
    const typedData = order.getTypedData(chainId);
    const orderHash = TypedDataEncoder.hash(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    // Sign typed data with the supplied signer (EOA only)
    const signature = await signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    // Return serializable object with order, orderHash, and signature
    return {
      order: order.build(),
      orderHash,
      signature,
    };
  }

  /**
   * Combines all added extensions into a single Extension instance
   * @private
   * @returns {Extension|undefined} Combined extension or undefined if no extensions
   */
  _combineExtensions() {
    if (this.extensions.length === 0) {
      return undefined;
    }

    // If only one extension, build it directly
    if (this.extensions.length === 1) {
      return this.extensions[0].build({});
    }

    // TODO: Implement proper extension combination logic
    // For now, throw an error as this needs careful implementation
    throw new Error('Multiple extension combination not yet implemented');
  }
}
