import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim()?.replace(/^["']|["']$/g, '');

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env'
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
    tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : undefined
  });

  return transporter;
}

export async function sendReceiptEmail({
  toEmail,
  customerName,
  receiptUrl,
  businessName,
  transactionNumber,
  total,
  currency
}) {
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() || businessName || 'Chaslay';

  if (!fromEmail) {
    throw new Error('SMTP_FROM_EMAIL or SMTP_USER must be set in .env');
  }

  const greeting = customerName?.trim() ? `Hi ${customerName.trim()},` : 'Hi,';
  const amount = `${currency} ${Number(total).toFixed(2)}`;

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: `Your receipt from ${businessName} (#${transactionNumber})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <p>${greeting}</p>
        <p>Thank you for your purchase at <strong>${escapeHtml(businessName)}</strong>.</p>
        <p>Order <strong>#${escapeHtml(transactionNumber)}</strong> &middot; <strong>${escapeHtml(amount)}</strong></p>
        <p style="margin:24px 0">
          <a href="${receiptUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            View digital receipt
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Or copy this link:<br><a href="${receiptUrl}">${receiptUrl}</a></p>
      </div>
    `
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
