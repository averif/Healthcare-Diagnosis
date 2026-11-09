import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card'
import { Alert, FullPageSpinner } from '@/components/ui/Feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { errorMessage } from '@/lib/api'
import { useMyProfile, useUpdateProfile } from '@/lib/queries'

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (Number(v) >= min && Number(v) <= max),
      `${label} must be ${min}–${max}.`,
    )

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.').max(120),
  date_of_birth: z
    .string()
    .refine((v) => v === '' || new Date(v) < new Date(), 'Date of birth must be in the past.'),
  sex: z.string(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9 -]{7,20}$/.test(v), 'Enter a valid phone number.'),
  blood_group: z.string(),
  height_cm: optionalNumber(50, 250, 'Height'),
  weight_kg: optionalNumber(2, 300, 'Weight'),
  medical_history: z.string().max(4000),
})
type Values = z.infer<typeof schema>

const blank = (v: string) => (v.trim() === '' ? null : v.trim())

export function ProfilePage() {
  const { data, isPending, error } = useMyProfile()
  const update = useUpdateProfile()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const { register, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!data) return
    reset({
      full_name: data.full_name,
      date_of_birth: data.date_of_birth ?? '',
      sex: data.sex ?? '',
      phone: data.phone ?? '',
      blood_group: data.blood_group ?? '',
      height_cm: data.height_cm?.toString() ?? '',
      weight_kg: data.weight_kg?.toString() ?? '',
      medical_history: data.medical_history ?? '',
    })
  }, [data, reset])

  if (isPending) return <FullPageSpinner />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>

  const onSubmit = handleSubmit((v) =>
    update.mutate({
      full_name: v.full_name,
      date_of_birth: blank(v.date_of_birth),
      sex: (blank(v.sex) as 'male' | 'female' | 'other' | null) ?? null,
      phone: blank(v.phone),
      blood_group: blank(v.blood_group),
      height_cm: v.height_cm ? Number(v.height_cm) : null,
      weight_kg: v.weight_kg ? Number(v.weight_kg) : null,
      medical_history: blank(v.medical_history),
    }),
  )
  const e = formState.errors

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My profile" description={user?.email} />
      {params.get('welcome') && !update.isSuccess && (
        <Alert tone="success" title="Welcome to MediAssist!" className="mb-6">
          Complete your profile so your doctor can interpret your results, then start your first
          assessment.
        </Alert>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Age</p>
          <p className="text-lg font-semibold">{data.age ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">BMI</p>
          <p className="text-lg font-semibold">{data.bmi ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Assigned doctor</p>
          <p className="truncate text-lg font-semibold">
            {data.assigned_doctor?.full_name ?? 'Not yet assigned'}
          </p>
        </Card>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <Card>
          <CardHeader title="Personal details" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field
              id="full_name"
              label="Full name"
              required
              error={e.full_name?.message}
              className="sm:col-span-2"
            >
              <Input id="full_name" aria-invalid={!!e.full_name} {...register('full_name')} />
            </Field>
            <Field id="date_of_birth" label="Date of birth" error={e.date_of_birth?.message}>
              <Input id="date_of_birth" type="date" {...register('date_of_birth')} />
            </Field>
            <Field id="sex" label="Sex">
              <Select id="sex" {...register('sex')}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field id="height_cm" label="Height (cm)" error={e.height_cm?.message}>
              <Input id="height_cm" type="number" step="0.1" {...register('height_cm')} />
            </Field>
            <Field id="weight_kg" label="Weight (kg)" error={e.weight_kg?.message}>
              <Input id="weight_kg" type="number" step="0.1" {...register('weight_kg')} />
            </Field>
            <Field id="phone" label="Phone" error={e.phone?.message}>
              <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
            </Field>
            <Field id="blood_group" label="Blood group">
              <Select id="blood_group" {...register('blood_group')}>
                <option value="">Unknown</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            </Field>
            <Field
              id="medical_history"
              label="Medical history"
              hint="Existing conditions, allergies, current medicines (shared with your doctor)."
              className="sm:col-span-2"
            >
              <Textarea id="medical_history" {...register('medical_history')} />
            </Field>
          </CardBody>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
            {update.isSuccess && !formState.isDirty && (
              <span className="text-sm text-emerald-600">Saved.</span>
            )}
            {update.error && (
              <span className="text-sm text-red-600">{errorMessage(update.error)}</span>
            )}
            <Button type="submit" loading={update.isPending}>
              Save changes
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
