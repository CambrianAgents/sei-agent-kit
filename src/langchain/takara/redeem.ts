import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { redeemTakara } from "../../tools/takara";
import { Address } from "viem";

const SeiRedeemTakaraInputSchema = z.object({
  ticker: z
    .string()
    .describe("The ticker of the tToken to redeem (e.g., tUSDC)"),
  redeemAmount: z
    .string()
    .describe("The amount to redeem in human-readable format (e.g., '50' for 50 USDC). Use 'MAX' to redeem all tTokens"),
  redeemType: z
    .enum(["underlying", "tokens"])
    .optional()
    .describe("Optional: The type of redemption - 'underlying' to redeem a specific amount of underlying tokens, or 'tokens' to redeem a specific amount of tTokens. Defaults to 'underlying'"),
});

/**
 * LangChain tool for redeeming Takara tokens
 */
export class SeiRedeemTakaraTool extends StructuredTool<typeof SeiRedeemTakaraInputSchema> {
  name = "redeem_takara";
  description = "Redeems tTokens from the Takara Protocol to get underlying tokens back. Use 'MAX' as redeemAmount to redeem all available tokens.";
  schema = SeiRedeemTakaraInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, redeemAmount, redeemType = "underlying" }: z.infer<typeof SeiRedeemTakaraInputSchema>): Promise<string> {
    try {
      const result = await redeemTakara(this.seiKit, {
        ticker: ticker,
        redeemAmount,
        redeemType,
      });

      let message = `Redeem transaction hash: ${result.txHash}.`;
      if (result.success) {
        message += ` Successfully redeemed ${result.redeemedAmount} tokens.`;
      } else {
        message += ` Warning: Expected to receive ${result.expected} tokens but got ${result.actual}. This may indicate an issue with the redemption.`;
      }

      return JSON.stringify({
        status: "success",
        success: result.success,
        message,
        txHash: result.txHash,
        redeemedAmount: result.redeemedAmount,
        expected: result.expected,
        actual: result.actual,
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