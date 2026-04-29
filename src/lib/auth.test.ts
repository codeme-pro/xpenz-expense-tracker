import { describe, it, expect } from 'vitest'
import { getInitials } from './format'

describe('getInitials', () => {
  it('two-word name', () => expect(getInitials('Ahmad Faris')).toBe('AF'))
  it('single word', () => expect(getInitials('Rajan')).toBe('R'))
  it('extra words capped at 2', () => expect(getInitials('Siti Aminah Binti')).toBe('SA'))
  it('extra spaces trimmed', () => expect(getInitials('  Ali  Hassan  ')).toBe('AH'))
})
