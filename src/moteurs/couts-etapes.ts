/**
 * Rattachement des lignes de coût aux étapes d'un travail (lot M1b) : coût en direct pendant la fabrication,
 * et, à l'« Arrêter », dépense des SEULES étapes terminées. PUR.
 */
import type { EtapeTravail, LigneCout, Montant } from "@/domaine/types";
import { additionner, centimes } from "@/lib/montants";

/** Clé d'étape à laquelle une ligne de coût appartient (d'après son libellé, celui des briques). */
export function cleEtapeDeLigne(libelle: string): string {
  const e = libelle.toLowerCase();
  if (e.includes("sous-titre")) return "sous-titres";
  if (e.includes("niveau de la voix") || e.includes("mixage") || e.includes("son")) return "son";
  if (e.includes("voix")) return "voix";
  if (e.includes("double") || e.includes("visage")) return "visage";
  if (e.includes("illustr")) return "illustrations";
  if (e.includes("talonnage") || e.includes("couleur")) return "etalonnage";
  if (e.includes("export") || e.includes("format")) return "export";
  if (e.includes("animation")) return "animation";
  if (e.includes("rush")) return "rushs";
  return "montage";
}

/** Coût d'une étape : la somme des lignes qui lui appartiennent. */
export function coutDeLEtape(lignes: LigneCout[], cle: string): Montant {
  return additionner(...lignes.filter((l) => cleEtapeDeLigne(l.etape) === cle).map((l) => l.total));
}

/**
 * E2E-1 n° 3 et n° 8 (03/10) : lignes de dépense des étapes TERMINÉES et payées, chacune au nom de son VRAI fournisseur
 * (celui de la ligne de référence de la même étape : estimation ou coût réel du moteur), sinon `parDefaut`.
 * `exclure` : étapes comptées autrement par le moteur (voix payée avant la fin de son étape, illustrations).
 */
export function lignesDesEtapesPayees(etapes: EtapeTravail[], reference: LigneCout[], parDefaut: string, exclure: string[] = []): LigneCout[] {
  return etapes
    .filter((e) => e.statut === "terminee" && (e.coutReel?.centimes ?? 0) > 0 && !exclure.includes(e.cle))
    .map((e) => ({
      etape: e.nom,
      fournisseur: reference.find((l) => cleEtapeDeLigne(l.etape) === e.cle)?.fournisseur ?? parDefaut,
      unite: "forfait" as const,
      quantite: 1,
      prixUnitaire: e.coutReel!,
      total: e.coutReel!,
      nature: "reel" as const,
    }));
}

/** Clé de rapprochement d'une ligne de dépense : son étape et son fournisseur. */
const cleDepense = (l: LigneCout) => `${cleEtapeDeLigne(l.etape)}|${l.fournisseur.toLowerCase()}`;

/**
 * E2E-1 n° 3 (03/10) : ce qui RESTE à enregistrer, une fois retiré ce qui l'a déjà été pour le même travail (dépense
 * enregistrée à l'échec, puis « Réessayer » et fin normale : rien n'est compté deux fois). Par étape et fournisseur.
 */
export function lignesRestantes(lignes: LigneCout[], deja: LigneCout[]): LigneCout[] {
  const reste = new Map<string, number>();
  for (const l of deja) reste.set(cleDepense(l), (reste.get(cleDepense(l)) ?? 0) + l.total.centimes);
  const sortie: LigneCout[] = [];
  for (const l of lignes) {
    const cle = cleDepense(l);
    const r = reste.get(cle) ?? 0;
    if (l.total.centimes <= r) {
      reste.set(cle, r - l.total.centimes);
      continue;
    }
    reste.set(cle, 0);
    if (!r) {
      sortie.push(l);
      continue;
    }
    const total = centimes(l.total.centimes - r);
    sortie.push({ ...l, unite: "forfait", quantite: 1, prixUnitaire: total, total });
  }
  return sortie;
}
