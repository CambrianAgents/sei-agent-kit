import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { carbonConfig, getCarbonTokenAddress } from "../../tools/carbon/utils";

const CreateStrategyDisposableInputSchema = z.object({
  token0Ticker: z.string().min(1, "First token ticker must not be empty"),
  token1Ticker: z.string().min(1, "Second token ticker must not be empty"),
  isSell: z.boolean(),
  range: z.union([
    z.string(),
    z.array(z.string()).length(2, "Sell range array must be exactly 2 numbers"),
  ]),
  amount: z.string(),
});

export class CarbonCreateDisposableStrategyTool extends StructuredTool<
  typeof CreateStrategyDisposableInputSchema
> {
  name = "carbon_create_disposable_strategy";
  description = `Creates a Disposable Carbon strategy. 
  
  Parameters:
  - token0Ticker: The ticker symbol of the first token (e.g., "SEI").
  - token1Ticker: The ticker symbol of the second token (e.g., "USDC").
  - isSell: True if you wish to sell token0 for token1, or false if you wish to sell token1 for token0.
  - range: Optional. The range to sell token0 if isSell is true or the range to sell token1 if isSell is false. Specified in token1 per token0 as either a string value or a string array of length 2 (e.g., "1.5").
  - amount: The amount of the token0 if isSell is true or token1 if isSell is false that you wish to sell, as a string (e.g., "100").`;
  schema = CreateStrategyDisposableInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof CreateStrategyDisposableInputSchema>,
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

      let buyRange: string | string[] | undefined,
        sellRange: string | string[] | undefined,
        buyAmount: string | undefined,
        sellAmount: string | undefined;

      if (input.isSell) {
        buyRange = undefined;
        buyAmount = undefined;
        sellRange = input.range;
        sellAmount = input.amount;
      } else {
        buyRange = input.range;
        buyAmount = input.amount;
        sellRange = undefined;
        sellAmount = undefined;
      }

      const result = await this.seiKit.createBuySellStrategy(
        carbonConfig,
        "disposable",
        token0Address,
        token1Address,
        buyRange,
        sellRange,
        buyAmount,
        sellAmount,
      );

      return JSON.stringify({
        status: "success",
        result,
        token0: input.token0Ticker,
        token1: input.token1Ticker,
        buyRange,
        sellRange,
        buyAmount,
        sellAmount,
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
