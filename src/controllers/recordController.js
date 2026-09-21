import DailyRecord from '../models/DailyRecord.js'
import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import path from 'path'
import { verifySiteOwnership } from '../utils/verifySiteOwnership.js'
import { verifyCrewOwnership } from '../utils/verifyCrewOwnership.js'
import { getPdfStrings, LOCALE_MAP } from '../i18n/pdf.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const createRecord = async (req, res) => {
  try {
    const {
      siteId,
      crewId,
      date,
      workersPresent,
      hoursWorked,
      tasksCompleted,
      materialsUsed,
    } = req.body
    const userId = req.user.id

    if (
      !siteId ||
      !date ||
      !Number.isFinite(Number(workersPresent)) ||
      !Number.isFinite(Number(hoursWorked)) ||
      !Array.isArray(tasksCompleted)
    ) {
      return res.status(400).json({ message: 'Missing or invalid record fields' })
    }

    const ownsSite = await verifySiteOwnership(siteId, userId)
    if (!ownsSite) {
      return res.status(403).json({ message: 'Invalid site' })
    }

    if (crewId) {
      const ownsCrew = await verifyCrewOwnership(crewId, userId)
      if (!ownsCrew) {
        return res.status(403).json({ message: 'Invalid crew' })
      }
    }

    const record = await DailyRecord.create({
      siteId,
      crewId: crewId || undefined,
      userId,
      date,
      workersPresent,
      hoursWorked,
      tasksCompleted,
      materialsUsed,
    })
    res.status(201).json({ message: 'Record created successfully', record })
  } catch (error) {
    console.error('CREATE RECORD ERROR:', error)
    res.status(500).json({ message: 'Error creating record' })
  }
}
export const getRecords = async (req, res) => {
  try {
    const userId = req.user.id
    const { siteId } = req.query
    const filter = { userId }
    if (siteId) filter.siteId = Number(siteId)
    const records = await DailyRecord.find(filter).sort({ date: -1 })
    res.status(200).json({ records })
  } catch (error) {
    res.status(500).json({ message: 'Error creating record' })
  }
}
export const updateRecord = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const {
      siteId,
      crewId,
      date,
      workersPresent,
      hoursWorked,
      tasksCompleted,
      materialsUsed,
    } = req.body

    if (
      !siteId ||
      !date ||
      !Number.isFinite(Number(workersPresent)) ||
      !Number.isFinite(Number(hoursWorked)) ||
      !Array.isArray(tasksCompleted)
    ) {
      return res.status(400).json({ message: 'Missing or invalid record fields' })
    }

    const ownsSite = await verifySiteOwnership(siteId, userId)
    if (!ownsSite) {
      return res.status(403).json({ message: 'Invalid site' })
    }

    if (crewId) {
      const ownsCrew = await verifyCrewOwnership(crewId, userId)
      if (!ownsCrew) {
        return res.status(403).json({ message: 'Invalid crew' })
      }
    }

    const record = await DailyRecord.findOneAndUpdate(
      { _id: id, userId },
      {
        siteId,
        crewId: crewId || undefined,
        date,
        workersPresent,
        hoursWorked,
        tasksCompleted,
        materialsUsed,
      },
      { new: true }
    )

    if (!record) {
      return res.status(404).json({ message: 'Record not found' })
    }

    res.status(200).json({ message: 'Record updated successfully', record })
  } catch (error) {
    console.error('UPDATE RECORD ERROR:', error)
    res.status(500).json({ message: 'Error updating record' })
  }
}
export const generateReport = async (req, res) => {
  try {
    const userId = req.user.id
    const { from, to, lang } = req.query
    const strings = getPdfStrings(lang)
    const locale = LOCALE_MAP[lang] || LOCALE_MAP.uk
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
      .text(strings.title, { align: 'center' })
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
        .text(strings.monthlySummary, { underline: true })
      pdf.moveDown(0.5)
      monthlyStats.forEach((stat) => {
        const monthName = new Date(
          stat.year,
          stat.month - 1
        ).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
        pdf
          .font('Roboto')
          .fontSize(11)
          .text(
            `${monthName}: ${stat.hours} ${strings.hoursUnit} (${stat.records} ${strings.recordsWord(stat.records)})`
          )
      })
      pdf.moveDown()
      pdf
        .font('Roboto-Bold')
        .fontSize(14)
        .text(strings.detailedRecords, { underline: true })
      pdf.moveDown(0.5)
    }

    response.forEach((record) => {
      pdf
        .font('Roboto-Bold')
        .fontSize(13)
        .text(`${strings.date} ${new Date(record.date).toLocaleDateString(locale)}`)
      pdf
        .font('Roboto')
        .fontSize(11)
        .text(`${strings.siteId} ${record.siteId}`)
        .text(
          `${strings.workers} ${record.workersPresent} | ${strings.hours} ${record.hoursWorked}`
        )
        .text(`${strings.tasks} ${record.tasksCompleted.join(', ')}`)
        .text(
          `${strings.materials} ${record.materialsUsed
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
const csvEscape = (value) => {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export const generateCsv = async (req, res) => {
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

    const records = await DailyRecord.find(filter).sort({ date: 1 })

    const header = [
      'date',
      'siteId',
      'crewId',
      'workersPresent',
      'hoursWorked',
      'tasksCompleted',
      'materialsUsed',
    ]
    const rows = records.map((record) =>
      [
        new Date(record.date).toISOString().slice(0, 10),
        record.siteId,
        record.crewId || '',
        record.workersPresent,
        record.hoursWorked,
        record.tasksCompleted.join('; '),
        record.materialsUsed
          .map((m) => `${m.name || ''} (${m.quantity || 0} ${m.unit || ''})`)
          .join('; '),
      ]
        .map(csvEscape)
        .join(',')
    )
    const csv = [header.join(','), ...rows].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=records.csv')
    res.status(200).send('﻿' + csv)
  } catch (error) {
    console.error('CSV export error:', error)
    res.status(500).json({ message: 'Error generating CSV' })
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
