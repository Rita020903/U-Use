import nodemailer from "nodemailer";
export function mailConfigured() {
  return !!process.env.SMTP_URL && !!process.env.SMTP_FROM;
}
export async function sendMail(to: string, subject: string, content: string) {
  if (!mailConfigured()) throw new Error("邮件服务尚未配置");
  const url = new URL(process.env.SMTP_URL!);
  if (!["smtp:", "smtps:"].includes(url.protocol))
    throw new Error("SMTP_URL 格式无效");
  const secure = url.protocol === "smtps:",
    local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const transport = nodemailer.createTransport(
    {
      host: url.hostname,
      port: Number(url.port || (secure ? 465 : 587)),
      secure,
      requireTLS: !local && !secure,
      auth: url.username
        ? {
            user: decodeURIComponent(url.username),
            pass: decodeURIComponent(url.password),
          }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    },
    { from: process.env.SMTP_FROM },
  );
  try {
    await transport.sendMail({ to, subject, text: content });
  } finally {
    transport.close();
  }
}
