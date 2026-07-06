import { describe, expect, it } from 'vitest'
import { generateMarkdownReport } from './report'

describe('markdown report', () => {
  it('renders a shareable Korean FIRE report with inputs, result, scenarios, and disclaimer', () => {
    const markdown = generateMarkdownReport({
      title: '한국형 경제적 자유 시뮬레이터 리포트',
      generatedAt: '2026-07-06 10:30',
      summary: {
        yearsToFi: 7,
        retirementYear: 2033,
        fiNumber: '₩1,371,428,571',
        progress: '36.5%',
        monthlyShortfall: '₩2,800,000',
      },
      assumptions: ['실질수익률 4%', '안전인출률 3.5%'],
      insights: ['현재 사용가능 FI 자산은 목표의 36.5%입니다.'],
      scenarios: [
        { label: '기본', timing: '7년 뒤 · 2033', risk: '보통' },
        { label: '보수', timing: '10년 뒤 · 2036', risk: '주의' },
      ],
      disclaimer: '투자 또는 은퇴 결정을 보장하지 않습니다.',
    })

    expect(markdown).toContain('# 한국형 경제적 자유 시뮬레이터 리포트')
    expect(markdown).toContain('| 필요 은퇴자산 | ₩1,371,428,571 |')
    expect(markdown).toContain('- 현재 사용가능 FI 자산은 목표의 36.5%입니다.')
    expect(markdown).toContain('| 보수 | 10년 뒤 · 2036 | 주의 |')
    expect(markdown).toContain('투자 또는 은퇴 결정을 보장하지 않습니다.')
  })
})
