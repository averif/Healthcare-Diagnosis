import type { User } from '@/types/api'
import {
  collapse,
  doctorFieldsSchema,
  documentError,
  isDoctorApplicant,
  MAX_DOCUMENT_BYTES,
} from './doctorApplication'

const valid = {
  license_number: 'dmc-2020-12345',
  issuing_authority: 'Delhi Medical Council',
  hospital: '',
  specialty: undefined,
}

function errorsFor(values: Partial<typeof valid>) {
  const result = doctorFieldsSchema.safeParse({ ...valid, ...values })
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]))
}

describe('doctor registration fields', () => {
  it('accepts a normal licence and authority (case and spacing are normalised later)', () => {
    expect(errorsFor({})).toEqual({})
    expect(errorsFor({ license_number: '  mh / 1234 . 5 ', hospital: 'St. John’s' })).toEqual({
      hospital: 'Use letters, numbers and basic punctuation.',
    })
    expect(collapse('  Delhi   Medical  Council ')).toBe('Delhi Medical Council')
  })

  it.each([
    ['', 'Enter your licence number.'],
    ['A', "Use 3-50 letters, numbers, spaces, '.', '/' or '-'."],
    ['X'.repeat(51), "Use 3-50 letters, numbers, spaces, '.', '/' or '-'."],
    ['<script>', "Use 3-50 letters, numbers, spaces, '.', '/' or '-'."],
  ])('rejects licence %j', (license_number, message) => {
    expect(errorsFor({ license_number }).license_number).toBe(message)
  })

  it('limits the authority, hospital and specialty like the API', () => {
    expect(errorsFor({ issuing_authority: ' ' }).issuing_authority).toBe(
      'Enter the issuing authority.',
    )
    expect(errorsFor({ issuing_authority: 'A'.repeat(121) }).issuing_authority).toMatch(/120/)
    expect(errorsFor({ issuing_authority: 'Council<b>' }).issuing_authority).toMatch(/punctuation/)
    expect(errorsFor({ hospital: 'H'.repeat(121) }).hospital).toMatch(/120/)
    expect(errorsFor({ specialty: 'S'.repeat(81) } as never).specialty).toMatch(/80/)
  })
})

describe('documentError', () => {
  const file = (name: string, type: string, size = 1024) =>
    new File([new Uint8Array(size)], name, { type })

  it('accepts PDF, JPG and PNG up to 5 MB', () => {
    expect(documentError(file('licence.pdf', 'application/pdf'))).toBeNull()
    expect(documentError(file('scan.JPEG', 'image/jpeg'))).toBeNull()
    expect(documentError(file('scan.png', 'image/png', MAX_DOCUMENT_BYTES))).toBeNull()
  })

  it('rejects other types, mismatched types, empty and oversized files', () => {
    expect(documentError(file('x.exe', 'application/octet-stream'))).toMatch(/PDF, JPG or PNG/)
    expect(documentError(file('x.svg', 'image/svg+xml'))).toMatch(/PDF, JPG or PNG/)
    expect(documentError(file('x.pdf', 'image/png'))).toMatch(/PDF, JPG or PNG/)
    expect(documentError(file('x.pdf', 'application/pdf', 0))).toBe('The file is empty.')
    expect(documentError(file('x.pdf', 'application/pdf', MAX_DOCUMENT_BYTES + 1))).toBe(
      'The file is larger than 5 MB.',
    )
  })
})

describe('isDoctorApplicant', () => {
  const user = (status?: 'pending' | 'approved' | 'rejected') =>
    ({
      role: status === 'approved' ? 'doctor' : 'patient',
      doctor_application: status ? { status } : null,
    }) as User

  it('is true only for unapproved doctor sign-ups', () => {
    expect(isDoctorApplicant(user('pending'))).toBe(true)
    expect(isDoctorApplicant(user('rejected'))).toBe(true)
    expect(isDoctorApplicant(user('approved'))).toBe(false)
    expect(isDoctorApplicant(user())).toBe(false)
    expect(isDoctorApplicant(null)).toBe(false)
  })
})
