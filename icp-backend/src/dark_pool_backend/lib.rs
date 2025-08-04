use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::time;
use ic_cdk_macros::*;
use serde::{Deserialize as SerdeDeserialize, Serialize as SerdeSerialize};
use std::collections::HashMap;
use uuid::Uuid;

// ============ TYPES ============

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct Order {
    pub id: String,
    pub trader: String,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: String,
    pub amount_out: String,
    pub is_buy: bool,
    pub nonce: u64,
    pub timestamp: u64,
    pub commitment: String,
    pub is_revealed: bool,
    pub is_executed: bool,
    pub is_cancelled: bool,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct EncryptedOrder {
    pub encrypted_data: String,
    pub commitment: String,
    pub timestamp: u64,
    pub nonce: u64,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct StateChannel {
    pub id: String,
    pub participants: Vec<String>,
    pub balance: String,
    pub nonce: u64,
    pub last_update: u64,
    pub is_active: bool,
    pub emergency_withdraw_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct TradingPair {
    pub token_in: String,
    pub token_out: String,
    pub min_order_size: String,
    pub max_order_size: String,
    pub trading_fee: u32,
    pub is_active: bool,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct Balance {
    pub token: String,
    pub amount: String,
    pub last_update: u64,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct Match {
    pub id: String,
    pub buy_order: String,
    pub sell_order: String,
    pub price: String,
    pub amount: String,
    pub timestamp: u64,
    pub executed_at: u64,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct OrderBook {
    pub buys: Vec<Order>,
    pub sells: Vec<Order>,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct NetworkStats {
    pub total_orders: u64,
    pub total_matches: u64,
    pub total_volume: String,
    pub active_channels: u64,
    pub average_price: String,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct HealthStatus {
    pub status: String,
    pub timestamp: u64,
    pub epoch: u64,
    pub version: String,
    pub network: String,
}

// ============ GLOBAL STATE ============

static mut ORDERS: Option<HashMap<String, Order>> = None;
static mut STATE_CHANNELS: Option<HashMap<String, StateChannel>> = None;
static mut COMMITMENTS: Option<HashMap<String, u64>> = None;
static mut TRADING_PAIRS: Option<HashMap<String, TradingPair>> = None;
static mut USER_BALANCES: Option<HashMap<String, Vec<Balance>>> = None;
static mut MATCHES: Option<HashMap<String, Match>> = None;
static mut CURRENT_EPOCH: u64 = 0;
static mut IS_PAUSED: bool = false;
static mut ENGINE_PUBLIC_KEY: String = String::new();

// ============ INITIALIZATION ============

#[init]
fn init() {
    unsafe {
        // Initialize global state
        ORDERS = Some(HashMap::new());
        STATE_CHANNELS = Some(HashMap::new());
        COMMITMENTS = Some(HashMap::new());
        MATCHES = Some(HashMap::new());
        USER_BALANCES = Some(HashMap::new());
        
        // Initialize trading pairs
        let mut trading_pairs = HashMap::new();
        trading_pairs.insert(
            "ETH/USDC".to_string(),
            TradingPair {
                token_in: "0x0000000000000000000000000000000000000000".to_string(),
                token_out: "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8".to_string(),
                min_order_size: "0.001".to_string(),
                max_order_size: "100".to_string(),
                trading_fee: 50, // 0.5%
                is_active: true,
            },
        );
        trading_pairs.insert(
            "QNT/USDT".to_string(),
            TradingPair {
                token_in: "0x4a220e6096b25eadb88358cb44068a3248254675".to_string(),
                token_out: "0xdac17f958d2ee523a2206206994597c13d831ec7".to_string(),
                min_order_size: "0.001".to_string(),
                max_order_size: "100".to_string(),
                trading_fee: 50, // 0.5%
                is_active: true,
            },
        );
        TRADING_PAIRS = Some(trading_pairs);
        
        // Generate engine public key (in production, this would be a real key)
        ENGINE_PUBLIC_KEY = "0x".to_string() + &hex::encode([0u8; 32]);
        
        CURRENT_EPOCH = 0;
        IS_PAUSED = false;
    }
}

// ============ HEALTH AND STATUS ============

#[query]
fn health() -> Result<HealthStatus, String> {
    Ok(HealthStatus {
        status: "healthy".to_string(),
        timestamp: time(),
        epoch: unsafe { CURRENT_EPOCH },
        version: "1.0.0".to_string(),
        network: "ic".to_string(),
    })
}

#[query]
fn get_version() -> Result<String, String> {
    Ok("1.0.0".to_string())
}

#[query]
fn get_system_status() -> Result<SystemStatus, String> {
    unsafe {
        let total_orders = ORDERS.as_ref().map_or(0, |orders| orders.len() as u64);
        let active_channels = STATE_CHANNELS.as_ref().map_or(0, |channels| {
            channels.values().filter(|c| c.is_active).count() as u64
        });
        
        Ok(SystemStatus {
            is_paused: IS_PAUSED,
            total_orders,
            active_channels,
        })
    }
}

// ============ ORDER MANAGEMENT ============

#[update]
fn commit_order(commitment: String, timestamp: u64, trader: String) -> Result<String, String> {
    if unsafe { IS_PAUSED } {
        return Err("Trading is currently paused".to_string());
    }
    
    unsafe {
        if COMMITMENTS.is_none() {
            COMMITMENTS = Some(HashMap::new());
        }
        
        let commitments = COMMITMENTS.as_mut().unwrap();
        
        // Check if commitment already exists
        if commitments.contains_key(&commitment) {
            return Err("Commitment already exists".to_string());
        }
        
        // Store commitment
        commitments.insert(commitment.clone(), timestamp);
        
        // Generate transaction ID
        let tx_id = format!("commit-{}", Uuid::new_v4());
        
        ic_cdk::println!("Order committed: {} by {}", commitment, trader);
        Ok(tx_id)
    }
}

#[update]
fn reveal_order(encrypted_order: EncryptedOrder) -> Result<bool, String> {
    if unsafe { IS_PAUSED } {
        return Err("Trading is currently paused".to_string());
    }
    
    unsafe {
        // Verify commitment exists
        if let Some(commitments) = &COMMITMENTS {
            if !commitments.contains_key(&encrypted_order.commitment) {
                return Err("Commitment not found".to_string());
            }
        }
        
        // In production, this would decrypt and verify the order
        // For now, we'll create a mock order
        let order_id = format!("order-{}", Uuid::new_v4());
        
        if ORDERS.is_none() {
            ORDERS = Some(HashMap::new());
        }
        
        let orders = ORDERS.as_mut().unwrap();
        
        // Mock order creation (in production, decrypt encrypted_order.encrypted_data)
        let order = Order {
            id: order_id.clone(),
            trader: "mock-trader".to_string(), // Would be extracted from decrypted data
            token_in: "ETH".to_string(),
            token_out: "USDC".to_string(),
            amount_in: "1.0".to_string(),
            amount_out: "2000".to_string(),
            is_buy: true,
            nonce: encrypted_order.nonce,
            timestamp: encrypted_order.timestamp,
            commitment: encrypted_order.commitment.clone(),
            is_revealed: true,
            is_executed: false,
            is_cancelled: false,
        };
        
        orders.insert(order_id, order);
        
        // Remove commitment after reveal
        if let Some(commitments) = COMMITMENTS.as_mut() {
            commitments.remove(&encrypted_order.commitment);
        }
        
        ic_cdk::println!("Order revealed: {}", encrypted_order.commitment);
        Ok(true)
    }
}

#[query]
fn get_order_book(trading_pair: String) -> Result<OrderBook, String> {
    unsafe {
        if ORDERS.is_none() {
            return Ok(OrderBook { buys: vec![], sells: vec![] });
        }
        
        let orders = ORDERS.as_ref().unwrap();
        let mut buys = vec![];
        let mut sells = vec![];
        
        for order in orders.values() {
            if !order.is_cancelled && !order.is_executed {
                if order.is_buy {
                    buys.push(order.clone());
                } else {
                    sells.push(order.clone());
                }
            }
        }
        
        // Sort by price and time
        buys.sort_by(|a, b| {
            let price_a: f64 = a.amount_out.parse().unwrap_or(0.0);
            let price_b: f64 = b.amount_out.parse().unwrap_or(0.0);
            price_b.partial_cmp(&price_a).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        sells.sort_by(|a, b| {
            let price_a: f64 = a.amount_out.parse().unwrap_or(0.0);
            let price_b: f64 = b.amount_out.parse().unwrap_or(0.0);
            price_a.partial_cmp(&price_b).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        Ok(OrderBook { buys, sells })
    }
}

#[query]
fn get_order(order_id: String) -> Result<Option<Order>, String> {
    unsafe {
        if let Some(orders) = &ORDERS {
            Ok(orders.get(&order_id).cloned())
        } else {
            Ok(None)
        }
    }
}

#[update]
fn cancel_order(order_id: String, trader: String) -> Result<bool, String> {
    unsafe {
        if let Some(orders) = ORDERS.as_mut() {
            if let Some(order) = orders.get_mut(&order_id) {
                if order.trader == trader && !order.is_executed {
                    order.is_cancelled = true;
                    ic_cdk::println!("Order cancelled: {} by {}", order_id, trader);
                    return Ok(true);
                }
            }
        }
        Err("Order not found or cannot be cancelled".to_string())
    }
}

// ============ STATE CHANNELS ============

#[update]
fn open_state_channel(participant: String, initial_balance: String, collateral: String) -> Result<StateChannel, String> {
    unsafe {
        if STATE_CHANNELS.is_none() {
            STATE_CHANNELS = Some(HashMap::new());
        }
        
        let channels = STATE_CHANNELS.as_mut().unwrap();
        let channel_id = format!("channel-{}", Uuid::new_v4());
        
        let channel = StateChannel {
            id: channel_id.clone(),
            participants: vec![participant.clone()],
            balance: initial_balance.clone(),
            nonce: 0,
            last_update: time(),
            is_active: true,
            emergency_withdraw_time: None,
        };
        
        channels.insert(channel_id.clone(), channel.clone());
        
        ic_cdk::println!("State channel opened: {} for {}", channel_id, participant);
        Ok(channel)
    }
}

#[update]
fn update_state_channel(channel_id: String, new_balance: String, signature: String) -> Result<bool, String> {
    unsafe {
        if let Some(channels) = STATE_CHANNELS.as_mut() {
            if let Some(channel) = channels.get_mut(&channel_id) {
                // In production, verify signature here
                channel.balance = new_balance;
                channel.nonce += 1;
                channel.last_update = time();
                
                ic_cdk::println!("State channel updated: {}", channel_id);
                return Ok(true);
            }
        }
        Err("State channel not found".to_string())
    }
}

#[query]
fn get_state_channel(channel_id: String) -> Result<Option<StateChannel>, String> {
    unsafe {
        if let Some(channels) = &STATE_CHANNELS {
            Ok(channels.get(&channel_id).cloned())
        } else {
            Ok(None)
        }
    }
}

#[query]
fn get_user_state_channels(user_address: String) -> Result<Vec<StateChannel>, String> {
    unsafe {
        if let Some(channels) = &STATE_CHANNELS {
            let user_channels: Vec<StateChannel> = channels
                .values()
                .filter(|channel| channel.participants.contains(&user_address))
                .cloned()
                .collect();
            Ok(user_channels)
        } else {
            Ok(vec![])
        }
    }
}

#[update]
fn emergency_withdrawal(channel_id: String) -> Result<bool, String> {
    unsafe {
        if let Some(channels) = STATE_CHANNELS.as_mut() {
            if let Some(channel) = channels.get_mut(&channel_id) {
                if channel.is_active {
                    channel.emergency_withdraw_time = Some(time() + 86400); // 24 hours
                    channel.is_active = false;
                    
                    ic_cdk::println!("Emergency withdrawal initiated for channel: {}", channel_id);
                    return Ok(true);
                }
            }
        }
        Err("State channel not found or not active".to_string())
    }
}

// ============ TRADING PAIRS AND BALANCES ============

#[query]
fn get_trading_pairs() -> Result<Vec<TradingPairRecord>, String> {
    unsafe {
        if let Some(pairs) = &TRADING_PAIRS {
            let result: Vec<TradingPairRecord> = pairs
                .iter()
                .map(|(pair, config)| TradingPairRecord {
                    pair: pair.clone(),
                    config: config.clone(),
                })
                .collect();
            Ok(result)
        } else {
            Ok(vec![])
        }
    }
}

#[query]
fn get_user_balances(user_address: String) -> Result<Vec<Balance>, String> {
    unsafe {
        if let Some(balances) = &USER_BALANCES {
            Ok(balances.get(&user_address).cloned().unwrap_or(vec![]))
        } else {
            Ok(vec![])
        }
    }
}

#[update]
fn update_balance(user_address: String, token: String, amount: String) -> Result<bool, String> {
    unsafe {
        if USER_BALANCES.is_none() {
            USER_BALANCES = Some(HashMap::new());
        }
        
        let balances = USER_BALANCES.as_mut().unwrap();
        let user_balances = balances.entry(user_address).or_insert_with(Vec::new);
        
        // Update existing balance or add new one
        if let Some(balance) = user_balances.iter_mut().find(|b| b.token == token) {
            balance.amount = amount;
            balance.last_update = time();
        } else {
            user_balances.push(Balance {
                token,
                amount,
                last_update: time(),
            });
        }
        
        Ok(true)
    }
}

// ============ STATISTICS AND MONITORING ============

#[query]
fn get_network_stats() -> Result<NetworkStats, String> {
    unsafe {
        let total_orders = ORDERS.as_ref().map_or(0, |orders| orders.len() as u64);
        let total_matches = MATCHES.as_ref().map_or(0, |matches| matches.len() as u64);
        let active_channels = STATE_CHANNELS.as_ref().map_or(0, |channels| {
            channels.values().filter(|c| c.is_active).count() as u64
        });
        
        Ok(NetworkStats {
            total_orders,
            total_matches,
            total_volume: "1250000.0".to_string(), // Mock data
            active_channels,
            average_price: "2000.0".to_string(), // Mock data
        })
    }
}

#[query]
fn get_recent_matches(limit: u64) -> Result<Vec<Match>, String> {
    unsafe {
        if let Some(matches) = &MATCHES {
            let mut recent_matches: Vec<Match> = matches.values().cloned().collect();
            recent_matches.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
            recent_matches.truncate(limit as usize);
            Ok(recent_matches)
        } else {
            Ok(vec![])
        }
    }
}

#[query]
fn get_epoch_info() -> Result<EpochInfo, String> {
    unsafe {
        Ok(EpochInfo {
            current_epoch: CURRENT_EPOCH,
            last_processed: time(),
        })
    }
}

// ============ PRIVACY LAYER ============

#[query]
fn get_engine_public_key() -> Result<String, String> {
    unsafe { Ok(ENGINE_PUBLIC_KEY.clone()) }
}

#[update]
fn verify_commitment(commitment: String, encrypted_order: EncryptedOrder) -> Result<bool, String> {
    // In production, this would verify the commitment matches the encrypted order
    // For now, return true if commitment exists
    unsafe {
        if let Some(commitments) = &COMMITMENTS {
            Ok(commitments.contains_key(&commitment))
        } else {
            Ok(false)
        }
    }
}

// ============ ADMINISTRATIVE FUNCTIONS ============

#[update]
fn set_trading_pair(pair: String, config: TradingPair) -> Result<bool, String> {
    unsafe {
        if TRADING_PAIRS.is_none() {
            TRADING_PAIRS = Some(HashMap::new());
        }
        
        let pairs = TRADING_PAIRS.as_mut().unwrap();
        pairs.insert(pair.clone(), config);
        
        ic_cdk::println!("Trading pair updated: {}", pair);
        Ok(true)
    }
}

#[update]
fn pause_trading() -> Result<bool, String> {
    unsafe {
        IS_PAUSED = true;
        ic_cdk::println!("Trading paused");
        Ok(true)
    }
}

#[update]
fn resume_trading() -> Result<bool, String> {
    unsafe {
        IS_PAUSED = false;
        ic_cdk::println!("Trading resumed");
        Ok(true)
    }
}

// ============ HELPER TYPES ============

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct TradingPairRecord {
    pub pair: String,
    pub config: TradingPair,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct SystemStatus {
    pub is_paused: bool,
    pub total_orders: u64,
    pub active_channels: u64,
}

#[derive(CandidType, Deserialize, Clone, SerdeSerialize, SerdeDeserialize)]
pub struct EpochInfo {
    pub current_epoch: u64,
    pub last_processed: u64,
} 