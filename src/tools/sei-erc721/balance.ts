import { SeiAgentKit } from "../../index";
import { Address, formatEther, parseAbi } from "viem";
import { sei } from 'viem/chains';
import { string } from "zod";
import { isContract, getBalance } from "../../utils";

/**
 * Gets the ERC-721 token balance for a given wallet address
 * 
 * @param agent SeiAgentKit instance
 * @param token_address Address of the ERC-721 token contract
 * @returns Balance as a string
 */
export async function get_erc721_balance(
  agent: SeiAgentKit,
  token_address: Address,
): Promise<string> {
  if (!agent.publicClient || !agent.wallet_address) {
    const errorMsg = "Agent is missing required client or wallet address";
    throw new Error(errorMsg);
  }

  console.log(`Querying NFT balance for ${agent.wallet_address} at ${token_address}...`);

  try {
    // Verify that the token address is a contract
    const isTokenContract = await isContract(agent, token_address);
    if (!isTokenContract) {
      const errorMsg = `Address ${token_address} is not a contract`;
      throw new Error(errorMsg);
    }

    // Get the token balance
    const balance = await getBalance(agent, token_address);

    if (balance === null || balance === undefined) {
      const errorMsg = "Failed to retrieve token balance";
      throw new Error(errorMsg);
    }

    return String(balance);
  } catch (error) {
    const errorMsg = error instanceof Error ? error?.message : String(error);
    console.error(errorMsg);
    throw error;
  }
}
