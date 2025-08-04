import { bridgeAPIs } from './BridgeAPIs';

// Cost monitoring configuration
interface CostConfig {
  targetCostPerSwap: number; // $0.01-0.02 target
  maxCostPerSwap: number;    // $0.03 maximum
  optimizationThreshold: number; // 80% efficiency threshold
  monitoringInterval: number; // milliseconds
  alertThreshold: number;    // Alert when cost exceeds this
}

// Swap cost data
interface SwapCostData {
  swapId: string;
  userAddress: string;
  fromToken: string;
  toToken: string;
  amount: string;
  actualCost: number;
  targetCost: number;
  efficiency: number; // percentage
  bridgeUsed: string;
  timestamp: number;
  batchId?: string;
  optimizationTriggered: boolean;
}

// Cost statistics
interface CostStats {
  totalSwaps: number;
  averageCost: number;
  targetAchievement: number; // percentage of swaps under target
  totalSavings: number;
  costDistribution: {
    underTarget: number;
    atTarget: number;
    overTarget: number;
  };
  bridgePerformance: {
    [bridgeName: string]: {
      totalSwaps: number;
      averageCost: number;
      successRate: number;
    };
  };
}

// Optimization trigger
interface OptimizationTrigger {
  type: 'batch_size' | 'route_selection' | 'volume_discount' | 'gas_optimization';
  swapId: string;
  currentCost: number;
  targetCost: number;
  suggestedAction: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

/**
 * Real-Time Cost Monitoring Service
 * Tracks swap costs and triggers optimizations to maintain $0.01-0.02 target
 */
export class CostMonitor {
  private config: CostConfig;
  private swapCosts: Map<string, SwapCostData> = new Map();
  private optimizationTriggers: OptimizationTrigger[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config?: Partial<CostConfig>) {
    this.config = {
      targetCostPerSwap: 0.015, // $0.015 target (middle of $0.01-0.02 range)
      maxCostPerSwap: 0.03,     // $0.03 maximum
      optimizationThreshold: 0.8, // 80% efficiency
      monitoringInterval: 30000,  // 30 seconds
      alertThreshold: 0.025,      // Alert when cost exceeds $0.025
      ...config
    };
  }

  /**
   * Start cost monitoring
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.analyzeCosts();
    }, this.config.monitoringInterval);

    console.log('📊 Cost monitoring started');
  }

  /**
   * Stop cost monitoring
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('⏹️ Cost monitoring stopped');
  }

  /**
   * Track a completed swap
   */
  trackSwapCost(swapData: Omit<SwapCostData, 'efficiency' | 'timestamp' | 'optimizationTriggered'>): void {
    const efficiency = this.calculateEfficiency(swapData.actualCost, swapData.targetCost);
    
    const costData: SwapCostData = {
      ...swapData,
      efficiency,
      timestamp: Date.now(),
      optimizationTriggered: false
    };

    this.swapCosts.set(swapData.swapId, costData);

    // Check if optimization is needed
    if (efficiency < this.config.optimizationThreshold) {
      this.triggerOptimization(swapData.swapId, swapData.actualCost, swapData.targetCost);
    }

    // Alert if cost exceeds threshold
    if (swapData.actualCost > this.config.alertThreshold) {
      this.sendAlert(swapData.swapId, swapData.actualCost, swapData.targetCost);
    }

    console.log(`💰 Tracked swap ${swapData.swapId}: $${swapData.actualCost.toFixed(4)} (${efficiency.toFixed(1)}% efficient)`);
  }

  /**
   * Calculate efficiency percentage
   */
  private calculateEfficiency(actualCost: number, targetCost: number): number {
    if (actualCost <= targetCost) {
      return 100; // 100% efficient if under target
    }
    
    const efficiency = (targetCost / actualCost) * 100;
    return Math.max(0, efficiency); // Don't go below 0%
  }

  /**
   * Trigger optimization for a swap
   */
  private triggerOptimization(swapId: string, actualCost: number, targetCost: number): void {
    const optimization: OptimizationTrigger = {
      type: this.determineOptimizationType(actualCost, targetCost),
      swapId,
      currentCost: actualCost,
      targetCost,
      suggestedAction: this.getSuggestedAction(actualCost, targetCost),
      priority: this.determinePriority(actualCost, targetCost),
      timestamp: Date.now()
    };

    this.optimizationTriggers.push(optimization);
    
    // Mark swap as optimization triggered
    const swapData = this.swapCosts.get(swapId);
    if (swapData) {
      swapData.optimizationTriggered = true;
      this.swapCosts.set(swapId, swapData);
    }

    console.log(`🔧 Optimization triggered for swap ${swapId}: ${optimization.suggestedAction}`);
  }

  /**
   * Determine optimization type based on cost analysis
   */
  private determineOptimizationType(actualCost: number, targetCost: number): OptimizationTrigger['type'] {
    const costRatio = actualCost / targetCost;
    
    if (costRatio > 2) {
      return 'route_selection'; // Cost is more than 2x target
    } else if (costRatio > 1.5) {
      return 'batch_size'; // Cost is 1.5-2x target
    } else if (costRatio > 1.2) {
      return 'volume_discount'; // Cost is 1.2-1.5x target
    } else {
      return 'gas_optimization'; // Cost is 1-1.2x target
    }
  }

  /**
   * Get suggested action for optimization
   */
  private getSuggestedAction(actualCost: number, targetCost: number): string {
    const costRatio = actualCost / targetCost;
    
    if (costRatio > 2) {
      return 'Switch to cheaper bridge or L2 route';
    } else if (costRatio > 1.5) {
      return 'Increase batch size to reduce per-swap cost';
    } else if (costRatio > 1.2) {
      return 'Negotiate volume discounts with bridge providers';
    } else {
      return 'Optimize gas usage and transaction batching';
    }
  }

  /**
   * Determine optimization priority
   */
  private determinePriority(actualCost: number, targetCost: number): 'low' | 'medium' | 'high' {
    const costRatio = actualCost / targetCost;
    
    if (costRatio > 2) return 'high';
    if (costRatio > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Send alert for high-cost swaps
   */
  private sendAlert(swapId: string, actualCost: number, targetCost: number): void {
    const alert = {
      type: 'HIGH_COST_SWAP',
      swapId,
      actualCost,
      targetCost,
      timestamp: new Date().toISOString(),
      message: `Swap ${swapId} cost $${actualCost.toFixed(4)} exceeds alert threshold of $${this.config.alertThreshold}`
    };

    console.warn('🚨 COST ALERT:', alert.message);
    
    // In production, send to monitoring service (e.g., Sentry, DataDog)
    // this.sendToMonitoringService(alert);
  }

  /**
   * Analyze costs and generate statistics
   */
  private analyzeCosts(): void {
    const stats = this.getCostStats();
    
    // Log cost statistics
    console.log('📊 Cost Analysis:');
    console.log(`  Total Swaps: ${stats.totalSwaps}`);
    console.log(`  Average Cost: $${stats.averageCost.toFixed(4)}`);
    console.log(`  Target Achievement: ${stats.targetAchievement.toFixed(1)}%`);
    console.log(`  Total Savings: $${stats.totalSavings.toFixed(4)}`);

    // Check if overall performance is declining
    if (stats.targetAchievement < 80) {
      console.warn('⚠️ Overall cost performance is below 80% target achievement');
      this.triggerGlobalOptimization();
    }

    // Analyze bridge performance
    this.analyzeBridgePerformance(stats.bridgePerformance);
  }

  /**
   * Get comprehensive cost statistics
   */
  getCostStats(): CostStats {
    const swaps = Array.from(this.swapCosts.values());
    const totalSwaps = swaps.length;
    
    if (totalSwaps === 0) {
      return {
        totalSwaps: 0,
        averageCost: 0,
        targetAchievement: 100,
        totalSavings: 0,
        costDistribution: { underTarget: 0, atTarget: 0, overTarget: 0 },
        bridgePerformance: {}
      };
    }

    const totalCost = swaps.reduce((sum, swap) => sum + swap.actualCost, 0);
    const averageCost = totalCost / totalSwaps;
    
    const targetAchievement = (swaps.filter(swap => swap.actualCost <= this.config.targetCostPerSwap).length / totalSwaps) * 100;
    
    const totalSavings = swaps.reduce((sum, swap) => {
      const savings = Math.max(0, swap.targetCost - swap.actualCost);
      return sum + savings;
    }, 0);

    // Cost distribution
    const costDistribution = {
      underTarget: swaps.filter(swap => swap.actualCost < this.config.targetCostPerSwap).length,
      atTarget: swaps.filter(swap => swap.actualCost === this.config.targetCostPerSwap).length,
      overTarget: swaps.filter(swap => swap.actualCost > this.config.targetCostPerSwap).length
    };

    // Bridge performance
    const bridgePerformance: { [key: string]: any } = {};
    const bridgeGroups = this.groupSwapsByBridge(swaps);
    
    for (const [bridgeName, bridgeSwaps] of Array.from(bridgeGroups.entries())) {
      const bridgeTotalCost = bridgeSwaps.reduce((sum: number, swap: SwapCostData) => sum + swap.actualCost, 0);
      const bridgeAverageCost = bridgeTotalCost / bridgeSwaps.length;
      const bridgeSuccessRate = (bridgeSwaps.filter((swap: SwapCostData) => swap.actualCost <= this.config.targetCostPerSwap).length / bridgeSwaps.length) * 100;
      
      bridgePerformance[bridgeName] = {
        totalSwaps: bridgeSwaps.length,
        averageCost: bridgeAverageCost,
        successRate: bridgeSuccessRate
      };
    }

    return {
      totalSwaps,
      averageCost,
      targetAchievement,
      totalSavings,
      costDistribution,
      bridgePerformance
    };
  }

  /**
   * Group swaps by bridge
   */
  private groupSwapsByBridge(swaps: SwapCostData[]): Map<string, SwapCostData[]> {
    const groups = new Map<string, SwapCostData[]>();
    
    for (const swap of swaps) {
      if (!groups.has(swap.bridgeUsed)) {
        groups.set(swap.bridgeUsed, []);
      }
      groups.get(swap.bridgeUsed)!.push(swap);
    }
    
    return groups;
  }

  /**
   * Analyze bridge performance and suggest improvements
   */
  private analyzeBridgePerformance(bridgePerformance: { [key: string]: any }): void {
    console.log('🌉 Bridge Performance Analysis:');
    
    for (const [bridgeName, performance] of Object.entries(bridgePerformance)) {
      console.log(`  ${bridgeName}:`);
      console.log(`    Average Cost: $${performance.averageCost.toFixed(4)}`);
      console.log(`    Success Rate: ${performance.successRate.toFixed(1)}%`);
      
      // Suggest improvements
      if (performance.averageCost > this.config.targetCostPerSwap) {
        console.log(`    ⚠️ Consider negotiating volume discounts for ${bridgeName}`);
      }
      
      if (performance.successRate < 90) {
        console.log(`    ⚠️ ${bridgeName} has low success rate, consider alternative routes`);
      }
    }
  }

  /**
   * Trigger global optimization when overall performance is poor
   */
  private triggerGlobalOptimization(): void {
    const globalOptimization: OptimizationTrigger = {
      type: 'route_selection',
      swapId: 'GLOBAL',
      currentCost: this.getCostStats().averageCost,
      targetCost: this.config.targetCostPerSwap,
      suggestedAction: 'Review and optimize routing strategy across all bridges',
      priority: 'high',
      timestamp: Date.now()
    };

    this.optimizationTriggers.push(globalOptimization);
    console.log('🌍 Global optimization triggered due to poor cost performance');
  }

  /**
   * Get optimization triggers
   */
  getOptimizationTriggers(): OptimizationTrigger[] {
    return this.optimizationTriggers.filter(trigger => 
      trigger.timestamp > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
    );
  }

  /**
   * Get swap cost data
   */
  getSwapCost(swapId: string): SwapCostData | undefined {
    return this.swapCosts.get(swapId);
  }

  /**
   * Get recent swaps (last N hours)
   */
  getRecentSwaps(hours: number = 24): SwapCostData[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.swapCosts.values()).filter((swap: SwapCostData) => 
      swap.timestamp > cutoffTime
    );
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CostConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Cost monitoring configuration updated');
  }

  /**
   * Export cost data for analysis
   */
  exportCostData(): {
    swaps: SwapCostData[];
    stats: CostStats;
    optimizations: OptimizationTrigger[];
  } {
    return {
      swaps: Array.from(this.swapCosts.values()),
      stats: this.getCostStats(),
      optimizations: this.getOptimizationTriggers()
    };
  }

  /**
   * Clear old data (older than 30 days)
   */
  clearOldData(): void {
    const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    
    for (const [swapId, swapData] of Array.from(this.swapCosts.entries())) {
      if (swapData.timestamp < cutoffTime) {
        this.swapCosts.delete(swapId);
      }
    }
    
    this.optimizationTriggers = this.optimizationTriggers.filter(trigger => 
      trigger.timestamp > cutoffTime
    );
    
    console.log('🧹 Old cost data cleared');
  }
}

// Export singleton instance
export const costMonitor = new CostMonitor(); 