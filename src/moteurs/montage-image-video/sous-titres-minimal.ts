/**
 * IMAGE → VIDÉO · SOUS-TITRES « MINIMAL DYNAMIQUE » (BR-MINIMAL-IV-a, tendance X1-02b). PUR, déterministe, ÉTEINT.
 *
 * Reprend les segments du mélange (`sousTitresVariesIV`) et les redécoupe en petits groupes de 1 à 3 mots
 * (`decouperMinimalDynamique`, la pièce commune, appelée telle quelle). Un seul mot par groupe est marqué : le champ
 * de mise en valeur LU PAR LE RENDU est `enValeur` (`scene.ts` : couleur d'accent du mot ; `souligne` ajouterait un
 * trait, ce n'est pas voulu ici). Les horodatages sont ceux de la découpe (premier début et dernière fin inchangés).
 * Ne lève jamais : un segment illisible est recopié tel quel.
 */
import { decouperMinimalDynamique } from "@/briques/sous-titres/minimal-dynamique";
import { estNombre } from "@/briques/sous-titres/typographie";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";
import type { SegmentSousTitres } from "@/domaine/types";

const lisible = (s: SegmentSousTitres): boolean => !!s && Array.isArray(s.mots) && s.mots.length > 0 && s.mots.every((m) => !!m && typeof m.mot === "string" && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec));

/** Groupes de 1 à 3 mots d'une suite de segments ; id stable `${id}-m${k}` ; au plus un mot marqué (`enValeur`) par groupe. */
export function regrouperMinimalIV(segments: SegmentSousTitres[]): SegmentSousTitres[] {
  const sortie: SegmentSousTitres[] = [];
  for (const s of segments) {
    try {
      if (!lisible(s)) {
        sortie.push(s);
        continue;
      }
      const source: SegmentRendu = { id: s.id, debutSec: s.debutSec, finSec: s.finSec, mots: s.mots.map((m) => ({ ...m })) };
      decouperMinimalDynamique([source]).forEach((g, k) => {
        // Le mot marqué : le premier mot fort du groupe, sinon le premier nombre ; jamais deux.
        const marque = g.marque ?? (g.mots.findIndex((m) => estNombre(m.mot)) >= 0 ? g.mots.findIndex((m) => estNombre(m.mot)) : null);
        sortie.push({
          id: `${s.id}-m${k}`,
          debutSec: g.debutSec,
          finSec: g.finSec,
          mots: g.mots.map(({ mot, debutSec, finSec }, i) => ({ mot, debutSec, finSec, ...(i === marque ? { enValeur: true } : {}) })),
          style: "base",
        });
      });
    } catch {
      sortie.push(s);
    }
  }
  return sortie;
}
