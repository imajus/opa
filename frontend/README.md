# OPA Frontend - Order Protocol Assistant

A comprehensive frontend application for creating and managing sophisticated limit orders using 1inch's Limit Order Protocol with advanced extensions.

## 🎯 Overview

OPA (Order Protocol Assistant) empowers traders to create sophisticated limit orders using 1inch's Limit Order Protocol extensions. Build custom trading strategies with gas stations, dynamic pricing, dutch auctions, and flexible amount ranges - all through an intuitive interface.

## 🚀 Features

### Core Functionality

- **Strategy Builder**: Visual interface for selecting and configuring LOP extensions
- **Order Creation**: Comprehensive form for limit order parameters
- **Order Execution**: Two-step process for token approval and order filling
- **Extension Support**: Gas Station, Chainlink Calculator, Dutch Auction, Range Amount

### Technical Features

- **Next.js 15** with App Router and React 19
- **RainbowKit** for beautiful wallet connections
- **Wagmi** for Ethereum interactions
- **TailwindCSS v4** with custom orange/green theme
- **1inch LOP SDK** integration via opa-builder package
- **Base64 URL encoding** for strategy and order data

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Web3 wallet (MetaMask, WalletConnect, etc.)
- Access to the `opa-builder` package (symlinked from `../builder`)

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up the builder package** (should already be symlinked):

   ```bash
   # The package.json already includes: "opa-builder": "file:../builder"
   # This creates a symlink to the builder package
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Configuration

#### WalletConnect Project ID

For production use, update the Project ID in `app/wagmi.js`:

```javascript
export const config = getDefaultConfig({
  appName: 'OPA - Order Protocol Assistant',
  projectId: 'your-walletconnect-project-id',
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  ssr: true,
});
```

## 📁 Project Structure

```
frontend/
├── app/
│   ├── layout.js              # Root layout with RainbowKit providers
│   ├── page.js                # Landing page with OPA branding
│   ├── providers.js           # Web3 providers configuration
│   ├── wagmi.js              # Wagmi configuration
│   ├── globals.css           # Global styles with theme colors
│   ├── strategy/
│   │   └── page.js           # Strategy builder for extension selection
│   ├── create/
│   │   └── page.js           # Order creation form with wallet integration
│   └── fill/
│       └── page.js           # Order execution interface
├── lib/
│   └── utils/
│       ├── encoding.js       # Base64 URL parameter encoding/decoding
│       ├── extensions.js     # Extension management and validation
│       └── ethers.js         # Ethers.js signer utilities
└── public/
    └── landing-logo.png      # OPA logo
```

## 🔧 User Journey

### 1. Landing Page (`/`)

- Project introduction and feature overview
- Primary CTA: "Build a Strategy" → `/strategy`
- Secondary CTA: GitHub repository link

### 2. Strategy Builder (`/strategy`)

- Select from available LOP extensions:
  - **Gas Station**: Pay gas fees with alternative tokens
  - **Chainlink Calculator**: Dynamic pricing based on oracle feeds
  - **Dutch Auction Calculator**: Time-based decreasing price
  - **Range Amount Calculator**: Flexible partial fill amounts
- Extension conflict detection and warnings
- Base64 encoding of strategy → `/create?blueprint=...`

### 3. Order Creation (`/create`)

- Wallet connection with RainbowKit
- Order parameter form:
  - Core parameters: maker/taker assets and amounts
  - Order traits: expiration, nonce, fill options
  - Extension-specific parameters (dynamic based on strategy)
- Form validation and error handling
- Order building and signing → `/fill?order=...`

### 4. Order Execution (`/fill`)

- Order summary with readable asset information
- Two-step execution process:
  1. **Token Approval**: ERC-20 approve transaction
  2. **Order Fill**: LOP fillOrder transaction
- Transaction progress indicators
- Success confirmation with blockchain explorer links

## 🧩 Extension System

### Available Extensions

1. **Gas Station**
   - **Purpose**: Pay gas fees with any ERC-20 token instead of ETH
   - **Parameters**: Gas token address, gas price
   - **Hook Type**: Pre-interaction

2. **Chainlink Calculator**
   - **Purpose**: Dynamic pricing based on Chainlink price feeds
   - **Parameters**: Price feed address, base amount
   - **Hook Type**: Maker amount

3. **Dutch Auction Calculator**
   - **Purpose**: Time-based decreasing price auction
   - **Parameters**: Start price, end price, duration
   - **Hook Type**: Taker amount

4. **Range Amount Calculator**
   - **Purpose**: Flexible amount ranges for partial fills
   - **Parameters**: Minimum amount, maximum amount
   - **Hook Type**: Maker amount

### Extension Conflict Detection

The system automatically detects and prevents:

- Multiple pricing extensions (only one allowed)
- Hook type collisions with user-friendly warnings
- Parameter validation for each extension type

## 🔗 Integration with OPA Builder

The frontend integrates with the `opa-builder` package for:

- Extension management and initialization
- Order building with the OrderBuilder API
- Hook collision detection
- Parameter validation

Example usage:

```javascript
import { OrderBuilder, extensions, HookType } from 'opa-builder/lib';

// Create order builder
const builder = new OrderBuilder(
  makerAsset,
  makerAmount,
  takerAsset,
  takerAmount
);

// Add extensions
builder.addExtension(extensions.gasStation);

// Build and sign
const result = await builder.build(signer, extensionParameters);
```

## 🎨 Design System

### Theme Colors

- **Primary Orange**: `#F97316` (actions, CTAs)
- **Primary Green**: `#10B981` (success, confirmations)
- **Background**: Gradient from orange-50 to green-50

### Component Patterns

- Rounded corners (`rounded-xl`, `rounded-lg`)
- Subtle shadows (`shadow-sm`, `shadow-md`)
- Consistent spacing using Tailwind's spacing scale
- Responsive design with mobile-first approach

## 🌐 Supported Networks

- Ethereum Mainnet (primary target)
- Sepolia Testnet (for development)
- Network switching handled automatically by RainbowKit

## 🧪 Development

### Running Tests

```bash
# Currently no test scripts configured
# Tests would be added in Task 6.0 (skipped for hackathon)
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
npm start
```

## 📚 Technical Documentation

- [1inch Limit Order Protocol](https://docs.1inch.io/docs/limit-order-protocol)
- [Next.js Documentation](https://nextjs.org/docs)
- [RainbowKit Documentation](https://rainbowkit.com)
- [Wagmi Documentation](https://wagmi.sh)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

## 🚀 Deployment

### Vercel (Recommended)

```bash
npx vercel
```

### Manual Deployment

```bash
npm run build
# Deploy the .next folder to your hosting platform
```

### Environment Variables

For production deployment, ensure:

- WalletConnect Project ID is configured
- Builder package is properly bundled
- Network configurations match your target chains

## 🤝 Contributing

This project was built for a hackathon demonstration. For production use:

1. Add comprehensive test suite
2. Implement real ERC-20 and LOP contract interactions
3. Add error boundary components
4. Implement proper transaction state management
5. Add token symbol resolution for better UX

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
