<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { AlertCircle, Copy, Plus, RotateCcw, Send, Trash2 } from 'lucide-vue-next';
import type { ItemOptionConfig } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { formatDateKey, generateUuid } from '@/utils/dateUtils';

interface BatchRowItem {
  id: string;
  answers: Record<string, string>;
  reasons: Record<string, string>;
  amount: number | string;
}

const store = useAppStore();
const todayIso = formatDateKey(new Date());
const targetDate = ref<string>(todayIso);
const rows = ref<BatchRowItem[]>([]);
const errors = reactive<Record<string, string>>({});

function createEmptyRow(): BatchRowItem {
  const ans: Record<string, string> = {};
  const rsn: Record<string, string> = {};
  for (const field of store.currentActiveItems) {
    ans[field.key] = '';
    rsn[field.key] = '';
  }
  return {
    id: generateUuid('row'),
    answers: ans,
    reasons: rsn,
    amount: '',
  };
}

function resetBatchForm() {
  targetDate.value = todayIso;
  rows.value = [createEmptyRow(), createEmptyRow()];
  Object.keys(errors).forEach((k) => delete errors[k]);
}

watch(
  () => [store.currentBusiness, store.currentActiveItems],
  () => {
    resetBatchForm();
  },
  { immediate: true, deep: true }
);

function addRow() {
  rows.value.push(createEmptyRow());
}

function duplicateRow(index: number) {
  const src = rows.value[index];
  if (!src) return;
  rows.value.splice(index + 1, 0, {
    id: generateUuid('row'),
    answers: { ...src.answers },
    reasons: { ...src.reasons },
    amount: src.amount,
  });
}

function removeRow(index: number) {
  if (rows.value.length <= 1) return;
  rows.value.splice(index, 1);
  Object.keys(errors).forEach((k) => delete errors[k]);
}

function isRowReasonTriggered(row: BatchRowItem, fieldKey: string): boolean {
  const val = row.answers[fieldKey];
  if (!val) return false;
  const field = store.currentActiveItems.find((f) => f.key === fieldKey);
  const opt = field?.options.find((o) => o.text === val);
  return Boolean(opt?.isReasonTrigger);
}

function isRowAmountTriggered(row: BatchRowItem): boolean {
  if (store.currentBusiness !== 'reuse') return false;
  for (const field of store.currentActiveItems) {
    const val = row.answers[field.key];
    if (val) {
      const opt = field.options.find((o) => o.text === val);
      if (opt?.isAmountTrigger) return true;
    }
  }
  return false;
}

function selectRowOption(rowIndex: number, fieldKey: string, opt: ItemOptionConfig) {
  const row = rows.value[rowIndex];
  if (!row) return;
  row.answers[fieldKey] = opt.text;
  delete errors[`${rowIndex}_${fieldKey}`];

  if (!opt.isReasonTrigger) {
    row.reasons[fieldKey] = '';
    delete errors[`${rowIndex}_reason_${fieldKey}`];
  }

  if (!isRowAmountTriggered(row)) {
    row.amount = '';
    delete errors[`${rowIndex}_amount`];
  }
}

function selectRowReason(rowIndex: number, fieldKey: string, rText: string) {
  const row = rows.value[rowIndex];
  if (!row) return;
  row.reasons[fieldKey] = rText;
  delete errors[`${rowIndex}_reason_${fieldKey}`];
}

function validateBatch(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k]);
  let valid = true;

  if (!targetDate.value) {
    errors.targetDate = '対象日を指定してください';
    valid = false;
  }

  rows.value.forEach((row, idx) => {
    for (const field of store.currentActiveItems) {
      if (field.options.length === 0) continue;
      if (!row.answers[field.key]) {
        errors[`${idx}_${field.key}`] = `「${field.label}」を選択してください`;
        valid = false;
      } else if (isRowReasonTriggered(row, field.key)) {
        const availableReasons = store.currentActiveReasonsMap[field.key] || [];
        if (availableReasons.length > 0 && !row.reasons[field.key]) {
          errors[`${idx}_reason_${field.key}`] = '未提案理由を選択してください';
          valid = false;
        }
      }
    }

    if (isRowAmountTriggered(row) && store.currentBusiness === 'reuse') {
      const parsed = row.amount === '' ? NaN : Number(row.amount);
      if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        errors[`${idx}_amount`] = '買取金額を0以上の整数で入力してください';
        valid = false;
      }
    }
  });

  return valid;
}

function handleSubmit() {
  if (!validateBatch()) return;

  store.addBatchRecords({
    targetDate: targetDate.value,
    rows: rows.value.map((r) => ({
      answers: { ...r.answers },
      reasons: { ...r.reasons },
      amount: isRowAmountTriggered(r) ? Number(r.amount) : null,
    })),
  });

  resetBatchForm();
}
</script>

<template>
  <form @submit.prevent="handleSubmit" novalidate class="space-y-4">
    <!-- 対象日カード -->
    <div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200">
      <div class="flex items-center justify-between mb-2">
        <label for="batch-target-date" class="text-sm font-bold text-slate-900">
          対象対応日（同一日付の複数明細を一括登録）
        </label>
        <span class="text-xs font-medium text-rose-600">必須</span>
      </div>
      <input
        id="batch-target-date"
        type="date"
        v-model="targetDate"
        :max="todayIso"
        class="w-full sm:w-64 min-h-[44px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums font-semibold text-slate-900 focus:bg-white focus:border-slate-500 focus:outline-none"
      />
      <p v-if="errors.targetDate" class="mt-1.5 text-xs font-medium text-rose-600">
        {{ errors.targetDate }}
      </p>
    </div>

    <!-- 明細行ループ -->
    <section
      v-for="(row, rowIdx) in rows"
      :key="row.id"
      class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 space-y-4"
    >
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <span
            class="px-2.5 py-1 rounded-md text-xs font-mono tabular-nums font-bold text-white"
            :class="store.currentBusiness === 'healthcare' ? 'bg-emerald-600' : 'bg-amber-600'"
          >
            明細 {{ rowIdx + 1 }}
          </span>
          <span class="text-sm font-bold text-slate-900">接客レコード</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="duplicateRow(rowIdx)"
            class="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Copy class="w-3.5 h-3.5 shrink-0" />
            <span>複製</span>
          </button>

          <button
            type="button"
            @click="removeRow(rowIdx)"
            :disabled="rows.length <= 1"
            class="min-h-[36px] px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-xs font-semibold text-rose-600 flex items-center gap-1 transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5 shrink-0" />
            <span>削除</span>
          </button>
        </div>
      </div>

      <div
        v-for="(field, fIdx) in store.currentActiveItems"
        :key="row.id + '_' + field.key"
        :class="fIdx > 0 ? 'pt-3.5 border-t border-slate-100' : ''"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs sm:text-sm font-bold text-slate-800">{{ field.label }}</span>
          <span v-if="errors[`${rowIdx}_${field.key}`]" class="text-xs font-medium text-rose-600">
            未選択
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            v-for="opt in field.options"
            :key="opt.text"
            type="button"
            @click="selectRowOption(rowIdx, field.key, opt)"
            class="min-h-[42px] px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            :class="
              row.answers[field.key] === opt.text
                ? store.currentBusiness === 'healthcare'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-amber-600 text-white border-amber-600'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            "
          >
            {{ opt.text }}
          </button>
        </div>

        <p
          v-if="errors[`${rowIdx}_${field.key}`]"
          class="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1"
        >
          <AlertCircle class="w-3.5 h-3.5 shrink-0" />
          <span>{{ errors[`${rowIdx}_${field.key}`] }}</span>
        </p>

        <Transition name="expand">
          <div
            v-if="isRowReasonTriggered(row, field.key)"
            class="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-slate-700">
                「{{ field.label }}」の未提案理由
              </span>
              <span class="text-xs font-medium text-rose-600">必須</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="r in store.currentActiveReasonsMap[field.key] || []"
                :key="r.text"
                type="button"
                @click="selectRowReason(rowIdx, field.key, r.text)"
                class="min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer"
                :class="
                  row.reasons[field.key] === r.text
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                "
              >
                {{ r.text }}
              </button>
            </div>
            <p
              v-if="errors[`${rowIdx}_reason_${field.key}`]"
              class="mt-1.5 text-xs font-medium text-rose-600"
            >
              {{ errors[`${rowIdx}_reason_${field.key}`] }}
            </p>
          </div>
        </Transition>
      </div>

      <!-- 買取金額入力（リユース成約時） -->
      <Transition name="expand">
        <div
          v-if="isRowAmountTriggered(row) && store.currentBusiness === 'reuse'"
          class="pt-3.5 border-t border-slate-100"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs sm:text-sm font-bold text-slate-800">買取金額（税込）</span>
            <span class="text-xs font-medium text-rose-600">必須</span>
          </div>
          <div class="relative max-w-xs">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-mono font-bold text-sm">
              ¥
            </span>
            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              v-model="row.amount"
              placeholder="例: 35000"
              class="w-full min-h-[42px] pl-8 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono tabular-nums font-bold text-slate-900 focus:bg-white focus:border-amber-600 focus:outline-none"
            />
            <span class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500">
              円
            </span>
          </div>
          <p v-if="errors[`${rowIdx}_amount`]" class="mt-1 text-xs font-medium text-rose-600">
            {{ errors[`${rowIdx}_amount`] }}
          </p>
        </div>
      </Transition>
    </section>

    <!-- 明細追加ボタン -->
    <button
      type="button"
      @click="addRow"
      class="w-full min-h-[48px] py-3.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
    >
      <Plus class="w-4 h-4 shrink-0" />
      <span>接客明細を追加（現在 {{ rows.length }}件）</span>
    </button>

    <!-- 送信バー -->
    <div class="pt-2 flex items-center gap-3">
      <button
        type="button"
        @click="resetBatchForm"
        class="min-h-[48px] px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <RotateCcw class="w-4 h-4 shrink-0" />
        <span>初期化</span>
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
        <span>{{ rows.length }}件の接客実績を一括登録する</span>
      </button>
    </div>
  </form>
</template>
