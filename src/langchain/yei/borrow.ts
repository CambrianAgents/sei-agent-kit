import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  asset: z.string().describe("The asset to borrow (e.g., 'SEI', 'USDT', 'USDC')"),
  amount: z.string().describe("The amount to borrow in token units"),
  interestRateMode: z.enum(["stable", "variable"]).default("variable").describe("Interest rate mode"),
  onBehalfOf: z.string().optional().describe("Address to borrow on behalf of (optional)"),
});

export class SeiYeiBorrowTool extends Tool {
  name = "sei_yei_borrow";
  description = "Borrow assets from YEI Finance protocol against supplied collateral";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { borrowAssets } = await import("../../tools/yei/borrow");
      
      const tx = await borrowAssets(
        this.seiKit,
        input.asset,
        input.amount,
        input.interestRateMode,
        input.onBehalfOf
      );

      return JSON.stringify({
        success: true,
        message: `Successfully borrowed ${input.amount} ${input.asset} from YEI Finance`,
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
        error: error.message || "Failed to borrow assets from YEI Finance",
      });
    }
  }
}