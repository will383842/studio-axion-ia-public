/**
 * Les quatre fiches RÉELLES fabriquées en production le 12/10 (`temoins/fiche-*-prod.json`), passées par la même
 * remise en forme que la production (`remettreEnForme` : mots forts, formes, rythme), puis calées sur un minutage
 * régulier (0,3 s par mot, le débit de la voix réelle ; aucune voix lue). Partagé par les planches (`apercus.mts`)
 * et les tests du dessin 4.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MotCalage } from "../../../src/briques/motion/calage";
import { calerFicheTableau, type ElementCale } from "../../../src/moteurs/montage-tableau/calage";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import type { AppelFinV2 } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";

/** Nom court, et format d'image dans lequel la vidéo a été fabriquée. */
export const FICHES_REELLES = [
  { nom: "relances", format: "vertical" },
  { nom: "taches-repetitives", format: "portrait" },
  { nom: "habitude-equipe", format: "horizontal" },
  { nom: "consigne-ia", format: "vertical" },
] as const satisfies readonly { nom: string; format: IdFormatSortie }[];
export type NomFicheReelle = (typeof FICHES_REELLES)[number]["nom"];

const DOSSIER = join(__dirname, "..", "temoins");

/** La fiche telle qu'enregistrée en production (brute). */
export function ficheReelleBrute(nom: NomFicheReelle): FicheTableau {
  return JSON.parse(readFileSync(join(DOSSIER, `fiche-${nom}-prod.json`), "utf8")) as FicheTableau;
}

/** La fiche remise en forme comme en production (avant la mise en page). */
export function ficheReelle(nom: NomFicheReelle): FicheTableau {
  return remettreEnForme(ficheReelleBrute(nom));
}

/** L'écran d'appel de la fin au mot (le mot à commenter de la fiche, en capitales). */
export function appelDe(fiche: FicheTableau): AppelFinV2 {
  const mot = fiche.scenes.flatMap((s) => s.ecrans ?? []).find((e) => e.motCommentaire)?.motCommentaire ?? "MOT";
  return { mot: mot.toLocaleUpperCase("fr-FR") };
}

export interface FicheCalee {
  fiche: FicheTableau;
  mots: MotCalage[];
  elements: ElementCale[];
  appel: AppelFinV2;
}

/** Remise en forme puis calée (minutage régulier) ; lève si le calage refuse. */
export function ficheReelleCalee(nom: NomFicheReelle): FicheCalee {
  const fiche = ficheReelle(nom);
  const texte = fiche.scenes.map((s) => s.texteDit).join(" ");
  const matieres = [...new Set(fiche.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))].map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-09" }));
  const contexte: ContexteTableau = { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres, texteScript: texte };
  const mots = texte
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m))
    .map((mot, i) => ({ mot, debutSec: +(i * 0.3).toFixed(2), finSec: +(i * 0.3 + 0.25).toFixed(2) }));
  const calage = calerFicheTableau(fiche, mots, { contexte, dureeSec: mots.at(-1)!.finSec + 0.5 });
  if (!calage.ok) throw new Error(`${nom} : calage refusé : ${calage.problemes.join(" | ")}`);
  return { fiche: calage.fiche, mots, elements: calage.elements, appel: appelDe(fiche) };
}

/** Les cinq sorties d'une vidéo : vertical, vertical de TikTok et Shorts (fin « site »), portrait, carré, horizontal. */
export const SORTIES = ["vertical", "vertical-liens", "portrait", "carre", "horizontal"] as const;
export type Sortie = (typeof SORTIES)[number];

/** Options de mise en page d'une sortie (la fin au mot de la fiche ; TikTok et Shorts : le site en grand). */
export function optionsSortie(fiche: FicheTableau, sortie: Sortie): { appel: AppelFinV2; format?: IdFormatSortie } {
  if (sortie === "vertical-liens") return { appel: { site: true } };
  return { appel: appelDe(fiche), ...(sortie === "vertical" ? {} : { format: sortie }) };
}
