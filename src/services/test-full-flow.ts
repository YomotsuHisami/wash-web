import { recognizeShoe } from './qwen';
import { applyDefaults, calculateOrderFee } from './pricing';
import fs from 'fs';
import path from 'path';

async function testFullFlow() {
  try {
    const testImagePath = path.join(process.cwd(), 'public', 'shoe1.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      console.error(`测试图片不存在: ${testImagePath}`);
      return;
    }

    const buffer = fs.readFileSync(testImagePath);
    console.log('--- 第一步：调用千问视觉模型识别图片 ---');
    const aiResult = await recognizeShoe(buffer, 'image/jpeg');
    console.log('AI 原始识别结果:', JSON.stringify(aiResult, null, 2));

    console.log('\n--- 第二步：应用业务默认值并补全数据 ---');
    const fullData = applyDefaults(aiResult);
    console.log('补全后的完整数据:', JSON.stringify(fullData, null, 2));

    console.log('\n--- 第三步：计算最终清洗费用明细 ---');
    const feeResult = calculateOrderFee(fullData, 5); // 假设距离 5km
    console.log('最终费用结果:', JSON.stringify(feeResult, null, 2));

  } catch (error) {
    console.error('全流程测试失败:', error);
  }
}

testFullFlow();
