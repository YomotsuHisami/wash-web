import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config();

/**
 * 数据类型定义：AI 可能返回的原始字段（允许缺失）
 */
export interface ShoeRawData {
  recognitionStatus?: 'ok' | 'retake';
  retakeReason?: string;
  shoeType?: string;        // 鞋子大类：运动鞋、帆布鞋、板鞋、皮鞋、休闲鞋、凉鞋、靴子、其他
  brand?: string;           // 品牌名字，如果不认识就给“无”
  materials?: string[];     // 可见材质列表
  freshnessScore?: number;  // 焕新程度，0到10，可带 0.5
  damages?: string[];       // 污损描述
}

// 从环境变量读取 API Key
const apiKey = process.env.DASHSCOPE_API_KEY;
const visionModel = process.env.DASHSCOPE_VISION_MODEL || 'Qwen3.6-Plus';

// 创建 OpenAI 客户端实例（兼容千问）
const openai = new OpenAI({
  apiKey: apiKey || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const SYSTEM_PROMPT = `你是一位洗鞋门店的鞋况识别助手。你的任务是根据用户上传的图片，判断是否能够识别鞋子；如果能识别，再输出鞋况 JSON。你必须输出一个且仅一个 JSON 对象，不要输出任何解释、前后缀、Markdown、代码块或额外文本。

输出目标：
先判断图片里是否有清晰、可识别的鞋子主体；若无法确认是鞋子，或鞋子主体太模糊、太远、遮挡严重、画面主体错误，则不要强行识别，直接要求用户重新拍摄。

请严格区分以下两种输出：

A. 可以识别鞋子时：
输出一个 JSON 对象，字段只允许包含：
- recognitionStatus
- shoeType
- brand
- materials
- freshnessScore
- damages

其中 recognitionStatus 必须为 "ok"。

B. 无法确认是鞋子，或不适合识别时：
输出一个 JSON 对象，字段只允许包含：
- recognitionStatus
- retakeReason

其中 recognitionStatus 必须为 "retake"。
retakeReason 必须是简短中文提示，例如：
- 未识别到清晰鞋子，请重新拍摄鞋子主体
- 图片过于模糊，请靠近鞋子重新拍摄
- 鞋子主体被遮挡，请换个角度重新拍摄

请严格遵守以下规则：

1. 输出格式必须是合法 JSON。

2. 如果图片里不能明确看出鞋子主体，必须返回重拍结果，不允许猜测，不允许把其他物体强行识别成鞋子。

3. 只有在能明确看出鞋子主体时，才允许输出鞋况字段。

4. 输出鞋况时，对象字段只允许包含：
- recognitionStatus
- shoeType
- brand
- materials
- freshnessScore
- damages

5. shoeType 必须且只能从以下选项中选择一个：
运动鞋、帆布鞋、板鞋、皮鞋、休闲鞋、凉鞋、靴子、其他

6. brand 规则：
- 能明确识别就填写品牌名
- 无法确认时必须填写 "无"
- 禁止猜测、禁止编造

7. materials 规则：
- 只填写图片中肉眼可见、较确定的鞋面或关键外露材质
- 优先使用这些常见材质词：皮革、麂皮、网布、帆布、合成革、漆皮、编织、真皮、反毛皮
- 可返回多个材质，使用数组
- 如果完全无法判断材质，可以省略该字段，或返回空数组
- 不要为了凑字段而猜测

8. freshnessScore 规则：
- 返回 0 到 10 的数字
- 允许使用 0.5 精度，例如 7.5
- 分数越高表示整体越新、越容易清洗恢复

9. damages 规则：
- 返回数组，每项是简短中文描述
- 只描述看得见的污损、氧化、发黄、划痕、磨损、褶皱、油渍、开胶等
- 最多返回 5 项
- 没有明显污损时返回空数组

10. 你不负责定价，不要输出 estimatedPrice、price、fee 或任何价格字段。

11. 若某字段无法判断：
- shoeType 仍必须给出一个最合理分类
- brand 必须填 "无"
- materials 可省略或空数组
- freshnessScore 尽量给出保守判断
- damages 可为空数组

可识别示例输出：
{"recognitionStatus":"ok","shoeType":"运动鞋","brand":"无","materials":["网布","合成革"],"freshnessScore":7.5,"damages":["鞋头污渍","鞋边轻微氧化"]}

重拍示例输出：
{"recognitionStatus":"retake","retakeReason":"未识别到清晰鞋子，请重新拍摄鞋子主体"}`;

const USER_PROMPT = `请先判断这张图片是否适合识别鞋子。

如果图片里没有清晰的鞋子主体，或者无法确认是鞋子，请直接返回重拍 JSON，不要强行识别。

只有在能明确识别鞋子时，才输出鞋况 JSON。

请严格按系统要求输出唯一一个 JSON 对象。
重点关注：
1. 鞋型分类
2. 品牌是否可明确识别
3. 可见材质
4. 焕新分
5. 可见污损项

如果品牌无法确认，请直接写“无”。
如果材质看不清，可以省略 materials 或返回空数组。`;

/**
 * 调用千问视觉模型（Qwen3.6-Plus）识别鞋子图片
 * @param imageBuffer 图片二进制数据
 * @param mimeType 图片 MIME 类型（如 'image/jpeg'）
 */
export async function recognizeShoe(imageBuffer: Buffer, mimeType: string): Promise<ShoeRawData> {
  if (!apiKey) {
    throw new Error('未检测到 DASHSCOPE_API_KEY，请在 .env 文件中配置。');
  }

  // 将图片转为 Base64 并构建 Data URL
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  try {
    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: USER_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1, // 设置低随机性，保证输出稳定
    });

    let content = response.choices[0]?.message?.content || '';
    
    // --- 关键难点处理：清洗 AI 返回的内容 ---
    
    // 1. 去掉 Markdown 的 JSON 代码块标记
    content = content.replace(/```json\n?|\n?```/g, '').trim();

    // 2. 用正则提取第一个 { ... } 对象，防止 AI 多说话
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('AI 返回内容未包含 JSON 对象:', content);
      return {};
    }

    try {
      // 3. 尝试解析 JSON
      const parsed = JSON.parse(jsonMatch[0]) as ShoeRawData;
      return sanitizeShoeRawData(parsed);
    } catch (parseError) {
      console.error('JSON 解析失败，返回空对象。原始内容:', content);
      return {}; // 解析失败返回空对象，不抛错
    }

  } catch (apiError: any) {
    // 整个 API 调用过程失败（如网络、密钥等），向上抛错
    console.error('调用千问 API 失败:', apiError.message);
    throw new Error(`模型识别请求失败: ${apiError.message}`);
  }
}

function sanitizeShoeRawData(raw: ShoeRawData): ShoeRawData {
  const next: ShoeRawData = {};

  if (raw.recognitionStatus === 'retake') {
    return {
      recognitionStatus: 'retake',
      retakeReason:
        typeof raw.retakeReason === 'string' && raw.retakeReason.trim()
          ? raw.retakeReason.trim()
          : '未识别到清晰鞋子，请重新拍摄。',
    };
  }

  next.recognitionStatus = 'ok';

  if (typeof raw.shoeType === 'string' && raw.shoeType.trim()) {
    next.shoeType = raw.shoeType.trim();
  }

  if (typeof raw.brand === 'string') {
    next.brand = raw.brand.trim() || '无';
  }

  if (Array.isArray(raw.materials)) {
    next.materials = raw.materials
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof raw.freshnessScore === 'number' && Number.isFinite(raw.freshnessScore)) {
    next.freshnessScore = Math.max(0, Math.min(10, raw.freshnessScore));
  }

  if (Array.isArray(raw.damages)) {
    next.damages = raw.damages
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  return next;
}

/**
 * 本地测试代码
 * 使用方式: npx tsx src/services/qwen.ts
 */
if (process.argv[1].endsWith('qwen.ts')) {
  async function test() {
    try {
      // 请确保目录下有一张用于测试的图片
      const testImagePath = path.join(process.cwd(), 'public', 'shoe1.jpg');
      
      if (!fs.existsSync(testImagePath)) {
        console.error('测试图片不存在，请检查路径:', testImagePath);
        return;
      }

      console.log('正在读取测试图片并调用模型...');
      const buffer = fs.readFileSync(testImagePath);
      const result = await recognizeShoe(buffer, 'image/jpeg');

      console.log('--- 识别结果 ---');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('测试过程中发生错误:', err);
    }
  }

  test();
}
