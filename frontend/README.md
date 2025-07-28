# Web3 App - Next.js + RainbowKit + Wagmi + TailwindCSS

A modern Web3 application template built with the latest React and Ethereum development tools.

## 🚀 Features

- **Next.js 15** with App Router
- **RainbowKit** for beautiful wallet connections
- **Wagmi** for Ethereum interactions
- **TailwindCSS** for styling
- **React Query** for data fetching
- **Multi-chain support** (Ethereum, Polygon, Optimism, Arbitrum, Base, Sepolia)

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Web3 wallet (MetaMask, WalletConnect, etc.)

### Installation

The project is already set up and ready to run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Configuration

#### WalletConnect Project ID

For production use, you'll need to:

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Copy your Project ID
4. Replace `YOUR_PROJECT_ID` in `app/wagmi.js` with your actual Project ID

```javascript
// app/wagmi.js
export const config = getDefaultConfig({
  appName: 'My RainbowKit App',
  projectId: 'your-actual-project-id-here', // Replace this
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  ssr: true,
});
```

## 📁 Project Structure

```
app/
├── layout.js          # Root layout with providers
├── page.js            # Main page with wallet connection
├── providers.js       # RainbowKit & Wagmi providers
├── wagmi.js          # Wagmi configuration
└── globals.css       # Global styles with RainbowKit CSS
```

## 🔧 Key Components

### Providers Setup

The app is wrapped with necessary providers in `app/providers.js`:

- WagmiProvider for Ethereum functionality
- QueryClientProvider for data fetching
- RainbowKitProvider for wallet UI

### Wallet Connection

The main page demonstrates:

- Wallet connection with RainbowKit's ConnectButton
- Account information display
- Balance fetching
- Responsive design with dark mode support

## 🌐 Supported Networks

- Ethereum Mainnet
- Polygon
- Optimism
- Arbitrum
- Base
- Sepolia (testnet)

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [RainbowKit Documentation](https://rainbowkit.com)
- [Wagmi Documentation](https://wagmi.sh)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

## 🚀 Deployment

The app can be deployed on Vercel, Netlify, or any platform that supports Next.js:

```bash
npm run build
npm start
```

For Vercel deployment:

```bash
npx vercel
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
