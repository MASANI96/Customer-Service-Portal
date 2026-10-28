export type BusinessType = 'healthcare' | 'reuse';

export type ViewMode = 'entry' | 'dashboard' | 'admin';

export type EntrySubMode = 'single' | 'batch' | 'summary';

export type DashboardTabMode = 'overview' | 'store' | 'staff' | 'matrix';

export type AdminTabMode = 'items' | 'reasons' | 'staff';

export type ComparisonMode = 'previous' | 'prevYear';

export type PresetPeriodType =
  | 'year'
  | 'half'
  | 'quarter'
  | 'month'
  | 'relative'
  | 'around'
  | 'custom';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface StaffMember {
  id: string;
  name: string;
  businessType: BusinessType;
  storeName: string;
  isActive: boolean;
}

export interface ItemOptionConfig {
  text: string;
  order: number;
  isSuccess: boolean;
  isReasonTrigger: boolean;
  isAmountTrigger: boolean;
}

export interface ItemMasterConfig {
  key: string;
  label: string;
  order: number;
  isActive: boolean;
  options: ItemOptionConfig[];
}

export interface ReasonOptionConfig {
  text: string;
  order: number;
  isActive: boolean;
}

export type ReasonsByBusinessMap = Record<BusinessType, Record<string, ReasonOptionConfig[]>>;

export type ItemsByBusinessMap = Record<BusinessType, ItemMasterConfig[]>;

export interface ServiceRecord {
  submissionId: string;
  timestamp: string; // YYYY/MM/DD HH:mm:ss
  targetDate: string; // YYYY-MM-DD
  businessType: BusinessType;
  staffId: string;
  staffName: string;
  storeName: string;
  answers: Record<string, string>;
  reasons: Record<string, string>;
  amount: number | null;
  source: 'single' | 'batch' | 'summary' | 'mock';
}

export type TargetLevel = '全社' | '店舗' | 'スタッフ';

export interface KpiTargetRecord {
  yearMonth: string; // YYYY-MM
  businessType: BusinessType;
  targetLevel: TargetLevel;
  targetName: string; // '全社' | storeName | staffId
  kpiKey: string;     // e.g. '次回予約_獲得率', '提案・成約_獲得率', '買取総額', '平均単価'
  targetValue: number; // Percentage (0-100) for rates, JPY integer for amounts
  updatedAt: string;
}

export interface RateMetricResult {
  itemKey: string;
  label: string;
  count: number;
  denominator: number;
  rate: number;
  proposalCount: number;
  proposalRate: number;
  target: number | null;
  achievement: number | null;
  proposalTarget: number | null;
  proposalAchievement: number | null;
  rateDiff: number | null; // pt difference vs comparison period
}

export interface AmountMetricResult {
  kpiKey: string;
  label: string;
  amount: number;
  target: number | null;
  achievement: number | null;
  percentDiff: number | null; // % change vs comparison period
}

export interface HealthcareKpiSummary {
  totalVisits: number;
  visitsDiffPercent: number | null;
  itemMetrics: Record<string, RateMetricResult>;
  orderedItemMetrics: RateMetricResult[];
  avgAchievement: number | null;
}

export interface ReuseKpiSummary {
  totalVisits: number;
  totalAssessments: number;
  assessmentsDiffPercent: number | null;
  assessmentRate: number;
  assessmentTarget: number | null;
  assessmentAchievement: number | null;
  closingMetric: RateMetricResult;
  reviewMetric: RateMetricResult;
  extraItemMetrics: RateMetricResult[];
  totalAmount: AmountMetricResult;
  avgUnitPrice: AmountMetricResult;
  avgAchievement: number | null;
}

export interface UnmetKpiDetail {
  kpiKey: string;
  label: string;
  actualDisplay: string;
  achievement: number;
}

export interface LowKpiAlertItem {
  id: string;
  type: '店舗' | 'スタッフ';
  name: string;
  staffId?: string;
  storeName: string;
  lowestAchievement: number;
  level: 'warning' | 'caution'; // <80 warning (red), 80-99 caution (amber)
  unmetKpis: UnmetKpiDetail[];
}

export interface StoreAnalyticsRow {
  storeName: string;
  healthcare?: HealthcareKpiSummary;
  reuse?: ReuseKpiSummary;
  avgAchievement: number | null;
}

export interface StaffAnalyticsRow {
  staffId: string;
  staffName: string;
  storeName: string;
  isActive: boolean;
  healthcare?: HealthcareKpiSummary;
  reuse?: ReuseKpiSummary;
  avgAchievement: number | null;
}

export interface MatrixColumnDef {
  key: string;
  label: string;
  subLabel: string;
  start: string;
  end: string;
}

export interface MatrixCellData {
  value: number;
  count: number;
  achievement: number | null;
  isMoney: boolean;
}

export interface MatrixRowData {
  id: string;
  name: string;
  subName: string;
  total: MatrixCellData;
  cells: Record<string, MatrixCellData>;
}

export interface ReasonBreakdownItem {
  reason: string;
  itemKey: string;
  itemLabel: string;
  count: number;
  percent: number;
}

export interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
