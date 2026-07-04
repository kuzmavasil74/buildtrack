import mongoose from 'mongoose'

const DailyRecordSchema = new mongoose.Schema({
  siteId: { type: Number, required: true },
  userId: { type: Number, required: true },
  date: { type: Date, required: true },
  workersPresent: { type: Number, required: true },
  hoursWorked: { type: Number, required: true },
  tasksCompleted: { type: [String], required: true },
  materialsUsed: {
    type: [{ name: String, quantity: Number, unit: String }],
    required: true,
  },
})

export default mongoose.model('DailyRecord', DailyRecordSchema)
