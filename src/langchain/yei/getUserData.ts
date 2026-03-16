import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { SeiAgentKit } from "../../agent";

const inputSchema = z.object({
  user: z.string().optional().describe("User address to query (optional, defaults to agent address)"),
});

export class SeiYeiGetUserDataTool extends Tool {
  name = "sei_yei_get_user_data";
  description = "Get comprehensive user data from YEI Finance including positions, health factor, and rewards";
  schema = inputSchema;

  constructor(private seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof inputSchema>
  ): Promise<string> {
    try {
      const { getUserSupplyData } = await import("../../tools/yei/supply");
      const { getUserBorrowData } = await import("../../tools/yei/borrow");
      const { getUserRewards } = await import("../../tools/yei/rewards");
      
      const userAddress = input.user || this.seiKit.address;
      
      // Get all user data in parallel
      const [supplyData, borrowData, rewards] = await Promise.all([
        getUserSupplyData(this.seiKit, userAddress),
        getUserBorrowData(this.seiKit, userAddress),
        getUserRewards(this.seiKit),
      ]);

      return JSON.stringify({
        success: true,
        userData: {
          address: userAddress,
          supply: supplyData,
          borrow: borrowData,
          rewards: {
            ...rewards,
            decimals: 18,
            note: "All YEI rewards use 18 decimals"
          },
          healthFactor: supplyData.healthFactor,
          borrowingCapacity: supplyData.availableBorrowsBase,
        }
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Failed to get user data from YEI Finance",
      });
    }
  }
}