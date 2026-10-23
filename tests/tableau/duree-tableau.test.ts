/**
 * UN SEUL ESTIMATEUR DE DURÉE pour le tableau animé (`src/domaine/duree-tableau.ts`) : calé sur la voix réelle (deux
 * mesures en production, retrouvées à 10 % près), et le même pour le générateur, les règles du découpage et sa consigne.
 */
import { describe, expect, it } from "vitest";
import { ATEMPO_DES_MESURES, CARACTERES_PAR_SECONDE_TABLEAU, DUREE_MAX_TABLEAU_SEC, MESURES_CALAGE, RECETTE_CALEE, caracteresDits, dureeDiteSec } from "@/domaine/duree-tableau";
import { RESEAUX_SCRIPT, RESEAUX_SCRIPT_INFOS } from "@/domaine/scripts-tableau";
import { TOLERANCE_DUREE, controlerDuree, dureeEstimee } from "@/domaine/scripts-tableau-controles";
import { CONSIGNE_DECOUPAGE } from "@/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { RECETTE_VOIX_TABLEAU } from "@/moteurs/montage-tableau/recette-voix";
import { CARACTERES_PAR_SECONDE, DUREE_MAX_MS, regleDureeMaximale, tempsScenes } from "@/moteurs/montage-tableau/regles";
import { REGLES_TABLEAU } from "@/services/tableau-scripts/consignes";
import { SCRIPT_FORMATION } from "./style-v2/temoin-formation";
import { TEXTE_CAS_REEL } from "../tableau-scripts/cas-reel-audit";

const ecart = (estime: number, mesure: number) => Math.abs(estime - mesure) / mesure;
/** Une mesure faite à `atempo` 1,08, ramenée à la recette en vigueur (la voix est d'autant plus longue qu'elle est moins accélérée). */
const aLaRecette = (dureeSec: number) => (dureeSec * VITESSE_DES_MESURES * ATEMPO_DES_MESURES) / (RECETTE_VOIX_TABLEAU.synthese.vitesse * RECETTE_VOIX_TABLEAU.filtres.atempo);
/** Vitesse HeyGen de la recette des mesures de calage (`voix-tableau/1`). */
const VITESSE_DES_MESURES = 1.1;
/** Un texte de `n` caractères dits (mots de 4 lettres et leur espace). */
const texteDe = (n: number) => "mots ".repeat(Math.ceil(n / 5)).slice(0, n).trim().padEnd(n, "s");
const ficheDe = (...textes: string[]) => ({ scenes: textes.map((texteDit, i) => ({ id: `s0${i + 1}`, texteDit, elements: [] })) }) as unknown as FicheTableau;

describe("calage sur la voix réelle", () => {
  it("est calé sur la recette de voix en vigueur (une autre recette oblige à recaler)", () => {
    expect(RECETTE_VOIX_TABLEAU.id).toBe(RECETTE_CALEE);
  });

  it("retrouve la mesure de production de 857 caractères (43,0 s à 1,08, ramenée à la recette) à 10 % près", () => {
    const m = MESURES_CALAGE[0];
    expect(caracteresDits(texteDe(m.caracteres))).toBe(857);
    expect(ecart(dureeDiteSec(texteDe(m.caracteres)), aLaRecette(43.0))).toBeLessThan(0.1);
  });

  it("retrouve la mesure de production du témoin « Formation » (52,3 s à 1,08, ramenée à la recette) à 10 % près, sur son texte réel", () => {
    const texte = SCRIPT_FORMATION.join(" ");
    expect(caracteresDits(texte)).toBe(MESURES_CALAGE[1].caracteres);
    expect(ecart(dureeDiteSec(texte), aLaRecette(52.3))).toBeLessThan(0.1);
  });

  it("le cas réel du 12/10 (1 487 caractères) dure environ 88 s à 165 mots/min : sous le plafond de 90 s, mais refusé pour le fil (75 s)", () => {
    expect(caracteresDits(TEXTE_CAS_REEL)).toBe(1487);
    const d = dureeDiteSec(TEXTE_CAS_REEL);
    expect(d).toBeCloseTo(88.0, 0);
    expect(d).toBeLessThan(DUREE_MAX_TABLEAU_SEC);
    expect(controlerDuree(TEXTE_CAS_REEL, "fil").some((x) => x.eliminatoire)).toBe(true);
    expect(regleDureeMaximale(ficheDe(TEXTE_CAS_REEL), { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: [], texteScript: TEXTE_CAS_REEL })).toEqual([]);
  });
});

describe("un seul estimateur", () => {
  it("le générateur, les règles et la consigne du découpage lisent le même débit", () => {
    expect(CARACTERES_PAR_SECONDE).toBe(CARACTERES_PAR_SECONDE_TABLEAU);
    expect(DUREE_MAX_MS).toBe(DUREE_MAX_TABLEAU_SEC * 1000);
    expect(CONSIGNE_DECOUPAGE).toContain("16,9 caractères dits par seconde");
    expect(REGLES_TABLEAU).toContain("16,9 caractères dits par seconde");
    expect(CONSIGNE_DECOUPAGE).not.toMatch(/mots par seconde/);
    expect(REGLES_TABLEAU).not.toMatch(/mots par seconde/);
  });

  it("donnent la même durée pour le même texte (générateur et règles)", () => {
    for (const t of [SCRIPT_FORMATION.join(" "), TEXTE_CAS_REEL]) {
      const regles = tempsScenes(ficheDe(t)).at(-1)!.finMs / 1000;
      expect(dureeEstimee(t)).toBeCloseTo(regles, 1);
    }
  });

  it("une fiche découpée en scènes ne dure jamais plus que son script d'un seul tenant", () => {
    const morceaux = SCRIPT_FORMATION;
    const fiche = tempsScenes(ficheDe(...morceaux)).at(-1)!.finMs / 1000;
    expect(fiche).toBeLessThanOrEqual(dureeEstimee(morceaux.join(" ")));
  });
});

describe("fourchettes du générateur et plafond du découpage : cohérents", () => {
  it("aucune borne haute de réseau ne dépasse le plafond du découpage", () => {
    for (const r of RESEAUX_SCRIPT) expect(RESEAUX_SCRIPT_INFOS[r].dureeMax).toBeLessThanOrEqual(DUREE_MAX_TABLEAU_SEC);
  });

  it("un texte accepté (même en remarque) par le générateur pour un réseau n'est jamais refusé pour durée au découpage", () => {
    // Balayage caractère par caractère, de la borne basse au-delà de la tolérance la plus large.
    const max = Math.ceil(DUREE_MAX_TABLEAU_SEC * (1 + TOLERANCE_DUREE) * CARACTERES_PAR_SECONDE_TABLEAU) + 40;
    for (const r of RESEAUX_SCRIPT) {
      for (let n = 400; n <= max; n += 7) {
        const t = texteDe(n);
        const accepte = !controlerDuree(t, r).some((d) => d.eliminatoire);
        if (!accepte) continue;
        const regle = regleDureeMaximale(ficheDe(t), { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: [], texteScript: t });
        expect(regle, `${r}, ${n} caractères`).toEqual([]);
      }
    }
  });
});
