import { z } from 'zod';
import { Address, erc20Abi, parseUnits, formatUnits } from 'viem';
import { SeiAgentKit } from '../../agent';
import { approveToken } from '../../utils/approveTokens';
import { YEI_ADDRESSES, YEI_CONFIG, SUPPORTED_ASSETS, YEI_ERRORS, SupportedAsset } from './constants';

// Pool ABI for supply operations
const POOL_ABI = [
  {
    name: 'supply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' }
    ],
    outputs: []
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' }
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
  }
] as const;

// Validation schemas
export const SupplyAssetsSchema = z.object({
  asset: z.enum(['SEI', 'USDT', 'USDC'] as const).describe('Asset symbol to supply'),
  amount: z.string().describe('Amount to supply (in token units)'),
});

export const WithdrawAssetsSchema = z.object({
  asset: z.enum(['SEI', 'USDT', 'USDC'] as const).describe('Asset symbol to withdraw'),
  amount: z.string().describe('Amount to withdraw (in token units, use -1 for max)'),
});

export const GetSupplyDataSchema = z.object({
  user: z.string().describe('User address to get supply data for').optional(),
});

// Types
export type SupplyAssetsParams = z.infer<typeof SupplyAssetsSchema>;
export type WithdrawAssetsParams = z.infer<typeof WithdrawAssetsSchema>;
export type GetSupplyDataParams = z.infer<typeof GetSupplyDataSchema>;

export interface SupplyResult {
  transactionHash: string;
  asset: string;
  amount: string;
  aTokenReceived: string;
  gasUsed: string;
}

export interface WithdrawResult {
  transactionHash: string;
  asset: string;
  amount: string;
  actualAmountWithdrawn: string;
  gasUsed: string;
}

export interface UserAccountData {
  totalCollateralETH: string;
  totalDebtETH: string;
  availableBorrowsETH: string;
  currentLiquidationThreshold: string;
  ltv: string;
  healthFactor: string;
}

/**
 * Supply assets to YEI Finance protocol
 */
export async function supplyAssets(
  agent: SeiAgentKit,
  params: SupplyAssetsParams
): Promise<SupplyResult> {
  try {
    const { asset, amount } = params;
    
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

    // Check user balance
    const balance = await agent.publicClient.readContract({
      address: assetAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [agent.wallet_address]
    });

    if (balance < parsedAmount) {
      throw new Error(`${YEI_ERRORS.INSUFFICIENT_BALANCE}. Balance: ${formatUnits(balance, assetConfig.decimals)}`);
    }

    // Approve tokens if necessary
    await approveToken(agent, assetAddress, poolAddress, parsedAmount);

    // Execute supply transaction
    const txHash = await agent.walletClient.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'supply',
      args: [
        assetAddress,
        parsedAmount,
        agent.wallet_address,
        YEI_CONFIG.REFERRAL_CODE
      ],
      gas: YEI_CONFIG.GAS_LIMITS.SUPPLY
    });

    // Wait for transaction confirmation
    const receipt = await agent.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    // Calculate aToken received (1:1 for most assets)
    const aTokenReceived = formatUnits(parsedAmount, assetConfig.decimals);

    return {
      transactionHash: txHash,
      asset: asset,
      amount: amount,
      aTokenReceived: aTokenReceived,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('Supply operation failed:', error);
    throw new Error(`${YEI_ERRORS.TRANSACTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Withdraw assets from YEI Finance protocol
 */
export async function withdrawAssets(
  agent: SeiAgentKit,
  params: WithdrawAssetsParams
): Promise<WithdrawResult> {
  try {
    const { asset, amount } = params;
    
    // Validate asset
    if (!(asset in SUPPORTED_ASSETS)) {
      throw new Error(`${YEI_ERRORS.ASSET_NOT_SUPPORTED}: ${asset}`);
    }

    const assetConfig = SUPPORTED_ASSETS[asset];
    const assetAddress = assetConfig.address;
    const poolAddress = YEI_ADDRESSES.POOL;
    
    let parsedAmount: bigint;
    
    // Handle max withdrawal (-1)
    if (amount === '-1') {
      // Get user's aToken balance for max withdrawal
      const aTokenBalance = await agent.publicClient.readContract({
        address: assetConfig.aTokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [agent.wallet_address]
      });
      parsedAmount = aTokenBalance;
    } else {
      parsedAmount = parseUnits(amount, assetConfig.decimals);
    }
    
    if (parsedAmount <= 0n) {
      throw new Error(YEI_ERRORS.INVALID_AMOUNT);
    }

    // Check aToken balance
    const aTokenBalance = await agent.publicClient.readContract({
      address: assetConfig.aTokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [agent.wallet_address]
    });

    if (aTokenBalance < parsedAmount) {
      throw new Error(`${YEI_ERRORS.INSUFFICIENT_BALANCE}. aToken Balance: ${formatUnits(aTokenBalance, assetConfig.decimals)}`);
    }

    // Execute withdraw transaction
    const txHash = await agent.walletClient.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'withdraw',
      args: [
        assetAddress,
        parsedAmount,
        agent.wallet_address
      ],
      gas: YEI_CONFIG.GAS_LIMITS.WITHDRAW
    });

    // Wait for transaction confirmation
    const receipt = await agent.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    // Get actual amount withdrawn from transaction receipt
    // For most cases, it should equal the requested amount
    const actualAmountWithdrawn = formatUnits(parsedAmount, assetConfig.decimals);

    return {
      transactionHash: txHash,
      asset: asset,
      amount: amount === '-1' ? 'MAX' : amount,
      actualAmountWithdrawn: actualAmountWithdrawn,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('Withdraw operation failed:', error);
    throw new Error(`${YEI_ERRORS.TRANSACTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get user's account data and supply positions
 */
export async function getUserSupplyData(
  agent: SeiAgentKit,
  params: GetSupplyDataParams = {}
): Promise<UserAccountData> {
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

    return {
      totalCollateralETH: formatUnits(accountData[0], 18),
      totalDebtETH: formatUnits(accountData[1], 18),
      availableBorrowsETH: formatUnits(accountData[2], 18),
      currentLiquidationThreshold: (Number(accountData[3]) / 100).toString(),
      ltv: (Number(accountData[4]) / 100).toString(),
      healthFactor: formatUnits(accountData[5], 18)
    };

  } catch (error) {
    console.error('Failed to get user supply data:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get user's aToken balances for all supported assets
 */
export async function getUserATokenBalances(agent: SeiAgentKit): Promise<Record<SupportedAsset, string>> {
  try {
    const balances: Record<string, string> = {};

    // Get balances for all supported assets
    for (const [symbol, config] of Object.entries(SUPPORTED_ASSETS)) {
      try {
        const balance = await agent.publicClient.readContract({
          address: config.aTokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [agent.wallet_address]
        });

        balances[symbol] = formatUnits(balance, config.decimals);
      } catch (error) {
        console.warn(`Failed to get aToken balance for ${symbol}:`, error);
        balances[symbol] = '0';
      }
    }

    return balances as Record<SupportedAsset, string>;

  } catch (error) {
    console.error('Failed to get aToken balances:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}