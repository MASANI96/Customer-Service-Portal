<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next';
import type { ItemMasterConfig } from '@/types';
import { RESERVED_ITEM_KEYS, useAppStore } from '@/stores/appStore';

interface EditableItem extends ItemMasterConfig {
  isOpen: boolean;
}

const store = useAppStore();

const editableItems = ref<EditableItem[]>([]);
const showAddModal = ref<boolean>(false);
const newItemForm = reactive({
  label: '',
  key: '',
  optionsText: '',
});

function loadFromStore() {
  const src = store.itemMasters[store.currentBusiness] || [];
  editableItems.value = src.map((it, idx) => ({
    key: it.key,
    label: it.label,
    order: it.order,
    isActive: it.isActive,
    isOpen: idx === 0,
    options: it.options.map((o) => ({ ...o })),
  }));
}

watch(
  () => [store.currentBusiness, store.resetVersion],
  () => {
    loadFromStore();
  },
  { immediate: true }
);

// リアルタイム自動同期（空欄編集中を除きPiniaへ即座に反映し、画面切替だけで入力・分析へ連動）
function silentSyncIfValid() {
  const list = editableItems.value;
  if (list.length === 0) return;
  for (const it of list) {
    if (!it.key.trim() || !it.label.trim() || RESERVED_ITEM_KEYS.includes(it.key.trim())) return;
    if (it.options.length === 0 || it.options.some((o) => !o.text.trim())) return;
  }

  store.itemMasters[store.currentBusiness] = list.map((it, idx) => ({
    key: it.key.trim(),
    label: it.label.trim(),
    order: idx + 1,
    isActive: it.isActive,
    options: it.options.map((opt, oIdx) => ({
      text: opt.text.trim(),
      order: oIdx + 1,
      isSuccess: Boolean(opt.isSuccess),
      isReasonTrigger: Boolean(opt.isReasonTrigger),
      isAmountTrigger: store.currentBusiness === 'healthcare' ? false : Boolean(opt.isAmountTrigger),
    })),
  }));
}

function moveItem(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= editableItems.value.length) return;
  const temp = editableItems.value[index];
  editableItems.value[index] = editableItems.value[target];
  editableItems.value[target] = temp;
  editableItems.value.forEach((it, i) => {
    it.order = i + 1;
  });
  silentSyncIfValid();
}

function toggleItemActive(item: EditableItem) {
  item.isActive = !item.isActive;
  silentSyncIfValid();
}

function addOption(item: EditableItem) {
  item.options.push({
    text: `選択肢${item.options.length + 1}`,
    order: item.options.length + 1,
    isSuccess: false,
    isReasonTrigger: false,
    isAmountTrigger: false,
  });
  item.isOpen = true;
  silentSyncIfValid();
}

function removeOption(item: EditableItem, optIdx: number) {
  if (item.options.length <= 1) {
    store.showToast('各項目には最低1つの選択肢が必要です。', 'error');
    return;
  }
  item.options.splice(optIdx, 1);
  item.options.forEach((o, i) => {
    o.order = i + 1;
  });
  silentSyncIfValid();
}

function moveOption(item: EditableItem, optIdx: number, direction: -1 | 1) {
  const target = optIdx + direction;
  if (target < 0 || target >= item.options.length) return;
  const temp = item.options[optIdx];
  item.options[optIdx] = item.options[target];
  item.options[target] = temp;
  item.options.forEach((o, i) => {
    o.order = i + 1;
  });
  silentSyncIfValid();
}

function openAddItemModal() {
  newItemForm.label = '';
  newItemForm.key = '';
  newItemForm.optionsText =
    store.currentBusiness === 'healthcare'
      ? '獲得\n提案したが未獲得\n未提案'
      : '成約\n提案したが不成立\n未提案';
  showAddModal.value = true;
}

function submitNewItem() {
  const label = newItemForm.label.trim();
  if (!label) {
    store.showToast('項目表示名を入力してください。', 'error');
    return;
  }
  const key = (newItemForm.key.trim() || label).trim();
  if (RESERVED_ITEM_KEYS.includes(key)) {
    store.showToast(`項目キー「${key}」はシステム予約語のため使用できません。`, 'error');
    return;
  }
  if (editableItems.value.some((it) => it.key === key)) {
    store.showToast(`項目キー「${key}」は既に登録されています。`, 'error');
    return;
  }

  const parsedOptions = newItemForm.optionsText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text, idx) => ({
      text,
      order: idx + 1,
      isSuccess: text === '獲得' || text === '成約' || text === '査定実施' || idx === 0,
      isReasonTrigger: text === '未提案',
      isAmountTrigger: store.currentBusiness === 'reuse' && text === '成約',
    }));

  if (parsedOptions.length === 0) {
    parsedOptions.push({
      text: '獲得',
      order: 1,
      isSuccess: true,
      isReasonTrigger: false,
      isAmountTrigger: false,
    });
  }

  editableItems.value.push({
    key,
    label,
    order: editableItems.value.length + 1,
    isActive: true,
    isOpen: true,
    options: parsedOptions,
  });

  showAddModal.value = false;
  handleExplicitSave();
}

function handleExplicitSave() {
  store.updateItemMaster(store.currentBusiness, editableItems.value);
}
</script>

<template>
  <div class="space-y-4">
    <!-- アクションバー -->
    <div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-slate-900">
          入力項目・選択肢マスタ設定（{{ store.businessShortLabel }}）
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">
          項目の追加・順序変更・有効切替・トリガー変更は、現場入力フォームと分析ダッシュボード双方へ即座に反映されます。
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="openAddItemModal"
          class="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Plus class="w-4 h-4 shrink-0" />
          <span>新規項目を追加</span>
        </button>

        <button
          type="button"
          @click="handleExplicitSave"
          class="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          :class="
            store.currentBusiness === 'healthcare'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700'
          "
        >
          <Check class="w-4 h-4 shrink-0" />
          <span>設定を保存</span>
        </button>
      </div>
    </div>

    <!-- 項目カード一覧 -->
    <div class="space-y-3">
      <div
        v-for="(item, index) in editableItems"
        :key="item.key"
        class="bg-white rounded-xl border transition-colors overflow-hidden"
        :class="item.isActive ? 'border-slate-200' : 'border-slate-300 opacity-65'"
      >
        <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 flex-1">
            <!-- 並び替えボタン -->
            <div class="flex flex-col gap-0.5">
              <button
                type="button"
                :disabled="index === 0"
                @click="moveItem(index, -1)"
                class="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-25 cursor-pointer"
                title="上へ移動"
              >
                <ChevronUp class="w-4 h-4" />
              </button>
              <button
                type="button"
                :disabled="index === editableItems.length - 1"
                @click="moveItem(index, 1)"
                class="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-25 cursor-pointer"
                title="下へ移動"
              >
                <ChevronDown class="w-4 h-4" />
              </button>
            </div>

            <span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
              {{ index + 1 }}
            </span>

            <div class="flex-1 max-w-md">
              <input
                type="text"
                v-model="item.label"
                @input="silentSyncIfValid"
                placeholder="項目表示名"
                class="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-500 focus:outline-none text-sm font-bold text-slate-900"
              />
              <div class="text-xs text-slate-500 mt-1">
                識別キー: <code class="font-mono text-slate-700">{{ item.key }}</code> · 選択肢 {{ item.options.length }}件
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 shrink-0">
            <!-- 有効/無効スイッチ -->
            <button
              type="button"
              @click="toggleItemActive(item)"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer"
              :class="
                item.isActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              "
            >
              <span>{{ item.isActive ? '有効（表示中）' : '無効（非表示）' }}</span>
            </button>

            <button
              type="button"
              @click="item.isOpen = !item.isOpen"
              class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              {{ item.isOpen ? '選択肢を閉じる' : '選択肢を編集' }}
            </button>
          </div>
        </div>

        <!-- 配下の選択肢エディタ -->
        <div v-if="item.isOpen" class="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-600">
              選択肢テキスト ＆ トリガー設定
            </span>
            <button
              type="button"
              @click="addOption(item)"
              class="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>選択肢を追加</span>
            </button>
          </div>

          <div
            v-for="(opt, oIdx) in item.options"
            :key="oIdx"
            class="p-3 bg-white rounded-lg border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-2 flex-1">
              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  :disabled="oIdx === 0"
                  @click="moveOption(item, oIdx, -1)"
                  class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                >
                  <ChevronUp class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  :disabled="oIdx === item.options.length - 1"
                  @click="moveOption(item, oIdx, 1)"
                  class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                >
                  <ChevronDown class="w-3.5 h-3.5" />
                </button>
              </div>

              <span class="text-xs font-mono text-slate-400 w-5">{{ oIdx + 1 }}.</span>

              <input
                type="text"
                v-model="opt.text"
                @input="silentSyncIfValid"
                placeholder="選択肢名"
                class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div class="flex flex-wrap items-center gap-4 pl-7 lg:pl-0 text-xs">
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="opt.isSuccess"
                  @change="silentSyncIfValid"
                  class="rounded border-slate-300 h-4 w-4 accent-emerald-600"
                />
                <span :class="opt.isSuccess ? 'font-bold text-emerald-700' : 'text-slate-600'">
                  獲得・成約カウント
                </span>
              </label>

              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="opt.isReasonTrigger"
                  @change="silentSyncIfValid"
                  class="rounded border-slate-300 h-4 w-4 accent-rose-600"
                />
                <span :class="opt.isReasonTrigger ? 'font-bold text-rose-600' : 'text-slate-600'">
                  未提案理由トリガー
                </span>
              </label>

              <label
                v-if="store.currentBusiness === 'reuse'"
                class="inline-flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="opt.isAmountTrigger"
                  @change="silentSyncIfValid"
                  class="rounded border-slate-300 h-4 w-4 accent-amber-600"
                />
                <span :class="opt.isAmountTrigger ? 'font-bold text-amber-700' : 'text-slate-600'">
                  買取金額トリガー
                </span>
              </label>

              <button
                type="button"
                @click="removeOption(item, oIdx)"
                class="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="選択肢を削除"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新規項目追加モーダル -->
    <Transition name="fade">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
        @click.self="showAddModal = false"
      >
        <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">
              新規入力項目の追加（{{ store.businessShortLabel }}）
            </h3>
            <button
              type="button"
              @click="showAddModal = false"
              class="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3.5 text-xs">
            <div>
              <label for="new-item-label" class="block font-bold text-slate-700 mb-1">
                項目表示名（必須）
              </label>
              <input
                id="new-item-label"
                type="text"
                v-model="newItemForm.label"
                placeholder="例: 公式LINE友だち登録"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
              />
            </div>

            <div>
              <label for="new-item-key" class="block font-bold text-slate-700 mb-1">
                項目識別キー（空欄時は項目表示名を自動設定）
              </label>
              <input
                id="new-item-key"
                type="text"
                v-model="newItemForm.key"
                placeholder="例: LINE登録"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:border-slate-600 focus:outline-none"
              />
            </div>

            <div>
              <label for="new-item-opts" class="block font-bold text-slate-700 mb-1">
                初期選択肢リスト（改行区切り）
              </label>
              <textarea
                id="new-item-opts"
                v-model="newItemForm.optionsText"
                rows="4"
                class="w-full p-3 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:border-slate-600 focus:outline-none"
              ></textarea>
              <p class="text-slate-500 mt-1">
                1行目を獲得カウント対象、「未提案」を未提案理由トリガーとして自動設定します（作成後に個別変更可能）。
              </p>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              @click="showAddModal = false"
              class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              @click="submitNewItem"
              class="px-5 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              項目を追加して即時反映
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
