<script setup lang="ts">
import { AlertCircle, ListChecks, Users } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import ItemMaster from '@/components/admin/ItemMaster.vue';
import ReasonMaster from '@/components/admin/ReasonMaster.vue';
import StaffMaster from '@/components/admin/StaffMaster.vue';

const store = useAppStore();
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)] bg-slate-100 text-slate-900 py-6 px-4 lg:px-8">
    <div class="max-w-6xl mx-auto space-y-5">
      <!-- ポータルヘッダー ＆ サブタブ -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">
            ノーコード運用管理 · {{ store.businessLabel }}
          </p>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            マスタ管理ポータル
          </h1>
        </div>

        <nav
          class="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 overflow-x-auto"
          aria-label="マスタ管理タブ"
        >
          <button
            type="button"
            @click="store.adminTab = 'items'"
            class="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            :class="
              store.adminTab === 'items'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <ListChecks class="w-4 h-4 shrink-0" />
            <span>入力項目・選択肢（{{ store.currentAllItems.length }}）</span>
          </button>

          <button
            type="button"
            @click="store.adminTab = 'reasons'"
            class="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            :class="
              store.adminTab === 'reasons'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>未提案理由マスタ</span>
          </button>

          <button
            type="button"
            @click="store.adminTab = 'staff'"
            class="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            :class="
              store.adminTab === 'staff'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <Users class="w-4 h-4 shrink-0" />
            <span>スタッフ管理（{{ store.staffList.length }}）</span>
          </button>
        </nav>
      </div>

      <!-- タブ別コンテンツ -->
      <ItemMaster v-if="store.adminTab === 'items'" />
      <ReasonMaster v-else-if="store.adminTab === 'reasons'" />
      <StaffMaster v-else />
    </div>
  </div>
</template>
