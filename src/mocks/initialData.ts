import type {
  ItemsByBusinessMap,
  KpiTargetRecord,
  ReasonsByBusinessMap,
  ServiceRecord,
  StaffMember,
} from '@/types';
import { addDays, addYears, formatDateKey, formatYearMonth } from '@/utils/dateUtils';

/**
 * 決定論的疑似乱数生成器 (Mulberry32)
 * 「初期デモデータに戻す」を実行するたびに一貫したストーリー性のある実績データを生成
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createInitialStaffList(): StaffMember[] {
  return [
    // ① 事業モデルA：ヘルスケア（整骨院・サロンモデル）
    {
      id: 'S001',
      name: '佐藤 健一',
      businessType: 'healthcare',
      storeName: 'さくら通り本院',
      isActive: true,
    },
    {
      id: 'S002',
      name: '田中 陽子',
      businessType: 'healthcare',
      storeName: 'あおば駅前院',
      isActive: true,
    },
    {
      id: 'S003',
      name: '高橋 涼介',
      businessType: 'healthcare',
      storeName: 'ひまわり中央院',
      isActive: true,
    },
    // ② 事業モデルB：リユース（買取専門店モデル）
    {
      id: 'D001',
      name: '鈴木 一郎',
      businessType: 'reuse',
      storeName: '銀座中央店',
      isActive: true,
    },
    {
      id: 'D002',
      name: '伊藤 美咲',
      businessType: 'reuse',
      storeName: '新宿西口店',
      isActive: true,
    },
    {
      id: 'D003',
      name: '渡辺 翔太',
      businessType: 'reuse',
      storeName: '横浜元町店',
      isActive: true,
    },
  ];
}

export function createInitialItemMasters(): ItemsByBusinessMap {
  return {
    healthcare: [
      {
        key: '次回予約',
        label: '次回予約',
        order: 1,
        isActive: true,
        options: [
          { text: '獲得', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: false },
          { text: '提案したが未獲得', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
          { text: '未提案', order: 3, isSuccess: false, isReasonTrigger: true, isAmountTrigger: false },
        ],
      },
      {
        key: '回数券・サブスク',
        label: '回数券・サブスク',
        order: 2,
        isActive: true,
        options: [
          { text: '獲得', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: false },
          { text: '提案したが未獲得', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
          { text: '未提案', order: 3, isSuccess: false, isReasonTrigger: true, isAmountTrigger: false },
        ],
      },
      {
        key: '追加提案',
        label: '追加提案',
        order: 3,
        isActive: true,
        options: [
          { text: '獲得', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: false },
          { text: '提案したが未獲得', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
          { text: '未提案', order: 3, isSuccess: false, isReasonTrigger: true, isAmountTrigger: false },
        ],
      },
      {
        key: '口コミ',
        label: '口コミ',
        order: 4,
        isActive: true,
        options: [
          { text: '獲得', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: false },
          { text: '依頼したが未投稿', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
          { text: '未提案', order: 3, isSuccess: false, isReasonTrigger: true, isAmountTrigger: false },
        ],
      },
    ],
    reuse: [
      {
        key: '来店・査定',
        label: '来店・査定',
        order: 1,
        isActive: true,
        options: [
          { text: '査定実施', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: false },
          { text: '相談・相場確認のみ', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
        ],
      },
      {
        key: '提案・成約',
        label: '提案・成約',
        order: 2,
        isActive: true,
        options: [
          { text: '成約', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: true },
          { text: '提案したが不成立', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
          { text: '未提案', order: 3, isSuccess: false, isReasonTrigger: true, isAmountTrigger: false },
        ],
      },
      {
        key: '口コミ',
        label: '口コミ',
        order: 3,
        isActive: true,
        options: [
          { text: '獲得', order: 1, isSuccess: true, isReasonTrigger: false, isAmountTrigger: false },
          { text: '依頼したが未投稿', order: 2, isSuccess: false, isReasonTrigger: false, isAmountTrigger: false },
          { text: '未提案', order: 3, isSuccess: false, isReasonTrigger: true, isAmountTrigger: false },
        ],
      },
    ],
  };
}

export function createInitialReasonMasters(): ReasonsByBusinessMap {
  const healthcareCommon = [
    { text: '時間不足・混雑', order: 1, isActive: true },
    { text: 'お客様都合（お急ぎ）', order: 2, isActive: true },
    { text: '症状・タイミング不適合', order: 3, isActive: true },
    { text: '信頼関係構築中', order: 4, isActive: true },
    { text: 'その他', order: 5, isActive: true },
  ];

  return {
    healthcare: {
      次回予約: healthcareCommon.map((r) => ({ ...r })),
      '回数券・サブスク': healthcareCommon.map((r) => ({ ...r })),
      追加提案: healthcareCommon.map((r) => ({ ...r })),
      口コミ: [
        { text: '時間不足・混雑', order: 1, isActive: true },
        { text: 'お客様都合（お急ぎ）', order: 2, isActive: true },
        { text: 'スマホ操作不慣れ・アカウント未所持', order: 3, isActive: true },
        { text: '信頼関係構築中', order: 4, isActive: true },
        { text: 'その他', order: 5, isActive: true },
      ],
    },
    reuse: {
      '提案・成約': [
        { text: '希望額と相場の大幅な乖離', order: 1, isActive: true },
        { text: '他店比較・検討持ち帰り', order: 2, isActive: true },
        { text: '本人確認書類等の不備', order: 3, isActive: true },
        { text: '査定のみ希望・売却意思なし', order: 4, isActive: true },
        { text: 'その他', order: 5, isActive: true },
      ],
      口コミ: [
        { text: '時間不足・お急ぎ', order: 1, isActive: true },
        { text: 'Googleアカウント未所持', order: 2, isActive: true },
        { text: '操作困難・スマホ不慣れ', order: 3, isActive: true },
        { text: 'その他', order: 4, isActive: true },
      ],
    },
  };
}

export function createInitialTargetRecords(now: Date = new Date()): KpiTargetRecord[] {
  const currentYm = formatYearMonth(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = formatYearMonth(prevMonthDate);
  const twoMonthsAgoYm = formatYearMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  const updatedAt = `${formatDateKey(now).replace(/-/g, '/')} 09:00:00`;

  const yms = [twoMonthsAgoYm, prevYm, currentYm];
  const records: KpiTargetRecord[] = [];

  for (const ym of yms) {
    // ヘルスケア全社目標
    const hcCompanyTargets: Array<[string, number]> = [
      ['次回予約_獲得率', 80],
      ['次回予約_提案率', 95],
      ['回数券・サブスク_獲得率', 35],
      ['回数券・サブスク_提案率', 75],
      ['追加提案_獲得率', 30],
      ['追加提案_提案率', 70],
      ['口コミ_獲得率', 20],
      ['口コミ_提案率', 65],
    ];
    for (const [kpiKey, targetValue] of hcCompanyTargets) {
      records.push({
        yearMonth: ym,
        businessType: 'healthcare',
        targetLevel: '全社',
        targetName: '全社',
        kpiKey,
        targetValue,
        updatedAt,
      });
    }

    // ヘルスケア店舗別目標（本院は少し高め）
    records.push({
      yearMonth: ym,
      businessType: 'healthcare',
      targetLevel: '店舗',
      targetName: 'さくら通り本院',
      kpiKey: '次回予約_獲得率',
      targetValue: 82,
      updatedAt,
    });

    // リユース全社目標
    const reuseCompanyTargets: Array<[string, number]> = [
      ['査定実施率', 85],
      ['提案・成約_獲得率', 60],
      ['提案・成約_提案率', 90],
      ['買取総額', 2200000],
      ['平均単価', 60000],
      ['口コミ_獲得率', 22],
      ['口コミ_提案率', 65],
    ];
    for (const [kpiKey, targetValue] of reuseCompanyTargets) {
      records.push({
        yearMonth: ym,
        businessType: 'reuse',
        targetLevel: '全社',
        targetName: '全社',
        kpiKey,
        targetValue,
        updatedAt,
      });
    }

    // リユース店舗・スタッフ個別目標（月次買取総額）
    const reuseStores: Array<[string, number]> = [
      ['銀座中央店', 950000],
      ['新宿西口店', 750000],
      ['横浜元町店', 650000],
    ];
    for (const [storeName, amt] of reuseStores) {
      records.push({
        yearMonth: ym,
        businessType: 'reuse',
        targetLevel: '店舗',
        targetName: storeName,
        kpiKey: '買取総額',
        targetValue: amt,
        updatedAt,
      });
    }

    const reuseStaffTargets: Array<[string, number]> = [
      ['D001', 950000],
      ['D002', 750000],
      ['D003', 650000],
    ];
    for (const [staffId, amt] of reuseStaffTargets) {
      records.push({
        yearMonth: ym,
        businessType: 'reuse',
        targetLevel: 'スタッフ',
        targetName: staffId,
        kpiKey: '買取総額',
        targetValue: amt,
        updatedAt,
      });
    }
  }

  return records;
}

interface HealthcarePersona {
  staffId: string;
  staffName: string;
  storeName: string;
  skipToday: boolean;
  nextRes: [number, number]; // [successProb, proposedButNotWonProb] (remainder = unproposed)
  ticket: [number, number];
  addon: [number, number];
  review: [number, number];
  primaryReasons: Record<string, string[]>;
}

interface ReusePersona {
  staffId: string;
  staffName: string;
  storeName: string;
  skipToday: boolean;
  assessProb: number;
  closing: [number, number]; // [closedProb, proposedFailProb]
  review: [number, number];
  minPrice: number;
  maxPrice: number;
  primaryReasons: Record<string, string[]>;
}

function pickChoice(
  rand: () => number,
  probs: [number, number],
  texts: [string, string, string]
): string {
  const r = rand();
  if (r < probs[0]) return texts[0];
  if (r < probs[0] + probs[1]) return texts[1];
  return texts[2];
}

function pickWeightedReason(rand: () => number, pool: string[]): string {
  // 先頭要素ほど選ばれやすい重み付けで課題傾向を明確化
  const r = rand();
  if (r < 0.52) return pool[0];
  if (r < 0.80 && pool.length > 1) return pool[1];
  return pool[Math.floor(rand() * pool.length)];
}

export function createInitialServiceRecords(now: Date = new Date()): ServiceRecord[] {
  const rand = createSeededRandom(20261028);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = formatDateKey(today);

  // プレゼンで課題発見ストーリーが明確に語れるペルソナ設計
  const hcPersonas: HealthcarePersona[] = [
    {
      // S001 佐藤: 次回予約・回数券は非常に強いが、混雑で口コミ案内が漏れがち（口コミ未達）
      staffId: 'S001',
      staffName: '佐藤 健一',
      storeName: 'さくら通り本院',
      skipToday: false,
      nextRes: [0.86, 0.11],
      ticket: [0.40, 0.42],
      addon: [0.34, 0.42],
      review: [0.11, 0.31],
      primaryReasons: {
        次回予約: ['時間不足・混雑', 'お客様都合（お急ぎ）'],
        '回数券・サブスク': ['時間不足・混雑', '症状・タイミング不適合'],
        追加提案: ['時間不足・混雑', 'お客様都合（お急ぎ）'],
        口コミ: ['時間不足・混雑', 'お客様都合（お急ぎ）', 'スマホ操作不慣れ・アカウント未所持'],
      },
    },
    {
      // S002 田中: 口コミ獲得率・次回予約ともに安定達成、追加提案のみあと一歩（80〜99%注意ゾーン）
      staffId: 'S002',
      staffName: '田中 陽子',
      storeName: 'あおば駅前院',
      skipToday: false,
      nextRes: [0.82, 0.14],
      ticket: [0.36, 0.41],
      addon: [0.26, 0.42],
      review: [0.26, 0.48],
      primaryReasons: {
        次回予約: ['お客様都合（お急ぎ）', '症状・タイミング不適合'],
        '回数券・サブスク': ['信頼関係構築中', '症状・タイミング不適合'],
        追加提案: ['症状・タイミング不適合', '信頼関係構築中'],
        口コミ: ['スマホ操作不慣れ・アカウント未所持', 'お客様都合（お急ぎ）'],
      },
    },
    {
      // S003 高橋: 若手。信頼関係構築中・タイミング不適合を理由に提案自体を躊躇しがち（赤警告）＋本日未提出
      staffId: 'S003',
      staffName: '高橋 涼介',
      storeName: 'ひまわり中央院',
      skipToday: true,
      nextRes: [0.61, 0.15],
      ticket: [0.19, 0.31],
      addon: [0.18, 0.34],
      review: [0.14, 0.36],
      primaryReasons: {
        次回予約: ['信頼関係構築中', '症状・タイミング不適合', 'お客様都合（お急ぎ）'],
        '回数券・サブスク': ['信頼関係構築中', '症状・タイミング不適合'],
        追加提案: ['信頼関係構築中', '症状・タイミング不適合'],
        口コミ: ['信頼関係構築中', '時間不足・混雑'],
      },
    },
  ];

  const reusePersonas: ReusePersona[] = [
    {
      // D001 鈴木: 成約率・単価ともにトップクラスだが口コミ獲得率が低い
      staffId: 'D001',
      staffName: '鈴木 一郎',
      storeName: '銀座中央店',
      skipToday: false,
      assessProb: 0.90,
      closing: [0.68, 0.25],
      review: [0.13, 0.35],
      minPrice: 45000,
      maxPrice: 135000,
      primaryReasons: {
        '提案・成約': ['希望額と相場の大幅な乖離', '他店比較・検討持ち帰り'],
        口コミ: ['時間不足・お急ぎ', 'Googleアカウント未所持'],
      },
    },
    {
      // D002 伊藤: 成約率・口コミは非常に高いが、小物中心で平均買取単価が低い（単価課題ストーリー）
      staffId: 'D002',
      staffName: '伊藤 美咲',
      storeName: '新宿西口店',
      skipToday: false,
      assessProb: 0.88,
      closing: [0.65, 0.27],
      review: [0.29, 0.45],
      minPrice: 18000,
      maxPrice: 54000,
      primaryReasons: {
        '提案・成約': ['他店比較・検討持ち帰り', '査定のみ希望・売却意思なし'],
        口コミ: ['Googleアカウント未所持', '操作困難・スマホ不慣れ'],
      },
    },
    {
      // D003 渡辺: 高単価商材は扱えるが成約率・提案率が低迷（赤警告）＋本日未提出
      staffId: 'D003',
      staffName: '渡辺 翔太',
      storeName: '横浜元町店',
      skipToday: true,
      assessProb: 0.79,
      closing: [0.43, 0.28],
      review: [0.16, 0.38],
      minPrice: 42000,
      maxPrice: 98000,
      primaryReasons: {
        '提案・成約': ['他店比較・検討持ち帰り', '希望額と相場の大幅な乖離', '査定のみ希望・売却意思なし'],
        口コミ: ['時間不足・お急ぎ', '操作困難・スマホ不慣れ'],
      },
    },
  ];

  const records: ServiceRecord[] = [];
  let seq = 1;

  const generateForDay = (dayDate: Date, volumeScale = 1.0) => {
    const dateKey = formatDateKey(dayDate);
    const slashDate = dateKey.replace(/-/g, '/');
    const dayOfWeek = dayDate.getDay();

    // 水曜定休風に少し件数を抑え、土日はやや多めにするリアルな波形
    const dayFactor = dayOfWeek === 3 ? 0.5 : dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1.0;

    // 1) Healthcare records
    for (const p of hcPersonas) {
      if (dateKey === todayKey && p.skipToday) continue;
      const count = Math.max(1, Math.round((1 + rand() * 1.6) * dayFactor * volumeScale));
      for (let i = 0; i < count; i++) {
        const hh = String(10 + Math.floor(rand() * 9)).padStart(2, '0');
        const mm = String(Math.floor(rand() * 60)).padStart(2, '0');

        const ansNext = pickChoice(rand, p.nextRes, ['獲得', '提案したが未獲得', '未提案']);
        const ansTicket = pickChoice(rand, p.ticket, ['獲得', '提案したが未獲得', '未提案']);
        const ansAddon = pickChoice(rand, p.addon, ['獲得', '提案したが未獲得', '未提案']);
        const ansReview = pickChoice(rand, p.review, ['獲得', '依頼したが未投稿', '未提案']);

        const answers: Record<string, string> = {
          次回予約: ansNext,
          '回数券・サブスク': ansTicket,
          追加提案: ansAddon,
          口コミ: ansReview,
        };
        const reasons: Record<string, string> = {};
        if (ansNext === '未提案') reasons['次回予約'] = pickWeightedReason(rand, p.primaryReasons['次回予約']);
        if (ansTicket === '未提案')
          reasons['回数券・サブスク'] = pickWeightedReason(rand, p.primaryReasons['回数券・サブスク']);
        if (ansAddon === '未提案') reasons['追加提案'] = pickWeightedReason(rand, p.primaryReasons['追加提案']);
        if (ansReview === '未提案') reasons['口コミ'] = pickWeightedReason(rand, p.primaryReasons['口コミ']);

        records.push({
          submissionId: `mock_hc_${seq++}`,
          timestamp: `${slashDate} ${hh}:${mm}:00`,
          targetDate: dateKey,
          businessType: 'healthcare',
          staffId: p.staffId,
          staffName: p.staffName,
          storeName: p.storeName,
          answers,
          reasons,
          amount: null,
          source: 'mock',
        });
      }
    }

    // 2) Reuse records
    for (const p of reusePersonas) {
      if (dateKey === todayKey && p.skipToday) continue;
      const count = Math.max(1, Math.round((1 + rand() * 1.5) * dayFactor * volumeScale));
      for (let i = 0; i < count; i++) {
        const hh = String(10 + Math.floor(rand() * 8)).padStart(2, '0');
        const mm = String(Math.floor(rand() * 60)).padStart(2, '0');

        const isAssessed = rand() < p.assessProb;
        const ansVisit = isAssessed ? '査定実施' : '相談・相場確認のみ';
        const ansClosing = isAssessed
          ? pickChoice(rand, p.closing, ['成約', '提案したが不成立', '未提案'])
          : '未提案';
        const ansReview = isAssessed
          ? pickChoice(rand, p.review, ['獲得', '依頼したが未投稿', '未提案'])
          : '未提案';

        const answers: Record<string, string> = {
          '来店・査定': ansVisit,
          '提案・成約': ansClosing,
          口コミ: ansReview,
        };
        const reasons: Record<string, string> = {};
        if (ansClosing === '未提案') {
          reasons['提案・成約'] = isAssessed
            ? pickWeightedReason(rand, p.primaryReasons['提案・成約'])
            : '査定のみ希望・売却意思なし';
        }
        if (ansReview === '未提案') {
          reasons['口コミ'] = pickWeightedReason(rand, p.primaryReasons['口コミ']);
        }

        let amount: number | null = null;
        if (ansClosing === '成約') {
          const rawAmt = p.minPrice + rand() * (p.maxPrice - p.minPrice);
          amount = Math.round(rawAmt / 1000) * 1000;
        }

        records.push({
          submissionId: `mock_ru_${seq++}`,
          timestamp: `${slashDate} ${hh}:${mm}:00`,
          targetDate: dateKey,
          businessType: 'reuse',
          staffId: p.staffId,
          staffName: p.staffName,
          storeName: p.storeName,
          answers,
          reasons,
          amount,
          source: 'mock',
        });
      }
    }
  };

  // 過去62日分（約2ヶ月分）の実績を生成（各事業 約220〜260件）
  for (let offset = -61; offset <= 0; offset++) {
    generateForDay(addDays(today, offset), 1.0);
  }

  // 前年同期比モードでもリアルな比較差分が出るよう、前年同月期間にもベースライン実績を生成
  const prevYearStart = addYears(new Date(today.getFullYear(), today.getMonth() - 1, 1), -1);
  for (let offset = 0; offset < 58; offset++) {
    generateForDay(addDays(prevYearStart, offset), 0.88);
  }

  return records;
}
