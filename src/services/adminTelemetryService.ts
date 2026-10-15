import "server-only";

import type { IotTelemetryData } from "@/types/iot";
import { FIREBASE_PROJECT_ID } from "@/lib/firebaseProject";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { createTelemetryPersistence } from "@/services/telemetryPersistence";

const COLLECTION_NAME = "iot_telemetry";

// Admin SDK writes bypass Firestore rules. This service is server-only and is
// reachable only through the API's bearer authentication and strict validation.
function getPersistence() {
  const firestore = getAdminFirestore();
  return createTelemetryPersistence<IotTelemetryData>({
    async write(collection, documentId, data) {
      await firestore.collection(collection).doc(documentId).set(data, { merge: true });
    },
    async read(collection, documentId) {
      const snapshot = await firestore.collection(collection).doc(documentId).get();
      return snapshot.exists ? snapshot.data() as IotTelemetryData : null;
    },
  }, COLLECTION_NAME);
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "unknown";
}

export const adminTelemetryService = {
  async publishTelemetry(data: IotTelemetryData): Promise<IotTelemetryData> {
    try {
      const persisted = await getPersistence().publish(data);
      console.info("[telemetry] Admin Firestore write confirmed", JSON.stringify({
        projectId: FIREBASE_PROJECT_ID,
        collection: COLLECTION_NAME,
        deviceId: data.deviceId,
      }));
      return persisted;
    } catch (error) {
      console.error("[telemetry] Admin Firestore write failed", JSON.stringify({
        projectId: FIREBASE_PROJECT_ID,
        collection: COLLECTION_NAME,
        deviceId: data.deviceId,
        errorCode: errorCode(error),
      }));
      throw error;
    }
  },

  async getTelemetry(deviceId: string): Promise<IotTelemetryData | null> {
    try {
      return await getPersistence().get(deviceId);
    } catch (error) {
      console.error("[telemetry] Admin Firestore read failed", JSON.stringify({
        projectId: FIREBASE_PROJECT_ID,
        collection: COLLECTION_NAME,
        deviceId,
        errorCode: errorCode(error),
      }));
      throw error;
    }
  },
};
