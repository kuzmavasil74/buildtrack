import DailyRecord from '../models/DailyRecord.js'
import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import path from 'path'
import { pool } from '../config/postgres.js'
import { verifySiteOwnership } from '../utils/verifySiteOwnership.js'
import { verifyCrewOwnership } from '../utils/verifyCrewOwnership.js'
import { getPdfStrings, LOCALE_MAP } from '../i18n/pdf.js'
import { parseRecordBody } from '../utils/parseRecordBody.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const applyDateRange = (filter, from, to) => {
  if (!from && !to) return
  filter.date = {}
  if (from) filter.date.$gte = new Date(from)
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    filter.date.$lte = toDate
  }
}

// Every name ever typed into a record's worker entries, most recent first,
// with the rate last used for them — so a name typed once autocompletes
// (and pre-fills its rate) on every later record, crew or no crew.
export const getWorkerDirectory = async (req, res) => {
  try {
    const rows = await DailyRecord.aggregate([
      { $match: { userId: req.user.id } },
      { $sort: { date: -1 } },
      { $unwind: '$entries' },
      { $group: { _id: '$entries.name', rate: { $first: '$entries.rate' } } },
      { $project: { _id: 0, name: '$_id', rate: 1 } },
      { $sort: { name: 1 } },
    ])
    res.status(200).json({ workers: rows })
  } catch (error) {
    console.error('WORKER DIRECTORY ERROR:', error)
    res.status(500).json({ message: 'Error fetching worker directory' })
  }
}

export const createRecord = async (req, res) => {
  try {
    const userId = req.user.id
    const { fields, error } = parseRecordBody(req.body)
    if (error) return res.status(400).json({ message: error })

    const ownsSite = await verifySiteOwnership(fields.siteId, userId)
    if (!ownsSite) {
      return res.status(403).json({ message: 'Invalid site' })
    }

    if (fields.crewId) {
      const ownsCrew = await verifyCrewOwnership(fields.crewId, userId)
      if (!ownsCrew) {
        return res.status(403).json({ message: 'Invalid crew' })
      }
    }

    const record = await DailyRecord.create({ ...fields, userId })
    res.status(201).json({ message: 'Record created successfully', record })
  } catch (error) {
    console.error('CREATE RECORD ERROR:', error)
    res.status(500).json({ message: 'Error creating record' })
  }
}
export const getRecords = async (req, res) => {
  try {
    const userId = req.user.id
    const { siteId, from, to } = req.query
    const filter = { userId }
    if (siteId) filter.siteId = Number(siteId)
    applyDateRange(filter, from, to)
    const records = await DailyRecord.find(filter).sort({ date: -1, _id: -1 })
    res.status(200).json({ records })
  } catch (error) {
    res.status(500).json({ message: 'Error creating record' })
  }
}
export const updateRecord = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { fields, error } = parseRecordBody(req.body)
    if (error) return res.status(400).json({ message: error })

    const ownsSite = await verifySiteOwnership(fields.siteId, userId)
    if (!ownsSite) {
      return res.status(403).json({ message: 'Invalid site' })
    }

    if (fields.crewId) {
      const ownsCrew = await verifyCrewOwnership(fields.crewId, userId)
      if (!ownsCrew) {
        return res.status(403).json({ message: 'Invalid crew' })
      }
    }

    const record = await DailyRecord.findOneAndUpdate({ _id: id, userId }, fields, {
      new: true,
    })

    if (!record) {
      return res.status(404).json({ message: 'Record not found' })
    }

    res.status(200).json({ message: 'Record updated successfully', record })
  } catch (error) {
    console.error('UPDATE RECORD ERROR:', error)
    res.status(500).json({ message: 'Error updating record' })
  }
}
const getCrewNames = async (userId) => {
  const { rows } = await pool.query(`SELECT id, name FROM crews WHERE user_id = $1`, [userId])
  return new Map(rows.map((row) => [row.id, row.name]))
}

export const generateReport = async (req, res) => {
  try {
    const userId = req.user.id
    const { from, to, lang } = req.query
    const strings = getPdfStrings(lang)
    const locale = LOCALE_MAP[lang] || LOCALE_MAP.uk
    const filter = { userId }
    applyDateRange(filter, from, to)

    const response = await DailyRecord.find(filter).sort({ date: 1, _id: 1 })
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

    const crewNames = await getCrewNames(userId)
    const formatEntry = (e) => {
      const span = e.startTime && e.endTime ? ` (${e.startTime}–${e.endTime})` : ''
      const note = e.note ? ` — ${e.note}` : ''
      return `• ${e.name}: ${e.hours} ${strings.hoursUnit}${span}${note}`
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
      if (record.crewId != null && crewNames.has(record.crewId)) {
        pdf.text(`${strings.crew} ${crewNames.get(record.crewId)}`)
      }
      pdf
        .text(
          `${strings.workers} ${record.workersPresent} | ${strings.hours} ${record.hoursWorked}`
        )
        .text(`${strings.tasks} ${record.tasksCompleted.join(', ')}`)
      if (record.crewNote) pdf.text(`${strings.crewWork} ${record.crewNote}`)
      record.entries.forEach((entry) => pdf.text(formatEntry(entry), { indent: 10 }))
      pdf.text(
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
    applyDateRange(filter, from, to)

    const records = await DailyRecord.find(filter).sort({ date: 1, _id: 1 })

    const crewNames = await getCrewNames(userId)
    const header = [
      'date',
      'siteId',
      'crewId',
      'crew',
      'workersPresent',
      'hoursWorked',
      'tasksCompleted',
      'crewNote',
      'workers',
      'materialsUsed',
    ]
    const rows = records.map((record) =>
      [
        new Date(record.date).toISOString().slice(0, 10),
        record.siteId,
        record.crewId || '',
        crewNames.get(record.crewId) || '',
        record.workersPresent,
        record.hoursWorked,
        record.tasksCompleted.join('; '),
        record.crewNote || '',
        record.entries
          .map((e) => {
            const span = e.startTime && e.endTime ? ` ${e.startTime}-${e.endTime}` : ''
            return `${e.name}: ${e.hours}h${span}${e.note ? ` (${e.note})` : ''}`
          })
          .join('; '),
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

const round2 = (n) => Math.round(n * 100) / 100

const buildPayroll = async (userId, from, to) => {
  const filter = { userId }
  applyDateRange(filter, from, to)

  const records = await DailyRecord.find(filter)
  const crewsResult = await pool.query(
    `SELECT id, name, members, member_rates FROM crews WHERE user_id = $1`,
    [userId]
  )
  const crewById = new Map(crewsResult.rows.map((crew) => [crew.id, crew]))

  // groups: crew id (or null for people logged without a crew) -> name -> { hours, wage }
  const groups = new Map()
  const addHours = (crewId, name, hours, rate) => {
    if (!groups.has(crewId)) groups.set(crewId, new Map())
    const people = groups.get(crewId)
    const person = people.get(name) || { hours: 0, wage: 0 }
    person.hours += hours
    person.wage += hours * rate
    people.set(name, person)
  }

  let unassignedHours = 0
  for (const record of records) {
    const crew = record.crewId != null ? crewById.get(record.crewId) : undefined
    const crewRate = (name) => Number(crew?.member_rates?.[name]) || 0

    if (record.entries?.length) {
      for (const entry of record.entries) {
        const rate = Number.isFinite(entry.rate) ? entry.rate : crewRate(entry.name)
        addHours(crew ? crew.id : null, entry.name, entry.hours, rate)
      }
    } else if (crew) {
      // Legacy record: every member of the crew is credited with the record's hours.
      for (const name of crew.members || []) {
        addHours(crew.id, name, record.hoursWorked || 0, crewRate(name))
      }
    } else {
      unassignedHours += record.hoursWorked || 0
    }
  }

  const crews = [...groups.entries()]
    .map(([crewId, people]) => {
      const members = [...people.entries()].map(([name, { hours, wage }]) => ({
        name,
        hours: round2(hours),
        wage: round2(wage),
        rate: hours > 0 ? round2(wage / hours) : 0,
      }))
      return {
        crewId,
        crewName: crewId != null ? crewById.get(crewId).name : null,
        totalHours: round2(members.reduce((sum, m) => sum + m.hours, 0)),
        totalWage: round2(members.reduce((sum, m) => sum + m.wage, 0)),
        members,
      }
    })
    .filter((crew) => crew.totalHours > 0)
    .sort((a, b) => (a.crewId === null) - (b.crewId === null))

  const grandTotal = round2(crews.reduce((sum, crew) => sum + crew.totalWage, 0))

  return { crews, unassignedHours: round2(unassignedHours), grandTotal }
}

export const getPayroll = async (req, res) => {
  try {
    const { from, to } = req.query
    const payroll = await buildPayroll(req.user.id, from, to)
    res.status(200).json(payroll)
  } catch (error) {
    console.error('PAYROLL ERROR:', error)
    res.status(500).json({ message: 'Error calculating payroll' })
  }
}

export const getPayrollCsv = async (req, res) => {
  try {
    const { from, to } = req.query
    const { crews, unassignedHours } = await buildPayroll(req.user.id, from, to)

    const header = ['crew', 'member', 'hours', 'rate', 'wage']
    const rows = []
    crews.forEach((crew) => {
      crew.members.forEach((member) => {
        rows.push(
          [crew.crewName ?? '(no crew)', member.name, member.hours, member.rate, member.wage]
            .map(csvEscape)
            .join(',')
        )
      })
    })
    if (unassignedHours > 0) {
      rows.push(
        ['(no crew)', '', unassignedHours, '', ''].map(csvEscape).join(',')
      )
    }
    const csv = [header.join(','), ...rows].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=payroll.csv')
    res.status(200).send('﻿' + csv)
  } catch (error) {
    console.error('PAYROLL CSV ERROR:', error)
    res.status(500).json({ message: 'Error generating payroll CSV' })
  }
}
