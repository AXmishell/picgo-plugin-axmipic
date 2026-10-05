'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const plugin = require('../index.js')

function createCtx(options = {}) {
  const ctx = {
    output: options.output || [],
    getConfig: (key) => (key === 'picBed.axmipic' ? options.config : undefined),
    request: options.request,
    emit: options.emit || (() => {}),
    helper: {
      uploader: {
        register: (id, impl) => {
          ctx.registered = { id, impl }
        },
      },
    },
  }
  return ctx
}

test('注册 axmipic 上传器', () => {
  const ctx = createCtx()
  const mod = plugin(ctx)
  assert.equal(mod.uploader, 'axmipic')

  mod.register()
  assert.equal(ctx.registered.id, 'axmipic')
  assert.equal(ctx.registered.impl.name, 'AXmiPic')
  assert.equal(typeof ctx.registered.impl.handle, 'function')
  assert.equal(typeof ctx.registered.impl.config, 'function')
})

test('上传 buffer 并写入 imgUrl', async () => {
  let captured
  const ctx = createCtx({
    config: { baseUrl: 'https://example.com/', token: 'tok-123' },
    output: [{ buffer: Buffer.from('hello'), fileName: 'photo.png' }],
    request: async (opts) => {
      captured = opts
      return { code: 0, message: 'ok', data: { url: 'https://example.com/i/photo.png' } }
    },
  })
  plugin(ctx).register()
  await ctx.registered.impl.handle(ctx)

  assert.equal(captured.method, 'POST')
  assert.equal(captured.url, 'https://example.com/api/v1/upload')
  assert.equal(captured.headers.Authorization, 'Bearer tok-123')
  assert.equal(captured.formData.file.options.filename, 'photo.png')
  assert.ok(Buffer.isBuffer(captured.formData.file.value))
  assert.equal(ctx.output[0].imgUrl, 'https://example.com/i/photo.png')
  assert.equal(ctx.output[0].buffer, undefined)
})

test('支持 base64Image 输出', async () => {
  const ctx = createCtx({
    config: { baseUrl: 'https://example.com', token: 't' },
    output: [{ base64Image: Buffer.from('data').toString('base64'), fileName: 'a.jpg' }],
    request: async () => ({ code: 0, data: { url: 'https://example.com/i/a.jpg' } }),
  })
  plugin(ctx).register()
  await ctx.registered.impl.handle(ctx)

  assert.equal(ctx.output[0].imgUrl, 'https://example.com/i/a.jpg')
  assert.equal(ctx.output[0].base64Image, undefined)
})

test('缺少令牌时拒绝上传', async () => {
  const ctx = createCtx({ config: { baseUrl: 'https://example.com' }, output: [] })
  plugin(ctx).register()
  await assert.rejects(() => ctx.registered.impl.handle(ctx), /令牌/)
})

test('业务错误会透出 message 并发出通知', async () => {
  const notifications = []
  const ctx = createCtx({
    config: { baseUrl: 'https://example.com', token: 't' },
    output: [{ buffer: Buffer.from('x'), fileName: 'x.png' }],
    request: async () => ({ code: 413, message: 'file too large', data: null }),
    emit: (name, payload) => notifications.push({ name, payload }),
  })
  plugin(ctx).register()
  await assert.rejects(() => ctx.registered.impl.handle(ctx), /file too large/)

  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].name, 'notification')
  assert.equal(notifications[0].payload.title, 'AXmiPic 上传失败')
})

test('从 HTTP 错误响应中提取 message', async () => {
  const ctx = createCtx({
    config: { baseUrl: 'https://example.com', token: 't' },
    output: [{ buffer: Buffer.from('x'), fileName: 'x.png' }],
    request: async () => {
      const err = new Error('Request failed with status code 401')
      err.response = { statusCode: 401, body: { code: 401, message: 'unauthorized' } }
      throw err
    },
  })
  plugin(ctx).register()
  await assert.rejects(() => ctx.registered.impl.handle(ctx), /unauthorized/)
})

test('config 暴露 baseUrl 与 token 字段', () => {
  const ctx = createCtx({ config: { baseUrl: 'https://x', token: 'abc' } })
  plugin(ctx).register()
  const fields = ctx.registered.impl.config(ctx)

  assert.deepEqual(fields.map((f) => f.name), ['baseUrl', 'token'])
  assert.equal(fields[1].type, 'password')
  assert.equal(fields[0].required, true)
  assert.equal(fields[0].default, 'https://x')
})
