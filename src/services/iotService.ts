import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  getDocs 
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
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

async function ensureAuth() {
  if (typeof window !== "undefined" || auth.currentUser) return;
  try {
    await signInAnonymously(auth);
  } catch (e) {
    // Silent catch if anonymous auth is not configured in Firebase console
  }
}

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

    ensureAuth();
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
        console.warn(`Firestore snapshot warning for ${deviceId}:`, error.message);
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
    ensureAuth();
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
        console.warn("Firestore snapshot all telemetry warning:", error.message);
        callback(Array.from(inMemoryStore.values()));
      }
    );

    return unsubscribe;
  },

  /**
   * Publishes telemetry data into Firestore (`iot_telemetry/{deviceId}`)
   */
  async publishTelemetry(data: Partial<IotTelemetryData>): Promise<IotTelemetryData> {
    const sanitized = sanitizeTelemetryPayload(data);
    inMemoryStore.set(sanitized.deviceId, sanitized);

    try {
      await ensureAuth();
      const docRef = doc(db, COLLECTION_NAME, sanitized.deviceId);
      await setDoc(docRef, sanitized, { merge: true });
    } catch (err: any) {
      console.warn(`Firestore setDoc fallback for ${sanitized.deviceId}:`, err?.message || String(err));
    }

    return sanitized;
  },

  /**
   * Helper function for ESP32 simulation pushes (supports soil and hydroponics)
   */
  async simulateTelemetryPush(
    deviceId: string = "esp32_zone_01", 
    data?: Partial<IotTelemetryData>
  ): Promise<IotTelemetryData> {
    const isHydro = data?.farmingMode === "hydroponics" || deviceId.toLowerCase().includes("hydro");

    const payload: Partial<IotTelemetryData> = isHydro ? {
      deviceId,
      farmingMode: "hydroponics",
      ph: data?.ph ?? Math.round((5.8 + Math.random() * 0.8) * 10) / 10,
      ec: data?.ec ?? Math.round((1.2 + Math.random() * 0.6) * 10) / 10,
      tds: data?.tds ?? Math.floor(650 + Math.random() * 250),
      waterTemperature: data?.waterTemperature ?? Math.round((21 + Math.random() * 4) * 10) / 10,
      waterLevel: data?.waterLevel ?? Math.floor(75 + Math.random() * 20),
      temperature: data?.temperature ?? Math.floor(25 + Math.random() * 6),
      humidity: data?.humidity ?? Math.floor(55 + Math.random() * 20),
      lightLux: data?.lightLux ?? Math.floor(8000 + Math.random() * 6000),
      status: "simulated",
      timestamp: new Date().toISOString(),
      ...data
    } : {
      deviceId,
      farmingMode: "soil",
      soilMoisture: data?.soilMoisture ?? Math.floor(40 + Math.random() * 30),
      waterTankLevel: data?.waterTankLevel ?? Math.floor(70 + Math.random() * 25),
      temperature: data?.temperature ?? Math.floor(24 + Math.random() * 8),
      humidity: data?.humidity ?? Math.floor(55 + Math.random() * 20),
      lightLux: data?.lightLux ?? Math.floor(800 + Math.random() * 800),
      status: "simulated",
      timestamp: new Date().toISOString(),
      ...data
    };

    return await this.publishTelemetry(payload);
  },

  /**
   * Fetch one-off latest telemetry for a device
   */
  async getTelemetry(deviceId: string): Promise<IotTelemetryData | null> {
    try {
      await ensureAuth();
      const docRef = doc(db, COLLECTION_NAME, deviceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as IotTelemetryData;
        inMemoryStore.set(deviceId, data);
        return data;
      }
    } catch (err: any) {
      console.warn(`Firestore getDoc fallback for ${deviceId}:`, err?.message || String(err));
    }

    return inMemoryStore.get(deviceId) || null;
  },

  /**
   * Fetch one-off telemetry list for all devices
   */
  async getAllTelemetry(): Promise<IotTelemetryData[]> {
    const list: IotTelemetryData[] = [];
    try {
      await ensureAuth();
      const colRef = collection(db, COLLECTION_NAME);
      const querySnap = await getDocs(colRef);
      querySnap.forEach((docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data() as IotTelemetryData;
          list.push(d);
          inMemoryStore.set(d.deviceId, d);
        }
      });
    } catch (err: any) {
      console.warn("Firestore getDocs fallback for all telemetry:", err?.message || String(err));
    }

    if (list.length === 0) {
      return Array.from(inMemoryStore.values());
    }
    return list;
  }
};
