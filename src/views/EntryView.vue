<script setup lang="ts">
import { BarChart2, FileText, Layers } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { formatDateKey, formatSlashDate } from '@/utils/dateUtils';
import SingleEntry from '@/components/entry/SingleEntry.vue';
import BatchEntry from '@/components/entry/BatchEntry.vue';
import SummaryEntry from '@/components/entry/SummaryEntry.vue';
import CompleteModal from '@/components/entry/CompleteModal.vue';

const store = useAppStore();
const todayFormatted = formatSlashDate(formatDateKey(new Date()));
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 py-6 px-4 sm:px-6">
    <div class="max-w-2xl mx-auto space-y-5">
      <!-- スタッフ情報カード（スマホライク・クリーンヘッダー） -->
      <section class="bg-white rounded-2xl p-5 border border-slate-200">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-2">
          <div class="flex items-center gap-2">
            <span
              class="font-bold"
              :class="
                store.currentBusiness === 'healthcare' ? 'text-emerald-700' : 'text-amber-700'
              "
            >
              {{ store.businessLabel }}
            </span>
            <span aria-hidden="true">·</span>
            <span class="font-mono tabular-nums">ID: {{ store.currentEntryStaff.id }}</span>
          </div>
          <div class="font-mono tabular-nums text-slate-600">
            本日日付: {{ todayFormatted }}
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <p class="text-xs font-medium text-slate-500">
              {{ store.currentEntryStaff.storeName }}
            </p>
            <h1 class="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              {{ store.currentEntryStaff.name }}
              <span class="text-xs font-normal text-slate-500 ml-1">担当</span>
            </h1>
          </div>

          <p class="text-xs text-slate-500">
            入力内容は即座に分析ダッシュボードへ反映されます
          </p>
        </div>
      </section>

      <!-- 3モード切替セグメントコントロール -->
      <nav
        class="bg-slate-200/75 p-1 rounded-xl flex items-center gap-1"
        aria-label="入力モード切替"
      >
        <button
          type="button"
          @click="store.entrySubMode = 'single'"
          class="flex-1 min-h-[42px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          :class="
            store.entrySubMode === 'single'
              ? store.currentBusiness === 'healthcare'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'bg-white text-amber-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          "
        >
          <FileText class="w-4 h-4 shrink-0" />
          <span>1件ずつ入力</span>
        </button>

        <button
          type="button"
          @click="store.entrySubMode = 'batch'"
          class="flex-1 min-h-[42px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          :class="
            store.entrySubMode === 'batch'
              ? store.currentBusiness === 'healthcare'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'bg-white text-amber-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          "
        >
          <Layers class="w-4 h-4 shrink-0" />
          <span>複数行（方式A）</span>
        </button>

        <button
          type="button"
          @click="store.entrySubMode = 'summary'"
          class="flex-1 min-h-[42px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          :class="
            store.entrySubMode === 'summary'
              ? store.currentBusiness === 'healthcare'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'bg-white text-amber-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          "
        >
          <BarChart2 class="w-4 h-4 shrink-0" />
          <span>日次集計（方式B）</span>
        </button>
      </nav>

      <!-- モード別フォームコンポーネント -->
      <SingleEntry v-if="store.entrySubMode === 'single'" />
      <BatchEntry v-else-if="store.entrySubMode === 'batch'" />
      <SummaryEntry v-else />
    </div>

    <CompleteModal />
  </div>
</template>
