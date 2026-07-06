import DailyRecord from '../models/DailyRecord.js'
import PDFDocument from 'pdfkit'
export const createRecord = async (req, res) => {
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
    res.status(500).json({ message: 'Error creating record' })
  }
}
export const getRecords = async (req, res) => {
  try {
    const userId = req.user.id
    const records = await DailyRecord.find({ userId }).sort({ date: -1 })
    res.status(200).json({ records })
  } catch (error) {
    res.status(500).json({ message: 'Error creating record' })
  }
}
export const generateReport = async (req, res) => {
  try {
    const userId = req.user.id
    const response = await DailyRecord.find({ userId })
    const pdf = new PDFDocument()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf')
    pdf.pipe(res)
    pdf.fontSize(20).text('BuildTrack Report', { align: 'center' })
    pdf.moveDown()
    response.forEach((record) => {
      pdf
        .fontSize(12)
        .text(`Date: ${new Date(record.date).toLocaleDateString()}`)
      pdf.text(`Site ID: ${record.siteId}`)
      pdf.text(
        `Workers: ${record.workersPresent} | Hours: ${record.hoursWorked}`
      )
      pdf.text(`Tasks: ${record.tasksCompleted.join(', ')}`)
      pdf.text(
        `Materials: ${record.materialsUsed
          .map((m) => `${m.name || ''} (${m.quantity || 0} ${m.unit || ''})`)
          .join(', ')}`
      )
      pdf.moveDown()
    })
    pdf.end()
  } catch (error) {
    res.status(500).json({ message: 'Error generating report' })
  }
}
