import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Cliente ANON sin cookies ni sesión, para las rutas públicas (p.ej. /cotizacion/[token]). Aunque quien
 * abre el enlace tenga una sesión del sistema, la página pública nunca actúa con ella: solo puede lo que
 * el rol anon puede (los RPC públicos específicos). No usa service_role.
 */
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
