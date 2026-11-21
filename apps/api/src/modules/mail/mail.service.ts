import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
};

@Injectable()
export class MailService {
  async send(input: SendMailInput): Promise<"sent" | "skipped"> {
    if (process.env.RESEND_API_KEY?.trim()) {
      await this.sendResend(input);
      return "sent";
    }
    if (process.env.SMTP_HOST?.trim()) {
      await this.sendSmtp(input);
      return "sent";
    }
    return "skipped";
  }

  private fromHeader(fromName?: string) {
    const raw = process.env.SMTP_FROM?.trim();
    const name = fromName?.trim() || "CRM";
    if (!raw) return `${name} <noreply@localhost>`;
    if (raw.includes("<")) return raw;
    return `${name} <${raw}>`;
  }

  private async sendResend(input: SendMailInput) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromHeader(input.fromName),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
    }
  }

  private async sendSmtp(input: SendMailInput) {
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER?.trim();
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS || "" } : undefined,
    });
    await transporter.sendMail({
      from: this.fromHeader(input.fromName),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }
}
