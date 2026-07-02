import { createServer } from "node:http";

import {
  healthResponseSchema,
  homeBootstrapResponseSchema
} from "@matriva/shared";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "127.0.0.1";

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    const body = healthResponseSchema.parse({
      status: "ok",
      service: "matriva-api",
      timestamp: new Date().toISOString()
    });

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
    return;
  }

  if (request.method === "GET" && request.url === "/v1/bootstrap") {
    const now = new Date().toISOString();
    const body = homeBootstrapResponseSchema.parse({
      user: {
        id: "usr_k7q4m2x9p8vn",
        displayName: "Development user",
        email: null
      },
      house: {
        id: "house_p9x2v7q4m8kn",
        displayName: "Skeleton house",
        address: {
          streetName: "Eksempelvej",
          houseNumber: "1",
          postalCode: "1000",
          city: "København",
          countryCode: "DK"
        },
        propertyType: "UNKNOWN"
      },
      entitlements: {
        plan: "free",
        status: "free",
        features: {
          "documents.maxCount": { kind: "limit", value: 0 },
          "documents.maxStorageMb": { kind: "limit", value: 0 },
          "tasks.maxActive": { kind: "limit", value: 0 },
          "advisories.enabled": { kind: "boolean", value: false },
          "legalUpdates.enabled": { kind: "boolean", value: false },
          "sharing.enabled": { kind: "boolean", value: false },
          "export.enabled": { kind: "boolean", value: false },
          "advancedReminders.enabled": { kind: "boolean", value: false }
        },
        evaluatedAt: now
      },
      cards: [
        {
          id: "card_m4v8q2x7k9pn",
          type: "SYSTEM_NOTICE",
          title: "Skeleton contract",
          shortExplanation:
            "Development-only bootstrap response for validating the shared API contract.",
          severity: "info",
          action: {
            label: "No action",
            target: { kind: "none" }
          },
          validFrom: now,
          validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
          audience: {
            countryCode: "DK",
            propertyTypes: ["UNKNOWN"]
          },
          minAppVersion: "0.1.0",
          fallbackText:
            "Matriva is preparing the first backend-driven home card contract."
        }
      ],
      generatedAt: now,
      skeleton: true
    });

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, host, () => {
  console.log(`Matriva API listening on http://${host}:${port}`);
});
