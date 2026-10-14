import { CheckCircle2 } from "lucide-react";
import { dateTime } from "@/src/lib/formatters";
export interface TimelineEntry {
  title: string;
  at: string;
  description: string;
}
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="space-y-0">
      {entries.map((e, i) => (
        <li
          key={`${e.title}-${i}`}
          className="relative ml-2 border-l pb-6 pl-6 last:border-transparent last:pb-0"
        >
          <CheckCircle2 className="absolute -left-2 top-0.5 size-4 bg-surface text-primary" />
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-medium">{e.title}</p>
            <time dateTime={e.at} className="text-xs text-muted-foreground">
              {dateTime(e.at)}
            </time>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {e.description}
          </p>
        </li>
      ))}
    </ol>
  );
}
