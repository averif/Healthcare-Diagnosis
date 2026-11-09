import { ArrowLeft, Search, Stethoscope, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { PredictionTable } from '@/components/prediction/PredictionVisuals'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card'
import { Alert, Badge, EmptyState, FullPageSpinner } from '@/components/ui/Feedback'
import { Input, Select } from '@/components/ui/Form'
import { Pagination, Table, Td, Th } from '@/components/ui/Table'
import { errorMessage } from '@/lib/api'
import { useAssignDoctor, usePatient, usePatients, usePredictions, useUsers } from '@/lib/queries'
import { fmtDate, titleCase } from '@/lib/utils'
import type { Patient } from '@/types/api'

function AssignDoctor({ patient }: { patient: Patient }) {
  const doctors = useUsers({ role: 'doctor', page_size: 100 })
  const assign = useAssignDoctor()
  return (
    <Select
      aria-label={`Assigned doctor for ${patient.full_name}`}
      className="h-9 w-48"
      value={patient.assigned_doctor?.id ?? ''}
      disabled={assign.isPending}
      onChange={(e) =>
        assign.mutate({
          patientId: patient.id,
          doctorId: e.target.value ? Number(e.target.value) : null,
        })
      }
    >
      <option value="">Unassigned</option>
      {doctors.data?.items
        .filter((d) => d.is_active)
        .map((d) => (
          <option key={d.id} value={d.id}>
            {d.full_name}
          </option>
        ))}
    </Select>
  )
}

export function PatientsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isPending, error } = usePatients({ search, page, page_size: 15 })

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Patients' : 'My patients'}
        description={
          isAdmin
            ? 'All registered patients. Assign each one to a responsible doctor.'
            : 'Patients assigned to you. Open a patient to see their history or run an assessment.'
        }
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-5 text-slate-400" />
            <Input
              placeholder="Search by name or email"
              aria-label="Search patients"
              className="pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>
        {isPending ? (
          <FullPageSpinner />
        ) : error ? (
          <Alert tone="error" className="m-4">
            {errorMessage(error)}
          </Alert>
        ) : data.items.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Age / sex</Th>
                  <Th>Assessments</Th>
                  <Th>{isAdmin ? 'Assigned doctor' : 'Registered'}</Th>
                  <Th>
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium text-slate-800">{p.full_name}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </Td>
                    <Td className="text-slate-600">
                      {p.age ?? '—'} {p.sex && `· ${titleCase(p.sex)}`}
                    </Td>
                    <Td>{p.prediction_count}</Td>
                    <Td>{isAdmin ? <AssignDoctor patient={p} /> : fmtDate(p.created_at)}</Td>
                    <Td className="text-right">
                      <Link
                        to={`/patients/${p.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        Open
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={<Users className="size-10" />} title="No patients found">
            {search ? 'Try another search.' : 'No patients are assigned to you yet.'}
          </EmptyState>
        )}
      </Card>
    </>
  )
}

export function PatientDetailPage() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const patient = usePatient(id)
  const [page, setPage] = useState(1)
  const predictions = usePredictions({ patient_id: id, page, page_size: 10 })

  if (patient.isPending) return <FullPageSpinner />
  if (patient.error)
    return <Alert tone="error">{errorMessage(patient.error, 'Patient not found.')}</Alert>
  const p = patient.data

  const facts = [
    ['Age', p.age ?? '—'],
    ['Sex', p.sex ? titleCase(p.sex) : '—'],
    ['Blood group', p.blood_group ?? '—'],
    ['Height', p.height_cm ? `${p.height_cm} cm` : '—'],
    ['Weight', p.weight_kg ? `${p.weight_kg} kg` : '—'],
    ['BMI', p.bmi ?? '—'],
    ['Phone', p.phone ?? '—'],
    ['Doctor', p.assigned_doctor?.full_name ?? 'Unassigned'],
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/patients"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" /> All patients
        </Link>
        <PageHeader
          title={p.full_name}
          description={`${p.email} · patient since ${fmtDate(p.created_at)}`}
          action={
            user?.role === 'doctor' && (
              <Link to={`/assess?patient=${p.id}`} className={buttonVariants()}>
                <Stethoscope className="size-4" /> Run assessment
              </Link>
            )
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <dl className="space-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            {p.medical_history && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-1 text-xs font-medium text-slate-500 uppercase">Medical history</p>
                <p className="text-sm whitespace-pre-line text-slate-700">{p.medical_history}</p>
              </div>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Assessment history"
            action={
              <Badge className="bg-slate-100 text-slate-600">
                {predictions.data?.total ?? 0} total
              </Badge>
            }
          />
          <div className="mt-3">
            {predictions.data?.items.length ? (
              <>
                <PredictionTable predictions={predictions.data.items} />
                <Pagination
                  page={predictions.data.page}
                  pages={predictions.data.pages}
                  total={predictions.data.total}
                  onChange={setPage}
                />
              </>
            ) : (
              <EmptyState title="No assessments yet" />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
