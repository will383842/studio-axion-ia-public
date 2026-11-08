/**
 * Filtres de « Mes vidéos » et de la page d'un format (lot M, 08/11, Williams) : réseau et étape, lus dans l'adresse.
 * Fonctions PURES. Une valeur inconnue est ignorée ; chaque lien garde les autres paramètres, « Tous » retire le paramètre.
 */
import { ETAPES_EDITORIALES } from "./libelles";
import { estIdReseau } from "./reseaux-video";
import type { EtapeEditoriale, IdReseau } from "./types";
import { listerReseaux } from "@/reseaux";

export interface FiltresMesVideos {
  reseau?: IdReseau;
  etape?: EtapeEditoriale;
  format?: string;
}

export type ParametresAdresse = Record<string, string | string[] | undefined>;

/** Carte minimale filtrable (la `VueVideoCarte` en est un sur-ensemble). */
export interface CarteFiltrable {
  reseaux?: readonly IdReseau[];
  etapeEditoriale?: EtapeEditoriale;
  format: { id: string };
}

const premier = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function lireFiltres(sp: ParametresAdresse): FiltresMesVideos {
  const reseau = premier(sp.reseau);
  const etape = premier(sp.etape);
  const format = premier(sp.format);
  const f: FiltresMesVideos = {};
  if (estIdReseau(reseau)) f.reseau = reseau;
  if (etape && Object.hasOwn(ETAPES_EDITORIALES, etape)) f.etape = etape as EtapeEditoriale;
  if (format) f.format = format;
  return f;
}

export function filtrerCartes<C extends CarteFiltrable>(cartes: readonly C[], f: FiltresMesVideos): C[] {
  return cartes.filter(
    (c) => (!f.reseau || !!c.reseaux?.includes(f.reseau)) && (!f.etape || c.etapeEditoriale === f.etape) && (!f.format || c.format.id === f.format),
  );
}

/** Les réseaux qui ont au moins une vidéo, dans l'ordre du registre, avec leur nombre. */
export function compterParReseau(cartes: readonly Pick<CarteFiltrable, "reseaux">[]): { reseau: IdReseau; nombre: number }[] {
  return listerReseaux()
    .map((r) => ({ reseau: r.id, nombre: cartes.filter((c) => c.reseaux?.includes(r.id)).length }))
    .filter((x) => x.nombre > 0);
}

/** Adresse avec un changement de filtre ; `undefined` retire le paramètre. Les autres paramètres sont gardés. */
export function lienFiltres(base: string, params: ParametresAdresse, changement: { reseau?: string; etape?: string }): string {
  const q = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    const v = premier(valeur);
    if (v && !(cle in changement)) q.set(cle, v);
  }
  for (const [cle, valeur] of Object.entries(changement)) if (valeur) q.set(cle, valeur);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
