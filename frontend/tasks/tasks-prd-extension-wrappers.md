## Relevant Files

- `package.json` - Project manifest containing dependencies, scripts, and ESM module type.
- `.eslintrc.json` - ESLint configuration for code quality and style enforcement.
- `jsconfig.json` - VSCode JavaScript language server configuration
- `src/schemas/common.js` - Reusable Zod primitives (e.g., `address`, `uint256`).
- `src/constants.js` - Constants/enums e.g. for LOP hooks (`makerAmount`, `takerAmount`, etc.).
- `src/extensions/utils/factory.js` - Utility to standardise wrapper creation (meta, schemas, build helper).
- `src/extensions/gas-station.js` - Gas Station extension wrapper definition.
- `src/extensions/chainlink-calculator.js` - Chainlink Calculator extension wrapper definition.
- `src/extensions/dutch-auction-calculator.js` - Dutch Auction Calculator extension wrapper definition.
- `src/extensions/range-amount-calculator.js` - Range Amount Calculator extension wrapper definition.
- `test/extensions/utils/factory.test.js` - Unit tests for utility functions.
- `test/extensions/gas-station.test.js` - Unit tests for Gas Station wrapper.
- `test/extensions/chainlink-calculator.test.js` - Unit tests for Chainlink Calculator wrapper.
- `test/extensions/dutch-auction-calculator.test.js` - Unit tests for Dutch Auction Calculator wrapper.
- `test/extensions/range-amount-calculator.test.js` - Unit tests for Range Amount Calculator wrapper.
- `docs/extensions.md` - Usage guide, examples, and contribution notes.

## Tasks

- [ ] 1.0 Project scaffolding & tooling setup
  - [ ] 1.1 Add `package.json` with `"type": "module"`; add deps `zod`, `@1inch/limit-order-sdk`; devDeps `mocha`, `chai`, `eslint`.
  - [ ] 1.2 Configure `.eslintrc.json` with preferred rules and no-empty-line style inside functions.
  - [ ] 1.3 Configure `jsconfig.json` with appropriate defaults
  - [ ] 1.4 Add npm scripts: `test`, `coverage`, `lint`, `docs`.
  - [ ] 1.4 Create base directories: `src/`, `src/extensions/`, `src/schemas/`, `test/`.
  - [ ] 1.5 Install dependencies via `npm install`.
  - [ ] **[Human]** 1.6 Approve package name and publishing scope (public vs private).

- [ ] 2.0 Core wrapper interface & utilities
  - [ ] 2.1 Implement `src/extensions/utils/factory.js` exporting `createWrapper({ name, description, hooks, build }): ExtensionWrapper`.
  - [ ] 2.2 Add `src/schemas/common.js` with Zod helpers (e.g., `address`, `uint256`, `UBigInt`).
  - [ ] 2.3 Define `src/constants.js` constants for the four supported hooks.
  - [ ] 2.4 Write unit tests in `test/extensions/utils/factory.test.js` for validation and meta integrity.
  - [ ] 2.5 Add JSDoc to utilities and generate typings (`*.d.ts`) as stretch goal.

- [ ] 3.0 Extension wrapper implementations
  - [ ] 3.1 [Gas Station](/backend/contracts/extensions/GasStation.sol) wrapper (`src/extensions/gas-station.js`): define meta, hooks Zod schemas, and `build()` logic.
  - [ ] 3.2 [Chainlink Calculator](/backend/node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/ChainlinkCalculator.sol) wrapper (`src/extensions/chainlink-calculator.js`).
  - [ ] 3.3 [Dutch Auction Calculator](/backend/node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/DutchAuctionCalculator.sol) wrapper (`src/extensions/dutch-auction-calculator.js`).
  - [ ] 3.4 [Range Amount Calculator](/backend/node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/RangeAmountCalculator.sol) wrapper (`src/extensions/range-amount-calculator.js`).
  - [ ] 3.5 Re-export new wrappers in `src/index.js`.
  - [ ] 3.6 Ensure schema objects are exported for external validation reuse.

- [ ] 4.0 Unit testing & coverage
  - [ ] 4.1 Write success-path tests asserting `build()` returns a valid SDK `Extension` instance for each wrapper.

- [ ] 5.0 Documentation & packaging
  - [ ] 5.1 Draft `docs/Extensions.md` with quick-start example
