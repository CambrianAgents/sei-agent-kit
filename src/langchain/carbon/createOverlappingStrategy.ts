import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { carbonConfig, getCarbonTokenAddress } from "../../tools/carbon/utils";

const CreateOverlappingStrategyInputSchema = z.object({
  token0Ticker: z.string().min(1, "First token ticker must not be empty"),
  token1Ticker: z.string().min(1, "Second token ticker must not be empty"),
  buyPriceLow: z.string().optional(),
  sellPriceHigh: z.string().optional(),
  fee: z.number().default(1),
  range: z.number().default(10),
  sellAmount: z.string().optional(),
  buyAmount: z.string().optional(),
  marketPriceOverride: z.string().optional(),
});

export class CarbonCreateOverlappingStrategyTool extends StructuredTool<
  typeof CreateOverlappingStrategyInputSchema
> {
  name = "carbon_create_overlapping_strategy";
  description = `Creates a Carbon overlapping (LP) strategy. 
  If either buyPriceLow or sellPriceHigh are not defined, USD prices will be used to achieve a +-10% range.

  
  Parameters:
  - token0Ticker: The ticker symbol of the first/base token (e.g., "SEI").
  - token1Ticker: The ticker symbol of the second/quote token (e.g., "USDC").
  - buyPriceLow: Optional. The minimum price as a string at which the second token will be sold for the first token. Priced in quote tokens per base token.
  - sellPriceHigh: Optional. The maximum price as a string at which the first token will be sold for the second token. Priced in quote tokens per base token.
  - fee: Optional. The fee or spread number in percentage to set the strategy to, in percentage. Defaults to 1 (1%).
  - range: Optional. The distance in percentage between the market price and the buyPriceLow, or the marketPrice and the sellPriceHigh. Defaults to 10%.
  - sellAmount: Optional. The amount of the first token to add as a string (e.g., "1.5").
  - buyAmount: Optional. The amount of the second token to add as a string (e.g., "100").
  - marketPriceOverride: Optional. If market price is not available, you must provide this value, in quote tokens per base token.`;
  schema = CreateOverlappingStrategyInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof CreateOverlappingStrategyInputSchema>,
  ): Promise<string> {
    try {
      const token0Address = await getCarbonTokenAddress(
        this.seiKit,
        input.token0Ticker,
      );
      const token1Address = await getCarbonTokenAddress(
        this.seiKit,
        input.token1Ticker,
      );

      const result = await this.seiKit.createOverlappingStrategy(
        carbonConfig,
        token0Address,
        token1Address,
        input.buyPriceLow,
        input.sellPriceHigh,
        input.buyAmount,
        input.sellAmount,
        input.fee,
        input.range,
        input.marketPriceOverride,
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
