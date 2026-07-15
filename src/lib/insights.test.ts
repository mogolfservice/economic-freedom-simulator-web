import { describe, expect, it } from 'vitest'
import { buildCashflowSegmentInsights, buildPlannerInsights } from './insights'

describe('planner insights', () => {
  it('explains progress, cashflow coverage, locked assets, and expense leverage', () => {
    const insights = buildPlannerInsights({
      progress: 0.365,
      yearsToFi: 7,
      unlockedFiAssets: 500_000_000,
      fiNumber: 1_371_428_571,
      lockedFiAssets: 80_000_000,
      nextUnlockAge: 55,
      monthlyRetirementExpense: 4_000_000,
      totalMonthlyRetirementIncome: 1_200_000,
      expenseReductionImpact: 137_142_857,
    })

    expect(insights.map((item) => item.message)).toEqual(expect.arrayContaining([
      '현재 사용가능 FI 자산은 목표의 36.5%입니다.',
      '은퇴 후 월 생활비 400만원 중 연금/현금흐름으로 120만원이 보전됩니다.',
      '잠긴 FI 자산 8,000만원은 55세 이후 인출 재원으로 반영됩니다.',
      '지출을 10% 낮추면 목표 자산이 약 1억 3,714만원 줄어듭니다.',
    ]))
  })

  it('uses urgent tone when retirement is hard to reach and positive tone when already possible', () => {
    expect(buildPlannerInsights({ progress: 0.2, yearsToFi: null, unlockedFiAssets: 100, fiNumber: 500, lockedFiAssets: 0, nextUnlockAge: null, monthlyRetirementExpense: 0, totalMonthlyRetirementIncome: 0, expenseReductionImpact: 0 })[0]).toMatchObject({ tone: 'warn' })
    expect(buildPlannerInsights({ progress: 1.1, yearsToFi: 0, unlockedFiAssets: 110, fiNumber: 100, lockedFiAssets: 0, nextUnlockAge: null, monthlyRetirementExpense: 0, totalMonthlyRetirementIncome: 0, expenseReductionImpact: 0 })[0]).toMatchObject({ tone: 'good', message: '현재 사용가능 FI 자산만으로도 목표를 넘었습니다. 지금 은퇴 가능 조건입니다.' })
  })

  it('groups detailed retirement cashflow explanation by changing age bands', () => {
    const insights = buildCashflowSegmentInsights({
      monthlyRetirementExpense: 4_000_000,
      formatMoney: (value) => `₩${new Intl.NumberFormat('ko-KR').format(value)}`,
      points: [
        { age: 50, pensionIncome: 12_000_000, childExpense: 0, debtPayment: 0, withdrawal: 36_000_000 },
        { age: 51, pensionIncome: 12_000_000, childExpense: 0, debtPayment: 0, withdrawal: 36_000_000 },
        { age: 52, pensionIncome: 54_000_000, childExpense: 0, debtPayment: 0, withdrawal: 0 },
        { age: 53, pensionIncome: 54_000_000, childExpense: 0, debtPayment: 0, withdrawal: 0 },
      ],
    })

    expect(insights.map((item) => item.message)).toEqual([
      '50~51세: 월 현금흐름 ₩1,000,000, 월 필요지출 ₩4,000,000, 월 부족액 ₩3,000,000입니다. 부족분은 자산에서 인출합니다.',
      '52~53세: 월 현금흐름 ₩4,500,000, 월 필요지출 ₩4,000,000, 월 잉여 ₩500,000입니다. 이 구간은 현금흐름만으로 지출을 충당합니다.',
    ])
  })
})
