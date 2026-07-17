import { describe, expect, it } from 'vitest'
import {
  calculateFiNumber,
  calculateMonthlyDebtPaymentAtAge,
  calculateNetWorth,
  calculateRetirementHorizonYears,
  calculateRetirementReadiness,
  calculateYearsToRetirementReadiness,
  calculateSavingsRate,
  calculateUnlockedFiAssets,
  calculateYearsToFi,
  createYearlyProjection,
  getSensitivityMatrix,
  simulateRetirementDrawdown,
  toMonthlyRate,
  toRealReturn,
  type ChildExpense,
  type PensionCashflow,
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

  it('separates FI assets that are locked until a future age such as 55', () => {
    const result = calculateUnlockedFiAssets({
      currentAge: 45,
      assets: [
        { id: 'taxable', name: '과세계좌', type: 'stock', value: 300_000_000, liquidity: 'high', includeForFi: true },
        { id: 'irp', name: 'IRP', type: 'pension', value: 100_000_000, liquidity: 'medium', includeForFi: true, availableAge: 55 },
        { id: 'home', name: '거주 주택', type: 'real_estate', value: 700_000_000, liquidity: 'low', includeForFi: false },
      ],
    })

    expect(result.unlockedFiAssets).toBe(300_000_000)
    expect(result.lockedFiAssets).toBe(100_000_000)
    expect(result.nextUnlockAge).toBe(55)
  })

  it('uses pension cashflows and age-gated assets in retirement readiness bridge simulation', () => {
    const pensions: PensionCashflow[] = [
      { id: 'national', name: '국민연금', kind: 'pension', startAge: 65, monthlyAmount: 1_200_000, reliability: 1 },
    ]

    const result = calculateRetirementReadiness({
      currentAge: 50,
      retirementAge: 50,
      retirementYears: 16,
      monthlyRetirementExpense: 4_000_000,
      annualReturn: 0,
      assets: [
        { id: 'taxable', name: '일반 투자자산', type: 'stock', value: 600_000_000, liquidity: 'high', includeForFi: true },
        { id: 'irp', name: '55세 이후 사용가능 IRP', type: 'pension', value: 240_000_000, liquidity: 'medium', includeForFi: true, availableAge: 55 },
      ],
      pensions,
    })

    expect(result.success).toBe(true)
    expect(result.unlockedAtRetirement).toBe(600_000_000)
    expect(result.lockedAtRetirement).toBe(240_000_000)
    expect(result.points.find((point) => point.age === 55)?.unlockedFromAssets).toBe(240_000_000)
    expect(result.points.find((point) => point.age === 65)?.pensionIncome).toBe(14_400_000)
  })

  it('extends retirement readiness through the configured living-expense end age', () => {
    const livingExpenseBands = [
      { id: 'early', name: '초기', startAge: 40, endAge: 64, monthlyExpense: 3_300_000 },
      { id: 'middle', name: '중기', startAge: 65, endAge: 74, monthlyExpense: 2_770_000 },
      { id: 'late', name: '후기', startAge: 75, endAge: 100, monthlyExpense: 2_200_000 },
    ]

    expect(calculateRetirementHorizonYears({ retirementAge: 43, retirementYears: 50, livingExpenseBands })).toBe(58)

    const result = calculateRetirementReadiness({
      currentAge: 40,
      retirementAge: 43,
      retirementYears: 50,
      livingExpenseBands,
      monthlyRetirementExpense: 2_770_000,
      annualReturn: 0,
      assets: [{ id: 'cash', name: '현금', type: 'cash', value: 3_000_000_000, liquidity: 'high', includeForFi: true }],
      pensions: [],
    })

    expect(result.points.at(0)?.age).toBe(43)
    expect(result.points.at(-1)?.age).toBe(100)
  })

  it('combines multiple retirement income cashflows and stops temporary income after end age', () => {
    const incomes: PensionCashflow[] = [
      { id: 'national', name: '국민연금', kind: 'pension', startAge: 65, monthlyAmount: 1_200_000, reliability: 1 },
      { id: 'rent', name: '월세', kind: 'rental', startAge: 50, monthlyAmount: 800_000, reliability: 0.9 },
      { id: 'consulting', name: '자문료', kind: 'passive_income', startAge: 50, endAge: 59, monthlyAmount: 500_000, reliability: 1 },
    ]

    const result = calculateRetirementReadiness({
      currentAge: 50,
      retirementAge: 50,
      retirementYears: 16,
      monthlyRetirementExpense: 4_000_000,
      annualReturn: 0,
      assets: [
        { id: 'taxable', name: '일반 투자자산', type: 'stock', value: 600_000_000, liquidity: 'high', includeForFi: true },
      ],
      pensions: incomes,
    })

    expect(result.points.find((point) => point.age === 55)?.pensionIncome).toBe(14_640_000)
    expect(result.points.find((point) => point.age === 60)?.pensionIncome).toBe(8_640_000)
    expect(result.points.find((point) => point.age === 65)?.pensionIncome).toBe(23_040_000)
  })

  it('uses future retirement income cashflows when finding the earliest retirement age', () => {
    const pensions: PensionCashflow[] = [
      { id: 'national', name: '국민연금', kind: 'pension', startAge: 65, monthlyAmount: 1_200_000, reliability: 1 },
    ]

    const years = calculateYearsToRetirementReadiness({
      currentAge: 50,
      monthlyContribution: 0,
      monthlyRetirementExpense: 4_000_000,
      annualReturn: 0,
      retirementYears: 30,
      assets: [
        { id: 'taxable', name: '일반 투자자산', type: 'stock', value: 1_250_000_000, liquidity: 'high', includeForFi: true },
      ],
      pensions,
    })

    expect(calculateYearsToFi({ currentFiAssets: 1_250_000_000, annualContribution: 0, annualReturn: 0, fiNumber: calculateFiNumber(4_000_000, 0.035) })).toBeNull()
    expect(years).toBe(0)
  })

  it('allows immediate retirement with zero savings and zero assets when cashflows fully cover expenses', () => {
    const years = calculateYearsToRetirementReadiness({
      currentAge: 45,
      monthlyContribution: 0,
      monthlyRetirementExpense: 3_000_000,
      annualReturn: 0,
      retirementYears: 40,
      assets: [],
      pensions: [{ id: 'rent', name: '임대소득', kind: 'rental', startAge: 45, monthlyAmount: 3_000_000, reliability: 1 }],
    })

    const readiness = calculateRetirementReadiness({
      currentAge: 45,
      retirementAge: 45,
      retirementYears: 40,
      monthlyRetirementExpense: 3_000_000,
      annualReturn: 0,
      assets: [],
      pensions: [{ id: 'rent', name: '임대소득', kind: 'rental', startAge: 45, monthlyAmount: 3_000_000, reliability: 1 }],
    })

    expect(years).toBe(0)
    expect(readiness.success).toBe(true)
    expect(readiness.points.every((point) => point.withdrawal === 0 && point.endBalance === 0)).toBe(true)
  })

  it('adds child monthly support, university costs, and one-time events only for active ages', () => {
    const children: ChildExpense[] = [
      {
        id: 'first',
        name: '첫째',
        currentAge: 8,
        monthlyCareCost: 700_000,
        monthlyEducationCost: 500_000,
        supportUntilAge: 24,
        universityStartAge: 19,
        universityEndAge: 22,
        annualUniversityCost: 15_000_000,
        lumpSumEvents: [{ id: 'housing', label: '주거지원', childAge: 30, amount: 50_000_000 }],
      },
    ]

    const result = calculateRetirementReadiness({
      currentAge: 40,
      retirementAge: 40,
      retirementYears: 23,
      monthlyRetirementExpense: 4_000_000,
      annualReturn: 0,
      assets: [{ id: 'taxable', name: '일반 투자자산', type: 'stock', value: 1_500_000_000, liquidity: 'high', includeForFi: true }],
      pensions: [],
      children,
    })

    expect(result.points.find((point) => point.age === 40)?.childExpense).toBe(14_400_000)
    expect(result.points.find((point) => point.age === 51)?.childExpense).toBe(29_400_000)
    expect(result.points.find((point) => point.age === 56)?.childExpense).toBe(0)
    expect(result.points.find((point) => point.age === 62)?.childExpense).toBe(50_000_000)
  })

  it('calculates monthly debt payments by age until payoff age', () => {
    const liabilities = [
      { id: 'mortgage', name: '주담대', type: 'mortgage' as const, balance: 250_000_000, interestRate: 0.04, monthlyPayment: 1_500_000, payoffAge: 58, includePaymentInRetirement: true },
      { id: 'credit', name: '카드론', type: 'credit' as const, balance: 10_000_000, interestRate: 0.12, monthlyPayment: 300_000, payoffAge: 45, includePaymentInRetirement: false },
    ]

    expect(calculateMonthlyDebtPaymentAtAge(liabilities, 57)).toBe(1_500_000)
    expect(calculateMonthlyDebtPaymentAtAge(liabilities, 58)).toBe(0)
  })

  it('includes remaining retirement debt payments in drawdown readiness until payoff age', () => {
    const result = calculateRetirementReadiness({
      currentAge: 55,
      retirementAge: 55,
      retirementYears: 4,
      monthlyRetirementExpense: 2_000_000,
      annualReturn: 0,
      assets: [{ id: 'cash', name: '현금', type: 'cash', value: 100_000_000, liquidity: 'high', includeForFi: true }],
      pensions: [],
      liabilities: [{ id: 'mortgage', name: '주담대', type: 'mortgage', balance: 100_000_000, interestRate: 0.04, monthlyPayment: 1_000_000, payoffAge: 57, includePaymentInRetirement: true }],
    })

    expect(result.points.find((point) => point.age === 55)?.withdrawal).toBe(36_000_000)
    expect(result.points.find((point) => point.age === 57)?.withdrawal).toBe(24_000_000)
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
