# Order Builder API – Product Requirements Document

## 1. Introduction / Overview

The Order Builder API is a lightweight JavaScript helper (usable in browser or Node.js) that converts raw user input into a fully-formed 1inch Limit Order Protocol (LOP) v4 order. It assembles the order struct, attaches optional extension hooks, signs the order with an Externally-Owned Account (EOA) via _ethers.js_, and returns JSON-serialisable data ready for on-chain submission or off-chain relay.

## 2. Goals

1. Provide an easy-to-use builder that accepts minimal mandatory fields (`makerAsset`, `makerAmount`, `takerAsset`, `takerAmount`) and outputs `{ order, orderHash, signature }`.
2. Support attaching multiple extension _wrappers_ while preventing hook collisions.
3. Expose the underlying `MakerTraits` instance so callers can configure nonce, expiry, partial/multi-fill flags externally.
4. Ship as a ES module consumable in React/Vite apps or Node.js scripts.
5. Achieve ≥ 50 % unit-test coverage for core logic (order build, extension conflict detection, signing).

## 3. User Stories

1. _As a dApp front-end developer_, I want to pass asset addresses and amounts into a builder and receive a signed order so that I can submit it to the 1inch backend or directly on-chain.
2. _As an SDK integrator_, I want to plug in custom extension wrappers without worrying about hook conflicts so that I can compose advanced order behaviour.
3. _As a power user_, I want the ability to tweak nonce, expiration and allowance flags through the exposed `MakerTraits` so that I retain full control over order lifecycles.

## 4. Functional Requirements

1. The builder constructor must accept (or provide setters for):
   - `makerAsset: string` (ERC-20 address)
   - `makerAmount: string`
   - `takerAsset: string`
   - `takerAmount: string`
   - `receiver?: string`
2. `addExtension(wrapper)` – Adds an extension wrapper that may implement any of the LOP hook types. If an added wrapper defines a hook already present in another wrapper, the builder **MUST** throw an error.
3. `getMakerTraits()` – Returns the internal `MakerTraits` instance for external mutation.
4. `build(signer): Promise<{ order, orderHash, signature }>`
   - Builds a `LimitOrder` instance using current params & extensions.
   - Computes the EIP-712 hash and signature via `signer` (EOA only).
   - Returns a plain object with serialisable fields.
5. The builder must be able to combine any mix of extension wrappers whose hooks do not overlap, including zero extensions.
6. No validation is required for token decimals, zero amounts, or unsupported chain IDs.
7. The module must ship with TypeScript typings (generated or handwritten) even though primary source is JS, to aid IDE auto-completion.

## 5. SDK / Tooling

- `@1inch/limit-order-sdk` – core order & extension types.
- `ethers` v6 – signing & address utilities.
- Vitest – unit testing.
- Node.js ≥ 18 for tooling, but runtime-agnostic output (browser friendly ESM bundle).

## 6. Non-Goals (Out of Scope)

- UI components, forms or React hooks.
- Filling, cancelling, or monitoring orders.
- Gas estimation or performance optimisations.
- Guarding against invalid inputs, unsupported chain IDs, or balance/allowance checks.

## 7. Design Considerations (Optional)

- Provide a `BuilderError` class hierarchy for clear error reporting (e.g., `HookCollisionError`).
- Consider a fluent API: `builder.setMaker(...).addExtension(...).build(...)`.
- Bundle as dual ESM/CJS with `exports` field in _package.json_.

## 8. Technical Considerations (Optional)

- Hook collision detection can rely on a `Set<string>` of hook names as wrappers are added.
- Keep the builder side-effect-free (no on-chain allowance checks).
- Deterministic salt generation will use the default logic from `MakerTraits`; custom salt inputs are **out of scope**.

## 9. Success Metrics

- ≥ 50 % branch coverage on unit tests.
- Ability to build & sign an order in Node.js
- Ability to build order with extension/s

## 10. Optional / Stretch Goals

- Support ERC-1271 smart-contract signatures.
- Provide helper wrappers for common extensions (e.g., Chainlink Spread) out of the box.
- Publish the package to npm under an open-source licence.

## 11. Open Questions

None at this time — all previously raised questions have been resolved. The builder will be named **OrderBuilder**.
