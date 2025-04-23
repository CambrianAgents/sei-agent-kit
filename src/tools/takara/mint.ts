import {
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
  Account,
} from 'viem';
import { SeiAgentKit } from '../../agent';
import { sei } from 'viem/chains';
import { getTokenDecimals } from '../../utils/getTokenDecimals';
import { tTokenAbi } from './abi/mint/t_Tokenabi';
import { erc20Abi } from './abi/mint/erc20abi';
import { getTakaraTTokenAddress } from './tokenMap';
// Define the interface for the mint function parameters
export interface MintTakaraParams {
  ticker: string;
  mintAmount: string; // Amount in human-readable format (e.g., "100" for 100 USDC)
}

/**
 * Mints tTokens by depositing underlying tokens into Takara Protocol
 * @param agent SeiAgentKit instance
 * @param params Parameters for minting
 * @returns Transaction hash
 */
  export async function mintTakara(agent: SeiAgentKit, params: MintTakaraParams): Promise< Address > {

  const tTokenAddress = getTakaraTTokenAddress(params.ticker);
  if (!tTokenAddress) {
    throw new Error(`Invalid ticker: ${params.ticker}`);
  }

  // 1. Get the underlying token address from the tToken contract
  const underlyingTokenAddress = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'underlying',
  });

  // 2. Get the decimals of the underlying token
  const tokenDecimals = await getTokenDecimals(agent, underlyingTokenAddress);

  // 3. Convert the mint amount to the proper decimal representation
  const mintAmountRaw = parseUnits(params.mintAmount, tokenDecimals);

  // 4. Check user's current token balance
  const tokenBalance = await agent.publicClient.readContract({
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  // Ensure user has enough tokens
  if (tokenBalance < mintAmountRaw) {
    throw new Error(`Insufficient token balance. Required: ${params.mintAmount}, Available: ${formatUnits(tokenBalance, tokenDecimals)}`);
  }

  const account = agent.walletClient.account as Account;
  if (!account) {
    throw new Error("Wallet account is not initialized");
  }

  // 5. Approve the tToken contract to spend tokens
  const approvalHash = await agent.walletClient.writeContract({
    chain: sei,
    account,
    address: underlyingTokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [tTokenAddress, mintAmountRaw],
  });

  // Wait for approval to be mined
  await agent.publicClient.waitForTransactionReceipt({
    hash: approvalHash
  });

  // 6. Get the current exchange rate
  const { result: exchangeRate } = await agent.publicClient.simulateContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'exchangeRateCurrent',
  });

  // 7. Calculate expected tToken amount (mintAmount * 1e18 / exchangeRate)
  const expectedTTokenAmountRaw = (mintAmountRaw * BigInt(10 ** 18)) / exchangeRate;
  const expectedTTokenAmount = formatUnits(expectedTTokenAmountRaw, 18);

  // 8. Call the mint function on the tToken contract
  const mintTxHash = await agent.walletClient.writeContract({
    chain: sei,
    account,
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'mint',
    args: [mintAmountRaw],
  });

  // Wait for mint transaction to be mined
  const receipt = await agent.publicClient.waitForTransactionReceipt({
    hash: mintTxHash
  });

  // Check if transaction was successful
  if (receipt.status !== 'success') {
    throw new Error(`Mint transaction failed. Hash: ${mintTxHash}`);
  }

  // 9. Verify the tToken balance after minting
  const tTokenBalance = await agent.publicClient.readContract({
    address: tTokenAddress,
    abi: tTokenAbi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  return mintTxHash;
} 