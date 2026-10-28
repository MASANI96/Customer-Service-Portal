<script setup lang="ts">
import {
  BarChart3,
  Building2,
  RotateCcw,
  Settings2,
  Smartphone,
  UserCheck,
} from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';

const store = useAppStore();

function onStaffSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  if (target.value) {
    store.setEntryStaff(target.value);
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100">
    <div class="max-w-[1400px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4 overflow-x-auto">
      <!-- Zone 1: Brand & Business Model Switcher -->
      <div class="flex items-center gap-4 shrink-0">
        <span class="text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          店舗KPI統合デモ
        </span>

        <div
          class="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0"
          role="group"
          aria-label="事業モデル切替"
        >
          <button
            type="button"
            @click="store.switchBusiness('healthcare')"
            class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            :class="
              store.currentBusiness === 'healthcare'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            <Building2 class="w-3.5 h-3.5 shrink-0" />
            <span>ヘルスケア</span>
          </button>
          <button
            type="button"
            @click="store.switchBusiness('reuse')"
            class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            :class="
              store.currentBusiness === 'reuse'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            <Building2 class="w-3.5 h-3.5 shrink-0" />
            <span>リユース</span>
          </button>
        </div>
      </div>

      <!-- Zone 2: Primary View Navigation Tabs -->
      <nav class="flex items-center gap-1 shrink-0" aria-label="画面切替">
        <button
          type="button"
          @click="store.currentView = 'entry'"
          class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          :class="
            store.currentView === 'entry'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
          "
        >
          <Smartphone class="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>現場入力フォーム</span>
        </button>

        <button
          type="button"
          @click="store.currentView = 'dashboard'"
          class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          :class="
            store.currentView === 'dashboard'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
          "
        >
          <BarChart3 class="w-3.5 h-3.5 shrink-0 text-sky-400" />
          <span>分析ダッシュボード</span>
        </button>

        <button
          type="button"
          @click="store.currentView = 'admin'"
          class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          :class="
            store.currentView === 'admin'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
          "
        >
          <Settings2 class="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>マスタ管理ポータル</span>
        </button>
      </nav>

      <!-- Zone 3: Active Staff Selector & Demo Data Reset -->
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
          <UserCheck class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <label for="global-staff-select" class="text-[11px] text-slate-400 whitespace-nowrap shrink-0 hidden xl:inline">
            入力担当:
          </label>
          <select
            id="global-staff-select"
            :value="store.currentEntryStaff.id"
            @change="onStaffSelectChange"
            class="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
            aria-label="稼働中スタッフ選択"
          >
            <option
              v-for="staff in store.activeBusinessStaff"
              :key="staff.id"
              :value="staff.id"
              class="bg-slate-900 text-slate-100"
            >
              {{ staff.name }}（{{ staff.storeName }}）
            </option>
          </select>
        </div>

        <button
          type="button"
          @click="store.resetAllDemoData()"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          title="全マスタ・目標値・実績データを初期デモ状態に復元します"
        >
          <RotateCcw class="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span>初期デモデータに戻す</span>
        </button>
      </div>
    </div>
  </header>
</template>
