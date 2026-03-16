import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  asset: z.string().describe("The asset to repay (e.g., 'SEI', 'USDT', 'USDC')"),
  amount: z.string().describe("The amount to repay (use '-1' for full repayment)"),
  interestRateMode: z.enum(["stable", "variable"]).default("variable").describe("Interest rate mode"),
  onBehalfOf: z.string().optional().describe("Address to repay on behalf of (optional)"),
});

export class SeiYeiRepayTool extends Tool {
  name = "sei_yei_repay";
  description = "Repay borrowed assets to YEI Finance protocol";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { repayAssets } = await import("../../tools/yei/borrow");
      
      const tx = await repayAssets(
        this.seiKit,
        input.asset,
        input.amount,
        input.interestRateMode,
        input.onBehalfOf
      );

      return JSON.stringify({
        success: true,
        message: `Successfully repaid ${input.amount} ${input.asset} to YEI Finance`,
        transactionHash: tx,
        details: {
          asset: input.asset,
          amount: input.amount,
          interestRateMode: input.interestRateMode,
          onBehalfOf: input.onBehalfOf || this.seiKit.address,
        }
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to repay assets to YEI Finance",
      });
    }
  }
}