<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart, registerables } from 'chart.js';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-vue-next';
import type { LowKpiAlertItem } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { addDays, formatDateKey, listAllDatesInRange } from '@/utils/dateUtils';
import {
  calculateHealthcareSummary,
  calculateReuseSummary,
  computeReasonBreakdown,
  filterServiceRecords,
  isOptionAmountTrigger,
  isOptionSuccess,
} from '@/utils/kpiCalculators';

Chart.register(...registerables);

const store = useAppStore();

// Chart DOM refs & non-reactive Chart.js instances (prevents Vue proxy issues & memory leaks)
const trendCanvasRef = ref<HTMLCanvasElement | null>(null);
const reasonCanvasRef = ref<HTMLCanvasElement | null>(null);
const storeCanvasRef = ref<HTMLCanvasElement | null>(null);

let trendChartInstance: Chart | null = null;
let reasonChartInstance: Chart | null = null;
let storeChartInstance: Chart | null = null;

const trendGrouping = ref<'daily' | 'monthly'>('daily');
const trendSelectedKpi = ref<string>('次回予約');
const selectedReasonItemKey = ref<string>('次回予約');

// 事業モデル・マスタ変更時に選択キーを安全に同期
const trendKpiOptions = computed(() => {
  if (store.currentBusiness === 'healthcare') {
    const itemOpts = store.currentActiveItems.map((it) => ({
      value: `item_${it.key}`,
      label: `${it.label} 獲得率 (%)`,
    }));
    return [...itemOpts, { value: 'visits', label: '総接客数 (件)' }];
  }
  const extraOpts = store.currentActiveItems
    .filter((it) => it.key !== '来店・査定')
    .map((it) => ({
      value: `item_${it.key}`,
      label: `${it.label} ${it.key === '提案・成約' ? '成約率' : '獲得率'} (%)`,
    }));
  return [
    ...extraOpts,
    { value: 'amount', label: '買取総額 (円)' },
    { value: 'unitPrice', label: '平均買取単価 (円)' },
    { value: 'assessments', label: '査定実施数 (件)' },
  ];
});

const reasonEligibleItems = computed(() =>
  store.currentActiveItems.filter((it) => it.options.some((o) => o.isReasonTrigger))
);

watch(
  () => [store.currentBusiness, trendKpiOptions.value, reasonEligibleItems.value],
  () => {
    if (!trendKpiOptions.value.some((o) => o.value === trendSelectedKpi.value)) {
      trendSelectedKpi.value = trendKpiOptions.value[0]?.value || 'visits';
    }
    if (!reasonEligibleItems.value.some((it) => it.key === selectedReasonItemKey.value)) {
      selectedReasonItemKey.value = reasonEligibleItems.value[0]?.key || '';
    }
  },
  { immediate: true }
);

const reasonStats = computed(() => {
  if (!selectedReasonItemKey.value) return [];
  return computeReasonBreakdown(
    store.filteredRecords,
    store.currentAllItems,
    selectedReasonItemKey.value
  );
});

const totalReasonCount = computed(() =>
  reasonStats.value.reduce((acc, r) => acc + r.count, 0)
);

function getBadgeClasses(achievement: number | null): string {
  if (achievement === null) return 'text-slate-400 bg-slate-950 border-slate-800';
  if (achievement >= 100) return 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80';
  if (achievement >= 80) return 'text-amber-400 bg-amber-950/70 border-amber-800/80';
  return 'text-rose-400 bg-rose-950/70 border-rose-800/80';
}

function getBadgeStatusText(achievement: number | null): string {
  if (achievement === null) return '未設定';
  if (achievement >= 100) return `達成 ${achievement}%`;
  if (achievement >= 80) return `注意 ${achievement}%`;
  return `未達 ${achievement}%`;
}

function formatDiff(val: number | null, unit: string): string {
  if (val === null || Number.isNaN(val)) return '-';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}${unit}`;
}

function getDiffColor(val: number | null): string {
  if (val === null || Number.isNaN(val)) return 'text-slate-500';
  if (val > 0) return 'text-emerald-400';
  if (val < 0) return 'text-rose-400';
  return 'text-slate-400';
}

function handleAlertClick(alert: LowKpiAlertItem) {
  if (alert.type === '店舗') {
    store.setStoreFilter(alert.storeName);
    store.selectedStaff = 'all';
  } else if (alert.staffId) {
    store.setStoreFilter(alert.storeName);
    store.selectedStaff = alert.staffId;
  }
}

const todayKey = formatDateKey(new Date());
const yesterdayKey = formatDateKey(addDays(new Date(), -1));

function jumpToStaffEntry(staffId: string) {
  store.setEntryStaff(staffId);
  store.currentView = 'entry';
}

// ==========================================
// Chart.js 描画＆破棄ライフサイクル管理
// ==========================================
function destroyAllCharts() {
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }
  if (reasonChartInstance) {
    reasonChartInstance.destroy();
    reasonChartInstance = null;
  }
  if (storeChartInstance) {
    storeChartInstance.destroy();
    storeChartInstance = null;
  }
}

function renderTrendChart() {
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }
  const canvas = trendCanvasRef.value;
  if (!canvas) return;

  const list = store.filteredRecords;
  const kpi = trendSelectedKpi.value;
  const isDaily = trendGrouping.value === 'daily';

  const bucket = new Map<string, typeof list>();
  for (const r of list) {
    const key = isDaily ? r.targetDate : r.targetDate.slice(0, 7);
    const arr = bucket.get(key);
    if (arr) arr.push(r);
    else bucket.set(key, [r]);
  }

  let keys: string[] = [];
  if (isDaily) {
    keys = listAllDatesInRange(store.activeDateRange);
  } else {
    keys = Array.from(bucket.keys()).sort();
    if (keys.length === 0) {
      keys = [store.activeDateRange.start.slice(0, 7)];
    }
  }

  const values: number[] = keys.map((k) => {
    const recs = bucket.get(k) || [];
    if (recs.length === 0) return 0;

    if (kpi === 'visits') return recs.length;

    const visitItem = store.currentAllItems.find((it) => it.key === '来店・査定');
    const baseRecs =
      store.currentBusiness === 'reuse' && visitItem && visitItem.isActive
        ? recs.filter((r) => isOptionSuccess(visitItem, r.answers[visitItem.key]))
        : recs;

    if (kpi === 'assessments') return baseRecs.length;
    if (kpi === 'amount') {
      return baseRecs.reduce((sum, r) => {
        const triggered = store.currentAllItems.some((it) =>
          isOptionAmountTrigger(it, r.answers[it.key])
        );
        return triggered && typeof r.amount === 'number' ? sum + r.amount : sum;
      }, 0);
    }
    if (kpi === 'unitPrice') {
      const closingItem = store.currentAllItems.find((it) => it.key === '提案・成約');
      const closed = baseRecs.filter((r) => isOptionSuccess(closingItem, r.answers['提案・成約']));
      if (closed.length === 0) return 0;
      const sum = closed.reduce((acc, r) => acc + (r.amount || 0), 0);
      return Math.round(sum / closed.length);
    }
    if (kpi.startsWith('item_')) {
      const itemKey = kpi.slice(5);
      const item = store.currentAllItems.find((it) => it.key === itemKey);
      if (baseRecs.length === 0) return 0;
      const won = baseRecs.filter((r) => isOptionSuccess(item, r.answers[itemKey])).length;
      return Math.round((won / baseRecs.length) * 1000) / 10;
    }
    return 0;
  });

  const isAmount = kpi === 'amount' || kpi === 'unitPrice';
  const isCount = kpi === 'visits' || kpi === 'assessments';
  const accentColor = store.currentBusiness === 'healthcare' ? '#10b981' : '#f59e0b';
  const accentBg =
    store.currentBusiness === 'healthcare'
      ? 'rgba(16, 185, 129, 0.22)'
      : 'rgba(245, 158, 11, 0.25)';

  trendChartInstance = new Chart(canvas, {
    type: isAmount || isCount ? 'bar' : 'line',
    data: {
      labels: keys.map((k) => (isDaily ? k.slice(5).replace('-', '/') : k)),
      datasets: [
        {
          label: trendKpiOptions.value.find((o) => o.value === kpi)?.label || kpi,
          data: values,
          borderColor: accentColor,
          backgroundColor: accentBg,
          borderWidth: 2,
          fill: !isAmount && !isCount,
          tension: 0.25,
          pointRadius: keys.length > 35 ? 1.5 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { size: 11 } },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: (val) => {
              const num = Number(val);
              if (isAmount) return num >= 10000 ? `¥${(num / 10000).toFixed(0)}万` : `¥${num}`;
              if (isCount) return `${num}件`;
              return `${num}%`;
            },
          },
        },
      },
    },
  });
}

function renderReasonChart() {
  if (reasonChartInstance) {
    reasonChartInstance.destroy();
    reasonChartInstance = null;
  }
  const canvas = reasonCanvasRef.value;
  if (!canvas) return;

  const topReasons = reasonStats.value.slice(0, 5);
  if (topReasons.length === 0) return;

  reasonChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: topReasons.map((r) => r.reason),
      datasets: [
        {
          data: topReasons.map((r) => r.count),
          backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'],
          borderColor: '#0f172a',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function renderStoreChart() {
  if (storeChartInstance) {
    storeChartInstance.destroy();
    storeChartInstance = null;
  }
  const canvas = storeCanvasRef.value;
  if (!canvas) return;

  const storeNames = store.storeOptions;
  const counts: number[] = [];
  const rates: number[] = [];

  for (const st of storeNames) {
    const recs = filterServiceRecords(
      store.records,
      store.currentBusiness,
      store.activeDateRange,
      st,
      'all'
    );
    if (store.currentBusiness === 'healthcare') {
      const sum = calculateHealthcareSummary(
        recs,
        null,
        store.currentAllItems,
        store.targetRecords,
        st,
        'all',
        store.activeDateRange
      );
      counts.push(sum.totalVisits);
      const firstMetric = sum.orderedItemMetrics[0];
      rates.push(firstMetric ? firstMetric.rate : 0);
    } else {
      const sum = calculateReuseSummary(
        recs,
        null,
        store.currentAllItems,
        store.targetRecords,
        st,
        'all',
        store.activeDateRange,
        store.isMonthRange
      );
      counts.push(sum.totalAssessments);
      rates.push(sum.closingMetric.rate);
    }
  }

  const primaryItemLabel =
    store.currentBusiness === 'healthcare'
      ? `${store.currentActiveItems[0]?.label || '次回予約'}獲得率 (%)`
      : `${store.reuseSummary.closingMetric.label}率 (%)`;

  storeChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: storeNames,
      datasets: [
        {
          type: 'bar',
          label: store.currentBusiness === 'healthcare' ? '総接客数 (件)' : '査定実施数 (件)',
          data: counts,
          backgroundColor: 'rgba(14, 165, 233, 0.35)',
          borderColor: '#0ea5e9',
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: primaryItemLabel,
          data: rates,
          borderColor: store.currentBusiness === 'healthcare' ? '#10b981' : '#f59e0b',
          backgroundColor: store.currentBusiness === 'healthcare' ? '#10b981' : '#f59e0b',
          borderWidth: 2.5,
          pointRadius: 4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { size: 11 } },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#cbd5e1', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 },
        },
        y1: {
          beginAtZero: true,
          max: 100,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: store.currentBusiness === 'healthcare' ? '#34d399' : '#fbbf24',
            font: { size: 10 },
            callback: (v) => `${v}%`,
          },
        },
      },
    },
  });
}

function refreshAllCharts() {
  nextTick(() => {
    renderTrendChart();
    renderReasonChart();
    renderStoreChart();
  });
}

onMounted(() => {
  refreshAllCharts();
});

watch(
  () => [
    store.filteredRecords,
    store.currentBusiness,
    store.currentAllItems,
    trendGrouping.value,
    trendSelectedKpi.value,
    selectedReasonItemKey.value,
  ],
  () => {
    refreshAllCharts();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  destroyAllCharts();
});
</script>

<template>
  <div class="space-y-6">
    <!-- 1. 低KPI要注意アラートリスト（常時表示） -->
    <section class="bg-slate-900 rounded-xl p-5 border border-slate-800">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-800">
        <div>
          <div class="flex items-center gap-2.5">
            <AlertTriangle class="w-4 h-4 text-rose-400 shrink-0" />
            <h2 class="text-sm font-bold text-white">低KPI要注意アラート</h2>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              · 該当 {{ store.lowKpiAlerts.length }} 件
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            目標達成率100%未満の店舗・稼働中スタッフを自動抽出（カードクリックで対象へ絞り込み）
          </p>
        </div>
      </div>

      <div class="mt-4">
        <div
          v-if="store.lowKpiAlerts.length === 0"
          class="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3 text-emerald-300"
        >
          <CheckCircle2 class="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p class="text-xs font-bold">現在、目標未達のアラート対象はありません</p>
            <p class="text-xs text-slate-400 mt-0.5">
              すべての店舗・稼働中スタッフが目標を達成しているか、目標未設定です。
            </p>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            v-for="alert in store.lowKpiAlerts"
            :key="alert.id"
            type="button"
            @click="handleAlertClick(alert)"
            class="p-3.5 rounded-lg bg-slate-950 hover:bg-slate-925 border text-left transition-colors cursor-pointer group"
            :class="
              alert.level === 'warning'
                ? 'border-rose-900/70 hover:border-rose-700'
                : 'border-amber-900/70 hover:border-amber-700'
            "
          >
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-xs text-slate-400 shrink-0">{{ alert.type }}</span>
                <span aria-hidden="true" class="text-slate-600">·</span>
                <span class="text-sm font-bold text-white group-hover:text-sky-300 truncate">
                  {{ alert.name }}
                </span>
              </div>
              <span
                class="text-xs font-mono tabular-nums font-bold shrink-0"
                :class="alert.level === 'warning' ? 'text-rose-400' : 'text-amber-400'"
              >
                最低 {{ alert.lowestAchievement }}%
              </span>
            </div>

            <div v-if="alert.type === 'スタッフ'" class="text-xs text-slate-400 mb-2">
              所属: {{ alert.storeName }}
            </div>

            <div class="space-y-1 pt-2 border-t border-slate-800/80">
              <div
                v-for="kpi in alert.unmetKpis.slice(0, 4)"
                :key="kpi.kpiKey"
                class="flex items-center justify-between text-xs font-mono tabular-nums"
              >
                <span class="text-slate-300 font-sans truncate pr-2">{{ kpi.label }}</span>
                <span :class="kpi.achievement < 80 ? 'text-rose-400' : 'text-amber-400'">
                  {{ kpi.actualDisplay }}（達{{ kpi.achievement }}%）
                </span>
              </div>
              <div v-if="alert.unmetKpis.length > 4" class="text-[11px] text-slate-500 pt-0.5">
                ほか {{ alert.unmetKpis.length - 4 }} 項目が未達
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>

    <!-- 2. 主要KPIカード群 -->
    <section class="space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <TrendingUp class="w-4 h-4 text-sky-400 shrink-0" />
          <h2 class="text-sm font-bold text-white">主要KPIパフォーマンス</h2>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span class="text-slate-400">比較基準:</span>
          <div class="inline-flex p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            <button
              type="button"
              @click="store.comparisonMode = 'previous'"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              :class="
                store.comparisonMode === 'previous'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              "
            >
              直前同期間比
            </button>
            <button
              type="button"
              @click="store.comparisonMode = 'prevYear'"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              :class="
                store.comparisonMode === 'prevYear'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              "
            >
              前年同期比
            </button>
          </div>
        </div>
      </div>

      <!-- ① ヘルスケア KPIグリッド -->
      <div
        v-if="store.currentBusiness === 'healthcare'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <!-- 総接客数カード -->
        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300">総接客数</span>
            <span class="text-xs font-mono tabular-nums text-slate-500">
              {{ store.dateRangeDaysCount }}日間
            </span>
          </div>

          <div class="my-3">
            <div class="text-2xl font-extrabold font-mono tabular-nums text-white">
              {{ store.healthcareSummary.totalVisits.toLocaleString() }}
              <span class="text-xs font-normal text-slate-400">件</span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400 font-sans">{{ store.comparisonModeLabel }}</span>
              <span :class="getDiffColor(store.healthcareSummary.visitsDiffPercent)">
                {{ formatDiff(store.healthcareSummary.visitsDiffPercent, '%') }}
              </span>
            </div>
          </div>

          <div class="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
            <span class="text-slate-400">日平均（経過日数割）</span>
            <span class="font-mono tabular-nums font-semibold text-emerald-400">
              {{
                (
                  store.healthcareSummary.totalVisits / Math.max(store.dateRangeDaysCount, 1)
                ).toFixed(1)
              }}
              件/日
            </span>
          </div>
        </div>

        <!-- マスタ連動 各項目KPIカード -->
        <div
          v-for="m in store.healthcareSummary.orderedItemMetrics"
          :key="m.itemKey"
          class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200 truncate">{{ m.label }}</span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(m.achievement)"
            >
              {{ getBadgeStatusText(m.achievement) }}
            </span>
          </div>

          <div class="my-2.5">
            <div class="flex items-baseline justify-between">
              <div class="text-2xl font-extrabold font-mono tabular-nums text-white">
                {{ m.rate }}<span class="text-xs font-semibold text-slate-400">%</span>
              </div>
              <span class="text-xs font-mono tabular-nums text-slate-400">
                目標 {{ m.target !== null ? `${m.target}%` : '-' }}
              </span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400">{{ m.count }} / {{ m.denominator }}件</span>
              <span :class="getDiffColor(m.rateDiff)">
                {{ formatDiff(m.rateDiff, 'pt') }}
              </span>
            </div>
          </div>

          <!-- 獲得率 ＆ 提案率（案内率）同居インジケーターバー -->
          <div class="pt-2.5 border-t border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span class="text-slate-300 font-sans">
                {{ m.itemKey === '口コミ' ? '案内率' : '提案率' }}:
                <strong class="font-mono text-white">{{ m.proposalRate }}%</strong>
              </span>
              <span v-if="m.proposalTarget !== null" class="text-slate-400">
                目{{ m.proposalTarget }}%
              </span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative">
              <!-- 提案率バー（背景側・薄いエメラルド） -->
              <div
                class="h-full bg-emerald-500/30 rounded-full absolute inset-y-0 left-0"
                :style="{ width: `${Math.min(m.proposalRate, 100)}%` }"
              ></div>
              <!-- 獲得率バー（前景・濃いエメラルド） -->
              <div
                class="h-full bg-emerald-500 rounded-full relative"
                :style="{ width: `${Math.min(m.rate, 100)}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ② リユース KPIグリッド -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <!-- 1. 査定数 / 実施率 -->
        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200">査定実施数 / 実施率</span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(store.reuseSummary.assessmentAchievement)"
            >
              {{ getBadgeStatusText(store.reuseSummary.assessmentAchievement) }}
            </span>
          </div>

          <div class="my-2.5">
            <div class="flex items-baseline justify-between">
              <div class="text-2xl font-extrabold font-mono tabular-nums text-white">
                {{ store.reuseSummary.totalAssessments.toLocaleString() }}
                <span class="text-xs font-normal text-slate-400">件</span>
              </div>
              <span class="text-xs font-mono tabular-nums text-amber-400 font-bold">
                実施 {{ store.reuseSummary.assessmentRate }}%
              </span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400">総来店 {{ store.reuseSummary.totalVisits }}件</span>
              <span :class="getDiffColor(store.reuseSummary.assessmentsDiffPercent)">
                {{ formatDiff(store.reuseSummary.assessmentsDiffPercent, '%') }}
              </span>
            </div>
          </div>

          <div class="pt-2.5 border-t border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span class="text-slate-400">
                目標 {{ store.reuseSummary.assessmentTarget ?? '-' }}%
              </span>
              <span class="text-slate-300">
                {{
                  (
                    store.reuseSummary.totalAssessments / Math.max(store.dateRangeDaysCount, 1)
                  ).toFixed(1)
                }}
                査定/日
              </span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                class="h-full bg-amber-500 rounded-full"
                :style="{ width: `${Math.min(store.reuseSummary.assessmentRate, 100)}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 2. 提案・成約（成約率 / 提案率） -->
        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200 truncate">
              {{ store.reuseSummary.closingMetric.label }}
            </span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(store.reuseSummary.closingMetric.achievement)"
            >
              {{ getBadgeStatusText(store.reuseSummary.closingMetric.achievement) }}
            </span>
          </div>

          <div class="my-2.5">
            <div class="flex items-baseline justify-between">
              <div class="text-2xl font-extrabold font-mono tabular-nums text-white">
                {{ store.reuseSummary.closingMetric.rate }}<span class="text-xs text-slate-400">%</span>
              </div>
              <span class="text-xs font-mono tabular-nums text-slate-400">
                目標 {{ store.reuseSummary.closingMetric.target ?? '-' }}%
              </span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400">
                成約 {{ store.reuseSummary.closingMetric.count }} / {{ store.reuseSummary.totalAssessments }}件
              </span>
              <span :class="getDiffColor(store.reuseSummary.closingMetric.rateDiff)">
                {{ formatDiff(store.reuseSummary.closingMetric.rateDiff, 'pt') }}
              </span>
            </div>
          </div>

          <div class="pt-2.5 border-t border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span class="text-slate-300 font-sans">
                提案率:
                <strong class="font-mono text-white">
                  {{ store.reuseSummary.closingMetric.proposalRate }}%
                </strong>
              </span>
              <span v-if="store.reuseSummary.closingMetric.proposalTarget !== null" class="text-slate-400">
                目{{ store.reuseSummary.closingMetric.proposalTarget }}%
              </span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative">
              <div
                class="h-full bg-amber-500/30 rounded-full absolute inset-y-0 left-0"
                :style="{ width: `${Math.min(store.reuseSummary.closingMetric.proposalRate, 100)}%` }"
              ></div>
              <div
                class="h-full bg-amber-500 rounded-full relative"
                :style="{ width: `${Math.min(store.reuseSummary.closingMetric.rate, 100)}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 3. 買取総額（税込） -->
        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200">買取総額（税込）</span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(store.reuseSummary.totalAmount.achievement)"
            >
              {{
                store.isMonthRange
                  ? getBadgeStatusText(store.reuseSummary.totalAmount.achievement)
                  : '月次指標'
              }}
            </span>
          </div>

          <div class="my-2.5">
            <div class="text-2xl font-extrabold font-mono tabular-nums text-amber-300 truncate">
              ¥{{ store.reuseSummary.totalAmount.amount.toLocaleString() }}
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400">
                成約 {{ store.reuseSummary.closingMetric.count }}件
              </span>
              <span :class="getDiffColor(store.reuseSummary.totalAmount.percentDiff)">
                {{ formatDiff(store.reuseSummary.totalAmount.percentDiff, '%') }}
              </span>
            </div>
          </div>

          <div class="pt-2.5 border-t border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span class="text-slate-400">
                月目標
                {{
                  store.isMonthRange && store.reuseSummary.totalAmount.target
                    ? `¥${store.reuseSummary.totalAmount.target.toLocaleString()}`
                    : '-'
                }}
              </span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                class="h-full bg-amber-500 rounded-full"
                :style="{
                  width: `${Math.min(store.reuseSummary.totalAmount.achievement || 0, 100)}%`,
                }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 4. 平均買取単価 -->
        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200">平均買取単価</span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(store.reuseSummary.avgUnitPrice.achievement)"
            >
              {{ getBadgeStatusText(store.reuseSummary.avgUnitPrice.achievement) }}
            </span>
          </div>

          <div class="my-2.5">
            <div class="text-2xl font-extrabold font-mono tabular-nums text-white truncate">
              ¥{{ store.reuseSummary.avgUnitPrice.amount.toLocaleString() }}
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400">1成約あたり</span>
              <span :class="getDiffColor(store.reuseSummary.avgUnitPrice.percentDiff)">
                {{ formatDiff(store.reuseSummary.avgUnitPrice.percentDiff, '%') }}
              </span>
            </div>
          </div>

          <div class="pt-2.5 border-t border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span class="text-slate-400">
                目標
                {{
                  store.reuseSummary.avgUnitPrice.target
                    ? `¥${store.reuseSummary.avgUnitPrice.target.toLocaleString()}`
                    : '-'
                }}
              </span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                class="h-full bg-sky-500 rounded-full"
                :style="{
                  width: `${Math.min(store.reuseSummary.avgUnitPrice.achievement || 0, 100)}%`,
                }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 5. 口コミ獲得 -->
        <div class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200 truncate">
              {{ store.reuseSummary.reviewMetric.label }}
            </span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(store.reuseSummary.reviewMetric.achievement)"
            >
              {{ getBadgeStatusText(store.reuseSummary.reviewMetric.achievement) }}
            </span>
          </div>

          <div class="my-2.5">
            <div class="flex items-baseline justify-between">
              <div class="text-2xl font-extrabold font-mono tabular-nums text-white">
                {{ store.reuseSummary.reviewMetric.rate }}<span class="text-xs text-slate-400">%</span>
              </div>
              <span class="text-xs font-mono tabular-nums text-slate-400">
                目標 {{ store.reuseSummary.reviewMetric.target ?? '-' }}%
              </span>
            </div>
            <div class="flex items-center justify-between text-xs font-mono tabular-nums mt-1">
              <span class="text-slate-400">
                {{ store.reuseSummary.reviewMetric.count }} / {{ store.reuseSummary.totalAssessments }}件
              </span>
              <span :class="getDiffColor(store.reuseSummary.reviewMetric.rateDiff)">
                {{ formatDiff(store.reuseSummary.reviewMetric.rateDiff, 'pt') }}
              </span>
            </div>
          </div>

          <div class="pt-2.5 border-t border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span class="text-slate-300 font-sans">
                案内率:
                <strong class="font-mono text-white">
                  {{ store.reuseSummary.reviewMetric.proposalRate }}%
                </strong>
              </span>
              <span v-if="store.reuseSummary.reviewMetric.proposalTarget !== null" class="text-slate-400">
                目{{ store.reuseSummary.reviewMetric.proposalTarget }}%
              </span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative">
              <div
                class="h-full bg-emerald-500/30 rounded-full absolute inset-y-0 left-0"
                :style="{ width: `${Math.min(store.reuseSummary.reviewMetric.proposalRate, 100)}%` }"
              ></div>
              <div
                class="h-full bg-emerald-500 rounded-full relative"
                :style="{ width: `${Math.min(store.reuseSummary.reviewMetric.rate, 100)}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- マスタ管理で追加されたカスタム項目の動的KPIカード -->
        <div
          v-for="ext in store.reuseSummary.extraItemMetrics"
          :key="ext.itemKey"
          class="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-200 truncate">{{ ext.label }}</span>
            <span
              class="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded border shrink-0"
              :class="getBadgeClasses(ext.achievement)"
            >
              {{ getBadgeStatusText(ext.achievement) }}
            </span>
          </div>
          <div class="my-2.5">
            <div class="text-2xl font-extrabold font-mono tabular-nums text-white">
              {{ ext.rate }}<span class="text-xs text-slate-400">%</span>
            </div>
            <div class="text-xs font-mono tabular-nums text-slate-400 mt-1">
              {{ ext.count }} / {{ ext.denominator }}件
            </div>
          </div>
          <div class="pt-2.5 border-t border-slate-800 text-xs font-mono tabular-nums text-slate-300">
            提案率: {{ ext.proposalRate }}%
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 時系列推移 ＆ 未提案理由内訳 ＆ 店舗複合チャート -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- ① 実績・KPI推移グラフ -->
      <div class="lg:col-span-8 bg-slate-900 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-white">実績・KPI時系列推移</h3>
            <p class="text-xs text-slate-400 mt-0.5">
              日次・月次のトレンド比較（未入力日は0プロット自動補完）
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <select
              v-model="trendSelectedKpi"
              class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
              aria-label="推移グラフ指標選択"
            >
              <option v-for="opt in trendKpiOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>

            <div class="inline-flex p-0.5 rounded-lg bg-slate-950 border border-slate-800">
              <button
                type="button"
                @click="trendGrouping = 'daily'"
                class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                :class="
                  trendGrouping === 'daily'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                "
              >
                日次
              </button>
              <button
                type="button"
                @click="trendGrouping = 'monthly'"
                class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                :class="
                  trendGrouping === 'monthly'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                "
              >
                月次
              </button>
            </div>
          </div>
        </div>

        <div class="relative w-full h-[290px] mt-4">
          <canvas ref="trendCanvasRef"></canvas>
        </div>
      </div>

      <!-- ② 未提案理由の内訳ドーナツグラフ -->
      <div class="lg:col-span-4 bg-slate-900 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
        <div class="pb-3 border-b border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white">未提案理由の内訳分析</h3>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              計 {{ totalReasonCount }}件
            </span>
          </div>

          <div class="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              v-for="item in reasonEligibleItems"
              :key="item.key"
              type="button"
              @click="selectedReasonItemKey = item.key"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              :class="
                selectedReasonItemKey === item.key
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              "
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="relative w-full h-[185px] my-3 flex items-center justify-center">
          <canvas ref="reasonCanvasRef"></canvas>
          <div
            v-if="reasonStats.length === 0"
            class="absolute inset-0 flex items-center justify-center text-xs text-slate-500 text-center px-4"
          >
            該当項目の未提案理由データはありません
          </div>
        </div>

        <div class="space-y-1.5 max-h-32 overflow-y-auto">
          <div
            v-for="r in reasonStats.slice(0, 5)"
            :key="r.reason"
            class="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800/80 text-xs"
          >
            <span class="text-slate-300 truncate pr-2">{{ r.reason }}</span>
            <span class="font-mono tabular-nums font-semibold text-sky-300 shrink-0">
              {{ r.count }}件 ({{ r.percent }}%)
            </span>
          </div>
        </div>
      </div>

      <!-- ③ 店舗別ボリューム＆獲得率 複合グラフ -->
      <div class="lg:col-span-12 bg-slate-900 rounded-xl p-5 border border-slate-800">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-white">店舗別 ボリューム ＆ 主要獲得率 複合比較</h3>
            <p class="text-xs text-slate-400 mt-0.5">
              店舗ごとの接客（査定）件数と主要KPI獲得率・成約率のバランスを比較
            </p>
          </div>
          <span class="text-xs font-mono tabular-nums text-slate-400">
            対象 {{ store.storeOptions.length }} 店舗
          </span>
        </div>

        <div class="relative w-full h-[250px] mt-4">
          <canvas ref="storeCanvasRef"></canvas>
        </div>
      </div>
    </section>

    <!-- 4. 日次未提出者チェックパネル -->
    <section class="bg-slate-900 rounded-xl p-5 border border-slate-800">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <Clock class="w-4 h-4 text-amber-400 shrink-0" />
            <h3 class="text-sm font-bold text-white">日次未提出者チェック</h3>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              · 未提出 {{ store.submissionStatus.unsubmittedStaff.length }}名 / 稼働対象
              {{ store.submissionStatus.totalStaffCount }}名
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            指定した対応日に実績提出がない稼働中スタッフを自動抽出します
          </p>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            @click="store.submissionCheckDate = todayKey"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            :class="
              store.submissionCheckDate === todayKey
                ? 'bg-sky-600 text-white'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            "
          >
            本日
          </button>
          <button
            type="button"
            @click="store.submissionCheckDate = yesterdayKey"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            :class="
              store.submissionCheckDate === yesterdayKey
                ? 'bg-sky-600 text-white'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            "
          >
            昨日
          </button>
          <input
            type="date"
            v-model="store.submissionCheckDate"
            class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums focus:outline-none"
            aria-label="未提出確認日"
          />
        </div>
      </div>

      <div class="mt-4 space-y-3">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">
              対応日
              <strong class="font-mono tabular-nums text-slate-200">
                {{ store.submissionCheckDate }}
              </strong>
              の提出完了率
            </span>
            <span
              class="font-mono tabular-nums font-bold"
              :class="
                store.submissionStatus.submissionRate >= 100 ? 'text-emerald-400' : 'text-amber-400'
              "
            >
              {{ store.submissionStatus.submissionRate }}%
            </span>
          </div>
          <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="
                store.submissionStatus.submissionRate >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
              "
              :style="{ width: `${store.submissionStatus.submissionRate}%` }"
            ></div>
          </div>
        </div>

        <div
          v-if="store.submissionStatus.unsubmittedStaff.length === 0"
          class="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2.5 text-emerald-300 text-xs font-semibold"
        >
          <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
          <span>すべての稼働中スタッフが {{ store.submissionCheckDate }} の実績を提出済みです。</span>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div
            v-for="s in store.submissionStatus.unsubmittedStaff"
            :key="s.id"
            class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <div class="text-sm font-bold text-white truncate">{{ s.name }}</div>
              <div class="text-xs text-slate-400 truncate mt-0.5">
                {{ s.storeName }} · <span class="font-mono">{{ s.id }}</span>
              </div>
            </div>

            <button
              type="button"
              @click="jumpToStaffEntry(s.id)"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>入力画面へ</span>
              <ArrowUpRight class="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
