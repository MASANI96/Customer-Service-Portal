<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Building2,
  Calendar,
  Download,
  Gauge,
  Grid3X3,
  Target,
  Users,
  X,
} from 'lucide-vue-next';
import type { PresetPeriodType } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { formatSlashDate } from '@/utils/dateUtils';
import OverviewTab from '@/components/dashboard/OverviewTab.vue';
import StoreTab from '@/components/dashboard/StoreTab.vue';
import StaffTab from '@/components/dashboard/StaffTab.vue';
import MatrixTab from '@/components/dashboard/MatrixTab.vue';
import StaffDrawer from '@/components/dashboard/StaffDrawer.vue';
import TargetModal from '@/components/dashboard/TargetModal.vue';

const store = useAppStore();

const currentYear = new Date().getFullYear();
const availableYears = [currentYear, currentYear - 1, currentYear - 2];

const customFromInput = ref<string>(store.activeDateRange.start);
const customToInput = ref<string>(store.activeDateRange.end);

const formattedRangeLabel = computed(
  () =>
    `${formatSlashDate(store.activeDateRange.start)} 〜 ${formatSlashDate(
      store.activeDateRange.end
    )}`
);

function isPresetActive(type: PresetPeriodType, val: number): boolean {
  return store.presetType === type && store.presetValue === val;
}

function handleApplyCustom() {
  store.applyCustomPeriod(customFromInput.value, customToInput.value);
}

function onStoreSelectChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  store.setStoreFilter(val);
}
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)] bg-slate-950 text-slate-100 py-6 px-4 lg:px-8">
    <div class="max-w-[1400px] mx-auto space-y-6">
      <!-- ダッシュボード見出し ＆ アクションバー -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <span
              class="font-semibold"
              :class="
                store.currentBusiness === 'healthcare' ? 'text-emerald-400' : 'text-amber-400'
              "
            >
              {{ store.businessLabel }}
            </span>
            <span aria-hidden="true">·</span>
            <span class="font-mono tabular-nums">最終更新 {{ store.lastSyncTime }}</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            経営・店舗マネジメント 高度分析ダッシュボード
          </h1>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            @click="store.showTargetModal = true"
            class="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Target class="w-4 h-4 text-sky-400 shrink-0" />
            <span>KPI目標設定</span>
          </button>

          <button
            type="button"
            @click="store.exportFilteredCsv()"
            class="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download class="w-4 h-4 text-emerald-400 shrink-0" />
            <span>CSVエクスポート</span>
          </button>
        </div>
      </div>

      <!-- 1. 高機能期間設定パネル -->
      <section class="bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-800 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <Calendar class="w-4 h-4 text-sky-400 shrink-0" />
            <h2 class="text-xs font-bold text-slate-200">集計期間設定パネル</h2>
          </div>

          <div class="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-300">
            <span class="font-sans text-slate-400">適用期間:</span>
            <span class="text-sky-300 font-semibold">{{ formattedRangeLabel }}</span>
            <span aria-hidden="true" class="text-slate-600">·</span>
            <span>{{ store.dateRangeDaysCount }}日間</span>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
          <!-- 年度 -->
          <div class="lg:col-span-3 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span class="text-slate-400 font-semibold block">年度</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="y in availableYears"
                :key="y"
                type="button"
                @click="store.setPresetPeriod('year', y)"
                class="py-1.5 px-2 rounded-md font-mono tabular-nums font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('year', y)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                {{ y }}年
              </button>
            </div>
          </div>

          <!-- 半期 ＆ 四半期 -->
          <div class="lg:col-span-4 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-slate-400 font-semibold">半期 / 四半期</span>
              <span class="text-[11px] font-mono tabular-nums text-slate-500">
                {{ store.activeYearForQuarters }}年基準
              </span>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                @click="store.setPresetPeriod('half', 1)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('half', 1)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                上半期 (1-6月)
              </button>
              <button
                type="button"
                @click="store.setPresetPeriod('half', 2)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('half', 2)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                下半期 (7-12月)
              </button>
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="q in [1, 2, 3, 4]"
                :key="q"
                type="button"
                @click="store.setPresetPeriod('quarter', q)"
                class="py-1.5 px-1 rounded-md font-mono font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('quarter', q)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                Q{{ q }}
              </button>
            </div>
          </div>

          <!-- 月次 ＆ 直近期間 -->
          <div class="lg:col-span-5 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span class="text-slate-400 font-semibold block">月次 / 相対期間</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                @click="store.setPresetPeriod('month', 0)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('month', 0)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                今月
              </button>
              <button
                type="button"
                @click="store.setPresetPeriod('month', -1)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('month', -1)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                先月
              </button>
              <button
                type="button"
                @click="store.setPresetPeriod('month', -2)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('month', -2)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                2ヶ月前
              </button>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                @click="store.setPresetPeriod('relative', 3)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('relative', 3)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                直近3ヶ月
              </button>
              <button
                type="button"
                @click="store.setPresetPeriod('relative', 6)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('relative', 6)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                直近6ヶ月
              </button>
              <button
                type="button"
                @click="store.setPresetPeriod('around', 6)"
                class="py-1.5 px-2 rounded-md font-semibold transition-colors cursor-pointer"
                :class="
                  isPresetActive('around', 6)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                "
              >
                前後6ヶ月
              </button>
            </div>
          </div>
        </div>

        <!-- カスタム日付範囲 -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
          <span class="text-slate-400">カスタム期間指定:</span>
          <div class="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              v-model="customFromInput"
              class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:outline-none"
              aria-label="カスタム開始日"
            />
            <span class="text-slate-500">〜</span>
            <input
              type="date"
              v-model="customToInput"
              class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:outline-none"
              aria-label="カスタム終了日"
            />
            <button
              type="button"
              @click="handleApplyCustom"
              class="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
            >
              期間適用
            </button>
          </div>
        </div>
      </section>

      <!-- 2. 店舗・スタッフ絞り込みバー -->
      <section class="bg-slate-900 rounded-xl px-4 py-3.5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label for="dash-store-filter" class="text-slate-400 font-semibold whitespace-nowrap">
              店舗フィルター:
            </label>
            <select
              id="dash-store-filter"
              :value="store.selectedStore"
              @change="onStoreSelectChange"
              class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">全店舗（{{ store.storeOptions.length }}店）</option>
              <option v-for="st in store.storeOptions" :key="st" :value="st">{{ st }}</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <label for="dash-staff-filter" class="text-slate-400 font-semibold whitespace-nowrap">
              スタッフ:
            </label>
            <select
              id="dash-staff-filter"
              v-model="store.selectedStaff"
              class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">全員（{{ store.dashboardStaffOptions.length }}名）</option>
              <option v-for="sf in store.dashboardStaffOptions" :key="sf.id" :value="sf.id">
                {{ sf.name }}（{{ sf.storeName }}）
              </option>
            </select>
          </div>

          <button
            v-if="store.selectedStore !== 'all' || store.selectedStaff !== 'all'"
            type="button"
            @click="store.resetDashboardFilters()"
            class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <X class="w-3.5 h-3.5 shrink-0" />
            <span>絞り込み解除</span>
          </button>
        </div>

        <div class="flex items-center gap-2 text-slate-400">
          <span>集計対象レコード:</span>
          <strong class="font-mono tabular-nums text-sky-300 text-sm">
            {{ store.filteredRecords.length.toLocaleString() }}
          </strong>
          <span>件</span>
        </div>
      </section>

      <!-- 3. 分析サブタブナビゲーション -->
      <nav
        class="p-1 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-1 overflow-x-auto"
        aria-label="ダッシュボード表示切替"
      >
        <button
          type="button"
          @click="store.dashboardTab = 'overview'"
          class="flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          :class="
            store.dashboardTab === 'overview'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          "
        >
          <Gauge class="w-4 h-4 text-sky-400 shrink-0" />
          <span>概要ビュー</span>
        </button>

        <button
          type="button"
          @click="store.dashboardTab = 'store'"
          class="flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          :class="
            store.dashboardTab === 'store'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          "
        >
          <Building2 class="w-4 h-4 text-emerald-400 shrink-0" />
          <span>店舗分析（{{ store.storeOptions.length }}店）</span>
        </button>

        <button
          type="button"
          @click="store.dashboardTab = 'staff'"
          class="flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          :class="
            store.dashboardTab === 'staff'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          "
        >
          <Users class="w-4 h-4 text-amber-400 shrink-0" />
          <span>スタッフ分析（{{ store.activeBusinessStaff.length }}名）</span>
        </button>

        <button
          type="button"
          @click="store.dashboardTab = 'matrix'"
          class="flex-1 min-w-[155px] py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          :class="
            store.dashboardTab === 'matrix'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          "
        >
          <Grid3X3 class="w-4 h-4 text-sky-400 shrink-0" />
          <span>日次・週次マトリクス</span>
        </button>
      </nav>

      <!-- 4. 各タブコンテンツ（v-ifでChart.jsインスタンスの確実な生成・破棄を保証） -->
      <OverviewTab v-if="store.dashboardTab === 'overview'" />
      <StoreTab v-else-if="store.dashboardTab === 'store'" />
      <StaffTab v-else-if="store.dashboardTab === 'staff'" />
      <MatrixTab v-else />
    </div>

    <!-- スライドイン個人カルテ ＆ KPI目標設定モーダル -->
    <StaffDrawer />
    <TargetModal />
  </div>
</template>
