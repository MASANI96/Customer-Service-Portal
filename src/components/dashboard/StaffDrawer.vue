<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Chart, registerables } from 'chart.js';
import { X } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { formatSlashDate, listAllDatesInRange } from '@/utils/dateUtils';
import {
  calculateHealthcareSummary,
  calculateReuseSummary,
  computeReasonBreakdown,
  filterServiceRecords,
  formatRecordReasonSummary,
  isOptionSuccess,
} from '@/utils/kpiCalculators';

Chart.register(...registerables);

const store = useAppStore();

const staffTrendCanvasRef = ref<HTMLCanvasElement | null>(null);
let staffChartInstance: Chart | null = null;

const drawerStaff = computed(() => {
  if (!store.drawerStaffId) return null;
  return store.staffList.find((s) => s.id === store.drawerStaffId) || null;
});

const staffRecords = computed(() => {
  if (!drawerStaff.value) return [];
  const storeScope = store.selectedStore === 'all' ? 'all' : store.selectedStore;
  return filterServiceRecords(
    store.records,
    store.currentBusiness,
    store.activeDateRange,
    storeScope,
    drawerStaff.value.id
  ).sort((a, b) => b.targetDate.localeCompare(a.targetDate) || b.timestamp.localeCompare(a.timestamp));
});

const staffHealthcareKpi = computed(() => {
  if (!drawerStaff.value || store.currentBusiness !== 'healthcare') return null;
  return calculateHealthcareSummary(
    staffRecords.value,
    null,
    store.currentAllItems,
    store.targetRecords,
    drawerStaff.value.storeName,
    drawerStaff.value.id,
    store.activeDateRange
  );
});

const staffReuseKpi = computed(() => {
  if (!drawerStaff.value || store.currentBusiness !== 'reuse') return null;
  return calculateReuseSummary(
    staffRecords.value,
    null,
    store.currentAllItems,
    store.targetRecords,
    drawerStaff.value.storeName,
    drawerStaff.value.id,
    store.activeDateRange,
    store.isMonthRange
  );
});

const staffReasons = computed(() =>
  computeReasonBreakdown(staffRecords.value, store.currentAllItems)
);

function destroyStaffChart() {
  if (staffChartInstance) {
    staffChartInstance.destroy();
    staffChartInstance = null;
  }
}

function renderStaffTrendChart() {
  destroyStaffChart();
  const canvas = staffTrendCanvasRef.value;
  if (!canvas || !drawerStaff.value) return;

  const dateCounts = new Map<string, number>();
  for (const r of staffRecords.value) {
    dateCounts.set(r.targetDate, (dateCounts.get(r.targetDate) || 0) + 1);
  }

  const allDates = listAllDatesInRange(store.activeDateRange);
  const values = allDates.map((d) => dateCounts.get(d) || 0);

  staffChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: allDates.map((d) => d.slice(5).replace('-', '/')),
      datasets: [
        {
          label: '日次接客件数',
          data: values,
          borderColor: store.currentBusiness === 'healthcare' ? '#10b981' : '#f59e0b',
          backgroundColor:
            store.currentBusiness === 'healthcare'
              ? 'rgba(16, 185, 129, 0.16)'
              : 'rgba(245, 158, 11, 0.16)',
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: allDates.length > 35 ? 1.5 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 },
        },
      },
    },
  });
}

function closeDrawer() {
  destroyStaffChart();
  store.drawerStaffId = null;
}

watch(
  () => [store.drawerStaffId, staffRecords.value],
  () => {
    if (store.drawerStaffId) {
      nextTick(() => {
        renderStaffTrendChart();
      });
    } else {
      destroyStaffChart();
    }
  },
  { deep: true }
);

onBeforeUnmount(() => {
  destroyStaffChart();
});

function getBadgeClasses(achievement: number | null): string {
  if (achievement === null) return 'text-slate-400 bg-slate-900 border-slate-800';
  if (achievement >= 100) return 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80';
  if (achievement >= 80) return 'text-amber-400 bg-amber-950/70 border-amber-800/80';
  return 'text-rose-400 bg-rose-950/70 border-rose-800/80';
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="drawerStaff"
      class="fixed inset-0 z-50 bg-black/65"
      @click="closeDrawer"
    ></div>
  </Transition>

  <Transition name="drawer-slide">
    <aside
      v-if="drawerStaff"
      class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto flex flex-col text-slate-100"
      aria-label="スタッフ個人カルテ詳細"
    >
      <!-- ヘッダー -->
      <div class="sticky top-0 z-20 px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-white">{{ drawerStaff.name }}</h3>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              · {{ drawerStaff.id }}
            </span>
          </div>
          <div class="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>{{ drawerStaff.storeName }}</span>
            <span aria-hidden="true">·</span>
            <span class="font-mono tabular-nums">
              {{ formatSlashDate(store.activeDateRange.start) }} 〜
              {{ formatSlashDate(store.activeDateRange.end) }}
            </span>
          </div>
        </div>

        <button
          type="button"
          @click="closeDrawer"
          class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 cursor-pointer shrink-0"
          aria-label="ドロワーを閉じる"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- ボディ -->
      <div class="p-6 space-y-6 flex-1">
        <!-- 1. 個人KPIサマリー -->
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-300">期間内 個人KPIサマリー</h4>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              対応件数: <strong class="text-white">{{ staffRecords.length }}</strong> 件
            </span>
          </div>

          <!-- ヘルスケア -->
          <div
            v-if="store.currentBusiness === 'healthcare' && staffHealthcareKpi"
            class="grid grid-cols-2 gap-3 text-xs"
          >
            <div
              v-for="m in staffHealthcareKpi.orderedItemMetrics"
              :key="m.itemKey"
              class="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-slate-300 font-semibold truncate">{{ m.label }}</span>
                <span
                  v-if="m.achievement !== null"
                  class="text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded border shrink-0"
                  :class="getBadgeClasses(m.achievement)"
                >
                  達 {{ m.achievement }}%
                </span>
              </div>
              <div class="text-xl font-bold font-mono tabular-nums text-white">{{ m.rate }}%</div>
              <div class="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                <span>獲得 {{ m.count }}件</span>
                <span>提案 {{ m.proposalRate }}%</span>
              </div>
            </div>
          </div>

          <!-- リユース -->
          <div
            v-else-if="store.currentBusiness === 'reuse' && staffReuseKpi"
            class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs"
          >
            <div class="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span class="text-slate-400">査定数 / 実施率</span>
              <div class="text-xl font-bold font-mono tabular-nums text-white">
                {{ staffReuseKpi.totalAssessments }}件
              </div>
              <div class="text-[11px] font-mono tabular-nums text-amber-400">
                実施率 {{ staffReuseKpi.assessmentRate }}%
              </div>
            </div>

            <div class="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">成約率</span>
                <span
                  v-if="staffReuseKpi.closingMetric.achievement !== null"
                  class="text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded border"
                  :class="getBadgeClasses(staffReuseKpi.closingMetric.achievement)"
                >
                  達 {{ staffReuseKpi.closingMetric.achievement }}%
                </span>
              </div>
              <div class="text-xl font-bold font-mono tabular-nums text-white">
                {{ staffReuseKpi.closingMetric.rate }}%
              </div>
              <div class="text-[11px] font-mono tabular-nums text-slate-400">
                成約 {{ staffReuseKpi.closingMetric.count }}件 · 提 {{ staffReuseKpi.closingMetric.proposalRate }}%
              </div>
            </div>

            <div class="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span class="text-slate-400">買取総額 / 単価</span>
              <div class="text-base font-bold font-mono tabular-nums text-amber-300 truncate">
                ¥{{ staffReuseKpi.totalAmount.amount.toLocaleString() }}
              </div>
              <div class="text-[11px] font-mono tabular-nums text-slate-400">
                単価 ¥{{ staffReuseKpi.avgUnitPrice.amount.toLocaleString() }}
              </div>
            </div>
          </div>
        </section>

        <!-- 2. 個人推移グラフ -->
        <section class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 class="text-xs font-bold text-slate-300">日次接客件数トレンド</h4>
            <span class="text-[11px] text-slate-400">未入力日は0プロット</span>
          </div>
          <div class="relative w-full h-[180px]">
            <canvas ref="staffTrendCanvasRef"></canvas>
          </div>
        </section>

        <!-- 3. 未提案理由の傾向分析（コーチング材料） -->
        <section class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 class="text-xs font-bold text-slate-300">未提案理由の傾向（マネジメント指導材料）</h4>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              全 {{ staffReasons.reduce((s, r) => s + r.count, 0) }}件
            </span>
          </div>

          <div v-if="staffReasons.length === 0" class="py-4 text-center text-xs text-slate-500">
            期間中の未提案理由レコードはありません
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="(r, idx) in staffReasons.slice(0, 8)"
              :key="idx"
              class="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div class="truncate pr-3">
                <span class="text-slate-200 font-medium">{{ r.reason }}</span>
                <span class="text-slate-500 ml-1.5">({{ r.itemLabel }})</span>
              </div>
              <span class="font-mono tabular-nums font-bold text-sky-300 shrink-0">
                {{ r.count }}件 ({{ r.percent }}%)
              </span>
            </div>
          </div>
        </section>

        <!-- 4. 直近履歴テーブル（最新20件） -->
        <section class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 class="text-xs font-bold text-slate-300">直近の入力履歴（最新20件）</h4>
            <span class="text-xs font-mono tabular-nums text-slate-400">
              全 {{ staffRecords.length }}件中
            </span>
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-800">
            <table class="w-full text-left text-xs font-mono tabular-nums text-slate-300">
              <thead class="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th class="px-3 py-2 whitespace-nowrap">対応日</th>
                  <th
                    v-for="item in store.currentActiveItems"
                    :key="item.key"
                    class="px-3 py-2 whitespace-nowrap font-sans"
                  >
                    {{ item.label }}
                  </th>
                  <th
                    v-if="store.currentBusiness === 'reuse'"
                    class="px-3 py-2 whitespace-nowrap text-right font-sans"
                  >
                    金額
                  </th>
                  <th class="px-3 py-2 whitespace-nowrap font-sans">未提案理由</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/70">
                <tr v-for="rec in staffRecords.slice(0, 20)" :key="rec.submissionId">
                  <td class="px-3 py-2 whitespace-nowrap text-slate-400">{{ rec.targetDate }}</td>
                  <td
                    v-for="item in store.currentActiveItems"
                    :key="item.key"
                    class="px-3 py-2 whitespace-nowrap font-sans"
                  >
                    <span
                      :class="
                        isOptionSuccess(item, rec.answers[item.key])
                          ? 'text-emerald-400 font-bold'
                          : 'text-slate-400'
                      "
                    >
                      {{ rec.answers[item.key] || '-' }}
                    </span>
                  </td>
                  <td
                    v-if="store.currentBusiness === 'reuse'"
                    class="px-3 py-2 whitespace-nowrap text-right text-amber-300 font-bold"
                  >
                    {{ rec.amount !== null ? `¥${rec.amount.toLocaleString()}` : '-' }}
                  </td>
                  <td
                    class="px-3 py-2 font-sans text-rose-300/90 max-w-[160px] truncate"
                    :title="formatRecordReasonSummary(rec, store.currentAllItems)"
                  >
                    {{ formatRecordReasonSummary(rec, store.currentAllItems) || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- フッター -->
      <div class="sticky bottom-0 z-20 px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-end">
        <button
          type="button"
          @click="closeDrawer"
          class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
        >
          閉じる
        </button>
      </div>
    </aside>
  </Transition>
</template>
