"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ALL = "all";

export function MaterialsFilterBar({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Buscar material..."
        defaultValue={searchParams.get("q") ?? ""}
        className="w-[220px]"
        onChange={(e) => setParam("q", e.target.value)}
      />
      <Select
        value={searchParams.get("category") ?? ALL}
        onValueChange={(v) => setParam("category", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch
          id="activeOnly"
          checked={searchParams.get("active") === "1"}
          onCheckedChange={(checked) => setParam("active", checked ? "1" : null)}
        />
        <Label htmlFor="activeOnly" className="font-normal">
          Solo activos
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="lowStockOnly"
          checked={searchParams.get("lowStock") === "1"}
          onCheckedChange={(checked) => setParam("lowStock", checked ? "1" : null)}
        />
        <Label htmlFor="lowStockOnly" className="font-normal">
          Stock bajo
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="needsValuationOnly"
          checked={searchParams.get("valuation") === "missing"}
          onCheckedChange={(checked) => setParam("valuation", checked ? "missing" : null)}
        />
        <Label htmlFor="needsValuationOnly" className="font-normal">
          Sin valoración
        </Label>
      </div>
    </div>
  );
}
