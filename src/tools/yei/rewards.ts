import { z } from 'zod';
import { Address, erc20Abi, parseUnits, formatUnits } from 'viem';
import { SeiAgentKit } from '../../agent';
import { YEI_ADDRESSES, YEI_CONFIG, SUPPORTED_ASSETS, YEI_ERRORS, SupportedAsset } from './constants';

// Incentives Controller ABI for reward operations
const INCENTIVES_CONTROLLER_ABI = [
  {
    name: 'claimRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'reward', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'claimAllRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'to', type: 'address' }
    ],
    outputs: [{ name: 'rewardsList', type: 'address[]' }, { name: 'claimedAmounts', type: 'uint256[]' }]
  },
  {
    name: 'getUserRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'user', type: 'address' },
      { name: 'reward', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getAllUserRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'user', type: 'address' }
    ],
    outputs: [
      { name: 'rewardsList', type: 'address[]' },
      { name: 'unclaimedAmounts', type: 'uint256[]' }
    ]
  },
  {
    name: 'getRewardsByAsset',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }]
  },
  {
    name: 'getRewardsData',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'reward', type: 'address' }
    ],
    outputs: [
      { name: 'index', type: 'uint256' },
      { name: 'emissionPerSecond', type: 'uint256' },
      { name: 'lastUpdateTimestamp', type: 'uint256' },
      { name: 'distributionEnd', type: 'uint256' }
    ]
  }
] as const;

// Protocol Data Provider ABI for reserve data
const PROTOCOL_DATA_PROVIDER_ABI = [
  {
    name: 'getReserveData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'availableLiquidity', type: 'uint256' },
      { name: 'totalStableDebt', type: 'uint256' },
      { name: 'totalVariableDebt', type: 'uint256' },
      { name: 'liquidityRate', type: 'uint256' },
      { name: 'variableBorrowRate', type: 'uint256' },
      { name: 'stableBorrowRate', type: 'uint256' },
      { name: 'averageStableBorrowRate', type: 'uint256' },
      { name: 'liquidityIndex', type: 'uint256' },
      { name: 'variableBorrowIndex', type: 'uint256' },
      { name: 'lastUpdateTimestamp', type: 'uint40' }
    ]
  },
  {
    name: 'getReserveTokensAddresses',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'aTokenAddress', type: 'address' },
      { name: 'stableDebtTokenAddress', type: 'address' },
      { name: 'variableDebtTokenAddress', type: 'address' }
    ]
  }
] as const;

// Validation schemas
export const ClaimRewardsSchema = z.object({
  assets: z.array(z.enum(['SEI', 'USDT', 'USDC'] as const))
    .describe('Array of asset symbols to claim rewards for')
    .optional(),
  rewardToken: z.string().describe('Reward token address').optional(),
  to: z.string().describe('Address to send rewards to').optional(),
});

export const GetUserRewardsSchema = z.object({
  assets: z.array(z.enum(['SEI', 'USDT', 'USDC'] as const))
    .describe('Array of asset symbols to get rewards for')
    .optional(),
  user: z.string().describe('User address to get rewards for').optional(),
  rewardToken: z.string().describe('Specific reward token address').optional(),
});

export const GetAPRDataSchema = z.object({
  asset: z.enum(['SEI', 'USDT', 'USDC'] as const).describe('Asset symbol to get APR for'),
});

// Types
export type ClaimRewardsParams = z.infer<typeof ClaimRewardsSchema>;
export type GetUserRewardsParams = z.infer<typeof GetUserRewardsSchema>;
export type GetAPRDataParams = z.infer<typeof GetAPRDataSchema>;

export interface ClaimRewardsResult {
  transactionHash: string;
  claimedRewards: Array<{
    token: Address;
    amount: string;
    amountFormatted: string;
  }>;
  totalGasUsed: string;
}

export interface UserRewardsData {
  totalRewards: Array<{
    token: Address;
    symbol: string;
    amount: string;
    amountFormatted: string;
  }>;
  rewardsByAsset: Record<SupportedAsset, Array<{
    token: Address;
    symbol: string;
    amount: string;
    amountFormatted: string;
  }>>;
}

export interface APRData {
  asset: string;
  supplyAPR: string;
  variableBorrowAPR: string;
  stableBorrowAPR: string;
  rewardAPRs: Array<{
    token: Address;
    symbol: string;
    supplyAPR: string;
    variableBorrowAPR: string;
    stableBorrowAPR: string;
  }>;
  totalSupplyAPR: string;
  totalVariableBorrowAPR: string;
  totalStableBorrowAPR: string;
}

/**
 * Get all supported asset addresses for reward claims
 */
function getAllAssetAddresses(assets?: SupportedAsset[]): Address[] {
  const assetsToUse = assets || Object.keys(SUPPORTED_ASSETS) as SupportedAsset[];
  const addresses: Address[] = [];
  
  assetsToUse.forEach(asset => {
    const config = SUPPORTED_ASSETS[asset];
    addresses.push(config.aTokenAddress); // aToken for supply rewards
    addresses.push(config.variableDebtTokenAddress); // Variable debt token for borrow rewards
    addresses.push(config.stableDebtTokenAddress); // Stable debt token for borrow rewards
  });
  
  return addresses;
}

/**
 * Format reward amount using the standardized 18 decimals
 * All YEI reward tokens use 18 decimals as per requirements
 */
function formatRewardAmount(amount: bigint): string {
  return formatUnits(amount, YEI_CONFIG.REWARD_TOKEN_DECIMALS);
}

/**
 * Claim rewards for specified assets
 */
export async function claimRewards(
  agent: SeiAgentKit,
  params: ClaimRewardsParams = {}
): Promise<ClaimRewardsResult> {
  try {
    const { assets, rewardToken, to } = params;
    const incentivesController = YEI_ADDRESSES.INCENTIVES_CONTROLLER;
    const recipient = (to as Address) || agent.wallet_address;
    
    // Get asset addresses for reward claims
    const assetAddresses = getAllAssetAddresses(assets);
    
    if (assetAddresses.length === 0) {
      throw new Error('No assets specified for reward claims');
    }

    let txHash: Address;
    let claimedRewards: Array<{ token: Address; amount: string; amountFormatted: string }> = [];

    if (rewardToken) {
      // Claim specific reward token
      const claimAmount = BigInt(YEI_CONFIG.MAX_UINT_AMOUNT); // Claim all available
      
      txHash = await agent.walletClient.writeContract({
        address: incentivesController,
        abi: INCENTIVES_CONTROLLER_ABI,
        functionName: 'claimRewards',
        args: [
          assetAddresses,
          claimAmount,
          recipient,
          rewardToken as Address
        ],
        gas: YEI_CONFIG.GAS_LIMITS.CLAIM_REWARDS
      });

      // For single token claim, we would need to get the actual claimed amount from events
      // For simplicity, we'll return the basic structure
      claimedRewards = [{
        token: rewardToken as Address,
        amount: '0', // Would be populated from transaction receipt events
        amountFormatted: '0'
      }];

    } else {
      // Claim all available rewards
      const result = await agent.walletClient.writeContract({
        address: incentivesController,
        abi: INCENTIVES_CONTROLLER_ABI,
        functionName: 'claimAllRewards',
        args: [
          assetAddresses,
          recipient
        ],
        gas: YEI_CONFIG.GAS_LIMITS.CLAIM_REWARDS
      });

      txHash = result;
      
      // For claimAllRewards, the return values would give us the rewards info
      // In a real implementation, you'd parse the transaction receipt for events
      claimedRewards = []; // Would be populated from transaction events
    }

    // Wait for transaction confirmation
    const receipt = await agent.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    return {
      transactionHash: txHash,
      claimedRewards,
      totalGasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('Claim rewards operation failed:', error);
    throw new Error(`${YEI_ERRORS.TRANSACTION_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get user's unclaimed rewards data
 */
export async function getUserRewards(
  agent: SeiAgentKit,
  params: GetUserRewardsParams = {}
): Promise<UserRewardsData> {
  try {
    const { assets, user, rewardToken } = params;
    const incentivesController = YEI_ADDRESSES.INCENTIVES_CONTROLLER;
    const userAddress = (user as Address) || agent.wallet_address;
    
    // Get asset addresses
    const assetAddresses = getAllAssetAddresses(assets);
    
    if (assetAddresses.length === 0) {
      throw new Error('No assets specified for rewards query');
    }

    let totalRewards: Array<{
      token: Address;
      symbol: string;
      amount: string;
      amountFormatted: string;
    }> = [];

    if (rewardToken) {
      // Get rewards for specific token
      const rewardAmount = await agent.publicClient.readContract({
        address: incentivesController,
        abi: INCENTIVES_CONTROLLER_ABI,
        functionName: 'getUserRewards',
        args: [assetAddresses, userAddress, rewardToken as Address]
      });

      totalRewards = [{
        token: rewardToken as Address,
        symbol: 'REWARD', // Would need token registry to get actual symbol
        amount: rewardAmount.toString(),
        amountFormatted: formatRewardAmount(rewardAmount)
      }];

    } else {
      // Get all rewards
      const allRewards = await agent.publicClient.readContract({
        address: incentivesController,
        abi: INCENTIVES_CONTROLLER_ABI,
        functionName: 'getAllUserRewards',
        args: [assetAddresses, userAddress]
      });

      const [rewardTokens, amounts] = allRewards;
      
      totalRewards = rewardTokens.map((token, index) => ({
        token,
        symbol: `REWARD_${index}`, // Would need token registry for actual symbols
        amount: amounts[index].toString(),
        amountFormatted: formatRewardAmount(amounts[index])
      }));
    }

    // Build rewards by asset (simplified - would need more complex logic to map rewards to specific assets)
    const rewardsByAsset: Record<string, any[]> = {};
    const assetsToUse = assets || Object.keys(SUPPORTED_ASSETS) as SupportedAsset[];
    
    assetsToUse.forEach(asset => {
      rewardsByAsset[asset] = totalRewards; // Simplified mapping
    });

    return {
      totalRewards,
      rewardsByAsset: rewardsByAsset as Record<SupportedAsset, Array<{
        token: Address;
        symbol: string;
        amount: string;
        amountFormatted: string;
      }>>
    };

  } catch (error) {
    console.error('Failed to get user rewards:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get APR data for an asset including reward APRs
 * All reward calculations use 18 decimals as specified
 */
export async function getAPRData(
  agent: SeiAgentKit,
  params: GetAPRDataParams
): Promise<APRData> {
  try {
    const { asset } = params;
    
    // Validate asset
    if (!(asset in SUPPORTED_ASSETS)) {
      throw new Error(`${YEI_ERRORS.ASSET_NOT_SUPPORTED}: ${asset}`);
    }

    const assetConfig = SUPPORTED_ASSETS[asset];
    const protocolDataProvider = YEI_ADDRESSES.PROTOCOL_DATA_PROVIDER;
    const incentivesController = YEI_ADDRESSES.INCENTIVES_CONTROLLER;
    
    // Get reserve data for base APRs
    const reserveData = await agent.publicClient.readContract({
      address: protocolDataProvider,
      abi: PROTOCOL_DATA_PROVIDER_ABI,
      functionName: 'getReserveData',
      args: [assetConfig.address]
    });

    // Convert rates from Ray (1e27) to percentage
    const RAY = BigInt(10 ** 27);
    const supplyAPR = ((reserveData[3] * 100n) / RAY).toString();
    const variableBorrowAPR = ((reserveData[4] * 100n) / RAY).toString();
    const stableBorrowAPR = ((reserveData[5] * 100n) / RAY).toString();

    // Get reward tokens for this asset
    const rewardTokens = await agent.publicClient.readContract({
      address: incentivesController,
      abi: INCENTIVES_CONTROLLER_ABI,
      functionName: 'getRewardsByAsset',
      args: [assetConfig.aTokenAddress]
    });

    // Calculate reward APRs for each reward token (all using 18 decimals)
    const rewardAPRs: Array<{
      token: Address;
      symbol: string;
      supplyAPR: string;
      variableBorrowAPR: string;
      stableBorrowAPR: string;
    }> = [];

    for (const rewardToken of rewardTokens) {
      try {
        // Get reward data for aToken (supply rewards)
        const aTokenRewardData = await agent.publicClient.readContract({
          address: incentivesController,
          abi: INCENTIVES_CONTROLLER_ABI,
          functionName: 'getRewardsData',
          args: [assetConfig.aTokenAddress, rewardToken]
        });

        // Calculate APR based on emission per second and total supply
        // This is a simplified calculation - real implementation would need:
        // 1. Total supply of aToken
        // 2. Price of reward token vs underlying asset
        // 3. Current timestamp vs distribution end
        
        const emissionPerSecond = aTokenRewardData[1];
        const distributionEnd = aTokenRewardData[3];
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        
        let supplyRewardAPR = '0';
        if (distributionEnd > currentTime && emissionPerSecond > 0n) {
          // Simplified APR calculation using 18 decimals for reward token
          // Real calculation would need oracle prices and total supply data
          const yearlyEmission = emissionPerSecond * BigInt(YEI_CONFIG.SECONDS_PER_YEAR);
          const formattedEmission = formatUnits(yearlyEmission, YEI_CONFIG.REWARD_TOKEN_DECIMALS);
          supplyRewardAPR = (Number(formattedEmission) * 0.01).toString(); // Simplified 1% base reward
        }

        // Similar calculations for borrow rewards (would need debt token data)
        const variableBorrowRewardAPR = '0'; // Simplified
        const stableBorrowRewardAPR = '0'; // Simplified

        rewardAPRs.push({
          token: rewardToken,
          symbol: `REWARD_${rewardToken.slice(0, 6)}`, // Would need token registry
          supplyAPR: supplyRewardAPR,
          variableBorrowAPR: variableBorrowRewardAPR,
          stableBorrowAPR: stableBorrowRewardAPR
        });

      } catch (error) {
        console.warn(`Failed to get reward data for token ${rewardToken}:`, error);
      }
    }

    // Calculate total APRs including rewards
    const totalSupplyAPR = (
      parseFloat(supplyAPR) + 
      rewardAPRs.reduce((sum, reward) => sum + parseFloat(reward.supplyAPR), 0)
    ).toString();

    const totalVariableBorrowAPR = (
      parseFloat(variableBorrowAPR) - 
      rewardAPRs.reduce((sum, reward) => sum + parseFloat(reward.variableBorrowAPR), 0)
    ).toString();

    const totalStableBorrowAPR = (
      parseFloat(stableBorrowAPR) - 
      rewardAPRs.reduce((sum, reward) => sum + parseFloat(reward.stableBorrowAPR), 0)
    ).toString();

    return {
      asset,
      supplyAPR,
      variableBorrowAPR,
      stableBorrowAPR,
      rewardAPRs,
      totalSupplyAPR,
      totalVariableBorrowAPR,
      totalStableBorrowAPR
    };

  } catch (error) {
    console.error('Failed to get APR data:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get user's reward balance for a specific reward token
 */
export async function getRewardTokenBalance(
  agent: SeiAgentKit,
  rewardTokenAddress: Address,
  userAddress?: Address
): Promise<string> {
  try {
    const user = userAddress || agent.wallet_address;
    
    const balance = await agent.publicClient.readContract({
      address: rewardTokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user]
    });

    // Format using standardized 18 decimals for all reward tokens
    return formatRewardAmount(balance);

  } catch (error) {
    console.error('Failed to get reward token balance:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Estimate claimable rewards without executing transaction
 */
export async function estimateClaimableRewards(
  agent: SeiAgentKit,
  assets?: SupportedAsset[]
): Promise<Array<{
  token: Address;
  symbol: string;
  amount: string;
  amountFormatted: string;
  estimatedValue: string;
}>> {
  try {
    const rewardsData = await getUserRewards(agent, { assets });
    
    // Add estimated USD value (would need price oracle in real implementation)
    const estimatedRewards = rewardsData.totalRewards.map(reward => ({
      ...reward,
      estimatedValue: '0' // Would calculate using price oracle
    }));

    return estimatedRewards;

  } catch (error) {
    console.error('Failed to estimate claimable rewards:', error);
    throw new Error(`${YEI_ERRORS.CONTRACT_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}