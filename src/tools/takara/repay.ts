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
import { tTokenAbi } from './abi/repay/t_Tokenabi';
import { erc20Abi } from './abi/repay/erc20abi';
import { getTakaraTTokenAddress } from './tokenMap';


// Define the interface for the repay function parameters
export interface RepayTakaraParams {
  ticker: string;
  repayAmount: string; // Amount in human-readable format (e.g., "100" for 100 USDC)
  // Use "MAX" to repay the full borrow balance
}

/**
 * Repays borrowed tokens to the Takara Protocol
 * @param agent SeiAgentKit instance
 * @param params Parameters for repaying
 * @returns Transaction hash and amount repaid
 */
export async function repayTakara(agent: SeiAgentKit, {
  ticker,
  repayAmount
}: RepayTakaraParams): Promise<{
  txHash: Hash,
  repaidAmount: string
}> {
  console.log(`Repaying ${repayAmount} ${ticker} to Takara...`);
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

  // 3. Get current borrow balance
  const { result: currentBorrowBalance } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'borrowBalanceCurrent',
    args: [agent.wallet_address],
  });

  // If borrowBalance is 0, there's nothing to repay
  if (currentBorrowBalance === 0n) {
    return {
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hash,
      repaidAmount: '0'
    };
  }

  // 4. Determine repay amount (allow "MAX" to repay full balance)
  let repayAmountRaw: bigint;
  if (repayAmount === 'MAX') {
    repayAmountRaw = currentBorrowBalance;
  } else {
    repayAmountRaw = parseUnits(repayAmount, tokenDecimals);

    // Ensure repay amount doesn't exceed borrow balance
    if (repayAmountRaw > currentBorrowBalance) {
      repayAmountRaw = currentBorrowBalance;
    }
  }

  // 5. Check if the user has enough tokens to repay
  const tokenBalance = await agent.publicClient.readContract({
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  if (tokenBalance < repayAmountRaw) {
    throw new Error(`Insufficient token balance to repay. Required: ${formatUnits(repayAmountRaw, tokenDecimals)}, Available: ${formatUnits(tokenBalance, tokenDecimals)}`);
  }

  // 6. Approve the tToken contract to spend tokens
  const account = agent.walletClient.account as Account;
  if (!account) {
    throw new Error("Wallet account is not initialized");
  }

  const approvalHash = await agent.walletClient.writeContract({
    chain: sei,
    account,
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [tTokenAddress, repayAmountRaw],
  });

  // Wait for approval to be mined
  await agent.publicClient.waitForTransactionReceipt({
    hash: approvalHash
  });

  // 7. Repay the borrow
  const repayTxHash = await agent.walletClient.writeContract({
    chain: sei,
    account,
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'repayBorrow',
    args: [repayAmountRaw],
  });

  // 8. Wait for the repay transaction to be mined
  const receipt = await agent.publicClient.waitForTransactionReceipt({
    hash: repayTxHash
  });

  // Check if transaction was successful
  if (receipt.status !== 'success') {
    throw new Error(`Repay transaction failed. Hash: ${repayTxHash}`);
  }

  // 9. Verify the new borrow balance after repayment
  const { result: updatedBorrowBalance } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'borrowBalanceCurrent',
    args: [agent.wallet_address],
  });

  const repaidAmount = currentBorrowBalance - updatedBorrowBalance;

  return {
    txHash: repayTxHash,
    repaidAmount: formatUnits(repaidAmount, tokenDecimals)
  };
} 