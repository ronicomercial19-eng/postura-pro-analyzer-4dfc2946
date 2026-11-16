import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'photos';

/** O bucket `photos` é privado. Aceita URL assinada, pública, autenticada ou só o caminho do arquivo. */
export function extractPhotoPath(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/object\/(?:sign|public|authenticated)\/photos\/([^?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  // Caminho cru gravado no banco (sem esquema nem barra inicial).
  if (!/^(https?:|data:|blob:|\/)/i.test(url)) return url.replace(/^photos\//, '');
  return null;
}

/** Devolve uma URL assinada nova (1 h). Se não der para assinar, devolve a original. */
export async function resolvePhotoUrl(url: string): Promise<string> {
  if (!url || /^(data:|blob:)/i.test(url)) return url;
  const path = extractPhotoPath(url);
  if (!path) return url;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return !error && data?.signedUrl ? data.signedUrl : url;
  } catch {
    return url;
  }
}

export const isPlaceholderUrl = (url?: string | null) => !url || /placeholder\.svg(\?|$)/.test(url);
