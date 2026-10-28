<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpDown, ChevronRight, RotateCcw } from 'lucide-vue-next';
import type { StoreAnalyticsRow } from '@/types';
import { useAppStore } from '@/stores/appStore';
import {
  calculateHealthcareSummary,
  calculateReuseSummary,
  filterServiceRecords,
} from '@/utils/kpiCalculators';

const store = useAppStore();

const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('desc');

const storeRows = computed<StoreAnalyticsRow[]>(() => {
  return store.storeOptions.map((stName) => {
    const curRecs = filterServiceRecords(
      store.records,
      store.currentBusiness,
      store.activeDateRange,
      stName,
      'all'
    );
    const prevRecs = filterServiceRecords(
      store.records,
      store.currentBusiness,
      store.activeComparisonRange,
      stName,
      'all'
    );

    if (store.currentBusiness === 'healthcare') {
      const hc = calculateHealthcareSummary(
        curRecs,
        prevRecs,
        store.currentAllItems,
        store.targetRecords,
        stName,
        'all',
        store.activeDateRange
      );
      return {
        storeName: stName,
        healthcare: hc,
        avgAchievement: hc.avgAchievement,
      };
    }

    const ru = calculateReuseSummary(
      curRecs,
      prevRecs,
      store.currentAllItems,
      store.targetRecords,
      stName,
      'all',
      store.activeDateRange,
      store.isMonthRange
    );
    return {
      storeName: stName,
      reuse: ru,
      avgAchievement: ru.avgAchievement,
    };
  });
});

const achievedCount = computed(
  () => storeRows.value.filter((r) => r.avgAchievement !== null && r.avgAchievement >= 100).length
);
const cautionCount = computed(
  () =>
    storeRows.value.filter(
      (r) => r.avgAchievement !== null && r.avgAchievement >= 80 && r.avgAchievement < 100
    ).length
);
const dangerCount = computed(
  () => storeRows.value.filter((r) => r.avgAchievement !== null && r.avgAchievement < 80).length
);

const sortedRows = computed(() => {
  const list = [...storeRows.value];
  if (!sortKey.value) return list;
  const dir = sortOrder.value === 'asc' ? 1 : -1;
  const key = sortKey.value;

  return list.sort((a, b) => {
    if (key === 'storeName') return dir * a.storeName.localeCompare(b.storeName);
    if (key === 'avgAchievement') {
      const va = a.avgAchievement ?? -1;
      const vb = b.avgAchievement ?? -1;
      return dir * (va - vb);
    }
    if (store.currentBusiness === 'healthcare') {
      if (key === 'totalVisits') {
        return dir * ((a.healthcare?.totalVisits || 0) - (b.healthcare?.totalVisits || 0));
      }
      if (key.startsWith('item_')) {
        const itemKey = key.slice(5);
        const ra = a.healthcare?.itemMetrics[itemKey]?.rate || 0;
        const rb = b.healthcare?.itemMetrics[itemKey]?.rate || 0;
        return dir * (ra - rb);
      }
    } else {
      if (key === 'totalAssessments') {
        return dir * ((a.reuse?.totalAssessments || 0) - (b.reuse?.totalAssessments || 0));
      }
      if (key === 'closingRate') {
        return dir * ((a.reuse?.closingMetric.rate || 0) - (b.reuse?.closingMetric.rate || 0));
      }
      if (key === 'totalAmount') {
        return dir * ((a.reuse?.totalAmount.amount || 0) - (b.reuse?.totalAmount.amount || 0));
      }
      if (key === 'avgUnitPrice') {
        return dir * ((a.reuse?.avgUnitPrice.amount || 0) - (b.reuse?.avgUnitPrice.amount || 0));
      }
      if (key === 'reviewRate') {
        return dir * ((a.reuse?.reviewMetric.rate || 0) - (b.reuse?.reviewMetric.rate || 0));
      }
    }
    return 0;
  });
});

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'desc';
  }
}

function getBadgeClasses(achievement: number | null): string {
  if (achievement === null) return 'text-slate-400 bg-slate-900 border-slate-800';
  if (achievement >= 100) return 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80';
  if (achievement >= 80) return 'text-amber-400 bg-amber-950/70 border-amber-800/80';
  return 'text-rose-400 bg-rose-950/70 border-rose-800/80';
}

function formatDiff(val: number | null | undefined, unit: string): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}${unit}`;
}

function getDiffColor(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return 'text-slate-500';
  if (val > 0) return 'text-emerald-400';
  if (val < 0) return 'text-rose-400';
  return 'text-slate-400';
}

function drillDownToStore(storeName: string) {
  store.setStoreFilter(storeName);
  store.selectedStaff = 'all';
  store.dashboardTab = 'staff';
}
</script>

<template>
  <div class="space-y-5">
    <!-- 店舗サマリー統計 -->
    <section class="bg-slate-900 rounded-xl p-5 border border-slate-800">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 class="text-sm font-bold text-white">
            店舗別 パフォーマンス・KPI一覧比較
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            列ヘッダークリックで双方向ソート可能。店舗名をクリックすると所属スタッフ分析へドリルダウンします。
          </p>
        </div>

        <button
          v-if="sortKey"
          type="button"
          @click="sortKey = ''"
          class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <RotateCcw class="w-3.5 h-3.5 shrink-0" />
          <span>ソート解除</span>
        </button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <span class="text-slate-400">稼働店舗数</span>
          <span class="font-mono tabular-nums font-bold text-white text-sm">
            {{ storeRows.length }} 店舗
          </span>
        </div>
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <span class="text-emerald-400">目標達成（100%〜）</span>
          <span class="font-mono tabular-nums font-bold text-emerald-400 text-sm">
            {{ achievedCount }} 店
          </span>
        </div>
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <span class="text-amber-400">注意（80〜99%）</span>
          <span class="font-mono tabular-nums font-bold text-amber-400 text-sm">
            {{ cautionCount }} 店
          </span>
        </div>
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <span class="text-rose-400">未達警告（&lt;80%）</span>
          <span class="font-mono tabular-nums font-bold text-rose-400 text-sm">
            {{ dangerCount }} 店
          </span>
        </div>
      </div>
    </section>

    <!-- 店舗比較テーブル -->
    <section class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div class="overflow-x-auto">
        <!-- ヘルスケア 店舗テーブル -->
        <table v-if="store.currentBusiness === 'healthcare'" class="w-full text-left text-xs text-slate-300">
          <thead class="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 select-none">
            <tr>
              <th
                class="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-white"
                @click="toggleSort('storeName')"
              >
                <div class="flex items-center gap-1.5">
                  <span>店舗名</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('totalVisits')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>総接客数</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                v-for="item in store.currentActiveItems"
                :key="item.key"
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort(`item_${item.key}`)"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>{{ item.label }}（獲得/提案）</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('avgAchievement')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>平均達成率</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th class="px-4 py-3 whitespace-nowrap text-right">詳細</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-800/80 font-mono tabular-nums">
            <tr
              v-for="row in sortedRows"
              :key="row.storeName"
              class="hover:bg-slate-850/60 transition-colors"
            >
              <td class="px-4 py-3.5 whitespace-nowrap font-sans">
                <button
                  type="button"
                  @click="drillDownToStore(row.storeName)"
                  class="font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                >
                  {{ row.storeName }}
                </button>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <div class="font-bold text-white">
                  {{ row.healthcare?.totalVisits.toLocaleString() }}件
                </div>
                <div class="text-[11px]" :class="getDiffColor(row.healthcare?.visitsDiffPercent)">
                  {{ formatDiff(row.healthcare?.visitsDiffPercent, '%') }}
                </div>
              </td>

              <td
                v-for="item in store.currentActiveItems"
                :key="item.key"
                class="px-4 py-3.5 whitespace-nowrap text-right"
              >
                <template v-if="row.healthcare?.itemMetrics[item.key]">
                  <div class="flex items-center justify-end gap-1.5">
                    <span class="font-bold text-white">
                      {{ row.healthcare.itemMetrics[item.key].rate }}%
                    </span>
                    <span class="text-[11px] text-slate-400">
                      / 提{{ row.healthcare.itemMetrics[item.key].proposalRate }}%
                    </span>
                    <span
                      v-if="row.healthcare.itemMetrics[item.key].achievement !== null"
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                      :class="getBadgeClasses(row.healthcare.itemMetrics[item.key].achievement)"
                    >
                      {{ row.healthcare.itemMetrics[item.key].achievement }}%
                    </span>
                  </div>
                  <div
                    class="text-[11px]"
                    :class="getDiffColor(row.healthcare.itemMetrics[item.key].rateDiff)"
                  >
                    {{ formatDiff(row.healthcare.itemMetrics[item.key].rateDiff, 'pt') }}
                  </div>
                </template>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <span
                  v-if="row.avgAchievement !== null"
                  class="px-2 py-0.5 rounded border font-bold text-xs"
                  :class="getBadgeClasses(row.avgAchievement)"
                >
                  {{ row.avgAchievement }}%
                </span>
                <span v-else class="text-slate-500">-</span>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right font-sans">
                <button
                  type="button"
                  @click="drillDownToStore(row.storeName)"
                  class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>スタッフ分析</span>
                  <ChevronRight class="w-3.5 h-3.5 shrink-0" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- リユース 店舗テーブル -->
        <table v-else class="w-full text-left text-xs text-slate-300">
          <thead class="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 select-none">
            <tr>
              <th
                class="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-white"
                @click="toggleSort('storeName')"
              >
                <div class="flex items-center gap-1.5">
                  <span>店舗名</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('totalAssessments')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>査定数 / 実施率</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('closingRate')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>成約率 / 提案率</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('totalAmount')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>買取総額</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('avgUnitPrice')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>平均買取単価</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('reviewRate')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>口コミ（獲得/案内）</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th
                class="px-4 py-3 whitespace-nowrap text-right cursor-pointer hover:text-white"
                @click="toggleSort('avgAchievement')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>平均達成率</span>
                  <ArrowUpDown class="w-3.5 h-3.5 text-slate-500" />
                </div>
              </th>
              <th class="px-4 py-3 whitespace-nowrap text-right">詳細</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-800/80 font-mono tabular-nums">
            <tr
              v-for="row in sortedRows"
              :key="row.storeName"
              class="hover:bg-slate-850/60 transition-colors"
            >
              <td class="px-4 py-3.5 whitespace-nowrap font-sans">
                <button
                  type="button"
                  @click="drillDownToStore(row.storeName)"
                  class="font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                >
                  {{ row.storeName }}
                </button>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <div class="font-bold text-white">
                  {{ row.reuse?.totalAssessments }}件
                  <span class="text-[11px] text-amber-400">({{ row.reuse?.assessmentRate }}%)</span>
                </div>
                <div class="text-[11px]" :class="getDiffColor(row.reuse?.assessmentsDiffPercent)">
                  {{ formatDiff(row.reuse?.assessmentsDiffPercent, '%') }}
                </div>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <span class="font-bold text-white">{{ row.reuse?.closingMetric.rate }}%</span>
                  <span class="text-[11px] text-slate-400">
                    / 提{{ row.reuse?.closingMetric.proposalRate }}%
                  </span>
                  <span
                    v-if="row.reuse?.closingMetric.achievement !== null"
                    class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    :class="getBadgeClasses(row.reuse?.closingMetric.achievement ?? null)"
                  >
                    {{ row.reuse?.closingMetric.achievement }}%
                  </span>
                </div>
                <div class="text-[11px]" :class="getDiffColor(row.reuse?.closingMetric.rateDiff)">
                  {{ formatDiff(row.reuse?.closingMetric.rateDiff, 'pt') }}
                </div>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <div class="font-bold text-amber-300">
                  ¥{{ row.reuse?.totalAmount.amount.toLocaleString() }}
                </div>
                <div class="text-[11px]" :class="getDiffColor(row.reuse?.totalAmount.percentDiff)">
                  {{ formatDiff(row.reuse?.totalAmount.percentDiff, '%') }}
                </div>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <div class="font-bold text-white">
                  ¥{{ row.reuse?.avgUnitPrice.amount.toLocaleString() }}
                </div>
                <div class="text-[11px]" :class="getDiffColor(row.reuse?.avgUnitPrice.percentDiff)">
                  {{ formatDiff(row.reuse?.avgUnitPrice.percentDiff, '%') }}
                </div>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <span class="font-bold text-white">{{ row.reuse?.reviewMetric.rate }}%</span>
                  <span class="text-[11px] text-slate-400">
                    / 案{{ row.reuse?.reviewMetric.proposalRate }}%
                  </span>
                  <span
                    v-if="row.reuse?.reviewMetric.achievement !== null"
                    class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    :class="getBadgeClasses(row.reuse?.reviewMetric.achievement ?? null)"
                  >
                    {{ row.reuse?.reviewMetric.achievement }}%
                  </span>
                </div>
                <div class="text-[11px]" :class="getDiffColor(row.reuse?.reviewMetric.rateDiff)">
                  {{ formatDiff(row.reuse?.reviewMetric.rateDiff, 'pt') }}
                </div>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right">
                <span
                  v-if="row.avgAchievement !== null"
                  class="px-2 py-0.5 rounded border font-bold text-xs"
                  :class="getBadgeClasses(row.avgAchievement)"
                >
                  {{ row.avgAchievement }}%
                </span>
                <span v-else class="text-slate-500">-</span>
              </td>

              <td class="px-4 py-3.5 whitespace-nowrap text-right font-sans">
                <button
                  type="button"
                  @click="drillDownToStore(row.storeName)"
                  class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>スタッフ分析</span>
                  <ChevronRight class="w-3.5 h-3.5 shrink-0" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
