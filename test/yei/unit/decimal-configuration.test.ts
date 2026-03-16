/**
 * YEI Finance - Decimal Configuration Tests
 * Critical tests ensuring YEI rewards always use 18 decimals
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber } from 'ethers';
import { 
  toDecimal18, 
  fromDecimal18, 
  validateDecimal18, 
  DECIMAL_PRECISION,
  TestDataGenerator 
} from '../utils/decimal-utils';
import MockAaveClient from '../mocks/aave-sdk-mock';

describe('YEI Finance - Decimal Configuration', () => {
  let mockClient: MockAaveClient;

  beforeEach(() => {
    mockClient = new MockAaveClient();
  });

  describe('Decimal Precision Requirements', () => {
    it('should enforce 18 decimal precision for YEI token', async () => {
      const yeiReserve = await mockClient.getReserveData('YEI');
      
      expect(yeiReserve.decimals).toBe(18);
      expect(DECIMAL_PRECISION).toBe(18);
    });

    it('should validate that all YEI amounts use 18 decimals', () => {
      const testAmounts = [
        '1',
        '0.000000000000000001', // 1 wei
        '1000000.123456789012345678',
        '999999999999999999.999999999999999999'
      ];

      testAmounts.forEach(amount => {
        const decimal18Amount = toDecimal18(amount);
        expect(validateDecimal18(decimal18Amount)).toBe(true);
        
        // Ensure precision is not lost in conversion
        const converted = fromDecimal18(decimal18Amount, 18);
        expect(parseFloat(converted)).toBeCloseTo(parseFloat(amount), 15);
      });
    });

    it('should reject non-18 decimal configurations', () => {
      expect(() => {
        mockClient.setReserveData('YEI', { decimals: 6 });
        mockClient.validateYEIConfiguration();
      }).not.toThrow(); // Mock allows setting, but validation should fail
      
      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('YEI token must have 18 decimals, found: 6');
    });

    it('should handle edge cases with 18 decimal precision', () => {
      const edgeCases = [
        BigNumber.from('1'), // 1 wei
        toDecimal18('0.000000000000000001'), // Smallest representable
        toDecimal18('1000000000000'), // Very large number
      ];

      edgeCases.forEach(amount => {
        expect(validateDecimal18(amount)).toBe(true);
        
        // Should be able to convert back and forth without precision loss
        const asString = fromDecimal18(amount, 18);
        const backToDecimal = toDecimal18(asString);
        expect(amount.eq(backToDecimal)).toBe(true);
      });
    });
  });

  describe('Decimal Conversion Accuracy', () => {
    it('should maintain precision in string to BigNumber conversion', () => {
      const testCases = [
        { input: '1.5', expected: '1.500000000000000000' },
        { input: '0.000000000000000001', expected: '0.000000000000000001' },
        { input: '123456789.987654321', expected: '123456789.987654321000000000' },
      ];

      testCases.forEach(({ input, expected }) => {
        const decimal18 = toDecimal18(input);
        const output = fromDecimal18(decimal18, 18);
        expect(output).toBe(expected);
      });
    });

    it('should handle number to decimal conversion properly', () => {
      const testNumbers = [1, 1.5, 0.000001, 1000000];
      
      testNumbers.forEach(num => {
        const decimal18 = toDecimal18(num);
        expect(validateDecimal18(decimal18)).toBe(true);
        
        const converted = parseFloat(fromDecimal18(decimal18, 10));
        expect(converted).toBeCloseTo(num, 6);
      });
    });

    it('should preserve precision in mathematical operations', () => {
      const a = toDecimal18('1.333333333333333333');
      const b = toDecimal18('2.666666666666666667');
      
      const sum = a.add(b);
      const difference = b.sub(a);
      
      expect(validateDecimal18(sum)).toBe(true);
      expect(validateDecimal18(difference)).toBe(true);
      
      expect(fromDecimal18(sum, 18)).toBe('4.000000000000000000');
      expect(fromDecimal18(difference, 18)).toBe('1.333333333333333334');
    });
  });

  describe('YEI Configuration Validation', () => {
    it('should validate complete YEI token configuration', () => {
      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid rate configurations', () => {
      // Set invalid rates (negative)
      mockClient.setReserveData('YEI', {
        liquidityRate: BigNumber.from('-1')
      });

      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid rate detected'))).toBe(true);
    });

    it('should detect extremely high rate configurations', () => {
      // Set unrealistically high rate (>1000%)
      mockClient.setReserveData('YEI', {
        liquidityRate: toDecimal18('1001')
      });

      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(false);
    });

    it('should validate incentive rates are within bounds', () => {
      const yeiIncentives = mockClient['incentiveData'].get('YEI');
      expect(yeiIncentives).toBeDefined();
      
      if (yeiIncentives) {
        expect(yeiIncentives.aTokenIncentivesAPR.lte(toDecimal18('100'))).toBe(true);
        expect(yeiIncentives.vTokenIncentivesAPR.lte(toDecimal18('100'))).toBe(true);
        expect(yeiIncentives.sTokenIncentivesAPR.lte(toDecimal18('100'))).toBe(true);
        
        expect(yeiIncentives.aTokenIncentivesAPR.gte(BigNumber.from('0'))).toBe(true);
        expect(yeiIncentives.vTokenIncentivesAPR.gte(BigNumber.from('0'))).toBe(true);
        expect(yeiIncentives.sTokenIncentivesAPR.gte(BigNumber.from('0'))).toBe(true);
      }
    });
  });

  describe('Cross-Asset Decimal Compatibility', () => {
    it('should handle different asset decimals correctly', async () => {
      const usdcReserve = await mockClient.getReserveData('USDC'); // 6 decimals
      const ethReserve = await mockClient.getReserveData('ETH');   // 18 decimals
      const yeiReserve = await mockClient.getReserveData('YEI');   // 18 decimals

      expect(usdcReserve.decimals).toBe(6);
      expect(ethReserve.decimals).toBe(18);
      expect(yeiReserve.decimals).toBe(18);

      // All rates should still be in 18 decimal format regardless of underlying asset decimals
      expect(validateDecimal18(usdcReserve.liquidityRate)).toBe(true);
      expect(validateDecimal18(ethReserve.liquidityRate)).toBe(true);
      expect(validateDecimal18(yeiReserve.liquidityRate)).toBe(true);
    });

    it('should convert between asset decimals and internal decimals', () => {
      // Simulate USDC (6 decimals) to internal 18 decimal conversion
      const usdcAmount = '1000.123456'; // 6 decimal places
      const internalAmount = toDecimal18(usdcAmount);
      
      expect(validateDecimal18(internalAmount)).toBe(true);
      
      // Convert back should preserve precision up to 6 decimals
      const backToUsdc = fromDecimal18(internalAmount, 6);
      expect(backToUsdc).toBe(usdcAmount);
    });
  });

  describe('Test Data Generator Validation', () => {
    it('should generate valid 18-decimal test amounts', () => {
      const amounts = TestDataGenerator.generateTestAmounts();
      
      amounts.forEach(amount => {
        expect(validateDecimal18(amount)).toBe(true);
        expect(amount.gte(BigNumber.from('0'))).toBe(true);
      });
    });

    it('should generate valid 18-decimal APR values', () => {
      const aprs = TestDataGenerator.generateTestAPRs();
      
      aprs.forEach(apr => {
        expect(validateDecimal18(apr)).toBe(true);
        expect(apr.gte(BigNumber.from('0'))).toBe(true);
        expect(apr.lte(toDecimal18('100'))).toBe(true); // Reasonable APR range
      });
    });

    it('should generate valid edge case scenarios', () => {
      const edgeCases = TestDataGenerator.generateEdgeCases();
      
      edgeCases.forEach(({ principal, apr, description }) => {
        expect(validateDecimal18(principal)).toBe(true);
        expect(validateDecimal18(apr)).toBe(true);
        expect(principal.gt(BigNumber.from('0'))).toBe(true);
        expect(apr.gte(BigNumber.from('0'))).toBe(true);
        expect(typeof description).toBe('string');
      });
    });
  });
});