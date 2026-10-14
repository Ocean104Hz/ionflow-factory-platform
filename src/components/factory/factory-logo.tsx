"use client";
import Image from "next/image";
import { Factory } from "lucide-react";
import { useBranding } from "./branding-provider";
export function FactoryLogo({ compact = false }: { compact?: boolean }) {
  const { branding } = useBranding();
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        className={
          compact
            ? "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-primary"
            : "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-primary"
        }
      >
        {branding.logoDataUrl ? (
          <Image
            src={branding.logoDataUrl}
            alt={`${branding.factoryName} logo`}
            width={40}
            height={40}
            unoptimized
            className="size-full object-contain p-1"
          />
        ) : (
          <Factory className="size-5" />
        )}
      </span>
      {!compact && (
        <span className="min-w-0">
          <strong className="block truncate text-base tracking-tight">
            {branding.factoryName}
          </strong>
          <span className="block truncate text-xs tracking-wider text-muted-foreground">
            {branding.shortName} · FACTORY WORKSPACE
          </span>
        </span>
      )}
    </span>
  );
}
