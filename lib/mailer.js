import nodemailer from 'nodemailer';
import { escapeHtml } from './security.js';

const EXPERIENCE_LABELS = {
  none: 'No coding experience yet',
  exploring: 'Has tried tutorials, classes, or block coding',
  projects: 'Can write some code and has built a small project',
  independent: 'Can build or solve problems independently',
  'not-collected': 'Not collected on this application'
};
const ORGANIZATION_EMAIL = 'computeforward123@gmail.com';

function answer(value) {
  return String(value || 'Not provided');
}

function applicationRecipients(application) {
  return [...new Set([
    application.applicant.email,
    application.applicant.guardianEmail
  ].filter(Boolean).map(value => value.toLowerCase()))];
}

function shell(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#f3efe5;color:#10243d;font-family:Georgia,serif">
    <div style="max-width:640px;margin:0 auto;padding:40px 24px">
      <div style="border-top:6px solid #ff5c35;background:#fff;padding:32px;border-radius:0 0 14px 14px">
        <p style="margin:0 0 24px;font:700 13px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#006d77">Compute Forward</p>
        <h1 style="font-size:30px;line-height:1.1;margin:0 0 20px">${escapeHtml(title)}</h1>
        ${body}
        <p style="margin:30px 0 0;color:#526271;font-size:14px;line-height:1.6">Questions? Reply to this email or contact <a href="mailto:${ORGANIZATION_EMAIL}" style="color:#2253a3">${ORGANIZATION_EMAIL}</a>.</p>
      </div>
    </div></body></html>`;
}

export function createMailer(config, dependencies = {}) {
  const configured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
  const createTransport = dependencies.createTransport || (options => nodemailer.createTransport(options));
  const transporter = configured ? createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100
  }) : null;

  async function send(options) {
    if (!transporter) return { delivered: false, reason: 'not-configured' };
    await transporter.sendMail({ from: config.smtp.from, ...options });
    return { delivered: true };
  }

  return {
    configured,
    async verify() {
      if (!transporter) return false;
      await transporter.verify();
      return true;
    },
    async sendApplicationConfirmation(application) {
      const applicant = application.applicant;
      const name = escapeHtml(applicant.name);
      const reference = escapeHtml(application.reference);
      const level = escapeHtml(application.level);
      const experience = EXPERIENCE_LABELS[application.experienceLevel] || 'Not provided';
      const recipients = applicationRecipients(application);
      const textSummary = [
        `Student: ${applicant.name}`,
        `Student email: ${applicant.email}`,
        `Grade: ${applicant.grade}`,
        `Age range: ${applicant.ageRange}`,
        applicant.guardianName ? `Parent/guardian: ${applicant.guardianName}` : null,
        applicant.guardianEmail ? `Parent/guardian email: ${applicant.guardianEmail}` : null,
        `Preferred program: ${application.level}`,
        `Coding experience: ${experience}`,
        `Languages, tools, or courses: ${answer(application.codingTools)}`,
        `Project or problem: ${answer(application.projectExperience)}`,
        `Learning goals: ${answer(application.learningGoals)}`
      ].filter(Boolean).join('\n');
      return send({
        to: recipients,
        subject: `Application received — ${application.reference}`,
        text: `Hi ${applicant.name},\n\nYour Compute Forward application has been saved. A copy of the submitted information appears below.\n\nReference: ${application.reference}\nStatus: Submitted\n\n${textSummary}\n\nWe aim to respond within 48 hours. Keep this reference for your records.`,
        html: shell('Your application is saved.', `
          <p style="font-size:17px;line-height:1.7">Hi ${name},</p>
          <p style="font-size:17px;line-height:1.7">We securely received your interest application. This receipt was sent to every student and parent/guardian address provided.</p>
          <div style="margin:24px 0;padding:20px;background:#f3efe5;border-left:4px solid #006d77">
            <p style="margin:0 0 8px"><strong>Reference:</strong> ${reference}</p>
            <p style="margin:0 0 8px"><strong>Program:</strong> ${level}</p>
            <p style="margin:0"><strong>Status:</strong> Submitted</p>
          </div>
          <h2 style="font-size:20px;line-height:1.3;margin:28px 0 14px">Application copy</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;font:15px/1.55 Georgia,serif">
            <tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Student</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(applicant.name)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Student email</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(applicant.email)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Grade / age</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(applicant.grade)} · ${escapeHtml(applicant.ageRange)}</td></tr>
            ${applicant.guardianName ? `<tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Parent/guardian</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(applicant.guardianName)} · ${escapeHtml(applicant.guardianEmail)}</td></tr>` : ''}
            <tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Coding experience</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(experience)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Languages, tools, or courses</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(answer(application.codingTools))}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #d8d2c6"><strong>Project or problem</strong></td><td style="padding:8px;border-bottom:1px solid #d8d2c6">${escapeHtml(answer(application.projectExperience))}</td></tr>
            <tr><td style="padding:8px"><strong>Learning goals</strong></td><td style="padding:8px">${escapeHtml(answer(application.learningGoals))}</td></tr>
          </table>
          <p style="font-size:17px;line-height:1.7">We aim to respond within 48 hours. Dates and the full cohort commitment will be shared before you need to accept an offer.</p>`)
      });
    },
    async sendAdmissionsNotification(application) {
      return send({
        to: config.admissionsEmails,
        subject: `New application — ${application.reference}`,
        text: `A new application was saved.\nReference: ${application.reference}\nLevel: ${application.level}\nReview it in the protected admin dashboard.`,
        html: shell('A new application is ready for review.', `
          <p style="font-size:17px;line-height:1.7">Reference: <strong>${escapeHtml(application.reference)}</strong></p>
          <p style="font-size:17px;line-height:1.7">Program: ${escapeHtml(application.level)}</p>
          <p style="font-size:17px;line-height:1.7">Open the protected admin dashboard to review contact information.</p>`)
      });
    },
    async sendAcceptanceNotification(application) {
      const applicant = application.applicant;
      const recipients = applicationRecipients(application);
      return send({
        to: recipients,
        subject: `Application accepted — ${application.reference}`,
        text: `Hi ${applicant.name},\n\nCongratulations—your Compute Forward application for ${application.level} has been accepted.\n\nReference: ${application.reference}\nStatus: Accepted\n\nThe next step is cohort placement. This message does not yet assign a scheduled cohort seat. We will send dates, meeting times, workload, and enrollment steps before you are asked to confirm participation.\n\nReply to this email with any questions.`,
        html: shell('Your application has been accepted.', `
          <p style="font-size:17px;line-height:1.7">Hi ${escapeHtml(applicant.name)},</p>
          <p style="font-size:17px;line-height:1.7">Congratulations—your Compute Forward application has been accepted.</p>
          <div style="margin:24px 0;padding:20px;background:#e3efed;border-left:4px solid #006d77">
            <p style="margin:0 0 8px"><strong>Reference:</strong> ${escapeHtml(application.reference)}</p>
            <p style="margin:0 0 8px"><strong>Program:</strong> ${escapeHtml(application.level)}</p>
            <p style="margin:0"><strong>Status:</strong> Accepted</p>
          </div>
          <h2 style="font-size:20px;line-height:1.3;margin:28px 0 14px">What happens next</h2>
          <p style="font-size:17px;line-height:1.7">The next step is cohort placement. This email does not yet assign a scheduled cohort seat. We will send dates, meeting times, workload, and enrollment steps before you are asked to confirm participation.</p>
          <p style="font-size:17px;line-height:1.7">Please reply to this email if you or your parent or guardian have any questions.</p>`)
      });
    },
    async sendDeletionConfirmation(email, token) {
      const link = `${config.publicOrigin}/privacy/delete?token=${encodeURIComponent(token)}`;
      return send({
        to: email,
        subject: 'Confirm your Compute Forward data deletion request',
        text: `Confirm deletion of application data associated with this email within one hour: ${link}\n\nIf you did not request this, ignore this message.`,
        html: shell('Confirm your deletion request.', `
          <p style="font-size:17px;line-height:1.7">Use the button below within one hour to permanently delete application records associated with this email.</p>
          <p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#10243d;color:#fff;text-decoration:none;padding:14px 20px;border-radius:6px;font-weight:700">Review and confirm deletion</a></p>
          <p style="font-size:15px;line-height:1.7;color:#526271">If you did not request this, ignore the message. No data will be deleted.</p>`)
      });
    },
    async sendDeletionComplete(email, count) {
      return send({
        to: email,
        subject: 'Compute Forward deletion complete',
        text: `Your deletion request is complete. ${count} application record(s) were deleted.`,
        html: shell('Your deletion is complete.', `
          <p style="font-size:17px;line-height:1.7">We deleted ${Number(count)} application record(s) associated with your verified email.</p>
          <p style="font-size:17px;line-height:1.7">A non-reversible hash and completion timestamp may remain solely to document that the request was fulfilled.</p>`)
      });
    }
  };
}
