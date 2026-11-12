import { zodResolver } from '@hookform/resolvers/zod'
import { BadgeCheck, Check, FileText, Plus, ScrollText, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { Alert, Badge, EmptyState, FullPageSpinner } from '@/components/ui/Feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, Tabs } from '@/components/ui/Overlay'
import { Pagination, Table, Td, Th } from '@/components/ui/Table'
import { errorMessage, fieldErrors } from '@/lib/api'
import {
  openDoctorDocument,
  useApproveApplication,
  useAuditLogs,
  useCreateUser,
  useDoctorApplications,
  useRejectApplication,
  useUpdateUser,
  useUsers,
} from '@/lib/queries'
import { fmtDate, titleCase } from '@/lib/utils'
import type { DoctorApplication, DoctorStatus, Role, User } from '@/types/api'

const ROLES: Role[] = ['patient', 'doctor', 'admin']
const ROLE_STYLE: Record<Role, string> = {
  patient: 'bg-sky-50 text-sky-700',
  doctor: 'bg-brand-50 text-brand-700',
  admin: 'bg-violet-50 text-violet-700',
}

const createSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the full name.'),
  email: z.email('Enter a valid email.'),
  role: z.enum(['patient', 'doctor', 'admin']),
  password: z
    .string()
    .min(8, 'At least 8 characters.')
    .regex(/[A-Za-z]/, 'Include a letter.')
    .regex(/\d/, 'Include a number.'),
})
type CreateValues = z.infer<typeof createSchema>

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateUser()
  const { register, handleSubmit, reset, setError, formState } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'doctor' },
  })
  const close = () => {
    reset({ role: 'doctor' })
    create.reset()
    onClose()
  }
  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: close,
      onError: (err) =>
        Object.entries(fieldErrors(err)).forEach(([k, message]) =>
          setError(k as keyof CreateValues, { message }),
        ),
    }),
  )
  const e = formState.errors
  return (
    <Modal open={open} onClose={close} title="Create user">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {create.error && !Object.keys(fieldErrors(create.error)).length && (
          <Alert tone="error">{errorMessage(create.error)}</Alert>
        )}
        <Field id="new-name" label="Full name" required error={e.full_name?.message}>
          <Input id="new-name" {...register('full_name')} />
        </Field>
        <Field id="new-email" label="Email" required error={e.email?.message}>
          <Input id="new-email" type="email" {...register('email')} />
        </Field>
        <Field id="new-role" label="Role" required>
          <Select id="new-role" {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="new-password"
          label="Temporary password"
          required
          hint="Share it securely; the user should change it after signing in."
          error={e.password?.message}
        >
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function UserRow({ u, isSelf }: { u: User; isSelf: boolean }) {
  const update = useUpdateUser()
  return (
    <tr className="hover:bg-zinc-50">
      <Td>
        <p className="font-medium text-zinc-800">
          {u.full_name} {isSelf && <span className="text-xs text-zinc-400">(you)</span>}
        </p>
        <p className="text-xs text-zinc-500">{u.email}</p>
      </Td>
      <Td>
        {isSelf ? (
          <Badge className={ROLE_STYLE[u.role]}>{titleCase(u.role)}</Badge>
        ) : (
          <Select
            aria-label={`Role of ${u.full_name}`}
            className="h-9 w-32"
            value={u.role}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </Select>
        )}
      </Td>
      <Td>
        {u.is_active ? (
          <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
        ) : (
          <Badge className="bg-zinc-100 text-zinc-500">Deactivated</Badge>
        )}
      </Td>
      <Td className="text-zinc-500">{fmtDate(u.last_login_at, true)}</Td>
      <Td className="text-right">
        {!isSelf && (
          <Button
            size="sm"
            variant={u.is_active ? 'secondary' : 'primary'}
            loading={update.isPending}
            onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}
          >
            {u.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        )}
      </Td>
    </tr>
  )
}

export function UsersPage() {
  const { user } = useAuth()
  const [role, setRole] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const { data, isPending, error } = useUsers({ role, search, page, page_size: 15 })

  return (
    <>
      <PageHeader
        title="Users"
        description="Create accounts, change roles and deactivate access."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create user
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-zinc-100 p-4">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-5 text-zinc-400" />
            <Input
              placeholder="Search name or email"
              aria-label="Search users"
              className="pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            aria-label="Filter by role"
            className="w-auto"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | '')
              setPage(1)
            }}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}s
              </option>
            ))}
          </Select>
        </div>
        {isPending ? (
          <FullPageSpinner />
        ) : error ? (
          <Alert tone="error" className="m-4">
            {errorMessage(error)}
          </Alert>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Last sign-in</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <UserRow key={u.id} u={u} isSelf={u.id === user?.id} />
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

const ACTION_GROUPS = [
  '',
  'auth.',
  'patient.',
  'prediction.',
  'review.',
  'report.',
  'admin.',
  'assistant.',
]

export function AuditLogPage() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const { data, isPending, error } = useAuditLogs({ action, page })

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in, record access, prediction, review, report and admin change."
      />
      <Card>
        <div className="border-b border-zinc-100 p-4">
          <Select
            aria-label="Filter by action"
            className="w-auto"
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
          >
            {ACTION_GROUPS.map((a) => (
              <option key={a} value={a}>
                {a ? titleCase(a.replace('.', '')) : 'All actions'}
              </option>
            ))}
          </Select>
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
                  <Th>When</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Record</Th>
                  <Th>Details</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <Td className="whitespace-nowrap text-zinc-500">
                      {fmtDate(log.created_at, true)}
                    </Td>
                    <Td>{log.user_email ?? <span className="text-zinc-400">anonymous</span>}</Td>
                    <Td>
                      <code
                        className={`rounded px-1.5 py-0.5 text-xs ${log.action.includes('failed') || log.action.includes('emergency') ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-700'}`}
                      >
                        {log.action}
                      </code>
                    </Td>
                    <Td className="text-zinc-600">
                      {log.entity_type ? `${log.entity_type} #${log.entity_id}` : '—'}
                    </Td>
                    <Td className="max-w-xs truncate text-xs text-zinc-500">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </Td>
                    <Td className="text-xs text-zinc-500">{log.ip_address}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={<ScrollText className="size-10" />} title="No matching events" />
        )}
      </Card>
    </>
  )
}

// ---- doctor applications ------------------------------------------------------------------

const APPLICATION_STATUS: { value: DoctorStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]
const STATUS_STYLE: Record<DoctorStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Give the applicant a reason (at least 5 characters).')
    .max(500, 'Use at most 500 characters.'),
})
type RejectValues = z.infer<typeof rejectSchema>

function RejectModal({
  application,
  onClose,
}: {
  application: DoctorApplication | null
  onClose: () => void
}) {
  const reject = useRejectApplication()
  const { register, handleSubmit, reset, formState } = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
  })
  const close = () => {
    reset({ reason: '' })
    reject.reset()
    onClose()
  }
  const onSubmit = handleSubmit(({ reason }) => {
    if (!application) return
    reject.mutate({ id: application.id, reason }, { onSuccess: close })
  })
  return (
    <Modal open={!!application} onClose={close} title="Reject application">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {reject.error && <Alert tone="error">{errorMessage(reject.error)}</Alert>}
        <p className="text-sm text-zinc-600">
          {application?.user.full_name} will see this reason when they sign in.
        </p>
        <Field id="reject-reason" label="Reason" required error={formState.errors.reason?.message}>
          <Textarea
            id="reject-reason"
            maxLength={500}
            aria-invalid={!!formState.errors.reason}
            {...register('reason')}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={reject.isPending}>
            Reject
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ApplicationRow({
  application,
  onReject,
}: {
  application: DoctorApplication
  onReject: (application: DoctorApplication) => void
}) {
  const approve = useApproveApplication()
  const [docError, setDocError] = useState<string | null>(null)
  const name = application.user.full_name
  return (
    <tr className="hover:bg-zinc-50">
      <Td>
        <p className="font-medium text-zinc-800">{name}</p>
        <p className="text-xs text-zinc-500">{application.user.email}</p>
      </Td>
      <Td>
        <p className="font-mono text-[13px] text-zinc-800">{application.license_number}</p>
        <p className="text-xs text-zinc-500">{application.issuing_authority}</p>
      </Td>
      <Td>
        <p className="text-zinc-700">{application.hospital ?? '—'}</p>
        {application.specialty && <p className="text-xs text-zinc-500">{application.specialty}</p>}
      </Td>
      <Td className="whitespace-nowrap text-zinc-500">{fmtDate(application.created_at)}</Td>
      <Td>
        {application.has_document ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
            onClick={() =>
              openDoctorDocument(application.id).catch((err) => setDocError(errorMessage(err)))
            }
          >
            <FileText className="size-3.5" aria-hidden /> View document
          </button>
        ) : (
          <span className="text-xs text-zinc-400">None</span>
        )}
        {docError && <p className="mt-1 text-xs text-red-600">{docError}</p>}
      </Td>
      <Td className="text-right">
        {application.status === 'pending' ? (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              aria-label={`Approve ${name}`}
              loading={approve.isPending}
              onClick={() => approve.mutate(application.id)}
            >
              <Check className="size-4" aria-hidden /> Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Reject ${name}`}
              disabled={approve.isPending}
              onClick={() => onReject(application)}
            >
              <X className="size-4" aria-hidden /> Reject
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Badge className={STATUS_STYLE[application.status]}>
              {titleCase(application.status)}
            </Badge>
            {application.rejection_reason && (
              <p className="ml-auto max-w-56 text-xs text-zinc-500">
                {application.rejection_reason}
              </p>
            )}
          </div>
        )}
        {approve.error && (
          <p className="mt-1 text-xs text-red-600">{errorMessage(approve.error)}</p>
        )}
      </Td>
    </tr>
  )
}

export function ApplicationsPage() {
  const [status, setStatus] = useState<DoctorStatus | ''>('pending')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<DoctorApplication | null>(null)
  const { data, isPending, error } = useDoctorApplications({ status, page, page_size: 15 })

  return (
    <>
      <PageHeader
        title="Doctor applications"
        description="Verify each licence with the issuing authority before approving access."
      />
      <Card>
        <div className="border-b border-zinc-100 p-4">
          <Tabs
            tabs={APPLICATION_STATUS}
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
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
                  <Th>Applicant</Th>
                  <Th>Licence</Th>
                  <Th>Hospital</Th>
                  <Th>Submitted</Th>
                  <Th>Document</Th>
                  <Th>
                    <span className="sr-only">Decision</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                    onReject={setRejecting}
                  />
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={<BadgeCheck className="size-10" />} title="No applications">
            {status === 'pending' ? 'New doctor sign-ups will appear here.' : null}
          </EmptyState>
        )}
      </Card>
      <RejectModal application={rejecting} onClose={() => setRejecting(null)} />
    </>
  )
}
