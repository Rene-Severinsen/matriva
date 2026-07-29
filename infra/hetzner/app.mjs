process.env.NODE_ENV ||= "production";

await import("./apps/api/dist/server.js");
