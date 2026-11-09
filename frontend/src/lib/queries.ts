import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, saveBlob } from '@/lib/api'
import type {
  AuditLog,
  ChatMessage,
  ChatReply,
  DashboardSummary,
  Disease,
  ModelCard,
  Page,
  Patient,
  Prediction,
  PredictionModule,
  Role,
  User,
  Verdict,
} from '@/types/api'

/** Strip empty filters so they are not sent as `?disease=` */
function params<T extends object>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null))
}

// ---- dashboard & modules ------------------------------------------------------------------

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
  })

export const useModules = () =>
  useQuery({
    queryKey: ['modules'],
    queryFn: async () => (await api.get<PredictionModule[]>('/predictions/modules')).data,
    staleTime: Infinity,
  })

export const useModelCards = () =>
  useQuery({
    queryKey: ['model-cards'],
    queryFn: async () => (await api.get<ModelCard[]>('/models')).data,
    staleTime: 5 * 60_000,
  })

// ---- patients -----------------------------------------------------------------------------

export const useMyProfile = (enabled = true) =>
  useQuery({
    queryKey: ['patient', 'me'],
    queryFn: async () => (await api.get<Patient>('/patients/me')).data,
    enabled,
  })

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Patient> & { full_name?: string }) =>
      (await api.put<Patient>('/patients/me', body)).data,
    onSuccess: (patient) => {
      qc.setQueryData(['patient', 'me'], patient)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export interface PatientFilters {
  search?: string
  page?: number
  page_size?: number
}

export const usePatients = (filters: PatientFilters) =>
  useQuery({
    queryKey: ['patients', filters],
    queryFn: async () =>
      (await api.get<Page<Patient>>('/patients', { params: params(filters) })).data,
    placeholderData: keepPreviousData,
  })

export const usePatient = (id: number) =>
  useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await api.get<Patient>(`/patients/${id}`)).data,
    enabled: id > 0,
  })

// ---- predictions --------------------------------------------------------------------------

export interface PredictionFilters {
  patient_id?: number
  disease?: Disease | ''
  risk_level?: string
  status?: string
  page?: number
  page_size?: number
}

export const usePredictions = (filters: PredictionFilters) =>
  useQuery({
    queryKey: ['predictions', filters],
    queryFn: async () =>
      (await api.get<Page<Prediction>>('/predictions', { params: params(filters) })).data,
    placeholderData: keepPreviousData,
  })

export const usePrediction = (id: number) =>
  useQuery({
    queryKey: ['prediction', id],
    queryFn: async () => (await api.get<Prediction>(`/predictions/${id}`)).data,
  })

export function useCreatePrediction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { disease: Disease; inputs: object; patient_id?: number }) =>
      (
        await api.post<Prediction>(`/predictions/${vars.disease}`, {
          inputs: vars.inputs,
          ...(vars.patient_id ? { patient_id: vars.patient_id } : {}),
        })
      ).data,
    onSuccess: (prediction) => {
      qc.setQueryData(['prediction', prediction.id], prediction)
      qc.invalidateQueries({ queryKey: ['predictions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useReview(predictionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { verdict: Verdict; notes?: string }) =>
      (await api.put<Prediction>(`/predictions/${predictionId}/review`, body)).data,
    onSuccess: (prediction) => {
      qc.setQueryData(['prediction', predictionId], prediction)
      qc.invalidateQueries({ queryKey: ['predictions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDownloadReport(predictionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<Blob>(`/predictions/${predictionId}/report`, null, {
        responseType: 'blob',
      })
      const code = response.headers['x-report-code'] as string
      saveBlob(response.data, `MediAssist-${code}.pdf`)
      return code
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prediction', predictionId] }),
  })
}

export async function downloadReportByCode(code: string) {
  const response = await api.get<Blob>(`/reports/${code}`, { responseType: 'blob' })
  saveBlob(response.data, `MediAssist-${code}.pdf`)
}

// ---- assistant ----------------------------------------------------------------------------

export const useAssistantStatus = () =>
  useQuery({
    queryKey: ['assistant-status'],
    queryFn: async () => (await api.get<{ provider: string }>('/assistant/status')).data,
    staleTime: Infinity,
  })

export const useChatHistory = (predictionId: number) =>
  useQuery({
    queryKey: ['chat', predictionId],
    queryFn: async () =>
      (
        await api.get<ChatMessage[]>('/assistant/history', {
          params: { prediction_id: predictionId },
        })
      ).data,
  })

export function useSendChat(predictionId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (message: string) =>
      (
        await api.post<ChatReply>('/assistant/chat', {
          message,
          prediction_id: predictionId,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', predictionId] }),
  })
}

// ---- admin --------------------------------------------------------------------------------

export interface UserFilters {
  role?: Role | ''
  search?: string
  page?: number
  page_size?: number
}

export const useUsers = (filters: UserFilters) =>
  useQuery({
    queryKey: ['users', filters],
    queryFn: async () =>
      (await api.get<Page<User>>('/admin/users', { params: params(filters) })).data,
    placeholderData: keepPreviousData,
  })

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { email: string; password: string; full_name: string; role: Role }) =>
      (await api.post<User>('/admin/users', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; role?: Role; is_active?: boolean }) =>
      (await api.patch<User>(`/admin/users/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAssignDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ patientId, doctorId }: { patientId: number; doctorId: number | null }) =>
      (await api.put<Patient>(`/admin/patients/${patientId}/doctor`, { doctor_id: doctorId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useAuditLogs = (filters: { action?: string; page?: number }) =>
  useQuery({
    queryKey: ['audit', filters],
    queryFn: async () =>
      (await api.get<Page<AuditLog>>('/admin/audit-logs', { params: params(filters) })).data,
    placeholderData: keepPreviousData,
  })
