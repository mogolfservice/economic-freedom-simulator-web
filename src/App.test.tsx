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
  it('renders Korean FIRE dashboard with default retirement result', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '경제적자유시뮬레이터' })).toBeInTheDocument()
    expect(screen.getByText('13년 뒤')).toBeInTheDocument()
    expect(screen.getByText('2039년')).toBeInTheDocument()
    expect(screen.getAllByText('13.7억 원').length).toBeGreaterThan(0)
    expect(screen.getByText('36.5%')).toBeInTheDocument()
    expect(screen.getByText('민감도 분석')).toBeInTheDocument()
  })

  it('updates the FI result when monthly retirement expense is reduced', async () => {
    const user = userEvent.setup()
    render(<App />)

    const expenseInput = screen.getByLabelText('은퇴 후 월 생활비')
    await user.clear(expenseInput)
    await user.type(expenseInput, '3000000')

    expect(screen.getByText('9년 뒤')).toBeInTheDocument()
    expect(screen.getByText('2035년')).toBeInTheDocument()
    expect(screen.getAllByText('10.3억 원').length).toBeGreaterThan(0)
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
    await user.type(assetValueInputs.at(-1)!, '100000000')

    expect(screen.getByText('43.8%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '현재 시나리오 저장' }))
    expect(JSON.parse(localStorage.getItem('efs-scenarios') ?? '[]')).toHaveLength(1)
    expect(screen.getByText('저장된 시나리오')).toBeInTheDocument()
  })
})
