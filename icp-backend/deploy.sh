#!/bin/bash

# Dark Pool DEX ICP Backend Deployment Script

set -e

echo "🚀 Deploying Dark Pool DEX Backend to Internet Computer..."

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
    echo "❌ dfx not found. Please install dfx first:"
    echo "   sh -ci \"\$(curl -fsSL https://internetcomputer.org/install.sh)\""
    exit 1
fi

echo "✅ dfx found: $(dfx --version)"

# Check if we're in the right directory
if [ ! -f "dfx.json" ]; then
    echo "❌ dfx.json not found. Please run this script from the icp-backend directory."
    exit 1
fi

# Build the project
echo "🔨 Building project..."
dfx build

# Deploy to local network (for testing)
if [ "$1" = "local" ]; then
    echo "🌐 Deploying to local network..."
    dfx deploy --network local
    
    echo "✅ Deployment successful!"
    echo "📊 Canister ID: $(dfx canister id dark_pool_backend)"
    echo "🌐 Local URL: http://127.0.0.1:8000"
    
    echo ""
    echo "🧪 Testing deployment..."
    dfx canister call dark_pool_backend health
    dfx canister call dark_pool_backend getVersion
    
    echo ""
    echo "🎉 Local deployment complete!"
    echo "💡 To interact with your canister:"
    echo "   dfx canister call dark_pool_backend health"
    echo "   dfx canister call dark_pool_backend getOrderBook '(\"ETH/USDC\")'"

# Deploy to ICP mainnet
elif [ "$1" = "mainnet" ]; then
    echo "🌐 Deploying to ICP mainnet..."
    
    # Check if identity is set up
    if ! dfx identity whoami &> /dev/null; then
        echo "❌ No dfx identity found. Please set up your identity:"
        echo "   dfx identity new dark-pool-dex"
        echo "   dfx identity use dark-pool-dex"
        exit 1
    fi
    
    echo "👤 Using identity: $(dfx identity whoami)"
    
    # Deploy to mainnet
    dfx deploy --network ic
    
    echo "✅ Deployment successful!"
    echo "📊 Canister ID: $(dfx canister --network ic id dark_pool_backend)"
    echo "🌐 Mainnet URL: https://$(dfx canister --network ic id dark_pool_backend).ic0.app"
    
    echo ""
    echo "🧪 Testing deployment..."
    dfx canister --network ic call dark_pool_backend health
    dfx canister --network ic call dark_pool_backend getVersion
    
    echo ""
    echo "🎉 Mainnet deployment complete!"
    echo "💡 Your backend is now live on ICP!"

else
    echo "❌ Please specify deployment target:"
    echo "   ./deploy.sh local    - Deploy to local network"
    echo "   ./deploy.sh mainnet  - Deploy to ICP mainnet"
    exit 1
fi 