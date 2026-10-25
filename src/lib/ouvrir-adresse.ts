import type { SourceZip } from "@/lib/zip";

/**
 * Ouvre une adresse pour l'écrire dans une archive : les adresses relatives (médias du studio) sont lues sur ce même serveur, avec le cookie
 * de la session ; une adresse absolue (stockage) part sans cookie. Une réponse en erreur lève (le fichier est alors sauté et nommé).
 */
export function ouvrirAdresseDe(origine: string, cookie: string): (url: string) => Promise<SourceZip> {
  return async (url) => {
    const r = await fetch(new URL(url, origine), { headers: url.startsWith("/") ? { cookie } : {}, cache: "no-store" });
    if (!r.ok || !r.body) {
      await r.body?.cancel().catch(() => undefined);
      throw new Error(`fichier illisible (${r.status})`);
    }
    return r.body;
  };
}
