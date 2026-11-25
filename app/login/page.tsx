import { Suspense } from "react";
import { connection } from "next/server";
import { Login } from "@/src/features/login/login";
import { LoadingState } from "@/src/components/factory/patterns";
export const metadata = { title: "Login" };
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FirebaseLogin />
    </Suspense>
  );
}

async function FirebaseLogin() {
  await connection();
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_WEB_API_KEY ?? "",
    authDomain:
      process.env.FIREBASE_AUTH_DOMAIN ??
      "ionflow-central-identity.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ??
      "ionflow-central-identity.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "788968034738",
    appId:
      process.env.FIREBASE_APP_ID ??
      "1:788968034738:web:4819622bcd6ab9c9b494ab",
  };
  return <Login firebaseConfig={firebaseConfig} />;
}
