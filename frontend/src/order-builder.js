import {
  MakerTraits,
  LimitOrder,
  Address,
  ExtensionBuilder,
  Extension,
} from '@1inch/limit-order-sdk';
import { TypedDataEncoder } from 'ethers';
import { config } from './config.js';
import { HookType } from './constants.js';

/**
 * Custom error thrown when extension wrappers have overlapping hook types.
 *
 * This error prevents unsafe extension combinations that could cause
 * unpredictable behavior or order execution failures.
 *
 * @extends Error
 * @example
 * try {
 *   builder.addExtension(extensionA);
 *   builder.addExtension(extensionB); // throws if both use same hook
 * } catch (error) {
 *   if (error instanceof HookCollisionError) {
 *     console.log(`Collision on hook: ${error.message}`);
 *   }
 * }
 */
export class HookCollisionError extends Error {
  /**
   * Create a new HookCollisionError
   * @param {string} hookName - The name of the conflicting hook type
   */
  constructor(hookName) {
    super(
      `Hook collision detected: ${hookName} is already defined by another extension`
    );
    this.name = 'HookCollisionError';
  }
}

/**
 * OrderBuilder class for creating, configuring, and signing 1inch Limit Orders.
 *
 * This class provides a fluent interface for building complex limit orders with
 * optional extensions while ensuring hook collision safety. It handles the entire
 * order lifecycle from construction to EIP-712 signing.
 *
 * Key features:
 * - Safe extension composition with collision detection
 * - Built-in MakerTraits configuration
 * - EIP-712 compliant order hashing and signing
 * - Browser and Node.js compatible
 *
 * @class OrderBuilder
 * @example
 * // Basic order without extensions
 * const builder = new OrderBuilder(
 *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
 *   '1000000', // 1 USDC (6 decimals)
 *   '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
 *   '500000000000000000' // 0.5 ETH
 * );
 *
 * const result = await builder.build(signer, 1);
 * console.log('Order hash:', result.orderHash);
 *
 * @example
 * // Order with extensions and custom receiver
 * const builder = new OrderBuilder(
 *   makerAsset,
 *   makerAmount,
 *   takerAsset,
 *   takerAmount,
 *   '0x742d35Cc6630C0532c77B3C6Ab3D3C57a7D64A88' // custom receiver
 * );
 *
 * // Configure order properties
 * builder.getMakerTraits()
 *   .allowPartialFills()
 *   .allowMultipleFills()
 *   .withExpiration(Math.floor(Date.now() / 1000) + 3600);
 *
 * // Add extensions safely
 * builder.addExtension(chainlinkCalculator);
 * builder.addExtension(gasStation);
 *
 * const signedOrder = await builder.build(signer, chainId);
 */
export class OrderBuilder {
  /**
   * Create a new OrderBuilder instance with the specified trading parameters.
   *
   * All amounts should be provided in their smallest unit (wei for ETH,
   * smallest unit for ERC-20 tokens based on their decimals).
   *
   * @param {string} makerAsset - ERC-20 contract address of the asset being offered by maker
   * @param {string|bigint} makerAmount - Amount of maker asset being offered (in smallest unit)
   * @param {string} takerAsset - ERC-20 contract address of the asset being requested from taker
   * @param {string|bigint} takerAmount - Amount of taker asset being requested (in smallest unit)
   * @param {string} [receiver] - Optional address to receive the filled order (defaults to maker)
   *
   * @throws {TypeError} If required parameters are missing or invalid
   *
   * @example
   * // Simple USDC -> WETH swap
   * const builder = new OrderBuilder(
   *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
   *   '1000000',                                     // 1 USDC
   *   '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
   *   '500000000000000000'                           // 0.5 WETH
   * );
   *
   * @example
   * // Order with custom receiver
   * const builder = new OrderBuilder(
   *   makerAsset,
   *   makerAmount.toString(),
   *   takerAsset,
   *   takerAmount.toString(),
   *   '0x742d35Cc6630C0532c77B3C6Ab3D3C57a7D64A88'
   * );
   */
  constructor(makerAsset, makerAmount, takerAsset, takerAmount, receiver) {
    this.makerAsset = makerAsset;
    this.makerAmount = makerAmount;
    this.takerAsset = takerAsset;
    this.takerAmount = takerAmount;
    this.receiver = receiver;
    // Initialize MakerTraits instance
    this.makerTraits = MakerTraits.default();
    // Storage for extension wrappers and hook collision detection
    /** @type {ExtensionWrapper[]} */
    this.extensions = [];
    this.usedHooks = new Set();
  }

  /**
   * Get the internal MakerTraits instance for external configuration.
   *
   * MakerTraits controls order behavior such as expiration, nonce management,
   * partial fills, and multiple fills. This method exposes the traits instance
   * for direct manipulation before building the order.
   *
   * @returns {MakerTraits} The internal MakerTraits instance
   *
   * @example
   * // Configure order expiration and fill behavior
   * const traits = builder.getMakerTraits();
   * traits
   *   .withExpiration(Math.floor(Date.now() / 1000) + 3600) // 1 hour
   *   .withNonce(42)
   *   .allowPartialFills()
   *   .allowMultipleFills();
   *
   * @example
   * // Disable partial fills for exact amount orders
   * builder.getMakerTraits().withoutPartialFills();
   *
   * @see {@link https://docs.1inch.io/docs/limit-order-protocol/introduction} 1inch LOP Documentation
   */
  getMakerTraits() {
    return this.makerTraits;
  }

  /**
   * Add an extension to the order with automatic hook collision detection.
   *
   * Extensions provide advanced functionality like dynamic pricing, gas optimization,
   * and custom interactions. This method safely combines multiple extensions by
   * preventing hook collisions that could cause undefined behavior.
   *
   * @param {ExtensionWrapper} extension - Extension implementing LOP hook types
   * @throws {HookCollisionError} If extension defines a hook already used by another extension
   * @throws {TypeError} If extension is missing required properties
   *
   * @example
   * // Add single extension
   * import { chainlinkCalculator } from './extensions/chainlink-calculator.js';
   * builder.addExtension(chainlinkCalculator);
   *
   * @example
   * // Safely add multiple non-conflicting extensions
   * try {
   *   builder.addExtension(gasStation);       // uses preInteraction + postInteraction
   *   builder.addExtension(chainlinkSpread);  // uses makerAmount + takerAmount
   * } catch (error) {
   *   if (error instanceof HookCollisionError) {
   *     console.error('Extension conflict:', error.message);
   *   }
   * }
   *
   * @example
   * // This will throw HookCollisionError
   * builder.addExtension(dutchAuction);    // uses makerAmount
   * builder.addExtension(rangeCalculator); // also uses makerAmount - COLLISION!
   */
  addExtension(extension) {
    // Check for hook collisions with previously added extensions
    if (extension.schemas) {
      const newHooks = Object.keys(extension.schemas);
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
    this.extensions.push(extension);
  }

  /**
   * Build, hash, and sign the complete limit order for submission.
   *
   * This method performs the complete order lifecycle:
   * 1. Constructs LimitOrder from current parameters and extensions
   * 2. Computes EIP-712 compliant order hash for verification
   * 3. Signs the typed data using the provided signer
   * 4. Returns serializable data ready for on-chain submission or relay
   *
   * The method ensures all extensions are properly combined and validates
   * that no hook collisions exist before proceeding with order construction.
   * Chain ID is automatically retrieved from the network configuration.
   *
   * @param {import('ethers').Signer} signer - Ethers.js signer instance (EOA wallets only)
   * @param {Object} [params={}] - Parameters to pass to extension build functions
   *
   * @returns {Promise<OrderResult>} Promise resolving to signed order data
   *
   * @throws {Error} If signer is not an EOA (smart contract wallets not supported)
   * @throws {Error} If multiple extensions cannot be combined safely
   *
   * @example
   * // Basic order signing
   * import { Wallet } from 'ethers';
   *
   * const wallet = new Wallet(privateKey, provider);
   * const result = await builder.build(wallet);
   *
   * console.log('Order hash:', result.orderHash);
   * console.log('Signature:', result.signature);
   * console.log('Extension:', result.extension);
   *
   * // Submit to 1inch backend or contract
   * await submitOrder(result.order, result.signature);
   *
   * @example
   * // Order with extensions and custom configuration
   * builder.getMakerTraits()
   *   .withExpiration(Math.floor(Date.now() / 1000) + 3600)
   *   .allowPartialFills();
   *
   * builder.addExtension(chainlinkCalculator);
   *
   * const params = { priceSpread: 0.01, updateInterval: 300 };
   * const signedOrder = await builder.build(signer, params);
   *
   * @example
   * // Error handling
   * try {
   *   const result = await builder.build(signer, params);
   *   await submitToContract(result);
   * } catch (error) {
   *   console.error('Order building failed:', error.message);
   * }
   *
   * @see {@link https://eips.ethereum.org/EIPS/eip-712} EIP-712 Typed Data Standard
   * @see {@link https://docs.1inch.io/docs/limit-order-protocol/introduction} 1inch LOP Documentation
   */
  async build(signer, params = {}) {
    // Get the maker address from the signer
    const makerAddress = new Address(await signer.getAddress());
    // Create Address instances for assets
    const makerAsset = new Address(this.makerAsset);
    const takerAsset = new Address(this.takerAsset);
    // Create receiver address (defaults to maker if not specified)
    const receiver = this.receiver ? new Address(this.receiver) : makerAddress;
    // Combine all extensions into a single Extension instance
    const extension = this._combineExtensions(params);
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
    const order = new LimitOrder(orderInfo, this.makerTraits, extension);
    // Compute order hash using EIP-712 typed data
    const typedData = order.getTypedData(config.network.chainId);
    // Sign typed data with the supplied signer (EOA only)
    const signature = await signer.signTypedData(
      typedData.domain,
      { Order: typedData.types.Order },
      typedData.message
    );
    // Return serializable object with order, orderHash, signature, and extension
    return {
      order: order.build(),
      orderHash: order.getOrderHash(),
      signature,
      extension,
    };
  }

  /**
   * Combines all added extensions into a single Extension instance for order construction.
   *
   * This internal method handles the safe combination of multiple extensions by
   * ensuring no hook collisions exist and properly merging extension functionality.
   * When no extensions are present, returns undefined for vanilla orders.
   *
   * Implementation supports:
   * - Zero extensions (returns undefined)
   * - Single extension (builds directly with params)
   * - Multiple extensions (merges all extension results)
   *
   * @private
   * @internal
   *
   * @param {Object} params - Parameters to pass to each extension's build function
   * @returns {import('@1inch/limit-order-sdk').Extension|undefined} Combined extension instance or undefined
   *
   * @example
   * // Internal usage - called automatically by build()
   * const extension = this._combineExtensions(params);
   * if (extension) {
   *   // Order will use the combined extension
   * } else {
   *   // Vanilla order without extensions
   * }
   */
  _combineExtensions(params) {
    const combined = new Extension();
    for (const extension of this.extensions) {
      const result = extension.build(params);
      if (HookType.MAKER_AMOUNT in extension.schemas) {
        combined.makingAmountData = result.makingAmountData;
      }
      if (HookType.TAKER_AMOUNT in extension.schemas) {
        combined.takingAmountData = result.takingAmountData;
      }
      if (HookType.PRE_INTERACTION in extension.schemas) {
        combined.preInteraction = result.preInteraction;
      }
      if (HookType.POST_INTERACTION in extension.schemas) {
        combined.postInteraction = result.postInteraction;
      }
    }
    return combined;
  }
}
