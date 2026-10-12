import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client, BUCKET_NAME } from '../config/s3.js'

// The receipts bucket is private, so the stored `fileUrl` cannot be opened in
// a browser. The list endpoint hands out short-lived signed links instead;
// signing happens locally (no S3 round trip), so it is cheap per receipt.
export const RECEIPT_URL_TTL_SECONDS = 60 * 60

export const signReceiptUrl = (key, client = s3Client, bucket = BUCKET_NAME) =>
  getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: 'inline' }),
    { expiresIn: RECEIPT_URL_TTL_SECONDS }
  )

// Plain receipt objects plus a `viewUrl`. A receipt whose link cannot be
// signed is still listed, just without a picture.
export const withViewUrls = (receipts, sign = signReceiptUrl) =>
  Promise.all(
    receipts.map(async (receipt) => {
      const plain = typeof receipt.toObject === 'function' ? receipt.toObject() : receipt
      try {
        return { ...plain, viewUrl: await sign(plain.key) }
      } catch (error) {
        console.error('Could not sign receipt URL', plain.key, error)
        return { ...plain, viewUrl: null }
      }
    })
  )
