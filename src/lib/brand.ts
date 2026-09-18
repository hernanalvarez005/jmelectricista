/**
 * Identidad de marca de JM Electricista. Única fuente de verdad para los
 * valores hexadecimales de marca — los usados fuera de CSS (el PDF de
 * cotización no puede leer variables CSS) deben importarse de acá, nunca
 * repetirse sueltos en un componente.
 */
export const brand = {
  name: "JM Electricista",
  shortName: "JM",
  logoPath: "/brand/jm-electricista-logo.jpg",
  colors: {
    primaryDark: "#292633",
    electricYellow: "#ecce54",
    background: "#f7f7f5",
    surface: "#ffffff",
    border: "#e8e7ea",
    mutedText: "#6f6b78",
    success: "#2f9e58",
    warning: "#c77b1d",
    destructive: "#d9463d",
    info: "#2563eb",
  },
} as const;
