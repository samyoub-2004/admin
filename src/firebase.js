import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyBIjlmTB2BeUKcqYMDJyOgUuEP9mk0jDPw",
  authDomain: "vtcc-b0040.firebaseapp.com",
  projectId: "vtcc-b0040",
  storageBucket: "vtcc-b0040.firebasestorage.app",
  messagingSenderId: "684491637762",
  appId: "1:684491637762:web:f6c629fe0bbf2e4dc1931b",
  measurementId: "G-2FGFW0TFT8",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default app
