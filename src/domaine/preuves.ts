/**
 * Péremption des preuves et des matières (générateur, plan v5 B.2, B.2.9). PUR : importable côté client.
 * Une date de péremption n'efface rien : elle met la preuve ou la matière « à revoir » et l'écarte des choix de la machine.
 */
import type { DateIso, Preuve, TypeMatiere } from "./types";

/** Durée de vie par défaut d'une preuve, en mois. */
export const PEREMPTION_PAR_TYPE: Readonly<Record<Preuve["type"], number>> = {
  etude: 18,
  "chiffre-interne": 12,
  "cas-client": 24,
  "regle-loi": 12,
};

/**
 * Durée de vie par défaut d'une matière : `null` = jamais ; « preuve » = celle de la preuve reliée (cas client, étude) ;
 * sinon un nombre de mois, ou de jours pour l'actualité (alerte 7 jours avant).
 */
export const PEREMPTION_MATIERE: Readonly<Record<TypeMatiere, null | "preuve" | { mois: number } | { jours: number; alerteJours: number }>> = {
  "anecdote-will": null,
  "avis-will": null,
  "cas-client": "preuve",
  "parole-dirigeant": { mois: 36 },
  "question-recue": { mois: 24 },
  observation: { mois: 24 },
  "idee-recue": { mois: 24 },
  etude: "preuve",
  actualite: { jours: 30, alerteJours: 7 },
  demonstration: { mois: 12 },
  limite: null,
};

function ajouterMois(date: DateIso, mois: number): DateIso {
  const d = new Date(date);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d.toISOString();
}

function ajouterJours(date: DateIso, jours: number): DateIso {
  return new Date(new Date(date).getTime() + jours * 86_400_000).toISOString();
}

/**
 * Date de péremption par défaut.
 * - `{ preuve: type }` : la règle de la preuve ;
 * - `{ matiere: type, preuve? }` : la règle de la matière ; « preuve » prend la péremption de la preuve reliée.
 * `null` : jamais.
 */
export function peremptionParDefaut(
  quoi: { preuve: Preuve["type"] } | { matiere: TypeMatiere; preuveReliee?: Pick<Preuve, "type" | "perimeLe"> },
  depuis: DateIso,
): DateIso | null {
  if ("preuve" in quoi) return ajouterMois(depuis, PEREMPTION_PAR_TYPE[quoi.preuve]);
  const regle = PEREMPTION_MATIERE[quoi.matiere];
  if (regle === null) return null;
  if (regle === "preuve") {
    if (!quoi.preuveReliee) return null;
    return quoi.preuveReliee.perimeLe ?? ajouterMois(depuis, PEREMPTION_PAR_TYPE[quoi.preuveReliee.type]);
  }
  return "mois" in regle ? ajouterMois(depuis, regle.mois) : ajouterJours(depuis, regle.jours);
}

/** Une actualité expire-t-elle bientôt (alerte d'Accueil, 7 jours avant) ? */
export function expireBientot(type: TypeMatiere, perimeLe: DateIso | undefined, maintenant: DateIso): boolean {
  const regle = PEREMPTION_MATIERE[type];
  if (!perimeLe || !regle || regle === "preuve" || !("jours" in regle)) return false;
  const reste = new Date(perimeLe).getTime() - new Date(maintenant).getTime();
  return reste >= 0 && reste <= regle.alerteJours * 86_400_000;
}

export function estPerimee(perimeLe: DateIso | undefined, maintenant: DateIso): boolean {
  return !!perimeLe && perimeLe <= maintenant;
}
