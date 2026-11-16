/**
 * Segments du tableau animé (G13-05) : les scènes rendues, lues dans le journal de fabrication.
 * Pur : aucun accès disque ni réseau, aucune écriture ; `fabriquer.ts` n'est pas modifié.
 */
import { VERSION_FABRICATION, type EtapeFaite, type JournalFabrication } from "./fabriquer";
import type { IdSortie } from "./formats-sortie";

/** Une scène du tableau : temps en millisecondes entières, empreinte (préfixe de sortie compris), clé de stockage. */
export interface SegmentTableau {
  id: string;
  debutMs: number;
  finMs: number;
  empreinte: string;
  cle: string;
}

/** Segments d'une sortie (verticale si `sortie` absente) ; `[]` si le journal manque, est d'une autre version ou si l'étape « scenes » n'est pas faite. */
export function segmentsTableau(journal: JournalFabrication | null, sortie?: IdSortie): SegmentTableau[] {
  if (!journal || journal.version !== VERSION_FABRICATION) return [];
  const etapes = sortie === undefined || sortie === "vertical" ? journal.etapes : journal.sorties?.[sortie]?.etapes;
  const faite: EtapeFaite | undefined = etapes?.scenes;
  const temps = (faite?.sortie as { temps?: unknown } | undefined)?.temps;
  if (!Array.isArray(temps)) return [];
  return temps.flatMap((t: { id?: unknown; debutSec?: unknown; finSec?: unknown; cle?: unknown }) => {
    if (typeof t?.id !== "string" || typeof t.cle !== "string" || typeof t.debutSec !== "number" || typeof t.finSec !== "number") return [];
    return [{ id: t.id, debutMs: Math.round(t.debutSec * 1000), finMs: Math.round(t.finSec * 1000), empreinte: t.cle.slice(t.cle.lastIndexOf("/") + 1).replace(/\.mp4$/, ""), cle: t.cle }];
  });
}
