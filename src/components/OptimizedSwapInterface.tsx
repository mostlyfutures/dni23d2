import React, { useState, useEffect } from 'react';
import { batchingEngine } from '../services/BatchingEngine';
import { routingEngine } from '../services/RoutingEngine';

interface OptimizedSwapInterfaceProps {
  connectedAccount: string;
  walletProvider: string;
}

interface RouteOption {
  id: string;
  route: any;
  cost: number;
  time: number;
  confidence: number;
  description: string;
}

const OptimizedSwapInterface: React.FC<OptimizedSwapInterfaceProps> = ({
  connectedAccount,
  walletProvider
}) => {
  const [fromToken, setFromToken] = useState('QNT');
  const [toToken, setToToken] = useState('RENDER');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>('');
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [batchStats, setBatchStats] = useState<any>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);

  // Token options with chain information
  const tokenOptions = [
    { symbol: 'QNT', name: 'Quant', chain: 'Ethereum', icon: '🔗' },
    { symbol: 'RENDER', name: 'Render Token', chain: 'Polygon', icon: '🎨' },
    { symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', icon: '⚡' },
    { symbol: 'USDC', name: 'USD Coin', chain: 'Polygon', icon: '💵' },
    { symbol: 'MATIC', name: 'Polygon', chain: 'Polygon', icon: '🔷' },
    { symbol: 'ARB', name: 'Arbitrum', chain: 'Arbitrum', icon: '🔵' }
  ];

  useEffect(() => {
    // Start the batching engine
    batchingEngine.start();
    
    // Update batch stats every 5 seconds
    const statsInterval = setInterval(() => {
      setBatchStats(batchingEngine.getBatchStats());
    }, 5000);

    return () => {
      clearInterval(statsInterval);
      batchingEngine.stop();
    };
  }, []);

  // Find optimal routes when tokens or amount changes
  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      findOptimalRoutes();
    }
  }, [fromAmount, fromToken, toToken]);

  const findOptimalRoutes = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;

    setIsLoading(true);
    try {
      const amount = parseFloat(fromAmount);
      
      // Get route options with different volume tiers
      const lowVolumeRoutes = await routingEngine.findOptimalRoute(
        fromToken,
        toToken,
        amount,
        undefined,
        undefined,
        'low'
      );

      const mediumVolumeRoutes = await routingEngine.findOptimalRoute(
        fromToken,
        toToken,
        amount,
        undefined,
        undefined,
        'medium'
      );

      const highVolumeRoutes = await routingEngine.findOptimalRoute(
        fromToken,
        toToken,
        amount,
        undefined,
        undefined,
        'high'
      );

      // Combine and format route options
      const options: RouteOption[] = [
        ...lowVolumeRoutes.slice(0, 2).map((route, index) => ({
          id: `low-${index}`,
          route,
          cost: route.totalCost,
          time: route.estimatedTime,
          confidence: route.confidence,
          description: `Standard Route (${route.route.sourceChain.name} → ${route.route.targetChain.name})`
        })),
        ...mediumVolumeRoutes.slice(0, 1).map((route, index) => ({
          id: `medium-${index}`,
          route,
          cost: route.totalCost,
          time: route.estimatedTime,
          confidence: route.confidence,
          description: `Volume Discount Route (${route.route.sourceChain.name} → ${route.route.targetChain.name})`
        })),
        ...highVolumeRoutes.slice(0, 1).map((route, index) => ({
          id: `high-${index}`,
          route,
          cost: route.totalCost,
          time: route.estimatedTime,
          confidence: route.confidence,
          description: `Premium Route (${route.route.sourceChain.name} → ${route.route.targetChain.name})`
        }))
      ];

      // Sort by cost (lowest first)
      options.sort((a, b) => a.cost - b.cost);
      
      setRouteOptions(options);
      setSelectedRoute(options[0] || null);
      
      // Update estimates
      if (options[0]) {
        setEstimatedCost(options[0].cost);
        setEstimatedTime(options[0].time);
      }

    } catch (error) {
      console.error('Error finding routes:', error);
      setSwapStatus('Error finding optimal routes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedRoute || !fromAmount || !connectedAccount) {
      setSwapStatus('Please select a route and enter amount');
      return;
    }

    setIsLoading(true);
    setSwapStatus('Adding swap to batching queue...');

    try {
      const amount = parseFloat(fromAmount);
      
      // Add swap to batching engine
      const swapId = await batchingEngine.addSwapRequest({
        user: connectedAccount,
        fromToken,
        toToken,
        amount,
        priority: 'medium',
        maxCost: selectedRoute.cost * 1.1, // Allow 10% slippage
        maxWaitTime: 300000 // 5 minutes
      });

      setSwapStatus(`Swap queued! ID: ${swapId}. Waiting for batch execution...`);
      
      // Monitor swap status
      monitorSwapStatus(swapId);

    } catch (error) {
      console.error('Error adding swap:', error);
      setSwapStatus('Failed to add swap to queue');
    } finally {
      setIsLoading(false);
    }
  };

  const monitorSwapStatus = (swapId: string) => {
    const checkInterval = setInterval(() => {
      const pendingSwap = batchingEngine.getPendingSwap(swapId);
      
      if (!pendingSwap) {
        // Swap has been processed
        setSwapStatus('Swap completed! Check your wallet for tokens.');
        clearInterval(checkInterval);
      }
    }, 5000);

    // Stop monitoring after 10 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 600000);
  };

  const calculateBatchSavings = () => {
    if (!selectedRoute) return { savings: 0, costPerSwap: 0 };
    
    const individualCost = selectedRoute.cost;
    const batchSize = batchStats?.averageBatchSize || 25;
    
    return routingEngine.calculateBatchSavings(individualCost, batchSize);
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) {
      return `$${(cost * 1000).toFixed(1)}¢`; // Show in cents
    }
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 rounded-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Ultra-Low Cost Cross-Chain Swap</h2>
        <p className="text-gray-400">Achieve $0.01-0.02 per swap with intelligent batching and routing</p>
      </div>

      {/* Swap Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* From Token */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-300 mb-2">From</label>
          <div className="flex items-center space-x-3">
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
            >
              {tokenOptions.map(token => (
                <option key={token.symbol} value={token.symbol}>
                  {token.icon} {token.symbol} ({token.chain})
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="w-full mt-2 bg-gray-700 text-white rounded px-3 py-2"
          />
        </div>

        {/* To Token */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-300 mb-2">To</label>
          <div className="flex items-center space-x-3">
            <select
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
            >
              {tokenOptions.map(token => (
                <option key={token.symbol} value={token.symbol}>
                  {token.icon} {token.symbol} ({token.chain})
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            value={toAmount}
            readOnly
            placeholder="0.0"
            className="w-full mt-2 bg-gray-600 text-gray-400 rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Route Options */}
      {routeOptions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Optimal Routes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routeOptions.map((route) => (
              <div
                key={route.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedRoute?.id === route.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
                onClick={() => setSelectedRoute(route)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-gray-400">{route.description}</span>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    {Math.round(route.confidence * 100)}% reliable
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cost:</span>
                    <span className="text-green-400 font-semibold">{formatCost(route.cost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Time:</span>
                    <span className="text-blue-400">{formatTime(route.time)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Analysis */}
      {selectedRoute && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Cost Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Individual Cost</div>
              <div className="text-2xl font-bold text-red-400">{formatCost(selectedRoute.cost)}</div>
              <div className="text-xs text-gray-500">Without batching</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Batch Cost</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCost(calculateBatchSavings().costPerSwap)}
              </div>
              <div className="text-xs text-gray-500">With batching</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Savings</div>
              <div className="text-2xl font-bold text-cyan-400">
                {formatCost(calculateBatchSavings().savings)}
              </div>
              <div className="text-xs text-gray-500">Per swap</div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Statistics */}
      {batchStats && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Batch Engine Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400">{batchStats.pendingSwaps}</div>
              <div className="text-xs text-gray-400">Pending Swaps</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">{batchStats.activeBatches}</div>
              <div className="text-xs text-gray-400">Active Batches</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-cyan-400">{Math.round(batchStats.averageBatchSize)}</div>
              <div className="text-xs text-gray-400">Avg Batch Size</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-400">{formatCost(batchStats.averageCostPerSwap)}</div>
              <div className="text-xs text-gray-400">Avg Cost/Swap</div>
            </div>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <div className="text-center">
        <button
          onClick={handleSwap}
          disabled={isLoading || !selectedRoute || !fromAmount}
          className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all ${
            isLoading || !selectedRoute || !fromAmount
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
          }`}
        >
          {isLoading ? 'Processing...' : 'Execute Ultra-Low Cost Swap'}
        </button>
        
        {swapStatus && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-300">{swapStatus}</p>
          </div>
        )}
      </div>

      {/* Cost Comparison */}
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-white font-semibold mb-2">Cost Comparison</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uniswap (L1):</span>
              <span className="text-red-400">$5-20</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uniswap (L2):</span>
              <span className="text-yellow-400">$0.10-0.50</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <span className="text-gray-400">1inch:</span>
              <span className="text-yellow-400">$0.30-1.50</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-semibold">Our DEX:</span>
              <span className="text-green-400 font-semibold">$0.01-0.02</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedSwapInterface; 