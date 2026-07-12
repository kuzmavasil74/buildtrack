import mongoose from 'mongoose'

const receiptSchema = new mongoose.Schema(
  {
    siteId: { type: Number, required: true },
    userId: { type: Number, required: true },
    key: { type: String, required: true },
    fileUrl: { type: String, required: true },
    originalName: { type: String },
  },
  { timestamps: true }
)

export default mongoose.model('Receipt', receiptSchema)
