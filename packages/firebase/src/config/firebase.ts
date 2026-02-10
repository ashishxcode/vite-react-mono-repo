import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyCFJ3crs2f4ntvsLQ1vxwCq-bNd3yTvB_I",
  authDomain: "mono-repos-da716.firebaseapp.com",
  projectId: "mono-repos-da716",
  storageBucket: "mono-repos-da716.firebasestorage.app",
  messagingSenderId: "658580894718",
  appId: "1:658580894718:web:8e3b5437306197170dc6af",
  measurementId: "G-0V6NQXJRHE"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)

export { app, auth }
