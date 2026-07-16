import net from "node:net";
import tls from "node:tls";

export type MagicLinkEmail = {
  to: string;
  magicLink: string;
  expiresAt: Date;
};

export type MagicLinkDeliveryResult = {
  devMagicLink?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

const matrivaLoginEmail = "login@matriva.dk";

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

  if (user !== matrivaLoginEmail || from !== matrivaLoginEmail) {
    throw new Error(
      "MATRIVA_SMTP_USER and MATRIVA_SMTP_FROM must both be login@matriva.dk."
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
  return [
    "Hej,",
    "",
    "Brug linket herunder til at logge ind i Matriva:",
    email.magicLink,
    "",
    `Linket udløber ${expiresAt}.`,
    "Hvis du ikke bad om linket, kan du ignorere denne mail.",
    "",
    "Venlig hilsen",
    "Matriva"
  ].join("\n");
}

function createMessage(config: SmtpConfig, email: MagicLinkEmail, expiresAt: string) {
  assertSafeAddress(email.to);
  assertSafeAddress(config.from);

  const body = formatMagicLinkText(email, expiresAt);

  return [
    `From: Matriva <${config.from}>`,
    `To: <${email.to}>`,
    `Subject: ${encodeHeader("Dit loginlink til Matriva")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body
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
