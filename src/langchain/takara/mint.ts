import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { mintTakara } from "../../tools/takara";

const SeiMintTakaraInputSchema = z.object({
  ticker: z
    .string()
    .describe("The ticker of the tToken to mint (e.g., tUSDC)"),
  mintAmount: z
    .string()
    .describe("The amount to mint in human-readable format (e.g., '100' for 100 USDC)"),
});

/**
 * LangChain tool for minting Takara tokens
 */
export class SeiMintTakaraTool extends StructuredTool<typeof SeiMintTakaraInputSchema> {
  name = "mint_takara";
  description = "Mints tTokens by depositing the underlying token into the Takara Protocol. For example, deposit USDC to mint tUSDC.";
  schema = SeiMintTakaraInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, mintAmount }: z.infer<typeof SeiMintTakaraInputSchema>): Promise<string> {
    try {
      const result = await mintTakara(this.seiKit, {
        ticker: ticker,
        mintAmount,
      });

      return JSON.stringify({
        status: "success",
        message: `Successfully minted tTokens. Transaction hash: ${result}.`,
        txHash: result,
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