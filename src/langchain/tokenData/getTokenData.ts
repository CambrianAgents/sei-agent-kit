import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";

const GetTokenDataInputSchema = z.object({
  ticker: z.string().describe("The ticker of the token to get data for"),
});

export class GetTokenDataTool extends StructuredTool<typeof GetTokenDataInputSchema> {
  name = "get_token_data";
  description = "Get token data for a given ticker. Never use SEI as a ticker";
  schema = GetTokenDataInputSchema;
  
  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker }: z.infer<typeof GetTokenDataInputSchema>): Promise<string> {
    try {
        if (!ticker) {
            throw new Error("ticker is required");
          }
        return JSON.stringify(await this.seiKit.getTokenData(ticker));
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}
