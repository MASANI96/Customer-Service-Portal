<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { AlertCircle, Check, RotateCcw, Send } from 'lucide-vue-next';
import type { ItemOptionConfig } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { formatDateKey } from '@/utils/dateUtils';

const store = useAppStore();

const todayIso = formatDateKey(new Date());
const answers = reactive<Record<string, string>>({});
const reasons = reactive<Record<string, string>>({});
const amount = ref<number | string>('');
const errors = reactive<Record<string, string>>({});

function syncAnswerKeys() {
  for (const field of store.currentActiveItems) {
    if (!(field.key in answers)) answers[field.key] = '';
    if (!(field.key in reasons)) reasons[field.key] = '';
  }
}

watch(
  () => [store.currentBusiness, store.currentActiveItems],
  () => {
    resetForm();
  },
  { immediate: true, deep: true }
);

const selectedOptionsMap = computed(() => {
  const map: Record<string, ItemOptionConfig> = {};
  for (const field of store.currentActiveItems) {
    const val = answers[field.key];
    if (val) {
      const opt = field.options.find((o) => o.text === val);
      if (opt) map[field.key] = opt;
    }
  }
  return map;
});

const needsAmount = computed(() => {
  if (store.currentBusiness !== 'reuse') return false;
  return Object.values(selectedOptionsMap.value).some((opt) => opt.isAmountTrigger);
});

function isReasonTriggered(fieldKey: string): boolean {
  return Boolean(selectedOptionsMap.value[fieldKey]?.isReasonTrigger);
}

function selectOption(fieldKey: string, opt: ItemOptionConfig) {
  answers[fieldKey] = opt.text;
  delete errors[fieldKey];

  if (!opt.isReasonTrigger) {
    reasons[fieldKey] = '';
    delete errors[`reason_${fieldKey}`];
  }

  if (!needsAmount.value) {
    amount.value = '';
    delete errors.amount;
  }
}

function selectReason(fieldKey: string, reasonText: string) {
  reasons[fieldKey] = reasonText;
  delete errors[`reason_${fieldKey}`];
}

function resetForm() {
  Object.keys(answers).forEach((k) => delete answers[k]);
  Object.keys(reasons).forEach((k) => delete reasons[k]);
  Object.keys(errors).forEach((k) => delete errors[k]);
  amount.value = '';
  syncAnswerKeys();
}

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k]);
  let valid = true;

  for (const field of store.currentActiveItems) {
    if (field.options.length === 0) continue;
    if (!answers[field.key]) {
      errors[field.key] = `「${field.label}」を選択してください`;
      valid = false;
    } else if (isReasonTriggered(field.key)) {
      const availableReasons = store.currentActiveReasonsMap[field.key] || [];
      if (availableReasons.length > 0 && !reasons[field.key]) {
        errors[`reason_${field.key}`] = '未提案の理由を選択してください';
        valid = false;
      }
    }
  }

  if (needsAmount.value && store.currentBusiness === 'reuse') {
    const parsed = amount.value === '' ? NaN : Number(amount.value);
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      errors.amount = '買取金額を0以上の整数で入力してください';
      valid = false;
    }
  }

  return valid;
}

function handleSubmit() {
  if (!validate()) return;

  store.addSingleRecord({
    targetDate: todayIso,
    answers: { ...answers },
    reasons: { ...reasons },
    amount: needsAmount.value ? Number(amount.value) : null,
  });

  resetForm();
}
</script>

<template>
  <form @submit.prevent="handleSubmit" novalidate class="space-y-4">
    <div
      v-if="store.currentActiveItems.length === 0"
      class="bg-white rounded-xl p-8 text-center border border-slate-200"
    >
      <p class="text-sm font-semibold text-slate-700 mb-2">有効な入力項目がありません</p>
      <p class="text-xs text-slate-500 mb-4">
        マスタ管理ポータルから入力項目を有効化または追加してください。
      </p>
      <button
        type="button"
        @click="store.currentView = 'admin'"
        class="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
      >
        マスタ管理ポータルを開く
      </button>
    </div>

    <section
      v-for="(field, index) in store.currentActiveItems"
      :key="field.key"
      class="bg-white rounded-xl p-4 sm:p-5 border transition-colors"
      :class="
        errors[field.key] || errors['reason_' + field.key]
          ? 'border-rose-400 bg-rose-50/10'
          : 'border-slate-200'
      "
    >
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm sm:text-base font-bold text-slate-900">
          0{{ index + 1 }}. {{ field.label }}
        </h2>
        <span class="text-xs font-medium text-rose-600">必須</span>
      </div>

      <!-- 選択肢ボタングループ -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          v-for="opt in field.options"
          :key="opt.text"
          type="button"
          @click="selectOption(field.key, opt)"
          class="min-h-[46px] flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer select-none"
          :class="
            answers[field.key] === opt.text
              ? store.currentBusiness === 'healthcare'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-amber-600 text-white border-amber-600'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
          "
        >
          <span class="text-sm font-semibold">{{ opt.text }}</span>
          <span
            class="w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ml-2"
            :class="
              answers[field.key] === opt.text
                ? 'border-white bg-white/20 text-white'
                : 'border-slate-300 text-transparent'
            "
          >
            <Check class="w-3.5 h-3.5 stroke-[3]" />
          </span>
        </button>
      </div>

      <p v-if="errors[field.key]" class="mt-2.5 text-xs font-medium text-rose-600 flex items-center gap-1.5">
        <AlertCircle class="w-3.5 h-3.5 shrink-0" />
        <span>{{ errors[field.key] }}</span>
      </p>

      <!-- 未提案理由アコーディオン展開 -->
      <Transition name="expand">
        <div
          v-if="isReasonTriggered(field.key)"
          class="mt-4 pt-3.5 border-t border-slate-200"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-bold text-slate-800">
              「{{ field.label }}」の未提案理由を選択
            </h3>
            <span class="text-xs font-medium text-rose-600">必須</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in store.currentActiveReasonsMap[field.key] || []"
              :key="r.text"
              type="button"
              @click="selectReason(field.key, r.text)"
              class="min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors cursor-pointer"
              :class="
                reasons[field.key] === r.text
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              "
            >
              {{ r.text }}
            </button>
            <p
              v-if="!(store.currentActiveReasonsMap[field.key] || []).length"
              class="text-xs text-slate-500 py-1"
            >
              未提案理由マスタが未登録です（このまま送信可能です）
            </p>
          </div>

          <p
            v-if="errors['reason_' + field.key]"
            class="mt-2 text-xs font-medium text-rose-600 flex items-center gap-1.5"
          >
            <AlertCircle class="w-3.5 h-3.5 shrink-0" />
            <span>{{ errors['reason_' + field.key] }}</span>
          </p>
        </div>
      </Transition>
    </section>

    <!-- リユースモデル「成約」時の買取金額（税込）入力欄 -->
    <Transition name="expand">
      <section
        v-if="needsAmount && store.currentBusiness === 'reuse'"
        class="bg-white rounded-xl p-4 sm:p-5 border transition-colors"
        :class="errors.amount ? 'border-rose-400 bg-rose-50/10' : 'border-slate-200'"
      >
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm sm:text-base font-bold text-slate-900">買取金額（税込）</h2>
          <span class="text-xs font-medium text-rose-600">必須</span>
        </div>
        <p class="text-xs text-slate-500 mb-3">
          成約した買取金額を半角数字（0以上の整数）で入力してください。
        </p>

        <div class="flex items-center gap-2 mb-2.5 flex-wrap">
          <button
            v-for="presetAmt in [15000, 35000, 80000, 150000]"
            :key="presetAmt"
            type="button"
            @click="
              amount = presetAmt;
              delete errors.amount;
            "
            class="px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
          >
            ¥{{ presetAmt.toLocaleString() }}
          </button>
        </div>

        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-mono font-bold">
            ¥
          </span>
          <input
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            v-model="amount"
            placeholder="例: 45000"
            class="w-full min-h-[46px] pl-9 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono tabular-nums font-bold text-slate-900 focus:bg-white focus:border-amber-600 focus:outline-none"
          />
          <span class="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-500">
            円
          </span>
        </div>

        <p v-if="errors.amount" class="mt-2 text-xs font-medium text-rose-600 flex items-center gap-1.5">
          <AlertCircle class="w-3.5 h-3.5 shrink-0" />
          <span>{{ errors.amount }}</span>
        </p>
      </section>
    </Transition>

    <!-- アクションバー -->
    <div
      v-if="store.currentActiveItems.length > 0"
      class="pt-2 flex items-center gap-3"
    >
      <button
        type="button"
        @click="resetForm"
        class="min-h-[48px] px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <RotateCcw class="w-4 h-4 shrink-0" />
        <span>クリア</span>
      </button>

      <button
        type="submit"
        class="min-h-[48px] flex-1 py-3 px-6 rounded-xl font-bold text-white text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer"
        :class="
          store.currentBusiness === 'healthcare'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-amber-600 hover:bg-amber-700'
        "
      >
        <Send class="w-4 h-4 shrink-0" />
        <span>接客実績を登録する</span>
      </button>
    </div>
  </form>
</template>
