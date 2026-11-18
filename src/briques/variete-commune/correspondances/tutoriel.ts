/**
 * Tutoriel d'outil : code local → valeur commune. Règle « rien au jugé » (comme `image-video.ts`) : seule une valeur dont le
 * nom dit la même chose reçoit une valeur commune ; sinon `autre:tutoriel:<code>` (réponse par défaut de `versCommun`).
 * - `transitions` : les 4 du plan de scènes (`plan-scenes/zones.ts`) n'ont aucun équivalent (ni coupe, ni volet, ni poussée…).
 * - `objets` : `VOCABULAIRE` n'a pas encore d'axe `objets` ; toutes les pièces du plan restent `autre:tutoriel:<piece>`.
 * - `recit` : gabarits de parcours (`IdGabarit` de T-EXT-18 / 22, recopiés en texte) ; seul `G-Journee` a un équivalent.
 * - `sousTitres` : `IntensiteSousTitres` (`domaine/types.ts`, lecture seule), même lecture que le cas concret.
 */
import { TRANSITIONS } from "@/briques/plan-scenes/zones";
import { IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import type { AxeCommun } from "../types";

/** Gabarits de parcours du tutoriel (recopiés en texte : cette fiche part avant T-EXT-18). */
export const GABARITS_TUTORIEL = ["G-Journee", "G-Decision", "G-Reponse", "G-Flux"] as const;

const dosage = { aucun: "aucun", sobre: "sobre", equilibre: "equilibre", dynamique: "dynamique" } as const;

const recit = {
  "G-Journee": "une-journee",
  "G-Decision": "autre:tutoriel:G-Decision",
  "G-Reponse": "autre:tutoriel:G-Reponse",
  "G-Flux": "autre:tutoriel:G-Flux",
} as const satisfies Record<(typeof GABARITS_TUTORIEL)[number], string>;

const transitions = Object.fromEntries(TRANSITIONS.map((t) => [t, `autre:tutoriel:${t}`])) as Record<(typeof TRANSITIONS)[number], string>;

const objets = Object.fromEntries(IDS_PIECES.map((p) => [p, `autre:tutoriel:${p}`])) as Record<string, string>;

const sousTitres = { sobre: "calmes", equilibre: "equilibres", "tres-dynamique": "appuyes" } as const;

export const TABLE_TUTORIEL: Readonly<Partial<Record<AxeCommun, Readonly<Record<string, string>>>>> = Object.freeze({
  dosage, recit, transitions, objets, sousTitres,
});
