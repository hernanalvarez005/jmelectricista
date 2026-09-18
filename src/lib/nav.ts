import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Settings,
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
  { title: "Cotizaciones", href: "/app/cotizaciones", icon: FileText, comingSoon: true },
  { title: "Materiales", href: "/app/materiales", icon: Boxes, comingSoon: true },
  { title: "Proveedores", href: "/app/proveedores", icon: Truck, comingSoon: true },
];

export const footerNavItems: NavItem[] = [
  { title: "Configuración", href: "/app/configuracion", icon: Settings },
];
