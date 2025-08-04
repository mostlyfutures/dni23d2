# xx xxxx xxx Frontend

A modern, privacy-focused decentralized exchange frontend built with React and TypeScript. This project implements the zero-cost xxx xxx xxx architecture using xxxx xxx for private, encrypted trading.

## 🏗️ Architecture

This frontend is designed to work with the zero-cost xxx xxx xxx architecture that includes:

- **Frontend**: React/TypeScript static app (deployable to Vercel/Netlify/IPFS)
- **Smart Contracts**: xxx xxx xxx on xxx xxx
- **Privacy Layer**: Commit-Reveal scheme for encrypted orders
- **Order Storage**: IPFS/Arweave for decentralized order blobs
- **Zero Cost**: Free hosting and deployment

## 🎨 Design Features

- **Old-timey Middle Eastern Historic Logo**: Custom SVG design with Islamic geometric patterns
- **Glass Morphism UI**: Modern glass effect with backdrop blur
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Middle Eastern inspired color palette
- **Floating Background**: Animated blurred circles for liquidity effect

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dark-pool-dex-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
```

## 📁 Project Structure

```
src/
├── components/
│   ├── Header.tsx          # Header with logo and wallet
│   ├── Header.css
│   ├── Logo.tsx            # Middle Eastern historic logo
│   ├── Logo.css
│   ├── WalletButton.tsx    # Wallet connection button
│   ├── WalletButton.css
│   ├── SwapInterface.tsx   # Main swap interface
│   ├── SwapInterface.css
│   ├── TokenSelector.tsx   # Token selection dropdown
│   └── TokenSelector.css
├── App.tsx                 # Main app component
├── App.css
├── index.tsx              # React entry point
└── index.css              # Global styles
```

## 🎯 Key Components

### Header
- **Logo**: Old-timey Middle Eastern historic design with rotating geometric patterns
- **Wallet Button**: Connect/disconnect wallet with loading states

### Swap Interface
- **Token Selection**: Dropdown with popular tokens (ETH, USDC, USDT, etc.)
- **Amount Input**: Real-time conversion calculations
- **Swap Details**: Price impact, minimum received, network fees
- **Execute Button**: Private swap execution with loading states

### Design System
- **Color Palette**: Middle Eastern inspired (gold, sage green, warm orange)
- **Typography**: Inter font family
- **Animations**: Smooth transitions and hover effects
- **Glass Effect**: Backdrop blur with transparency

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_CONSTELLATION_RPC_URL=your_constellation_rpc_url
REACT_APP_CONTRACT_ADDRESS=your_xxxx_contract_address
REACT_APP_IPFS_GATEWAY=your_ipfs_gateway
```

### Customization

#### Colors
Modify the CSS custom properties in `src/index.css`:

```css
:root {
  --primary-gold: #d4af37;
  --secondary-gold: #b8860b;
  --deep-blue: #1e3a8a;
  --rich-purple: #581c87;
  --warm-orange: #ea580c;
  --sage-green: #65a30d;
}
```

#### Logo
Replace the SVG in `src/components/Logo.tsx` with your custom design.

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Deploy automatically on push to main branch

### Netlify
1. Build the project: `npm run build`
2. Upload the `build` folder to Netlify

### IPFS
1. Build the project: `npm run build`
2. Upload the `build` folder to IPFS using tools like Pinata

## 🔒 Privacy Features

- **Encrypted Orders**: All orders are encrypted before submission
- **Commit-Reveal Scheme**: Prevents front-running and order manipulation
- **Private Matching**: Order matching happens off-chain with privacy guarantees
- **Zero-Knowledge**: Uses ZK proofs where applicable

## 🛠️ Development

### Adding New Tokens

Edit the `tokens` array in `src/components/TokenSelector.tsx`:

```typescript
const tokens: Token[] = [
  { symbol: 'NEW', name: 'New Token', icon: '🆕' },
  // ... existing tokens
];
```

### Styling

The project uses CSS modules and custom properties. All styles are in the respective `.css` files for each component.

### State Management

Currently uses React hooks for local state. For larger applications, consider adding Redux or Zustand.

## 📱 Mobile Support

The interface is fully responsive and optimized for:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## 🔗 Integration

This frontend is designed to integrate with:
- Constellation DAG smart contracts
- IPFS/Arweave for order storage
- MetaMask/WalletConnect for wallet connections
- Off-chain matching engine

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- xxxx xxx team for the underlying technology
- Islamic geometric art for design inspiration
- React and TypeScript communities for excellent tooling 
