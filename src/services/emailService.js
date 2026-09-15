const nodemailer = require('nodemailer');
const axios = require('axios');
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

  getTransporter(customPort = null, customSecure = null) {
    const host = (process.env.SMTP_HOST || '').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const rawPass = (process.env.SMTP_PASS || '').trim();
    const pass = (host.includes('gmail') || user.endsWith('@gmail.com')) ? rawPass.replace(/\s+/g, '') : rawPass;
    
    // Default to port 587 (STARTTLS) on cloud environments to avoid port 465 blocking
    const port = customPort || parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = customSecure !== null ? customSecure : (process.env.SMTP_SECURE === 'true' || port === 465);

    if (host && user && pass) {
      const isGmail = host.includes('gmail') || user.endsWith('@gmail.com');
      const smtpHost = isGmail ? 'smtp.gmail.com' : host;

      return nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 6000,
        greetingTimeout: 6000,
        socketTimeout: 8000
      });
    }

    return this.transporter;
  }

  async initTransporter() {
    try {
      const host = (process.env.SMTP_HOST || '').trim();
      const user = (process.env.SMTP_USER || '').trim();
      const rawPass = (process.env.SMTP_PASS || '').trim();

      if (host && user && rawPass) {
        this.transporter = this.getTransporter();
        logger.info(`[EmailService] Configured SMTP transporter for ${host} (${user})`);
      } else {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          connectionTimeout: 6000,
          socketTimeout: 8000
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

    const textContent = `Hello ${username},\n\nWe received a request to reset your password for ${orgTitle}.\n\nPlease reset your password using the following link:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`;

    const rawFrom = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"${orgTitle} Security" <${process.env.SMTP_USER}>` : `"${orgTitle} Security" <noreply@isomorphic.ai>`);
    const fromAddress = rawFrom.replace(/^["']|["']$/g, '').trim();

    logger.info(`[EmailService] Sending password reset email to "${to}" for user "${username}" from "${fromAddress}"...`);

    // METHOD 1: Resend HTTP API (if RESEND_API_KEY is configured on Render - 100% bypasses SMTP port blocking)
    if (process.env.RESEND_API_KEY) {
      try {
        const fromEmail = fromAddress.includes('<') ? fromAddress : `onboarding@resend.dev`;
        const res = await axios.post('https://api.resend.com/emails', {
          from: fromEmail,
          to: [to],
          subject,
          html,
          text: textContent
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });

        logger.info(`[EmailService] Email sent via Resend API! ID: ${res.data?.id}`);
        return { success: true, messageId: res.data?.id };
      } catch (resendErr) {
        logger.warn(`[EmailService] Resend API failed: ${resendErr.response?.data?.message || resendErr.message}. Falling back to SMTP...`);
      }
    }

    // METHOD 2: Brevo HTTP API (if BREVO_API_KEY is configured)
    if (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY) {
      try {
        const apiKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY).trim();
        const senderEmail = process.env.SMTP_USER || 'noreply@isomorphic.ai';
        const res = await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { name: orgTitle, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent
        }, {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });

        logger.info(`[EmailService] Email sent via Brevo API! MessageId: ${res.data?.messageId}`);
        return { success: true, messageId: res.data?.messageId };
      } catch (brevoErr) {
        logger.warn(`[EmailService] Brevo API failed: ${brevoErr.response?.data?.message || brevoErr.message}. Falling back to SMTP...`);
      }
    }

    // METHOD 3: Multi-Port SMTP Fallback (Prioritizes Port 587 STARTTLS on Cloud)
    const mailPayload = {
      from: fromAddress,
      to,
      subject,
      html,
      text: textContent
    };

    const host = (process.env.SMTP_HOST || '').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const configuredPort = parseInt(process.env.SMTP_PORT || '587', 10);

    // Try Port 587 STARTTLS first (best cloud compatibility), then configured port, then 465
    const portsToTry = [
      { port: 587, secure: false },
      { port: configuredPort, secure: configuredPort === 465 },
      { port: 465, secure: true }
    ];

    const uniqueConfigs = [];
    for (const c of portsToTry) {
      if (!uniqueConfigs.some(u => u.port === c.port && u.secure === c.secure)) {
        uniqueConfigs.push(c);
      }
    }

    let lastError = null;
    for (const config of uniqueConfigs) {
      try {
        const transporter = this.getTransporter(config.port, config.secure);
        if (!transporter) continue;

        const sendPromise = transporter.sendMail(mailPayload);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`SMTP connection timed out after 6s on port ${config.port}`)), 6000)
        );

        const info = await Promise.race([sendPromise, timeoutPromise]);
        logger.info(`[EmailService] Email sent successfully via SMTP port ${config.port}! MessageId: ${info.messageId}`);
        return {
          success: true,
          messageId: info.messageId
        };
      } catch (err) {
        lastError = err;
        logger.warn(`[EmailService] SMTP attempt on port ${config.port} failed: ${err.message}`);
      }
    }

    logger.error(`[EmailService] All email delivery attempts failed: ${lastError?.message}`);
    throw new Error(`Email dispatch failed: ${lastError?.message || 'SMTP connection timeout. Cloud providers like Render often block port 465/587.'}`);
  }
}

module.exports = new EmailService();
