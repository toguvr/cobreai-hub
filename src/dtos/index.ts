export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  role?: string;
}

export interface Enterprise {
  id: string;
  title: string;
  logo?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface UserEnterprise {
  id: string;
  user_id: string;
  enterprise_id: string;
  role: 'org_admin' | 'org_viewer';
  enterprise: Enterprise;
  user?: User;
  created_at: string;
}

export interface Hospital {
  id: string;
  name: string;
  cidade?: string;
  uf?: string;
  logo_url?: string;
  adminFee?: number;
  tax?: number;
  min_hours?: number;
  min_tolerance?: number;
  enterprise_id?: string;
}

export interface HospitalHistoryPoint {
  month: string;
  balance: number;
}

export interface HospitalSummary extends Hospital {
  month_appointments: number;
  month_income: number;
  month_outcome: number;
  prev_month_income: number;
  prev_month_outcome: number;
  history_3m: HospitalHistoryPoint[];
}

export interface MonthlyPoint {
  month: string;
  income: number;
  outcome: number;
  balance: number;
  appointments: number;
}

export interface EnterpriseHub {
  enterprise_id: string;
  title: string;
  logo_url?: string;
  month: string; // YYYY-MM
  hospitals_count: number;

  month_income: number;
  month_outcome: number;
  month_appointments: number;
  active_doctors: number;
  avg_cost_per_appointment: number;

  prev_month_income: number;
  prev_month_outcome: number;
  prev_month_appointments: number;
  prev_active_doctors: number;

  monthly_history: MonthlyPoint[];
  hospitals: HospitalSummary[];
  missing_prices?: MissingPriceInfo[];
}

export interface MissingPriceInfo {
  hospital_id: string;
  hospital_name: string | null;
  expertise_id: string;
  expertise_name: string | null;
  appointments_affected: number;
}

export interface DoctorSummary {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  admin: boolean;
}

export interface AppointmentSummary {
  id: string;
  date: string;
  title: string;
  duration: number;
  doctor_price: number;
  total_price: number;
  doctor_name: string | null;
  expertise_name: string | null;
  start_checkin: string | null;
  stop_checkin: string | null;
}

export interface HospitalDetail {
  hospital: Hospital & {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cep: string | null;
    complemento: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  kpis: {
    total_appointments_month: number;
    total_appointments_all: number;
    active_doctors: number;
    income_month: number;
    outcome_month: number;
  };
  month_appointments: AppointmentSummary[];
  doctors: DoctorSummary[];
  missing_prices?: MissingPriceInfo[];
}

export interface FinancialRow {
  hospital_id: string;
  hospital_name: string;
  income: number;
  outcome: number;
}

export interface FinancialData {
  rows: FinancialRow[];
  totals: { income: number; outcome: number };
  missing_prices?: MissingPriceInfo[];
}

// ── Preços versionados da empresa ──────────────────────────────────────

export interface EnterprisePriceVersion {
  id: string;
  enterprise_id: string;
  expertise_id: string;
  effective_from: string; // YYYY-MM-DD
  doctor_price: number;
  total_price: number;
  doctor_fds_price: number;
  total_fds_price: number;
  monthly_doctor_price: number;
  monthly_total_price: number;
  created_by?: string;
  created_at: string;
}

export interface EnterprisePriceExpertise {
  expertise_id: string;
  expertise_name: string;
  current: EnterprisePriceVersion | null;
  has_price: boolean;
  version_count: number;
}

export interface EnterprisePriceHospitalGroup {
  hospital_id: string;
  hospital_name: string | null;
  expertises: EnterprisePriceExpertise[];
  missing_count: number;
}

export interface EnterprisePriceList {
  hospitals: EnterprisePriceHospitalGroup[];
}

export interface EnterprisePriceRequest {
  id: string;
  enterprise_id: string;
  hospital_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by?: string;
  resolved_by?: string;
  resolved_at?: string | null;
  created_at: string;
  hospital?: Hospital;
}

export interface EnterpriseClosingRow {
  hospital_id: string;
  hospital_name: string | null;
  appointments: number;
  bruto: number;
  liquido: number;
}

export interface EnterpriseClosingMissing {
  hospital_id: string;
  hospital_name: string | null;
  expertise_id: string;
  expertise_name: string | null;
  appointments_affected: number;
}

/** Total do médico consolidado no período, com breakdown por hospital. */
export interface EnterpriseClosingDoctorRow {
  user_id: string | null;
  user_name: string | null;
  appointments: number;
  bruto: number;
  liquido: number;
  by_hospital: Array<{
    hospital_id: string;
    hospital_name: string | null;
    appointments: number;
    bruto: number;
    liquido: number;
  }>;
}

export interface EnterpriseClosingData {
  status: 'ok' | 'partial' | 'incomplete' | 'empty';
  month: string;
  rows: EnterpriseClosingRow[];
  by_doctor: EnterpriseClosingDoctorRow[];
  totals: { bruto: number; liquido: number; appointments: number };
  missing: EnterpriseClosingMissing[];
}

// ── CRM de e-mail ──────────────────────────────────────────────────

export interface EmailCampaignSegment {
  hospital_ids?: string[];
  cities?: string[];
  expertise_ids?: string[];
  only_credentialed?: boolean;
  inactive_days?: number | null;
}

export type EmailCampaignStatus =
  | 'draft'
  | 'sending'
  | 'sent'
  | 'partial'
  | 'failed';

export interface EmailCampaign {
  id: string;
  enterprise_id: string;
  subject: string;
  body_html: string;
  segment: EmailCampaignSegment;
  status: EmailCampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailCampaignRecipientStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';

export interface EmailCampaignRecipient {
  id: string;
  campaign_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  status: EmailCampaignRecipientStatus;
  sent_at: string | null;
  error_message: string | null;
}

export interface EmailCampaignDetail {
  campaign: EmailCampaign;
  recipients: EmailCampaignRecipient[];
  total_recipients: number;
  counts_by_status: Record<EmailCampaignRecipientStatus, number>;
  page: number;
  page_size: number;
}

export interface SegmentOptions {
  hospitals: Array<{ id: string; name: string }>;
  cities: string[];
  expertises: Array<{ id: string; name: string }>;
}

// ── Fechamento → NF-e → Pagamento ──────────────────────────────

export type MonthlyPayoutStatus =
  | 'published'
  | 'nf_requested'
  | 'nf_received'
  | 'nf_rejected'
  | 'nf_approved'
  | 'paid';

export interface PayoutListItem {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_crm: string | null;
  month: string;
  bruto: number;
  liquido: number;
  appointments_count: number;
  status: MonthlyPayoutStatus;
  hospitals_count: number;
  published_at: string | null;
  nf_requested_at: string | null;
  nf_received_at: string | null;
  nf_approved_at: string | null;
  paid_at: string | null;
  updated_at: string;
}

export interface PayoutListResponse {
  items: PayoutListItem[];
  totals_by_status: Record<MonthlyPayoutStatus, number>;
}

export interface PayoutHospitalBreakdown {
  id: string;
  hospital_id: string;
  hospital_name_snapshot: string | null;
  appointments: number;
  bruto: string; // numeric vem como string do TypeORM
  liquido: string;
}

export interface PayoutEvent {
  id: string;
  payout_id: string;
  action: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PayoutDetail {
  payout: {
    id: string;
    enterprise_id: string;
    user_id: string;
    month: string;
    bruto: string;
    liquido: string;
    appointments_count: number;
    status: MonthlyPayoutStatus;
    published_at: string | null;
    nf_requested_at: string | null;
    nf_upload_token: string | null;
    nf_received_at: string | null;
    nf_file_url: string | null;
    nf_file_xml_url: string | null;
    nf_approved_at: string | null;
    nf_rejected_at: string | null;
    nf_rejection_reason: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
    hospitals: PayoutHospitalBreakdown[];
    events: PayoutEvent[];
  };
  user: {
    id: string;
    name: string;
    email: string;
    crm: string | null;
    crm_uf: string | null;
  } | null;
  bankAccount: {
    id: string;
    is_pj: boolean;
    cnpj: string | null;
    company_name: string | null;
    accounting_phone: string | null;
    nf_emails?: Array<{ id: string; email: string }>;
  } | null;
}

export interface SegmentPreview {
  total: number;
  sample: Array<{
    id: string;
    name: string;
    email: string;
    crm: string | null;
    cidade: string | null;
  }>;
}

// ─── Vínculos do credenciado (hospitais × especialidades) ────────────────

export interface DoctorBrief {
  id: string;
  name: string;
  email: string;
  crm: string | null;
  cellphone: string | null;
  avatar_url: string | null;
  approved_at: string | null;
}

export interface DoctorListItem extends DoctorBrief {
  hospitals_count: number;
  expertises_count: number;
  hospitals_pending: number;
  hospital_names: string[];
}

export interface AssignmentExpertise {
  id: string;
  name: string;
  modality_worker: string;
  linked: boolean;
  user_expertise_id: string | null;
  coordinator: boolean;
  future_appointments: number;
}

export interface AssignmentHospital {
  id: string;
  name: string;
  cidade: string | null;
  uf: string | null;
  logo_url: string | null;
  linked: boolean;
  user_hospital_id: string | null;
  admin: boolean;
  accepted: boolean;
  future_appointments: number;
  expertises: AssignmentExpertise[];
}

export interface DoctorAssignments {
  doctor: DoctorBrief;
  hospitals: AssignmentHospital[];
}

export interface SyncAssignmentsResult {
  linked_hospitals: number;
  unlinked_hospitals: number;
  linked_expertises: number;
  unlinked_expertises: number;
  pending_hospitals: number;
  assignments: DoctorAssignments;
}

export interface ImportableDoctor {
  id: string;
  name: string;
  email: string;
  crm: string | null;
  avatar_url: string | null;
  hospital_names: string[];
  expertises_count: number;
  is_hospital_admin: boolean;
  existing_status: 'none' | 'member' | 'pending' | 'rejected';
}

export interface ImportDoctorsResult {
  imported: number;
  skipped: Array<{ name: string; reason: string }>;
}
