import { NextRequest, NextResponse } from "next/server";
import { iotService } from "@/services/iotService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Basic validation requirements
    if (body.deviceId && typeof body.deviceId !== "string") {
      return NextResponse.json(
        { error: "deviceId must be a string if provided" },
        { status: 400 }
      );
    }

    // Soil Mode Validations
    if (body.soilMoisture !== undefined && (isNaN(Number(body.soilMoisture)) || Number(body.soilMoisture) < 0 || Number(body.soilMoisture) > 100)) {
      return NextResponse.json(
        { error: "soilMoisture must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    if (body.waterTankLevel !== undefined && (isNaN(Number(body.waterTankLevel)) || Number(body.waterTankLevel) < 0 || Number(body.waterTankLevel) > 100)) {
      return NextResponse.json(
        { error: "waterTankLevel must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    // Hydroponics Mode Validations
    if (body.ph !== undefined && (isNaN(Number(body.ph)) || Number(body.ph) < 0 || Number(body.ph) > 14)) {
      return NextResponse.json(
        { error: "ph must be a number between 0 and 14" },
        { status: 400 }
      );
    }

    if (body.ec !== undefined && (isNaN(Number(body.ec)) || Number(body.ec) < 0)) {
      return NextResponse.json(
        { error: "ec (electrical conductivity) must be a non-negative number" },
        { status: 400 }
      );
    }

    if (body.tds !== undefined && (isNaN(Number(body.tds)) || Number(body.tds) < 0)) {
      return NextResponse.json(
        { error: "tds must be a non-negative number" },
        { status: 400 }
      );
    }

    if (body.waterTemperature !== undefined && isNaN(Number(body.waterTemperature))) {
      return NextResponse.json(
        { error: "waterTemperature must be a valid number" },
        { status: 400 }
      );
    }

    if (body.waterLevel !== undefined && (isNaN(Number(body.waterLevel)) || Number(body.waterLevel) < 0 || Number(body.waterLevel) > 100)) {
      return NextResponse.json(
        { error: "waterLevel must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    // Shared Metrics Validations
    if (body.temperature !== undefined && isNaN(Number(body.temperature))) {
      return NextResponse.json(
        { error: "temperature must be a valid number" },
        { status: 400 }
      );
    }

    if (body.humidity !== undefined && (isNaN(Number(body.humidity)) || Number(body.humidity) < 0 || Number(body.humidity) > 100)) {
      return NextResponse.json(
        { error: "humidity must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    if (body.lightLux !== undefined && (isNaN(Number(body.lightLux)) || Number(body.lightLux) < 0)) {
      return NextResponse.json(
        { error: "lightLux must be a non-negative number" },
        { status: 400 }
      );
    }

    const sanitized = await iotService.publishTelemetry(body);

    return NextResponse.json({
      success: true,
      message: "Telemetry received successfully",
      data: sanitized
    });
  } catch (error: any) {
    console.error("API /api/iot/telemetry POST Error:", error);
    return NextResponse.json(
      { error: "Failed to process telemetry payload", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId");

    if (deviceId) {
      const data = await iotService.getTelemetry(deviceId);
      return NextResponse.json({ telemetry: data });
    } else {
      const list = await iotService.getAllTelemetry();
      return NextResponse.json({ telemetryList: list });
    }
  } catch (error) {
    console.error("API /api/iot/telemetry GET Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve telemetry data" },
      { status: 500 }
    );
  }
}
