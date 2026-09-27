import mongoose from 'mongoose'

// One line per person for the day: their own hours, optional start/end and note.
const EntrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startTime: { type: String },
    endTime: { type: String },
    hours: { type: Number, required: true },
    rate: { type: Number },
    note: { type: String },
  },
  { _id: false }
)

const DailyRecordSchema = new mongoose.Schema({
  siteId: { type: Number, required: true },
  userId: { type: Number, required: true },
  crewId: { type: Number },
  date: { type: Date, required: true },
  // Derived from `entries` when they are present (legacy records store them directly).
  workersPresent: { type: Number, required: true },
  hoursWorked: { type: Number, required: true },
  // Description of the work done on the site.
  tasksCompleted: { type: [String], default: [] },
  // Description of the work done by the crew.
  crewNote: { type: String },
  entries: { type: [EntrySchema], default: [] },
  materialsUsed: {
    type: [{ name: String, quantity: Number, unit: String }],
    default: [],
  },
})

export default mongoose.model('DailyRecord', DailyRecordSchema)
