/**
 * Les quatre fiches RÉELLES (`temoins/fiche-*-prod.json`) et le témoin du blocage de la fin TikTok et Shorts
 * (`temoins/blocage-fin-tiktok-2026-10-14.json`), passés au style « reference/1 » : même fiche, seul `habillage`
 * change (une nouvelle fiche naît avec ce style). Remises en forme comme en production, calées sur un minutage régulier
 * (0,3 s par mot, aucune voix lue). Partagé par les tests et les planches (`apercus.mts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MotCalage } from "../../../src/briques/motion/calage";
import { calerFicheTableau, type ElementCale } from "../../../src/moteurs/montage-tableau/calage";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import { STYLE_REFERENCE_1, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { FICHES_REELLES, ficheReelleBrute, type NomFicheReelle } from "../dessin-4/fiches-reelles";

export { FICHES_REELLES, type NomFicheReelle };

const DOSSIER = join(__dirname, "..", "temoins");

/** Une fiche brute passée au style « reference/1 ». */
export const auStyleReference = (f: FicheTableau): FicheTableau => ({ ...f, habillage: STYLE_REFERENCE_1 });

/** Fiche réelle, au style « reference/1 », remise en forme comme en production. */
export function ficheReference(nom: NomFicheReelle): FicheTableau {
  return remettreEnForme(auStyleReference(ficheReelleBrute(nom)));
}

interface MotVoix {
  mot: string;
  debutSec: number;
  finSec: number;
}

/**
 * Fiche RÉALISTE de 6 pages écrite en « phrases complètes » (14/10, regard de Will sur une vraie vidéo : des blocs trop
 * courts, une page remplie aux 2/3) : 3 à 5 blocs par page, chaque bloc une phrase presque complète reprise du texte
 * dit. Déjà au style « reference/1 », remise en forme comme en production.
 */
export function fichePhrasesCompletes(): FicheTableau {
  return remettreEnForme(JSON.parse(readFileSync(join(DOSSIER, "fiche-phrases-completes-6-pages.json"), "utf8")) as FicheTableau);
}

/** Le témoin du 14/10 : sa fiche (au style « reference/1 ») et les minutages de ses deux vraies voix. */
export function temoinReference(): { fiche: FicheTableau; voix: { mots: MotVoix[]; dureeSec: number }; voixTikTok: { mots: MotVoix[]; dureeSec: number } } {
  const t = JSON.parse(readFileSync(join(DOSSIER, "blocage-fin-tiktok-2026-10-14.json"), "utf8")) as { fiche: FicheTableau; voix: { mots: MotVoix[]; dureeSec: number }; voixTikTok: { mots: MotVoix[]; dureeSec: number } };
  return { fiche: auStyleReference(t.fiche), voix: t.voix, voixTikTok: t.voixTikTok };
}

/** Contexte des règles de la production : le texte de la fiche, ses démonstrations validées. */
export function contexteDe(f: FicheTableau, aujourdhui = "2026-10-14"): ContexteTableau {
  const ids = [...new Set(f.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  return {
    aujourdhui,
    sourcesChiffres: [],
    preuves: [],
    matieres: ids.map((id) => ({ id, type: "demonstration" as const, statut: "validee" as const, perimeLe: "2027-01-09" })),
    texteScript: f.scenes.map((s) => s.texteDit).join(" "),
  };
}

/** Mots à débit régulier (0,3 s par mot), comme la voix réelle. */
export function motsReguliers(f: FicheTableau): MotCalage[] {
  return f.scenes
    .map((s) => s.texteDit)
    .join(" ")
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m))
    .map((mot, i) => ({ mot, debutSec: +(i * 0.3).toFixed(2), finSec: +(i * 0.3 + 0.25).toFixed(2) }));
}

/** Calée sur un minutage régulier ; lève si le calage refuse. */
export function caleeReguliere(f: FicheTableau, nom = "fiche"): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[] } {
  const mots = motsReguliers(f);
  const r = calerFicheTableau(f, mots, { contexte: contexteDe(f), dureeSec: mots.at(-1)!.finSec + 0.5 });
  if (!r.ok) throw new Error(`${nom} : calage refusé : ${r.problemes.join(" | ")}`);
  return { fiche: r.fiche, mots, elements: r.elements };
}
