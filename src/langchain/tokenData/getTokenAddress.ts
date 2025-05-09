import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";

const GetTokenAddressInputSchema = z.object({
  ticker: z.string().min(1),
});

export class SeiGetTokenAddressTool extends StructuredTool<typeof GetTokenAddressInputSchema> {
  name = "get_token_address_from_ticker";
  description = `Retrieve a token's contract address by its ticker/symbol.
  
  Parameters:
  - ticker: The token ticker/symbol (e.g., "USDC", "ETH").
  Important: Never Use sei as a Ticker`;
  schema = GetTokenAddressInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof GetTokenAddressInputSchema>): Promise<string> {
    try {
      const tokenAddress = await this.seiKit.getTokenAddressFromTicker(input.ticker);

      return JSON.stringify({
        status: "success",
        tokenAddress,
        ticker: input.ticker,
      });
    }
    catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}
