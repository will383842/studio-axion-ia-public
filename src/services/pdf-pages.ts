/**
 * Pages d'un carrousel PDF (CAL-03) : UNE image par page, rendue à l'import du fichier (dépôt CAL-25), pour que l'aperçu
 * feuillette sans télécharger tout le PDF. PUR : le rendu d'une page, le comptage et le rangement sont fournis par
 * l'appelant (aucun appel réel ici, aucune dépendance ajoutée). Ne lève jamais d'exception : une page illisible est
 * signalée et n'empêche ni les autres pages ni l'import.
 */

/** Au plus ce nombre de pages rendues par fichier. */
export const LIMITE_PAGES = 20;

export interface DepsPdfPages {
  compterPages(octets: Uint8Array): Promise<number>;
  /** Image (PNG) de la page `numero` (à partir de 1). */
  rendrePage(octets: Uint8Array, numero: number): Promise<Uint8Array>;
  stocker(cle: string, image: Uint8Array): Promise<void>;
}

export interface PagePdf {
  numero: number;
  cle: string;
}

export type ResultatPagesPdf =
  | { ok: true; pages: PagePdf[]; total: number; manquantes: number[]; avis?: string }
  | { ok: false; raison: string };

/** Clé de rangement de l'image d'une page : privée, rangée sous le média, dans l'ordre. */
export const clePagePdf = (mediaId: string, numero: number): string => `pages/${mediaId}/page-${String(numero).padStart(3, "0")}.png`;

const estPdf = (o: Uint8Array): boolean => o.length >= 5 && String.fromCharCode(...o.slice(0, 5)) === "%PDF-";

export async function rendrePagesPdf(mediaId: string, octets: Uint8Array, deps: DepsPdfPages): Promise<ResultatPagesPdf> {
  if (!estPdf(octets)) return { ok: false, raison: "Ce fichier n'est pas un PDF lisible : les pages ne sont pas préparées." };
  let total: number;
  try {
    total = await deps.compterPages(octets);
  } catch {
    return { ok: false, raison: "Le PDF n'a pas pu être lu : les pages ne sont pas préparées." };
  }
  if (!Number.isInteger(total) || total < 1) return { ok: false, raison: "Le PDF ne contient aucune page lisible." };
  const pages: PagePdf[] = [];
  const manquantes: number[] = [];
  for (let numero = 1; numero <= Math.min(total, LIMITE_PAGES); numero++) {
    try {
      const cle = clePagePdf(mediaId, numero);
      await deps.stocker(cle, await deps.rendrePage(octets, numero));
      pages.push({ numero, cle });
    } catch {
      manquantes.push(numero);
    }
  }
  const avis = manquantes.length > 0 ? `La page ${manquantes.join(", ")} n'a pas pu être préparée ; les autres sont prêtes.` : undefined;
  return { ok: true, pages, total, manquantes, ...(avis ? { avis } : {}) };
}
