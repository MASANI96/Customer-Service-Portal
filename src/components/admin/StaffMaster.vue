<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ArrowUpRight, Edit3, Search, UserPlus, X } from 'lucide-vue-next';
import type { BusinessType, StaffMember } from '@/types';
import { useAppStore } from '@/stores/appStore';

const store = useAppStore();

const searchQuery = ref<string>('');
const filterBusiness = ref<'all' | BusinessType>('all');
const showModal = ref<boolean>(false);
const isEditing = ref<boolean>(false);

const staffForm = reactive<StaffMember>({
  id: '',
  name: '',
  businessType: 'healthcare',
  storeName: '',
  isActive: true,
});

const filteredStaff = computed(() => {
  return store.staffList.filter((s) => {
    if (filterBusiness.value !== 'all' && s.businessType !== filterBusiness.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.storeName.toLowerCase().includes(q)
      );
    }
    return true;
  });
});

const suggestedStores = computed(() => {
  const set = new Set<string>();
  for (const s of store.staffList) {
    if (s.businessType === staffForm.businessType && s.storeName.trim()) {
      set.add(s.storeName.trim());
    }
  }
  return Array.from(set);
});

function openCreateModal() {
  isEditing.value = false;
  const prefix = store.currentBusiness === 'healthcare' ? 'S' : 'D';
  const count = store.staffList.filter((s) => s.businessType === store.currentBusiness).length + 1;
  staffForm.id = `${prefix}${String(count).padStart(3, '0')}`;
  staffForm.name = '';
  staffForm.businessType = store.currentBusiness;
  staffForm.storeName = store.storeOptions[0] || '';
  staffForm.isActive = true;
  showModal.value = true;
}

function openEditModal(member: StaffMember) {
  isEditing.value = true;
  staffForm.id = member.id;
  staffForm.name = member.name;
  staffForm.businessType = member.businessType;
  staffForm.storeName = member.storeName;
  staffForm.isActive = member.isActive;
  showModal.value = true;
}

function handleSaveStaff() {
  const ok = store.upsertStaffMember({ ...staffForm }, !isEditing.value);
  if (ok) {
    showModal.value = false;
  }
}

function switchAndOpenEntry(staff: StaffMember) {
  if (!staff.isActive) {
    store.showToast('停止中のスタッフでは入力できません。先に稼働状態を「有効」に切り替えてください。', 'info');
    return;
  }
  store.setEntryStaff(staff.id);
  store.currentView = 'entry';
}
</script>

<template>
  <div class="space-y-4">
    <!-- 検索＆新規追加バー -->
    <div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
        <div class="relative flex-1 max-w-sm">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="スタッフ名・ID・店舗名で検索..."
            class="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:border-slate-500 focus:outline-none"
          />
        </div>

        <select
          v-model="filterBusiness"
          class="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer"
          aria-label="事業モデル絞り込み"
        >
          <option value="all">すべての事業モデル</option>
          <option value="healthcare">ヘルスケアのみ</option>
          <option value="reuse">リユースのみ</option>
        </select>
      </div>

      <button
        type="button"
        @click="openCreateModal"
        class="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-start md:self-auto"
      >
        <UserPlus class="w-4 h-4 shrink-0" />
        <span>スタッフ新規登録</span>
      </button>
    </div>

    <!-- スタッフ一覧テーブル -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm text-slate-700">
          <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 whitespace-nowrap">スタッフID</th>
              <th class="px-4 py-3 whitespace-nowrap">氏名</th>
              <th class="px-4 py-3 whitespace-nowrap">事業モデル</th>
              <th class="px-4 py-3 whitespace-nowrap">所属店舗</th>
              <th class="px-4 py-3 whitespace-nowrap">稼働状態</th>
              <th class="px-4 py-3 whitespace-nowrap text-right">操作</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-200/80">
            <tr
              v-for="st in filteredStaff"
              :key="st.id"
              :class="!st.isActive ? 'bg-slate-50/80 opacity-65' : 'hover:bg-slate-50/70'"
            >
              <td class="px-4 py-3 font-mono tabular-nums font-bold text-slate-900">
                {{ st.id }}
              </td>
              <td class="px-4 py-3 font-bold text-slate-900">{{ st.name }}</td>
              <td class="px-4 py-3">
                <span
                  class="font-semibold text-xs"
                  :class="st.businessType === 'healthcare' ? 'text-emerald-700' : 'text-amber-700'"
                >
                  {{ st.businessType === 'healthcare' ? 'ヘルスケア' : 'リユース' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-700">{{ st.storeName }}</td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  @click="store.toggleStaffActiveStatus(st.id)"
                  class="px-2.5 py-1 rounded-md border text-xs font-bold transition-colors cursor-pointer"
                  :class="
                    st.isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  "
                >
                  {{ st.isActive ? '稼働中（有効）' : '停止中（無効）' }}
                </button>
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap space-x-2">
                <button
                  type="button"
                  @click="switchAndOpenEntry(st)"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>入力画面で試す</span>
                  <ArrowUpRight class="w-3.5 h-3.5 shrink-0" />
                </button>

                <button
                  type="button"
                  @click="openEditModal(st)"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 class="w-3.5 h-3.5 shrink-0" />
                  <span>編集</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新規・編集モーダル -->
    <Transition name="fade">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
        @click.self="showModal = false"
      >
        <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">
              {{ isEditing ? 'スタッフ情報の編集' : 'スタッフの新規登録' }}
            </h3>
            <button
              type="button"
              @click="showModal = false"
              class="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3.5 text-xs">
            <div>
              <label for="staff-id-input" class="block font-bold text-slate-700 mb-1">
                スタッフID（半角英数字）
              </label>
              <input
                id="staff-id-input"
                type="text"
                v-model="staffForm.id"
                :disabled="isEditing"
                placeholder="例: S004"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label for="staff-name-input" class="block font-bold text-slate-700 mb-1">
                氏名
              </label>
              <input
                id="staff-name-input"
                type="text"
                v-model="staffForm.name"
                placeholder="例: 山本 彩"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label for="staff-biz-input" class="block font-bold text-slate-700 mb-1">
                事業モデル
              </label>
              <select
                id="staff-biz-input"
                v-model="staffForm.businessType"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="healthcare">ヘルスケア（整骨院・サロン）</option>
                <option value="reuse">リユース（買取専門店）</option>
              </select>
            </div>

            <div>
              <label for="staff-store-input" class="block font-bold text-slate-700 mb-1">
                所属店舗名
              </label>
              <input
                id="staff-store-input"
                type="text"
                list="store-datalist"
                v-model="staffForm.storeName"
                placeholder="例: さくら通り本院"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none"
              />
              <datalist id="store-datalist">
                <option v-for="st in suggestedStores" :key="st" :value="st" />
              </datalist>
            </div>

            <div class="pt-1 flex items-center justify-between">
              <span class="font-bold text-slate-700">稼働状態</span>
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="staffForm.isActive"
                  class="rounded border-slate-300 h-4 w-4 accent-emerald-600"
                />
                <span class="text-slate-700 font-semibold">
                  {{ staffForm.isActive ? '稼働中（有効）' : '停止中（無効）' }}
                </span>
              </label>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              @click="showModal = false"
              class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              @click="handleSaveStaff"
              class="px-5 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              {{ isEditing ? '変更を保存' : 'スタッフを登録' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
