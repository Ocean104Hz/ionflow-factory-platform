import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
export function SectionCards({
  items,
}: {
  items: {
    title: string;
    icon: LucideIcon;
    count: number;
    context: string;
    badge: string;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title} className="gap-3 py-5 shadow-none">
          <CardHeader className="gap-2 px-4 sm:px-5">
            <CardDescription className="text-sm">{item.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {item.count.toLocaleString("th-TH")}
            </CardTitle>
            <CardAction>
              <item.icon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-wrap justify-between gap-2 px-4 sm:px-5">
            <span className="text-xs text-muted-foreground">
              {item.context}
            </span>
            <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
              {item.badge}
            </Badge>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
