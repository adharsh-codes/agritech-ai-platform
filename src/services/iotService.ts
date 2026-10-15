import { 
  collection, 
  doc, 
  onSnapshot, 
  getDoc,
  getDocs 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  IotTelemetryData, 
  FarmingMode,
  deriveMoistureStatus,
  derivePhStatus,
  deriveEcStatus,
  deriveWaterLevelStatus
} from "@/types/iot";

const COLLECTION_NAME = "iot_telemetry";

// In-memory fallback cache for server-side API routes or offline resilience
const inMemoryStore = new Map<string, IotTelemetryData>();

/**
 * Sanitizes and validates IoT Telemetry payload values for Soil and Hydroponics modes.
 * Clamps numeric values to valid operational ranges.
 */
export function sanitizeTelemetryPayload(data: Partial<IotTelemetryData>): IotTelemetryData {
  const deviceId = data.deviceId && typeof data.deviceId === "string" && data.deviceId.trim() !== ""
    ? data.deviceId.trim()
    : "esp32_zone_01";

  // Determine farming mode (explicitly passed or inferred from device ID prefix)
  const farmingMode: FarmingMode = data.farmingMode === "hydroponics" || deviceId.toLowerCase().includes("hydro")
    ? "hydroponics"
    : "soil";

  // Shared environmental metrics
  const rawTemp = Number(data.temperature);
  const temperature = isNaN(rawTemp) ? 28 : Math.min(60, Math.max(-10, Math.round(rawTemp * 10) / 10));

  const rawHumidity = Number(data.humidity);
  const humidity = isNaN(rawHumidity) ? 65 : Math.min(100, Math.max(0, Math.round(rawHumidity)));

  const rawLux = Number(data.lightLux);
  const lightLux = isNaN(rawLux) ? 1200 : Math.max(0, Math.round(rawLux));

  const status: "online" | "simulated" = data.status === "simulated" ? "simulated" : "online";

  const now = new Date();
  const timestamp = data.timestamp ? data.timestamp : now.toISOString();
  const updatedAtFormatted = now.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const baseTelemetry: IotTelemetryData = {
    deviceId,
    farmingMode,
    temperature,
    humidity,
    lightLux,
    status,
    timestamp,
    updatedAtFormatted
  };

  if (farmingMode === "hydroponics") {
    // Hydroponics Specific Telemetry
    const rawPh = Number(data.ph);
    const ph = isNaN(rawPh) ? 6.2 : Math.min(14, Math.max(0, Math.round(rawPh * 10) / 10));
    const phStatus = data.phStatus || derivePhStatus(ph);

    const rawEc = Number(data.ec);
    const ec = isNaN(rawEc) ? 1.4 : Math.min(5, Math.max(0, Math.round(rawEc * 10) / 10));
    const ecStatus = data.ecStatus || deriveEcStatus(ec);

    const rawTds = Number(data.tds);
    const tds = isNaN(rawTds) ? Math.round(ec * 500) : Math.min(3000, Math.max(0, Math.round(rawTds)));

    const rawWaterTemp = Number(data.waterTemperature);
    const waterTemperature = isNaN(rawWaterTemp) ? 23.5 : Math.min(50, Math.max(0, Math.round(rawWaterTemp * 10) / 10));

    const rawWaterLevel = Number(data.waterLevel);
    const waterLevel = isNaN(rawWaterLevel) ? 80 : Math.min(100, Math.max(0, Math.round(rawWaterLevel)));
    const waterLevelStatus = data.waterLevelStatus || deriveWaterLevelStatus(waterLevel);

    return {
      ...baseTelemetry,
      ph,
      phStatus,
      ec,
      ecStatus,
      tds,
      waterTemperature,
      waterLevel,
      waterLevelStatus
    };
  } else {
    // Soil Specific Telemetry
    const rawMoisture = Number(data.soilMoisture);
    const soilMoisture = isNaN(rawMoisture) ? 50 : Math.min(100, Math.max(0, Math.round(rawMoisture)));
    const soilMoistureStatus = data.soilMoistureStatus || deriveMoistureStatus(soilMoisture);

    const rawTank = Number(data.waterTankLevel);
    const waterTankLevel = isNaN(rawTank) ? 80 : Math.min(100, Math.max(0, Math.round(rawTank)));

    return {
      ...baseTelemetry,
      soilMoisture,
      soilMoistureStatus,
      waterTankLevel
    };
  }
}

export const iotService = {
  /**
   * Real-time listener for telemetry of a specific device ID
   */
  subscribeToTelemetry(
    deviceId: string, 
    callback: (data: IotTelemetryData | null) => void
  ): () => void {
    if (!deviceId) {
      callback(null);
      return () => {};
    }

    const docRef = doc(db, COLLECTION_NAME, deviceId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as IotTelemetryData;
          inMemoryStore.set(deviceId, data);
          callback(data);
        } else {
          callback(inMemoryStore.get(deviceId) || null);
        }
      },
      (error) => {
        console.warn("[telemetry] Firestore document listener failed", JSON.stringify({
          projectId: db.app.options.projectId ?? "unknown",
          collection: COLLECTION_NAME,
          deviceId,
          errorCode: error.code || "unknown",
        }));
        callback(inMemoryStore.get(deviceId) || null);
      }
    );

    return unsubscribe;
  },

  /**
   * Real-time listener for all active telemetry devices in `iot_telemetry` collection
   */
  subscribeToAllTelemetry(
    callback: (devices: IotTelemetryData[]) => void
  ): () => void {
    const colRef = collection(db, COLLECTION_NAME);

    const unsubscribe = onSnapshot(
      colRef,
      (querySnap) => {
        const list: IotTelemetryData[] = [];
        querySnap.forEach((docSnap) => {
          if (docSnap.exists()) {
            const d = docSnap.data() as IotTelemetryData;
            list.push(d);
            inMemoryStore.set(d.deviceId, d);
          }
        });
        callback(list.length > 0 ? list : Array.from(inMemoryStore.values()));
      },
      (error) => {
        console.warn("[telemetry] Firestore collection listener failed", JSON.stringify({
          projectId: db.app.options.projectId ?? "unknown",
          collection: COLLECTION_NAME,
          errorCode: error.code || "unknown",
        }));
        callback(Array.from(inMemoryStore.values()));
      }
    );

    return unsubscribe;
  },

  /**
   * Fetch one-off latest telemetry for a device
   */
  async getTelemetry(deviceId: string): Promise<IotTelemetryData | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, deviceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as IotTelemetryData;
        inMemoryStore.set(deviceId, data);
        return data;
      }
    } catch (err: unknown) {
      console.warn(`Firestore getDoc fallback for ${deviceId}:`, err instanceof Error ? err.message : String(err));
    }

    return inMemoryStore.get(deviceId) || null;
  },

  /**
   * Fetch one-off telemetry list for all devices
   */
  async getAllTelemetry(): Promise<IotTelemetryData[]> {
    const list: IotTelemetryData[] = [];
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const querySnap = await getDocs(colRef);
      querySnap.forEach((docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data() as IotTelemetryData;
          list.push(d);
          inMemoryStore.set(d.deviceId, d);
        }
      });
    } catch (err: unknown) {
      console.warn("Firestore getDocs fallback for all telemetry:", err instanceof Error ? err.message : String(err));
    }

    if (list.length === 0) {
      return Array.from(inMemoryStore.values());
    }
    return list;
  }
};
