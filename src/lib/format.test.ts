import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, getInitials, STATUS_LABEL, STATUS_CLASS } from './format'

describe('format', () => {
  it('formatCurrency outputs MYR amount', () => {
    const result = formatCurrency(156.8)
    expect(result).toContain('156.80')
    // ms-MY locale uses 'RM' symbol
    expect(result).toMatch(/RM|MYR/)
  })

  it('formatDate returns readable string', () => {
    const result = formatDate('2026-04-18')
    expect(result).toMatch(/18/)
    expect(result).toMatch(/Apr/)
  })

  it('STATUS_LABEL covers all statuses', () => {
    expect(STATUS_LABEL.draft).toBe('Draft')
    expect(STATUS_LABEL.submitted).toBe('Submitted')
    expect(STATUS_LABEL.approved).toBe('Approved')
    expect(STATUS_LABEL.rejected).toBe('Rejected')
  })

  it('STATUS_CLASS approved uses emerald not green', () => {
    expect(STATUS_CLASS.approved).toContain('emerald')
  })

  it('getInitials extracts up to 2 initials', () => {
    expect(getInitials('Ahmad Faris')).toBe('AF')
    expect(getInitials('Siti Aminah Binti Omar')).toBe('SA')
    expect(getInitials('Rajan')).toBe('R')
  })
})
