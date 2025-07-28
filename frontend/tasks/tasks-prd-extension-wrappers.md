## Relevant Files

Work only in the `frontend` folder:

- `frontend/package.json` - Project manifest containing dependencies, scripts, and ESM module type.
- `frontend/.eslintrc.json` - ESLint configuration for code quality and style enforcement.
- `frontend/jsconfig.json` - VSCode JavaScript language server configuration
- `frontend/test/placeholder.test.js` - Placeholder test file for project scaffolding validation.
- `frontend/src/schemas/common.js` - Reusable Zod primitives (e.g., `address`, `uint256`).
- `frontend/src/constants.js` - Constants/enums e.g. for LOP hooks (`makerAmount`, `takerAmount`, etc.).
- `frontend/src/extensions/utils/factory.js` - Utility to standardise wrapper creation (meta, schemas, build helper).
- `frontend/src/index.js` - Main entry point re-exporting all wrappers, utilities, and schemas.
- `frontend/src/extensions/gas-station.js` - Gas Station extension wrapper definition.
- `frontend/src/extensions/chainlink-calculator.js` - Chainlink Calculator extension wrapper definition.
- `frontend/src/extensions/dutch-auction-calculator.js` - Dutch Auction Calculator extension wrapper with time-based price decay.
- `frontend/src/extensions/range-amount-calculator.js` - Range Amount Calculator extension wrapper with linear price progression.
- `frontend/test/extensions/utils/factory.test.js` - Unit tests for utility functions.
- `frontend/test/extensions/gas-station.test.js` - Unit tests for Gas Station wrapper.
- `frontend/test/extensions/chainlink-calculator.test.js` - Unit tests for Chainlink Calculator wrapper.
- `frontend/test/extensions/dutch-auction-calculator.test.js` - Unit tests for Dutch Auction Calculator wrapper.
- `frontend/test/extensions/range-amount-calculator.test.js` - Unit tests for Range Amount Calculator wrapper.
- `frontend/docs/extensions.md` - Usage guide, examples, and contribution notes.

## Tasks

- [x] 1.0 Project scaffolding & tooling setup
  - [x] 1.1 Add `package.json` with `"type": "module"`; add deps `zod`, `@1inch/limit-order-sdk`; devDeps `mocha`, `chai`, `eslint`.
  - [x] 1.2 Configure `.eslintrc.json` with preferred rules and no-empty-line style inside functions.
  - [x] 1.3 Configure `jsconfig.json` with appropriate defaults
  - [x] 1.4 Add npm scripts: `test`, `coverage`, `lint`, `docs`.
  - [x] 1.5 Create base directories: `src/`, `src/extensions/`, `src/schemas/`, `test/`.
  - [x] 1.6 Install dependencies via `npm install`.
  - [x] **[Human]** 1.7 Approve package name and publishing scope (public vs private).

- [x] 2.0 Core wrapper interface & utilities
  - [x] 2.1 Implement `src/extensions/utils/factory.js` exporting `createWrapper({ name, description, hooks, build }): ExtensionWrapper`.
  - [x] 2.2 Add `src/schemas/common.js` with Zod helpers (e.g., `address`, `uint256`, `UBigInt`).
  - [x] 2.3 Define `src/constants.js` constants for the four supported hooks.
  - [x] 2.4 Write unit tests in `test/extensions/utils/factory.test.js` for validation and meta integrity.
  - [x] 2.5 Add JSDoc to utilities and generate typings (`*.d.ts`) as stretch goal.

- [x] 3.0 Extension wrapper implementations
  - [x] 3.1 [Gas Station](/backend/contracts/extensions/GasStation.sol) wrapper (`src/extensions/gas-station.js`): define meta, hooks Zod schemas, and `build()` logic.
  - [x] 3.2 [Chainlink Calculator](/backend/node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/ChainlinkCalculator.sol) wrapper (`src/extensions/chainlink-calculator.js`).
  - [x] 3.3 [Dutch Auction Calculator](/backend/node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/DutchAuctionCalculator.sol) wrapper (`src/extensions/dutch-auction-calculator.js`).
  - [x] 3.4 [Range Amount Calculator](/backend/node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/RangeAmountCalculator.sol) wrapper (`src/extensions/range-amount-calculator.js`).
  - [x] 3.5 Re-export new wrappers in `src/index.js`.
  - [x] 3.6 Ensure schema objects are exported for external validation reuse.

- [x] 4.0 Unit testing & coverage
  - [x] 4.1 Write success-path tests asserting `build()` returns a valid SDK `Extension` instance for each wrapper.

- [x] 5.0 Documentation & packaging
  - [x] 5.1 Draft `docs/Extensions.md` with quick-start example
