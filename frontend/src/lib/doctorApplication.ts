import { z } from 'zod'
import type { User } from '@/types/api'

/**
 * Doctor self-registration rules, mirroring backend/app/schemas.py (RegisterSchema) and
 * backend/app/services/doctor_documents.py. The server re-validates everything.
 */

/** Trim and collapse internal whitespace, as the server does before validating. */
export const collapse = (value: string) => value.trim().split(/\s+/).filter(Boolean).join(' ')

const LICENSE_RE = /^[A-Z0-9][A-Z0-9 ./-]{1,48}[A-Z0-9]$/
const PLAIN_TEXT_RE = /^[\p{L}\p{N}_ .,&()'/-]+$/u

const plainText = (label: string, min: number, max: number) =>
  z
    .string()
    .refine((v) => collapse(v).length >= min, `Enter the ${label}.`)
    .refine((v) => collapse(v).length <= max, `Use at most ${max} characters.`)
    .refine(
      (v) => !collapse(v) || PLAIN_TEXT_RE.test(collapse(v)),
      'Use letters, numbers and basic punctuation.',
    )

const optionalText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .refine((v) => !v || !collapse(v) || collapse(v).length >= 2, `Enter the ${label}.`)
    .refine((v) => !v || collapse(v).length <= max, `Use at most ${max} characters.`)
    .refine(
      (v) => !v || !collapse(v) || PLAIN_TEXT_RE.test(collapse(v)),
      'Use letters, numbers and basic punctuation.',
    )

export const doctorFieldsSchema = z.object({
  license_number: z
    .string()
    .refine((v) => collapse(v).length > 0, 'Enter your licence number.')
    .refine(
      (v) => !collapse(v) || LICENSE_RE.test(collapse(v).toUpperCase()),
      "Use 3-50 letters, numbers, spaces, '.', '/' or '-'.",
    ),
  issuing_authority: plainText('issuing authority', 2, 120),
  hospital: optionalText('hospital', 120),
  specialty: optionalText('specialty', 80),
})

// ---- proof-of-registration upload ---------------------------------------------------------

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const DOCUMENT_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
}
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

/** Error message for an unacceptable file, or null when it may be uploaded. */
export function documentError(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const types = DOCUMENT_TYPES[ext]
  if (!types || (file.type && !types.includes(file.type))) return 'Upload a PDF, JPG or PNG file.'
  if (file.size === 0) return 'The file is empty.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'The file is larger than 5 MB.'
  return null
}

// ---- access ---------------------------------------------------------------------------------

/** A doctor sign-up that an admin has not approved: it gets no clinical pages at all. */
export function isDoctorApplicant(user: User | null | undefined): boolean {
  const application = user?.doctor_application
  return !!application && application.status !== 'approved'
}
