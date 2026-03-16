import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  asset: z.string().describe("The asset to supply (e.g., 'SEI', 'USDT', 'USDC')"),
  amount: z.string().describe("The amount to supply in token units"),
  onBehalfOf: z.string().optional().describe("Address to supply on behalf of (optional)"),
});

export class SeiYeiSupplyTool extends Tool {
  name = "sei_yei_supply";
  description = "Supply assets to YEI Finance protocol to earn interest and YEI rewards (with 18-decimal precision)";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { supplyAssets } = await import("../../tools/yei/supply");
      
      const tx = await supplyAssets(
        this.seiKit,
        input.asset,
        input.amount,
        input.onBehalfOf
      );

      return JSON.stringify({
        success: true,
        message: `Successfully supplied ${input.amount} ${input.asset} to YEI Finance`,
        transactionHash: tx,
        details: {
          asset: input.asset,
          amount: input.amount,
          onBehalfOf: input.onBehalfOf || this.seiKit.address,
          rewardTokenDecimals: 18,
        }
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to supply assets to YEI Finance",
      });
    }
  }
}