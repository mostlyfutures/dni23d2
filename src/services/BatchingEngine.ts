import { routingEngine } from './RoutingEngine';

// Batch configuration
interface BatchConfig {
  minBatchSize: number;
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  maxWaitTime: number; // milliseconds
  costThreshold: number; // USD
}

// Pending swap request
interface PendingSwap {
  id: string;
  user: string;
  fromToken: string;
  toToken: string;
  amount: number;
  fromChainId?: number;
  toChainId?: number;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
  maxCost?: number;
  maxWaitTime?: number;
}

// Batch of swaps
interface SwapBatch {
  id: string;
  swaps: PendingSwap[];
  route: any; // RouteResult from RoutingEngine
  totalAmount: number;
  estimatedCost: number;
  costPerSwap: number;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  batchSize: number;
}

// Batch execution result
interface BatchExecutionResult {
  batchId: string;
  successfulSwaps: number;
  failedSwaps: number;
  totalCost: number;
  costPerSwap: number;
  executionTime: number;
  errors: string[];
}

/**
 * Off-Chain Batching Engine
 * Groups multiple swaps into batches to minimize transaction costs
 */
export class BatchingEngine {
  private pendingSwaps: Map<string, PendingSwap> = new Map();
  private activeBatches: Map<string, SwapBatch> = new Map();
  private batchConfig: BatchConfig;
  private batchInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config?: Partial<BatchConfig>) {
    this.batchConfig = {
      minBatchSize: 5,
      maxBatchSize: 100,
      batchTimeout: 60000, // 1 minute
      maxWaitTime: 300000, // 5 minutes
      costThreshold: 0.02, // $0.02 per swap target
      ...config
    };
  }

  /**
   * Start the batching engine
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.batchInterval = setInterval(() => {
      this.processBatches();
    }, 10000); // Check every 10 seconds

    console.log('🚀 Batching engine started');
  }

  /**
   * Stop the batching engine
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    console.log('⏹️ Batching engine stopped');
  }

  /**
   * Add a swap request to the batching queue
   */
  async addSwapRequest(swap: Omit<PendingSwap, 'id' | 'timestamp'>): Promise<string> {
    const id = this.generateSwapId();
    const pendingSwap: PendingSwap = {
      ...swap,
      id,
      timestamp: Date.now()
    };

    this.pendingSwaps.set(id, pendingSwap);
    
    console.log(`📝 Added swap request ${id} to batching queue`);
    
    // Check if we can create a batch immediately
    await this.tryCreateBatch();
    
    return id;
  }

  /**
   * Process pending batches
   */
  private async processBatches(): Promise<void> {
    // Check for expired batches
    this.cleanupExpiredBatches();
    
    // Try to create new batches
    await this.tryCreateBatch();
    
    // Process active batches
    await this.processActiveBatches();
  }

  /**
   * Try to create a new batch from pending swaps
   */
  private async tryCreateBatch(): Promise<void> {
    const pendingSwaps = Array.from(this.pendingSwaps.values());
    
    if (pendingSwaps.length < this.batchConfig.minBatchSize) {
      return;
    }

    // Group swaps by route (same from/to tokens and chains)
    const swapGroups = this.groupSwapsByRoute(pendingSwaps);
    
    for (const [routeKey, swaps] of Array.from(swapGroups.entries())) {
      if (swaps.length >= this.batchConfig.minBatchSize) {
        await this.createBatch(swaps, routeKey);
      }
    }
  }

  /**
   * Group swaps by their route
   */
  private groupSwapsByRoute(swaps: PendingSwap[]): Map<string, PendingSwap[]> {
    const groups = new Map<string, PendingSwap[]>();
    
    for (const swap of swaps) {
      const routeKey = this.getRouteKey(swap);
      
      if (!groups.has(routeKey)) {
        groups.set(routeKey, []);
      }
      groups.get(routeKey)!.push(swap);
    }
    
    return groups;
  }

  /**
   * Generate route key for grouping
   */
  private getRouteKey(swap: PendingSwap): string {
    return `${swap.fromToken}-${swap.toToken}-${swap.fromChainId || 'any'}-${swap.toChainId || 'any'}`;
  }

  /**
   * Create a new batch
   */
  private async createBatch(swaps: PendingSwap[], routeKey: string): Promise<void> {
    // Limit batch size
    const batchSwaps = swaps.slice(0, this.batchConfig.maxBatchSize);
    
    // Calculate total amount
    const totalAmount = batchSwaps.reduce((sum, swap) => sum + swap.amount, 0);
    
    // Find optimal route for the batch
    const route = await routingEngine.getRecommendedRoute(
      batchSwaps[0].fromToken,
      batchSwaps[0].toToken,
      totalAmount,
      {
        preferL2: true,
        volumeTier: this.getVolumeTier(batchSwaps.length)
      }
    );

    if (!route) {
      console.warn(`❌ No route found for batch ${routeKey}`);
      return;
    }

    // Calculate costs
    const totalCost = route.totalCost;
    const costPerSwap = totalCost / batchSwaps.length;
    
    // Check if cost meets threshold
    if (costPerSwap > this.batchConfig.costThreshold) {
      console.warn(`⚠️ Batch cost per swap ($${costPerSwap.toFixed(4)}) exceeds threshold ($${this.batchConfig.costThreshold})`);
    }

    const batchId = this.generateBatchId();
    const batch: SwapBatch = {
      id: batchId,
      swaps: batchSwaps,
      route,
      totalAmount,
      estimatedCost: totalCost,
      costPerSwap,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.batchConfig.batchTimeout,
      status: 'pending',
      batchSize: batchSwaps.length
    };

    this.activeBatches.set(batchId, batch);
    
    // Remove swaps from pending queue
    for (const swap of batchSwaps) {
      this.pendingSwaps.delete(swap.id);
    }

    console.log(`📦 Created batch ${batchId} with ${batchSwaps.length} swaps, cost per swap: $${costPerSwap.toFixed(4)}`);
    
    // Emit batch created event
    this.emitBatchCreated(batch);
  }

  /**
   * Process active batches
   */
  private async processActiveBatches(): Promise<void> {
    for (const [batchId, batch] of Array.from(this.activeBatches.entries())) {
      if (batch.status === 'pending' && this.shouldExecuteBatch(batch)) {
        await this.executeBatch(batch);
      }
    }
  }

  /**
   * Check if batch should be executed
   */
  private shouldExecuteBatch(batch: SwapBatch): boolean {
    const now = Date.now();
    
    // Execute if batch is full
    if (batch.batchSize >= this.batchConfig.maxBatchSize) {
      return true;
    }
    
    // Execute if batch has been waiting too long
    if (now - batch.createdAt >= this.batchConfig.maxWaitTime) {
      return true;
    }
    
    // Execute if cost is acceptable
    if (batch.costPerSwap <= this.batchConfig.costThreshold) {
      return true;
    }
    
    return false;
  }

  /**
   * Execute a batch
   */
  private async executeBatch(batch: SwapBatch): Promise<void> {
    console.log(`⚡ Executing batch ${batch.id} with ${batch.swaps.length} swaps`);
    
    batch.status = 'processing';
    
    try {
      const startTime = Date.now();
      
      // Simulate batch execution (replace with actual bridge calls)
      const result = await this.executeBatchOnChain(batch);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ Batch ${batch.id} executed successfully in ${executionTime}ms`);
      console.log(`💰 Cost per swap: $${result.costPerSwap.toFixed(4)}`);
      
      batch.status = 'completed';
      
      // Emit batch completed event
      this.emitBatchCompleted(batch, result);
      
    } catch (error) {
      console.error(`❌ Batch ${batch.id} execution failed:`, error);
      batch.status = 'failed';
      
      // Return swaps to pending queue
      for (const swap of batch.swaps) {
        this.pendingSwaps.set(swap.id, swap);
      }
      
      // Emit batch failed event
      this.emitBatchFailed(batch, error as Error);
    }
  }

  /**
   * Execute batch on-chain (simulated)
   */
  private async executeBatchOnChain(batch: SwapBatch): Promise<BatchExecutionResult> {
    // Simulate on-chain execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate some swaps failing
    const failedCount = Math.floor(Math.random() * 3); // 0-2 failures
    const successfulCount = batch.swaps.length - failedCount;
    
    return {
      batchId: batch.id,
      successfulSwaps: successfulCount,
      failedSwaps: failedCount,
      totalCost: batch.estimatedCost,
      costPerSwap: batch.costPerSwap,
      executionTime: 2000,
      errors: failedCount > 0 ? ['Simulated failure'] : []
    };
  }

  /**
   * Clean up expired batches
   */
  private cleanupExpiredBatches(): void {
    const now = Date.now();
    
    for (const [batchId, batch] of Array.from(this.activeBatches.entries())) {
      if (batch.status === 'pending' && now > batch.expiresAt) {
        console.log(`⏰ Batch ${batchId} expired, returning swaps to queue`);
        
        // Return swaps to pending queue
        for (const swap of batch.swaps) {
          this.pendingSwaps.set(swap.id, swap);
        }
        
        this.activeBatches.delete(batchId);
      }
    }
  }

  /**
   * Get volume tier based on batch size
   */
  private getVolumeTier(batchSize: number): 'low' | 'medium' | 'high' {
    if (batchSize >= 50) return 'high';
    if (batchSize >= 20) return 'medium';
    return 'low';
  }

  /**
   * Generate unique swap ID
   */
  private generateSwapId(): string {
    return `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): {
    pendingSwaps: number;
    activeBatches: number;
    averageBatchSize: number;
    averageCostPerSwap: number;
  } {
    const pendingCount = this.pendingSwaps.size;
    const activeCount = this.activeBatches.size;
    
    let totalBatchSize = 0;
    let totalCost = 0;
    let batchCount = 0;
    
    for (const batch of Array.from(this.activeBatches.values())) {
      totalBatchSize += batch.batchSize;
      totalCost += batch.costPerSwap * batch.batchSize;
      batchCount++;
    }
    
    return {
      pendingSwaps: pendingCount,
      activeBatches: activeCount,
      averageBatchSize: batchCount > 0 ? totalBatchSize / batchCount : 0,
      averageCostPerSwap: batchCount > 0 ? totalCost / totalBatchSize : 0
    };
  }

  /**
   * Get pending swap by ID
   */
  getPendingSwap(id: string): PendingSwap | undefined {
    return this.pendingSwaps.get(id);
  }

  /**
   * Get active batch by ID
   */
  getActiveBatch(id: string): SwapBatch | undefined {
    return this.activeBatches.get(id);
  }

  /**
   * Cancel a pending swap
   */
  cancelSwap(id: string): boolean {
    return this.pendingSwaps.delete(id);
  }

  // Event emitters (implement as needed)
  private emitBatchCreated(batch: SwapBatch): void {
    // Implement event emission
    console.log(`📢 Batch created: ${batch.id}`);
  }

  private emitBatchCompleted(batch: SwapBatch, result: BatchExecutionResult): void {
    // Implement event emission
    console.log(`📢 Batch completed: ${batch.id}`);
  }

  private emitBatchFailed(batch: SwapBatch, error: Error): void {
    // Implement event emission
    console.log(`📢 Batch failed: ${batch.id} - ${error.message}`);
  }
}

// Export singleton instance
export const batchingEngine = new BatchingEngine(); 