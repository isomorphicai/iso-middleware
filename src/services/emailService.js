const nodemailer = require('nodemailer');
const logger = require('../helpers/logger');
const path = require('path');
const fs = require('fs');

// Ensure environment variables are loaded
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  getTransporter() {
    // Re-check env vars dynamically in case .env was updated
    const host = (process.env.SMTP_HOST || '').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const rawPass = (process.env.SMTP_PASS || '').trim();
    // For Gmail app passwords, remove any internal spaces if provided like "abcd efgh ijkl mnop"
    const pass = host.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      if (host.includes('gmail')) {
        return nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user,
            pass
          }
        });
      }

      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        }
      });
    }

    return this.transporter;
  }

  async initTransporter() {
    try {
      const host = (process.env.SMTP_HOST || '').trim();
      const user = (process.env.SMTP_USER || '').trim();
      const rawPass = (process.env.SMTP_PASS || '').trim();
      const pass = host.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass;

      if (host && user && pass) {
        this.transporter = this.getTransporter();
        logger.info(`[EmailService] Configured live SMTP transporter for ${host} (${user})`);
      } else {
        // Fallback: create free Ethereal test SMTP transporter only if no credentials configured
        nodemailer.createTestAccount((err, account) => {
          if (err) {
            logger.warn(`[EmailService] Could not create test email account: ${err.message}`);
            return;
          }
          this.transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
              user: account.user,
              pass: account.pass
            }
          });
          logger.info(`[EmailService] Initialized test fallback account: ${account.user}`);
        });
      }
    } catch (err) {
      logger.warn(`[EmailService] Transporter init error: ${err.message}`);
    }
  }

  /**
   * Send Password Reset Email
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.username - Target username
   * @param {string} options.resetLink - Full URL to reset password screen
   * @param {string} options.tenantName - Name of the organization / tenant
   * @param {Object} options.tenantConfig - Optional tenant theme colors & logo
   */
  async sendPasswordResetEmail({ to, username, resetLink, tenantName = 'isomorphic', tenantConfig = {} }) {
    const brandColor = tenantConfig.ButtonandLeftBarColor || '#0A2240';
    const buttonFontColor = tenantConfig.buttonFontColor || '#ffffff';
    const logoUrl = tenantConfig.logoBigUrl || tenantConfig.logoSmallUrl || '';
    const orgTitle = tenantConfig.instituteName || tenantName || 'isomorphic AI';

    const subject = `Password Reset Request - ${orgTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #334155; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background-color: ${brandColor}; padding: 28px 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: ${brandColor}; color: ${buttonFontColor} !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .link-fallback { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; word-break: break-all; color: #64748b; margin-top: 20px; }
          .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${orgTitle}" style="max-height: 48px; max-width: 220px; object-fit: contain; margin-bottom: 8px;" />` : ''}
            <h1>${orgTitle}</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello ${username},</div>
            <p class="text">
              We received a request to reset your password for your <strong>${orgTitle}</strong> account.
              Click the button below to set a new password.
            </p>
            <div class="btn-container">
              <a href="${resetLink}" target="_blank" class="btn" style="color: ${buttonFontColor};">Reset My Password</a>
            </div>
            <p class="text" style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
              ⏱️ This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email; your account remains secure.
            </p>
            <div class="link-fallback">
              Or copy and paste this link in your browser:<br/>
              <a href="${resetLink}" style="color: ${brandColor};">${resetLink}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${orgTitle} • Powered by Isomorphic AI
          </div>
        </div>
      </body>
      </html>
    `;

    const rawFrom = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"${orgTitle} Security" <${process.env.SMTP_USER}>` : `"${orgTitle} Security" <noreply@isomorphic.ai>`);
    const fromAddress = rawFrom.replace(/^["']|["']$/g, '').trim();

    logger.info(`[EmailService] Sending password reset email to "${to}" for user "${username}" from "${fromAddress}"...`);

    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          html,
          text: `Hello ${username},\n\nWe received a request to reset your password for ${orgTitle}.\n\nPlease reset your password using the following link:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`
        });

        logger.info(`[EmailService] Email sent successfully! MessageId: ${info.messageId}`);
        return {
          success: true,
          messageId: info.messageId
        };
      } catch (sendErr) {
        logger.error(`[EmailService] Failed to send email via SMTP transporter: ${sendErr.message}`);
        throw new Error(`Email dispatch failed: ${sendErr.message}`);
      }
    }

    throw new Error('No mail transporter is available to send emails.');
  }
}

module.exports = new EmailService();
