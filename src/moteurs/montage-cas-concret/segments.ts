/**
 * G13-06 : les écrans du cas concret exposés comme segments `{ id, debutMs, finMs, empreinte, cle }`, lus dans le journal.
 * Pur et en lecture seule : aucun accès disque ni réseau, rien ne l'importe en production. Le type est déclaré ici
 * (`isolement.test.ts` interdit tout import de `montage-tableau`).
 */
import type { CarteEnRendu } from "@/briques/motion/rendu-cartes";
import type { JournalCasConcret } from "./fabriquer";

export interface SegmentCasConcret {
  id: string;
  debutMs: number;
  finMs: number;
  empreinte: string;
  cle: string;
}

/** Une entrée par écran rendu (`statut === "faite"`), dans l'ordre du journal ; journal absent ou sans écrans : `[]`. */
export function segmentsCasConcret(journal: Pick<JournalCasConcret, "ecrans"> | null | undefined): SegmentCasConcret[] {
  const cartes: CarteEnRendu[] = journal?.ecrans?.etat?.cartes ?? [];
  return cartes
    .filter((c) => c.statut === "faite")
    .map((c) => ({ id: c.id, debutMs: Math.round(c.debutSec * 1000), finMs: Math.round(c.finSec * 1000), empreinte: c.empreinte ?? "", cle: c.cle }));
}
