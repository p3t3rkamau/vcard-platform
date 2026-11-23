import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from || !Number.isInteger(port)) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM.");
  }

  return { host, port, user, pass, from };
}

export function isEmailDeliveryConfigured() {
  try {
    getSmtpConfig();
    return true;
  } catch {
    return false;
  }
}

function createTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

export async function sendVerificationEmail(email: string, token: string) {
  const config = getSmtpConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL("/api/auth/verify-email", appUrl);
  link.searchParams.set("token", token);

  await createTransporter(config).sendMail({
    from: config.from,
    to: email,
    subject: "Verify your vCard Platform email",
    text: `Verify your email: ${link.toString()}\nThis link expires in 24 hours.`,
    html: `<p>Welcome to vCard Platform.</p><p><a href="${link.toString()}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const config = getSmtpConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL("/reset-password", appUrl);
  link.searchParams.set("token", token);

  await createTransporter(config).sendMail({
    from: config.from,
    to: email,
    subject: "Reset your vCard Platform password",
    text: `Reset your password: ${link.toString()}\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
    html: `<p>A password reset was requested for your account.</p><p><a href="${link.toString()}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`,
  });
}

export async function sendAccountExistsEmail(email: string) {
  const config = getSmtpConfig();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  await createTransporter(config).sendMail({
    from: config.from,
    to: email,
    subject: "You already have a vCard Platform account",
    text: `Someone tried to create an account with this email address, but you already have one.\nSign in: ${appUrl}/login\nForgot your password? ${appUrl}/forgot-password\nIf this wasn't you, you can ignore this email.`,
    html: `<p>Someone tried to create an account with this email address, but you already have one.</p><p><a href="${appUrl}/login">Sign in</a> or <a href="${appUrl}/forgot-password">reset your password</a>.</p><p>If this wasn't you, you can ignore this email.</p>`,
  });
}
