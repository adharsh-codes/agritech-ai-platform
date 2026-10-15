import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { FIREBASE_PROJECT_ID } from "@/lib/firebaseProject";


const firebaseConfig = {
  apiKey: "AIzaSyB8_2u0gaJa3cfwHyC358yMHcprzCLjt38",
  authDomain: "agritech-ai-platform.firebaseapp.com",
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: "agritech-ai-platform.firebasestorage.app",
  messagingSenderId: "742658635406",
  appId: "1:742658635406:web:010de808fd9ff001eb7bdf",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);
