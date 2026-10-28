<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import GlobalHeader from '@/components/common/GlobalHeader.vue';
import EntryView from '@/views/EntryView.vue';
import DashboardView from '@/views/DashboardView.vue';
import AdminView from '@/views/AdminView.vue';

const store = useAppStore();
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- 共通デモ操作グローバルヘッダー -->
    <GlobalHeader />

    <!-- メインビュー切替 -->
    <main class="flex-1">
      <EntryView v-if="store.currentView === 'entry'" />
      <DashboardView v-else-if="store.currentView === 'dashboard'" />
      <AdminView v-else />
    </main>

    <!-- グローバルトースト通知 -->
    <div
      class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      <TransitionGroup name="fade">
        <div
          v-for="t in store.toasts"
          :key="t.id"
          class="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-xl p-3.5 border border-slate-700 flex items-center gap-3"
        >
          <CheckCircle2 v-if="t.type === 'success'" class="w-4 h-4 text-emerald-400 shrink-0" />
          <AlertCircle v-else-if="t.type === 'error'" class="w-4 h-4 text-rose-400 shrink-0" />
          <Info v-else class="w-4 h-4 text-sky-400 shrink-0" />
          <span class="text-xs font-medium leading-relaxed flex-1">{{ t.message }}</span>
          <button
            type="button"
            @click="store.dismissToast(t.id)"
            class="text-slate-400 hover:text-white cursor-pointer shrink-0"
            aria-label="通知を閉じる"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
