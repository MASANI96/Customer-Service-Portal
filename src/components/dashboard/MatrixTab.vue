<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Info } from 'lucide-vue-next';
import type { MatrixCellData, MatrixColumnDef, MatrixRowData } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { addDays, createLocalDate, formatDateKey } from '@/utils/dateUtils';
import { computeMatrixCell } from '@/utils/kpiCalculators';

const store = useAppStore();

const dimension = ref<'staff' | 'store'>('staff');
const granularity = ref<'daily' | 'weekly'>('daily');
const selectedKpi = ref<string>('次回予約_獲得率');

// 45日超過時は自動で週次集計へガード
watch(
  () => store.dateRangeDaysCount,
  (days) => {
    if (days > 45 && granularity.value === 'daily') {
      granularity.value = 'weekly';
    }
  },
  { immediate: true }
);

const kpiOptions = computed(() => {
  if (store.currentBusiness === 'healthcare') {
    const opts: Array<{ value: string; label: string }> = [];
    for (const item of store.currentActiveItems) {
      opts.push({ value: `${item.key}_獲得率`, label: `${item.label} 獲得率 (%)` });
      opts.push({
        value: `${item.key}_提案率`,
        label: `${item.label} ${item.key === '口コミ' ? '案内率' : '提案率'} (%)`,
      });
    }
    return opts;
  }

  const reuseOpts: Array<{ value: string; label: string }> = [
    { value: '査定実施率', label: '査定実施率 (%)' },
  ];
  for (const item of store.currentActiveItems) {
    if (item.key === '来店・査定') continue;
    const winLabel = item.key === '提案・成約' ? '成約率' : '獲得率';
    const propLabel = item.key === '口コミ' ? '案内率' : '提案率';
    reuseOpts.push({ value: `${item.key}_${ '獲得率' }`, label: `${item.label} ${winLabel} (%)` });
    reuseOpts.push({ value: `${item.key}_提案率`, label: `${item.label} ${propLabel} (%)` });
  }
  reuseOpts.push({ value: '買取総額', label: '買取総額 (円)' });
  reuseOpts.push({ value: '平均単価', label: '平均買取単価 (円)' });
  return reuseOpts;
});

watch(
  () => [store.currentBusiness, kpiOptions.value],
  () => {
    if (!kpiOptions.value.some((o) => o.value === selectedKpi.value)) {
      selectedKpi.value = kpiOptions.value[0]?.value || '次回予約_獲得率';
    }
  },
  { immediate: true }
);

const columns = computed<MatrixColumnDef[]>(() => {
  const { start, end } = store.activeDateRange;
  const dStart = createLocalDate(start);
  const dEnd = createLocalDate(end);
  if (!dStart || !dEnd || dStart > dEnd) return [];

  const cols: MatrixColumnDef[] = [];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  if (granularity.value === 'daily') {
    const curr = new Date(dStart);
    while (curr <= dEnd) {
      const k = formatDateKey(curr);
      cols.push({
        key: k,
        label: `${curr.getMonth() + 1}/${curr.getDate()}`,
        subLabel: dayNames[curr.getDay()],
        start: k,
        end: k,
      });
      curr.setDate(curr.getDate() + 1);
    }
  } else {
    const curr = new Date(dStart);
    const day = curr.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    curr.setDate(curr.getDate() + diffToMon);

    while (curr <= dEnd) {
      const wStart = formatDateKey(curr);
      const wEnd = formatDateKey(addDays(curr, 6));
      const clippedStart = wStart < start ? start : wStart;
      const clippedEnd = wEnd > end ? end : wEnd;

      cols.push({
        key: wStart,
        label: `${curr.getMonth() + 1}/${curr.getDate()}週`,
        subLabel: `${clippedStart.slice(5).replace('-', '/')}〜`,
        start: clippedStart,
        end: clippedEnd,
      });
      curr.setDate(curr.getDate() + 7);
    }
  }

  return cols;
});

const matrixRows = computed<MatrixRowData[]>(() => {
  const bizRecords = store.records.filter((r) => r.businessType === store.currentBusiness);
  const { start: pStart, end: pEnd } = store.activeDateRange;

  const targets =
    dimension.value === 'staff'
      ? (store.selectedStore === 'all'
          ? store.activeBusinessStaff
          : store.activeBusinessStaff.filter((s) => s.storeName === store.selectedStore)
        ).map((s) => ({
          id: s.id,
          name: s.name,
          subName: s.storeName,
          storeName: s.storeName,
          staffId: s.id,
        }))
      : store.storeOptions.map((st) => ({
          id: st,
          name: st,
          subName: '',
          storeName: st,
          staffId: 'all',
        }));

  return targets.map((t) => {
    const rowPool =
      dimension.value === 'staff'
        ? bizRecords.filter(
            (r) =>
              r.staffId === t.staffId &&
              (store.selectedStore === 'all' || r.storeName === store.selectedStore)
          )
        : bizRecords.filter((r) => r.storeName === t.storeName);

    const cells: Record<string, MatrixCellData> = {};
    for (const col of columns.value) {
      const colRecs = rowPool.filter((r) => r.targetDate >= col.start && r.targetDate <= col.end);
      cells[col.key] = computeMatrixCell(
        colRecs,
        store.currentBusiness,
        selectedKpi.value,
        store.currentAllItems,
        store.targetRecords,
        t.storeName,
        t.staffId,
        store.activeDateRange
      );
    }

    const totalRecs = rowPool.filter((r) => r.targetDate >= pStart && r.targetDate <= pEnd);
    const total = computeMatrixCell(
      totalRecs,
      store.currentBusiness,
      selectedKpi.value,
      store.currentAllItems,
      store.targetRecords,
      t.storeName,
      t.staffId,
      store.activeDateRange
    );

    return {
      id: t.id,
      name: t.name,
      subName: t.subName,
      total,
      cells,
    };
  });
});

function formatCellValue(cell: MatrixCellData): string {
  if (cell.count === 0) return '-';
  if (selectedKpi.value === '買取総額') {
    if (cell.value >= 10000) return `¥${Math.round(cell.value / 10000)}万`;
    return `¥${cell.value.toLocaleString()}`;
  }
  if (selectedKpi.value === '平均単価') {
    return `¥${cell.value.toLocaleString()}`;
  }
  return `${cell.value}%`;
}

function getHeatmapCellBg(cell: MatrixCellData | undefined): string {
  if (!cell || cell.count === 0 || cell.isMoney || cell.achievement === null) {
    return 'bg-slate-950/30';
  }
  if (cell.achievement >= 100) return 'bg-emerald-950/45';
  if (cell.achievement >= 80) return 'bg-amber-950/35';
  return 'bg-rose-950/45';
}

function getHeatmapTextColor(cell: MatrixCellData | undefined): string {
  if (!cell || cell.count === 0) return 'text-slate-600';
  if (cell.isMoney || cell.achievement === null) return 'text-slate-200';
  if (cell.achievement >= 100) return 'text-emerald-400';
  if (cell.achievement >= 80) return 'text-amber-400';
  return 'text-rose-400';
}
</script>

<template>
  <div class="space-y-5">
    <!-- マトリクス設定バー -->
    <section class="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div>
          <h2 class="text-sm font-bold text-white">日次・週次クロス集計マトリクス</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            縦軸（スタッフ / 店舗）× 横軸（日次 / 週次）の実績推移を目標達成度ヒートマップで可視化します。
          </p>
        </div>

        <div
          v-if="store.dateRangeDaysCount > 45"
          class="px-3 py-1.5 rounded-lg bg-amber-950/50 border border-amber-800/70 text-amber-300 text-xs flex items-center gap-1.5"
        >
          <Info class="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>選択期間が45日を超えるため、週次集計へ自動保護されています</span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <!-- 縦軸 -->
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <span class="text-slate-400 font-semibold block">縦軸（対象単位）</span>
          <div class="grid grid-cols-2 gap-1">
            <button
              type="button"
              @click="dimension = 'staff'"
              class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
              :class="
                dimension === 'staff'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              "
            >
              スタッフ一覧
            </button>
            <button
              type="button"
              @click="dimension = 'store'"
              class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
              :class="
                dimension === 'store'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              "
            >
              店舗一覧
            </button>
          </div>
        </div>

        <!-- 横軸 -->
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <span class="text-slate-400 font-semibold block">横軸（時間粒度）</span>
          <div class="grid grid-cols-2 gap-1">
            <button
              type="button"
              :disabled="store.dateRangeDaysCount > 45"
              @click="granularity = 'daily'"
              class="py-1.5 px-2 rounded-md font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              :class="
                granularity === 'daily'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              "
            >
              日次
            </button>
            <button
              type="button"
              @click="granularity = 'weekly'"
              class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
              :class="
                granularity === 'weekly'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              "
            >
              週次（月曜始）
            </button>
          </div>
        </div>

        <!-- 表示KPI -->
        <div class="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <label for="matrix-kpi-select" class="text-slate-400 font-semibold block">
            集計表示KPI
          </label>
          <select
            id="matrix-kpi-select"
            v-model="selectedKpi"
            class="w-full bg-slate-900 text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
          >
            <option v-for="opt in kpiOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- 凡例 -->
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
        <div class="flex flex-wrap items-center gap-4">
          <span>ヒートマップ凡例:</span>
          <span class="text-emerald-400 font-semibold">達成（100%〜）</span>
          <span class="text-amber-400 font-semibold">注意（80〜99%）</span>
          <span class="text-rose-400 font-semibold">未達（&lt;80%）</span>
          <span class="text-slate-400">未設定 / 金額指標 / 実績なし</span>
        </div>
        <span class="font-mono tabular-nums">
          {{ matrixRows.length }}行 × {{ columns.length }}列
        </span>
      </div>
    </section>

    <!-- クロス集計テーブル -->
    <section class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div class="overflow-x-auto max-h-[600px]">
        <table class="w-full text-left text-xs border-collapse font-mono tabular-nums">
          <thead class="bg-slate-950 sticky top-0 z-20 text-slate-300 font-semibold border-b border-slate-800">
            <tr>
              <th class="sticky left-0 z-30 bg-slate-950 px-4 py-3 whitespace-nowrap min-w-[180px] border-r border-slate-800 font-sans">
                {{ dimension === 'staff' ? 'スタッフ（所属店舗）' : '店舗名' }}
              </th>
              <th class="px-3.5 py-3 whitespace-nowrap text-center bg-slate-900 border-r border-slate-800 min-w-[92px] font-sans">
                期間合計
              </th>
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-2.5 py-2.5 whitespace-nowrap text-center border-r border-slate-800/80 min-w-[78px]"
              >
                <div class="text-xs font-bold text-slate-200">{{ col.label }}</div>
                <div class="text-[10px] text-slate-400 font-sans font-normal">{{ col.subLabel }}</div>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-800/80">
            <tr v-for="row in matrixRows" :key="row.id" class="hover:bg-slate-850/40">
              <td class="sticky left-0 z-10 bg-slate-925 px-4 py-2.5 whitespace-nowrap border-r border-slate-800 font-sans">
                <div class="font-bold text-white truncate max-w-[160px]">{{ row.name }}</div>
                <div v-if="row.subName" class="text-[11px] text-slate-400 truncate max-w-[160px]">
                  {{ row.subName }}
                </div>
              </td>

              <td class="px-3.5 py-2.5 text-center bg-slate-900/90 border-r border-slate-800">
                <div class="font-bold text-sky-300">{{ formatCellValue(row.total) }}</div>
                <div class="text-[10px] text-slate-400">{{ row.total.count }}件</div>
              </td>

              <td
                v-for="col in columns"
                :key="col.key"
                class="px-2 py-2 text-center border-r border-slate-800/60"
                :class="getHeatmapCellBg(row.cells[col.key])"
              >
                <template v-if="row.cells[col.key] && row.cells[col.key].count > 0">
                  <div class="font-bold text-xs" :class="getHeatmapTextColor(row.cells[col.key])">
                    {{ formatCellValue(row.cells[col.key]) }}
                  </div>
                  <div class="text-[10px] text-slate-400">{{ row.cells[col.key].count }}件</div>
                </template>
                <span v-else class="text-slate-600">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
