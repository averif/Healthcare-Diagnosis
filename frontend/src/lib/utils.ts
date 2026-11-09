import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Disease, RiskLevel } from '@/types/api'

/** Merge Tailwind class names, letting later classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DISEASE_LABEL: Record<Disease, string> = {
  diabetes: 'Diabetes',
  heart: 'Heart disease',
  liver: 'Liver disease',
  symptom: 'Symptom checker',
}

export const RISK_COLOR: Record<RiskLevel, string> = {
  low: '#16a34a',
  moderate: '#d97706',
  high: '#dc2626',
}

export function pct(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—'
  // API datetimes without a zone are UTC
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function titleCase(text: string) {
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function humanizeSymptom(name: string) {
  const text = name.replace(/_/g, ' ').replace(/\(/g, ' (').replace(/\s+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
