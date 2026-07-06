import { Upload } from '@aws-sdk/lib-storage'
import { s3Client, BUCKET_NAME } from '../config/s3.js'
import { v4 as uuidv4 } from 'uuid'

export const uploadReceipt = async (req, res) => {
  try {
    const { siteId } = req.body
    const file = req.file

    if (!file) return res.status(400).json({ message: 'No file provided' })

    const key = `receipts/${siteId}/${uuidv4()}-${file.originalname}`

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    })

    await upload.done()

    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`

    res.status(200).json({ message: 'Receipt uploaded', key, fileUrl })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error uploading receipt' })
  }
}
