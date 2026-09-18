import Image from "next/image";

import { brand } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-6 bg-primary px-6 py-12 text-primary-foreground lg:py-0">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-white p-3 shadow-sm lg:size-28">
          <Image
            src={brand.logoPath}
            alt={brand.name}
            width={200}
            height={200}
            priority
            className="size-full object-contain"
          />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">{brand.name}</p>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Gestión de trabajos y operación diaria
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
