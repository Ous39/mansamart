import nodemailer from "nodemailer";

function transporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) throw new Error("SMTP is not configured");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  });
}

export async function sendTransactionalEmail(email: string, subject: string, body: string, actionUrl?: string | null) {
  const safeBody = body.replace(/[<>]/g, "");
  const safeUrl = actionUrl && /^https:\/\/(mansamart\.gm|admin\.mansamart\.gm)(\/|$)/.test(actionUrl) ? actionUrl : null;
  await transporter().sendMail({
    from: process.env.SMTP_FROM || "MansaMart <no-reply@mansamart.gm>",
    to: email,
    subject,
    text: `${body}${safeUrl ? `\n\nOpen MansaMart: ${safeUrl}` : ""}`,
    html: `<p>${safeBody}</p>${safeUrl ? `<p><a href="${safeUrl}">Open MansaMart</a></p>` : ""}`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) throw new Error("SMTP is not configured");
  const resetUrl = new URL(process.env.PASSWORD_RESET_URL || "https://mansamart.gm/reset-password");
  resetUrl.searchParams.set("token", token);
  await transporter().sendMail({
    from: process.env.SMTP_FROM || "MansaMart <no-reply@mansamart.gm>",
    to: email,
    subject: "Reset your MansaMart password",
    text: `Use this secure link within 30 minutes to reset your MansaMart password: ${resetUrl.toString()}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Use this secure link within 30 minutes to reset your MansaMart password.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}

export async function sendAdminLoginCode(email: string, code: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) throw new Error("SMTP is not configured");
  await transporter().sendMail({
    from: process.env.SMTP_FROM || "MansaMart <no-reply@mansamart.gm>",
    to: email,
    subject: "Your MansaMart administrator sign-in code",
    text: `Your MansaMart administrator sign-in code is ${code}. It expires in 10 minutes. If you did not try to sign in, change your password and contact the platform owner.`,
    html: `<p>Your MansaMart administrator sign-in code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not try to sign in, change your password and contact the platform owner.</p>`,
  });
}
