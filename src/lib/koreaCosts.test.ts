import { describe, expect, it } from 'vitest'
import { calculateKoreaCostAdjustment } from './koreaCosts'

describe('korea cost adjustments', () => {
  it('adds conservative health insurance and tax estimates to retirement spending', () => {
    const result = calculateKoreaCostAdjustment({
      includeHealthInsurance: true,
      healthInsuranceMonthlyEstimate: 350_000,
      includeInvestmentTax: true,
      taxableInvestmentMonthlyIncome: 1_000_000,
      investmentTaxRate: 0.154,
      includeRentalTax: true,
      rentalMonthlyIncome: 800_000,
      rentalTaxRate: 0.1,
    })

    expect(result.monthlyExtraCost).toBe(584_000)
    expect(result.annualExtraCost).toBe(7_008_000)
    expect(result.notes).toContain('건강보험료 월 추정치 ₩350,000 반영')
    expect(result.notes).toContain('투자소득 세금 보정 15.4% 반영')
    expect(result.notes).toContain('임대소득 세금 보정 10% 반영')
  })

  it('returns zero when all Korea-specific cost switches are off', () => {
    const result = calculateKoreaCostAdjustment({
      includeHealthInsurance: false,
      healthInsuranceMonthlyEstimate: 350_000,
      includeInvestmentTax: false,
      taxableInvestmentMonthlyIncome: 1_000_000,
      investmentTaxRate: 0.154,
      includeRentalTax: false,
      rentalMonthlyIncome: 800_000,
      rentalTaxRate: 0.1,
    })

    expect(result.monthlyExtraCost).toBe(0)
    expect(result.annualExtraCost).toBe(0)
    expect(result.notes).toEqual(['세금/건강보험료 보정이 꺼져 있습니다.'])
  })
})
