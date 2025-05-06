import { SeiAgentKit } from "../../index";
import { Address, formatEther } from "viem";
import { getBalance, formatWei, getTokenDecimals } from "../../utils";

/**
 * Get ERC-20 token balance for a wallet
 * @param agent SeiAgentKit instance
 * @param contract_address Optional ERC-20 token contract address
 * @returns Promise with formatted balance as string
 */
export async function get_erc20_balance(
  agent: SeiAgentKit,
  contract_address?: Address,
): Promise<string> {
  console.log(`Querying balance of ${contract_address ? contract_address : 'SEI'} for ${agent.wallet_address}...`);
  try {
    if (!contract_address) {
      // Handle native token balance
      if (!agent.publicClient) {
        throw new Error("Public client not initialized");
      }

      if (!agent.wallet_address) {
        throw new Error("Wallet address not specified");
      }

      const balance = await agent.publicClient.getBalance({
        address: agent.wallet_address
      });

      return formatEther(balance);
    }

    // Handle ERC-20 token balance
    if (!agent.publicClient || !agent.wallet_address) {
      throw new Error("Public client or wallet address not initialized");
    }

    const balance = await getBalance(agent, contract_address);
    if (balance === null || balance === undefined) {
      throw new Error(`Failed to retrieve balance for contract: ${contract_address}`);
    }

    const decimals = await getTokenDecimals(agent, contract_address);
    if (decimals === null || decimals === undefined) {
      throw new Error(`Failed to retrieve token decimals for contract: ${contract_address}`);
    }

    const formatBalance = formatWei(Number(balance), decimals);
    return formatBalance.toString() || '0';
  } catch (error) {
    const errorMsg = error instanceof Error ? error?.message : String(error);
    console.error(errorMsg);
    throw error;
  }
}
