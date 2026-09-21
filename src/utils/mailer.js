// Transactional email helper.
// Uses nodemailer when SMTP_* env vars are set; otherwise logs the message to
// the server console so flows like password reset still work in local/dev.

let transporterPromise = null

const getTransporter = async () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  if (!transporterPromise) {
    transporterPromise = import('nodemailer')
      .then(({ default: nodemailer }) =>
        nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        })
      )
      .catch((err) => {
        console.warn(
          'Mailer: nodemailer unavailable, falling back to console:',
          err.message
        )
        return null
      })
  }
  return transporterPromise
}

export const sendMail = async ({ to, subject, text, html }) => {
  const transporter = await getTransporter()
  if (!transporter) {
    console.log('\n[MAILER:DEV] Email not sent (SMTP not configured).')
    console.log(`  To: ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  ${text}\n`)
    return { delivered: false }
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER
  await transporter.sendMail({ from, to, subject, text, html })
  return { delivered: true }
}
