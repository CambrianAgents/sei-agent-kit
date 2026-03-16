import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  asset: z.string().describe("The asset to withdraw (e.g., 'SEI', 'USDT', 'USDC')"),
  amount: z.string().describe("The amount to withdraw (use '-1' for max)"),
  to: z.string().optional().describe("Address to withdraw to (optional)"),
});

export class SeiYeiWithdrawTool extends Tool {
  name = "sei_yei_withdraw";
  description = "Withdraw supplied assets from YEI Finance protocol";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { withdrawAssets } = await import("../../tools/yei/supply");
      
      const tx = await withdrawAssets(
        this.seiKit,
        input.asset,
        input.amount,
        input.to
      );

      return JSON.stringify({
        success: true,
        message: `Successfully withdrew ${input.amount} ${input.asset} from YEI Finance`,
        transactionHash: tx,
        details: {
          asset: input.asset,
          amount: input.amount,
          to: input.to || this.seiKit.address,
        }
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to withdraw assets from YEI Finance",
      });
    }
  }
}