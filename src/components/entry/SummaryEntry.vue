<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { AlertTriangle, CheckCircle2, Minus, Plus, RotateCcw, Send, Sparkles } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { formatDateKey } from '@/utils/dateUtils';

const store = useAppStore();
const todayIso = formatDateKey(new Date());

const targetDate = ref<string>(todayIso);
const totalCount = ref<number | string>('');
const counts = reactive<Record<string, Record<string, number>>>({});
const reasonCounts = reactive<Record<string, Record<string, number>>>({});
const totalAmount = ref<number | string>('');
const formError = ref<string>('');

function initSummaryState() {
  targetDate.value = todayIso;
  totalCount.value = '';
  totalAmount.value = '';
  formError.value = '';

  Object.keys(counts).forEach((k) => delete counts[k]);
  Object.keys(reasonCounts).forEach((k) => delete reasonCounts[k]);

  for (const field of store.currentActiveItems) {
    counts[field.key] = {};
    for (const opt of field.options) {
      counts[field.key][opt.text] = 0;
    }
    reasonCounts[field.key] = {};
    for (const r of store.currentActiveReasonsMap[field.key] || []) {
      reasonCounts[field.key][r.text] = 0;
    }
  }
}

watch(
  () => [store.currentBusiness, store.currentActiveItems, store.currentActiveReasonsMap],
  () => {
    initSummaryState();
  },
  { immediate: true, deep: true }
);

function adjustOptionCount(fieldKey: string, optText: string, delta: number) {
  if (!counts[fieldKey]) counts[fieldKey] = {};
  const curr = Number(counts[fieldKey][optText]) || 0;
  counts[fieldKey][optText] = Math.max(0, curr + delta);
}

function adjustReasonCount(fieldKey: string, rText: string, delta: number) {
  if (!reasonCounts[fieldKey]) reasonCounts[fieldKey] = {};
  const curr = Number(reasonCounts[fieldKey][rText]) || 0;
  reasonCounts[fieldKey][rText] = Math.max(0, curr + delta);
}

// デモプレゼン用ワンクリックサンプル入力（整合性一致状態）
function fillSampleSummary() {
  totalCount.value = 8;
  for (const field of store.currentActiveItems) {
    if (!counts[field.key]) counts[field.key] = {};
    const opts = field.options;
    opts.forEach((opt, idx) => {
      if (idx === 0) counts[field.key][opt.text] = 5;
      else if (idx === 1) counts[field.key][opt.text] = 2;
      else if (idx === 2) counts[field.key][opt.text] = 1;
      else counts[field.key][opt.text] = 0;
    });

    const unproposedSum = opts
      .filter((o) => o.isReasonTrigger)
      .reduce((acc, o) => acc + (counts[field.key][o.text] || 0), 0);

    const rList = store.currentActiveReasonsMap[field.key] || [];
    if (!reasonCounts[field.key]) reasonCounts[field.key] = {};
    rList.forEach((r, idx) => {
      reasonCounts[field.key][r.text] = idx === 0 ? unproposedSum : 0;
    });
  }
  if (store.currentBusiness === 'reuse') {
    totalAmount.value = 320000;
  }
  formError.value = '';
}

const needsTotalAmount = computed(() => {
  if (store.currentBusiness !== 'reuse') return false;
  for (const field of store.currentActiveItems) {
    const fCounts = counts[field.key] || {};
    for (const opt of field.options) {
      if (opt.isAmountTrigger && (Number(fCounts[opt.text]) || 0) > 0) {
        return true;
      }
    }
  }
  return false;
});

interface FieldReasonValidationDetail {
  unproposedCount: number;
  reasonSum: number;
  diff: number;
  isValid: boolean;
  errorText: string;
}

const reasonValidation = computed(() => {
  const details: Record<string, FieldReasonValidationDetail> = {};
  let hasAnyError = false;

  for (const field of store.currentActiveItems) {
    const hasReasonTrigger = field.options.some((o) => o.isReasonTrigger);
    const activeReasons = store.currentActiveReasonsMap[field.key] || [];
    if (!hasReasonTrigger || activeReasons.length === 0) continue;

    const fCounts = counts[field.key] || {};
    const fReasons = reasonCounts[field.key] || {};

    const unproposedCount = field.options
      .filter((o) => o.isReasonTrigger)
      .reduce((sum, o) => sum + (Math.max(0, Number(fCounts[o.text]) || 0)), 0);

    const reasonSum = activeReasons.reduce(
      (sum, r) => sum + (Math.max(0, Number(fReasons[r.text]) || 0)),
      0
    );

    const diff = reasonSum - unproposedCount;
    const isValid = diff === 0;
    if (!isValid) hasAnyError = true;

    const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
    details[field.key] = {
      unproposedCount,
      reasonSum,
      diff,
      isValid,
      errorText: isValid
        ? ''
        : `未提案数（${unproposedCount}件）と理由内訳の合計（${reasonSum}件）が一致していません（差: ${diffLabel}件）`,
    };
  }

  return {
    details,
    hasAnyError,
  };
});

const isFormSubmittable = computed(() => {
  const parsedTotal = totalCount.value === '' ? NaN : Number(totalCount.value);
  if (Number.isNaN(parsedTotal) || !Number.isInteger(parsedTotal) || parsedTotal <= 0) {
    return false;
  }
  if (reasonValidation.value.hasAnyError) {
    return false;
  }
  if (needsTotalAmount.value) {
    const parsedAmt = totalAmount.value === '' ? NaN : Number(totalAmount.value);
    if (Number.isNaN(parsedAmt) || !Number.isInteger(parsedAmt) || parsedAmt < 0) {
      return false;
    }
  }
  return true;
});

function handleSubmit() {
  formError.value = '';
  const parsedTotal = totalCount.value === '' ? NaN : Number(totalCount.value);
  if (Number.isNaN(parsedTotal) || !Number.isInteger(parsedTotal) || parsedTotal <= 0) {
    formError.value = '本日の総対応件数を1以上の整数で入力してください。';
    return;
  }
  if (reasonValidation.value.hasAnyError) {
    formError.value = '未提案数合計と理由内訳件数の合計が一致していない項目があります。';
    return;
  }
  if (needsTotalAmount.value) {
    const parsedAmt = totalAmount.value === '' ? NaN : Number(totalAmount.value);
    if (Number.isNaN(parsedAmt) || !Number.isInteger(parsedAmt) || parsedAmt < 0) {
      formError.value = '成約件数が1件以上あるため、買取成約総額（税込）を入力してください。';
      return;
    }
  }

  store.addDailySummaryRecords({
    targetDate: targetDate.value,
    totalCount: parsedTotal,
    counts: JSON.parse(JSON.stringify(counts)),
    reasonCounts: JSON.parse(JSON.stringify(reasonCounts)),
    totalAmount: needsTotalAmount.value ? Number(totalAmount.value) : 0,
  });

  initSummaryState();
}
</script>

<template>
  <form @submit.prevent="handleSubmit" novalidate class="space-y-4">
    <!-- 上部：対象日 ＆ サンプル自動セット -->
    <div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <label for="summary-target-date" class="block text-sm font-bold text-slate-900 mb-1.5">
          集計対象日（日次サマリー入力）
        </label>
        <input
          id="summary-target-date"
          type="date"
          v-model="targetDate"
          :max="todayIso"
          class="w-full sm:w-60 min-h-[42px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums font-semibold text-slate-900 focus:bg-white focus:border-slate-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        @click="fillSampleSummary"
        class="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
      >
        <Sparkles class="w-3.5 h-3.5 shrink-0 text-slate-500" />
        <span>デモ用サンプル値を自動入力</span>
      </button>
    </div>

    <!-- 総対応件数 -->
    <div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200">
      <div class="flex items-center justify-between mb-1.5">
        <label for="summary-total-count" class="text-sm sm:text-base font-bold text-slate-900">
          本日の総対応件数
        </label>
        <span class="text-xs font-medium text-rose-600">必須</span>
      </div>
      <p class="text-xs text-slate-500 mb-3">
        1日の接客総件数を入力してください（ダッシュボードの総接客数へ合算されます）。
      </p>

      <div class="flex items-center gap-2 max-w-xs">
        <button
          type="button"
          @click="totalCount = Math.max(0, (Number(totalCount) || 0) - 1)"
          class="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
          aria-label="総対応件数を減らす"
        >
          <Minus class="w-4 h-4" />
        </button>
        <div class="relative flex-1">
          <input
            id="summary-total-count"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            v-model="totalCount"
            placeholder="0"
            class="w-full h-11 px-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-center text-base font-mono tabular-nums font-bold text-slate-900 focus:bg-white focus:border-slate-500 focus:outline-none"
          />
          <span class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500">
            件
          </span>
        </div>
        <button
          type="button"
          @click="totalCount = (Number(totalCount) || 0) + 1"
          class="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
          aria-label="総対応件数を増やす"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- 各項目ステッパー＆未提案理由整合性チェック -->
    <section
      v-for="(field, idx) in store.currentActiveItems"
      :key="'sum_' + field.key"
      class="bg-white rounded-xl p-4 sm:p-5 border transition-colors"
      :class="
        reasonValidation.details[field.key] && !reasonValidation.details[field.key].isValid
          ? 'border-rose-400 bg-rose-50/10'
          : 'border-slate-200'
      "
    >
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm sm:text-base font-bold text-slate-900">
          0{{ idx + 1 }}. {{ field.label }}
        </h2>
        <span class="text-xs text-slate-500">選択肢ごとの件数</span>
      </div>

      <!-- 選択肢ごとの件数ステッパー -->
      <div class="space-y-2">
        <div
          v-for="opt in field.options"
          :key="opt.text"
          class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs sm:text-sm font-semibold text-slate-800">{{ opt.text }}</span>
            <span v-if="opt.isReasonTrigger" class="text-xs text-rose-600 font-medium">
              · 理由内訳対象
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="adjustOptionCount(field.key, opt.text, -1)"
              class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
              :aria-label="`${opt.text}を減らす`"
            >
              <Minus class="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              v-model.number="counts[field.key][opt.text]"
              class="w-16 h-9 text-center bg-white border border-slate-200 rounded-lg text-sm font-mono tabular-nums font-bold text-slate-900 focus:outline-none"
            />
            <button
              type="button"
              @click="adjustOptionCount(field.key, opt.text, 1)"
              class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
              :aria-label="`${opt.text}を増やす`"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
            <span class="text-xs text-slate-500 pl-0.5">件</span>
          </div>
        </div>
      </div>

      <!-- 未提案理由の内訳件数（リアルタイム整合性検証） -->
      <div
        v-if="
          field.options.some((o) => o.isReasonTrigger) &&
          (store.currentActiveReasonsMap[field.key] || []).length > 0
        "
        class="mt-4 pt-4 border-t border-slate-200"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h3 class="text-xs sm:text-sm font-bold text-slate-800">
            「{{ field.label }}」未提案理由の内訳件数
          </h3>

          <div
            v-if="reasonValidation.details[field.key]"
            class="flex items-center gap-1.5 text-xs font-semibold tabular-nums"
            :class="
              reasonValidation.details[field.key].isValid ? 'text-emerald-700' : 'text-rose-600'
            "
          >
            <CheckCircle2
              v-if="reasonValidation.details[field.key].isValid"
              class="w-4 h-4 shrink-0 text-emerald-600"
            />
            <AlertTriangle v-else class="w-4 h-4 shrink-0 text-rose-600" />
            <span v-if="reasonValidation.details[field.key].isValid">
              合計一致（{{ reasonValidation.details[field.key].unproposedCount }}件）
            </span>
            <span v-else>
              不一致（未提案 {{ reasonValidation.details[field.key].unproposedCount }}件 / 内訳計
              {{ reasonValidation.details[field.key].reasonSum }}件）
            </span>
          </div>
        </div>

        <div class="space-y-1.5">
          <div
            v-for="r in store.currentActiveReasonsMap[field.key] || []"
            :key="r.text"
            class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-200/80"
          >
            <span class="text-xs font-medium text-slate-700 truncate pr-2">{{ r.text }}</span>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                @click="adjustReasonCount(field.key, r.text, -1)"
                class="w-8 h-8 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <Minus class="w-3 h-3" />
              </button>
              <input
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                v-model.number="reasonCounts[field.key][r.text]"
                class="w-14 h-8 text-center bg-white border border-slate-200 rounded-md text-xs font-mono tabular-nums font-bold text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                @click="adjustReasonCount(field.key, r.text, 1)"
                class="w-8 h-8 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
              </button>
              <span class="text-xs text-slate-500">件</span>
            </div>
          </div>
        </div>

        <div
          v-if="reasonValidation.details[field.key] && !reasonValidation.details[field.key].isValid"
          class="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2"
        >
          <AlertTriangle class="w-4 h-4 shrink-0 text-rose-600" />
          <span>{{ reasonValidation.details[field.key].errorText }}</span>
        </div>
      </div>
    </section>

    <!-- リユース成約あり時の買取成約総額 -->
    <Transition name="expand">
      <div
        v-if="needsTotalAmount && store.currentBusiness === 'reuse'"
        class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200"
      >
        <div class="flex items-center justify-between mb-1.5">
          <label for="summary-total-amount" class="text-sm sm:text-base font-bold text-slate-900">
            本日の買取成約総額（税込）
          </label>
          <span class="text-xs font-medium text-rose-600">必須</span>
        </div>
        <p class="text-xs text-slate-500 mb-3">
          成約が1件以上あるため、本日の成約金額合計を入力してください。
        </p>
        <div class="relative max-w-sm">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-mono font-bold">
            ¥
          </span>
          <input
            id="summary-total-amount"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            v-model="totalAmount"
            placeholder="例: 240000"
            class="w-full min-h-[44px] pl-9 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono tabular-nums font-bold text-slate-900 focus:bg-white focus:border-amber-600 focus:outline-none"
          />
          <span class="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-500">
            円
          </span>
        </div>
      </div>
    </Transition>

    <div
      v-if="formError"
      class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2"
    >
      <AlertTriangle class="w-4 h-4 shrink-0 text-rose-600" />
      <span>{{ formError }}</span>
    </div>

    <!-- 送信バー -->
    <div class="pt-2 flex items-center gap-3">
      <button
        type="button"
        @click="initSummaryState"
        class="min-h-[48px] px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <RotateCcw class="w-4 h-4 shrink-0" />
        <span>リセット</span>
      </button>

      <button
        type="submit"
        :disabled="!isFormSubmittable"
        class="min-h-[48px] flex-1 py-3 px-6 rounded-xl font-bold text-white text-sm sm:text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
        :class="
          store.currentBusiness === 'healthcare'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-amber-600 hover:bg-amber-700'
        "
      >
        <Send class="w-4 h-4 shrink-0" />
        <span>日次集計をダッシュボードへ反映する</span>
      </button>
    </div>
  </form>
</template>
