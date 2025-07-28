## Relevant Files

- `src/order-builder.js` - Core OrderBuilder class that builds, signs, and exports limit orders.
- `src/extensions/` - Directory for reusable extension wrappers (e.g., `chainlink-spread-wrapper.js`).
- `test/order-builder.test.js` - Unit tests covering core build logic, signing, and collision detection.
- `docs/OrderBuilder.md` - Public API overview and usage examples.
- `tasks/prd-order-builder.md` - Source PRD guiding implementation requirements.
- `chainlink-spread.js` - Reference script demonstrating extension usage and signing (used for inspiration only).

## Tasks

- [x] 1.0 Project Setup & Tooling
  - [x] 1.1 Add runtime dependencies: `@1inch/limit-order-sdk`, `ethers@^6`.
  - [x] 1.2 Add dev dependencies: `vitest`.

- [x] 2.0 Core OrderBuilder Implementation
  - [x] 2.1 Create `src/order-builder.js` skeleton (constructor accepting maker/taker params & receiver).
  - [x] 2.2 Implement internal `MakerTraits` instance and expose via `getMakerTraits()`.
  - [x] 2.3 Add `addExtension(wrapper)` with storage for wrappers.
  - [x] 2.4 Implement hook-collision detection (throw `HookCollisionError`).
  - [x] 2.5 Implement `build(signer)` that:
    - [x] 2.5.1 Constructs `LimitOrder` with provided params and combined extension.
    - [x] 2.5.2 Computes order hash.
    - [x] 2.5.3 Signs typed data with the supplied signer (EOA only).
    - [x] 2.5.4 Returns `{ order, orderHash, signature }` serialisable object.

- [x] 4.0 Type Declarations & Documentation
  - [x] 4.1 Add comprehensive JSDoc to all public methods and typedefs.
  - [x] 4.3 Write `docs/OrderBuilder.md` including quick-start and advanced usage with extensions.

- [x] 5.0 Testing & Verification
  - [x] 5.1 Write unit tests for basic build & sign workflow without extensions.
  - [x] 5.2 Write tests verifying multiple wrappers with non-overlapping hooks succeed.
  - [x] 5.3 Write tests asserting collision detection throws when hooks overlap.
