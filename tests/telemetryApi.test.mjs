import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  createTelemetryHandlers,
  SIMULATOR_ORIGIN,
} from "../src/services/telemetryApi.ts";
import { createTelemetryPersistence, persistBeforeCache } from "../src/services/telemetryPersistence.ts";
import { assertFirebaseProjectId, FIREBASE_PROJECT_ID } from "../src/lib/firebaseProject.ts";

const apiKey = "local-test-key-0123456789-0123456789";
const origin = SIMULATOR_ORIGIN;
const auth = "Bearer " + apiKey;

const soil = {
  deviceId: "esp32_zone_01",
  farmingMode: "soil",
  soilMoisture: 55,
  waterTankLevel: 85,
  temperature: 27,
  humidity: 62,
  lightLux: 1400,
};

const hydro = {
  deviceId: "hydro_zone_01",
  farmingMode: "hydroponics",
  ph: 6.2,
  ec: 1.4,
  tds: 700,
  waterTemperature: 23.5,
  waterLevel: 78,
  temperature: 27,
  humidity: 62,
  lightLux: 1400,
};

function makeHandlers(overrides = {}) {
  return createTelemetryHandlers({
    publishTelemetry: async (data) => data,
    getTelemetry: async () => null,
    ...overrides,
  });
}

function makeRequest(path, { method = "POST", body, requestOrigin = origin, token = auth, contentType = "application/json", extraHeaders = {} } = {}) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  if (requestOrigin !== null) headers.set("Origin", requestOrigin);
  if (token !== null) headers.set("Authorization", token);
  if (contentType) headers.set("Content-Type", contentType);
  return new Request("https://ecoterrace.test" + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

beforeEach(() => {
  process.env.IOT_SIMULATOR_API_KEY = apiKey;
});

test("accepts valid soil telemetry and stamps it simulated with server time", async () => {
  let published;
  const response = await makeHandlers({ publishTelemetry: async (data) => (published = data) })
    .POST(makeRequest("/api/iot/telemetry", { body: soil }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(published.deviceId, "esp32_zone_01");
  assert.equal(published.status, "simulated");
  assert.ok(Math.abs(Date.now() - Date.parse(published.timestamp)) < 2_000);
  assert.equal(result.data.soilMoisture, 55);
});

test("accepts valid hydroponics telemetry for the existing hydro device", async () => {
  const response = await makeHandlers().POST(makeRequest("/api/iot/telemetry", { body: hydro }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.data.deviceId, "hydro_zone_01");
  assert.equal(result.data.farmingMode, "hydroponics");
  assert.equal(result.data.status, "simulated");
  assert.equal(result.data.tds, 700);
});

test("accepts the second existing soil device ID", async () => {
  const response = await makeHandlers().POST(makeRequest("/api/iot/telemetry", {
    body: { ...soil, deviceId: "esp32_zone_02" },
  }));
  assert.equal(response.status, 200);
});

test("rejects malformed JSON", async () => {
  const response = await makeHandlers().POST(makeRequest("/api/iot/telemetry", { body: "{" }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Malformed JSON/);
});

test("rejects arrays, missing fields, and unexpected fields", async (t) => {
  const handlers = makeHandlers();
  const cases = [
    ["array", []],
    ["missing required sensor", { ...soil, humidity: undefined }],
    ["unexpected status field", { ...soil, status: "online" }],
    ["unexpected timestamp field", { ...soil, timestamp: "2000-01-01T00:00:00Z" }],
  ];

  for (const [name, payload] of cases) {
    await t.test(name, async () => {
      const response = await handlers.POST(makeRequest("/api/iot/telemetry", { body: payload }));
      assert.equal(response.status, 400);
    });
  }
});

test("rejects unsupported IDs, mismatched modes, and invalid numeric ranges", async (t) => {
  const handlers = makeHandlers();
  const cases = [
    ["unknown device", { ...soil, deviceId: "esp32_zone_03" }],
    ["mode mismatch", { ...soil, farmingMode: "hydroponics" }],
    ["soil outside range", { ...soil, soilMoisture: 101 }],
    ["non-number sensor", { ...soil, temperature: "27" }],
    ["non-finite sensor", { ...soil, temperature: null }],
    ["hydro outside range", { ...hydro, ph: 14.1 }],
    ["hydro invalid EC", { ...hydro, ec: -0.1 }],
  ];

  for (const [name, payload] of cases) {
    await t.test(name, async () => {
      const response = await handlers.POST(makeRequest("/api/iot/telemetry", { body: payload }));
      assert.equal(response.status, 400);
    });
  }
});

test("rejects unauthorized and missing server tokens before publishing", async () => {
  let writes = 0;
  const handlers = makeHandlers({ publishTelemetry: async (data) => { writes += 1; return data; } });
  const response = await handlers.POST(makeRequest("/api/iot/telemetry", { body: soil, token: "Bearer wrong" }));
  assert.equal(response.status, 401);
  assert.equal(writes, 0);

  delete process.env.IOT_SIMULATOR_API_KEY;
  const unconfigured = await handlers.POST(makeRequest("/api/iot/telemetry", { body: soil }));
  assert.equal(unconfigured.status, 503);
});

test("allows CORS only for the deployed simulator origin", async (t) => {
  const handlers = makeHandlers();
  const allowed = await handlers.OPTIONS(makeRequest("/api/iot/telemetry", {
    method: "OPTIONS",
    extraHeaders: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
  }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(allowed.headers.get("Access-Control-Allow-Methods"), "POST, GET, OPTIONS");
  assert.equal(allowed.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");

  await t.test("rejects a different origin", async () => {
    const rejected = await handlers.OPTIONS(makeRequest("/api/iot/telemetry", {
      method: "OPTIONS", requestOrigin: "https://attacker.example",
    }));
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);
  });

  await t.test("rejects unlisted preflight methods and headers", async () => {
    const badMethod = await handlers.OPTIONS(makeRequest("/api/iot/telemetry", {
      method: "OPTIONS", extraHeaders: { "Access-Control-Request-Method": "DELETE" },
    }));
    assert.equal(badMethod.status, 403);

    const badHeader = await handlers.OPTIONS(makeRequest("/api/iot/telemetry", {
      method: "OPTIONS",
      extraHeaders: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-custom-token" },
    }));
    assert.equal(badHeader.status, 403);
  });

  await t.test("rejects POST without the exact origin", async () => {
    const rejected = await handlers.POST(makeRequest("/api/iot/telemetry", {
      body: soil, requestOrigin: "https://attacker.example",
    }));
    assert.equal(rejected.status, 403);
  });
});

test("rejects non-JSON content types and oversized payloads", async (t) => {
  const handlers = makeHandlers();
  const wrongType = await handlers.POST(makeRequest("/api/iot/telemetry", { body: soil, contentType: "text/plain" }));
  assert.equal(wrongType.status, 415);

  await t.test("body over 8 KiB", async () => {
    const large = { ...soil, extra: "x".repeat(9_000) };
    const response = await handlers.POST(makeRequest("/api/iot/telemetry", { body: large }));
    assert.equal(response.status, 413);
  });
});

test("GET requires authentication and one allowed device; GET-all is rejected", async (t) => {
  let reads = 0;
  const handlers = makeHandlers({ getTelemetry: async () => { reads += 1; return null; } });

  const unauthorized = await handlers.GET(makeRequest("/api/iot/telemetry?deviceId=esp32_zone_01", {
    method: "GET", token: "Bearer wrong",
  }));
  assert.equal(unauthorized.status, 401);

  await t.test("no deviceId", async () => {
    const response = await handlers.GET(makeRequest("/api/iot/telemetry", { method: "GET" }));
    assert.equal(response.status, 400);
  });

  await t.test("unknown deviceId", async () => {
    const response = await handlers.GET(makeRequest("/api/iot/telemetry?deviceId=other", { method: "GET" }));
    assert.equal(response.status, 400);
  });

  const allowed = await handlers.GET(makeRequest("/api/iot/telemetry?deviceId=hydro_zone_01", { method: "GET" }));
  assert.equal(allowed.status, 200);
  assert.equal(reads, 1);
});

test("Firestore write rejection returns an error and never a success response", async () => {
  const handlers = makeHandlers({ publishTelemetry: async () => { throw new Error("Firestore unavailable"); } });
  const response = await handlers.POST(makeRequest("/api/iot/telemetry", { body: soil }));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).success, undefined);
});

test("a failed Firestore write propagates and does not update the in-memory cache", async () => {
  let cached = false;
  await assert.rejects(
    persistBeforeCache(async () => { throw new Error("Firestore write failed"); }, () => { cached = true; }),
    /Firestore write failed/
  );
  assert.equal(cached, false);
});

test("Admin persistence writes the unchanged telemetry document to the existing collection and ID", async () => {
  const writes = [];
  const persistence = createTelemetryPersistence({
    async write(collection, documentId, data) {
      writes.push({ collection, documentId, data });
    },
    async read() { return null; },
  }, "iot_telemetry");

  const persisted = await persistence.publish({ ...soil, status: "simulated", timestamp: "2026-10-15T00:00:00.000Z" });

  assert.equal(persisted.deviceId, "esp32_zone_01");
  assert.deepEqual(writes, [{
    collection: "iot_telemetry",
    documentId: "esp32_zone_01",
    data: persisted,
  }]);
});

test("Admin persistence propagates Firestore write failures", async () => {
  const failure = Object.assign(new Error("Firestore unavailable"), { code: 5 });
  const persistence = createTelemetryPersistence({
    async write() { throw failure; },
    async read() { return null; },
  }, "iot_telemetry");

  await assert.rejects(persistence.publish({ ...soil, status: "simulated", timestamp: "2026-10-15T00:00:00.000Z" }), (error) => error === failure);
});

test("Firebase Admin project guard accepts only the existing EcoTerrace project", () => {
  assert.equal(FIREBASE_PROJECT_ID, "agritech-ai-platform");
  assert.doesNotThrow(() => assertFirebaseProjectId("agritech-ai-platform"));
  assert.throws(() => assertFirebaseProjectId("unexpected-project"), /unexpected project/);
});
