import { LogOut } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader({
  title,
  userLabel,
}: {
  title: string;
  userLabel: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="flex-1 truncate text-sm font-medium">{title}</h1>
      <span className="hidden truncate text-sm text-muted-foreground sm:inline">
        {userLabel}
      </span>
      <form action={signOut}>
        <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión">
          <LogOut className="size-4" />
        </Button>
      </form>
    </header>
  );
}
