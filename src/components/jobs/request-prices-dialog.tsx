"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildWhatsAppLink } from "@/lib/format/phone";
import { buildPriceRequestMessage } from "@/lib/format/whatsapp-message";
import type { JobMaterialItem } from "@/lib/data/job-materials";

type Scope = "missing" | "all" | "manual";

export function RequestPricesDialog({
  materials,
  suppliers,
  trigger,
}: {
  materials: JobMaterialItem[];
  suppliers: { id: string; name: string; phone: string | null }[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("missing");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const selectedMaterials = useMemo(() => {
    if (scope === "missing") return materials.filter((m) => m.missing > 0);
    if (scope === "all") return materials;
    return materials.filter((m) => selected.has(m.id));
  }, [scope, materials, selected]);

  const message = useMemo(
    () =>
      buildPriceRequestMessage(
        selectedMaterials.map((m) => ({
          name: m.materialName,
          quantity: scope === "missing" ? m.missing : m.estimatedQuantity,
          unitSymbol: m.unitSymbol,
        }))
      ),
    [selectedMaterials, scope]
  );

  const supplier = suppliers.find((s) => s.id === supplierId);
  const waLink = buildWhatsAppLink(supplier?.phone);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setScope("missing");
          setSelected(new Set());
          setCopied(false);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar precios</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Materiales a incluir</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="missing">Solo faltantes</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="manual">Selección manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "manual" && (
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-2">
              {materials.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(m.id)}
                    onCheckedChange={(checked) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(m.id);
                        else next.delete(m.id);
                        return next;
                      });
                    }}
                  />
                  {m.materialName}
                </label>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Mensaje</Label>
            <Textarea readOnly rows={8} value={message} className="font-mono text-xs" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(message);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          {waLink && (
            <Button type="button" asChild>
              <a
                href={`${waLink}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle /> Abrir WhatsApp
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
