import net from "node:net";
import tls from "node:tls";

export type MagicLinkEmail = {
  to: string;
  magicLink: string;
  emailMagicLink?: string;
  expiresAt: Date;
};

export type MagicLinkDeliveryResult = {
  devMagicLink?: string;
};

export type HouseInvitationEmail = {
  to: string;
  invitationLink: string;
  addressLabel: string;
  expiresAt: Date;
};

export type HouseClaimOwnerEmail = {
  to: string;
  ownerName: string;
  requesterName: string;
  requesterEmail: string;
  addressLabel: string;
  bfeNumber: string | null;
  approvalLink: string;
  expiresAt: Date;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

function mailTransport() {
  return process.env.MATRIVA_MAIL_TRANSPORT ?? "console";
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required when MATRIVA_MAIL_TRANSPORT=smtp.`);
  }

  return value;
}

function smtpConfig(): SmtpConfig {
  const user = requiredEnv("MATRIVA_SMTP_USER");
  const password = requiredEnv("MATRIVA_SMTP_PASSWORD");
  const from = requiredEnv("MATRIVA_SMTP_FROM");

  assertSafeAddress(user);
  assertSafeAddress(from);

  if (user !== from) {
    throw new Error(
      "MATRIVA_SMTP_USER and MATRIVA_SMTP_FROM must use the same email address."
    );
  }

  return {
    host: process.env.MATRIVA_SMTP_HOST ?? "mail.your-server.de",
    port: Number.parseInt(process.env.MATRIVA_SMTP_PORT ?? "587", 10),
    user,
    password,
    from
  };
}

function assertSafeAddress(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\r\n]/.test(value)) {
    throw new Error("SMTP email address is invalid.");
  }
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function dotStuff(message: string) {
  return message.replace(/^\./gm, "..");
}

function formatMagicLinkText(email: MagicLinkEmail, expiresAt: string) {
  const fallbackLink = email.emailMagicLink && email.emailMagicLink !== email.magicLink
    ? email.emailMagicLink
    : null;

  return [
    "Hej,",
    "",
    "Brug linket herunder til at logge ind i Matriva:",
    email.magicLink,
    ...(fallbackLink
      ? [
          "",
          "Hvis du åbner mailen på Android og det første link ikke virker, brug dette link:",
          fallbackLink
        ]
      : []),
    "",
    `Linket udløber ${expiresAt}.`,
    "Hvis du ikke bad om linket, kan du ignorere denne mail.",
    "",
    "Venlig hilsen",
    "Matriva"
  ].join("\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character] ?? character;
  });
}

function formatMagicLinkHtml(email: MagicLinkEmail, expiresAt: string) {
  const magicLink = escapeHtml(email.magicLink);
  const fallbackLink = email.emailMagicLink && email.emailMagicLink !== email.magicLink
    ? escapeHtml(email.emailMagicLink)
    : null;

  return [
    "<!doctype html>",
    '<html lang="da">',
    "<body>",
    "<p>Hej,</p>",
    "<p>Brug knappen herunder til at logge ind i Matriva:</p>",
    `<p><a href="${magicLink}" style="display:inline-block;padding:12px 18px;background:#0f6656;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">Åbn Matriva og log ind</a></p>`,
    ...(fallbackLink
      ? [
          "<p>Hvis du åbner mailen på Android:</p>",
          `<p><a href="${fallbackLink}" style="display:inline-block;padding:12px 18px;background:#e7f3ef;color:#0f6656;text-decoration:none;border:1px solid #0f6656;border-radius:6px;font-weight:700;">Åbn Matriva på Android</a></p>`
        ]
      : []),
    `<p>Linket udløber ${escapeHtml(expiresAt)}.</p>`,
    "<p>Hvis du ikke bad om linket, kan du ignorere denne mail.</p>",
    "<p>Venlig hilsen<br>Matriva</p>",
    "</body>",
    "</html>"
  ].join("\r\n");
}

function createMessage(config: SmtpConfig, email: MagicLinkEmail, expiresAt: string) {
  assertSafeAddress(email.to);
  assertSafeAddress(config.from);

  const body = formatMagicLinkText(email, expiresAt);
  const htmlBody = formatMagicLinkHtml(email, expiresAt);
  const boundary = `matriva_magic_link_${Date.now().toString(36)}`;

  return [
    `From: Matriva <${config.from}>`,
    `To: <${email.to}>`,
    `Subject: ${encodeHeader("Dit loginlink til Matriva")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    `--${boundary}--`
  ].join("\r\n");
}

async function readSmtpResponse(socket: net.Socket | tls.TLSSocket) {
  return await new Promise<{ code: number; text: string }>((resolve, reject) => {
    let buffer = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onClose() {
      cleanup();
      reject(new Error("SMTP connection closed before response."));
    }

    function onData(chunk: Buffer) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines.at(-1);

      if (!lastLine || !/^\d{3} /.test(lastLine)) {
        return;
      }

      cleanup();
      resolve({
        code: Number.parseInt(lastLine.slice(0, 3), 10),
        text: buffer
      });
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

async function expectSmtp(
  socket: net.Socket | tls.TLSSocket,
  command: string | null,
  expectedCodes: number[]
) {
  if (command !== null) {
    socket.write(`${command}\r\n`);
  }

  const response = await readSmtpResponse(socket);

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed with ${response.code}.`);
  }

  return response;
}

async function connectSmtp(config: SmtpConfig) {
  const socket = net.connect(config.port, config.host);
  socket.setTimeout(10_000);
  socket.on("timeout", () => socket.destroy(new Error("SMTP connection timed out.")));

  await expectSmtp(socket, null, [220]);
  await expectSmtp(socket, "EHLO matriva.dk", [250]);
  await expectSmtp(socket, "STARTTLS", [220]);

  const secureSocket = tls.connect({
    socket,
    servername: config.host
  });
  secureSocket.setTimeout(10_000);
  secureSocket.on("timeout", () =>
    secureSocket.destroy(new Error("SMTP TLS connection timed out."))
  );

  await new Promise<void>((resolve, reject) => {
    secureSocket.once("secureConnect", resolve);
    secureSocket.once("error", reject);
  });

  await expectSmtp(secureSocket, "EHLO matriva.dk", [250]);

  return secureSocket;
}

async function sendSmtpMagicLink(email: MagicLinkEmail, expiresAt: string) {
  const config = smtpConfig();
  const socket = await connectSmtp(config);

  try {
    const authPlain = Buffer.from(
      `\u0000${config.user}\u0000${config.password}`,
      "utf8"
    ).toString("base64");
    const message = createMessage(config, email, expiresAt);

    await expectSmtp(socket, `AUTH PLAIN ${authPlain}`, [235]);
    await expectSmtp(socket, `MAIL FROM:<${config.from}>`, [250]);
    await expectSmtp(socket, `RCPT TO:<${email.to}>`, [250, 251]);
    await expectSmtp(socket, "DATA", [354]);
    await expectSmtp(socket, `${dotStuff(message)}\r\n.`, [250]);
    await expectSmtp(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}

export async function sendMagicLinkEmail(
  email: MagicLinkEmail
): Promise<MagicLinkDeliveryResult> {
  const transport = mailTransport();
  const expiresAt = email.expiresAt.toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short"
  });

  if (transport === "console") {
    console.info(
      JSON.stringify({
        event: "auth.magic_link.dev_email",
        to: email.to,
        subject: "Dit loginlink til Matriva",
        body:
          `Hej. Brug knappen til at logge ind i Matriva. Linket udløber ${expiresAt}. ` +
          "Hvis du ikke bad om linket, kan du ignorere denne mail.",
        devMagicLink: email.magicLink
      })
    );

    return { devMagicLink: email.magicLink };
  }

  if (transport === "disabled") {
    console.warn(
      JSON.stringify({ event: "auth.magic_link.email_disabled", to: email.to })
    );
    return {};
  }

  if (transport === "smtp") {
    await sendSmtpMagicLink(email, expiresAt);
    return {};
  }

  throw new Error(
    "MATRIVA_MAIL_TRANSPORT must be console, disabled, or smtp. Local development should use console or disabled."
  );
}

export function createMagicLinkUrl(token: string) {
  const baseUrl = process.env.MATRIVA_MAGIC_LINK_BASE_URL ?? "matriva://auth/magic-link";
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createMagicLinkEmailUrl(token: string) {
  const baseUrl = process.env.MATRIVA_MAGIC_LINK_EMAIL_BASE_URL;
  if (!baseUrl) {
    return createMagicLinkUrl(token);
  }

  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createHouseInvitationUrl(token: string) {
  const baseUrl = process.env.MATRIVA_HOUSE_INVITATION_BASE_URL ?? "matriva://house-invitation";
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createHouseClaimApprovalUrl(token: string) {
  const baseUrl = process.env.MATRIVA_HOUSE_CLAIM_APPROVAL_BASE_URL ?? "matriva://house-claim/approve";
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendHouseClaimOwnerEmail(email: HouseClaimOwnerEmail) {
  const transport = mailTransport();
  const expiresAt = email.expiresAt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
  const body = [
    `Hej ${email.ownerName},`, "",
    `${email.requesterName} (${email.requesterEmail}) anmoder om adgang til et hus, du ejer i Matriva.`,
    "",
    `Adresse: ${email.addressLabel}`,
    `Matrikel/BFE: ${email.bfeNumber ?? "Ikke registreret"}`,
    "",
    `Giv adgang direkte her: ${email.approvalLink}`,
    `Linket udløber ${expiresAt}. Du kan også håndtere anmodningen i Matriva.`,
    "", "Venlig hilsen", "Matriva"
  ].join("\n");
  if (transport === "console") {
    console.info(JSON.stringify({ event: "house.claim_owner.dev_email", to: email.to, subject: "Ny adgangsanmodning til dit hus i Matriva", body, devApprovalLink: email.approvalLink }));
    return { devApprovalLink: email.approvalLink };
  }
  if (transport === "disabled") return {};
  if (transport !== "smtp") throw new Error("MATRIVA_MAIL_TRANSPORT must be console, disabled, or smtp.");
  const config = smtpConfig();
  const socket = await connectSmtp(config);
  try {
    const message = [`From: Matriva <${config.from}>`, `To: <${email.to}>`, `Subject: ${encodeHeader("Ny adgangsanmodning til dit hus i Matriva")}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
    const authPlain = Buffer.from(`\u0000${config.user}\u0000${config.password}`, "utf8").toString("base64");
    await expectSmtp(socket, `AUTH PLAIN ${authPlain}`, [235]);
    await expectSmtp(socket, `MAIL FROM:<${config.from}>`, [250]);
    await expectSmtp(socket, `RCPT TO:<${email.to}>`, [250, 251]);
    await expectSmtp(socket, "DATA", [354]);
    await expectSmtp(socket, `${dotStuff(message)}\r\n.`, [250]);
    await expectSmtp(socket, "QUIT", [221]);
  } finally { socket.end(); }
  return {};
}

export async function sendHouseInvitationEmail(email: HouseInvitationEmail) {
  const transport = mailTransport();
  const expiresAt = email.expiresAt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
  const body = [
    "Hej,", "", "Du er inviteret til at få adgang til en bolig i Matriva.",
    "Når du accepterer invitationen, får du adgang til boligens fælles vedligeholdelse, dokumenter og historik.",
    "", `Bolig: ${email.addressLabel}`, `Acceptér invitationen her: ${email.invitationLink}`,
    `Invitationen udløber ${expiresAt}.`, "", "Venlig hilsen", "Matriva"
  ].join("\n");
  if (transport === "console") {
    console.info(JSON.stringify({ event: "house.invitation.dev_email", to: email.to, subject: "Invitation til en bolig i Matriva", devInvitationLink: email.invitationLink }));
    return { devInvitationLink: email.invitationLink };
  }
  if (transport === "disabled") return {};
  if (transport !== "smtp") throw new Error("MATRIVA_MAIL_TRANSPORT must be console, disabled, or smtp.");
  const config = smtpConfig();
  const socket = await connectSmtp(config);
  try {
    const message = [
      `From: Matriva <${config.from}>`, `To: <${email.to}>`, `Subject: ${encodeHeader("Invitation til en bolig i Matriva")}`,
      "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: 8bit", "", body
    ].join("\r\n");
    const authPlain = Buffer.from(`\u0000${config.user}\u0000${config.password}`, "utf8").toString("base64");
    await expectSmtp(socket, `AUTH PLAIN ${authPlain}`, [235]);
    await expectSmtp(socket, `MAIL FROM:<${config.from}>`, [250]);
    await expectSmtp(socket, `RCPT TO:<${email.to}>`, [250, 251]);
    await expectSmtp(socket, "DATA", [354]);
    await expectSmtp(socket, `${dotStuff(message)}\r\n.`, [250]);
    await expectSmtp(socket, "QUIT", [221]);
  } finally { socket.end(); }
  return {};
}
