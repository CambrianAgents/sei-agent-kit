/**
 * YEI Finance Test Scenarios and Fixtures
 * Predefined test data for consistent testing across all test suites
 */

import { BigNumber } from 'ethers';
import { toDecimal18 } from '../utils/decimal-utils';

export interface TestScenario {
  name: string;
  description: string;
  setup: TestScenarioSetup;
  expected: TestScenarioExpected;
}

export interface TestScenarioSetup {
  users: TestUser[];
  assets: TestAsset[];
  operations: TestOperation[];
  timeAdvances?: number[]; // Time advances in seconds
}

export interface TestScenarioExpected {
  finalBalances?: Map<string, BigNumber>;
  totalRewards?: Map<string, BigNumber>;
  aprRanges?: Map<string, { min: BigNumber; max: BigNumber }>;
  errors?: string[];
}

export interface TestUser {
  address: string;
  description: string;
  initialBalances?: Map<string, BigNumber>;
}

export interface TestAsset {
  symbol: string;
  decimals: number;
  liquidityRate: BigNumber;
  borrowRate: BigNumber;
  incentiveRate: BigNumber;
}

export interface TestOperation {
  user: string;
  asset: string;
  type: 'supply' | 'withdraw' | 'borrow' | 'repay';
  amount: BigNumber;
  expectedSuccess: boolean;
  expectedError?: string;
}

/**
 * Standard test users for consistent testing
 */
export const TEST_USERS: TestUser[] = [
  {
    address: '0x1234567890123456789012345678901234567890',
    description: 'Whale User - Large amounts'
  },
  {
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    description: 'Regular User - Medium amounts'
  },
  {
    address: '0x9876543210987654321098765432109876543210',
    description: 'Small User - Small amounts'
  },
  {
    address: '0x1111111111111111111111111111111111111111',
    description: 'Edge Case User - Edge amounts'
  }
];

/**
 * Standard test assets with proper decimal configurations
 */
export const TEST_ASSETS: TestAsset[] = [
  {
    symbol: 'YEI',
    decimals: 18, // CRITICAL: Must be 18 for YEI
    liquidityRate: toDecimal18('15.0'), // 15% APY
    borrowRate: toDecimal18('18.5'), // 18.5% APR
    incentiveRate: toDecimal18('5.0') // 5% additional rewards
  },
  {
    symbol: 'ETH',
    decimals: 18,
    liquidityRate: toDecimal18('2.8'), // 2.8% APY
    borrowRate: toDecimal18('4.1'), // 4.1% APR
    incentiveRate: toDecimal18('1.5') // 1.5% additional rewards
  },
  {
    symbol: 'USDC',
    decimals: 6, // USDC has 6 decimals
    liquidityRate: toDecimal18('3.5'), // 3.5% APY
    borrowRate: toDecimal18('5.2'), // 5.2% APR
    incentiveRate: toDecimal18('2.0') // 2% additional rewards
  }
];

/**
 * Decimal precision test scenarios
 */
export const DECIMAL_TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Basic Decimal Precision',
    description: 'Test basic decimal precision handling with YEI token',
    setup: {
      users: [TEST_USERS[0]],
      assets: [TEST_ASSETS[0]], // YEI only
      operations: [
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('1000.123456789012345678'),
          expectedSuccess: true
        }
      ]
    },
    expected: {
      finalBalances: new Map([
        [TEST_USERS[0].address, toDecimal18('1000.123456789012345678')]
      ])
    }
  },
  {
    name: 'Edge Case Amounts',
    description: 'Test with very small and very large amounts',
    setup: {
      users: [TEST_USERS[0], TEST_USERS[1]],
      assets: [TEST_ASSETS[0]],
      operations: [
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: BigNumber.from('1'), // 1 wei
          expectedSuccess: true
        },
        {
          user: TEST_USERS[1].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('1000000000'), // 1B tokens
          expectedSuccess: true
        }
      ]
    },
    expected: {}
  }
];

/**
 * APR calculation test scenarios
 */
export const APR_TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Standard APR Calculations',
    description: 'Test APR calculations across different rates and amounts',
    setup: {
      users: [TEST_USERS[1]],
      assets: [TEST_ASSETS[0]],
      operations: [
        {
          user: TEST_USERS[1].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('10000'),
          expectedSuccess: true
        }
      ],
      timeAdvances: [365 * 24 * 3600] // 1 year
    },
    expected: {
      aprRanges: new Map([
        ['YEI', { min: toDecimal18('14.5'), max: toDecimal18('15.5') }]
      ])
    }
  },
  {
    name: 'Compound Interest Scenarios',
    description: 'Test compound interest calculations over various time periods',
    setup: {
      users: [TEST_USERS[0]],
      assets: [TEST_ASSETS[0]],
      operations: [
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('5000'),
          expectedSuccess: true
        }
      ],
      timeAdvances: [
        30 * 24 * 3600,  // 30 days
        60 * 24 * 3600,  // 60 days
        90 * 24 * 3600,  // 90 days
        365 * 24 * 3600  // 1 year
      ]
    },
    expected: {}
  }
];

/**
 * Multi-asset portfolio test scenarios
 */
export const PORTFOLIO_TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Diversified Portfolio',
    description: 'Test portfolio with multiple assets and different decimal configurations',
    setup: {
      users: [TEST_USERS[0]],
      assets: TEST_ASSETS,
      operations: [
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('1000'),
          expectedSuccess: true
        },
        {
          user: TEST_USERS[0].address,
          asset: 'ETH',
          type: 'supply',
          amount: toDecimal18('5'),
          expectedSuccess: true
        },
        {
          user: TEST_USERS[0].address,
          asset: 'USDC',
          type: 'supply',
          amount: toDecimal18('2000'),
          expectedSuccess: true
        }
      ],
      timeAdvances: [7 * 24 * 3600] // 1 week
    },
    expected: {
      totalRewards: new Map([
        ['YEI', toDecimal18('2.88')],  // ~15% APR for 1 week
        ['ETH', toDecimal18('0.27')],  // ~2.8% APR for 1 week
        ['USDC', toDecimal18('1.35')]  // ~3.5% APR for 1 week
      ])
    }
  }
];

/**
 * Error handling test scenarios
 */
export const ERROR_TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Insufficient Balance Withdrawal',
    description: 'Test withdrawal with insufficient balance',
    setup: {
      users: [TEST_USERS[2]],
      assets: [TEST_ASSETS[0]],
      operations: [
        {
          user: TEST_USERS[2].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('100'),
          expectedSuccess: true
        },
        {
          user: TEST_USERS[2].address,
          asset: 'YEI',
          type: 'withdraw',
          amount: toDecimal18('200'), // More than supplied
          expectedSuccess: false,
          expectedError: 'Insufficient aToken balance'
        }
      ]
    },
    expected: {
      errors: ['Insufficient aToken balance']
    }
  },
  {
    name: 'Invalid Decimal Configuration',
    description: 'Test handling of invalid YEI decimal configuration',
    setup: {
      users: [TEST_USERS[0]],
      assets: [
        {
          ...TEST_ASSETS[0],
          decimals: 6 // Invalid for YEI
        }
      ],
      operations: [
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('1000'),
          expectedSuccess: false,
          expectedError: 'YEI token must have exactly 18 decimals'
        }
      ]
    },
    expected: {
      errors: ['YEI token must have exactly 18 decimals']
    }
  }
];

/**
 * Stress test scenarios
 */
export const STRESS_TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'High Volume Operations',
    description: 'Test system stability under high volume of operations',
    setup: {
      users: TEST_USERS,
      assets: [TEST_ASSETS[0]], // YEI only for simplicity
      operations: [], // Generated programmatically
      timeAdvances: Array.from({ length: 100 }, (_, i) => i * 3600) // Every hour for 100 hours
    },
    expected: {}
  },
  {
    name: 'Concurrent User Stress Test',
    description: 'Test concurrent operations from multiple users',
    setup: {
      users: TEST_USERS,
      assets: TEST_ASSETS,
      operations: [], // Generated programmatically
    },
    expected: {}
  }
];

/**
 * Real-world simulation scenarios
 */
export const REAL_WORLD_SCENARIOS: TestScenario[] = [
  {
    name: 'DeFi Summer Simulation',
    description: 'Simulate high APR period with many users',
    setup: {
      users: TEST_USERS,
      assets: [
        {
          ...TEST_ASSETS[0],
          liquidityRate: toDecimal18('50.0'), // 50% APR
          incentiveRate: toDecimal18('25.0')  // 25% additional rewards
        }
      ],
      operations: [
        // Multiple supply operations
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('10000'),
          expectedSuccess: true
        },
        {
          user: TEST_USERS[1].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('5000'),
          expectedSuccess: true
        },
        {
          user: TEST_USERS[2].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('1000'),
          expectedSuccess: true
        }
      ],
      timeAdvances: [30 * 24 * 3600] // 30 days
    },
    expected: {}
  },
  {
    name: 'Bear Market Stress',
    description: 'Simulate low/negative APR with user withdrawals',
    setup: {
      users: TEST_USERS.slice(0, 2),
      assets: [
        {
          ...TEST_ASSETS[0],
          liquidityRate: toDecimal18('0.5'), // 0.5% APR
          incentiveRate: toDecimal18('0.1')  // 0.1% additional rewards
        }
      ],
      operations: [
        {
          user: TEST_USERS[0].address,
          asset: 'YEI',
          type: 'supply',
          amount: toDecimal18('1000'),
          expectedSuccess: true
        }
      ],
      timeAdvances: [
        7 * 24 * 3600,   // 1 week
        14 * 24 * 3600,  // 2 weeks
        30 * 24 * 3600   // 1 month
      ]
    },
    expected: {}
  }
];

/**
 * Generate operations for stress testing
 */
export function generateStressTestOperations(
  users: TestUser[], 
  assets: TestAsset[], 
  operationCount: number
): TestOperation[] {
  const operations: TestOperation[] = [];
  const amounts = [
    toDecimal18('1'),
    toDecimal18('10'),
    toDecimal18('100'),
    toDecimal18('1000'),
    toDecimal18('10000')
  ];
  
  for (let i = 0; i < operationCount; i++) {
    const user = users[i % users.length];
    const asset = assets[i % assets.length];
    const amount = amounts[i % amounts.length];
    const isSupply = i % 3 !== 0; // 2/3 supply, 1/3 withdraw
    
    operations.push({
      user: user.address,
      asset: asset.symbol,
      type: isSupply ? 'supply' : 'withdraw',
      amount: amount,
      expectedSuccess: true
    });
  }
  
  return operations;
}

/**
 * All test scenarios combined for easy access
 */
export const ALL_TEST_SCENARIOS = [
  ...DECIMAL_TEST_SCENARIOS,
  ...APR_TEST_SCENARIOS,
  ...PORTFOLIO_TEST_SCENARIOS,
  ...ERROR_TEST_SCENARIOS,
  ...REAL_WORLD_SCENARIOS
];

export default ALL_TEST_SCENARIOS;