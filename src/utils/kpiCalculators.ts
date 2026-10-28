import type {
  AmountMetricResult,
  BusinessType,
  DateRange,
  HealthcareKpiSummary,
  ItemMasterConfig,
  KpiTargetRecord,
  LowKpiAlertItem,
  MatrixCellData,
  RateMetricResult,
  ReasonBreakdownItem,
  ReuseKpiSummary,
  ServiceRecord,
  StaffMember,
  UnmetKpiDetail,
} from '@/types';
import { normalizeYearMonth } from './dateUtils';

export function isOptionSuccess(item: ItemMasterConfig | undefined, value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (item) {
    const opt = item.options.find((o) => o.text === trimmed);
    if (opt) return opt.isSuccess;
  }
  return trimmed === '獲得' || trimmed === '成約' || trimmed === '査定実施';
}

export function isOptionProposal(item: ItemMasterConfig | undefined, value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (item) {
    const opt = item.options.find((o) => o.text === trimmed);
    if (opt) return !opt.isReasonTrigger;
  }
  return trimmed !== '未提案' && trimmed !== '未案内' && trimmed !== 'なし';
}

export function isOptionAmountTrigger(item: ItemMasterConfig | undefined, value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (item) {
    const opt = item.options.find((o) => o.text === trimmed);
    if (opt) return opt.isAmountTrigger;
  }
  return trimmed === '成約';
}

/**
 * 階層フォールバック付き目標値ルックアップ:
 * スタッフ目標 (>0) -> 店舗目標 (>0) -> 全社目標 (>0) -> null
 */
export function resolveTargetValue(
  targetRecords: KpiTargetRecord[],
  businessType: BusinessType,
  kpiKey: string,
  storeName: string,
  staffId: string,
  range: DateRange
): number | null {
  const ym = normalizeYearMonth(range.start);

  if (staffId && staffId !== 'all') {
    const staffRec = targetRecords.find(
      (t) =>
        normalizeYearMonth(t.yearMonth) === ym &&
        t.businessType === businessType &&
        t.targetLevel === 'スタッフ' &&
        t.targetName === staffId &&
        t.kpiKey === kpiKey
    );
    if (staffRec && staffRec.targetValue > 0) {
      return staffRec.targetValue;
    }
  }

  if (storeName && storeName !== 'all') {
    const storeRec = targetRecords.find(
      (t) =>
        normalizeYearMonth(t.yearMonth) === ym &&
        t.businessType === businessType &&
        t.targetLevel === '店舗' &&
        t.targetName === storeName &&
        t.kpiKey === kpiKey
    );
    if (storeRec && storeRec.targetValue > 0) {
      return storeRec.targetValue;
    }
  }

  const companyRec = targetRecords.find(
    (t) =>
      normalizeYearMonth(t.yearMonth) === ym &&
      t.businessType === businessType &&
      t.targetLevel === '全社' &&
      t.kpiKey === kpiKey
  );
  if (companyRec && companyRec.targetValue > 0) {
    return companyRec.targetValue;
  }

  return null;
}

export function filterServiceRecords(
  records: ServiceRecord[],
  businessType: BusinessType,
  range: DateRange,
  storeName = 'all',
  staffId = 'all'
): ServiceRecord[] {
  return records.filter((rec) => {
    if (rec.businessType !== businessType) return false;
    if (!rec.targetDate || rec.targetDate < range.start || rec.targetDate > range.end) return false;
    if (storeName !== 'all' && rec.storeName !== storeName) return false;
    if (staffId !== 'all' && rec.staffId !== staffId) return false;
    return true;
  });
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function calculateRateMetric(
  records: ServiceRecord[],
  prevRecords: ServiceRecord[] | null,
  item: ItemMasterConfig,
  targetRecords: KpiTargetRecord[],
  businessType: BusinessType,
  storeName: string,
  staffId: string,
  range: DateRange
): RateMetricResult {
  const denom = records.length;
  const successCount = records.filter((r) => isOptionSuccess(item, r.answers[item.key])).length;
  const proposalCount = records.filter((r) => isOptionProposal(item, r.answers[item.key])).length;

  const rate = denom > 0 ? round1((successCount / denom) * 100) : 0;
  const proposalRate = denom > 0 ? round1((proposalCount / denom) * 100) : 0;

  const target = resolveTargetValue(targetRecords, businessType, `${item.key}_獲得率`, storeName, staffId, range);
  const proposalTarget = resolveTargetValue(targetRecords, businessType, `${item.key}_提案率`, storeName, staffId, range);

  const achievement = target && target > 0 ? Math.round((rate / target) * 100) : null;
  const proposalAchievement =
    proposalTarget && proposalTarget > 0 ? Math.round((proposalRate / proposalTarget) * 100) : null;

  let rateDiff: number | null = null;
  if (prevRecords && prevRecords.length > 0) {
    const prevSuccess = prevRecords.filter((r) => isOptionSuccess(item, r.answers[item.key])).length;
    const prevRate = round1((prevSuccess / prevRecords.length) * 100);
    rateDiff = round1(rate - prevRate);
  }

  return {
    itemKey: item.key,
    label: item.label,
    count: successCount,
    denominator: denom,
    rate,
    proposalCount,
    proposalRate,
    target,
    achievement,
    proposalTarget,
    proposalAchievement,
    rateDiff,
  };
}

export function calculateHealthcareSummary(
  records: ServiceRecord[],
  prevRecords: ServiceRecord[] | null,
  items: ItemMasterConfig[],
  targetRecords: KpiTargetRecord[],
  storeName: string,
  staffId: string,
  range: DateRange
): HealthcareKpiSummary {
  const activeItems = items.filter((it) => it.isActive).sort((a, b) => a.order - b.order);
  const totalVisits = records.length;
  const visitsDiffPercent =
    prevRecords && prevRecords.length > 0
      ? round1(((totalVisits - prevRecords.length) / prevRecords.length) * 100)
      : null;

  const itemMetrics: Record<string, RateMetricResult> = {};
  const orderedItemMetrics: RateMetricResult[] = [];
  const achievementsPool: number[] = [];

  for (const item of activeItems) {
    const metric = calculateRateMetric(
      records,
      prevRecords,
      item,
      targetRecords,
      'healthcare',
      storeName,
      staffId,
      range
    );
    itemMetrics[item.key] = metric;
    orderedItemMetrics.push(metric);

    if (totalVisits > 0) {
      if (metric.achievement !== null) achievementsPool.push(metric.achievement);
      if (metric.proposalAchievement !== null) achievementsPool.push(metric.proposalAchievement);
    }
  }

  const avgAchievement =
    totalVisits > 0 && achievementsPool.length > 0
      ? Math.round(achievementsPool.reduce((acc, v) => acc + v, 0) / achievementsPool.length)
      : null;

  return {
    totalVisits,
    visitsDiffPercent,
    itemMetrics,
    orderedItemMetrics,
    avgAchievement,
  };
}

export function calculateReuseSummary(
  records: ServiceRecord[],
  prevRecords: ServiceRecord[] | null,
  items: ItemMasterConfig[],
  targetRecords: KpiTargetRecord[],
  storeName: string,
  staffId: string,
  range: DateRange,
  isMonthRange: boolean
): ReuseKpiSummary {
  const activeItems = items.filter((it) => it.isActive).sort((a, b) => a.order - b.order);
  const visitItem = items.find((it) => it.key === '来店・査定');
  const closingItem =
    items.find((it) => it.key === '提案・成約') || {
      key: '提案・成約',
      label: '提案・成約',
      order: 2,
      isActive: true,
      options: [],
    };
  const reviewItem =
    items.find((it) => it.key === '口コミ') || {
      key: '口コミ',
      label: '口コミ',
      order: 3,
      isActive: true,
      options: [],
    };

  const totalVisits = records.length;

  // 査定実施レコード（来店・査定項目が有効な場合は成功選択肢、無効化時は全件を母数とする）
  const assessmentRecords =
    visitItem && visitItem.isActive
      ? records.filter((r) => isOptionSuccess(visitItem, r.answers[visitItem.key]))
      : records;

  const prevAssessmentRecords = prevRecords
    ? visitItem && visitItem.isActive
      ? prevRecords.filter((r) => isOptionSuccess(visitItem, r.answers[visitItem.key]))
      : prevRecords
    : null;

  const totalAssessments = assessmentRecords.length;
  const assessmentsDiffPercent =
    prevAssessmentRecords && prevAssessmentRecords.length > 0
      ? round1(((totalAssessments - prevAssessmentRecords.length) / prevAssessmentRecords.length) * 100)
      : null;

  const assessmentRate = totalVisits > 0 ? round1((totalAssessments / totalVisits) * 100) : 0;
  const assessmentTarget = resolveTargetValue(targetRecords, 'reuse', '査定実施率', storeName, staffId, range);
  const assessmentAchievement =
    assessmentTarget && assessmentTarget > 0 ? Math.round((assessmentRate / assessmentTarget) * 100) : null;

  const closingMetric = calculateRateMetric(
    assessmentRecords,
    prevAssessmentRecords,
    closingItem,
    targetRecords,
    'reuse',
    storeName,
    staffId,
    range
  );

  const reviewMetric = calculateRateMetric(
    assessmentRecords,
    prevAssessmentRecords,
    reviewItem,
    targetRecords,
    'reuse',
    storeName,
    staffId,
    range
  );

  // 追加カスタム項目（マスタ管理で新規追加された項目）の自動集計
  const standardKeys = new Set(['来店・査定', '提案・成約', '口コミ']);
  const extraItemMetrics = activeItems
    .filter((it) => !standardKeys.has(it.key))
    .map((it) =>
      calculateRateMetric(
        assessmentRecords,
        prevAssessmentRecords,
        it,
        targetRecords,
        'reuse',
        storeName,
        staffId,
        range
      )
    );

  // 金額計算（金額トリガー選択肢がある項目、標準は提案・成約）
  let sumAmount = 0;
  for (const r of assessmentRecords) {
    const hasTriggered = items.some((it) => isOptionAmountTrigger(it, r.answers[it.key]));
    if (hasTriggered && typeof r.amount === 'number' && r.amount > 0) {
      sumAmount += r.amount;
    }
  }

  let prevSumAmount = 0;
  let prevClosingCount = 0;
  if (prevAssessmentRecords) {
    prevClosingCount = prevAssessmentRecords.filter((r) =>
      isOptionSuccess(closingItem, r.answers[closingItem.key])
    ).length;
    for (const r of prevAssessmentRecords) {
      const hasTriggered = items.some((it) => isOptionAmountTrigger(it, r.answers[it.key]));
      if (hasTriggered && typeof r.amount === 'number' && r.amount > 0) {
        prevSumAmount += r.amount;
      }
    }
  }

  const avgUnit = closingMetric.count > 0 ? Math.round(sumAmount / closingMetric.count) : 0;
  const prevAvgUnit = prevClosingCount > 0 ? Math.round(prevSumAmount / prevClosingCount) : 0;

  const amountTarget = resolveTargetValue(targetRecords, 'reuse', '買取総額', storeName, staffId, range);
  const amountAchievement =
    isMonthRange && amountTarget && amountTarget > 0 ? Math.round((sumAmount / amountTarget) * 100) : null;

  const unitTarget = resolveTargetValue(targetRecords, 'reuse', '平均単価', storeName, staffId, range);
  const unitAchievement = unitTarget && unitTarget > 0 ? Math.round((avgUnit / unitTarget) * 100) : null;

  const totalAmount: AmountMetricResult = {
    kpiKey: '買取総額',
    label: '買取総額（税込）',
    amount: sumAmount,
    target: amountTarget,
    achievement: amountAchievement,
    percentDiff: prevSumAmount > 0 ? round1(((sumAmount - prevSumAmount) / prevSumAmount) * 100) : null,
  };

  const avgUnitPrice: AmountMetricResult = {
    kpiKey: '平均単価',
    label: '平均買取単価',
    amount: avgUnit,
    target: unitTarget,
    achievement: unitAchievement,
    percentDiff: prevAvgUnit > 0 ? round1(((avgUnit - prevAvgUnit) / prevAvgUnit) * 100) : null,
  };

  // 平均達成率（査定0件スタッフ・店舗は除外）
  const achievementsPool: number[] = [];
  if (totalAssessments > 0) {
    if (assessmentAchievement !== null) achievementsPool.push(assessmentAchievement);
    if (closingMetric.achievement !== null) achievementsPool.push(closingMetric.achievement);
    if (closingMetric.proposalAchievement !== null) achievementsPool.push(closingMetric.proposalAchievement);
    if (amountAchievement !== null) achievementsPool.push(amountAchievement);
    if (unitAchievement !== null) achievementsPool.push(unitAchievement);
    if (reviewMetric.achievement !== null) achievementsPool.push(reviewMetric.achievement);
    if (reviewMetric.proposalAchievement !== null) achievementsPool.push(reviewMetric.proposalAchievement);
    for (const ext of extraItemMetrics) {
      if (ext.achievement !== null) achievementsPool.push(ext.achievement);
    }
  }

  const avgAchievement =
    totalAssessments > 0 && achievementsPool.length > 0
      ? Math.round(achievementsPool.reduce((acc, v) => acc + v, 0) / achievementsPool.length)
      : null;

  return {
    totalVisits,
    totalAssessments,
    assessmentsDiffPercent,
    assessmentRate,
    assessmentTarget,
    assessmentAchievement,
    closingMetric,
    reviewMetric,
    extraItemMetrics,
    totalAmount,
    avgUnitPrice,
    avgAchievement,
  };
}

export function extractUnmetFromHealthcare(summary: HealthcareKpiSummary): UnmetKpiDetail[] {
  if (summary.totalVisits === 0) return [];
  const unmet: UnmetKpiDetail[] = [];
  for (const m of summary.orderedItemMetrics) {
    if (m.achievement !== null && m.achievement < 100) {
      unmet.push({
        kpiKey: `${m.itemKey}_獲得率`,
        label: `${m.label}（獲得）`,
        actualDisplay: `${m.rate}%`,
        achievement: m.achievement,
      });
    }
    if (m.proposalAchievement !== null && m.proposalAchievement < 100) {
      const suffix = m.itemKey === '口コミ' ? '案内' : '提案';
      unmet.push({
        kpiKey: `${m.itemKey}_提案率`,
        label: `${m.label}（${suffix}）`,
        actualDisplay: `${m.proposalRate}%`,
        achievement: m.proposalAchievement,
      });
    }
  }
  return unmet;
}

export function extractUnmetFromReuse(summary: ReuseKpiSummary, isMonthRange: boolean): UnmetKpiDetail[] {
  if (summary.totalAssessments === 0) return [];
  const unmet: UnmetKpiDetail[] = [];

  if (summary.assessmentAchievement !== null && summary.assessmentAchievement < 100) {
    unmet.push({
      kpiKey: '査定実施率',
      label: '査定実施率',
      actualDisplay: `${summary.assessmentRate}%`,
      achievement: summary.assessmentAchievement,
    });
  }
  if (summary.closingMetric.achievement !== null && summary.closingMetric.achievement < 100) {
    unmet.push({
      kpiKey: '提案・成約_獲得率',
      label: `${summary.closingMetric.label}（成約）`,
      actualDisplay: `${summary.closingMetric.rate}%`,
      achievement: summary.closingMetric.achievement,
    });
  }
  if (summary.closingMetric.proposalAchievement !== null && summary.closingMetric.proposalAchievement < 100) {
    unmet.push({
      kpiKey: '提案・成約_提案率',
      label: `${summary.closingMetric.label}（提案）`,
      actualDisplay: `${summary.closingMetric.proposalRate}%`,
      achievement: summary.closingMetric.proposalAchievement,
    });
  }
  if (isMonthRange && summary.totalAmount.achievement !== null && summary.totalAmount.achievement < 100) {
    unmet.push({
      kpiKey: '買取総額',
      label: '買取総額',
      actualDisplay: `¥${summary.totalAmount.amount.toLocaleString()}`,
      achievement: summary.totalAmount.achievement,
    });
  }
  if (summary.avgUnitPrice.achievement !== null && summary.avgUnitPrice.achievement < 100) {
    unmet.push({
      kpiKey: '平均単価',
      label: '平均単価',
      actualDisplay: `¥${summary.avgUnitPrice.amount.toLocaleString()}`,
      achievement: summary.avgUnitPrice.achievement,
    });
  }
  if (summary.reviewMetric.achievement !== null && summary.reviewMetric.achievement < 100) {
    unmet.push({
      kpiKey: '口コミ_獲得率',
      label: `${summary.reviewMetric.label}（獲得）`,
      actualDisplay: `${summary.reviewMetric.rate}%`,
      achievement: summary.reviewMetric.achievement,
    });
  }
  if (summary.reviewMetric.proposalAchievement !== null && summary.reviewMetric.proposalAchievement < 100) {
    unmet.push({
      kpiKey: '口コミ_提案率',
      label: `${summary.reviewMetric.label}（案内）`,
      actualDisplay: `${summary.reviewMetric.proposalRate}%`,
      achievement: summary.reviewMetric.proposalAchievement,
    });
  }
  for (const ext of summary.extraItemMetrics) {
    if (ext.achievement !== null && ext.achievement < 100) {
      unmet.push({
        kpiKey: `${ext.itemKey}_獲得率`,
        label: `${ext.label}（獲得）`,
        actualDisplay: `${ext.rate}%`,
        achievement: ext.achievement,
      });
    }
  }

  return unmet;
}

export function buildLowKpiAlerts(
  records: ServiceRecord[],
  businessType: BusinessType,
  stores: string[],
  activeStaff: StaffMember[],
  items: ItemMasterConfig[],
  targetRecords: KpiTargetRecord[],
  range: DateRange,
  selectedStore: string,
  isMonthRange: boolean
): LowKpiAlertItem[] {
  const alerts: LowKpiAlertItem[] = [];

  for (const stName of stores) {
    if (selectedStore !== 'all' && stName !== selectedStore) continue;
    const stRecords = filterServiceRecords(records, businessType, range, stName, 'all');
    if (stRecords.length === 0) continue;

    const unmet =
      businessType === 'healthcare'
        ? extractUnmetFromHealthcare(
            calculateHealthcareSummary(stRecords, null, items, targetRecords, stName, 'all', range)
          )
        : extractUnmetFromReuse(
            calculateReuseSummary(stRecords, null, items, targetRecords, stName, 'all', range, isMonthRange),
            isMonthRange
          );

    if (unmet.length > 0) {
      const lowest = Math.min(...unmet.map((u) => u.achievement));
      alerts.push({
        id: `store_${stName}`,
        type: '店舗',
        name: stName,
        storeName: stName,
        lowestAchievement: lowest,
        level: lowest < 80 ? 'warning' : 'caution',
        unmetKpis: unmet,
      });
    }
  }

  for (const sf of activeStaff) {
    if (selectedStore !== 'all' && sf.storeName !== selectedStore) continue;
    const sfRecords = filterServiceRecords(
      records,
      businessType,
      range,
      selectedStore === 'all' ? 'all' : selectedStore,
      sf.id
    );
    if (sfRecords.length === 0) continue;

    const unmet =
      businessType === 'healthcare'
        ? extractUnmetFromHealthcare(
            calculateHealthcareSummary(sfRecords, null, items, targetRecords, sf.storeName, sf.id, range)
          )
        : extractUnmetFromReuse(
            calculateReuseSummary(sfRecords, null, items, targetRecords, sf.storeName, sf.id, range, isMonthRange),
            isMonthRange
          );

    if (unmet.length > 0) {
      const lowest = Math.min(...unmet.map((u) => u.achievement));
      alerts.push({
        id: `staff_${sf.id}`,
        type: 'スタッフ',
        name: sf.name,
        staffId: sf.id,
        storeName: sf.storeName,
        lowestAchievement: lowest,
        level: lowest < 80 ? 'warning' : 'caution',
        unmetKpis: unmet,
      });
    }
  }

  return alerts.sort((a, b) => a.lowestAchievement - b.lowestAchievement);
}

/**
 * 未提案理由集計（獲得済み・成功ステータス案件の理由は厳密に除外）
 */
export function computeReasonBreakdown(
  records: ServiceRecord[],
  items: ItemMasterConfig[],
  targetItemKey?: string
): ReasonBreakdownItem[] {
  const countsMap = new Map<string, { reason: string; itemKey: string; itemLabel: string; count: number }>();
  let total = 0;

  for (const rec of records) {
    for (const item of items) {
      if (targetItemKey && item.key !== targetItemKey) continue;
      // 獲得済み案件の理由は除外
      if (isOptionSuccess(item, rec.answers[item.key])) continue;

      const reasonText = (rec.reasons[item.key] || '').trim();
      if (!reasonText) continue;

      const mapKey = `${item.key}__${reasonText}`;
      const existing = countsMap.get(mapKey);
      if (existing) {
        existing.count += 1;
      } else {
        countsMap.set(mapKey, {
          reason: reasonText,
          itemKey: item.key,
          itemLabel: item.label,
          count: 1,
        });
      }
      total += 1;
    }
  }

  return Array.from(countsMap.values())
    .map((entry) => ({
      ...entry,
      percent: total > 0 ? Math.round((entry.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeMatrixCell(
  cellRecords: ServiceRecord[],
  businessType: BusinessType,
  kpiKey: string,
  items: ItemMasterConfig[],
  targetRecords: KpiTargetRecord[],
  storeName: string,
  staffId: string,
  range: DateRange
): MatrixCellData {
  const isMoney = kpiKey === '買取総額' || kpiKey === '平均単価';
  if (cellRecords.length === 0) {
    return { value: 0, count: 0, achievement: null, isMoney };
  }

  let val = 0;
  let denomCount = cellRecords.length;

  if (businessType === 'healthcare') {
    const [itemKey, metricType] = kpiKey.split('_');
    const item = items.find((it) => it.key === itemKey);
    if (metricType === '提案率') {
      const propCnt = cellRecords.filter((r) => isOptionProposal(item, r.answers[itemKey])).length;
      val = denomCount > 0 ? round1((propCnt / denomCount) * 100) : 0;
    } else {
      const succCnt = cellRecords.filter((r) => isOptionSuccess(item, r.answers[itemKey])).length;
      val = denomCount > 0 ? round1((succCnt / denomCount) * 100) : 0;
    }
  } else {
    const visitItem = items.find((it) => it.key === '来店・査定');
    const assessRecords =
      visitItem && visitItem.isActive
        ? cellRecords.filter((r) => isOptionSuccess(visitItem, r.answers[visitItem.key]))
        : cellRecords;
    const assessCount = assessRecords.length;

    if (kpiKey === '査定実施率') {
      val = denomCount > 0 ? round1((assessCount / denomCount) * 100) : 0;
    } else if (kpiKey === '買取総額') {
      denomCount = assessCount;
      let sum = 0;
      for (const r of assessRecords) {
        const triggered = items.some((it) => isOptionAmountTrigger(it, r.answers[it.key]));
        if (triggered && typeof r.amount === 'number') sum += r.amount;
      }
      val = sum;
    } else if (kpiKey === '平均単価') {
      denomCount = assessCount;
      const closingItem = items.find((it) => it.key === '提案・成約');
      const closed = assessRecords.filter((r) => isOptionSuccess(closingItem, r.answers['提案・成約']));
      let sum = 0;
      for (const r of closed) {
        if (typeof r.amount === 'number') sum += r.amount;
      }
      val = closed.length > 0 ? Math.round(sum / closed.length) : 0;
    } else {
      denomCount = assessCount;
      const [itemKey, metricType] = kpiKey.split('_');
      const item = items.find((it) => it.key === itemKey);
      if (assessCount === 0) {
        return { value: 0, count: 0, achievement: null, isMoney };
      }
      if (metricType === '提案率') {
        const propCnt = assessRecords.filter((r) => isOptionProposal(item, r.answers[itemKey])).length;
        val = round1((propCnt / assessCount) * 100);
      } else {
        const succCnt = assessRecords.filter((r) => isOptionSuccess(item, r.answers[itemKey])).length;
        val = round1((succCnt / assessCount) * 100);
      }
    }
  }

  const target = resolveTargetValue(targetRecords, businessType, kpiKey, storeName, staffId, range);
  const achievement = !isMoney && target && target > 0 ? Math.round((val / target) * 100) : null;

  return {
    value: val,
    count: denomCount,
    achievement,
    isMoney,
  };
}

export function formatRecordReasonSummary(rec: ServiceRecord, items: ItemMasterConfig[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (isOptionSuccess(item, rec.answers[item.key])) continue;
    const r = (rec.reasons[item.key] || '').trim();
    if (r) {
      parts.push(`${item.label}: ${r}`);
    }
  }
  return parts.join(' / ');
}
