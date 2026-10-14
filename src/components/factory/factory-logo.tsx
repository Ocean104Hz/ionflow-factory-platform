"use client";
import Image from "next/image";
import { Factory } from "lucide-react";
import { useBranding } from "./branding-provider";
export function FactoryLogo({ compact = false }: { compact?: boolean }) {
  const { branding } = useBranding();
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-surface text-primary">
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
          <Factory className="size-6" />
        )}
      </span>
      {!compact && (
        <span className="min-w-0">
          <strong className="block truncate text-lg tracking-tight">
            {branding.factoryName}
          </strong>
          <span className="block truncate text-[10px] tracking-widest text-muted-foreground">
            {branding.shortName} · FACTORY WORKSPACE
          </span>
        </span>
      )}
    </span>
  );
}
