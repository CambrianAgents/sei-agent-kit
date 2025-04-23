import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { borrowTakara } from "../../tools/takara";

const SeiBorrowTakaraInputSchema = z.object({
  ticker: z
    .string()
    .describe("The ticker of the tToken to borrow against (e.g., tUSDC)"),
  borrowAmount: z
    .string()
    .describe("The amount to borrow in human-readable format (e.g., '50' for 50 USDC)"),
});

/**
 * LangChain tool for borrowing against Takara tokens
 */
export class SeiBorrowTakaraTool extends StructuredTool<typeof SeiBorrowTakaraInputSchema> {
  name = "borrow_takara";
  description = "Borrows underlying tokens from the Takara Protocol using tTokens as collateral. For example, use tUSDC as collateral to borrow USDC.";
  schema = SeiBorrowTakaraInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, borrowAmount }: z.infer<typeof SeiBorrowTakaraInputSchema>): Promise<string> {
    try {
      if (!ticker) {
        throw new Error("ticker is required");
      }
      if (!borrowAmount) {
        throw new Error("borrowAmount is required");
      }

      const result = await borrowTakara(this.seiKit, {
        ticker: ticker,
        borrowAmount,
      });

      return JSON.stringify({
        status: "success",
        message: `Successfully borrowed tokens. Transaction hash: ${result}.`,
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