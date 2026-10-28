<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Save, Target, X } from 'lucide-vue-next';
import type { BusinessType, TargetLevel } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { formatYearMonth, normalizeYearMonth } from '@/utils/dateUtils';

const store = useAppStore();

const yearMonth = ref<string>(formatYearMonth(new Date()));
const businessType = ref<BusinessType>('healthcare');
const targetLevel = ref<TargetLevel>('全社');
const targetName = ref<string>('全社');
const staffStoreFilter = ref<string>('all');
const values = reactive<Record<string, number | string>>({});

interface KpiFieldDef {
  kpiKey: string;
  label: string;
  unit: '%' | '円';
  step: number;
}

const editableKpiFields = computed<KpiFieldDef[]>(() => {
  const items = (store.itemMasters[businessType.value] || []).filter((it) => it.isActive);
  if (businessType.value === 'healthcare') {
    const out: KpiFieldDef[] = [];
    for (const item of items) {
      out.push({ kpiKey: `${item.key}_獲得率`, label: `${item.label} 獲得率`, unit: '%', step: 1 });
      out.push({
        kpiKey: `${item.key}_提案率`,
        label: `${item.label} ${item.key === '口コミ' ? '案内率' : '提案率'}`,
        unit: '%',
        step: 1,
      });
    }
    return out;
  }

  const reuseOut: KpiFieldDef[] = [
    { kpiKey: '査定実施率', label: '査定実施率', unit: '%', step: 1 },
  ];
  for (const item of items) {
    if (item.key === '来店・査定') continue;
    const winSuffix = item.key === '提案・成約' ? '成約率' : '獲得率';
    const propSuffix = item.key === '口コミ' ? '案内率' : '提案率';
    reuseOut.push({
      kpiKey: `${item.key}_獲得率`,
      label: `${item.label} ${winSuffix}`,
      unit: '%',
      step: 1,
    });
    reuseOut.push({
      kpiKey: `${item.key}_提案率`,
      label: `${item.label} ${propSuffix}`,
      unit: '%',
      step: 1,
    });
  }
  reuseOut.push({ kpiKey: '買取総額', label: '月間買取総額（税込）', unit: '円', step: 10000 });
  reuseOut.push({ kpiKey: '平均単価', label: '平均買取単価', unit: '円', step: 1000 });
  return reuseOut;
});

const availableStores = computed(() => {
  const set = new Set<string>();
  for (const s of store.staffList) {
    if (s.businessType === businessType.value && s.storeName.trim()) {
      set.add(s.storeName.trim());
    }
  }
  return Array.from(set).sort();
});

const availableStaff = computed(() => {
  return store.staffList.filter(
    (s) =>
      s.businessType === businessType.value &&
      s.isActive &&
      (staffStoreFilter.value === 'all' || s.storeName === staffStoreFilter.value)
  );
});

function loadExistingValues() {
  Object.keys(values).forEach((k) => delete values[k]);
  const ym = normalizeYearMonth(yearMonth.value);

  for (const f of editableKpiFields.value) {
    const existing = store.targetRecords.find(
      (t) =>
        normalizeYearMonth(t.yearMonth) === ym &&
        t.businessType === businessType.value &&
        t.targetLevel === targetLevel.value &&
        t.targetName === targetName.value &&
        t.kpiKey === f.kpiKey
    );
    values[f.kpiKey] = existing ? existing.targetValue : '';
  }
}

function syncDefaultTargetName() {
  if (targetLevel.value === '全社') {
    targetName.value = '全社';
  } else if (targetLevel.value === '店舗') {
    targetName.value = availableStores.value[0] || '';
  } else {
    targetName.value = availableStaff.value[0]?.id || '';
  }
  loadExistingValues();
}

watch(
  () => store.showTargetModal,
  (isOpen) => {
    if (isOpen) {
      businessType.value = store.currentBusiness;
      yearMonth.value = normalizeYearMonth(store.activeDateRange.start) || formatYearMonth(new Date());
      targetLevel.value = '全社';
      targetName.value = '全社';
      staffStoreFilter.value = 'all';
      loadExistingValues();
    }
  }
);

watch([businessType, targetLevel], () => {
  syncDefaultTargetName();
});

watch(staffStoreFilter, () => {
  if (targetLevel.value === 'スタッフ') {
    targetName.value = availableStaff.value[0]?.id || '';
    loadExistingValues();
  }
});

watch([yearMonth, targetName], () => {
  loadExistingValues();
});

const isInvalid = computed(() => {
  if ((targetLevel.value === '店舗' || targetLevel.value === 'スタッフ') && !targetName.value) {
    return true;
  }
  return false;
});

function handleSave() {
  if (isInvalid.value) return;
  const payloadValues: Record<string, number | null | ''> = {};
  for (const f of editableKpiFields.value) {
    const raw = values[f.kpiKey];
    payloadValues[f.kpiKey] = raw === '' || raw === undefined ? '' : Number(raw);
  }

  store.saveKpiTargetsBatch({
    yearMonth: yearMonth.value,
    businessType: businessType.value,
    targetLevel: targetLevel.value,
    targetName: targetName.value,
    values: payloadValues,
  });

  store.showTargetModal = false;
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="store.showTargetModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
      @click.self="store.showTargetModal = false"
    >
      <div class="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
        <!-- ヘッダー -->
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <Target class="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h3 class="text-sm font-bold text-white">月次KPI目標設定エディタ（全社・店舗・スタッフ階層）</h3>
              <p class="text-xs text-slate-400">
                空欄で保存すると個別設定を削除し、上位階層の目標値へ自動フォールバックします
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="store.showTargetModal = false"
            class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 cursor-pointer shrink-0"
            aria-label="閉じる"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- コンテンツ -->
        <div class="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          <!-- 階層セレクタ -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div>
              <label for="target-ym" class="block font-semibold text-slate-300 mb-1.5">
                対象年月
              </label>
              <input
                id="target-ym"
                type="month"
                v-model="yearMonth"
                class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-2 font-mono tabular-nums focus:outline-none"
              />
            </div>

            <div>
              <label for="target-biz" class="block font-semibold text-slate-300 mb-1.5">
                事業モデル
              </label>
              <select
                id="target-biz"
                v-model="businessType"
                class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
              >
                <option value="healthcare">ヘルスケア</option>
                <option value="reuse">リユース</option>
              </select>
            </div>

            <div>
              <label for="target-lvl" class="block font-semibold text-slate-300 mb-1.5">
                対象階層レベル
              </label>
              <select
                id="target-lvl"
                v-model="targetLevel"
                class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
              >
                <option value="全社">全社（共通目標）</option>
                <option value="店舗">店舗別目標</option>
                <option value="スタッフ">スタッフ個人目標</option>
              </select>
            </div>

            <!-- 店舗選択 -->
            <div v-if="targetLevel === '店舗'" class="sm:col-span-3 pt-2 border-t border-slate-800">
              <label for="target-store" class="block font-semibold text-slate-300 mb-1.5">
                対象店舗
              </label>
              <select
                id="target-store"
                v-model="targetName"
                class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
              >
                <option v-for="st in availableStores" :key="st" :value="st">{{ st }}</option>
              </select>
            </div>

            <!-- スタッフ選択 -->
            <div
              v-if="targetLevel === 'スタッフ'"
              class="sm:col-span-3 pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div>
                <label for="target-staff-store" class="block font-semibold text-slate-300 mb-1.5">
                  店舗で絞り込み
                </label>
                <select
                  id="target-staff-store"
                  v-model="staffStoreFilter"
                  class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
                >
                  <option value="all">全店舗</option>
                  <option v-for="st in availableStores" :key="st" :value="st">{{ st }}</option>
                </select>
              </div>
              <div>
                <label for="target-staff-id" class="block font-semibold text-slate-300 mb-1.5">
                  対象スタッフ
                </label>
                <select
                  id="target-staff-id"
                  v-model="targetName"
                  class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
                >
                  <option v-for="s in availableStaff" :key="s.id" :value="s.id">
                    {{ s.name }}（{{ s.storeName }} · {{ s.id }}）
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 各KPI入力グリッド -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="field in editableKpiFields"
              :key="field.kpiKey"
              class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
            >
              <div class="flex items-center justify-between text-xs">
                <label :for="`kpi_${field.kpiKey}`" class="font-semibold text-slate-200">
                  {{ field.label }}
                </label>
                <span class="font-mono tabular-nums text-slate-400">
                  {{
                    values[field.kpiKey] !== '' && values[field.kpiKey] !== undefined
                      ? field.unit === '円'
                        ? `¥${Number(values[field.kpiKey]).toLocaleString()}`
                        : `${values[field.kpiKey]}%`
                      : '未設定'
                  }}
                </span>
              </div>

              <div class="relative">
                <span
                  v-if="field.unit === '円'"
                  class="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-500 font-mono"
                >
                  ¥
                </span>
                <input
                  :id="`kpi_${field.kpiKey}`"
                  type="number"
                  min="0"
                  :max="field.unit === '%' ? 100 : undefined"
                  :step="field.step"
                  v-model="values[field.kpiKey]"
                  placeholder="空欄で削除（上位フォールバック）"
                  class="w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-lg py-2 text-xs font-mono tabular-nums focus:border-sky-500 focus:outline-none"
                  :class="field.unit === '円' ? 'pl-7 pr-8' : 'px-3 pr-8'"
                />
                <span
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400"
                >
                  {{ field.unit }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- フッター -->
        <div class="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            @click="store.showTargetModal = false"
            class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            :disabled="isInvalid"
            @click="handleSave"
            class="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save class="w-3.5 h-3.5 shrink-0" />
            <span>目標値を保存・即時反映</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
