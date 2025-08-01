import {
  MakerTraits,
  LimitOrder,
  Address,
  Extension,
} from '@1inch/limit-order-sdk';
import { parseUnits } from 'ethers';
import { HookType } from './constants.js';
import { approveAssetSpending, makeAssetPermit } from './utils.js';
import createERC20Contract from './contracts/erc20.js';

/**
 * Custom error thrown when extension wrappers have overlapping hook types.
 *
 * This error prevents unsafe extension combinations that could cause
 * unpredictable behavior or order execution failures.
 *
 * @extends Error
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
 */
export class OrderBuilder {
  /** @type {ExtensionWrapper[]} */
  extensions = [];
  usedHooks = new Set();
  makerTraits = MakerTraits.default();

  /**
   * Create a new OrderBuilder instance with the specified trading parameters.
   *
   * All amounts should be provided in their smallest unit (wei for ETH,
   * smallest unit for ERC-20 tokens based on their decimals).
   *
   * @param {string} makerAsset - ERC-20 contract address of the asset being offered by maker
   * @param {string} makerAmount - Amount of maker asset being offered
   * @param {string} takerAsset - ERC-20 contract address of the asset being requested from taker
   * @param {string} takerAmount - Amount of taker asset being requested
   * @param {string} [receiver] - Optional address to receive the filled order (defaults to maker)
   */
  constructor(makerAsset, makerAmount, takerAsset, takerAmount, receiver) {
    this.makerAsset = makerAsset;
    this.makerAmount = makerAmount;
    this.takerAsset = takerAsset;
    this.takerAmount = takerAmount;
    this.receiver = receiver;
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
   * @param {import('ethers').Signer} signer - Ethers signer instance
   * @param {Object} [params={}] - Parameters to pass to extension build functions
   *
   * @returns {Promise<OrderResult>} Promise resolving to signed order data
   *
   * @throws {Error} If signer is not an EOA (smart contract wallets not supported)
   * @throws {Error} If multiple extensions cannot be combined safely
   *
   * @see {@link https://eips.ethereum.org/EIPS/eip-712} EIP-712 Typed Data Standard
   * @see {@link https://docs.1inch.io/docs/limit-order-protocol/introduction} 1inch LOP Documentation
   */
  async build(signer, params = {}) {
    const { chainId } = await signer.provider.getNetwork();
    // Get the maker address from the signer
    const makerAddress = new Address(await signer.getAddress());
    // Create ERC20 contract instances
    const makerAssetContract = createERC20Contract(this.makerAsset, signer);
    const takerAssetContract = createERC20Contract(this.takerAsset, signer);
    // Convert amounts to BigInt
    const makingAmount = parseUnits(
      this.makerAmount,
      await makerAssetContract.decimals()
    );
    const takingAmount = parseUnits(
      this.takerAmount,
      await takerAssetContract.decimals()
    );
    // Create receiver address (defaults to maker if not specified)
    const receiver = this.receiver ? new Address(this.receiver) : makerAddress;
    // Create the order info object
    const orderInfo = {
      maker: makerAddress,
      makerAsset: new Address(this.makerAsset),
      takerAsset: new Address(this.takerAsset),
      makingAmount,
      takingAmount,
      receiver,
    };
    // Combine all extensions into a single Extension instance
    const extension = await this._combineExtensions(params, {
      makerAsset: makerAssetContract,
      makerAmount: makingAmount,
      takerAsset: takerAssetContract,
      takerAmount: takingAmount,
    });
    // Create a permit for the maker asset
    try {
      extension.makerPermit = await makeAssetPermit(
        signer,
        makerAssetContract,
        makingAmount
      );
    } catch (error) {
      console.error('Failed to make asset permit, approving instead');
      await approveAssetSpending(signer, makerAssetContract, makingAmount);
    }
    // Construct LimitOrder with current params and combined extensions
    const order = new LimitOrder(orderInfo, this.makerTraits, extension);
    // Compute order hash using EIP-712 typed data
    const typedData = order.getTypedData(chainId);
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
   * @param {OrderBuilderContext} context - Order information
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
  async _combineExtensions(params, context) {
    if (this.extensions.length > 0) {
      const combined = new Extension();
      for (const extension of this.extensions) {
        const result = await extension.build(params, context);
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
}
