import { addDoc, collection, getDocs, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { ChatSessionDoc } from "@/types/shoppingAssistant";

export class ConversationService {
  /**
   * Saves a shopping assistant conversation session and its associated kit recommendations in Firestore.
   */
  static async saveChatSession(session: Omit<ChatSessionDoc, "id" | "timestamp">): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated.");
    }

    const docRef = await addDoc(collection(db, "shopping_assistant_sessions"), {
      uid: user.uid,
      chatHistory: session.chatHistory,
      generatedKits: session.generatedKits,
      analysisReference: session.analysisReference || "general",
      timestamp: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Loads all historical shopping assistant sessions for a customer.
   */
  static async getUserSessions(uid: string): Promise<ChatSessionDoc[]> {
    const q = query(
      collection(db, "shopping_assistant_sessions"),
      where("uid", "==", uid),
      orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        chatHistory: data.chatHistory,
        generatedKits: data.generatedKits,
        analysisReference: data.analysisReference,
        timestamp: data.timestamp,
      } as ChatSessionDoc;
    });
  }
}
