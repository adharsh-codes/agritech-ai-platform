export async function persistBeforeCache<T>(
  write: () => Promise<T>,
  updateCache: () => void
): Promise<T> {
  const persisted = await write();
  updateCache();
  return persisted;
}

export type TelemetryDocumentAdapter<T> = {
  write: (collection: string, documentId: string, data: T) => Promise<void>;
  read: (collection: string, documentId: string) => Promise<T | null>;
};

/** Persistence boundary shared by the Admin SDK service and isolated unit tests. */
export function createTelemetryPersistence<T extends { deviceId: string }>(
  adapter: TelemetryDocumentAdapter<T>,
  collection: string
) {
  return {
    async publish(data: T): Promise<T> {
      await adapter.write(collection, data.deviceId, data);
      return data;
    },
    get(deviceId: string): Promise<T | null> {
      return adapter.read(collection, deviceId);
    },
  };
}
