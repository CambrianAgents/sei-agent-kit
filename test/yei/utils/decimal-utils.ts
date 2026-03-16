/**
 * YEI Finance Decimal Utilities for Testing
 * Provides precise decimal handling for financial calculations
 */

import { BigNumber } from 'ethers';

export const DECIMAL_PRECISION = 18;
export const DECIMAL_MULTIPLIER = BigNumber.from('10').pow(DECIMAL_PRECISION);

/**
 * Converts a number to BigNumber with 18 decimals
 */
export function toDecimal18(value: string | number): BigNumber {
  if (typeof value === 'number') {
    // Handle floating point precision by converting to string with fixed decimals
    value = value.toFixed(DECIMAL_PRECISION);
  }
  
  const [integer, decimal = '0'] = value.toString().split('.');
  const paddedDecimal = decimal.padEnd(DECIMAL_PRECISION, '0').slice(0, DECIMAL_PRECISION);
  
  return BigNumber.from(integer).mul(DECIMAL_MULTIPLIER).add(BigNumber.from(paddedDecimal));
}

/**
 * Converts BigNumber with 18 decimals to human readable string
 */
export function fromDecimal18(value: BigNumber, precision: number = 6): string {
  const integer = value.div(DECIMAL_MULTIPLIER);
  const remainder = value.mod(DECIMAL_MULTIPLIER);
  const decimal = remainder.toString().padStart(DECIMAL_PRECISION, '0');
  
  // Trim trailing zeros and limit precision
  const trimmedDecimal = decimal.replace(/0+$/, '').slice(0, precision);
  
  return trimmedDecimal ? `${integer}.${trimmedDecimal}` : integer.toString();
}

/**
 * Validates that a value has exactly 18 decimals
 */
export function validateDecimal18(value: BigNumber): boolean {
  // Check if value can be represented with 18 decimals
  const reconstructed = toDecimal18(fromDecimal18(value, DECIMAL_PRECISION));
  return value.eq(reconstructed);
}

/**
 * Calculates APR with precise decimal handling
 * @param principal Principal amount in wei (18 decimals)
 * @param reward Annual reward amount in wei (18 decimals)
 * @returns APR as percentage with 18 decimal precision
 */
export function calculateAPR(principal: BigNumber, reward: BigNumber): BigNumber {
  if (principal.eq(0)) {
    throw new Error('Principal cannot be zero for APR calculation');
  }
  
  // APR = (reward / principal) * 100
  // Using 18 decimal precision throughout
  const hundred = toDecimal18(100);
  return reward.mul(hundred).div(principal);
}

/**
 * Calculates reward based on principal and APR
 * @param principal Principal amount in wei (18 decimals)
 * @param apr APR as percentage with 18 decimals
 * @returns Reward amount in wei (18 decimals)
 */
export function calculateReward(principal: BigNumber, apr: BigNumber): BigNumber {
  const hundred = toDecimal18(100);
  return principal.mul(apr).div(hundred);
}

/**
 * Compounds rewards over time periods
 * @param principal Principal amount
 * @param apr Annual percentage rate
 * @param periods Number of compounding periods per year
 * @param time Time in years
 */
export function compoundRewards(
  principal: BigNumber,
  apr: BigNumber,
  periods: number,
  time: number
): BigNumber {
  const hundred = toDecimal18(100);
  const periodsPerYear = toDecimal18(periods);
  const timeInYears = toDecimal18(time);
  
  // Compound formula: P * (1 + r/n)^(n*t)
  // Where r = apr/100, n = periods, t = time
  const rate = apr.div(hundred);
  const periodicRate = rate.div(periodsPerYear);
  const one = toDecimal18(1);
  const compoundBase = one.add(periodicRate);
  
  // For simplicity in testing, we'll use linear approximation
  // In production, would use more sophisticated compound calculation
  const totalPeriods = periodsPerYear.mul(timeInYears).div(DECIMAL_MULTIPLIER);
  const growth = compoundBase.sub(one).mul(totalPeriods);
  
  return principal.add(principal.mul(growth).div(DECIMAL_MULTIPLIER));
}

/**
 * Test data generators for consistent decimal testing
 */
export class TestDataGenerator {
  static generateTestAmounts(): BigNumber[] {
    return [
      toDecimal18('0.000001'), // Micro amount
      toDecimal18('1'), // 1 token
      toDecimal18('100'), // 100 tokens
      toDecimal18('1000'), // 1K tokens
      toDecimal18('10000'), // 10K tokens
      toDecimal18('1000000'), // 1M tokens
      toDecimal18('1000000000'), // 1B tokens
    ];
  }
  
  static generateTestAPRs(): BigNumber[] {
    return [
      toDecimal18('0.01'), // 0.01%
      toDecimal18('1'), // 1%
      toDecimal18('5'), // 5%
      toDecimal18('10'), // 10%
      toDecimal18('25'), // 25%
      toDecimal18('50'), // 50%
      toDecimal18('100'), // 100%
    ];
  }
  
  static generateEdgeCases(): { principal: BigNumber; apr: BigNumber; description: string }[] {
    return [
      {
        principal: BigNumber.from(1), // 1 wei
        apr: toDecimal18('0.000001'),
        description: 'Minimum amounts'
      },
      {
        principal: toDecimal18('0.000000000000000001'), // 1 wei in decimal form
        apr: toDecimal18('100'),
        description: 'Minimum principal, high APR'
      },
      {
        principal: toDecimal18('1000000000000'), // Very large amount
        apr: toDecimal18('0.000001'),
        description: 'Large principal, tiny APR'
      }
    ];
  }
}

/**
 * Assertion helpers for decimal testing
 */
export class DecimalAssertions {
  static expectDecimal18(value: BigNumber, message?: string): void {
    if (!validateDecimal18(value)) {
      throw new Error(message || `Expected value to have 18 decimal precision: ${value.toString()}`);
    }
  }
  
  static expectApproxEqual(
    actual: BigNumber, 
    expected: BigNumber, 
    tolerance: BigNumber = toDecimal18('0.000001'),
    message?: string
  ): void {
    const diff = actual.gt(expected) ? actual.sub(expected) : expected.sub(actual);
    if (diff.gt(tolerance)) {
      throw new Error(
        message || 
        `Values not approximately equal. Actual: ${fromDecimal18(actual)}, Expected: ${fromDecimal18(expected)}, Diff: ${fromDecimal18(diff)}`
      );
    }
  }
}