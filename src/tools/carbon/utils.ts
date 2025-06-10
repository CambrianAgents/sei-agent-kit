import { ContractsConfig } from "@bancor/carbon-sdk/contracts-api";
import {
  calculateOverlappingPrices,
  Toolkit,
} from "@bancor/carbon-sdk/strategy-management";
import { BigNumber } from "ethers";

// Disposable/recurring defaults
const DEFAULT_SPREAD_INNER = 0.01; // %
const DEFAULT_SPREAD_OUTER = 0.05; // %

// Overlapping defaults
const DEFAULT_FEE = 1; // %
const DEFAULT_RANGE = 10; // % from market price

export const carbonConfig: ContractsConfig = {
  carbonControllerAddress: "0xe4816658ad10bF215053C533cceAe3f59e1f1087",
  multiCallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
  voucherAddress: "0xA4682A2A5Fe02feFF8Bd200240A41AD0E6EaF8d5",
  carbonBatcherAddress: "0x30dd96D6B693F78730C7C48b6849d9C44CAF39f0",
};

export type StrategyType = "disposable" | "recurring";

async function fetchTokenPrice(tokenAddress: string): Promise<BigNumber> {
  try {
    const response = await fetch(
      `https://api.carbondefi.xyz/v1/sei/market-rate?address=${tokenAddress}&convert=usd`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data.USD !== "number") {
      throw new Error("Invalid price data received from API");
    }
    return BigNumber.from(data.USD);
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

    const buyRangeBN = [buyMin, buyMax]
      .map(BigNumber.from)
      .sort((a, b) => a.sub(b).toNumber());

    const sellRangeBN = [sellMin, sellMax]
      .map(BigNumber.from)
      .sort((a, b) => a.sub(b).toNumber());

    return {
      buyPriceLow: buyRangeBN[0].toString(),
      buyPriceMarginal: buyRangeBN[1].toString(),
      buyPriceHigh: buyRangeBN[1].toString(),
      sellPriceLow: sellRangeBN[0].toString(),
      sellPriceMarginal: sellRangeBN[0].toString(),
      sellPriceHigh: sellRangeBN[1].toString(),
    };
  }

  // Fetch market prices if ranges are not provided
  try {
    const marketPrice = await getMarketPrice(baseToken, quoteToken);

    // Calculate ranges based on market price and spread
    const buyLow = BigNumber.from(marketPrice).mul(1 - DEFAULT_SPREAD_OUTER);
    const buyHigh = BigNumber.from(marketPrice).mul(1 - DEFAULT_SPREAD_INNER);
    const sellLow = BigNumber.from(marketPrice).mul(1 + DEFAULT_SPREAD_INNER);
    const sellHigh = BigNumber.from(marketPrice).mul(1 + DEFAULT_SPREAD_OUTER);

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
) {
  if (buyPriceLow && sellPriceHigh) {
    const marketPrice = BigNumber.from(sellPriceHigh)
      .sub(buyPriceLow)
      .div(2)
      .toString();
    return {
      buyPriceLow,
      sellPriceHigh,
      marketPrice,
    };
  }
  const marketPrice = await getMarketPrice(baseToken, quoteToken);

  if (!buyPriceLow && !sellPriceHigh) {
    const newPriceLow = BigNumber.from(marketPrice)
      .mul(100 - DEFAULT_RANGE)
      .div(100)
      .toString();
    const newPriceHigh = BigNumber.from(marketPrice)
      .mul(100 + DEFAULT_RANGE)
      .div(100)
      .toString();

    return {
      buyPriceLow: newPriceLow,
      sellPriceHigh: newPriceHigh,
      marketPrice,
    };
  }

  const marketPriceBN = BigNumber.from(marketPrice);
  const sellPriceHighBN = BigNumber.from(sellPriceHigh);
  const buyPriceLowBN = BigNumber.from(buyPriceLow);

  // Only one of buyPriceLow or sellPriceHigh is undefined
  const newBuyPriceLow =
    buyPriceLow ??
    marketPriceBN.sub(marketPriceBN.sub(sellPriceHighBN)).toString();
  const newSellPriceHigh =
    sellPriceHigh ??
    marketPriceBN.add(buyPriceLowBN.sub(marketPriceBN)).toString();

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
) {
  if (!buyBudget && !sellBudget) {
    throw new Error(
      "Overlapping strategy requires at least one budget to be defined",
    );
  }

  // Overlapping is created around market price with the passed input range
  let overlappingBuyBudget: string | undefined;
  let overlappingSellBudget: string | undefined;

  // Calculate budgets based on which one is defined
  if (sellBudget) {
    overlappingBuyBudget =
      await carbonSDK.calculateOverlappingStrategyBuyBudget(
        baseToken,
        quoteToken,
        buyPriceLow,
        sellPriceHigh,
        marketPrice,
        String(DEFAULT_RANGE),
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
        String(DEFAULT_RANGE),
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
  const isBuyBudgetSmaller =
    overlappingSellBudget &&
    BigNumber.from(overlappingSellBudget).lt(sellBudget || 0);
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
  );

  const spreadPercentage = fee ? String(fee) : String(DEFAULT_FEE);

  const {
    buyPriceLow,
    buyPriceHigh,
    buyPriceMarginal,
    sellPriceLow,
    sellPriceHigh,
    sellPriceMarginal,
    marketPrice,
  } = calculateOverlappingPrices(
    parsedBuyPriceLow,
    parsedSellPriceHigh,
    parsedMarketPrice,
    spreadPercentage,
  );

  const { buyBudget, sellBudget } = await getOverlappingBudgets(
    carbonSDK,
    baseToken,
    quoteToken,
    buyPriceLow,
    sellPriceHigh,
    buyBudgetRaw,
    sellBudgetRaw,
    marketPrice,
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
