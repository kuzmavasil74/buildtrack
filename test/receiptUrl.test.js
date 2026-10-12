import test from 'node:test'
import assert from 'node:assert/strict'
import { S3Client } from '@aws-sdk/client-s3'
import { signReceiptUrl, withViewUrls, RECEIPT_URL_TTL_SECONDS } from '../src/utils/receiptUrl.js'

const client = new S3Client({
  region: 'eu-central-1',
  credentials: { accessKeyId: 'AKIDTEST', secretAccessKey: 'secret' },
})

test('a signed receipt link points at the object and expires', async () => {
  const url = new URL(await signReceiptUrl('receipts/1/abc-photo.jpg', client, 'bucket'))
  assert.match(url.hostname, /^bucket\.s3\.eu-central-1\.amazonaws\.com$/)
  assert.equal(url.pathname, '/receipts/1/abc-photo.jpg')
  assert.equal(url.searchParams.get('X-Amz-Expires'), String(RECEIPT_URL_TTL_SECONDS))
  assert.ok(url.searchParams.get('X-Amz-Signature'))
})

test('every receipt gets a viewUrl, and a signing failure does not drop it', async () => {
  const receipts = [
    { key: 'a', originalName: 'a.jpg', toObject: () => ({ key: 'a', originalName: 'a.jpg' }) },
    { key: 'b', originalName: 'b.jpg' },
  ]
  const sign = async (key) => {
    if (key === 'b') throw new Error('boom')
    return `signed:${key}`
  }
  const originalError = console.error
  console.error = () => {}
  try {
    const result = await withViewUrls(receipts, sign)
    assert.deepEqual(result, [
      { key: 'a', originalName: 'a.jpg', viewUrl: 'signed:a' },
      { key: 'b', originalName: 'b.jpg', viewUrl: null },
    ])
  } finally {
    console.error = originalError
  }
})
