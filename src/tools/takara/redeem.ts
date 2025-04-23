import {
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
  type Account,
} from 'viem';
import { SeiAgentKit } from '../../agent';
import { sei } from 'viem/chains';
import { getTokenDecimals } from '../../utils/getTokenDecimals';
import { tTokenAbi } from './abi/redeem/t_Tokenabi';
import { erc20Abi } from './abi/redeem/erc20abi';
import { getTakaraTTokenAddress } from './tokenMap';

// Define the interface for the redeem function parameters
export interface RedeemTakaraParams {
  ticker: string;
  redeemAmount: string; // Amount in human-readable format (e.g., "100" for 100 USDC)
  // Use "MAX" to redeem all tTokens
  redeemType: 'underlying' | 'tokens'; // Whether to redeem a specific amount of underlying tokens or tTokens
}

/**
 * Redeems tTokens from Takara Protocol to get underlying tokens back
 * @param agent SeiAgentKit instance
 * @param params Parameters for redeeming
 * @returns Transaction hash and amount redeemed
 */
export async function redeemTakara(agent: SeiAgentKit, {
  ticker,
  redeemAmount,
  redeemType = 'underlying' // Default to redeeming underlying tokens
}: RedeemTakaraParams): Promise<{
  txHash: Hash,
  redeemedAmount: string,
  expected: string,
  actual: string,
  success: boolean
}> {
  console.log(`Redeeming ${redeemAmount} ${ticker} from Takara...`);
  const tTokenAddress = getTakaraTTokenAddress(ticker);
  if (!tTokenAddress) {
    throw new Error(`Invalid ticker: ${ticker}`);
  }

  // 1. Get the underlying token address from the tToken contract
  const underlyingTokenAddress = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'underlying',
  });

  // 2. Get the decimals of the underlying token
  const tokenDecimals = await getTokenDecimals(agent, underlyingTokenAddress);

  // 3. Get initial underlying token balance
  const initialTokenBalance = await agent.publicClient.readContract({
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  // 4. Get current tToken balance
  const tTokenBalance = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  // If tToken balance is 0, there's nothing to redeem
  if (tTokenBalance === 0n) {
    return {
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hash,
      redeemedAmount: '0',
      expected: '0',
      actual: '0',
      success: false
    };
  }

  // 5. Get current exchange rate
  const { result: exchangeRate } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'exchangeRateCurrent',
  });

  // 6. Calculate available underlying tokens for redemption
  const availableUnderlyingAmount = (tTokenBalance * exchangeRate) / BigInt(10 ** 18);

  // 7. Determine redeem amount
  let redeemAmountRaw: bigint;
  let tTokensToRedeem: bigint;

  if (redeemAmount === 'MAX') {
    if (redeemType === 'underlying') {
      // When redeeming MAX, use 99.5% of the available amount to avoid precision issues
      redeemAmountRaw = (availableUnderlyingAmount * 995n) / 1000n;
      tTokensToRedeem = (tTokenBalance * 995n) / 1000n;
    } else {
      // When redeeming MAX tTokens, use 99.5% to avoid precision issues
      tTokensToRedeem = (tTokenBalance * 995n) / 1000n;
      redeemAmountRaw = (tTokensToRedeem * exchangeRate) / BigInt(10 ** 18);
    }
  } else {
    if (redeemType === 'underlying') {
      redeemAmountRaw = parseUnits(redeemAmount, tokenDecimals);

      // Ensure redeem amount doesn't exceed 99.5% of available balance (to avoid precision issues)
      const safeMaxAmount = (availableUnderlyingAmount * 995n) / 1000n;
      if (redeemAmountRaw > safeMaxAmount) {
        redeemAmountRaw = safeMaxAmount;
      }

      // Calculate approx tTokens needed (not exact due to rounding)
      tTokensToRedeem = (redeemAmountRaw * BigInt(10 ** 18)) / exchangeRate;
    } else {
      tTokensToRedeem = parseUnits(redeemAmount, 18); // tTokens use 18 decimals

      // Ensure tTokens to redeem doesn't exceed 99.5% of available balance (to avoid precision issues)
      const safeMaxTokens = (tTokenBalance * 995n) / 1000n;
      if (tTokensToRedeem > safeMaxTokens) {
        tTokensToRedeem = safeMaxTokens;
      }

      redeemAmountRaw = (tTokensToRedeem * exchangeRate) / BigInt(10 ** 18);
    }
  }

  // Store the expected redemption amount
  const expectedRedemptionAmount = redeemAmountRaw;

  // 8. Redeem the tokens
  const account = agent.walletClient.account as Account;
  if (!account) {
    throw new Error("Wallet account is not initialized");
  }

  let redeemTxHash: Hash;

  if (redeemType === 'underlying') {
    redeemTxHash = await agent.walletClient.writeContract({
      chain: sei,
      account,
      address: tTokenAddress,
      abi: tTokenAbi,
      functionName: 'redeemUnderlying',
      args: [redeemAmountRaw],
    });
  } else {
    redeemTxHash = await agent.walletClient.writeContract({
      chain: sei,
      account,
      address: tTokenAddress,
      abi: tTokenAbi,
      functionName: 'redeem',
      args: [tTokensToRedeem],
    });
  }

  // 9. Wait for the redeem transaction to be mined
  const receipt = await agent.publicClient.waitForTransactionReceipt({
    hash: redeemTxHash
  });

  // Check if transaction was successful at blockchain level
  if (receipt.status !== 'success') {
    throw new Error(`Redeem transaction failed. Hash: ${redeemTxHash}`);
  }

  // 10. Verify the underlying token balance after redemption
  const newTokenBalance = await agent.publicClient.readContract({
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  // 11. Verify the new tToken balance
  const newTTokenBalance = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  const tTokensRedeemed = tTokenBalance - newTTokenBalance;
  const underlyingTokensReceived = newTokenBalance - initialTokenBalance;

  // Check if we actually received the expected amount (with a 2% tolerance for gas fees, rounding, etc.)
  const receptionThreshold = (expectedRedemptionAmount * 98n) / 100n; // 98% of expected
  const actuallyReceived = underlyingTokensReceived >= receptionThreshold;

  return {
    txHash: redeemTxHash,
    redeemedAmount: formatUnits(underlyingTokensReceived, tokenDecimals),
    expected: formatUnits(expectedRedemptionAmount, tokenDecimals),
    actual: formatUnits(underlyingTokensReceived, tokenDecimals),
    success: actuallyReceived
  };
} 