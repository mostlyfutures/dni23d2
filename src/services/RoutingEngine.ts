import { ethers } from 'ethers';

// Network configurations with cost data
interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  gasPrice: number; // in gwei
  bridgeFee: number; // in USD
  isActive: boolean;
  priority: number; // lower = higher priority
}

// Bridge configuration
interface BridgeConfig {
  name: string;
  sourceChainId: number;
  targetChainId: number;
  fee: number; // in USD
  estimatedTime: number; // in minutes
  isActive: boolean;
  volumeDiscount: number; // percentage discount for high volume
}

// Route calculation result
interface RouteResult {
  route: Route;
  totalCost: number;
  estimatedTime: number;
  confidence: number; // 0-1
  gasEstimate: number;
  bridgeFees: number;
}

// Route definition
interface Route {
  sourceChain: NetworkConfig;
  targetChain: NetworkConfig;
  bridge: BridgeConfig;
  steps: RouteStep[];
}

// Individual route step
interface RouteStep {
  type: 'deposit' | 'bridge' | 'withdraw' | 'swap';
  chainId: number;
  estimatedGas: number;
  estimatedCost: number;
  description: string;
}

// Price data for tokens
interface TokenPrice {
  symbol: string;
  price: number;
  chainId: number;
  lastUpdated: number;
}

/**
 * Efficient Routing Engine for Cross-Chain Swaps
 * Dynamically selects the lowest-cost route for any crypto-to-crypto swap
 */
export class RoutingEngine {
  private networks: Map<number, NetworkConfig> = new Map();
  private bridges: BridgeConfig[] = [];
  private tokenPrices: Map<string, TokenPrice> = new Map();
  private gasPriceCache: Map<number, { price: number; timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  constructor() {
    this.initializeNetworks();
    this.initializeBridges();
  }

  /**
   * Initialize supported networks with cost data
   */
  private initializeNetworks(): void {
    const networkConfigs: NetworkConfig[] = [
      // L2s and Sidechains (Low Cost)
      {
        chainId: 137, // Polygon
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
        gasPrice: 30, // ~$0.001-0.01
        bridgeFee: 0.01,
        isActive: true,
        priority: 1
      },
      {
        chainId: 42161, // Arbitrum
        name: 'Arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        gasPrice: 0.1, // ~$0.001-0.005
        bridgeFee: 0.01,
        isActive: true,
        priority: 2
      },
      {
        chainId: 10, // Optimism
        name: 'Optimism',
        rpcUrl: 'https://mainnet.optimism.io',
        gasPrice: 0.001, // ~$0.001-0.003
        bridgeFee: 0.01,
        isActive: true,
        priority: 3
      },
      {
        chainId: 56, // BSC
        name: 'BSC',
        rpcUrl: 'https://bsc-dataseed.binance.org',
        gasPrice: 5, // ~$0.001-0.005
        bridgeFee: 0.005,
        isActive: true,
        priority: 4
      },
      // Constellation DAG (Zero Cost)
      {
        chainId: 13939, // Constellation (example)
        name: 'Constellation DAG',
        rpcUrl: 'https://dag.constellationnetwork.io',
        gasPrice: 0, // Free
        bridgeFee: 0,
        isActive: true,
        priority: 0 // Highest priority
      },
      // Ethereum L1 (High Cost - Avoid)
      {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
        gasPrice: 20, // ~$5-20
        bridgeFee: 0.05,
        isActive: true,
        priority: 10 // Lowest priority
      }
    ];

    networkConfigs.forEach(network => {
      this.networks.set(network.chainId, network);
    });
  }

  /**
   * Initialize bridge configurations
   */
  private initializeBridges(): void {
    this.bridges = [
      // Low-cost bridges
      {
        name: 'Multichain',
        sourceChainId: 137,
        targetChainId: 42161,
        fee: 0.01,
        estimatedTime: 5,
        isActive: true,
        volumeDiscount: 0.2 // 20% discount for high volume
      },
      {
        name: 'Stargate',
        sourceChainId: 137,
        targetChainId: 10,
        fee: 0.015,
        estimatedTime: 3,
        isActive: true,
        volumeDiscount: 0.15
      },
      {
        name: 'LayerZero',
        sourceChainId: 42161,
        targetChainId: 10,
        fee: 0.012,
        estimatedTime: 2,
        isActive: true,
        volumeDiscount: 0.25
      },
      // Constellation bridges (free)
      {
        name: 'Constellation Bridge',
        sourceChainId: 137,
        targetChainId: 13939,
        fee: 0,
        estimatedTime: 1,
        isActive: true,
        volumeDiscount: 0
      },
      {
        name: 'Constellation Bridge',
        sourceChainId: 42161,
        targetChainId: 13939,
        fee: 0,
        estimatedTime: 1,
        isActive: true,
        volumeDiscount: 0
      }
    ];
  }

  /**
   * Find the optimal route for a cross-chain swap
   * @param fromToken Source token symbol
   * @param toToken Target token symbol
   * @param amount Amount to swap
   * @param fromChainId Source chain ID
   * @param toChainId Target chain ID
   * @param volumeTier Volume tier for discounts
   */
  async findOptimalRoute(
    fromToken: string,
    toToken: string,
    amount: number,
    fromChainId?: number,
    toChainId?: number,
    volumeTier: 'low' | 'medium' | 'high' = 'low'
  ): Promise<RouteResult[]> {
    // Update gas prices
    await this.updateGasPrices();

    // Get available routes
    const routes = this.generateRoutes(fromToken, toToken, fromChainId, toChainId);
    
    // Calculate costs for each route
    const routeResults: RouteResult[] = [];
    
    for (const route of routes) {
      const result = await this.calculateRouteCost(route, amount, volumeTier);
      routeResults.push(result);
    }

    // Sort by total cost (lowest first)
    routeResults.sort((a, b) => a.totalCost - b.totalCost);

    return routeResults;
  }

  /**
   * Generate all possible routes between chains
   */
  private generateRoutes(
    fromToken: string,
    toToken: string,
    fromChainId?: number,
    toChainId?: number
  ): Route[] {
    const routes: Route[] = [];
    const sourceChains = fromChainId ? [this.networks.get(fromChainId)] : Array.from(this.networks.values());
    const targetChains = toChainId ? [this.networks.get(toChainId)] : Array.from(this.networks.values());

    for (const sourceChain of sourceChains) {
      if (!sourceChain?.isActive) continue;
      
      for (const targetChain of targetChains) {
        if (!targetChain?.isActive || sourceChain.chainId === targetChain.chainId) continue;

        // Find bridges between these chains
        const availableBridges = this.bridges.filter(bridge => 
          bridge.isActive &&
          bridge.sourceChainId === sourceChain.chainId &&
          bridge.targetChainId === targetChain.chainId
        );

        for (const bridge of availableBridges) {
          const route: Route = {
            sourceChain,
            targetChain,
            bridge,
            steps: this.generateRouteSteps(sourceChain, targetChain, bridge)
          };
          routes.push(route);
        }
      }
    }

    return routes;
  }

  /**
   * Generate steps for a route
   */
  private generateRouteSteps(sourceChain: NetworkConfig, targetChain: NetworkConfig, bridge: BridgeConfig): RouteStep[] {
    const steps: RouteStep[] = [];

    // Step 1: Deposit on source chain
    steps.push({
      type: 'deposit',
      chainId: sourceChain.chainId,
      estimatedGas: 65000, // Standard ERC20 transfer
      estimatedCost: this.calculateGasCost(sourceChain.gasPrice, 65000),
      description: `Deposit on ${sourceChain.name}`
    });

    // Step 2: Bridge transfer
    steps.push({
      type: 'bridge',
      chainId: sourceChain.chainId,
      estimatedGas: 100000, // Bridge interaction
      estimatedCost: bridge.fee,
      description: `Bridge via ${bridge.name}`
    });

    // Step 3: Withdraw on target chain
    steps.push({
      type: 'withdraw',
      chainId: targetChain.chainId,
      estimatedGas: 65000,
      estimatedCost: this.calculateGasCost(targetChain.gasPrice, 65000),
      description: `Withdraw on ${targetChain.name}`
    });

    return steps;
  }

  /**
   * Calculate total cost for a route
   */
  private async calculateRouteCost(route: Route, amount: number, volumeTier: string): Promise<RouteResult> {
    let totalCost = 0;
    let totalTime = 0;
    let gasEstimate = 0;
    let bridgeFees = 0;

    // Apply volume discounts
    const volumeDiscount = this.getVolumeDiscount(volumeTier);
    const discountedBridgeFee = route.bridge.fee * (1 - volumeDiscount);

    for (const step of route.steps) {
      gasEstimate += step.estimatedGas;
      
      if (step.type === 'bridge') {
        bridgeFees += discountedBridgeFee;
        totalCost += discountedBridgeFee;
        totalTime += route.bridge.estimatedTime;
      } else {
        totalCost += step.estimatedCost;
        totalTime += 1; // 1 minute per on-chain operation
      }
    }

    // Calculate confidence based on network reliability
    const confidence = this.calculateConfidence(route);

    return {
      route,
      totalCost,
      estimatedTime: totalTime,
      confidence,
      gasEstimate,
      bridgeFees
    };
  }

  /**
   * Calculate gas cost in USD
   */
  private calculateGasCost(gasPriceGwei: number, gasUsed: number): number {
    const ethPrice = 2000; // USD per ETH (should be fetched from API)
    const gasPriceEth = gasPriceGwei / 1e9;
    const gasUsedEth = gasPriceEth * gasUsed;
    return gasUsedEth * ethPrice;
  }

  /**
   * Get volume discount percentage
   */
  private getVolumeDiscount(volumeTier: string): number {
    switch (volumeTier) {
      case 'high': return 0.3; // 30% discount
      case 'medium': return 0.15; // 15% discount
      case 'low': return 0; // No discount
      default: return 0;
    }
  }

  /**
   * Calculate route confidence based on network reliability
   */
  private calculateConfidence(route: Route): number {
    let confidence = 1.0;

    // Reduce confidence for high-cost networks
    if (route.sourceChain.priority > 5) confidence *= 0.8;
    if (route.targetChain.priority > 5) confidence *= 0.8;

    // Increase confidence for Constellation routes
    if (route.sourceChain.chainId === 13939 || route.targetChain.chainId === 13939) {
      confidence *= 1.2;
    }

    // Reduce confidence for longer routes
    if (route.steps.length > 3) confidence *= 0.9;

    return Math.min(confidence, 1.0);
  }

  /**
   * Update gas prices from network providers
   */
  private async updateGasPrices(): Promise<void> {
    const now = Date.now();
    
    for (const [chainId, network] of Array.from(this.networks.entries())) {
      const cached = this.gasPriceCache.get(chainId);
      
      // Skip if cache is still valid
      if (cached && (now - cached.timestamp) < this.cacheTimeout) {
        continue;
      }

      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const feeData = await provider.getFeeData();
        const gasPrice = Number(ethers.formatUnits(feeData.gasPrice || 0, 'gwei'));
        
        this.gasPriceCache.set(chainId, {
          price: gasPrice,
          timestamp: now
        });

        // Update network config with current gas price
        network.gasPrice = gasPrice;
      } catch (error) {
        console.warn(`Failed to update gas price for chain ${chainId}:`, error);
      }
    }
  }

  /**
   * Get current gas price for a chain
   */
  async getGasPrice(chainId: number): Promise<number> {
    await this.updateGasPrices();
    return this.gasPriceCache.get(chainId)?.price || 0;
  }

  /**
   * Get all supported networks
   */
  getSupportedNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values()).filter(n => n.isActive);
  }

  /**
   * Get all available bridges
   */
  getAvailableBridges(): BridgeConfig[] {
    return this.bridges.filter(b => b.isActive);
  }

  /**
   * Calculate batch cost savings
   */
  calculateBatchSavings(
    individualCost: number,
    batchSize: number,
    batchOverhead: number = 0.05 // 5% overhead for batching
  ): { savings: number; costPerSwap: number } {
    const totalIndividualCost = individualCost * batchSize;
    const batchCost = (individualCost * batchSize * (1 + batchOverhead)) / batchSize;
    const savings = totalIndividualCost - (batchCost * batchSize);
    
    return {
      savings,
      costPerSwap: batchCost
    };
  }

  /**
   * Get recommended route for a swap
   */
  async getRecommendedRoute(
    fromToken: string,
    toToken: string,
    amount: number,
    preferences: {
      maxCost?: number;
      maxTime?: number;
      preferL2?: boolean;
      volumeTier?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<RouteResult | null> {
    const routes = await this.findOptimalRoute(
      fromToken,
      toToken,
      amount,
      undefined,
      undefined,
      preferences.volumeTier
    );

    if (routes.length === 0) return null;

    // Filter by preferences
    let filteredRoutes = routes;

    if (preferences.maxCost) {
      filteredRoutes = filteredRoutes.filter(r => r.totalCost <= preferences.maxCost!);
    }

    if (preferences.maxTime) {
      filteredRoutes = filteredRoutes.filter(r => r.estimatedTime <= preferences.maxTime!);
    }

    if (preferences.preferL2) {
      filteredRoutes = filteredRoutes.filter(r => 
        r.route.sourceChain.priority <= 5 && r.route.targetChain.priority <= 5
      );
    }

    return filteredRoutes[0] || null;
  }
}

// Export singleton instance
export const routingEngine = new RoutingEngine(); 