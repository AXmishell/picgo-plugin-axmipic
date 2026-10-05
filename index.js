'use strict'

// PicGo / PicList 上传器插件：AXmiPic
//
// 通过 AXmiPic 的 multipart 上传接口（POST {baseUrl}/api/v1/upload，字段名 file）
// 上传图片，鉴权使用长期 API 令牌（Authorization: Bearer <token>）。

const UPLOADER_ID = 'axmipic'
const CONFIG_KEY = 'picBed.axmipic'
const DEFAULT_BASE_URL = 'https://axmipic.gpcn.cc'

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function toBuffer(img) {
  if (img.buffer) {
    return Buffer.isBuffer(img.buffer) ? img.buffer : Buffer.from(img.buffer)
  }
  if (img.base64Image) {
    return Buffer.from(img.base64Image, 'base64')
  }
  return null
}

// PicGo 的 ctx.request 在非 2xx 时会 reject，错误对象形如
// { message, statusCode, response: { statusCode, body } }。这里尽量取出服务端返回的 message。
function errorMessage(err) {
  if (!err) return '未知错误'
  const body = err.response && err.response.body
  if (body && typeof body === 'object' && body.message) return body.message
  if (typeof body === 'string' && body) {
    try {
      const parsed = JSON.parse(body)
      if (parsed && parsed.message) return parsed.message
    } catch (e) {
      // 忽略非 JSON 响应体
    }
  }
  if (err.message) return err.message
  return String(err)
}

async function uploadOne(ctx, baseUrl, token, buffer, fileName) {
  if (typeof ctx.request !== 'function') {
    throw new Error('当前 PicGo 环境不支持 ctx.request，请升级 PicGo')
  }
  const res = await ctx.request({
    method: 'POST',
    url: `${baseUrl}/api/v1/upload`,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'PicGo',
    },
    formData: {
      file: { value: buffer, options: { filename: fileName } },
    },
    json: true,
  })
  if (!res || res.code !== 0 || !res.data || !res.data.url) {
    throw new Error((res && res.message) || 'AXmiPic 返回了意外的响应')
  }
  return res.data.url
}

const handle = async (ctx) => {
  const config = ctx.getConfig(CONFIG_KEY) || {}
  const baseUrl = normalizeBaseUrl(config.baseUrl || DEFAULT_BASE_URL)
  const token = String(config.token || '').trim()
  if (!token) {
    throw new Error('请先配置 AXmiPic API 令牌（在 AXmiPic「令牌」页面创建）')
  }

  try {
    for (const img of ctx.output) {
      const buffer = toBuffer(img)
      if (!buffer) continue
      const fileName = img.fileName || `image-${Date.now()}`
      img.imgUrl = await uploadOne(ctx, baseUrl, token, buffer, fileName)
      delete img.buffer
      delete img.base64Image
    }
    return ctx
  } catch (err) {
    const message = errorMessage(err)
    if (typeof ctx.emit === 'function') {
      ctx.emit('notification', { title: 'AXmiPic 上传失败', body: message })
    }
    const wrapped = new Error(message)
    wrapped.cause = err
    throw wrapped
  }
}

const config = (ctx) => {
  const userConfig = ctx.getConfig(CONFIG_KEY) || {}
  return [
    {
      name: 'baseUrl',
      type: 'input',
      required: true,
      alias: '站点地址',
      message: 'AXmiPic 站点根地址，如 https://axmipic.gpcn.cc',
      default: userConfig.baseUrl || DEFAULT_BASE_URL,
    },
    {
      name: 'token',
      type: 'password',
      required: true,
      alias: 'API 令牌',
      message: '在 AXmiPic「令牌」页面创建后粘贴',
      default: userConfig.token || '',
    },
  ]
}

module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register(UPLOADER_ID, {
      handle,
      config,
      name: 'AXmiPic',
    })
  }
  return { register, uploader: UPLOADER_ID }
}
