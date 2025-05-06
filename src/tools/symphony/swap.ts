import { SeiAgentKit } from "../../agent";
import { Symphony } from 'symphony-sdk/viem';
import { Address } from "viem";

/**
 * Swaps tokens using the Symphony aggregator
 * @param agent SeiAgentKit instance
 * @param amount The amount of tokens to swap as a string (e.g., "1.5")
 * @param tokenIn The address of the token to swap from
 * @param tokenOut The address of the token to swap to
 * @returns Transaction details as a string
 */
export async function swap(
  agent: SeiAgentKit,
  amount: string,
  tokenIn: Address,
  tokenOut: Address,
): Promise<string> {
  try {
    console.log(`Swapping ${amount} ${tokenIn} to ${tokenOut}...`);
    if (tokenIn === '0x0') {
      if (Number(await agent.getERC20Balance()) < Number(amount)) {
        console.log(`Insufficient balance of sei`);
        throw new Error("Insufficient balance");
      }
    }
    else if (Number(await agent.getERC20Balance(tokenIn)) < Number(amount)) {
      console.log(`Insufficient balance of ${tokenIn}`);
      throw new Error("Insufficient balance");
    }
    const symphonySDK = new Symphony({ walletClient: agent.walletClient });

    // Connect wallet client to Symphony SDK
    symphonySDK.connectWalletClient(agent.walletClient);

    // Get the route for the swap
    const route = await symphonySDK.getRoute(
      tokenIn,
      tokenOut,
      amount
    );
    // Check if approval is needed
    const isApproved = await route.checkApproval();
    if (!isApproved) {
      await route.giveApproval();
    }

    // Execute the swap
    const { swapReceipt } = await route.swap();

    return swapReceipt.transactionHash;
  } catch (err) {
    return JSON.stringify({
      status: "error",
      message: err instanceof Error ? err.message : String(err),
      code: err instanceof Error && 'code' in err ? (err as any).code : "UNKNOWN_ERROR"
    });
  }
} 