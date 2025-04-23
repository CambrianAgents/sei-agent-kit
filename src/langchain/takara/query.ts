import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { getRedeemableAmount, getBorrowBalance } from "../../tools/takara";
import { Address } from "viem";

const SeiGetRedeemableAmountInputSchema = z.object({
  ticker: z
    .string()
    .describe("The address of the tToken (e.g., tUSDC)"),
  userAddress: z
    .string()
    .optional()
    .describe("Optional: The address of the user to check. Defaults to the agent's wallet address"),
});

/**
 * LangChain tool for querying redeemable amounts in Takara Protocol
 */
export class SeiGetRedeemableAmountTool extends StructuredTool<typeof SeiGetRedeemableAmountInputSchema> {
  name = "get_takara_redeemable_amount";
  description = "Calculates the amount of underlying tokens that can be redeemed by a user in the Takara Protocol.";
  schema = SeiGetRedeemableAmountInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, userAddress }: z.infer<typeof SeiGetRedeemableAmountInputSchema>): Promise<string> {
    try {
      const result = await getRedeemableAmount(this.seiKit, ticker, userAddress as Address);

      return JSON.stringify({
        status: "success",
        tTokenBalance: result.tTokenBalance,
        exchangeRate: result.exchangeRate,
        redeemableUnderlying: result.redeemableUnderlying,
        safeMaxRedeemable: result.safeMaxRedeemable,
        underlyingDecimals: result.underlyingDecimals,
        underlyingTokenAddress: result.underlyingTokenAddress,
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

const SeiGetBorrowBalanceInputSchema = z.object({
  ticker: z
    .string()
    .describe("The address of the tToken (e.g., tUSDC)"),
  userAddress: z
    .string()
    .optional()
    .describe("Optional: The address of the user to check. Defaults to the agent's wallet address"),
});

/**
 * LangChain tool for querying borrow balances in Takara Protocol
 */
export class SeiGetBorrowBalanceTool extends StructuredTool<typeof SeiGetBorrowBalanceInputSchema> {
  name = "get_takara_borrow_balance";
  description = "Retrieves the current borrow balance for a user in the Takara Protocol.";
  schema = SeiGetBorrowBalanceInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, userAddress }: z.infer<typeof SeiGetBorrowBalanceInputSchema>): Promise<string> {
    try {
      const result = await getBorrowBalance(this.seiKit, ticker, userAddress as Address);

      return JSON.stringify({
        status: "success",
        borrowBalance: result.borrowBalance,
        underlyingDecimals: result.underlyingDecimals,
        underlyingTokenAddress: result.underlyingTokenAddress,
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