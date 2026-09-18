import { describe, expect, it } from "vitest";

import { stockAdjustmentSchema, stockInitialSchema } from "@/lib/validations/material";
import {
  friendlyInventoryError,
  initializeValuationSchema,
  newPurchaseSchema,
  purchaseItemSchema,
} from "@/lib/validations/purchase";

const uuid = "8a9d1c62-3f0e-4b6a-9d2e-5a1b2c3d4e5f";

describe("newPurchaseSchema", () => {
  const base = { supplierId: uuid, purchaseDate: "2026-09-18", notes: "", sourceJobId: "" };

  it("acepta una compra con al menos un ítem", () => {
    const r = newPurchaseSchema.safeParse({ ...base, items: [{ materialId: uuid, quantity: "100", unitCost: "1000" }] });
    expect(r.success).toBe(true);
  });

  it("rechaza una compra sin ítems", () => {
    const r = newPurchaseSchema.safeParse({ ...base, items: [] });
    expect(r.success).toBe(false);
  });

  it("rechaza proveedor o material inválidos", () => {
    expect(newPurchaseSchema.safeParse({ ...base, supplierId: "", items: [{ materialId: uuid, quantity: "1", unitCost: "1" }] }).success).toBe(false);
    expect(purchaseItemSchema.safeParse({ materialId: "", quantity: "1", unitCost: "1" }).success).toBe(false);
  });

  it("exige cantidad y costo unitario", () => {
    expect(purchaseItemSchema.safeParse({ materialId: uuid, quantity: "", unitCost: "1" }).success).toBe(false);
    expect(purchaseItemSchema.safeParse({ materialId: uuid, quantity: "1", unitCost: "" }).success).toBe(false);
  });
});

describe("stock valorizado — validaciones de ingreso", () => {
  it("el stock inicial requiere costo unitario", () => {
    expect(stockInitialSchema.safeParse({ quantity: "10", unitCost: "" }).success).toBe(false);
    expect(stockInitialSchema.safeParse({ quantity: "10", unitCost: "850" }).success).toBe(true);
  });

  it("un ajuste de aumento requiere costo; una disminución no", () => {
    expect(stockAdjustmentSchema.safeParse({ direction: "in", quantity: "5", unitCost: "" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ direction: "in", quantity: "5", unitCost: "1200" }).success).toBe(true);
    expect(stockAdjustmentSchema.safeParse({ direction: "out", quantity: "5" }).success).toBe(true);
  });

  it("inicializar valoración requiere costo unitario", () => {
    expect(initializeValuationSchema.safeParse({ unitCost: "" }).success).toBe(false);
    expect(initializeValuationSchema.safeParse({ unitCost: "800" }).success).toBe(true);
  });
});

describe("friendlyInventoryError", () => {
  it("traduce stock insuficiente con la cantidad disponible", () => {
    const msg = friendlyInventoryError("stock_insuficiente: Cable tiene 10.000 en stock y se intentó retirar 50", "x");
    expect(msg).toContain("Stock insuficiente");
    expect(msg).toContain("10");
  });

  it("traduce valoración no inicializada y costo requerido", () => {
    expect(friendlyInventoryError("valoracion_no_inicializada: Caño ...", "x")).toMatch(/Inicializá su valoración/);
    expect(friendlyInventoryError("costo_requerido: ...", "x")).toMatch(/costo unitario/);
  });

  it("usa el mensaje genérico para errores desconocidos y no filtra detalles internos", () => {
    const msg = friendlyInventoryError('duplicate key value violates unique constraint "foo"', "No se pudo guardar.");
    expect(msg).toBe("No se pudo guardar.");
    expect(friendlyInventoryError(undefined, "fallback")).toBe("fallback");
  });
});
