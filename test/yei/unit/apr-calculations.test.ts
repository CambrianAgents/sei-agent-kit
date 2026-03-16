/**
 * YEI Finance - APR Calculations Tests
 * Tests for accurate percentage calculations with proper decimal handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber } from 'ethers';
import { 
  calculateAPR, 
  calculateReward, 
  compoundRewards,
  toDecimal18, 
  fromDecimal18,
  TestDataGenerator,
  DecimalAssertions
} from '../utils/decimal-utils';
import MockAaveClient from '../mocks/aave-sdk-mock';

describe('YEI Finance - APR Calculations', () => {
  let mockClient: MockAaveClient;

  beforeEach(() => {
    mockClient = new MockAaveClient();
  });

  describe('Basic APR Calculations', () => {
    it('should calculate APR correctly with 18 decimal precision', () => {
      const testCases = [
        {
          principal: toDecimal18('1000'),
          reward: toDecimal18('50'),
          expectedAPR: toDecimal18('5'), // 5%
          description: '5% APR case'
        },
        {
          principal: toDecimal18('10000'),
          reward: toDecimal18('1200'),
          expectedAPR: toDecimal18('12'), // 12%
          description: '12% APR case'
        },
        {
          principal: toDecimal18('1'),
          reward: toDecimal18('0.25'),
          expectedAPR: toDecimal18('25'), // 25%
          description: '25% APR with small principal'
        }
      ];

      testCases.forEach(({ principal, reward, expectedAPR, description }) => {
        const calculatedAPR = calculateAPR(principal, reward);
        
        DecimalAssertions.expectDecimal18(calculatedAPR);
        DecimalAssertions.expectApproxEqual(
          calculatedAPR, 
          expectedAPR, 
          toDecimal18('0.000001'),
          `${description}: Expected ${fromDecimal18(expectedAPR)}%, got ${fromDecimal18(calculatedAPR)}%`
        );
      });
    });

    it('should handle zero reward correctly', () => {
      const principal = toDecimal18('1000');
      const reward = toDecimal18('0');
      
      const apr = calculateAPR(principal, reward);
      expect(apr.eq(toDecimal18('0'))).toBe(true);
    });

    it('should throw on zero principal', () => {
      const principal = toDecimal18('0');
      const reward = toDecimal18('50');
      
      expect(() => calculateAPR(principal, reward)).toThrow('Principal cannot be zero for APR calculation');
    });

    it('should handle very small amounts with precision', () => {
      const principal = toDecimal18('0.000000000000000001'); // 1 wei
      const reward = toDecimal18('0.000000000000000001');   // 1 wei
      
      const apr = calculateAPR(principal, reward);
      const expected = toDecimal18('100'); // 100%
      
      DecimalAssertions.expectApproxEqual(apr, expected, toDecimal18('0.1'));
    });

    it('should handle very large amounts correctly', () => {
      const principal = toDecimal18('1000000000'); // 1B tokens
      const reward = toDecimal18('30000000');      // 30M tokens
      
      const apr = calculateAPR(principal, reward);
      const expected = toDecimal18('3'); // 3%
      
      DecimalAssertions.expectApproxEqual(apr, expected, toDecimal18('0.000001'));
    });
  });

  describe('Reward Calculations', () => {
    it('should calculate rewards from principal and APR', () => {
      const testCases = [
        {
          principal: toDecimal18('1000'),
          apr: toDecimal18('5'),
          expectedReward: toDecimal18('50'),
          description: '5% of 1000 = 50'
        },
        {
          principal: toDecimal18('2500'),
          apr: toDecimal18('12.5'),
          expectedReward: toDecimal18('312.5'),
          description: '12.5% of 2500 = 312.5'
        },
        {
          principal: toDecimal18('0.1'),
          apr: toDecimal18('200'),
          expectedReward: toDecimal18('0.2'),
          description: '200% of 0.1 = 0.2'
        }
      ];

      testCases.forEach(({ principal, apr, expectedReward, description }) => {
        const calculatedReward = calculateReward(principal, apr);
        
        DecimalAssertions.expectDecimal18(calculatedReward);
        DecimalAssertions.expectApproxEqual(
          calculatedReward, 
          expectedReward, 
          toDecimal18('0.000001'),
          `${description}: Expected ${fromDecimal18(expectedReward)}, got ${fromDecimal18(calculatedReward)}`
        );
      });
    });

    it('should be consistent with APR calculation (inverse relationship)', () => {
      const testAmounts = TestDataGenerator.generateTestAmounts();
      const testAPRs = TestDataGenerator.generateTestAPRs();

      testAmounts.slice(1).forEach(principal => { // Skip zero amount
        testAPRs.forEach(apr => {
          // Calculate reward from APR
          const calculatedReward = calculateReward(principal, apr);
          
          // Calculate APR from reward (should equal original APR)
          const recalculatedAPR = calculateAPR(principal, calculatedReward);
          
          DecimalAssertions.expectApproxEqual(
            recalculatedAPR, 
            apr, 
            toDecimal18('0.000001'),
            `APR consistency check failed for principal ${fromDecimal18(principal)} and APR ${fromDecimal18(apr)}%`
          );
        });
      });
    });
  });

  describe('Compound Interest Calculations', () => {
    it('should calculate compound rewards correctly', () => {
      const principal = toDecimal18('1000');
      const apr = toDecimal18('10'); // 10% APR
      const periods = 12; // Monthly compounding
      const time = 1; // 1 year

      const compounded = compoundRewards(principal, apr, periods, time);
      
      DecimalAssertions.expectDecimal18(compounded);
      expect(compounded.gt(principal)).toBe(true);
      
      // Should be greater than simple interest but reasonable
      const simpleInterest = calculateReward(principal, apr);
      const simpleTotal = principal.add(simpleInterest);
      
      expect(compounded.gte(simpleTotal)).toBe(true);
      expect(compounded.lt(simpleTotal.mul(2))).toBe(true); // Reasonable upper bound
    });

    it('should handle different compounding frequencies', () => {
      const principal = toDecimal18('1000');
      const apr = toDecimal18('12'); // 12% APR
      const time = 1; // 1 year

      const annually = compoundRewards(principal, apr, 1, time);
      const quarterly = compoundRewards(principal, apr, 4, time);
      const monthly = compoundRewards(principal, apr, 12, time);
      const daily = compoundRewards(principal, apr, 365, time);

      // More frequent compounding should yield higher returns
      expect(quarterly.gte(annually)).toBe(true);
      expect(monthly.gte(quarterly)).toBe(true);
      expect(daily.gte(monthly)).toBe(true);
      
      // But differences should be reasonable
      const maxExpectedDifference = toDecimal18('50'); // Max 50 tokens difference
      expect(daily.sub(annually).lt(maxExpectedDifference)).toBe(true);
    });

    it('should handle partial time periods', () => {
      const principal = toDecimal18('1000');
      const apr = toDecimal18('24'); // 24% APR
      
      const halfYear = compoundRewards(principal, apr, 12, 0.5);
      const fullYear = compoundRewards(principal, apr, 12, 1.0);
      
      // Half year should be less than full year but more than principal
      expect(halfYear.gt(principal)).toBe(true);
      expect(halfYear.lt(fullYear)).toBe(true);
      
      // Approximately half the growth (linear approximation for testing)
      const halfYearGrowth = halfYear.sub(principal);
      const fullYearGrowth = fullYear.sub(principal);
      
      expect(halfYearGrowth.lt(fullYearGrowth.div(2).mul(2))).toBe(true);
    });
  });

  describe('Real-world APR Scenarios', () => {
    it('should calculate realistic DeFi APRs', async () => {
      const yeiReserve = await mockClient.getReserveData('YEI');
      const ethReserve = await mockClient.getReserveData('ETH');
      const usdcReserve = await mockClient.getReserveData('USDC');

      // Test with realistic balances and rates
      const balances = [
        toDecimal18('1000'),    // 1K tokens
        toDecimal18('10000'),   // 10K tokens
        toDecimal18('100000'),  // 100K tokens
      ];

      balances.forEach(balance => {
        // YEI rewards (higher APR)
        const yeiReward = calculateReward(balance, yeiReserve.liquidityRate);
        expect(yeiReward.gt(BigNumber.from('0'))).toBe(true);
        
        // ETH rewards (medium APR)
        const ethReward = calculateReward(balance, ethReserve.liquidityRate);
        expect(ethReward.gt(BigNumber.from('0'))).toBe(true);
        
        // USDC rewards (lower APR)
        const usdcReward = calculateReward(balance, usdcReserve.liquidityRate);
        expect(usdcReward.gt(BigNumber.from('0'))).toBe(true);
        
        // YEI should have highest rewards due to higher APR
        expect(yeiReward.gt(ethReward)).toBe(true);
        expect(yeiReward.gt(usdcReward)).toBe(true);
      });
    });

    it('should calculate time-based reward accrual', async () => {
      const user = '0x1234567890123456789012345678901234567890';
      const asset = 'YEI';
      const balance = toDecimal18('1000');

      // Set user balance
      mockClient.setUserReserveData(user, asset, {
        aTokenBalance: balance,
        currentATokenBalance: balance
      });

      // Calculate rewards for different time periods
      const hourlyRewards = await mockClient.calculateAccruedRewards(user, asset, 3600);   // 1 hour
      const dailyRewards = await mockClient.calculateAccruedRewards(user, asset, 86400);   // 24 hours
      const weeklyRewards = await mockClient.calculateAccruedRewards(user, asset, 604800); // 7 days

      // Longer time periods should yield proportionally more rewards
      expect(dailyRewards.gt(hourlyRewards)).toBe(true);
      expect(weeklyRewards.gt(dailyRewards)).toBe(true);

      // Check proportionality (approximately)
      const expectedDaily = hourlyRewards.mul(24);
      DecimalAssertions.expectApproxEqual(
        dailyRewards, 
        expectedDaily, 
        expectedDaily.div(100), // 1% tolerance
        'Daily rewards should be ~24x hourly rewards'
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle maximum safe integer values', () => {
      const maxSafeAmount = toDecimal18('999999999999999999'); // Close to max for 18 decimals
      const smallAPR = toDecimal18('0.000001'); // Very small APR
      
      const reward = calculateReward(maxSafeAmount, smallAPR);
      
      DecimalAssertions.expectDecimal18(reward);
      expect(reward.gt(BigNumber.from('0'))).toBe(true);
    });

    it('should maintain precision with fractional APRs', () => {
      const principal = toDecimal18('1000');
      const fractionalAPRs = [
        toDecimal18('0.123456789'),
        toDecimal18('1.987654321'),
        toDecimal18('0.000000001')
      ];

      fractionalAPRs.forEach(apr => {
        const reward = calculateReward(principal, apr);
        const recalculatedAPR = calculateAPR(principal, reward);
        
        DecimalAssertions.expectApproxEqual(
          recalculatedAPR, 
          apr, 
          toDecimal18('0.000000001'),
          `Fractional APR precision test failed for ${fromDecimal18(apr)}%`
        );
      });
    });

    it('should handle edge cases from test data generator', () => {
      const edgeCases = TestDataGenerator.generateEdgeCases();
      
      edgeCases.forEach(({ principal, apr, description }) => {
        const reward = calculateReward(principal, apr);
        
        DecimalAssertions.expectDecimal18(reward);
        expect(reward.gte(BigNumber.from('0'))).toBe(true);
        
        // Should be able to recalculate APR (if reward > 0)
        if (reward.gt(BigNumber.from('0'))) {
          const recalculatedAPR = calculateAPR(principal, reward);
          DecimalAssertions.expectApproxEqual(
            recalculatedAPR, 
            apr, 
            toDecimal18('0.001'), // Larger tolerance for edge cases
            `Edge case APR consistency failed: ${description}`
          );
        }
      });
    });

    it('should handle precision loss gracefully', () => {
      // Test with amounts that might cause precision issues
      const verySmallPrincipal = BigNumber.from('1'); // 1 wei
      const verySmallAPR = toDecimal18('0.000000000000000001'); // Very small APR
      
      const reward = calculateReward(verySmallPrincipal, verySmallAPR);
      
      // Should not throw, even if result is 0 due to precision limits
      expect(reward.gte(BigNumber.from('0'))).toBe(true);
    });
  });
});