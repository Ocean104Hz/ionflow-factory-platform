"use client";
import { ErrorState } from "@/src/components/factory/patterns";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <ErrorState retry={reset} />;
}
