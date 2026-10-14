import { Suspense } from "react";
import { Login } from "@/src/features/login/login";
import { LoadingState } from "@/src/components/factory/patterns";
export const metadata = { title: "Login" };
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Login />
    </Suspense>
  );
}
