import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";

const checkAvailableTokensSchema = z.object({
});

export class checkAvailableTokensTool extends StructuredTool<typeof checkAvailableTokensSchema> {
  name = "check_available_tokens";
  description = "Check the available tokens on sei that are available in symphony. These are not the totality of the tokens on Sei, just the ones for which the ticker is recognized.";
  schema = checkAvailableTokensSchema;
  
  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(): Promise<string> {
    try {
        return JSON.stringify(await this.seiKit.checkAvailableTokens());
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}
