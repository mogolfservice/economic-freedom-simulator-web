import { describe, expect, it } from 'vitest'
import {
  calculateFiNumber,
  calculateNetWorth,
  calculateSavingsRate,
  calculateYearsToFi,
  createYearlyProjection,
  getSensitivityMatrix,
  simulateRetirementDrawdown,
  toMonthlyRate,
  toRealReturn,
  type SimulationInput,
} from './finance'

describe('finance engine', () => {
  it('calculates net worth and separates liquid retirement assets from illiquid home equity', () => {
    expect(
      calculateNetWorth({
        assets: [
          { id: 'cash', name: '현금', type: 'cash', value: 100_000_000, liquidity: 'high', includeForFi: true },
          { id: 'etf', name: 'ETF', type: 'stock', value: 250_000_000, liquidity: 'high', includeForFi: true },
          { id: 'home', name: '거주 주택', type: 'real_estate', value: 900_000_000, liquidity: 'low', includeForFi: false },
        ],
        liabilities: [{ id: 'mortgage', name: '주담대', type: 'mortgage', balance: 300_000_000, interestRate: 0.04 }],
      }),
    ).toEqual({ totalAssets: 1_250_000_000, totalLiabilities: 300_000_000, netWorth: 950_000_000, fiAssets: 350_000_000 })
  })

  it('calculates FI number from monthly retirement expense and safe withdrawal rate', () => {
    expect(calculateFiNumber(4_000_000, 0.035)).toBeCloseTo(1_371_428_571, 0)
  })

  it('converts nominal return and inflation to real return', () => {
    expect(toRealReturn(0.07, 0.025)).toBeCloseTo(0.0439024, 6)
  })

  it('converts annual return to monthly compound rate', () => {
    expect(toMonthlyRate(0.04)).toBeCloseTo(0.0032737, 6)
  })

  it('calculates years to FI with annual contributions and real return', () => {
    expect(calculateYearsToFi({ currentFiAssets: 500_000_000, annualContribution: 36_000_000, annualReturn: 0.04, fiNumber: 1_371_428_571 })).toBe(13)
  })

  it('returns zero years when already financially independent', () => {
    expect(calculateYearsToFi({ currentFiAssets: 1_500_000_000, annualContribution: 0, annualReturn: 0.02, fiNumber: 1_200_000_000 })).toBe(0)
  })

  it('creates a yearly projection until target is reached and includes progress', () => {
    const projection = createYearlyProjection({ currentFiAssets: 500_000_000, annualContribution: 36_000_000, annualReturn: 0.04, fiNumber: 1_371_428_571, startYear: 2026 })
    expect(projection.at(0)).toMatchObject({ year: 2026, balance: 500_000_000 })
    expect(projection.at(-1)?.balance).toBeGreaterThanOrEqual(1_371_428_571)
    expect(projection.at(-1)?.year).toBe(2039)
    expect(projection.at(-1)?.progress).toBeGreaterThanOrEqual(1)
  })

  it('simulates retirement drawdown and detects depletion year', () => {
    const stable = simulateRetirementDrawdown({ startingBalance: 1_400_000_000, annualExpense: 48_000_000, annualReturn: 0.04, years: 50 })
    expect(stable.depletedYear).toBeNull()
    expect(stable.success).toBe(true)

    const risky = simulateRetirementDrawdown({ startingBalance: 500_000_000, annualExpense: 60_000_000, annualReturn: 0.01, years: 50 })
    expect(risky.success).toBe(false)
    expect(risky.depletedYear).toBeGreaterThan(0)
  })

  it('calculates savings rate safely', () => {
    expect(calculateSavingsRate(8_000_000, 3_000_000)).toBe(0.375)
    expect(calculateSavingsRate(0, 3_000_000)).toBe(0)
  })

  it('produces sensitivity cases for return, expense, and saving changes', () => {
    const input: SimulationInput = {
      currentFiAssets: 500_000_000,
      monthlyContribution: 3_000_000,
      monthlyRetirementExpense: 4_000_000,
      annualReturn: 0.04,
      safeWithdrawalRate: 0.035,
      startYear: 2026,
      retirementYears: 50,
    }
    const cases = getSensitivityMatrix(input)
    expect(cases).toHaveLength(7)
    expect(cases.find((item) => item.label === '기본')?.yearsToFi).toBe(13)
    expect(cases.find((item) => item.label === '지출 -10%')?.yearsToFi).toBeLessThan(13)
    expect(cases.find((item) => item.label === '저축 +20%')?.yearsToFi).toBeLessThan(13)
  })
})
