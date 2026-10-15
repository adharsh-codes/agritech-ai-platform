import "server-only";

import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertFirebaseProjectId, FIREBASE_PROJECT_ID } from "@/lib/firebaseProject";

function getAdminApp() {
  const existing = getApps().find((app) => app.name === "[DEFAULT]");
  if (existing) {
    assertFirebaseProjectId(existing.options.projectId);
    return getApp();
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
  });
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}
