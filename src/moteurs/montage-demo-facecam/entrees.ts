/**
 * ENTRÉES DE LA DÉMO FACECAM (lot J) : où sont les vidéos de Williams. Lecture TOLÉRANTE (jamais d'erreur) :
 *  1. `commande.entrees.demoFacecam` : `{ facecamCle?, ecranCle?, videoUniqueCle?, decalageEcranMs? }` ;
 *  2. sinon : la prise de la version (`commande.prises`, comme la face caméra) pour la facecam, et le média
 *     `capture-ecran` (`commande.medias`) pour l'enregistrement d'écran.
 * Une facecam sans enregistrement d'écran est une vidéo déjà en écran partagé (mode `unique`), comme le dit le format.
 * Les deux vidéos se calent par le décalage fourni (mesuré sur le son), sinon par leur début (remarque).
 */
import type { CommandeFabrication } from "@/domaine/types";
import type { ModeDemo } from "./proprietes";

export const ENTREE_DEMO_FACECAM = "demoFacecam";

export interface SourcesDemo {
  mode: ModeDemo;
  /** La vidéo qui porte la voix de Williams (facecam, ou vidéo unique). */
  facecamCle: string;
  ecranCle?: string;
  decalageEcranMs: number;
  /** `son` : décalage mesuré sur le son ; `debut` : les deux vidéos commencent ensemble. */
  synchro: "son" | "debut" | "sans-objet";
}

const cle = (v: unknown): string | undefined => (typeof v === "string" && v.trim() && v.length <= 512 ? v.trim() : undefined);

export function lireSourcesDemo(c: Pick<CommandeFabrication, "entrees" | "prises" | "medias">): SourcesDemo | null {
  const e = (c.entrees?.[ENTREE_DEMO_FACECAM] ?? {}) as Record<string, unknown>;
  const unique = cle(e.videoUniqueCle);
  const prise = (c.prises ?? []).find((p) => p.partie === "version") ?? c.prises?.[0];
  const facecam = cle(e.facecamCle) ?? unique ?? cle(prise?.cle);
  if (!facecam) return null;
  const ecran = unique ? undefined : (cle(e.ecranCle) ?? cle(c.medias?.["capture-ecran"]?.cle));
  if (!ecran) return { mode: "unique", facecamCle: facecam, decalageEcranMs: 0, synchro: "sans-objet" };
  const d = typeof e.decalageEcranMs === "number" && Number.isFinite(e.decalageEcranMs) ? Math.round(e.decalageEcranMs) : undefined;
  return { mode: "deux", facecamCle: facecam, ecranCle: ecran, decalageEcranMs: d ?? 0, synchro: d === undefined ? "debut" : "son" };
}
