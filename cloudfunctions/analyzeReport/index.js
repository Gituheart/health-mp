const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ========== 配置项 ==========
// 在微信云开发控制台 -> 云函数 -> 环境变量 中配置以下两个变量
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY
if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
  throw new Error('Missing required env vars: TENCENT_SECRET_ID, TENCENT_SECRET_KEY')
}
// ============================

const OcrClient = tencentcloud.ocr.v20181119.Client
const HunyuanClient = tencentcloud.hunyuan.v20230901.Client

const ocrClient = new OcrClient({
  credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
  region: 'ap-guangzhou',
  profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } }
})

const hunyuanClient = new HunyuanClient({
  credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
  region: 'ap-guangzhou',
  profile: { httpProfile: { endpoint: 'hunyuan.tencentcloudapi.com' } }
})

// OCR 识别单张图片
async function ocrImage(fileID) {
  const { fileList } = await cloud.getTempFileURL({ fileList: [fileID] })
  const imageUrl = fileList[0].tempFileURL

  const result = await ocrClient.GeneralAccurateOCR({ ImageUrl: imageUrl })
  const texts = result.TextDetections.map(item => item.DetectedText)
  return texts.join('\n')
}

// 腾讯混元分析报告
async function analyzeWithHunyuan(ocrText) {
  const result = await hunyuanClient.ChatCompletions({
    Model: 'hunyuan-lite',
    Messages: [
      {
        Role: 'system',
        Content: '你是一位专业的健康顾问，擅长分析体检报告。请用简单通俗的语言回答，让65岁的老年人也能看懂。'
      },
      {
        Role: 'user',
        Content: `请分析以下体检报告内容：

${ocrText}

请按以下格式输出：

## 检查项目摘要
用通俗语言解释每项主要指标的含义和结果。

## 异常指标
列出所有异常或偏高/偏低的指标，说明可能的原因。

## 健康建议
给出饮食、运动、生活习惯方面的建议。

## 复查建议
建议需要复查的项目和时间周期。

## 需要关注
如果有需要尽快就医的情况，请特别标注。`
      }
    ]
  })

  return result.Choices[0].Message.Content
}

exports.main = async (event) => {
  const { fileIDs } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    // 1. OCR 识别所有图片
    const ocrResults = []
    for (const fileID of fileIDs) {
      const text = await ocrImage(fileID)
      ocrResults.push(text)
    }
    const fullText = ocrResults.join('\n\n--- 下一页 ---\n\n')

    // 2. 混元分析
    const analysis = await analyzeWithHunyuan(fullText)

    // 3. 存入数据库
    const report = {
      openid: wxContext.OPENID,
      image_urls: fileIDs,
      ocr_text: fullText,
      ai_analysis: analysis,
      createdAt: db.serverDate()
    }

    const { _id } = await db.collection('reports').add({ data: report })

    return { success: true, reportId: _id, analysis }
  } catch (err) {
    console.error('分析报告失败', err)
    return { success: false, error: err.message }
  }
}
