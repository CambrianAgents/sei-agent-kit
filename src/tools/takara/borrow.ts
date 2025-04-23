import {
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
  type Account,
} from 'viem';
import { getTokenDecimals } from '../../utils/getTokenDecimals';
import { SeiAgentKit } from '../../agent';
import { sei } from 'viem/chains';
import { comptrollerAbi } from './abi/borrow/controllerabi';
import { tTokenAbi } from './abi/borrow/t_Tokenabi';
import { erc20Abi } from './abi/borrow/erc20abi';
import { getTakaraTTokenAddress } from './tokenMap';

// Define the interface for the borrow function parameters
export interface BorrowTakaraParams {
  ticker: string;
  borrowAmount: string; // Amount in human-readable format (e.g., "100" for 100 USDC)
}

/**
 * Borrows underlying tokens from Takara Protocol using the tToken as collateral
 * This function assumes you have already supplied collateral by minting tTokens
 * @param agent SeiAgentKit instance
 * @param params Parameters for borrowing
 * @returns Transaction hash and borrowed amount
 */
export async function borrowTakara(agent: SeiAgentKit, {
  ticker,
  borrowAmount
}: BorrowTakaraParams): Promise<Address> {
  console.log(`Borrowing ${borrowAmount} ${ticker} from Takara...`);
  const tTokenAddress = getTakaraTTokenAddress(ticker);
  if (!tTokenAddress) {
    throw new Error(`Invalid ticker: ${ticker}`);
  }

  const comptrollerAddress = '0x71034bf5eC0FAd7aEE81a213403c8892F3d8CAeE';
  // 1. Get the underlying token address from the tToken contract
  const underlyingTokenAddress = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'underlying',
  });

  // 2. Get the decimals of the underlying token
  const tokenDecimals = await getTokenDecimals(agent, underlyingTokenAddress);

  // 3. Convert the borrow amount to the proper decimal representation
  const borrowAmountRaw = parseUnits(borrowAmount, tokenDecimals);

  // 4. Check the available liquidity in the market
  const availableLiquidity = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'getCash',
  });

  // Ensure there's enough liquidity to borrow
  if (availableLiquidity < borrowAmountRaw) {
    throw new Error(`Insufficient liquidity in market. Requested: ${borrowAmount}, Available: ${formatUnits(availableLiquidity, tokenDecimals)}`);
  }

  // 5. Attempt to enter markets regardless of current status
  const account = agent.walletClient.account as Account;
  if (!account) {
    throw new Error("Wallet account is not initialized");
  }

  // Always enter markets to ensure we're in (skip the checkMembership check)
  const enterMarketsHash = await agent.walletClient.writeContract({
    chain: sei,
    account,
    address: comptrollerAddress,
    abi: comptrollerAbi,
    functionName: 'enterMarkets',
    args: [[tTokenAddress]],
  });

  // Wait for the enterMarkets transaction to be mined
  const enterMarketReceipt = await agent.publicClient.waitForTransactionReceipt({
    hash: enterMarketsHash
  });

  if (enterMarketReceipt.status !== 'success') {
    throw new Error(`Failed to enter markets. Transaction failed: ${enterMarketsHash}`);
  }

  // Add a short delay to allow any indexing/state updates to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 6. Get current borrow balance
  const { result: currentBorrowBalance } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'borrowBalanceCurrent',
    args: [agent.wallet_address],
  });

  // 7. Borrow the tokens
  const borrowTxHash = await agent.walletClient.writeContract({
    chain: sei,
    account,
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'borrow',
    args: [borrowAmountRaw],
  });

  // 8. Wait for the borrow transaction to be mined
  const receipt = await agent.publicClient.waitForTransactionReceipt({
    hash: borrowTxHash
  });

  // Check if transaction was successful
  if (receipt.status !== 'success') {
    throw new Error(`Borrow transaction failed. Hash: ${borrowTxHash}`);
  }

  // 9. Verify the underlying token balance after borrowing
  const tokenBalance = await agent.publicClient.readContract({
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  // 10. Get the updated borrow balance
  const { result: updatedBorrowBalance } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'borrowBalanceCurrent',
    args: [agent.wallet_address],
  });

  return borrowTxHash;
} 