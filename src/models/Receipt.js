import mongoose from 'mongoose'

const receiptSchema = new mongoose.Schema(
  {
    siteId: { type: Number, required: true },
    // Who uploaded it; null once they deleted their account.
    userId: { type: Number, default: null },
    companyId: { type: Number, index: true },
    key: { type: String, required: true },
    fileUrl: { type: String, required: true },
    originalName: { type: String },
  },
  { timestamps: true }
)

export default mongoose.model('Receipt', receiptSchema)
