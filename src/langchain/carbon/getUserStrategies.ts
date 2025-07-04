import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { carbonConfig } from "../../tools/carbon/utils";

const GetUserStrategiesInputSchema = z.object({});

export class CarbonGetUserStrategiesTool extends StructuredTool<
  typeof GetUserStrategiesInputSchema
> {
  name = "carbon_get_user_strategies";
  description = `Lists the User's strategies.
  
  No parameters required.`;
  schema = GetUserStrategiesInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(): Promise<string> {
    try {
      const result = await this.seiKit.getUserStrategies(
        carbonConfig,
        this.seiKit.wallet_address,
      );

      return JSON.stringify({
        status: "success",
        result,
        user: this.seiKit.wallet_address,
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}
