"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-lg font-medium">Algo salió mal.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Ocurrió un error al cargar esta pantalla. Podés intentar de nuevo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
