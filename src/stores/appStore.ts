import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  AdminTabMode,
  BusinessType,
  ComparisonMode,
  DashboardTabMode,
  EntrySubMode,
  ItemMasterConfig,
  ItemsByBusinessMap,
  KpiTargetRecord,
  PresetPeriodType,
  ReasonOptionConfig,
  ReasonsByBusinessMap,
  ServiceRecord,
  StaffMember,
  TargetLevel,
  ToastNotification,
  ViewMode,
} from '@/types';
import {
  createInitialItemMasters,
  createInitialReasonMasters,
  createInitialServiceRecords,
  createInitialStaffList,
  createInitialTargetRecords,
} from '@/mocks/initialData';
import {
  computeDateRangeFromPreset,
  computePreviousComparisonRange,
  computePrevYearComparisonRange,
  daysBetweenInclusive,
  formatDateKey,
  formatDateTimeNow,
  generateUuid,
  normalizeYearMonth,
} from '@/utils/dateUtils';
import {
  buildLowKpiAlerts,
  calculateHealthcareSummary,
  calculateReuseSummary,
  filterServiceRecords,
  formatRecordReasonSummary,
} from '@/utils/kpiCalculators';

export const RESERVED_ITEM_KEYS = [
  'timestamp',
  'targetDate',
  'staffId',
  'staffName',
  'storeName',
  'amount',
  'reason',
  'submissionId',
];

export const useAppStore = defineStore('app', () => {
  // ==========================================
  // 1. グローバルナビゲーション＆デモ状態
  // ==========================================
  const currentBusiness = ref<BusinessType>('healthcare');
  const currentView = ref<ViewMode>('dashboard');
  const entrySubMode = ref<EntrySubMode>('single');
  const dashboardTab = ref<DashboardTabMode>('overview');
  const adminTab = ref<AdminTabMode>('items');

  const lastSyncTime = ref<string>(formatDateTimeNow());
  const resetVersion = ref<number>(0);

  // マスタ＆実績インメモリストア
  const staffList = ref<StaffMember[]>(createInitialStaffList());
  const itemMasters = ref<ItemsByBusinessMap>(createInitialItemMasters());
  const reasonMasters = ref<ReasonsByBusinessMap>(createInitialReasonMasters());
  const records = ref<ServiceRecord[]>(createInitialServiceRecords());
  const targetRecords = ref<KpiTargetRecord[]>(createInitialTargetRecords());

  // 稼働中ログインスタッフID（入力フォーム用）
  const activeEntryStaffId = ref<string>('S001');

  // 完了モーダル（入力画面用）
  const completeModal = ref<{ show: boolean; title: string; message: string }>({
    show: false,
    title: '',
    message: '',
  });

  // トースト通知
  const toasts = ref<ToastNotification[]>([]);
  let toastSeq = 1;

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3200) {
    const id = toastSeq++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function triggerCompleteModal(title: string, message: string) {
    completeModal.value = { show: true, title, message };
    setTimeout(() => {
      completeModal.value.show = false;
    }, 1500);
  }

  // ==========================================
  // 2. ダッシュボード期間＆フィルター状態
  // ==========================================
  const presetType = ref<PresetPeriodType>('month');
  const presetValue = ref<number>(0); // 今月
  const activeYearForQuarters = ref<number>(new Date().getFullYear());
  const customDateFrom = ref<string>('');
  const customDateTo = ref<string>('');
  const comparisonMode = ref<ComparisonMode>('previous');

  const selectedStore = ref<string>('all');
  const selectedStaff = ref<string>('all');

  // 日次未提出者チェック対象日（初期値：本日）
  const submissionCheckDate = ref<string>(formatDateKey(new Date()));

  // スタッフ詳細ドロワー＆目標モーダル状態
  const drawerStaffId = ref<string | null>(null);
  const showTargetModal = ref<boolean>(false);

  // ==========================================
  // 3. 派生データ (Getters / Computed)
  // ==========================================
  const businessLabel = computed(() =>
    currentBusiness.value === 'healthcare' ? 'ヘルスケア（整骨院・サロン）' : 'リユース（買取専門店）'
  );

  const businessShortLabel = computed(() =>
    currentBusiness.value === 'healthcare' ? 'ヘルスケア' : 'リユース'
  );

  // 現在事業の全スタッフ / 稼働中スタッフ
  const currentBusinessStaff = computed(() =>
    staffList.value.filter((s) => s.businessType === currentBusiness.value)
  );

  const activeBusinessStaff = computed(() =>
    currentBusinessStaff.value.filter((s) => s.isActive)
  );

  // 入力画面で選択中のスタッフ（無効化されていた場合は自動フォールバック）
  const currentEntryStaff = computed<StaffMember>(() => {
    const found = activeBusinessStaff.value.find((s) => s.id === activeEntryStaffId.value);
    if (found) return found;
    if (activeBusinessStaff.value.length > 0) {
      return activeBusinessStaff.value[0];
    }
    return (
      currentBusinessStaff.value[0] || {
        id: 'DEMO01',
        name: 'デモ担当者',
        businessType: currentBusiness.value,
        storeName: 'デモ店舗',
        isActive: true,
      }
    );
  });

  // 現在事業の全項目 / 有効項目
  const currentAllItems = computed<ItemMasterConfig[]>(() => itemMasters.value[currentBusiness.value] || []);

  const currentActiveItems = computed<ItemMasterConfig[]>(() =>
    currentAllItems.value.filter((it) => it.isActive).sort((a, b) => a.order - b.order)
  );

  // 現在事業の有効な未提案理由マップ
  const currentActiveReasonsMap = computed<Record<string, ReasonOptionConfig[]>>(() => {
    const rawMap = reasonMasters.value[currentBusiness.value] || {};
    const out: Record<string, ReasonOptionConfig[]> = {};
    for (const key of Object.keys(rawMap)) {
      out[key] = (rawMap[key] || [])
        .filter((r) => r.isActive)
        .sort((a, b) => a.order - b.order);
    }
    return out;
  });

  // 店舗一覧（スタッフマスタ＋実績データの和集合）
  const storeOptions = computed<string[]>(() => {
    const set = new Set<string>();
    for (const s of currentBusinessStaff.value) {
      if (s.storeName.trim()) set.add(s.storeName.trim());
    }
    for (const r of records.value) {
      if (r.businessType === currentBusiness.value && r.storeName.trim()) {
        set.add(r.storeName.trim());
      }
    }
    return Array.from(set).sort();
  });

  // ダッシュボードの店舗連動スタッフ候補
  const dashboardStaffOptions = computed<StaffMember[]>(() => {
    if (selectedStore.value === 'all') return activeBusinessStaff.value;
    return activeBusinessStaff.value.filter((s) => s.storeName === selectedStore.value);
  });

  // 適用中の期間＆比較期間
  const activeDateRange = computed(() =>
    computeDateRangeFromPreset(
      presetType.value,
      presetValue.value,
      activeYearForQuarters.value,
      customDateFrom.value,
      customDateTo.value
    )
  );

  const dateRangeDaysCount = computed(() =>
    daysBetweenInclusive(activeDateRange.value.start, activeDateRange.value.end)
  );

  const isMonthRange = computed(() => presetType.value === 'month');

  const activeComparisonRange = computed(() =>
    comparisonMode.value === 'previous'
      ? computePreviousComparisonRange(presetType.value, presetValue.value, activeDateRange.value)
      : computePrevYearComparisonRange(presetType.value, presetValue.value, activeDateRange.value)
  );

  const comparisonModeLabel = computed(() => {
    if (comparisonMode.value === 'previous') {
      return presetType.value === 'month' && presetValue.value === 0 ? '前月同日比' : '直前同期間比';
    }
    return '前年同期比';
  });

  // 絞り込み済みレコード＆比較期間レコード
  const filteredRecords = computed(() =>
    filterServiceRecords(
      records.value,
      currentBusiness.value,
      activeDateRange.value,
      selectedStore.value,
      selectedStaff.value
    )
  );

  const comparisonRecords = computed(() =>
    filterServiceRecords(
      records.value,
      currentBusiness.value,
      activeComparisonRange.value,
      selectedStore.value,
      selectedStaff.value
    )
  );

  // メインKPIサマリー
  const healthcareSummary = computed(() =>
    calculateHealthcareSummary(
      filteredRecords.value,
      comparisonRecords.value,
      currentAllItems.value,
      targetRecords.value,
      selectedStore.value,
      selectedStaff.value,
      activeDateRange.value
    )
  );

  const reuseSummary = computed(() =>
    calculateReuseSummary(
      filteredRecords.value,
      comparisonRecords.value,
      currentAllItems.value,
      targetRecords.value,
      selectedStore.value,
      selectedStaff.value,
      activeDateRange.value,
      isMonthRange.value
    )
  );

  // 低KPI要注意アラートリスト
  const lowKpiAlerts = computed(() =>
    buildLowKpiAlerts(
      records.value,
      currentBusiness.value,
      storeOptions.value,
      activeBusinessStaff.value,
      currentAllItems.value,
      targetRecords.value,
      activeDateRange.value,
      selectedStore.value,
      isMonthRange.value
    )
  );

  // 日次未提出者チェック
  const submissionStatus = computed(() => {
    const targetDate = submissionCheckDate.value;
    const submittedIds = new Set<string>();
    for (const r of records.value) {
      if (r.businessType === currentBusiness.value && r.targetDate === targetDate) {
        submittedIds.add(r.staffId);
      }
    }

    const candidates =
      selectedStore.value === 'all'
        ? activeBusinessStaff.value
        : activeBusinessStaff.value.filter((s) => s.storeName === selectedStore.value);

    const unsubmittedStaff = candidates.filter((s) => !submittedIds.has(s.id));
    const totalStaffCount = candidates.length;
    const submissionRate =
      totalStaffCount > 0
        ? Math.round(((totalStaffCount - unsubmittedStaff.length) / totalStaffCount) * 100)
        : 100;

    return {
      totalStaffCount,
      unsubmittedStaff,
      submissionRate,
    };
  });

  // ==========================================
  // 4. アクション (事業切替・入力登録・マスタ更新・リセット)
  // ==========================================
  function switchBusiness(biz: BusinessType) {
    if (currentBusiness.value === biz) return;
    currentBusiness.value = biz;
    selectedStore.value = 'all';
    selectedStaff.value = 'all';
    drawerStaffId.value = null;

    const firstActive = staffList.value.find((s) => s.businessType === biz && s.isActive);
    if (firstActive) {
      activeEntryStaffId.value = firstActive.id;
    }
  }

  function setEntryStaff(staffId: string) {
    const found = staffList.value.find((s) => s.id === staffId);
    if (!found) return;
    if (found.businessType !== currentBusiness.value) {
      switchBusiness(found.businessType);
    }
    activeEntryStaffId.value = found.id;
  }

  function setPresetPeriod(type: PresetPeriodType, val: number) {
    presetType.value = type;
    presetValue.value = val;
    if (type === 'year') {
      activeYearForQuarters.value = val;
    }
  }

  function applyCustomPeriod(from: string, to: string) {
    if (!from || !to) {
      showToast('開始日と終了日の両方を指定してください。', 'error');
      return;
    }
    if (from > to) {
      showToast('開始日は終了日以前の日付を指定してください。', 'error');
      return;
    }
    customDateFrom.value = from;
    customDateTo.value = to;
    presetType.value = 'custom';
  }

  function setStoreFilter(store: string) {
    selectedStore.value = store;
    if (selectedStaff.value !== 'all') {
      const valid = dashboardStaffOptions.value.some((s) => s.id === selectedStaff.value);
      if (!valid) selectedStaff.value = 'all';
    }
  }

  function resetDashboardFilters() {
    selectedStore.value = 'all';
    selectedStaff.value = 'all';
  }

  // ① 1件ずつ登録
  function addSingleRecord(payload: {
    targetDate: string;
    answers: Record<string, string>;
    reasons: Record<string, string>;
    amount: number | null;
  }) {
    const staff = currentEntryStaff.value;
    const nowStr = formatDateTimeNow();

    const newRecord: ServiceRecord = {
      submissionId: generateUuid('single'),
      timestamp: nowStr,
      targetDate: payload.targetDate,
      businessType: staff.businessType,
      staffId: staff.id,
      staffName: staff.name,
      storeName: staff.storeName,
      answers: { ...payload.answers },
      reasons: { ...payload.reasons },
      amount: staff.businessType === 'reuse' ? payload.amount : null,
      source: 'single',
    };

    records.value.unshift(newRecord);
    lastSyncTime.value = nowStr;
    triggerCompleteModal(
      '登録が完了しました',
      `${staff.name} さんの接客実績をリアルタイム反映しました。`
    );
  }

  // ② 複数行一括登録（方式A）
  function addBatchRecords(payload: {
    targetDate: string;
    rows: Array<{
      answers: Record<string, string>;
      reasons: Record<string, string>;
      amount: number | null;
    }>;
  }) {
    const staff = currentEntryStaff.value;
    const nowStr = formatDateTimeNow();
    const batchUid = generateUuid('batch');

    const created: ServiceRecord[] = payload.rows.map((row, idx) => ({
      submissionId: `${batchUid}#${idx + 1}`,
      timestamp: nowStr,
      targetDate: payload.targetDate,
      businessType: staff.businessType,
      staffId: staff.id,
      staffName: staff.name,
      storeName: staff.storeName,
      answers: { ...row.answers },
      reasons: { ...row.reasons },
      amount: staff.businessType === 'reuse' ? row.amount : null,
      source: 'batch',
    }));

    records.value.unshift(...created);
    lastSyncTime.value = nowStr;
    triggerCompleteModal(
      '一括登録が完了しました',
      `${created.length}件の接客明細をダッシュボードへ即時反映しました。`
    );
  }

  // ③ 日次集計登録（方式B）：ダッシュボードの全KPI・理由内訳・金額集計へ完全整合する形で展開格納
  function addDailySummaryRecords(payload: {
    targetDate: string;
    totalCount: number;
    counts: Record<string, Record<string, number>>;
    reasonCounts: Record<string, Record<string, number>>;
    totalAmount: number;
  }) {
    const staff = currentEntryStaff.value;
    const nowStr = formatDateTimeNow();
    const sumUid = generateUuid('sum');
    const activeItems = currentActiveItems.value;

    // 各項目の選択肢配列と理由配列を件数分展開
    const expandedAnswersByItem: Record<string, string[]> = {};
    const expandedReasonsByItem: Record<string, string[]> = {};
    let amountTriggerTotalCount = 0;

    for (const item of activeItems) {
      const optList: string[] = [];
      const rsnList: string[] = [];
      const itemCounts = payload.counts[item.key] || {};
      const itemReasonCounts = payload.reasonCounts[item.key] || {};

      // 未提案理由キューを構築
      const reasonQueue: string[] = [];
      for (const [rText, rCnt] of Object.entries(itemReasonCounts)) {
        for (let k = 0; k < (Number(rCnt) || 0); k++) {
          reasonQueue.push(rText);
        }
      }

      let rCursor = 0;
      for (const opt of item.options) {
        const cnt = Number(itemCounts[opt.text]) || 0;
        if (opt.isAmountTrigger && staff.businessType === 'reuse') {
          amountTriggerTotalCount += cnt;
        }
        for (let k = 0; k < cnt; k++) {
          optList.push(opt.text);
          if (opt.isReasonTrigger) {
            rsnList.push(reasonQueue[rCursor] || '');
            rCursor++;
          } else {
            rsnList.push('');
          }
        }
      }

      expandedAnswersByItem[item.key] = optList;
      expandedReasonsByItem[item.key] = rsnList;
    }

    // 総対応件数（各項目の最大入力件数との大きい方を安全確保）
    const maxItemLen = Math.max(
      payload.totalCount,
      ...Object.values(expandedAnswersByItem).map((arr) => arr.length),
      0
    );

    // 買取成約総額を成約件数へ端数調整付きで正確に配分
    const baseAmt =
      amountTriggerTotalCount > 0 ? Math.floor(payload.totalAmount / amountTriggerTotalCount) : 0;
    let remainderAmt =
      amountTriggerTotalCount > 0 ? payload.totalAmount - baseAmt * amountTriggerTotalCount : 0;

    const synthesized: ServiceRecord[] = [];
    for (let i = 0; i < maxItemLen; i++) {
      const ans: Record<string, string> = {};
      const rsn: Record<string, string> = {};
      let rowTriggersAmount = false;

      for (const item of activeItems) {
        const val = expandedAnswersByItem[item.key]?.[i] || '';
        const rVal = expandedReasonsByItem[item.key]?.[i] || '';
        ans[item.key] = val;
        if (rVal) rsn[item.key] = rVal;

        const matchedOpt = item.options.find((o) => o.text === val);
        if (matchedOpt?.isAmountTrigger && staff.businessType === 'reuse') {
          rowTriggersAmount = true;
        }
      }

      let rowAmount: number | null = null;
      if (rowTriggersAmount && staff.businessType === 'reuse') {
        rowAmount = baseAmt + (remainderAmt > 0 ? remainderAmt : 0);
        remainderAmt = 0;
      }

      synthesized.push({
        submissionId: `${sumUid}#${i + 1}`,
        timestamp: nowStr,
        targetDate: payload.targetDate,
        businessType: staff.businessType,
        staffId: staff.id,
        staffName: staff.name,
        storeName: staff.storeName,
        answers: ans,
        reasons: rsn,
        amount: rowAmount,
        source: 'summary',
      });
    }

    records.value.unshift(...synthesized);
    lastSyncTime.value = nowStr;
    triggerCompleteModal(
      '日次集計を登録しました',
      `${maxItemLen}件分の日次サマリーをダッシュボード集計に合算しました。`
    );
  }

  // ④ マスタ管理：項目マスタ保存
  function updateItemMaster(businessType: BusinessType, updatedItems: ItemMasterConfig[]): boolean {
    for (const it of updatedItems) {
      const k = it.key.trim();
      if (!k || !it.label.trim()) {
        showToast('項目キーおよび項目表示名は必須です。', 'error');
        return false;
      }
      if (RESERVED_ITEM_KEYS.includes(k)) {
        showToast(`項目キー「${k}」はシステム予約語のため使用できません。`, 'error');
        return false;
      }
      if (it.options.length === 0) {
        showToast(`項目「${it.label}」には最低1つの選択肢が必要です。`, 'error');
        return false;
      }
      for (const opt of it.options) {
        if (!opt.text.trim()) {
          showToast(`項目「${it.label}」に空の選択肢があります。`, 'error');
          return false;
        }
      }
    }

    const normalized: ItemMasterConfig[] = updatedItems.map((it, idx) => ({
      key: it.key.trim(),
      label: it.label.trim(),
      order: idx + 1,
      isActive: it.isActive,
      options: it.options.map((opt, oIdx) => ({
        text: opt.text.trim(),
        order: oIdx + 1,
        isSuccess: Boolean(opt.isSuccess),
        isReasonTrigger: Boolean(opt.isReasonTrigger),
        isAmountTrigger: businessType === 'healthcare' ? false : Boolean(opt.isAmountTrigger),
      })),
    }));

    itemMasters.value[businessType] = normalized;

    // 新規項目の理由配列枠を保証
    if (!reasonMasters.value[businessType]) {
      reasonMasters.value[businessType] = {};
    }
    for (const it of normalized) {
      if (!reasonMasters.value[businessType][it.key]) {
        reasonMasters.value[businessType][it.key] = [
          { text: '時間不足・混雑', order: 1, isActive: true },
          { text: 'お客様都合（お急ぎ）', order: 2, isActive: true },
          { text: 'その他', order: 3, isActive: true },
        ];
      }
    }

    lastSyncTime.value = formatDateTimeNow();
    showToast('入力項目・選択肢マスタを更新しました。入力画面・分析画面へ即時反映されています。', 'success');
    return true;
  }

  // ⑤ マスタ管理：未提案理由マスタ保存
  function updateReasonMaster(
    businessType: BusinessType,
    updatedMap: Record<string, ReasonOptionConfig[]>
  ): boolean {
    const cleanMap: Record<string, ReasonOptionConfig[]> = {};
    for (const [itemKey, list] of Object.entries(updatedMap)) {
      for (const r of list) {
        if (!r.text.trim()) {
          showToast('空の未提案理由テキストがあります。入力するか削除してください。', 'error');
          return false;
        }
      }
      cleanMap[itemKey] = list.map((r, idx) => ({
        text: r.text.trim(),
        order: idx + 1,
        isActive: r.isActive,
      }));
    }

    reasonMasters.value[businessType] = cleanMap;
    lastSyncTime.value = formatDateTimeNow();
    showToast('未提案理由マスタを保存しました。入力画面へ即時反映されています。', 'success');
    return true;
  }

  // ⑥ マスタ管理：スタッフ追加・更新・有効切替
  function upsertStaffMember(member: StaffMember, isNew: boolean): boolean {
    const cleanId = member.id.trim();
    if (!cleanId || !/^[A-Za-z0-9]+$/.test(cleanId)) {
      showToast('スタッフIDは半角英数字で入力してください。', 'error');
      return false;
    }
    if (!member.name.trim() || !member.storeName.trim()) {
      showToast('スタッフ名と所属店舗名は必須です。', 'error');
      return false;
    }

    if (isNew) {
      if (staffList.value.some((s) => s.id === cleanId)) {
        showToast(`スタッフID「${cleanId}」は既に登録されています。`, 'error');
        return false;
      }
      staffList.value.push({
        id: cleanId,
        name: member.name.trim(),
        businessType: member.businessType,
        storeName: member.storeName.trim(),
        isActive: member.isActive,
      });
      showToast(`スタッフ「${member.name.trim()}」を新規登録しました。`, 'success');
    } else {
      const target = staffList.value.find((s) => s.id === cleanId);
      if (!target) return false;
      target.name = member.name.trim();
      target.businessType = member.businessType;
      target.storeName = member.storeName.trim();
      target.isActive = member.isActive;
      showToast(`スタッフ「${target.name}」の情報を更新しました。`, 'success');
    }

    lastSyncTime.value = formatDateTimeNow();
    return true;
  }

  function toggleStaffActiveStatus(staffId: string) {
    const target = staffList.value.find((s) => s.id === staffId);
    if (!target) return;
    target.isActive = !target.isActive;
    lastSyncTime.value = formatDateTimeNow();
    showToast(
      `「${target.name}」を${target.isActive ? '稼働中（有効）' : '停止中（無効）'}に変更しました。`,
      'info'
    );
  }

  // ⑦ KPI目標設定の保存・更新・空欄削除
  function saveKpiTargetsBatch(payload: {
    yearMonth: string;
    businessType: BusinessType;
    targetLevel: TargetLevel;
    targetName: string;
    values: Record<string, number | null | ''>;
  }) {
    const ym = normalizeYearMonth(payload.yearMonth);
    const nowStr = formatDateTimeNow();

    for (const [kpiKey, rawVal] of Object.entries(payload.values)) {
      const idx = targetRecords.value.findIndex(
        (t) =>
          normalizeYearMonth(t.yearMonth) === ym &&
          t.businessType === payload.businessType &&
          t.targetLevel === payload.targetLevel &&
          t.targetName === payload.targetName &&
          t.kpiKey === kpiKey
      );

      if (rawVal === null || rawVal === undefined || rawVal === '' || Number.isNaN(Number(rawVal))) {
        // 空欄は削除（上位目標へのフォールバックが有効化）
        if (idx !== -1) {
          targetRecords.value.splice(idx, 1);
        }
      } else {
        const numVal = Number(rawVal);
        if (idx !== -1) {
          targetRecords.value[idx].targetValue = numVal;
          targetRecords.value[idx].updatedAt = nowStr;
        } else {
          targetRecords.value.push({
            yearMonth: ym,
            businessType: payload.businessType,
            targetLevel: payload.targetLevel,
            targetName: payload.targetName,
            kpiKey,
            targetValue: numVal,
            updatedAt: nowStr,
          });
        }
      }
    }

    lastSyncTime.value = nowStr;
    showToast('KPI目標設定を更新しました。達成率・アラート判定に即時反映されています。', 'success');
  }

  // ⑧ CSVエクスポート（BOM付きUTF-8 ＆ 数式インジェクション防止）
  function exportFilteredCsv() {
    const list = filteredRecords.value;
    if (list.length === 0) {
      showToast('エクスポート対象の実績データがありません。', 'info');
      return;
    }

    const items = currentAllItems.value;
    const headers: string[] = ['タイムスタンプ', '対応日', 'スタッフID', 'スタッフ名', '店舗名'];
    for (const item of items) {
      headers.push(item.label);
      if (item.options.some((o) => o.isReasonTrigger)) {
        headers.push(`${item.label}_未提案理由`);
      }
    }
    if (currentBusiness.value === 'reuse') {
      headers.push('買取金額');
    }
    headers.push('未提案理由サマリー');

    const sanitizeCsvCell = (val: string | number | null | undefined): string => {
      let str = val === null || val === undefined ? '' : String(val);
      // 数式インジェクション対策 (=, +, -, @ 先頭エスケープ)
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const sorted = [...list].sort((a, b) => b.targetDate.localeCompare(a.targetDate));
    const lines = [headers.map(sanitizeCsvCell).join(',')];

    for (const rec of sorted) {
      const row: Array<string | number> = [
        rec.timestamp,
        rec.targetDate,
        rec.staffId,
        rec.staffName,
        rec.storeName,
      ];
      for (const item of items) {
        row.push(rec.answers[item.key] || '');
        if (item.options.some((o) => o.isReasonTrigger)) {
          row.push(rec.reasons[item.key] || '');
        }
      }
      if (currentBusiness.value === 'reuse') {
        row.push(rec.amount !== null ? rec.amount : '');
      }
      row.push(formatRecordReasonSummary(rec, items));
      lines.push(row.map(sanitizeCsvCell).join(','));
    }

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const bizLabel = currentBusiness.value === 'healthcare' ? 'ヘルスケア' : 'リユース';
    link.href = url;
    link.download = `接客実績_${bizLabel}_${activeDateRange.value.start}_${activeDateRange.value.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${sorted.length}件の実績データをCSV出力しました。`, 'success');
  }

  // ⑨ ワンクリック初期データ復元
  function resetAllDemoData() {
    staffList.value = createInitialStaffList();
    itemMasters.value = createInitialItemMasters();
    reasonMasters.value = createInitialReasonMasters();
    records.value = createInitialServiceRecords();
    targetRecords.value = createInitialTargetRecords();

    presetType.value = 'month';
    presetValue.value = 0;
    selectedStore.value = 'all';
    selectedStaff.value = 'all';
    submissionCheckDate.value = formatDateKey(new Date());
    drawerStaffId.value = null;

    activeEntryStaffId.value = currentBusiness.value === 'healthcare' ? 'S001' : 'D001';
    lastSyncTime.value = formatDateTimeNow();
    resetVersion.value += 1;

    showToast('すべてのマスタ・目標値・実績データを初期デモ状態に復元しました。', 'info');
  }

  return {
    // State
    currentBusiness,
    currentView,
    entrySubMode,
    dashboardTab,
    adminTab,
    lastSyncTime,
    resetVersion,
    staffList,
    itemMasters,
    reasonMasters,
    records,
    targetRecords,
    activeEntryStaffId,
    completeModal,
    toasts,
    presetType,
    presetValue,
    activeYearForQuarters,
    customDateFrom,
    customDateTo,
    comparisonMode,
    selectedStore,
    selectedStaff,
    submissionCheckDate,
    drawerStaffId,
    showTargetModal,

    // Computed
    businessLabel,
    businessShortLabel,
    currentBusinessStaff,
    activeBusinessStaff,
    currentEntryStaff,
    currentAllItems,
    currentActiveItems,
    currentActiveReasonsMap,
    storeOptions,
    dashboardStaffOptions,
    activeDateRange,
    dateRangeDaysCount,
    isMonthRange,
    activeComparisonRange,
    comparisonModeLabel,
    filteredRecords,
    comparisonRecords,
    healthcareSummary,
    reuseSummary,
    lowKpiAlerts,
    submissionStatus,

    // Actions
    showToast,
    dismissToast,
    switchBusiness,
    setEntryStaff,
    setPresetPeriod,
    applyCustomPeriod,
    setStoreFilter,
    resetDashboardFilters,
    addSingleRecord,
    addBatchRecords,
    addDailySummaryRecords,
    updateItemMaster,
    updateReasonMaster,
    upsertStaffMember,
    toggleStaffActiveStatus,
    saveKpiTargetsBatch,
    exportFilteredCsv,
    resetAllDemoData,
  };
});
