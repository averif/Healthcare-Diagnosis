import { ClipboardList } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { PredictionTable } from '@/components/prediction/PredictionVisuals'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Card, PageHeader } from '@/components/ui/Card'
import { Alert, EmptyState, FullPageSpinner } from '@/components/ui/Feedback'
import { Select } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Table'
import { errorMessage } from '@/lib/api'
import { usePredictions } from '@/lib/queries'
import { DISEASE_LABEL } from '@/lib/utils'
import type { Disease } from '@/types/api'

export function HistoryPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const filters = {
    disease: (params.get('disease') ?? '') as Disease | '',
    risk_level: params.get('risk_level') ?? '',
    status: params.get('status') ?? '',
    page: Number(params.get('page') ?? 1),
    page_size: 15,
  }
  const { data, isPending, error, isFetching } = usePredictions(filters)

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const isPatient = user?.role === 'patient'
  return (
    <>
      <PageHeader
        title={isPatient ? 'My assessment history' : 'Assessments'}
        description={
          isPatient
            ? 'Every assessment you have run, with its result and review status.'
            : 'Assessments for your patients. Filter by status to work through the review queue.'
        }
        action={
          isPatient && (
            <Link to="/assess" className={buttonVariants()}>
              New assessment
            </Link>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <Select
            aria-label="Module"
            className="w-auto"
            value={filters.disease}
            onChange={(e) => update('disease', e.target.value)}
          >
            <option value="">All modules</option>
            {Object.entries(DISEASE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Risk level"
            className="w-auto"
            value={filters.risk_level}
            onChange={(e) => update('risk_level', e.target.value)}
          >
            <option value="">All risk levels</option>
            <option value="high">High risk</option>
            <option value="moderate">Moderate risk</option>
            <option value="low">Low risk</option>
          </Select>
          <Select
            aria-label="Review status"
            className="w-auto"
            value={filters.status}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">Any status</option>
            <option value="pending_review">Pending review</option>
            <option value="reviewed">Reviewed</option>
          </Select>
        </div>
        {isPending ? (
          <FullPageSpinner />
        ) : error ? (
          <Alert tone="error" className="m-4">
            {errorMessage(error)}
          </Alert>
        ) : data.items.length ? (
          <div className={isFetching ? 'opacity-60 transition-opacity' : ''}>
            <PredictionTable predictions={data.items} showPatient={!isPatient} />
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              onChange={(page) => update('page', String(page))}
            />
          </div>
        ) : (
          <EmptyState icon={<ClipboardList className="size-10" />} title="No assessments found">
            Try a different filter{isPatient && ', or start a new assessment'}.
          </EmptyState>
        )}
      </Card>
    </>
  )
}
