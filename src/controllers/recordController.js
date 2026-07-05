import DailyRecord from '../models/DailyRecord.js'

export const createRecord = async (req, res) => {
  console.log('req.body:', req.body)
  try {
    const {
      siteId,
      date,
      workersPresent,
      hoursWorked,
      tasksCompleted,
      materialsUsed,
    } = req.body
    const userId = req.user.id
    const record = await DailyRecord.create({
      siteId,
      userId,
      date,
      workersPresent,
      hoursWorked,
      tasksCompleted,
      materialsUsed,
    })
    res.status(201).json({ message: 'Record created successfully', record })
  } catch (error) {
    console.error('Record error:', error)
    res.status(500).json({ message: 'Error creating record' })
  }
}
