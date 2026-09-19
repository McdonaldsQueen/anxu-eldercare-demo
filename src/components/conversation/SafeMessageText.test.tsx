import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SafeMessageText } from './SafeMessageText'

afterEach(cleanup)

describe('SafeMessageText', () => {
  it('renders an HTTPS policy title as a safe new-tab link', () => {
    render(<SafeMessageText text="来源：[天津市高龄津贴政策](https://mz.tj.gov.cn/policy.html)" />)
    const link = screen.getByRole('link', { name: '天津市高龄津贴政策' })
    expect(link).toHaveAttribute('href', 'https://mz.tj.gov.cn/policy.html')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not turn non-HTTPS text into a link', () => {
    render(<SafeMessageText text="[不安全来源](javascript:alert(1))" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(/不安全来源/)).toBeInTheDocument()
  })
})
