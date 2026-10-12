import { S3Client } from '@aws-sdk/client-s3'

// S3_ENDPOINT is only for local testing against an S3-compatible server
// (e.g. MinIO in Docker); production talks to AWS and leaves it unset.
const endpoint = process.env.S3_ENDPOINT || undefined

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  ...(endpoint && { endpoint, forcePathStyle: true }),
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

export const BUCKET_NAME = process.env.S3_BUCKET_NAME
