/**
 * YEI Finance Tools for Sei Agent Kit
 * 
 * This module provides comprehensive integration with YEI Finance protocol,
 * including supply, borrow, and reward claiming functionalities.
 * All reward tokens are configured with 18 decimals for accurate APR calculations.
 */

// Export all constants and types
export * from './constants';

// Export supply functionality
export * from './supply';

// Export borrow functionality
export * from './borrow';

// Export rewards functionality
export * from './rewards';

// Re-export key types for convenience
export type {
  SupportedAsset,
  InterestRateMode,
} from './constants';

export type {
  SupplyAssetsParams,
  WithdrawAssetsParams,
  GetSupplyDataParams,
  SupplyResult,
  WithdrawResult,
  UserAccountData,
} from './supply';

export type {
  BorrowAssetsParams,
  RepayAssetsParams,
  SwapBorrowRateModeParams,
  GetBorrowDataParams,
  BorrowResult,
  RepayResult,
  SwapRateModeResult,
  UserBorrowData,
} from './borrow';

export type {
  ClaimRewardsParams,
  GetUserRewardsParams,
  GetAPRDataParams,
  ClaimRewardsResult,
  UserRewardsData,
  APRData,
} from './rewards';