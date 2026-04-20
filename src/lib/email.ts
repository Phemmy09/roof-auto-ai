import { Resend } from 'resend';

// Only init if key exists, allowing the build to pass before env variables are populated
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendJobPDF(email: string, pdfBuffer: Buffer, jobName: string) {
  if (!resend) {
    console.warn("Resend API Key missing. Skipping email.");
    return { success: false, error: 'Resend API Key not configured' };
  }

  try {
    const data = await resend.emails.send({
      from: 'Roof Auto <onboarding@resend.dev>', // Should be a verified domain in production
      to: [email],
      subject: `Materials Order & Crew Summary - ${jobName}`,
      html: `<p>Please find attached the automated materials order and crew summary for ${jobName}.</p>`,
      attachments: [
        {
          filename: `${jobName.replace(/\s+/g, '_')}_Order.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
