/**
 * IoT Telemetry Types & Interface Definitions
 * Phase 2 — Hardware Data Pipeline (Soil & Hydroponics Coexistence)
 */

export type FarmingMode = "soil" | "hydroponics";

export interface IotTelemetryData {
  deviceId: string;
  farmingMode?: FarmingMode;
  
  // Shared & Environmental Metrics
  temperature: number; // Air/Ambient Temperature °C
  humidity: number; // Air Humidity %
  lightLux: number; // Sunlight Lux
  status: "online" | "simulated";
  timestamp: string | number; // ISO string or ms epoch
  updatedAtFormatted?: string;

  // Soil-Specific Metrics (Optional if farmingMode === "hydroponics")
  soilMoisture?: number; // 0 - 100 %
  soilMoistureStatus?: "dry" | "optimal" | "wet";
  waterTankLevel?: number; // 0 - 100 %

  // Hydroponics-Specific Metrics (Optional if farmingMode === "soil")
  ph?: number; // 0 - 14 pH scale
  phStatus?: "low" | "optimal" | "high";
  ec?: number; // Electrical Conductivity in mS/cm (0.2 - 5.0)
  ecStatus?: "low" | "optimal" | "high";
  tds?: number; // Total Dissolved Solids in PPM (100 - 3000)
  waterTemperature?: number; // Nutrient Solution Temp °C
  waterLevel?: number; // Hydro Reservoir Water Level 0 - 100 %
  waterLevelStatus?: "low" | "optimal" | "high";
}

export type DerivedDeviceStatus = "online" | "simulated" | "offline";

/**
 * Default stale threshold in milliseconds (45 seconds).
 * If no telemetry received within this window, status is derived as "offline".
 */
export const STALE_TELEMETRY_THRESHOLD_MS = 45000;

/**
 * Calculates derived device connection status based on last seen timestamp and reported status
 */
export function deriveDeviceStatus(telemetry: Partial<IotTelemetryData> | null): DerivedDeviceStatus {
  if (!telemetry || !telemetry.timestamp) {
    return "offline";
  }

  const timestampMs = typeof telemetry.timestamp === "number"
    ? telemetry.timestamp
    : new Date(telemetry.timestamp).getTime();

  if (isNaN(timestampMs)) {
    return "offline";
  }

  const now = Date.now();
  const elapsed = now - timestampMs;

  if (elapsed > STALE_TELEMETRY_THRESHOLD_MS) {
    return "offline";
  }

  return telemetry.status === "simulated" ? "simulated" : "online";
}

/**
 * Helper to derive soil moisture status text from numeric percentage
 */
export function deriveMoistureStatus(moisturePercentage: number): "dry" | "optimal" | "wet" {
  if (moisturePercentage < 30) return "dry";
  if (moisturePercentage > 75) return "wet";
  return "optimal";
}

/**
 * Helper to derive hydroponic pH status (Optimal range: 5.5 - 6.8)
 */
export function derivePhStatus(ph: number): "low" | "optimal" | "high" {
  if (ph < 5.5) return "low";
  if (ph > 6.8) return "high";
  return "optimal";
}

/**
 * Helper to derive hydroponic EC status (Optimal range: 1.0 - 2.2 mS/cm)
 */
export function deriveEcStatus(ec: number): "low" | "optimal" | "high" {
  if (ec < 1.0) return "low";
  if (ec > 2.2) return "high";
  return "optimal";
}

/**
 * Helper to derive hydroponic water level status
 */
export function deriveWaterLevelStatus(level: number): "low" | "optimal" | "high" {
  if (level < 35) return "low";
  if (level > 95) return "high";
  return "optimal";
}
