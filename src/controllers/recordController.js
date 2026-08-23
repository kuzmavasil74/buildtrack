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
    const { from, to } = req.query
    const filter = { userId }

    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        filter.date.$lte = toDate
      }
    }

    const response = await DailyRecord.find(filter).sort({ date: 1 })
    const fontPath = path.join(__dirname, '../../fonts/Roboto-Regular.ttf')
    const fontBoldPath = path.join(__dirname, '../../fonts/Roboto-Bold.ttf')

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

    // --- Зведена таблиця по місяцях ---
    const monthlyMap = {}
    response.forEach((record) => {
      const date = new Date(record.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0'
      )}`
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          hours: 0,
          records: 0,
        }
      }
      monthlyMap[key].hours += record.hoursWorked || 0
      monthlyMap[key].records += 1
    })

    const monthlyStats = Object.values(monthlyMap).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    )

    if (monthlyStats.length > 0) {
      pdf
        .font('Roboto-Bold')
        .fontSize(14)
        .text('Зведення по місяцях:', { underline: true })
      pdf.moveDown(0.5)
      monthlyStats.forEach((stat) => {
        const monthName = new Date(
          stat.year,
          stat.month - 1
        ).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
        pdf
          .font('Roboto')
          .fontSize(11)
          .text(`${monthName}: ${stat.hours} год (${stat.records} записів)`)
      })
      pdf.moveDown()
      pdf
        .font('Roboto-Bold')
        .fontSize(14)
        .text('Детальні записи:', { underline: true })
      pdf.moveDown(0.5)
    }

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
export const getMonthlyStats = async (req, res) => {
  try {
    const userId = req.user.id
    const records = await DailyRecord.find({ userId })

    const stats = {}

    records.forEach((record) => {
      const date = new Date(record.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0'
      )}`
      if (!stats[key]) {
        stats[key] = {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          hours: 0,
          workers: 0,
          records: 0,
        }
      }
      stats[key].hours += record.hoursWorked || 0
      stats[key].workers += record.workersPresent || 0
      stats[key].records += 1
    })

    const result = Object.values(stats).sort((a, b) =>
      b.year !== a.year ? b.year - a.year : b.month - a.month
    )

    res.status(200).json({ stats: result })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' })
  }
}
