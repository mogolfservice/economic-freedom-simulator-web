import { describe, expect, it } from 'vitest'
import { createDecisionScenarios } from './scenarios'

describe('decision scenarios', () => {
  const baseInput = {
    currentAge: 40,
    monthlyContribution: 3_000_000,
    monthlyRetirementExpense: 4_000_000,
    annualReturn: 0.04,
    safeWithdrawalRate: 0.035,
    startYear: 2026,
    retirementYears: 50,
    assets: [
      { id: 'cash', name: '현금', type: 'cash' as const, value: 100_000_000, liquidity: 'high' as const, includeForFi: true },
      { id: 'stock', name: 'ETF', type: 'stock' as const, value: 400_000_000, liquidity: 'high' as const, includeForFi: true },
      { id: 'irp', name: 'IRP', type: 'pension' as const, value: 80_000_000, liquidity: 'medium' as const, includeForFi: true, availableAge: 55 },
    ],
    pensions: [{ id: 'national', name: '국민연금', kind: 'pension' as const, startAge: 65, monthlyAmount: 1_200_000, reliability: 1 }],
    children: [],
  }

  it('creates base, conservative, optimistic, and quit-soon scenarios', () => {
    const scenarios = createDecisionScenarios(baseInput)

    expect(scenarios.map((scenario) => scenario.label)).toEqual(['기본', '보수', '낙관', '조기퇴사'])
    expect(scenarios.find((item) => item.label === '보수')?.monthlyRetirementExpense).toBe(4_400_000)
    expect(scenarios.find((item) => item.label === '낙관')?.monthlyContribution).toBe(3_300_000)
    expect(scenarios.find((item) => item.label === '조기퇴사')?.monthlyContribution).toBe(0)
  })

  it('marks scenario risk when readiness fails or timing is unreachable', () => {
    const scenarios = createDecisionScenarios({ ...baseInput, monthlyRetirementExpense: 20_000_000, monthlyContribution: 0 })
    expect(scenarios.some((scenario) => scenario.risk === 'high')).toBe(true)
  })
})
