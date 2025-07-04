import { ContractsConfig } from "@bancor/carbon-sdk/contracts-api";
import {
  calculateOverlappingPrices,
  Toolkit,
} from "@bancor/carbon-sdk/strategy-management";
import { SeiAgentKit } from "../../agent";
import { Address } from "viem";
import { approveToken, getTokenDecimals } from "../../utils";
import { Decimal } from "@bancor/carbon-sdk/utils";

const CARBON_NATIVE_SEI_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Disposable/recurring defaults
const DEFAULT_SPREAD_INNER = 0.01; // %
const DEFAULT_SPREAD_OUTER = 0.05; // %

export const UINT256_MAX = (1n << 256n) - 1n; // For infinite approvals

export const carbonConfig: ContractsConfig = {
  carbonControllerAddress: "0xe4816658ad10bF215053C533cceAe3f59e1f1087",
  multiCallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
  voucherAddress: "0xA4682A2A5Fe02feFF8Bd200240A41AD0E6EaF8d5",
  carbonBatcherAddress: "0x30dd96D6B693F78730C7C48b6849d9C44CAF39f0",
};

export type StrategyType = "disposable" | "recurring";

async function fetchTokenPrice(tokenAddress: string): Promise<Decimal> {
  try {
    const response = await fetch(
      `https://api.carbondefi.xyz/v1/sei/market-rate?address=${tokenAddress}&convert=usd`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { data } = await response.json();

    if (!data || !data?.USD || isNaN(Number(data.USD))) {
      throw new Error("Invalid price data received from API");
    }
    return new Decimal(data.USD);
  } catch (error) {
    throw new Error(
      `Failed to fetch price for token ${tokenAddress} : ${error}`,
    );
  }
}

async function getMarketPrice(baseToken: string, quoteToken: string) {
  const baseTokenPrice = await fetchTokenPrice(baseToken);
  const quoteTokenPrice = await fetchTokenPrice(quoteToken);

  const marketPrice = quoteTokenPrice.eq(0)
    ? "0"
    : baseTokenPrice.div(quoteTokenPrice).toString();

  return marketPrice;
}

async function getBuySellRange(
  baseToken: string,
  quoteToken: string,
  buyRange: string | string[] | undefined,
  sellRange: string | string[] | undefined,
): Promise<{
  buyPriceLow: string;
  buyPriceMarginal: string;
  buyPriceHigh: string;
  sellPriceLow: string;
  sellPriceMarginal: string;
  sellPriceHigh: string;
}> {
  if (buyRange && sellRange) {
    const [buyMin, buyMax] = Array.isArray(buyRange)
      ? buyRange
      : [buyRange, buyRange];
    const [sellMin, sellMax] = Array.isArray(sellRange)
      ? sellRange
      : [sellRange, sellRange];

    const buyRangeSorted = [buyMin, buyMax].sort((a, b) =>
      new Decimal(a).sub(new Decimal(b)).toNumber(),
    );

    const sellRangeSorted = [sellMin, sellMax].sort((a, b) =>
      new Decimal(a).sub(new Decimal(b)).toNumber(),
    );

    return {
      buyPriceLow: buyRangeSorted[0].toString(),
      buyPriceMarginal: buyRangeSorted[1].toString(),
      buyPriceHigh: buyRangeSorted[1].toString(),
      sellPriceLow: sellRangeSorted[0].toString(),
      sellPriceMarginal: sellRangeSorted[0].toString(),
      sellPriceHigh: sellRangeSorted[1].toString(),
    };
  }

  // Fetch market prices if ranges are not provided
  try {
    const marketPrice = await getMarketPrice(baseToken, quoteToken);

    // Calculate ranges based on market price and spread
    const buyLow = new Decimal(marketPrice).mul(1 - DEFAULT_SPREAD_OUTER);
    const buyHigh = new Decimal(marketPrice).mul(1 - DEFAULT_SPREAD_INNER);
    const sellLow = new Decimal(marketPrice).mul(1 + DEFAULT_SPREAD_INNER);
    const sellHigh = new Decimal(marketPrice).mul(1 + DEFAULT_SPREAD_OUTER);

    return {
      buyPriceLow: buyLow.toString(),
      buyPriceMarginal: buyHigh.toString(),
      buyPriceHigh: buyHigh.toString(),
      sellPriceLow: sellLow.toString(),
      sellPriceMarginal: sellLow.toString(),
      sellPriceHigh: sellHigh.toString(),
    };
  } catch (error) {
    console.error("Error fetching token prices:", error);
    throw new Error("Failed to calculate price ranges");
  }
}

export async function getStrategyTypeParams(
  type: StrategyType,
  baseToken: string,
  quoteToken: string,
  buyBudget: string | undefined,
  sellBudget: string | undefined,
  buyRange: string | string[] | undefined,
  sellRange: string | string[] | undefined,
): Promise<{
  buyPriceLow: string;
  buyPriceMarginal: string;
  buyPriceHigh: string;
  sellPriceLow: string;
  sellPriceMarginal: string;
  sellPriceHigh: string;
  buyBudget: string;
  sellBudget: string;
}> {
  // Disposable strategy only has one buy or one sell order
  if (type === "disposable") {
    if (buyBudget !== undefined && sellBudget !== undefined) {
      throw new Error(
        "Disposable strategy can only have one of buyBudget or sellBudget defined",
      );
    }
    if (buyBudget === undefined && sellBudget === undefined) {
      throw new Error(
        "Disposable strategy must have either buyBudget or sellBudget defined",
      );
    }

    const strategyTypeParams = await getBuySellRange(
      baseToken,
      quoteToken,
      buyRange ?? "0",
      sellRange ?? "0",
    );

    return {
      ...strategyTypeParams,
      buyBudget: buyBudget || "0",
      sellBudget: sellBudget || "0",
    };
  }

  // Recurring strategy has a buy and sell range defined
  if (!buyRange || !sellRange) {
    throw new Error("Recurring strategy requires both budgets to be defined");
  }

  const strategyTypeParams = await getBuySellRange(
    baseToken,
    quoteToken,
    buyRange,
    sellRange,
  );
  return {
    ...strategyTypeParams,
    buyBudget: buyBudget || "0",
    sellBudget: sellBudget || "0",
  };
}

async function getOverlappingPrices(
  baseToken: string,
  quoteToken: string,
  buyPriceLow: string | undefined,
  sellPriceHigh: string | undefined,
  marketPriceOverride: string | undefined,
  range: number,
) {
  console.log(`getOverlappingPrices params:
  baseToken: ${baseToken},
  quoteToken: ${quoteToken},
  buyPriceLow: ${buyPriceLow},
  sellPriceHigh: ${sellPriceHigh},
  marketPriceOverride: ${marketPriceOverride},
  range: ${range},
    `);

  const marketPrice =
    marketPriceOverride ?? (await getMarketPrice(baseToken, quoteToken));

  if (buyPriceLow && sellPriceHigh) {
    return {
      buyPriceLow,
      sellPriceHigh,
      marketPrice,
    };
  }

  if (!buyPriceLow && !sellPriceHigh) {
    const newBuyPriceLow = new Decimal(marketPrice)
      .mul(100 - range)
      .div(100)
      .toString();
    const newSellPriceHigh = new Decimal(marketPrice)
      .mul(100 + range)
      .div(100)
      .toString();

    return {
      buyPriceLow: newBuyPriceLow,
      sellPriceHigh: newSellPriceHigh,
      marketPrice,
    };
  }

  const marketPriceBN = new Decimal(marketPrice);
  const sellPriceHighBN = new Decimal(sellPriceHigh || 0);
  const buyPriceLowBN = new Decimal(buyPriceLow || 0);

  // Only one of buyPriceLow or sellPriceHigh is undefined
  const newBuyPriceLow =
    buyPriceLow ??
    marketPriceBN.sub(sellPriceHighBN.sub(marketPriceBN)).toString();
  const newSellPriceHigh =
    sellPriceHigh ??
    marketPriceBN.add(marketPriceBN.sub(buyPriceLowBN)).toString();

  return {
    buyPriceLow: newBuyPriceLow,
    sellPriceHigh: newSellPriceHigh,
    marketPrice,
  };
}

async function getOverlappingBudgets(
  carbonSDK: Toolkit,
  baseToken: string,
  quoteToken: string,
  buyPriceLow: string,
  sellPriceHigh: string,
  buyBudget: string | undefined,
  sellBudget: string | undefined,
  marketPrice: string,
  fee: number,
) {
  if (!buyBudget && !sellBudget) {
    throw new Error(
      "Overlapping strategy requires at least one budget to be defined",
    );
  }

  // Overlapping is created around market price with the passed input range
  let overlappingBuyBudget: string | undefined;
  let overlappingSellBudget: string | undefined;

  console.log(`sellBudget is ${sellBudget} and buyBudget is ${buyBudget}`);

  // Calculate budgets based on which one is defined
  if (sellBudget) {
    overlappingBuyBudget =
      await carbonSDK.calculateOverlappingStrategyBuyBudget(
        baseToken,
        quoteToken,
        buyPriceLow,
        sellPriceHigh,
        marketPrice,
        String(fee),
        sellBudget,
      );
    if (!buyBudget) {
      return {
        buyBudget: overlappingBuyBudget,
        sellBudget,
      };
    }
  }
  if (buyBudget) {
    overlappingSellBudget =
      await carbonSDK.calculateOverlappingStrategySellBudget(
        baseToken,
        quoteToken,
        buyPriceLow,
        sellPriceHigh,
        marketPrice,
        String(fee),
        buyBudget,
      );
    if (!sellBudget) {
      return {
        buyBudget,
        sellBudget: overlappingSellBudget,
      };
    }
  }

  // If both budgets are defined, use the smaller one
  const overlappingSellBudgetDecimal = new Decimal(overlappingSellBudget || 0);
  const isBuyBudgetSmaller = overlappingSellBudgetDecimal.lt(
    new Decimal(sellBudget || 0),
  );
  const parsedBuyBudget = isBuyBudgetSmaller ? buyBudget : overlappingBuyBudget;
  const parsedSellBudget = isBuyBudgetSmaller
    ? overlappingSellBudget
    : sellBudget;

  return {
    buyBudget: parsedBuyBudget || "0",
    sellBudget: parsedSellBudget || "0",
  };
}

export async function getOverlappingStrategyParams(
  carbonSDK: Toolkit,
  baseToken: string,
  quoteToken: string,
  buyPriceLowRaw: string | undefined,
  sellPriceHighRaw: string | undefined,
  buyBudgetRaw: string | undefined,
  sellBudgetRaw: string | undefined,
  fee: number,
  range: number,
  marketPriceOverride: string | undefined,
): Promise<{
  buyPriceLow: string;
  buyPriceMarginal: string;
  buyPriceHigh: string;
  sellPriceLow: string;
  sellPriceMarginal: string;
  sellPriceHigh: string;
  buyBudget: string;
  sellBudget: string;
}> {
  const {
    buyPriceLow: parsedBuyPriceLow,
    sellPriceHigh: parsedSellPriceHigh,
    marketPrice: parsedMarketPrice,
  } = await getOverlappingPrices(
    baseToken,
    quoteToken,
    buyPriceLowRaw,
    sellPriceHighRaw,
    marketPriceOverride,
    range,
  );

  console.log(`getOverlappingPrices result:
  parsedBuyPriceLow: ${parsedBuyPriceLow},
  parsedSellPriceHigh: ${parsedSellPriceHigh},
  parsedMarketPrice: ${parsedMarketPrice},
    `);

  const {
    buyPriceLow,
    buyPriceHigh,
    buyPriceMarginal,
    sellPriceLow,
    sellPriceHigh,
    sellPriceMarginal,
    marketPrice: finalMarketPrice,
  } = calculateOverlappingPrices(
    parsedBuyPriceLow,
    parsedSellPriceHigh,
    parsedMarketPrice,
    String(fee),
  );

  const { buyBudget, sellBudget } = await getOverlappingBudgets(
    carbonSDK,
    baseToken,
    quoteToken,
    buyPriceLow,
    sellPriceHigh,
    buyBudgetRaw,
    sellBudgetRaw,
    finalMarketPrice,
    fee,
  );

  return {
    buyPriceLow,
    buyPriceMarginal,
    buyPriceHigh,
    sellPriceLow,
    sellPriceMarginal,
    sellPriceHigh,
    buyBudget,
    sellBudget,
  };
}

export const getAllTokenDecimals = async (
  agent: SeiAgentKit,
  tokenAddress: Address,
) => {
  if (tokenAddress === CARBON_NATIVE_SEI_ADDRESS) {
    return 18;
  }

  return getTokenDecimals(agent, tokenAddress);
};

export const getCarbonTokenAddress = async (
  seiKit: SeiAgentKit,
  tokenTicker: string,
): Promise<Address> => {
  if (tokenTicker === "SEI") {
    return CARBON_NATIVE_SEI_ADDRESS;
  }

  const address = await seiKit.getTokenAddressFromTicker(tokenTicker);
  if (address === null) {
    throw new Error("Cannot find token address");
  }
  return address;
};

export const carbonERC20InfiniteApproval = (
  agent: SeiAgentKit,
  tokenAddress: Address,
  spender: Address,
) => {
  if (tokenAddress !== CARBON_NATIVE_SEI_ADDRESS) {
    approveToken(agent, tokenAddress, spender, UINT256_MAX);
  }
};
