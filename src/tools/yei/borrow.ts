import { z } from 'zod';
import { Address, erc20Abi, parseUnits, formatUnits } from 'viem';
import { SeiAgentKit } from '../../agent';
import { approveToken } from '../../utils/approveTokens';
import { YEI_ADDRESSES, YEI_CONFIG, SUPPORTED_ASSETS, YEI_ERRORS, SupportedAsset, InterestRateMode } from './constants';

// Pool ABI for borrow operations
const POOL_ABI = [
  {
    name: 'borrow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' }
    ],
    outputs: []
  },
  {
    name: 'repay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'rateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getUserAccountData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'totalCollateralETH', type: 'uint256' },
      { name: 'totalDebtETH', type: 'uint256' },
      { name: 'availableBorrowsETH', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' }
    ]
  },
  {
    name: 'swapBorrowRateMode',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'rateMode', type: 'uint256' }
    ],
    outputs: []
  }
] as const;

// Validation schemas
export const BorrowAssetsSchema = z.object({
  asset: z.enum(['SEI', 'USDT', 'USDC'] as const).describe('Asset symbol to borrow'),
  amount: z.string().describe('Amount to borrow (in token units)'),
  interestRateMode: z.enum(['STABLE', 'VARIABLE'] as const).describe('Interest rate mode').default('VARIABLE'),
});

export const RepayAssetsSchema = z.object({
  asset: z.enum(['SEI', 'USDT', 'USDC'] as const).describe('Asset symbol to repay'),
  amount: z.string().describe('Amount to repay (in token units, use -1 for max)'),
  interestRateMode: z.enum(['STABLE', 'VARIABLE'] as const).describe('Interest rate mode').default('VARIABLE'),
});

export const SwapBorrowRateModeSchema = z.object({
  asset: z.enum(['SEI', 'USDT', 'USDC'] as const).describe('Asset symbol to swap rate mode for'),
  rateMode: z.enum(['STABLE', 'VARIABLE'] as const).describe('Target interest rate mode'),
});

export const GetBorrowDataSchema = z.object({
  user: z.string().describe('User address to get borrow data for').optional(),
});

// Types
export type BorrowAssetsParams = z.infer<typeof BorrowAssetsSchema>;
export type RepayAssetsParams = z.infer<typeof RepayAssetsSchema>;
export type SwapBorrowRateModeParams = z.infer<typeof SwapBorrowRateModeSchema>;
export type GetBorrowDataParams = z.infer<typeof GetBorrowDataSchema>;

export interface BorrowResult {
  transactionHash: string;
  asset: string;
  amount: string;
  interestRateMode: string;
  gasUsed: string;
}

export interface RepayResult {
  transactionHash: string;
  asset: string;
  amount: string;
  actualAmountRepaid: string;
  interestRateMode: string;
  gasUsed: string;
}

export interface SwapRateModeResult {
  transactionHash: string;
  asset: string;
  newRateMode: string;
  gasUsed: string;
}

export interface UserBorrowData {
  totalDebtETH: string;
  availableBorrowsETH: string;
  healthFactor: string;
  borrowPowerUsed: string;
  debtByAsset: Record<SupportedAsset, {
    stableDebt: string;
    variableDebt: string;
  }>;
}

/**
 * Convert rate mode string to number
 */
function getRateModeNumber(mode: string): InterestRateMode {
  switch (mode) {
    case 'STABLE':
      return YEI_CONFIG.INTEREST_RATE_MODE.STABLE;
    case 'VARIABLE':
      return YEI_CONFIG.INTEREST_RATE_MODE.VARIABLE;
    default:
      return YEI_CONFIG.INTEREST_RATE_MODE.VARIABLE;
  }
}

/**
 * Borrow assets from YEI Finance protocol
 */
export async function borrowAssets(
  agent: SeiAgentKit,
  params: BorrowAssetsParams
): Promise<BorrowResult> {
  try {
    const { asset, amount, interestRateMode } = params;
    
    // Validate asset
    if (!(asset in SUPPORTED_ASSETS)) {
      throw new Error(`${YEI_ERRORS.ASSET_NOT_SUPPORTED}: ${asset}`);
    }

    const assetConfig = SUPPORTED_ASSETS[asset];
    const assetAddress = assetConfig.address;
    const poolAddress = YEI_ADDRESSES.POOL;
    
    // Parse amount with correct decimals
    const parsedAmount = parseUnits(amount, assetConfig.decimals);
    
    if (parsedAmount <= 0n) {
      throw new Error(YEI_ERRORS.INVALID_AMOUNT);
    }

    // Get rate mode number
    const rateModeNumber = getRateModeNumber(interestRateMode);

    // Check borrowing capacity
    const accountData = await agent.publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'getUserAccountData',
      args: [agent.wallet_address]
    });

    const availableBorrowsETH = accountData[2];
    if (availableBorrowsETH === 0n) {
      throw new Error('No borrowing capacity available. Please supply collateral first.');
    }

    // Execute borrow transaction
    const txHash = await agent.walletClient.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'borrow',
      args: [
        assetAddress,
        parsedAmount,
        BigInt(rateModeNumber),
        YEI_CONFIG.REFERRAL_CODE,
        agent.wallet_address
      ],
      gas: YEI_CONFIG.GAS_LIMITS.BORROW
    });

    // Wait for transaction confirmation
    const receipt = await agent.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    return {
      transactionHash: txHash,
      asset: asset,
      amount: amount,
      interestRateMode: interestRateMode,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('Borrow operation failed:', error);
    throw new Error(`${YEI_ERRORS.TRANSACTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Repay borrowed assets to YEI Finance protocol
 */
export async function repayAssets(
  agent: SeiAgentKit,
  params: RepayAssetsParams
): Promise<RepayResult> {
  try {
    const { asset, amount, interestRateMode } = params;
    
    // Validate asset
    if (!(asset in SUPPORTED_ASSETS)) {
      throw new Error(`${YEI_ERRORS.ASSET_NOT_SUPPORTED}: ${asset}`);
    }

    const assetConfig = SUPPORTED_ASSETS[asset];
    const assetAddress = assetConfig.address;
    const poolAddress = YEI_ADDRESSES.POOL;
    const rateModeNumber = getRateModeNumber(interestRateMode);
    
    let parsedAmount: bigint;
    
    // Handle max repayment (-1)
    if (amount === '-1') {
      // Use max uint256 value for full repayment
      parsedAmount = BigInt(YEI_CONFIG.MAX_UINT_AMOUNT);
    } else {
      parsedAmount = parseUnits(amount, assetConfig.decimals);
    }
    
    if (parsedAmount <= 0n && amount !== '-1') {
      throw new Error(YEI_ERRORS.INVALID_AMOUNT);
    }

    // Check user balance for repayment (unless max repay)
    if (amount !== '-1') {
      const balance = await agent.publicClient.readContract({
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [agent.wallet_address]
      });

      if (balance < parsedAmount) {
        throw new Error(`${YEI_ERRORS.INSUFFICIENT_BALANCE}. Balance: ${formatUnits(balance, assetConfig.decimals)}`);
      }
    }

    // Approve tokens for repayment (if not max repay with specific amount)
    if (amount !== '-1') {
      await approveToken(agent, assetAddress, poolAddress, parsedAmount);
    } else {
      // For max repay, approve a large amount
      const balance = await agent.publicClient.readContract({
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [agent.wallet_address]
      });
      await approveToken(agent, assetAddress, poolAddress, balance);
    }

    // Execute repay transaction
    const txHash = await agent.walletClient.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'repay',
      args: [
        assetAddress,
        parsedAmount,
        BigInt(rateModeNumber),
        agent.wallet_address
      ],
      gas: YEI_CONFIG.GAS_LIMITS.REPAY
    });

    // Wait for transaction confirmation
    const receipt = await agent.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    // For max repayment, the actual amount repaid would be determined by the debt amount
    const actualAmountRepaid = amount === '-1' ? 'MAX' : amount;

    return {
      transactionHash: txHash,
      asset: asset,
      amount: amount,
      actualAmountRepaid: actualAmountRepaid,
      interestRateMode: interestRateMode,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('Repay operation failed:', error);
    throw new Error(`${YEI_ERRORS.TRANSACTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Swap borrow rate mode between stable and variable
 */
export async function swapBorrowRateMode(
  agent: SeiAgentKit,
  params: SwapBorrowRateModeParams
): Promise<SwapRateModeResult> {
  try {
    const { asset, rateMode } = params;
    
    // Validate asset
    if (!(asset in SUPPORTED_ASSETS)) {
      throw new Error(`${YEI_ERRORS.ASSET_NOT_SUPPORTED}: ${asset}`);
    }

    const assetConfig = SUPPORTED_ASSETS[asset];
    const assetAddress = assetConfig.address;
    const poolAddress = YEI_ADDRESSES.POOL;
    const rateModeNumber = getRateModeNumber(rateMode);

    // Execute swap rate mode transaction
    const txHash = await agent.walletClient.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'swapBorrowRateMode',
      args: [
        assetAddress,
        BigInt(rateModeNumber)
      ],
      gas: 200_000n
    });

    // Wait for transaction confirmation
    const receipt = await agent.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    return {
      transactionHash: txHash,
      asset: asset,
      newRateMode: rateMode,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('Swap rate mode operation failed:', error);
    throw new Error(`${YEI_ERRORS.TRANSACTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get user's borrow positions and account data
 */
export async function getUserBorrowData(
  agent: SeiAgentKit,
  params: GetBorrowDataParams = {}
): Promise<UserBorrowData> {
  try {
    const userAddress = (params.user as Address) || agent.wallet_address;
    const poolAddress = YEI_ADDRESSES.POOL;

    // Get user account data from the pool
    const accountData = await agent.publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'getUserAccountData',
      args: [userAddress]
    });

    const totalCollateralETH = accountData[0];
    const totalDebtETH = accountData[1];
    const availableBorrowsETH = accountData[2];
    const healthFactor = accountData[5];

    // Calculate borrow power used
    const borrowPowerUsed = totalCollateralETH > 0n 
      ? ((totalDebtETH * 10000n) / totalCollateralETH).toString()
      : '0';

    // Get debt balances for each asset
    const debtByAsset: Record<string, { stableDebt: string; variableDebt: string }> = {};

    for (const [symbol, config] of Object.entries(SUPPORTED_ASSETS)) {
      try {
        // Get stable debt balance
        const stableDebtBalance = await agent.publicClient.readContract({
          address: config.stableDebtTokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress]
        });

        // Get variable debt balance
        const variableDebtBalance = await agent.publicClient.readContract({
          address: config.variableDebtTokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress]
        });

        debtByAsset[symbol] = {
          stableDebt: formatUnits(stableDebtBalance, config.decimals),
          variableDebt: formatUnits(variableDebtBalance, config.decimals)
        };
      } catch (error) {
        console.warn(`Failed to get debt balance for ${symbol}:`, error);
        debtByAsset[symbol] = {
          stableDebt: '0',
          variableDebt: '0'
        };
      }
    }

    return {
      totalDebtETH: formatUnits(totalDebtETH, 18),
      availableBorrowsETH: formatUnits(availableBorrowsETH, 18),
      healthFactor: formatUnits(healthFactor, 18),
      borrowPowerUsed: (Number(borrowPowerUsed) / 100).toString(),
      debtByAsset: debtByAsset as Record<SupportedAsset, { stableDebt: string; variableDebt: string }>
    };

  } catch (error) {
    console.error('Failed to get user borrow data:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if user has sufficient collateral to borrow
 */
export async function checkBorrowingCapacity(
  agent: SeiAgentKit,
  asset: SupportedAsset,
  amount: string
): Promise<{
  canBorrow: boolean;
  availableBorrowsETH: string;
  requiredCollateralETH: string;
  healthFactorAfterBorrow: string;
}> {
  try {
    // Validate asset
    if (!(asset in SUPPORTED_ASSETS)) {
      throw new Error(`${YEI_ERRORS.ASSET_NOT_SUPPORTED}: ${asset}`);
    }

    const poolAddress = YEI_ADDRESSES.POOL;
    
    // Get user account data
    const accountData = await agent.publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'getUserAccountData',
      args: [agent.wallet_address]
    });

    const availableBorrowsETH = accountData[2];
    const currentHealthFactor = accountData[5];

    // For simplification, we'll assume the requested amount in ETH terms
    // In a real implementation, you'd need to get the asset price from the oracle
    const assetConfig = SUPPORTED_ASSETS[asset];
    const parsedAmount = parseUnits(amount, assetConfig.decimals);
    
    // Simplified calculation - in reality, you'd need price oracle integration
    const requiredCollateralETH = formatUnits(parsedAmount, 18); // Simplified
    
    const canBorrow = availableBorrowsETH >= parsedAmount;

    return {
      canBorrow,
      availableBorrowsETH: formatUnits(availableBorrowsETH, 18),
      requiredCollateralETH,
      healthFactorAfterBorrow: formatUnits(currentHealthFactor, 18) // Simplified
    };

  } catch (error) {
    console.error('Failed to check borrowing capacity:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}