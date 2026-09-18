import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-medium">Página no encontrada.</p>
      <Button asChild>
        <Link href="/app">Volver al inicio</Link>
      </Button>
    </div>
  );
}
