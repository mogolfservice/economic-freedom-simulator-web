// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('EconomicFreedomSimulator app', () => {
  it('renders Korean FIRE dashboard with comma-formatted KRW defaults', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '경제적자유시뮬레이터' })).toBeInTheDocument()
    expect(screen.getByText('7년 뒤')).toBeInTheDocument()
    expect(screen.getByText('2033년')).toBeInTheDocument()
    expect(screen.getAllByText('₩1,371,428,571').length).toBeGreaterThan(0)
    expect(screen.getByText('36.5%')).toBeInTheDocument()
    expect(screen.getByText('민감도 분석')).toBeInTheDocument()
    expect(screen.getByLabelText('월 소득')).toHaveValue('8,000,000')
    expect(screen.getByLabelText('은퇴 후 월 생활비')).toHaveValue('4,000,000')
  })

  it('updates the FI result when comma-formatted monthly retirement expense is reduced', async () => {
    const user = userEvent.setup()
    render(<App />)

    const expenseInput = screen.getByLabelText('은퇴 후 월 생활비')
    await user.clear(expenseInput)
    await user.type(expenseInput, '3,000,000')

    expect(expenseInput).toHaveValue('3,000,000')
    expect(screen.getByText('3년 뒤')).toBeInTheDocument()
    expect(screen.getByText('2029년')).toBeInTheDocument()
    expect(screen.getAllByText('₩1,028,571,429').length).toBeGreaterThan(0)
  })

  it('switches language and currency for labels and money formatting', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('언어'), 'en')
    expect(screen.getByRole('heading', { name: 'Financial Freedom Simulator' })).toBeInTheDocument()
    expect(screen.getByText('Sensitivity Analysis')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    expect(screen.getAllByText('$1,371,428,571').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Monthly income')).toHaveValue('8,000,000')
  })

  it('can add an asset, include it in FI assets, and persist scenario locally', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '자산 추가' }))
    const assetsPanel = screen.getByTestId('asset-list')
    const assetNameInputs = within(assetsPanel).getAllByLabelText('자산명')
    await user.clear(assetNameInputs.at(-1)!)
    await user.type(assetNameInputs.at(-1)!, '추가 ETF')
    const assetValueInputs = within(assetsPanel).getAllByLabelText('평가액')
    await user.clear(assetValueInputs.at(-1)!)
    await user.type(assetValueInputs.at(-1)!, '100,000,000')

    expect(screen.getByText('43.8%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '현재 시나리오 저장' }))
    expect(JSON.parse(localStorage.getItem('efs-scenarios') ?? '[]')).toHaveLength(1)
    expect(screen.getByText('저장된 시나리오')).toBeInTheDocument()
  })

  it('models pension cashflow and assets locked until age 55', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('은퇴 후 소득/현금흐름')).toBeInTheDocument()
    expect(screen.getByText('55세 이후 사용가능 자산')).toBeInTheDocument()
    expect(screen.getByText('잠긴 FI 자산 ₩80,000,000')).toBeInTheDocument()
    expect(screen.getByText('국민연금')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('국민연금 월 수령액'))
    await user.type(screen.getByLabelText('국민연금 월 수령액'), '1,500,000')

    expect(screen.getByText('총 월 소득')).toBeInTheDocument()
    expect(screen.getByText('₩1,500,000')).toBeInTheDocument()
    expect(screen.getByText('월 부족액')).toBeInTheDocument()
    expect(screen.getByText('₩2,500,000')).toBeInTheDocument()
  })

  it('can add multiple retirement income cashflows including rental income with an end age', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '소득 추가' }))
    expect(screen.getAllByText('월세/임대소득').length).toBeGreaterThan(0)

    const cashflowPanel = screen.getByTestId('cashflow-list')
    const incomeNameInputs = within(cashflowPanel).getAllByLabelText('소득명')
    await user.clear(incomeNameInputs.at(-1)!)
    await user.type(incomeNameInputs.at(-1)!, '오피스텔 월세')

    const incomeAmountInputs = within(cashflowPanel).getAllByLabelText(/월 수령액/)
    await user.clear(incomeAmountInputs.at(-1)!)
    await user.type(incomeAmountInputs.at(-1)!, '800,000')

    const endAgeInputs = within(cashflowPanel).getAllByLabelText('종료 나이')
    await user.type(endAgeInputs.at(-1)!, '75')

    expect(screen.getByText('오피스텔 월세')).toBeInTheDocument()
    expect(screen.getByDisplayValue('75')).toBeInTheDocument()
    expect(screen.getAllByText('₩2,000,000').length).toBeGreaterThanOrEqual(2)
  })

  it('can add child expense with support age, university cost, and lump-sum event', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('자녀/부양가족 비용')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '자녀 추가' }))

    const childrenPanel = screen.getByTestId('children-list')
    const childNameInputs = within(childrenPanel).getAllByLabelText('자녀명')
    await user.clear(childNameInputs.at(-1)!)
    await user.type(childNameInputs.at(-1)!, '첫째')

    await user.clear(within(childrenPanel).getAllByLabelText('현재 자녀 나이').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('현재 자녀 나이').at(-1)!, '8')
    await user.clear(within(childrenPanel).getAllByLabelText('월 양육비').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('월 양육비').at(-1)!, '700,000')
    await user.clear(within(childrenPanel).getAllByLabelText('월 교육비').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('월 교육비').at(-1)!, '500,000')
    await user.clear(within(childrenPanel).getAllByLabelText('지원 종료 나이').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('지원 종료 나이').at(-1)!, '24')
    await user.clear(within(childrenPanel).getAllByLabelText('대학 연간비').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('대학 연간비').at(-1)!, '15,000,000')
    await user.clear(within(childrenPanel).getAllByLabelText('일시금 나이').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('일시금 나이').at(-1)!, '30')
    await user.clear(within(childrenPanel).getAllByLabelText('일시금 금액').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('일시금 금액').at(-1)!, '50,000,000')

    expect(screen.getByText('첫째')).toBeInTheDocument()
    expect(screen.getByText('현재 연간 자녀비')).toBeInTheDocument()
    expect(screen.getByText('₩14,400,000')).toBeInTheDocument()
    expect(screen.getByText('대학 연간비 합계')).toBeInTheDocument()
    expect(screen.getByText('₩15,000,000')).toBeInTheDocument()
  })

})
