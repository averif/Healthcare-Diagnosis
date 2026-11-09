import { buildSchema, toInputs } from './assessment'
import type { FeatureSpec } from '@/types/api'

const spec = (overrides: Partial<FeatureSpec>): FeatureSpec => ({
  name: 'Glucose',
  label: 'Glucose',
  kind: 'numeric',
  unit: 'mg/dL',
  min: 40,
  max: 300,
  choices: {},
  required: true,
  help: '',
  ...overrides,
})

describe('buildSchema', () => {
  const schema = buildSchema([
    spec({}),
    spec({ name: 'Insulin', required: false, min: 10, max: 900, unit: 'µU/mL' }),
    spec({ name: 'sex', kind: 'binary', choices: { '0': 'female', '1': 'male' }, unit: '' }),
  ])

  it('accepts valid values and blank optional fields', () => {
    expect(schema.safeParse({ Glucose: '168', Insulin: '', sex: '1' }).success).toBe(true)
  })

  it('reports out-of-range, missing and invalid values per field', () => {
    const result = schema.safeParse({ Glucose: '900', Insulin: 'abc', sex: '' })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(
      result.error!.issues.map((issue) => [issue.path[0], issue.message]),
    )
    expect(messages.Glucose).toBe('Must be between 40 and 300 mg/dL.')
    expect(messages.Insulin).toBe('Enter a number.')
    expect(messages.sex).toBe('Required.')
  })

  it('rejects unknown categorical codes', () => {
    expect(schema.safeParse({ Glucose: '100', Insulin: '', sex: '7' }).success).toBe(false)
  })
})

describe('toInputs', () => {
  it('converts strings to numbers and blanks to null', () => {
    expect(toInputs({ Glucose: '168', Insulin: ' ', BMI: '33.1' })).toEqual({
      Glucose: 168,
      Insulin: null,
      BMI: 33.1,
    })
  })
})
