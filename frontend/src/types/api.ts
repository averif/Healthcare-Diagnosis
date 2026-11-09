// Types mirroring the Flask API's marshmallow schemas (see backend/app/schemas.py).

export type Role = 'patient' | 'doctor' | 'admin'
export type Disease = 'diabetes' | 'heart' | 'liver' | 'symptom'
export type RiskLevel = 'low' | 'moderate' | 'high'
export type PredictionStatus = 'pending_review' | 'reviewed'
export type Verdict = 'agree' | 'disagree' | 'inconclusive'
export type Sex = 'male' | 'female' | 'other'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  last_login_at: string | null
  patient_id: number | null
}

export interface AuthTokens {
  access_token: string
  refresh_token?: string
  user: User
}

export interface DoctorBrief {
  id: number
  full_name: string
  email: string
}

export interface Patient {
  id: number
  user_id: number
  full_name: string
  email: string
  date_of_birth: string | null
  age: number | null
  sex: Sex | null
  phone: string | null
  blood_group: string | null
  height_cm: number | null
  weight_kg: number | null
  bmi: number | null
  medical_history: string | null
  assigned_doctor: DoctorBrief | null
  prediction_count: number
  created_at: string
}

export interface FeatureSpec {
  name: string
  label: string
  kind: 'numeric' | 'categorical' | 'binary'
  unit: string
  min: number | null
  max: number | null
  choices: Record<string, string>
  required: boolean
  help: string
}

export interface SymptomOption {
  name: string
  label: string
  red_flag: boolean
}

export interface PredictionModule {
  disease: Disease
  title: string
  description: string
  algorithm: string
  version: string
  class_names: string[]
  test_metrics: Record<string, number>
  limitations: string[]
  features: FeatureSpec[]
  symptoms?: SymptomOption[]
}

export interface Reason {
  feature: string
  label: string
  value: string
  condition: string
  text: string
  contribution: number
  imputed: boolean
}

export interface Explanation {
  target_class: number
  base_rate: number
  probability: number
  path_length: number
  method?: string
  reasons: Reason[]
}

export interface Review {
  id: number
  verdict: Verdict
  notes: string | null
  doctor: DoctorBrief | null
  created_at: string
}

export interface Prediction {
  id: number
  patient_id: number
  patient_name: string
  disease: Disease
  input_data: Record<string, number | null | string[]>
  predicted_label: string
  probability: number
  risk_level: RiskLevel
  explanation: Explanation | null
  top_conditions: { condition: string; probability: number }[] | null
  guidance: string[]
  red_flags: string[]
  model: { version: string; algorithm: string } | null
  status: PredictionStatus
  review: Review | null
  report_codes: string[]
  created_by: string | null
  created_at: string
  disclaimer: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface DashboardSummary {
  totals: { patients: number; predictions: number; pending_reviews: number; high_risk: number }
  by_disease: Record<Disease, number>
  by_risk: Record<RiskLevel, number>
  by_status: Partial<Record<PredictionStatus, number>>
  timeline: { date: string; count: number }[]
  recent: Prediction[]
  users_by_role?: Partial<Record<Role, number>>
  unassigned_patients?: number
}

export interface AuditLog {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  ip_address: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  prediction_id: number | null
  created_at: string
}

export interface ChatReply {
  reply: ChatMessage
  provider: 'claude' | 'rules' | 'safety'
  emergency: boolean
}

// ---- model cards (ml/models/*.card.json) ------------------------------------------------

export interface MeanStd {
  mean: number
  std: number
}

export interface TestMetrics {
  accuracy: number
  balanced_accuracy?: number
  precision?: number
  recall?: number
  specificity?: number
  f1: number
  f1_macro?: number
  top3_accuracy?: number
  roc_auc?: number
  confusion_matrix?: number[][]
  roc_curve?: { fpr: number[]; tpr: number[]; thresholds: number[] }
  support?: Record<string, number> | number
}

export interface ComparisonEntry {
  label: string
  params: Record<string, unknown>
  test: TestMetrics
  cv?: Record<string, MeanStd>
}

export interface ModelCard {
  disease: Disease
  title: string
  version: string
  algorithm: string
  deployment_rationale: string | null
  trained_at: string
  intended_use: string
  limitations: string[]
  dataset: {
    source: string
    raw_rows: number
    rows: number
    class_balance: Record<string, number>
    cleaning: string[]
    split: { train: number; test: number; stratified: boolean }
  }
  feature_names: string[]
  features: FeatureSpec[] | null
  class_names: string[]
  hyperparameters: Record<string, unknown>
  model_selection: {
    search: string
    scoring: string
    candidates_evaluated: number
    refit_rule: string
    best_cv_score: number
    selected_cv_score: number
  }
  tree: { depth: number; leaves: number; n_trees: number }
  evaluation: { test: TestMetrics; nested_cv: Record<string, MeanStd> | null }
  comparison: Record<string, ComparisonEntry>
  feature_importance: { feature: string; importance: number }[]
  risk_bands: Record<string, number> | null
  robustness: Record<
    string,
    { label: string; hidden_symptoms: number[]; top1: number[]; top3: number[] }
  > | null
  predictions_served: number
}
