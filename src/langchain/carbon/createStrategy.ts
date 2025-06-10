import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { Address } from "viem";
import { carbonConfig } from "../../tools/carbon/utils";

const CreateStrategyInputSchema = z
  .object({
    type: z.enum(["disposable", "recurring"]),
    token0Ticker: z.string().min(1, "First token ticker must not be empty"),
    token1Ticker: z.string().min(1, "Second token ticker must not be empty"),
    sellRange: z
      .union([
        z.string(),
        z
          .array(z.string())
          .length(2, "Sell range array must be exactly 2 numbers"),
      ])
      .optional(),
    buyRange: z
      .union([
        z.string(),
        z
          .array(z.string())
          .length(2, "Sell range array must be exactly 2 numbers"),
      ])
      .optional(),
    sellAmount: z.string().optional(),
    buyAmount: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.sellAmount !== undefined && Number(data.sellAmount) > 1) ||
      (data.buyAmount !== undefined && Number(data?.buyAmount) > 1),
    {
      message: "At least one of sellAmount or buyAmount must be defined",
      path: ["sellAmount", "buyAmount"],
    },
  );

export class CarbonCreateStrategyTool extends StructuredTool<
  typeof CreateStrategyInputSchema
> {
  name = "carbon_create_strategy";
  description = `Creates a Carbon strategy. 
  If a buy or a sell range is not defined, USD prices will be used to achieve a +-1% spread.

  At least one of [buyAmount, sellAmount] must be defined.
  
  Parameters:
  - type: The type of Carbon strategy (disposable, recurring)
  - token0Ticker: The ticker symbol of the first token (e.g., "SEI").
  - token1Ticker: The ticker symbol of the second token (e.g., "USDC").
  - sellRange: Optional. The range to sell the first token for the second token as either a string value or a string array of length 2 (e.g., "1.5").
  - buyRange: Optional. The range to buy the first token for the second token as either a string value or a string array of length 2 (e.g., "1.5").
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
      const result = await this.seiKit.createBuySellStrategy(
        carbonConfig,
        input.type,
        input.token0Ticker as Address,
        input.token1Ticker as Address,
        input.buyRange,
        input.sellRange,
        input.buyAmount,
        input.sellAmount,
      );

      return JSON.stringify({
        status: "success",
        result,
        token0: input.token0Ticker,
        token1: input.token1Ticker,
        buyRange: input.buyRange,
        sellRange: input.sellRange,
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
