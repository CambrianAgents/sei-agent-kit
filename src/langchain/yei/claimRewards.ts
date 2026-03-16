import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  assets: z.array(z.string()).optional().describe("Assets to claim rewards from (optional, claims all if not specified)"),
  to: z.string().optional().describe("Address to send rewards to (optional)"),
});

export class SeiYeiClaimRewardsTool extends Tool {
  name = "sei_yei_claim_rewards";
  description = "Claim YEI rewards from supplied or borrowed positions (with 18-decimal precision for accurate APR)";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { claimRewards, getUserRewards } = await import("../../tools/yei/rewards");
      
      // Get current rewards before claiming
      const rewardsBefore = await getUserRewards(this.seiKit, input.assets);
      
      const tx = await claimRewards(
        this.seiKit,
        input.assets,
        input.to
      );

      return JSON.stringify({
        success: true,
        message: `Successfully claimed YEI rewards`,
        transactionHash: tx,
        details: {
          assets: input.assets || "all",
          to: input.to || this.seiKit.address,
          rewardsClaimed: rewardsBefore,
          rewardTokenDecimals: 18,
          note: "All YEI rewards use 18 decimals for accurate APR calculations"
        }
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to claim YEI rewards",
      });
    }
  }
}