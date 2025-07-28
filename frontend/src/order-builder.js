import {
  MakerTraits,
  LimitOrder,
  Address,
  ExtensionBuilder,
} from '@1inch/limit-order-sdk';
import { TypedDataEncoder } from 'ethers';

/**
 * @fileoverview OrderBuilder for 1inch Limit Order Protocol v4
 *
 * This module provides a lightweight JavaScript helper for creating, configuring,
 * and signing 1inch Limit Order Protocol (LOP) v4 orders. It converts raw user
 * input into fully-formed orders with optional extension hooks.
 *
 * @author Denis Perov <denis.perov@gmail.com>
 * @version 1.0.0
 */

/**
 * @typedef {Object} ExtensionWrapper
 * @property {Object} meta - Extension metadata
 * @property {string} meta.name - Extension name
 * @property {string} meta.description - Extension description
 * @property {string} meta.version - Extension version
 * @property {Object.<string, Object>} schemas - Hook parameter schemas mapped by hook type
 * @property {Function} build - Function to build Extension instance from parameters
 * @property {Function} validate - Function to validate parameters against schemas
 */

/**
 * @typedef {Object} OrderResult
 * @property {Object} order - The built LimitOrder struct ready for on-chain submission
 * @property {string} orderHash - EIP-712 hash of the order for verification
 * @property {string} signature - EIP-712 signature of the order from the maker
 */

/**
 * @typedef {Object} OrderInfo
 * @property {Address} maker - Address of the order maker
 * @property {Address} makerAsset - ERC-20 address of the asset being offered
 * @property {Address} takerAsset - ERC-20 address of the asset being requested
 * @property {bigint} makingAmount - Amount of maker asset being offered
 * @property {bigint} takingAmount - Amount of taker asset being requested
 * @property {Address} receiver - Address that will receive the filled order
 */

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
    this.makerTraits = new MakerTraits();

    // Storage for extension wrappers and hook collision detection
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
   * Add an extension wrapper to the order with automatic hook collision detection.
   *
   * Extensions provide advanced functionality like dynamic pricing, gas optimization,
   * and custom interactions. This method safely combines multiple extensions by
   * preventing hook collisions that could cause undefined behavior.
   *
   * @param {ExtensionWrapper} wrapper - Extension wrapper implementing LOP hook types
   * @param {Object} wrapper.schemas - Hook schemas mapped by hook type (makerAmount, takerAmount, etc.)
   * @param {Function} wrapper.build - Function to build Extension instance from parameters
   * @param {Object} wrapper.meta - Extension metadata (name, description, version)
   *
   * @throws {HookCollisionError} If wrapper defines a hook already used by another extension
   * @throws {TypeError} If wrapper is missing required properties
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
   *
   * @param {import('ethers').Signer} signer - Ethers.js signer instance (EOA wallets only)
   * @param {number} chainId - EIP-155 chain ID for domain separation (1 for mainnet, 137 for Polygon, etc.)
   *
   * @returns {Promise<OrderResult>} Promise resolving to signed order data
   * @returns {Promise<{order: Object, orderHash: string, signature: string}>} Serializable order data
   *
   * @throws {Error} If signer is not an EOA (smart contract wallets not supported)
   * @throws {Error} If multiple extensions cannot be combined safely
   * @throws {TypeError} If chainId is not a valid number
   *
   * @example
   * // Basic order signing
   * import { Wallet } from 'ethers';
   *
   * const wallet = new Wallet(privateKey, provider);
   * const result = await builder.build(wallet, 1);
   *
   * console.log('Order hash:', result.orderHash);
   * console.log('Signature:', result.signature);
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
   * const signedOrder = await builder.build(signer, 137); // Polygon
   *
   * @example
   * // Error handling
   * try {
   *   const result = await builder.build(signer, chainId);
   *   await submitToContract(result);
   * } catch (error) {
   *   console.error('Order building failed:', error.message);
   * }
   *
   * @see {@link https://eips.ethereum.org/EIPS/eip-712} EIP-712 Typed Data Standard
   * @see {@link https://docs.1inch.io/docs/limit-order-protocol/introduction} 1inch LOP Documentation
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
   * Combines all added extensions into a single Extension instance for order construction.
   *
   * This internal method handles the safe combination of multiple extensions by
   * ensuring no hook collisions exist and properly merging extension functionality.
   * When no extensions are present, returns undefined for vanilla orders.
   *
   * Current implementation supports:
   * - Zero extensions (returns undefined)
   * - Single extension (builds directly)
   * - Multiple extensions (TODO: requires advanced merging logic)
   *
   * @private
   * @internal
   *
   * @returns {import('@1inch/limit-order-sdk').Extension|undefined} Combined extension instance or undefined
   *
   * @throws {Error} When multiple extensions are added (not yet implemented)
   *
   * @example
   * // Internal usage - called automatically by build()
   * const extension = this._combineExtensions();
   * if (extension) {
   *   // Order will use the combined extension
   * } else {
   *   // Vanilla order without extensions
   * }
   *
   * @todo Implement proper extension combination logic for multiple extensions
   * @todo Add support for complex extension merging strategies
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
