export type PasswordResetEmailInput = {
  appName: string;
  primaryColor: string;
  logoUrl?: string | null;
  resetUrl: string;
  supportEmail?: string;
};

const DEFAULT_COLOR = "#4f46e5";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value: string | undefined) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value || "")
    ? (value as string)
    : DEFAULT_COLOR;
}

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function brandMarkHtml(appName: string, color: string, logoUrl: string | null) {
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" width="28" height="28" alt="" style="display:block;border:0;width:28px;height:28px;border-radius:8px;" />`;
  }
  const initial = escapeHtml((appName.trim().charAt(0) || "C").toUpperCase());
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="28" height="28" bgcolor="${color}" align="center" valign="middle" style="width:28px;height:28px;border-radius:8px;background-color:${color};color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:28px;">${initial}</td></tr></table>`;
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput) {
  const appName = input.appName.trim() || "CRM";
  const color = safeColor(input.primaryColor);
  const logoUrl = safeHttpUrl(input.logoUrl);
  const resetUrl = input.resetUrl;
  const supportEmail = input.supportEmail?.trim();
  const safeName = escapeHtml(appName);
  const safeUrl = escapeHtml(resetUrl);
  const safeSupport = supportEmail ? escapeHtml(supportEmail) : "";

  const subject = `Restablece tu contraseña · ${appName}`;

  const supportLine = supportEmail
    ? `Si no solicitaste un restablecimiento de contraseña, contacta a nuestro equipo de soporte en <a href="mailto:${safeSupport}" style="color:#0f172a;text-decoration:underline;">${safeSupport}</a>.`
    : `Si no solicitaste un restablecimiento de contraseña, puedes ignorar este correo.`;

  const text = [
    `${appName}`,
    "",
    "Restablece tu contraseña",
    "",
    "Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, abre el enlace de abajo para elegir una nueva.",
    resetUrl,
    "",
    supportEmail
      ? `Si no solicitaste este cambio, contacta a nuestro equipo de soporte en ${supportEmail}.`
      : "Si no solicitaste este cambio, puedes ignorar este correo.",
    "",
    "Este correo se envió porque se solicitó un restablecimiento de contraseña para tu cuenta. Si no lo pediste, puedes ignorarlo.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
          <tr>
            <td style="padding:32px 36px 28px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">${brandMarkHtml(appName, color, logoUrl)}</td>
                  <td valign="middle" style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">${safeName}</td>
                </tr>
              </table>
              <div style="height:1px;background-color:#e5e7eb;margin:22px 0 26px 0;line-height:1px;font-size:1px;">&nbsp;</div>
              <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">Restablece tu contraseña</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, haz clic en el botón de abajo para elegir una nueva.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="${color}" style="border-radius:12px;">
                    <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Restablecer contraseña &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0 0;font-size:15px;line-height:1.6;color:#0f172a;">${supportLine}</p>
              <div style="height:1px;background-color:#e5e7eb;margin:26px 0 18px 0;line-height:1px;font-size:1px;">&nbsp;</div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">Este correo se envió porque se solicitó un restablecimiento de contraseña para tu cuenta. Si no lo pediste, puedes ignorarlo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
