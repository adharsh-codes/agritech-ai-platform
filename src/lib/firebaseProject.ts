/** Shared project identity for browser Firebase and server Admin SDK clients. */
export const FIREBASE_PROJECT_ID = "agritech-ai-platform";

export function assertFirebaseProjectId(actualProjectId: string | undefined): void {
  if (actualProjectId !== FIREBASE_PROJECT_ID) {
    throw new Error("Firebase Admin is initialized for an unexpected project");
  }
}
