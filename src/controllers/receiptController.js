import { Upload } from '@aws-sdk/lib-storage'
import { s3Client, BUCKET_NAME } from '../config/s3.js'
import { v4 as uuidv4 } from 'uuid'
import Receipt from '../models/Receipt.js'

export const uploadReceipt = async (req, res) => {
  try {
    const { siteId } = req.body
    const file = req.file
    const userId = req.user.id

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

    await Receipt.create({
      siteId,
      userId,
      key,
      fileUrl,
      originalName: file.originalname,
    })

    res.status(200).json({ message: 'Receipt uploaded', key, fileUrl })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error uploading receipt' })
  }
}

export const getReceipts = async (req, res) => {
  try {
    const userId = req.user.id
    const { siteId } = req.query
    const filter = { userId }
    if (siteId) filter.siteId = Number(siteId)
    const receipts = await Receipt.find(filter).sort({ createdAt: -1 })
    res.status(200).json({ receipts })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching receipts' })
  }
}
