import { Address } from "viem";

/**
 * YEI Finance Protocol Constants
 * Contract addresses and configuration for Sei blockchain integration
 */

// Core Protocol Addresses (these should be updated with actual deployed addresses)
export const YEI_ADDRESSES = {
  // Pool and Core Protocol
  POOL: '0x0000000000000000000000000000000000000000' as Address,
  POOL_ADDRESSES_PROVIDER: '0x0000000000000000000000000000000000000000' as Address,
  POOL_DATA_PROVIDER: '0x0000000000000000000000000000000000000000' as Address,
  POOL_CONFIGURATOR: '0x0000000000000000000000000000000000000000' as Address,
  
  // ACL and Governance
  ACL_MANAGER: '0x0000000000000000000000000000000000000000' as Address,
  
  // Oracle
  AAVE_ORACLE: '0x0000000000000000000000000000000000000000' as Address,
  PRICE_ORACLE_SENTINEL: '0x0000000000000000000000000000000000000000' as Address,
  
  // Incentives
  INCENTIVES_CONTROLLER: '0x0000000000000000000000000000000000000000' as Address,
  
  // Protocol Data Provider
  PROTOCOL_DATA_PROVIDER: '0x0000000000000000000000000000000000000000' as Address,
  
  // L2 Specific (if applicable)
  L2_ENCODER: '0x0000000000000000000000000000000000000000' as Address,
} as const;

// Supported Assets Configuration
export const SUPPORTED_ASSETS = {
  // Native assets
  SEI: {
    symbol: 'SEI',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000' as Address,
    aTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    stableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    variableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
  },
  
  // Stablecoins
  USDT: {
    symbol: 'USDT',
    decimals: 6,
    address: '0x0000000000000000000000000000000000000000' as Address,
    aTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    stableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    variableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
  },
  
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    address: '0x0000000000000000000000000000000000000000' as Address,
    aTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    stableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    variableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as Address,
  },
} as const;

// Protocol Configuration
export const YEI_CONFIG = {
  // All reward tokens have 18 decimals as specified
  REWARD_TOKEN_DECIMALS: 18,
  
  // Interest rate modes
  INTEREST_RATE_MODE: {
    NONE: 0,
    STABLE: 1,
    VARIABLE: 2,
  } as const,
  
  // Referral code for protocol usage
  REFERRAL_CODE: 0,
  
  // Maximum values
  MAX_UINT_AMOUNT: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  
  // Gas limits for different operations
  GAS_LIMITS: {
    SUPPLY: 300_000n,
    WITHDRAW: 300_000n,
    BORROW: 400_000n,
    REPAY: 300_000n,
    CLAIM_REWARDS: 200_000n,
  },
  
  // Network configuration
  CHAIN_ID: 1329, // Sei Pacific-1 mainnet
  
  // Fee configuration
  FLASHLOAN_PREMIUM: 9, // 0.09%
} as const;

// Error messages
export const YEI_ERRORS = {
  INSUFFICIENT_BALANCE: 'Insufficient token balance',
  INSUFFICIENT_ALLOWANCE: 'Insufficient token allowance',
  ASSET_NOT_SUPPORTED: 'Asset not supported by YEI protocol',
  INVALID_AMOUNT: 'Invalid amount specified',
  TRANSACTION_FAILED: 'Transaction execution failed',
  NETWORK_ERROR: 'Network connection error',
  CONTRACT_ERROR: 'Smart contract interaction error',
} as const;

// Event signatures for monitoring
export const YEI_EVENTS = {
  SUPPLY: 'Supply(address,address,uint256,uint16)',
  WITHDRAW: 'Withdraw(address,address,address,uint256)',
  BORROW: 'Borrow(address,address,uint256,uint8,uint256,uint16)',
  REPAY: 'Repay(address,address,address,uint256,bool)',
  REWARDS_CLAIMED: 'RewardsClaimed(address,address,address,uint256)',
} as const;

// Default slippage tolerance (in basis points)
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

// Time constants
export const SECONDS_PER_YEAR = 31536000;
export const BLOCKS_PER_YEAR = 2628000; // Approximate for Sei

export type SupportedAsset = keyof typeof SUPPORTED_ASSETS;
export type InterestRateMode = typeof YEI_CONFIG.INTEREST_RATE_MODE[keyof typeof YEI_CONFIG.INTEREST_RATE_MODE];