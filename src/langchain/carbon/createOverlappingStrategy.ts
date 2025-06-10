import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { Address } from "viem";
import { carbonConfig } from "../../tools/carbon/utils";

const CreateStrategyInputSchema = z.object({
  token0Ticker: z.string().min(1, "First token ticker must not be empty"),
  token1Ticker: z.string().min(1, "Second token ticker must not be empty"),
  buyPriceLow: z.string().optional(),
  sellPriceHigh: z.string().optional(),
  fee: z.number().default(1),
  sellAmount: z.string().optional(),
  buyAmount: z.string().optional(),
});

export class CarbonCreateStrategyTool extends StructuredTool<
  typeof CreateStrategyInputSchema
> {
  name = "carbon_create_overlapping_strategy";
  description = `Creates a Carbon overlapping (LP) strategy. 
  If either buyPriceLow or sellPriceHigh are not defined, USD prices will be used to achieve a +-10% range.

  
  Parameters:
  - token0Ticker: The ticker symbol of the first token (e.g., "SEI").
  - token1Ticker: The ticker symbol of the second token (e.g., "USDC").
  - sellPriceHigh: Optional. The maximum price as a string at which the first token will be sold for the second token. Priced in quote tokens per base token.
  - buyPriceLow: Optional. The minimum price as a string at which the second token will be sold for the first token. Priced in quote tokens per base token.
  - fee: Optional. The fee or spread number to set the strategy to, in percentage. Defaults to 1 (1%).
  - sellAmount: Optional. The amount of the first token to add as a string (e.g., "1.5").
  - buyAmount: Optional. The amount of the second token to add as a string (e.g., "100").`;
  schema = CreateStrategyInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof CreateStrategyInputSchema>,
  ): Promise<string> {
    try {
      const result = await this.seiKit.createOverlappingStrategy(
        carbonConfig,
        input.token0Ticker as Address,
        input.token1Ticker as Address,
        input.sellPriceHigh,
        input.buyPriceLow,
        input.buyAmount,
        input.sellAmount,
        input.fee,
      );

      return JSON.stringify({
        status: "success",
        result,
        token0: input.token0Ticker,
        token1: input.token1Ticker,
        buyPriceLow: input.buyPriceLow,
        sellPriceHigh: input.sellPriceHigh,
        buyAmount: input.buyAmount,
        sellAmount: input.sellAmount,
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
