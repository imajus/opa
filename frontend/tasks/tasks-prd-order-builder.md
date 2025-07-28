## Relevant Files

- `src/order-builder.js` - Core OrderBuilder class that builds, signs, and exports limit orders.
- `src/extensions/` - Directory for reusable extension wrappers (e.g., `chainlink-spread-wrapper.js`).
- `test/order-builder.test.js` - Unit tests covering core build logic, signing, and collision detection.
- `docs/OrderBuilder.md` - Public API overview and usage examples.
- `tasks/prd-order-builder.md` - Source PRD guiding implementation requirements.
- `chainlink-spread.js` - Reference script demonstrating extension usage and signing (used for inspiration only).

## Tasks

- [ ] 1.0 Project Setup & Tooling
  - [x] 1.1 Add runtime dependencies: `@1inch/limit-order-sdk`, `ethers@^6`.
  - [x] 1.2 Add dev dependencies: `vitest`.

- [ ] 2.0 Core OrderBuilder Implementation
  - [ ] 2.1 Create `src/order-builder.js` skeleton (constructor accepting maker/taker params & receiver).
  - [ ] 2.2 Implement internal `MakerTraits` instance and expose via `getMakerTraits()`.
  - [ ] 2.3 Add `addExtension(wrapper)` with storage for wrappers.
  - [ ] 2.4 Implement hook-collision detection (throw `HookCollisionError`).
  - [ ] 2.5 Implement `build(signer)` that:
    - [ ] 2.5.1 Constructs `LimitOrder` with provided params and combined extension.
    - [ ] 2.5.2 Computes order hash.
    - [ ] 2.5.3 Signs typed data with the supplied signer (EOA only).
    - [ ] 2.5.4 Returns `{ order, orderHash, signature }` serialisable object.

- [ ] 4.0 Type Declarations & Documentation
  - [ ] 4.1 Add comprehensive JSDoc to all public methods and typedefs.
  - [ ] 4.3 Write `docs/OrderBuilder.md` including quick-start and advanced usage with extensions.

- [ ] 5.0 Testing & Verification
  - [ ] 5.1 Write unit tests for basic build & sign workflow without extensions.
  - [ ] 5.2 Write tests verifying multiple wrappers with non-overlapping hooks succeed.
  - [ ] 5.3 Write tests asserting collision detection throws when hooks overlap.
