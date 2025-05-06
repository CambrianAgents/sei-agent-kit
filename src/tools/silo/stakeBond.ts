import { SeiAgentKit } from "../../index";
import { coins } from '@cosmjs/stargate';
import { getChainConfig } from '../../utils/chain';
import { seiBridge } from '../../utils/useSeiBridge';

/**
 * Stakes SEI tokens on the network
 * @param agent SeiAgentKit instance
 * @param amount Amount of SEI to stake as a string (e.g., "1.5" for 1.5 SEI)
 * @returns Transaction hash or error message
 */
export async function stakeSei(
  agent: SeiAgentKit,
  amount: string
): Promise<string> {
  console.log(`Staking ${amount} SEI...`);
  const amountNum = Number(amount);
  if (Number(await agent.getERC20Balance()) < amountNum) {
    console.log(`Insufficient balance of sei`);
    throw new Error("Insufficient balance");
  }
  if (isNaN(amountNum) || amountNum <= 0) {
    const errorMsg = `Invalid staking amount: ${amount}. Amount must be a positive number.`;
    throw new Error(errorMsg);
  }

  try {
    // Get the chain config for the desired network
    const chainConfig = getChainConfig('mainnet');
    if (!chainConfig) {
      throw new Error("Failed to get chain configuration for mainnet");
    }

    // Prepare the staking parameters
    const executeMsg = { bond: {} };
    // Convert to micro SEI (1 SEI = 10^6 usei)
    const microAmount = amountNum * 10 ** 6;
    if (!Number.isFinite(microAmount)) {
      throw new Error(`Amount conversion to micro SEI resulted in invalid value: ${microAmount}`);
    }

    const fundsMsg = coins(microAmount, 'usei');
    if (!fundsMsg) {
      throw new Error("Failed to create coins message");
    }

    // Execute the transaction using the agent's private key
    if (!seiBridge) {
      throw new Error("SEI bridge utility is not available");
    }

    const tx_hash = await seiBridge({
      agent,
      executeMsg,
      fundsMsg,
      chainConfig,
      amount,
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