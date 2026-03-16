import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  assets: z.array(z.string()).optional().describe("Assets to get APR data for (optional, gets all if not specified)"),
});

export class SeiYeiGetAPRDataTool extends Tool {
  name = "sei_yei_get_apr_data";
  description = "Get APR/APY data for YEI Finance assets including reward incentives (calculated with 18-decimal precision)";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { getAPRData } = await import("../../tools/yei/rewards");
      
      const aprData = await getAPRData(
        this.seiKit,
        input.assets
      );

      return JSON.stringify({
        success: true,
        aprData: {
          ...aprData,
          note: "All APR calculations use 18-decimal precision for YEI rewards",
          rewardTokenDecimals: 18,
        }
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to get APR data from YEI Finance",
      });
    }
  }
}