import { NextRequest } from "next/server";
import { adminTelemetryService } from "@/services/adminTelemetryService";
import { createTelemetryHandlers } from "@/services/telemetryApi";

export const runtime = "nodejs";

const handlers = createTelemetryHandlers(adminTelemetryService);

export function OPTIONS(request: NextRequest) {
  return handlers.OPTIONS(request);
}

export function POST(request: NextRequest) {
  return handlers.POST(request);
}

export function GET(request: NextRequest) {
  return handlers.GET(request);
}
