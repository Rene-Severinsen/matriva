import argon2 from "argon2";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stderr = process.stderr;

    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(
        new Error("Password skal indtastes fra en interaktiv terminal.")
      );
      return;
    }

    let value = "";
    let settled = false;

    function cleanup() {
      stdin.off("data", onData);
      stdin.off("error", onError);

      if (stdin.isRaw) {
        stdin.setRawMode(false);
      }

      stdin.pause();
    }

    function finish(result) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      stderr.write("\n");
      resolve(result);
    }

    function onError(error) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      stderr.write("\n");
      reject(error);
    }

    function onData(chunk) {
      const text = String(chunk);

      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          stderr.write("\n");
          process.exitCode = 130;
          reject(new Error("Indtastning afbrudt."));
          return;
        }

        if (char === "\r" || char === "\n") {
          finish(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    }

    stderr.write(prompt);

    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    stdin.on("error", onError);
  });
}

try {
  const first = await readHidden("Admin-password\n> ");
  const second = await readHidden("Gentag admin-password\n> ");

  if (first.length === 0) {
    throw new Error("Password må ikke være tomt.");
  }

  if (first !== second) {
    throw new Error("Password-værdierne matcher ikke.");
  }

  const hash = await argon2.hash(first, {
    type: argon2.argon2id
  });

  console.log(hash);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Hash-generering mislykkedes."
  );
  process.exitCode = 1;
}
