<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';

const store = useAppStore();
</script>

<template>
  <Transition name="fade">
    <div
      v-if="store.completeModal.show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs"
      role="status"
      aria-live="polite"
    >
      <div class="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-xl border border-slate-200 text-center">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white"
          :class="store.currentBusiness === 'healthcare' ? 'bg-emerald-600' : 'bg-amber-600'"
        >
          <Check class="w-8 h-8 stroke-[2.75]" />
        </div>

        <h3 class="text-lg font-bold text-slate-900 mb-1.5">
          {{ store.completeModal.title }}
        </h3>
        <p class="text-sm text-slate-600 mb-5 leading-relaxed">
          {{ store.completeModal.message }}
        </p>

        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2.5">
          <div
            class="h-full rounded-full complete-progress-bar"
            :class="store.currentBusiness === 'healthcare' ? 'bg-emerald-600' : 'bg-amber-600'"
          ></div>
        </div>
        <span class="text-xs text-slate-500">自動で次の接客入力へ切り替わります</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes shrinkScale {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.complete-progress-bar {
  transform-origin: left center;
  animation: shrinkScale 1.5s linear forwards;
}
</style>
