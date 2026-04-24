import { ShoeRawData } from './qwen.ts';

/**
 * 补全默认值后的完整数据结构
 */
export interface ShoeData {
  shoeType: string;
  brand: string;
  model: string;                // 具体型号
  series: string;               // 系列
  confidence: number;           // 置信度
  materials: Array<{ part: string; material: string }>;
  wearLevel: '轻度' | '中度' | '重度';
  conditionSummary: string;     // 整体鞋况总结
  careTip: string;              // 洗护小贴士
  damages: Array<{ id: string; type: string; severity: '轻度' | '中度' | '重度'; surcharge: number; note: string }>;
  renewalScore: number;         // 焕新分数
  estimatedTurnaround: string;  // 预估耗时
  pricing: {
    baseFee: number;            // 基础清洗费
    manualReviewNote: string;   // 人工复核提示语
  };
}

/**
 * 费用计算结果明细
 */
export interface FeeResult {
  total: number;
  breakdown: {
    baseFee: number;
    materialSurcharge: number;
    damageSurcharge: number;
    brandPremium: number;
    logisticsFee: number;
  };
  estimatedTurnaround: string;
}

// --- 定价与规则常量配置 ---

const BASE_FEES: Record<string, number> = {
  '运动鞋': 15,
  '帆布鞋': 12,
  '板鞋': 14,
  '皮鞋': 18,
  '休闲鞋': 14,
  '凉鞋': 10,
  '靴子': 20,
  '其他': 15,
};

const MATERIAL_RULES = [
  { keywords: ['麂皮', '反毛皮', '翻毛皮'], fee: 6 },
  { keywords: ['漆皮'], fee: 4 },
  { keywords: ['真皮', '头层牛皮', '小牛皮'], fee: 3 },
  { keywords: ['编织', 'Primeknit', 'Flyknit'], fee: 2 },
];

const DAMAGE_PRICING: Record<string, number> = {
  '氧化': 4,
  '发黄': 4,
  '顽固污渍': 5,
  '油渍': 5,
  '划痕': 6,
  '破损': 6,
  '开胶': 8,
  '霉斑': 8,
  '其他': 3,
};

const BRAND_PREMIUM_RULES = [
  { keywords: ['louis vuitton', 'gucci', 'dior', 'balenciaga'], ratio: 1.5 },
  { keywords: ['air jordan', 'yeezy'], ratio: 1.3 },
];

const LOGISTICS_RANGES = [
  { max: 3, fee: 0 },
  { max: 8, fee: 3 },
  { max: 15, fee: 5 },
  { max: Infinity, fee: 8 },
];

const DEFAULT_MATERIALS = [{ part: '鞋面', material: '合成革/网布' }];

function getDamageSurchargeByType(type: string) {
  for (const [keyword, price] of Object.entries(DAMAGE_PRICING)) {
    if (keyword !== '其他' && type.includes(keyword)) {
      return price;
    }
  }

  return DAMAGE_PRICING['其他'];
}

// --- 核心函数实现 ---

/**
 * 将 AI 原始识别数据补全为完整的业务对象
 */
export function applyDefaults(raw: Partial<ShoeRawData>): ShoeData {
  const shoeType = raw.shoeType || '运动鞋';
  const freshnessScore = raw.freshnessScore ?? 7.5;
  const materials =
    Array.isArray(raw.materials) && raw.materials.length > 0
      ? raw.materials
          .filter((item): item is string => typeof item === 'string' && !!item.trim())
          .map((material, index) => ({
            part: index === 0 ? '鞋面' : `关键部位${index}`,
            material: material.trim(),
          }))
      : DEFAULT_MATERIALS;
  
  // 焕新分数映射
  const renewalScore = freshnessScore * 10;
  
  // 磨损等级映射：>=8 为“轻度”，>=5 为“中度”，否则为“重度”
  let wearLevel: '轻度' | '中度' | '重度' = '中度';
  if (freshnessScore >= 8) wearLevel = '轻度';
  else if (freshnessScore < 5) wearLevel = '重度';

  // 污损项转换
  const damages = (raw.damages || []).map((d, index) => ({
    id: `d${index + 1}`,
    type: d,
    severity: '中度' as const,
    surcharge: getDamageSurchargeByType(d),
    note: '',
  }));

  return {
    shoeType,
    brand: raw.brand?.trim() || '无', // 严格不猜测品牌
    model: '未知型号',
    series: '未知系列',
    confidence: 60,
    materials,
    wearLevel,
    conditionSummary: '鞋身有日常穿着痕迹，局部轻微污渍，整体状态良好。',
    careTip: '建议使用中性清洁剂配合软毛刷整体清洗，避免长时间浸泡。',
    damages,
    renewalScore,
    estimatedTurnaround: '2-3天',
    pricing: {
      baseFee: BASE_FEES[shoeType] || 15,
      manualReviewNote: '平台将结合人工复核确认最终价格，多退少补。',
    },
  };
}

/**
 * 计算最终清洗费用及耗时
 */
export function calculateOrderFee(data: ShoeData, logisticsDistance: number = 5): FeeResult {
  // 1. 基础费
  const baseFee = BASE_FEES[data.shoeType] || 15;

  // 2. 材质附加费（最多累加两项）
  let materialSurcharge = 0;
  let materialMatchCount = 0;
  for (const m of data.materials) {
    if (materialMatchCount >= 2) break;
    for (const rule of MATERIAL_RULES) {
      if (rule.keywords.some(k => m.material.includes(k))) {
        materialSurcharge += rule.fee;
        materialMatchCount++;
        break;
      }
    }
  }

  // 3. 污损附加费
  let damageSurcharge = 0;
  data.damages.forEach(d => {
    if (d.surcharge > 0) {
      damageSurcharge += d.surcharge;
    } else {
      // 按关键词定价
      let fee = DAMAGE_PRICING['其他'];
      for (const [kw, price] of Object.entries(DAMAGE_PRICING)) {
        if (d.type.includes(kw)) {
          fee = price;
          break;
        }
      }
      damageSurcharge += fee;
    }
  });

  // 4. 品牌溢价
  let ratio = 1.0;
  const brandLower = data.brand.toLowerCase();
  for (const rule of BRAND_PREMIUM_RULES) {
    if (rule.keywords.some(k => brandLower.includes(k))) {
      ratio = rule.ratio;
      break;
    }
  }
  const brandPremium = Math.round(baseFee * (ratio - 1));

  // 5. 物流费
  const logisticsFee = LOGISTICS_RANGES.find(r => logisticsDistance <= r.max)?.fee ?? 8;

  // 总计（四舍五入取整）
  const total = Math.round(baseFee + materialSurcharge + damageSurcharge + brandPremium + logisticsFee);

  // --- 预估耗时计算 ---
  // 基础耗时：轻度 24h，中度 36h，重度 48h
  const baseHoursMap = { '轻度': 24, '中度': 36, '重度': 48 };
  let totalHours = baseHoursMap[data.wearLevel];

  // 每项污损增加：轻度 +2h，中度 +3h，重度 +4h
  data.damages.forEach(d => {
    const addMap = { '轻度': 2, '中度': 3, '重度': 4 };
    totalHours += addMap[d.severity];
  });

  // 向上取整到半天 (12h)
  const roundedHours = Math.ceil(totalHours / 12) * 12;
  const days = roundedHours / 24;
  const estimatedTurnaround = `${days}天`;

  return {
    total,
    breakdown: {
      baseFee,
      materialSurcharge,
      damageSurcharge,
      brandPremium,
      logisticsFee,
    },
    estimatedTurnaround,
  };
}

// --- 示例验证 ---
if (process.argv[1].endsWith('pricing.ts')) {
  const testRaw: Partial<ShoeRawData> = {
    shoeType: '板鞋',
    materials: ['麂皮', '真皮'],
    damages: ['鞋边氧化']
  };

  const fullData = applyDefaults(testRaw);
  const result = calculateOrderFee(fullData, 5);

  console.log('--- 示例验证 ---');
  console.log('输入:', JSON.stringify(testRaw, null, 2));
  console.log('预期结果: total 21, damageSurcharge 4, logisticsFee 3, turnaround 2天');
  console.log('实际结果:', JSON.stringify(result, null, 2));
}
