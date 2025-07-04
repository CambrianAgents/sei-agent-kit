import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { carbonConfig } from "../../tools/carbon/utils";

const DeleteStrategyInputSchema = z.object({
  strategyId: z.string(),
});

export class CarbonDeleteStrategyTool extends StructuredTool<
  typeof DeleteStrategyInputSchema
> {
  name = "carbon_delete_strategy";
  description = `Deletes a Carbon strategy.
  
  Parameters:
  - strategyId: The strategy Id of the strategy to delete.`;
  schema = DeleteStrategyInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(
    input: z.infer<typeof DeleteStrategyInputSchema>,
  ): Promise<string> {
    try {
      const result = await this.seiKit.deleteStrategy(
        carbonConfig,
        input.strategyId,
      );

      return JSON.stringify({
        status: "success",
        result,
        strategyId: input.strategyId,
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
