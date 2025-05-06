import { SeiAgentKit } from "../../index";
import { coins } from '@cosmjs/stargate';
import { getChainConfig } from '../../utils/chain';
import { seiBridge } from '../../utils/useSeiBridge';
import { sei } from 'viem/chains';
/**
 * Unstakes SEI tokens from the network
 * @param agent SeiAgentKit instance
 * @param amount Amount of SEI to unstake as a string (e.g., "1.5" for 1.5 SEI)
 * @returns Transaction hash or error message
 */
export async function unstakeSei(
  agent: SeiAgentKit,
  amount: string
): Promise<string> {
  console.log(`Unstaking ${amount} SEI...`);
  const amountNum = Number(amount);
  if (Number(await agent.getERC20Balance('0x5cf6826140c1c56ff49c808a1a75407cd1df9423')) < amountNum) {
    console.log(`Insufficient balance of isei`);
    throw new Error("Insufficient balance");
  }
  if (isNaN(amountNum) || amountNum <= 0) {
    const errorMsg = `Invalid unstaking amount: ${amount}. Amount must be a positive number.`;
    throw new Error(errorMsg);
  }

  try {
    // Get the chain config for the desired network
    const chainConfig = getChainConfig('mainnet');
    if (!chainConfig) {
      throw new Error("Failed to get chain configuration for mainnet");
    }

    if (!chainConfig.contractAddress) {
      throw new Error("Contract address is missing in chain configuration");
    }


    // Prepare the unstaking parameters
    const executeMsg = { queue_unbond: {} };

    // Convert to micro SEI using BigInt for safety with large numbers
    const microAmount = BigInt(Math.floor(amountNum * 10 ** 6));
    const fundsMsg = coins(microAmount.toString(), `factory/${chainConfig.contractAddress}/isei`);

    // Execute the transaction using the agent's private key
    if (!seiBridge) {
      throw new Error("SEI bridge utility is not available");
    }
    
    const tx_hash = await seiBridge({
      agent,
      executeMsg,
      fundsMsg,
      chainConfig,
    });

    if (!tx_hash) {
      throw new Error("Transaction was executed but no hash was returned");
    }

    return tx_hash;
  } catch (error) {
    const errorMsg = error instanceof Error ? error?.message : String(error);
    console.error(errorMsg);
    throw error;
  }
}