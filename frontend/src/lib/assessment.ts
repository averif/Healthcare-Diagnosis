import { z } from 'zod'
import type { FeatureSpec } from '@/types/api'

/**
 * Build a Zod schema from the API's feature specifications, so the browser enforces the same
 * clinical ranges as the server. Form values are strings (as typed); `toInputs` converts them.
 */
export function buildSchema(features: FeatureSpec[]) {
  const shape: Record<string, z.ZodType<string>> = {}
  for (const f of features) {
    shape[f.name] = z.string().superRefine((raw, ctx) => {
      const value = raw.trim()
      if (value === '') {
        if (f.required) ctx.addIssue({ code: 'custom', message: 'Required.' })
        return
      }
      if (f.kind !== 'numeric') {
        if (!(value in f.choices)) ctx.addIssue({ code: 'custom', message: 'Choose an option.' })
        return
      }
      const number = Number(value)
      if (!Number.isFinite(number)) {
        ctx.addIssue({ code: 'custom', message: 'Enter a number.' })
        return
      }
      const unit = f.unit ? ` ${f.unit}` : ''
      if ((f.min !== null && number < f.min) || (f.max !== null && number > f.max)) {
        ctx.addIssue({ code: 'custom', message: `Must be between ${f.min} and ${f.max}${unit}.` })
      }
    })
  }
  // keys are only known at runtime, so state the form's value type explicitly
  return z.object(shape) as unknown as z.ZodType<Record<string, string>, Record<string, string>>
}

/** Convert string form values to the API payload: numbers, or null when left blank. */
export function toInputs(values: Record<string, string>): Record<string, number | null> {
  return Object.fromEntries(
    Object.entries(values).map(([key, raw]) => [key, raw.trim() === '' ? null : Number(raw)]),
  )
}

export function emptyValues(features: FeatureSpec[]): Record<string, string> {
  return Object.fromEntries(features.map((f) => [f.name, '']))
}

/** Realistic example values per module (a "fill example" button for demos). */
export const EXAMPLES: Record<string, Record<string, string>> = {
  diabetes: {
    Pregnancies: '2',
    Glucose: '148',
    BloodPressure: '72',
    SkinThickness: '35',
    Insulin: '',
    BMI: '33.6',
    DiabetesPedigreeFunction: '0.627',
    Age: '50',
  },
  heart: {
    age: '58',
    sex: '1',
    cp: '4',
    trestbps: '140',
    chol: '260',
    fbs: '0',
    restecg: '2',
    thalach: '125',
    exang: '1',
    oldpeak: '2.0',
    slope: '2',
    ca: '1',
    thal: '7',
  },
  liver: {
    Age: '45',
    Gender: '1',
    Total_Bilirubin: '2.8',
    Direct_Bilirubin: '1.3',
    Alkaline_Phosphotase: '380',
    Alamine_Aminotransferase: '95',
    Aspartate_Aminotransferase: '110',
    Total_Proteins: '6.4',
    Albumin: '3.0',
    Albumin_and_Globulin_Ratio: '0.9',
  },
}
