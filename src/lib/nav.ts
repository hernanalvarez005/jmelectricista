import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
};

export const mainNavItems: NavItem[] = [
  { title: "Inicio", href: "/app", icon: LayoutDashboard },
  { title: "Agenda", href: "/app/agenda", icon: CalendarDays },
  { title: "Trabajos", href: "/app/trabajos", icon: Wrench },
  { title: "Clientes", href: "/app/clientes", icon: Users },
  { title: "Cotizaciones", href: "/app/cotizaciones", icon: FileText },
  { title: "Materiales", href: "/app/materiales", icon: Boxes },
  { title: "Proveedores", href: "/app/proveedores", icon: Truck },
  { title: "Compras", href: "/app/compras", icon: ShoppingCart },
  { title: "Cobros", href: "/app/cobros", icon: Receipt },
];

export const footerNavItems: NavItem[] = [
  { title: "Configuración", href: "/app/configuracion", icon: Settings },
];
