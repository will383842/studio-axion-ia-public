/**
 * NOIR-BLANC-b-v21s (C10-05) : les plages de noir et blanc du script passent des paramètres de composition au filtre du rendu.
 * ÉTEINT (`NOIR_BLANC_ACTIF = false`) : aucune clé `noirBlanc`, graphe FFmpeg identique. Jamais sur un plan où Williams est visible.
 * Aucun rendu réel : tout est pur.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";
import { parametresComposition } from "@/briques/composition";
import { NOIR_BLANC_ACTIF, plagesNoirBlancDesFaits } from "@/briques/composition/plages-noir-blanc";
import type { ProprietesImageComposition } from "@/briques/composition/scene";
import { argumentsImageFfmpeg } from "../../../studio-rendu/src/composition/image-ffmpeg";

// La constante de la pièce a reste fausse en vrai ; ce double la lit par un getter pour (b) à (f).
const etat = vi.hoisted(() => ({ actif: false }));
vi.mock("@/briques/composition/plages-noir-blanc", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/briques/composition/plages-noir-blanc")>();
  return { ...reel, get NOIR_BLANC_ACTIF() { return etat.actif; } };
});

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
const illu = (ordre: number, de: number, a: number) => plan(ordre, de, a, { sourceImage: "illustration", illustration: { elementId: "ill-1" } as never });

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

describe("NOIR-BLANC-b-v21s · plages de noir et blanc : paramètres → filtre", () => {
  it("(a) éteint = identique : aucune clé noirBlanc, objet des couleurs inchangé", () => {
    etat.actif = false;
    expect(NOIR_BLANC_ACTIF).toBe(false);
    const c = couleursDe(commande(), TOUT_ILLU, mots());
    expect("noirBlanc" in c).toBe(false);
    expect(Object.keys(c).sort()).toEqual(["grainPct", "grainTaillePx", "luts", "vignettePct"]);
    // Même résultat que sans mots du tout.
    expect(c).toEqual(couleursDe(commande(), TOUT_ILLU, []));
  });

  it("(b) allumé (double de la constante) : les plages arrivent, en secondes exactes, et le filtre hue les applique après les LUT", () => {
    etat.actif = true;
    const attendu = plagesNoirBlancDesFaits(enMs(mots()), { dureeSec: 9, actif: true });
    expect(attendu).toEqual([[1.05, 2.1]]);
    const c = couleursDe(commande(), TOUT_ILLU, mots());
    expect(c.noirBlanc).toEqual(attendu);
    const graphe = argumentsImageFfmpeg(propsImage(), c as never, FICHIERS, 9, "sortie.mov").join(" ");
    expect(graphe).toContain("hue=s=0:enable=");
    expect(graphe.indexOf("lut3d")).toBeGreaterThan(-1);
    expect(graphe.indexOf("hue=s=0")).toBeGreaterThan(graphe.indexOf("lut3d"));
    etat.actif = false;
  });

  it("(c) jamais sur Williams : un plan « double » qui couvre la plage supprime la clé", () => {
    etat.actif = true;
    expect("noirBlanc" in couleursDe(commande(), [plan(1, 0, 9)], mots())).toBe(false);
    // Plan visage seulement sur la plage : interdit ; plan d'illustration ailleurs : la plage touche quand même le visage.
    expect("noirBlanc" in couleursDe(commande(), [plan(1, 0, 1.5), illu(2, 1.5, 9)], mots())).toBe(false);
    // Visage hors de la plage : la plage reste.
    expect(couleursDe(commande(), [plan(1, 0, 0.9), illu(2, 0.9, 9)], mots()).noirBlanc).toEqual([[1.05, 2.1]]);
    etat.actif = false;
  });

  it("(d) étalonnage coupé : pas de clé", () => {
    etat.actif = true;
    const c = commande({ briques: { ...commande().briques, etalonnage: false } });
    expect("noirBlanc" in couleursDe(c, TOUT_ILLU, mots())).toBe(false);
    etat.actif = false;
  });

  it("(e) ms → s : un mot à 12,345 s donne une plage qui commence à 12,345 s, sans dérive", () => {
    etat.actif = true;
    const m = mots({ 3: 12.345, 4: 12.7, 5: 13.0, 6: 13.9 });
    const c = parametresComposition(commande(), { ratio: "9:16", plans: [illu(1, 0, 20)], segments: [], dureeSec: 20, mots: m }, RECETTE_COMPOSITION_AVOCAT).couleurs as unknown as { noirBlanc?: [number, number][] };
    expect(c.noirBlanc).toEqual([[12.345, 13.9]]);
    etat.actif = false;
  });

  it("(f) image-ffmpeg passe l'option : avec noirBlanc l'étape hue=s=0 est dans le graphe, sans la clé le graphe est celui d'avant", () => {
    const base = { grainPct: 4, grainTaillePx: 2, vignettePct: 8 };
    const sans = argumentsImageFfmpeg(propsImage(), base, FICHIERS, 9, "sortie.mov").join(" ");
    expect(sans).not.toContain("hue=s=0");
    const avec = argumentsImageFfmpeg(propsImage(), { ...base, noirBlanc: [[2, 3]] }, FICHIERS, 9, "sortie.mov").join(" ");
    expect(avec).toContain("hue=s=0");
    expect(avec.replace(/hue=s=0:enable='[^']*',/, "")).toBe(sans);
    // Liste vide : identique au graphe sans la clé.
    expect(argumentsImageFfmpeg(propsImage(), { ...base, noirBlanc: [] }, FICHIERS, 9, "sortie.mov").join(" ")).toBe(sans);
  });
});

const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
function propsImage(): ProprietesImageComposition {
  return {
    ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 225,
    decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
    doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
    plans: [
      { debutSec: 0, finSec: 4, type: "double", angle: "principal", cadrage: CADRAGE },
      { debutSec: 4, finSec: 9, type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: "entree:illu-02", video: false } },
    ],
  } as unknown as ProprietesImageComposition;
}
const FICHIERS = { decor: "decor-pret.png", doubles: { principal: { fichier: "double.webm", video: true } }, accessoire: { fichier: "accessoire.png", x: 700, y: 560, largeur: 260, hauteur: 1380 }, illustrations: { 2: { fichier: "illu-02.jpg", video: false } }, luts: [{ fichier: "lut.cube", plages: [[0, 9]] as [number, number][] }], son: "son.wav" };
