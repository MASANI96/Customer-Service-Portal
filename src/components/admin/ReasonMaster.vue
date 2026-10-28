<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-vue-next';
import type { ReasonOptionConfig } from '@/types';
import { useAppStore } from '@/stores/appStore';

const store = useAppStore();

const editableMap = reactive<Record<string, ReasonOptionConfig[]>>({});
const selectedItemKey = ref<string>('');

const eligibleItems = computed(() =>
  (store.itemMasters[store.currentBusiness] || []).filter(
    (it) => it.isActive && it.options.some((o) => o.isReasonTrigger)
  )
);

function loadFromStore() {
  Object.keys(editableMap).forEach((k) => delete editableMap[k]);
  const src = store.reasonMasters[store.currentBusiness] || {};
  for (const [k, arr] of Object.entries(src)) {
    editableMap[k] = arr.map((r) => ({ ...r }));
  }
}

watch(
  () => [store.currentBusiness, store.resetVersion],
  () => {
    loadFromStore();
  },
  { immediate: true }
);

watch(
  eligibleItems,
  (list) => {
    if (list.length > 0 && !list.some((it) => it.key === selectedItemKey.value)) {
      selectedItemKey.value = list[0].key;
    } else if (list.length === 0) {
      selectedItemKey.value = '';
    }
    if (selectedItemKey.value && !editableMap[selectedItemKey.value]) {
      editableMap[selectedItemKey.value] = [];
    }
  },
  { immediate: true }
);

const currentReasonList = computed<ReasonOptionConfig[]>(() => {
  if (!selectedItemKey.value) return [];
  if (!editableMap[selectedItemKey.value]) {
    editableMap[selectedItemKey.value] = [];
  }
  return editableMap[selectedItemKey.value];
});

function silentSyncIfValid() {
  for (const list of Object.values(editableMap)) {
    if (list.some((r) => !r.text.trim())) return;
  }
  const out: Record<string, ReasonOptionConfig[]> = {};
  for (const [k, list] of Object.entries(editableMap)) {
    out[k] = list.map((r, i) => ({
      text: r.text.trim(),
      order: i + 1,
      isActive: r.isActive,
    }));
  }
  store.reasonMasters[store.currentBusiness] = out;
}

function addReason() {
  if (!selectedItemKey.value) return;
  if (!editableMap[selectedItemKey.value]) {
    editableMap[selectedItemKey.value] = [];
  }
  const nextIdx = editableMap[selectedItemKey.value].length + 1;
  editableMap[selectedItemKey.value].push({
    text: `新規理由 ${nextIdx}`,
    order: nextIdx,
    isActive: true,
  });
  silentSyncIfValid();
}

function removeReason(idx: number) {
  if (!selectedItemKey.value) return;
  editableMap[selectedItemKey.value].splice(idx, 1);
  editableMap[selectedItemKey.value].forEach((r, i) => {
    r.order = i + 1;
  });
  silentSyncIfValid();
}

function moveReason(idx: number, direction: -1 | 1) {
  if (!selectedItemKey.value) return;
  const list = editableMap[selectedItemKey.value];
  const target = idx + direction;
  if (target < 0 || target >= list.length) return;
  const temp = list[idx];
  list[idx] = list[target];
  list[target] = temp;
  list.forEach((r, i) => {
    r.order = i + 1;
  });
  silentSyncIfValid();
}

function toggleActive(r: ReasonOptionConfig) {
  r.isActive = !r.isActive;
  silentSyncIfValid();
}

function handleSave() {
  store.updateReasonMaster(store.currentBusiness, editableMap);
}
</script>

<template>
  <div class="space-y-4">
    <!-- ヘッダーバー -->
    <div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-slate-900">
          未提案理由マスタ設定（{{ store.businessShortLabel }}・項目別）
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">
          「未提案」選択時に展開される理由選択肢を項目ごとにカスタマイズできます。
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          :disabled="!selectedItemKey"
          @click="addReason"
          class="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          <Plus class="w-4 h-4 shrink-0" />
          <span>理由を追加</span>
        </button>

        <button
          type="button"
          @click="handleSave"
          class="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer"
        >
          <Check class="w-4 h-4 shrink-0" />
          <span>理由マスタを保存</span>
        </button>
      </div>
    </div>

    <!-- 対象項目セレクタ -->
    <div class="bg-white rounded-xl p-4 border border-slate-200">
      <div v-if="eligibleItems.length > 0" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <label for="reason-item-select" class="text-xs font-bold text-slate-700 shrink-0">
            編集対象項目:
          </label>
          <select
            id="reason-item-select"
            v-model="selectedItemKey"
            class="px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none cursor-pointer"
          >
            <option v-for="item in eligibleItems" :key="item.key" :value="item.key">
              {{ item.label }}（キー: {{ item.key }}）
            </option>
          </select>
        </div>
        <span class="text-xs text-slate-500">
          未提案理由トリガーが有効な項目が自動表示されます
        </span>
      </div>

      <div v-else class="py-6 text-center text-xs text-slate-500">
        未提案理由トリガーが設定された有効項目がありません。「入力項目・選択肢」タブでトリガーを有効化してください。
      </div>
    </div>

    <!-- 理由リスト -->
    <div v-if="selectedItemKey" class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 space-y-2.5">
      <div class="text-xs font-bold text-slate-500 mb-2">
        登録済み理由（{{ currentReasonList.length }}件）
      </div>

      <div
        v-for="(r, idx) in currentReasonList"
        :key="idx"
        class="p-3 rounded-xl border flex items-center justify-between gap-3"
        :class="r.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'"
      >
        <div class="flex items-center gap-2.5 flex-1">
          <div class="flex flex-col gap-0.5">
            <button
              type="button"
              :disabled="idx === 0"
              @click="moveReason(idx, -1)"
              class="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
            >
              <ChevronUp class="w-4 h-4" />
            </button>
            <button
              type="button"
              :disabled="idx === currentReasonList.length - 1"
              @click="moveReason(idx, 1)"
              class="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
            >
              <ChevronDown class="w-4 h-4" />
            </button>
          </div>

          <span class="text-xs font-mono text-slate-400 w-6">{{ idx + 1 }}.</span>

          <input
            type="text"
            v-model="r.text"
            @input="silentSyncIfValid"
            placeholder="未提案理由テキスト"
            class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            @click="toggleActive(r)"
            class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer"
            :class="
              r.isActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            "
          >
            {{ r.isActive ? '有効' : '無効' }}
          </button>

          <button
            type="button"
            @click="removeReason(idx)"
            class="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
            title="削除"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-if="currentReasonList.length === 0" class="py-6 text-center text-xs text-slate-500">
        未提案理由がまだありません。右上の「理由を追加」から作成してください。
      </div>
    </div>
  </div>
</template>
