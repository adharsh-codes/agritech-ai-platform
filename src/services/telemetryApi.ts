import { timingSafeEqual } from "node:crypto";
import type { IotTelemetryData } from "@/types/iot";

export const SIMULATOR_ORIGIN = "https://hardware-stimulator.lovable.app";
export const ALLOWED_TELEMETRY_DEVICES = {
  esp32_zone_01: "soil",
  esp32_zone_02: "soil",
  hydro_zone_01: "hydroponics",
} as const;

const MAX_LIGHT_LUX = 100_000;
const MAX_BODY_BYTES = 8_192;

export class TelemetryRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TelemetryRequestError";
    this.status = status;
  }
}

export function corsHeaders(origin: string | null): HeadersInit {
  if (origin !== SIMULATOR_ORIGIN) return {};

  return {
    "Access-Control-Allow-Origin": SIMULATOR_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function isAllowedOrigin(origin: string | null): boolean {
  return origin === SIMULATOR_ORIGIN;
}

export function isAuthorized(authorization: string | null): boolean {
  const configuredKey = process.env.IOT_SIMULATOR_API_KEY;
  if (!configuredKey || configuredKey.length < 32 || !authorization) return false;

  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(authorization);
  if (!match) return false;

  const expected = Buffer.from(configuredKey);
  const provided = Buffer.from(match[1]);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function requireNumber(
  payload: Record<string, unknown>,
  key: string,
  min: number,
  max: number
): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new TelemetryRequestError(`${key} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

/** Validates the simulator API contract and stamps trusted status/time server-side. */
export function validateSimulatorTelemetry(input: unknown): IotTelemetryData {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TelemetryRequestError("Payload must be a JSON object");
  }

  const payload = input as Record<string, unknown>;
  const allowedKeys = new Set([
    "deviceId", "farmingMode", "soilMoisture", "waterTankLevel", "ph", "ec", "tds",
    "waterTemperature", "waterLevel", "temperature", "humidity", "lightLux",
  ]);
  const unknownKey = Object.keys(payload).find((key) => !allowedKeys.has(key));
  if (unknownKey) throw new TelemetryRequestError(`Unexpected field: ${unknownKey}`);

  if (typeof payload.deviceId !== "string" || !Object.hasOwn(ALLOWED_TELEMETRY_DEVICES, payload.deviceId)) {
    throw new TelemetryRequestError("deviceId is not allowed");
  }

  const expectedMode = ALLOWED_TELEMETRY_DEVICES[payload.deviceId as keyof typeof ALLOWED_TELEMETRY_DEVICES];
  if (payload.farmingMode !== expectedMode) {
    throw new TelemetryRequestError(`farmingMode must be ${expectedMode} for this deviceId`);
  }

  const common = {
    deviceId: payload.deviceId,
    farmingMode: expectedMode,
    temperature: requireNumber(payload, "temperature", -10, 60),
    humidity: requireNumber(payload, "humidity", 0, 100),
    lightLux: requireNumber(payload, "lightLux", 0, MAX_LIGHT_LUX),
    status: "simulated" as const,
    timestamp: new Date().toISOString(),
  };

  if (expectedMode === "soil") {
    return {
      ...common,
      soilMoisture: requireNumber(payload, "soilMoisture", 0, 100),
      waterTankLevel: requireNumber(payload, "waterTankLevel", 0, 100),
    };
  }

  return {
    ...common,
    ph: requireNumber(payload, "ph", 0, 14),
    ec: requireNumber(payload, "ec", 0, 5),
    tds: requireNumber(payload, "tds", 0, 3000),
    waterTemperature: requireNumber(payload, "waterTemperature", 0, 50),
    waterLevel: requireNumber(payload, "waterLevel", 0, 100),
  };
}

export function isBodyWithinLimit(body: string): boolean {
  return Buffer.byteLength(body, "utf8") <= MAX_BODY_BYTES;
}

type TelemetryHandlersDependencies = {
  publishTelemetry: (data: IotTelemetryData) => Promise<IotTelemetryData>;
  getTelemetry: (deviceId: string) => Promise<IotTelemetryData | null>;
};

export function createTelemetryHandlers(dependencies: TelemetryHandlersDependencies) {
  const json = (body: unknown, status: number, origin: string | null) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        Vary: "Origin",
        ...corsHeaders(origin),
      },
    });

  const checkRequest = (request: Request): Response | null => {
    const origin = request.headers.get("origin");
    if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403, origin);
    if (!process.env.IOT_SIMULATOR_API_KEY || process.env.IOT_SIMULATOR_API_KEY.length < 32) {
      return json({ error: "Telemetry API is not configured" }, 503, origin);
    }
    if (!isAuthorized(request.headers.get("authorization"))) {
      return json({ error: "Unauthorized" }, 401, origin);
    }
    return null;
  };

  return {
    OPTIONS(request: Request) {
      const origin = request.headers.get("origin");
      if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403, origin);
      const requestedMethod = request.headers.get("access-control-request-method")?.toUpperCase();
      if (requestedMethod && !["GET", "POST"].includes(requestedMethod)) {
        return json({ error: "Requested method is not allowed" }, 403, origin);
      }
      const requestedHeaders = (request.headers.get("access-control-request-headers") || "")
        .split(",")
        .map((header) => header.trim().toLowerCase())
        .filter(Boolean);
      if (requestedHeaders.some((header) => !["authorization", "content-type"].includes(header))) {
        return json({ error: "Requested headers are not allowed" }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    },

    async POST(request: Request) {
      const origin = request.headers.get("origin");
      const rejected = checkRequest(request);
      if (rejected) return rejected;

      const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        return json({ error: "Content-Type must be application/json" }, 415, origin);
      }

      const contentLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > 8192) {
        return json({ error: "Payload is too large" }, 413, origin);
      }

      let rawBody: string;
      try {
        rawBody = await request.text();
      } catch {
        return json({ error: "Unable to read request body" }, 400, origin);
      }
      if (!isBodyWithinLimit(rawBody)) return json({ error: "Payload is too large" }, 413, origin);

      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return json({ error: "Malformed JSON payload" }, 400, origin);
      }

      try {
        const validated = validateSimulatorTelemetry(body);
        console.info("[telemetry] authenticated request validated", JSON.stringify({
          deviceId: validated.deviceId,
          farmingMode: validated.farmingMode,
        }));
        const persisted = await dependencies.publishTelemetry(validated);
        return json({ success: true, message: "Telemetry persisted", data: persisted }, 200, origin);
      } catch (error) {
        if (error instanceof TelemetryRequestError) {
          return json({ error: error.message }, error.status, origin);
        }
        console.error("API /api/iot/telemetry POST persistence error");
        return json({ error: "Failed to persist telemetry" }, 500, origin);
      }
    },

    async GET(request: Request) {
      const origin = request.headers.get("origin");
      const rejected = checkRequest(request);
      if (rejected) return rejected;

      const deviceId = new URL(request.url).searchParams.get("deviceId");
      if (!deviceId || !Object.hasOwn(ALLOWED_TELEMETRY_DEVICES, deviceId)) {
        return json({ error: "A single allowed deviceId is required" }, 400, origin);
      }

      try {
        const telemetry = await dependencies.getTelemetry(deviceId);
        return json({ telemetry }, 200, origin);
      } catch {
        console.error("API /api/iot/telemetry GET error");
        return json({ error: "Failed to retrieve telemetry data" }, 500, origin);
      }
    },
  };
}
