/**
 * ALLUMER-NOIR-BLANC-v21t (C10-05) : le noir et blanc de la partie « avant » est ALLUMÉ (décision du pilote du 25/11 12:00).
 * Aucun rendu réel : tout est pur.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";
import { parametresComposition } from "@/briques/composition";
import { NOIR_BLANC_ACTIF, plagesNoirBlancDesFaits } from "@/briques/composition/plages-noir-blanc";

// La constante de la pièce a reste fausse en vrai ; ce double la lit par un getter pour (b) à (f).
const MAINTENANT = "2026-10-02T08:00:00.000Z";
const SCRIPT = "on passe de 2 heures à 20 minutes par semaine"; // « 2 » = mot 3 (1,05 s), « 20 » = mot 6 (2,1 s)

/** Mots à 350 ms, en secondes (MotHorodate), avec des débuts imposés par indice (en secondes). */
function mots(debuts: Record<number, number> = {}): MotHorodate[] {
  return SCRIPT.split(/\s+/).map((mot, i) => {
    const debutSec = debuts[i] ?? i * 0.35;
    return { mot, debutSec, finSec: debutSec + 0.3 };
  });
}
const enMs = (m: MotHorodate[]) => m.map((x) => ({ texte: x.mot, debutMs: Math.round(x.debutSec * 1000), finMs: Math.round(x.finSec * 1000) }));

function plan(ordre: number, de: number, a: number, extra: Partial<PlanProduit> = {}): PlanProduit {
  return { ordre, debutSec: de, finSec: a, texte: "texte", segmentId: `s${ordre}`, sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts", ...extra };
}
const illu = (ordre: number, de: number, a: number, extra: Partial<PlanProduit> = {}) => plan(ordre, de, a, { sourceImage: "illustration", illustration: { elementId: "ill-1" } as never, ...extra });

function commande(extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2, moteurId: "montage-avocat", videoId: "v-nb", formatId: "avocat", versionFormat: 2, profilRenduVersion: 1, dureeCibleSec: 9, ratios: ["9:16", "4:5", "1:1"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s1", texte: SCRIPT }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Clair-obscur", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees: {}, reglages: {}, plans: [], prononciations: [], mentionIA: { active: false } as never, budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme, profilRendu: formatAvocat.profilRendu, recetteMontage: RECETTE_MONTAGE_AVOCAT, construiteLe: MAINTENANT,
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: {
      "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" },
      "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 },
      "ill-1": { cle: "/demo/illu.png", mime: "image/png" },
    },
    ...extra,
  } as CommandeFabrication;
}

const couleursDe = (c: CommandeFabrication, plans: PlanProduit[], m: MotHorodate[]) =>
  parametresComposition(c, { ratio: "9:16", plans, segments: [], dureeSec: 9, mots: m }, RECETTE_COMPOSITION_AVOCAT).couleurs as unknown as Record<string, unknown>;

const TOUT_ILLU = [illu(1, 0, 9)];
const NB = (c: Record<string, unknown>) => c.noirBlanc as [number, number][] | undefined;
const SCRIPT_ARGENT = "on passe de 30 € à 10 € par mois";
const motsDe = (texte: string, debuts: Record<number, number> = {}): MotHorodate[] =>
  texte.split(/\s+/).map((mot, i) => {
    const debutSec = debuts[i] ?? i * 0.35;
    return { mot, debutSec, finSec: debutSec + 0.3 };
  });

describe("ALLUMER-NOIR-BLANC-v21t · le noir et blanc de la partie « avant » est allumé (décision du pilote du 25/11 12:00)", () => {
  it("(a) allumé : constante à true, la plage « de 2 heures à 20 minutes » arrive en secondes exactes", () => {
    expect(NOIR_BLANC_ACTIF).toBe(true);
    expect(NB(couleursDe(commande(), TOUT_ILLU, mots()))).toEqual([[1.05, 2.1]]);
  });

  it("(b) jamais sur Williams : plan « double » (ou illustration remplacée par le double) sur la plage = aucune clé", () => {
    expect("noirBlanc" in couleursDe(commande(), [plan(1, 0, 9)], mots())).toBe(false);
    // Illustration sans fichier : le double la remplace (Williams visible) = plage interdite.
    expect("noirBlanc" in couleursDe(commande(), [illu(1, 0, 9, { illustration: { elementId: "inconnue" } as never })], mots())).toBe(false);
    // Visage hors de la plage : la plage reste.
    expect(NB(couleursDe(commande(), [plan(1, 0, 0.9), illu(2, 0.9, 9)], mots()))).toEqual([[1.05, 2.1]]);
  });

  it("(c) argent exclu : « de 30 € à 10 € » = aucune clé", () => {
    expect("noirBlanc" in couleursDe(commande(), TOUT_ILLU, motsDe(SCRIPT_ARGENT))).toBe(false);
  });

  it("(d) sans mots ou étalonnage coupé = aucune clé", () => {
    expect("noirBlanc" in couleursDe(commande(), TOUT_ILLU, [])).toBe(false);
    const sansMots = parametresComposition(commande(), { ratio: "9:16", plans: TOUT_ILLU, segments: [], dureeSec: 9 }, RECETTE_COMPOSITION_AVOCAT).couleurs as unknown as Record<string, unknown>;
    expect("noirBlanc" in sansMots).toBe(false);
    const c = commande({ briques: { ...commande().briques, etalonnage: false } });
    expect("noirBlanc" in couleursDe(c, TOUT_ILLU, mots())).toBe(false);
  });

  it("(e) 2 plages au plus, bords gardés", () => {
    const texte = "on passe de 2 heures à 20 minutes puis de 5 jours à 1 jour puis de 8 mois à 2 mois";
    const m = motsDe(texte, { 3: 3, 6: 5, 10: 8, 13: 10, 17: 13, 20: 15 });
    const plages = NB(couleursDe(commande(), [illu(1, 0, 20)], m)) ?? [];
    expect(plages.length).toBeGreaterThan(0);
    expect(plages.length).toBeLessThanOrEqual(2);
    // Passage dans la première demi-seconde : ignoré.
    expect("noirBlanc" in couleursDe(commande(), [illu(1, 0, 9)], motsDe("de 2 heures à 20 minutes", { 1: 0.1, 4: 1.6 }))).toBe(false);
  });

  it("(f) jamais la v4 : aucun fichier de montage-facecam-animee ni de motion-v4 ne cite plages-noir-blanc", () => {
    const racine = resolve(__dirname, "../../..");
    const liste = (dir: string): string[] => {
      if (!existsSync(dir)) return [];
      return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? liste(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    };
    const tous = [...liste(join(racine, "studio-rendu/compositions/interface-claire/motion-v4")), ...liste(join(racine, "src/moteurs/montage-facecam-animee"))];
    for (const f of tous) expect(readFileSync(f, "utf8"), f).not.toMatch(/plages-noir-blanc/);
  });
});
