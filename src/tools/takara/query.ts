import {
  formatUnits,
  type Address
} from 'viem';
import { SeiAgentKit } from '../../agent';
import { getTokenDecimals } from '../../utils/getTokenDecimals';
import { tTokenAbi } from './abi/query/t_Tokenabi';
import { getTakaraTTokenAddress } from './tokenMap';

/**
 * Calculates the amount of underlying tokens that can be redeemed by a user
 * @param agent SeiAgentKit instance
 * @param ticker The token ticker (e.g., "USDC", "SEI")
 * @param userAddress The address of the user (defaults to agent's wallet address)
 * @returns Information about redeemable amounts
 */
export async function getRedeemableAmount(
  agent: SeiAgentKit,
  ticker: string,
  userAddress?: Address
): Promise<{
  tTokenBalance: string,
  exchangeRate: string,
  redeemableUnderlying: string,
  safeMaxRedeemable: string, // 99.5% of maximum for safe redemption
  underlyingDecimals: number,
  underlyingTokenAddress: Address
}> {
  console.log(`Querying redeemable amount for ${ticker} from address ${userAddress || agent.wallet_address}...`);
  const tTokenAddress = getTakaraTTokenAddress(ticker);
  if (!tTokenAddress) {
    throw new Error(`Invalid ticker: ${ticker}`);
  }

  // Use the agent's address if no user address is provided
  const address = userAddress || agent.wallet_address;

  // 1. Get the underlying token address
  const underlyingTokenAddress = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'underlying',
  });

  // 2. Get the decimals of the underlying token
  const tokenDecimals = await getTokenDecimals(agent, underlyingTokenAddress);

  // 3. Get the user's tToken balance
  const tTokenBalance = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'balanceOf',
    args: [address],
  });

  // 4. Get the current exchange rate
  const { result: exchangeRate } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'exchangeRateCurrent',
  });

  // 5. Calculate the redeemable underlying amount
  // Formula: tTokenBalance * exchangeRate / 1e18
  const redeemableUnderlyingRaw = (tTokenBalance * exchangeRate) / BigInt(10 ** 18);

  // Calculate safe maximum (99.5%) to avoid precision issues
  const safeMaxRedeemable = (redeemableUnderlyingRaw * 995n) / 1000n;

  // Format values for readability
  const formattedTTokenBalance = formatUnits(tTokenBalance, 18); // tTokens use 18 decimals
  const formattedExchangeRate = formatUnits(exchangeRate, 18); // Exchange rate has 18 decimals precision
  const formattedRedeemableUnderlying = formatUnits(redeemableUnderlyingRaw, tokenDecimals);
  const formattedSafeMaxRedeemable = formatUnits(safeMaxRedeemable, tokenDecimals);

  return {
    tTokenBalance: formattedTTokenBalance,
    exchangeRate: formattedExchangeRate,
    redeemableUnderlying: formattedRedeemableUnderlying,
    safeMaxRedeemable: formattedSafeMaxRedeemable,
    underlyingDecimals: tokenDecimals,
    underlyingTokenAddress
  };
}

/**
 * Retrieves the current borrow balance for a user
 * @param agent SeiAgentKit instance
 * @param ticker The token ticker (e.g., "USDC", "SEI")
 * @param userAddress The address of the user (defaults to agent's wallet address)
 * @returns Information about the borrow balance
 */
export async function getBorrowBalance(
  agent: SeiAgentKit,
  ticker: string,
  userAddress?: Address
): Promise<{
  borrowBalance: string,
  underlyingDecimals: number,
  underlyingTokenAddress: Address
}> {
  console.log(`Querying borrow balance for ${ticker} from address ${userAddress || agent.wallet_address}...`);
  const tTokenAddress = getTakaraTTokenAddress(ticker);
  if (!tTokenAddress) {
    throw new Error(`Invalid ticker: ${ticker}`);
  }

  // Use the agent's address if no user address is provided
  const address = userAddress || agent.wallet_address;

  // Define the borrowBalanceCurrent ABI
  const borrowBalanceAbi = [
    {
      inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
      name: 'borrowBalanceCurrent',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function',
    }
  ] as const;

  // 1. Get the underlying token address
  const underlyingTokenAddress = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'underlying',
  });

  // 2. Get the decimals of the underlying token
  const tokenDecimals = await getTokenDecimals(agent, underlyingTokenAddress);

  // 3. Get the current borrow balance
  const { result: borrowBalanceRaw } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: borrowBalanceAbi,
    functionName: 'borrowBalanceCurrent',
    args: [address],
  });

  // Format for readability
  const formattedBorrowBalance = formatUnits(borrowBalanceRaw, tokenDecimals);

  return {
    borrowBalance: formattedBorrowBalance,
    underlyingDecimals: tokenDecimals,
    underlyingTokenAddress
  };
} 