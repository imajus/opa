# Task List: OPA Frontend Pages Implementation

## Relevant Files

- `frontend/package.json` - Add builder package dependency via symlink and configure project dependencies
- `frontend/app/page.js` - Landing page component with logo, description, and navigation CTAs
- `frontend/app/strategy/page.js` - Strategy Builder page for selecting and configuring LOP extensions
- `frontend/app/create/page.js` - Create Order page for order parameter input and signing
- `frontend/app/fill/page.js` - Fill Order page for takers to approve tokens and execute orders
- `frontend/app/globals.css` - Global styles with orange/green theme colors
- `frontend/app/layout.js` - Root layout with RainbowKit provider configuration
- `frontend/app/providers.js` - Web3 providers setup for wallet connection
- `frontend/app/wagmi.js` - Wagmi configuration for multi-chain support
- `frontend/public/landing-logo.png` - Project logo image (peach theme)
- `frontend/lib/utils/orderBuilder.js` - Utility functions for order building and serialization
- `frontend/lib/utils/extensions.js` - Extension management and collision detection utilities
- `frontend/lib/utils/encoding.js` - Base64 encoding/decoding utilities for URL parameters
- `frontend/lib/utils/orderDisplay.js` - Order formatting utilities for UI display with token symbol mapping
- `frontend/components/ExtensionCard.js` - Reusable component for displaying extension information
- `frontend/components/OrderForm.js` - Form component for order parameter input
- `frontend/components/WalletConnection.js` - Wallet connection status and network switching
- `frontend/components/TransactionStatus.js` - Transaction progress and confirmation display
- `frontend/test/pages/landing.test.js` - Unit tests for landing page functionality
- `frontend/test/pages/strategy.test.js` - Unit tests for strategy builder page
- `frontend/test/pages/create.test.js` - Unit tests for create order page
- `frontend/test/pages/fill.test.js` - Unit tests for fill order page
- `frontend/test/utils/orderBuilder.test.js` - Unit tests for order building utilities
- `frontend/test/utils/extensions.test.js` - Unit tests for extension utilities
- `frontend/test/utils/encoding.test.js` - Unit tests for encoding utilities

## Tasks

- [x] 1.0 **Project Setup & Builder Integration**
  - [x] 1.2 Update `frontend/package.json` to include builder dependency: `"builder": "file:../builder"`
  - [x] 1.3 Configure Next.js to handle the builder package imports in `next.config.mjs`
  - [x] 1.4 Update TailwindCSS config with orange (#F97316) and green (#10B981) theme colors
  - [x] 1.5 Test builder package import and extension loading in a simple test component
  - [x] 1.6 Create utility modules for order building, extension management, and URL parameter encoding

- [x] 2.0 **Landing Page Implementation**
  - [x] 2.1 Create `frontend/app/page.js` with project logo, name "OPA" (extra-large), and multi-sentence description in the middle of the page
  - [x] 2.2 Add primary CTA button "Build a Strategy" linking to `/strategy` page
  - [x] 2.3 Add secondary CTA link to GitHub repository (opens in new tab)
  - [x] 2.4 Style landing page with TailwindCSS using orange/green theme
  - [x] 2.5 Ensure responsive design for mobile (sm) and desktop (lg) breakpoints
  - [x] 2.6 Add `frontend/public/landing-logo.png` logo image on the left from the "OPA" text

- [x] 3.0 **Strategy Builder Page Implementation**
  - [x] 3.1 Create `frontend/app/strategy/page.js` with extension selection interface
  - [x] 3.2 Import and list available extensions from `builder` (Gas Station, Chainlink Calculator, Dutch Auction Calculator, Range Amount Calculator)
  - [x] 3.3 Implement extension selection with checkbox/toggle interface
  - [x] 3.4 Add extension collision detection using builder API to prevent incompatible combinations
  - [x] 3.5 Display extension parameters for reference (read-only, no input collection at this stage)
  - [x] 3.6 Create submit button that serializes selected extensions to base64 JSON
  - [x] 3.7 Implement navigation to `/create?blueprint=...` with encoded extension data
  - [x] 3.8 Add error handling for extension conflicts with user-friendly messages

- [x] 4.0 **Create Order Page Implementation**
  - [x] 4.1 Create `frontend/app/create/page.js` with order parameter form
  - [x] 4.2 Parse `blueprint` query parameter and initialize builder instance
  - [x] 4.3 Handle missing `blueprint` parameter by creating simple order with no extensions
  - [x] 4.4 Render editable fields for core order parameters: makerAsset, makerAmount, takerAsset, takerAmount, receiver
  - [x] 4.5 Add fields for order traits: expiration, nonce, partial/multiple fill flags
  - [x] 4.6 Dynamically render extension-specific parameter fields based on blueprint
  - [x] 4.7 Integrate RainbowKit wallet connection with chainId and account detection
  - [x] 4.8 Enforce wallet connection before allowing order signing
  - [x] 4.9 Implement ERC-20 permit mockup for maker asset approval
  - [x] 4.10 Call `builder.build(signer, params)` on "Review & Sign" button click
  - [x] 4.11 Navigate to `/fill?order=...` with base64-encoded result (order struct, signature, extension data)
  - [x] 4.12 Add form validation and error handling for invalid parameters

- [x] 5.0 **Fill Order Page Implementation**
  - [x] 5.1 Create `frontend/app/fill/page.js` with order summary and execution interface
  - [x] 5.2 Parse required `order` query parameter and display order summary
  - [x] 5.3 Show assets, amounts, and strategy description in readable format
  - [x] 5.4 Detect taker wallet network and allow network switching if necessary
  - [x] 5.5 Implement Step 1: "Approve [Token]" button for ERC-20 `approve()` transaction
  - [x] 5.6 Implement Step 2: "Fill Order" button for LOP `fillOrder()` transaction with serialized order data
  - [x] 5.7 Add transaction progress indicators and loading states
  - [x] 5.8 Display success confirmation with Etherscan transaction link
  - [x] 5.9 Handle missing `order` parameter with appropriate error message
  - [x] 5.10 Add error handling for failed transactions with user-friendly messages

- [ ] 6.0 **Testing & Verification**
  - [ ] 6.1 Create unit tests for all utility functions (order building, extension management, encoding)
  - [ ] 6.2 Create integration tests for page navigation and data flow between pages
  - [ ] 6.3 Test wallet connection and network switching functionality
  - [ ] 6.4 Test order creation and signing with Gas Station extension on localhost mainnet fork
  - [ ] 6.5 Test complete maker-to-taker flow: strategy creation → order signing → order filling
  - [ ] 6.6 Verify base64 URL parameter encoding/decoding works correctly
  - [ ] 6.7 Test extension collision detection and error handling
  - [ ] 6.8 Verify responsive design on mobile and desktop breakpoints

- [ ] 7.0 **Documentation & Demo Preparation**
  - [ ] 7.1 Update `frontend/README.md` with setup instructions and project overview
  - [ ] 7.2 Document the complete user flow from landing page to order execution
  - [ ] 7.3 Create demo script for hackathon presentation
  - [ ] 7.4 [Human] Record demo video showing Gas Station order creation and filling
  - [ ] 7.5 Document known limitations and future enhancement opportunities
  - [ ] 7.6 Add inline code comments for complex logic and extension integration points
