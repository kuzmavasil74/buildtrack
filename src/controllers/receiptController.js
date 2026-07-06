import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client, BUCKET_NAME } from '../config/s3.js'
import { v4 as uuidv4 } from 'uuid'

export const getUploadUrl = async (req, res) => {
  try {
    const { siteId, fileType } = req.body
    const key = `receipts/${siteId}/${uuidv4()}.${fileType}`

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: `image/${fileType}`,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })

    res.status(200).json({ uploadUrl, key })
  } catch (error) {
    res.status(500).json({ message: 'Error generating upload URL' })
  }
}
