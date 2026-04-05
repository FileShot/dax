// ─── Email Integration ──────────────────────────────────────
// Send emails via SMTP using nodemailer-compatible approach
// Uses raw SMTP via net/tls modules (no external deps)

const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

function smtpCommand(socket, cmd) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SMTP timeout')), 15000);
    socket.once('data', (data) => {
      clearTimeout(timeout);
      const response = data.toString();
      if (response.startsWith('2') || response.startsWith('3')) resolve(response);
      else reject(new Error(`SMTP error: ${response.trim()}`));
    });
    if (cmd) socket.write(cmd + '\r\n');
  });
}

function connectSmtp(host, port, secure) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
    const options = { host, port, rejectUnauthorized: false };
    const socket = secure ? tls.connect(options, () => { clearTimeout(timeout); resolve(socket); })
                          : net.connect(options, () => { clearTimeout(timeout); resolve(socket); });
    socket.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

async function sendEmail(creds, to, subject, body, isHtml = false) {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, from_email, use_tls } = creds;
  const port = parseInt(smtp_port) || 587;
  const secure = port === 465 || use_tls === 'true';

  const socket = await connectSmtp(smtp_host, port, secure);

  // Read greeting
  await new Promise((resolve) => socket.once('data', resolve));

  await smtpCommand(socket, `EHLO dax-agent`);
  await smtpCommand(socket, `AUTH LOGIN`);
  await smtpCommand(socket, Buffer.from(smtp_user).toString('base64'));
  await smtpCommand(socket, Buffer.from(smtp_pass).toString('base64'));
  await smtpCommand(socket, `MAIL FROM:<${from_email || smtp_user}>`);
  await smtpCommand(socket, `RCPT TO:<${to}>`);
  await smtpCommand(socket, 'DATA');

  const boundary = crypto.randomUUID();
  const contentType = isHtml ? 'text/html' : 'text/plain';
  const msgId = `<${crypto.randomUUID()}@dax>`;
  const date = new Date().toUTCString();

  const message = [
    `From: ${from_email || smtp_user}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}; charset=utf-8`,
    ``,
    body,
    `.`,
  ].join('\r\n');

  await smtpCommand(socket, message);
  await smtpCommand(socket, 'QUIT');
  socket.destroy();

  return { success: true, messageId: msgId, to, subject };
}

module.exports = {
  id: 'email',
  name: 'Email (SMTP)',
  category: 'communication',
  icon: 'Mail',
  description: 'Send emails via SMTP — Gmail, Outlook, custom SMTP',
  configFields: [
    { key: 'smtp_host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
    { key: 'smtp_port', label: 'SMTP Port', type: 'text', placeholder: '587' },
    { key: 'smtp_user', label: 'Username / Email', type: 'text', required: true },
    { key: 'smtp_pass', label: 'Password / App Password', type: 'password', required: true },
    { key: 'from_email', label: 'From Address', type: 'text', placeholder: 'your@email.com' },
    { key: 'use_tls', label: 'Use TLS', type: 'select', options: ['true', 'false'] },
  ],

  async connect(creds) {
    // Test SMTP connection
    const port = parseInt(creds.smtp_port) || 587;
    const secure = port === 465 || creds.use_tls === 'true';
    const socket = await connectSmtp(creds.smtp_host, port, secure);
    socket.destroy();
  },

  async test(creds) {
    try {
      const port = parseInt(creds.smtp_port) || 587;
      const secure = port === 465 || creds.use_tls === 'true';
      const socket = await connectSmtp(creds.smtp_host, port, secure);
      socket.destroy();
      return { success: true, message: `SMTP connection to ${creds.smtp_host}:${port} successful` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    send_email: async (params, creds) => {
      const { to, subject, body, html } = params;
      if (!to || !subject) throw new Error('Missing required "to" and "subject" fields');
      return sendEmail(creds, to, subject, body || '', !!html);
    },
  },

  credentials: null,
  connected: false,

  async disconnect() {
    this.connected = false;
    this.credentials = null;
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
