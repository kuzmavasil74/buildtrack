import DailyRecord from '../models/DailyRecord.js'
import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
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
    const fontPath = path.join(__dirname, '../fonts/Roboto-Regular.ttf')
    const fontBoldPath = path.join(__dirname, '../fonts/Roboto-Bold.ttf')

    const pdf = new PDFDocument({ margin: 40 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf')
    pdf.pipe(res)
    pdf.on('error', (err) => {
      console.error('PDF stream error:', err)
      if (!res.headersSent) {
        res.status(500).json({ message: 'PDF generation failed' })
      }
    })
    pdf.registerFont('Roboto', fontPath)
    pdf.registerFont('Roboto-Bold', fontBoldPath)

    pdf
      .font('Roboto-Bold')
      .fontSize(20)
      .text('BuildTrack Report', { align: 'center' })
    pdf.moveDown()

    response.forEach((record) => {
      pdf
        .font('Roboto-Bold')
        .fontSize(13)
        .text(`Дата: ${new Date(record.date).toLocaleDateString('uk-UA')}`)
      pdf
        .font('Roboto')
        .fontSize(11)
        .text(`Об'єкт ID: ${record.siteId}`)
        .text(
          `Працівники: ${record.workersPresent} | Години: ${record.hoursWorked}`
        )
        .text(`Завдання: ${record.tasksCompleted.join(', ')}`)
        .text(
          `Матеріали: ${record.materialsUsed
            .map((m) => `${m.name || ''} (${m.quantity || 0} ${m.unit || ''})`)
            .join(', ')}`
        )
      pdf.moveDown()
    })

    pdf.end()
  } catch (error) {
    console.error('PDF generation error:', error)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report' })
    }
  }
}
export const deleteRecord = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    await DailyRecord.findOneAndDelete({ _id: id, userId })
    res.status(200).json({ message: 'Record deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting record' })
  }
}
