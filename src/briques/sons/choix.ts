/**
 * Aucun consommateur (C6-H14) : G2-04 et les chantiers 3/4 les liront.
 *
 * Règles pures de choix et de diversité des sons. Aucun hasard non seedé, aucune horloge : le choix dépend de la graine.
 * Côté Studio seulement (jamais importé par `studio-rendu/**`) ; sans alias « @/ ».
 */
import { hasard } from "../motion/courbes";
import { REGLES_BRUITAGES } from "../intensite/types";
import type { EntreeSon } from "./types";

/**
 * Part maximale d'une famille parmi les poses : 30 %.
 * Valeur du plan `architecte-6.md` § 4 H14 (règle R6 de la v3), non retrouvée dans le code.
 */
const PART_MAX_FAMILLE = 0.3;
/** Tranche d'un son fort : `REGLES_BRUITAGES.intervalleMinSec` (`src/briques/intensite/types.ts:129`, lue par `bruitages.ts:103`). */
const TRANCHE_FORT_SEC = REGLES_BRUITAGES.intervalleMinSec;
/** Dernière seconde interdite : `REGLES_BRUITAGES.pasDansDerniereSec` (`src/briques/intensite/types.ts:131`, lue par `bruitages.ts:102`). */
const DERNIERE_SEC = REGLES_BRUITAGES.pasDansDerniereSec;

export function choisirSon(
  famille: string,
  sons: readonly EntreeSon[],
  o: { graine: number; dejaPoses?: readonly string[]; validesEnBase?: ReadonlySet<string> },
): EntreeSon | null {
  const admis = sons.filter(
    (s) => s.famille === famille && (s.ecoute === "valide-par-decision" || (s.ecoute === "porte-en-base" && o.validesEnBase?.has(s.id) === true)),
  );
  if (admis.length === 0) return null;
  const dernier = o.dejaPoses && o.dejaPoses.length > 0 ? o.dejaPoses[o.dejaPoses.length - 1] : undefined;
  const autres = admis.filter((s) => s.id !== dernier);
  const candidats = autres.length > 0 ? autres : admis;
  const i = Math.min(candidats.length - 1, Math.floor(hasard(Math.trunc(o.graine) * 1000) * candidats.length));
  return candidats[i];
}

export function controlerDiversiteSons(
  poses: readonly { id: string; famille: string; debutSec: number; fort?: boolean }[],
  dureeSec: number,
): { ok: boolean; motifs: string[] } {
  const motifs: string[] = [];
  const triees = [...poses].sort((a, b) => a.debutSec - b.debutSec);

  const parFamille = new Map<string, number>();
  for (const p of triees) parFamille.set(p.famille, (parFamille.get(p.famille) ?? 0) + 1);
  for (const [f, n] of parFamille) {
    if (n / triees.length > PART_MAX_FAMILLE + 1e-9) motifs.push(`la famille « ${f} » fait plus de 30 % des sons (${n} sur ${triees.length})`);
  }

  const forts = triees.filter((p) => p.fort);
  for (let i = 1; i < forts.length; i++) {
    if (forts[i].debutSec - forts[i - 1].debutSec < TRANCHE_FORT_SEC - 1e-6) {
      motifs.push(`deux sons forts à moins de ${TRANCHE_FORT_SEC} s (${forts[i - 1].id} et ${forts[i].id})`);
    }
  }

  for (const p of triees) {
    if (p.debutSec > dureeSec - DERNIERE_SEC + 1e-6) motifs.push(`le son ${p.id} tombe dans la dernière seconde`);
  }

  for (let i = 1; i < triees.length; i++) {
    if (triees[i].id === triees[i - 1].id) motifs.push(`le même fichier ${triees[i].id} est posé deux fois de suite`);
  }

  return { ok: motifs.length === 0, motifs };
}
