/**
 * BR-MINIMAL-IV-b · la boîte arrondie maison (X1-02a) posée derrière les petits groupes de l'image → vidéo.
 * Preuve par le CHEMIN RÉEL : `demandeMontageIV` (image-video-rendu.ts) → `commandeDuMontageIV` → style → `donneesCalque`
 * → `texte.sousTitres.boite` de la demande de rendu → `CalqueSousTitres` (rendu statique, chemin CALCULÉ).
 * Éteint (option absente) : demande et rendu identiques à avant. Aucun réseau, aucun appel payant.
 */
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 10, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 120_000 });

import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV, type DemandeRenduIV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { planMixageIV, type PisteVoixSeuleIV } from "@/moteurs/montage-image-video/assemblage";
import { donneesCalque } from "@/briques/sous-titres";
import { couleursMinimalDynamique } from "@/briques/sous-titres/minimal-dynamique";
import { boiteAuTemps } from "@/briques/sous-titres/scene";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { carteFixe } from "../../image-video/doubles-fabrication";

const { commandeDuMontageIV, demandeMontageIV } = await import("@/services/image-video-rendu");
const { reinitialiserDepots } = await import("@/donnees/memoire");

function demandeReelle(): DemandeRenduIV {
  const carte = carteFixe("A");
  const fiche = FICHES_SIMULEES["essai-a"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const simulee = pisteSimulee(fiche, fin.muet ? null : fin);
  const ligne = mettreEnSceneIV({ carte, fiche, voix: simulee, fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
  const piste = { ...simulee, version: "v", reseaux: fin.reseaux, courte: false, cle: "voix", empreinte: "e" } as unknown as PisteVoixSeuleIV;
  const mixage = planMixageIV(piste, ligne.bruitages, ligne.dureeSec);
  return { id: "d", videoId: "v-boite", version: "v", reseaux: fin.reseaux, ligne, mixage, piste } as unknown as DemandeRenduIV;
}

type Texte = Parameters<typeof instantsTexte>[0];
const outilsDeBase = { rendu: undefined as never, env: "dev", signerLecture: async (c: string) => `lecture:${c}`, signerDepot: async (c: string) => `depot:${c}`, sons: BRUITAGES_V4_IV };
const texteDe = async (d: DemandeRenduIV, minimal: boolean) => {
  const demande = await demandeMontageIV(d, { ...outilsDeBase, ...(minimal ? { sousTitresMinimal: true as const } : {}) });
  return (demande.parametres as unknown as { texte: Texte }).texte;
};

async function html(donnees: unknown, instantSec: number): Promise<string> {
  const chem = (c: string) => `../../../studio-rendu/compositions/${c}`;
  const { CalqueSousTitres } = (await import(/* @vite-ignore */ ["..", "..", "..", "studio-rendu", "compositions", "sous-titres", "CalqueSousTitres"].join("/"))) as { CalqueSousTitres: (p: { donnees: unknown; instantSec?: number }) => unknown };
  void chem;
  // @ts-expect-error le react de studio-rendu n'a pas de types ici
  const { createElement } = (await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
  // @ts-expect-error le react de studio-rendu n'a pas de types ici
  const { renderToStaticMarkup } = (await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server");
  return renderToStaticMarkup(createElement(CalqueSousTitres as never, { donnees, instantSec } as never));
}

describe("BR-MINIMAL-IV-b · boîte arrondie des sous-titres de l'image → vidéo", () => {
  beforeEach(() => void reinitialiserDepots());

  it("(a) éteint : aucun `boite` dans la demande, style sans `boiteArrondie` ; option absente, {} : identique", async () => {
    const d = demandeReelle();
    const t = await texteDe(d, false);
    expect(t.sousTitres).toBeDefined();
    expect(t.sousTitres as object).not.toHaveProperty("boite");
    const sans = commandeDuMontageIV(d, [], BRUITAGES_V4_IV);
    expect(JSON.stringify(commandeDuMontageIV(d, [], BRUITAGES_V4_IV, undefined))).toBe(JSON.stringify(sans));
    expect(JSON.stringify(commandeDuMontageIV(d, [], BRUITAGES_V4_IV, {}))).toBe(JSON.stringify(sans));
    expect(JSON.stringify(sans)).not.toContain("boiteArrondie");
  });

  it("(b) allumé : `texte.sousTitres.boite` présent (couleurs de la charte), venu de la vraie `demandeMontageIV`", async () => {
    const d = demandeReelle();
    const t = await texteDe(d, true);
    const boite = (t.sousTitres as unknown as { boite?: { rayonEm: number; margeEm: number; couleurs: { fond: string; texte: string } } }).boite;
    expect(boite).toBeDefined();
    expect(boite!.couleurs).toEqual(couleursMinimalDynamique());
    expect(boite!.rayonEm).toBeGreaterThan(0);
    expect(JSON.stringify(commandeDuMontageIV(d, [], BRUITAGES_V4_IV, { boite: true }))).toContain('"boiteArrondie":true');
  });

  it("(b) `boiteAuTemps` : null sans `boite` ou hors groupe ; une ligne mesurée au milieu d'un groupe", async () => {
    const d = demandeReelle();
    const allume = (await texteDe(d, true)).sousTitres!;
    const eteint = (await texteDe(d, false)).sousTitres!;
    const g = allume.segments[0];
    const milieu = (g.debutSec + g.finSec) / 2;
    expect(boiteAuTemps(eteint, milieu)).toBeNull();
    expect(boiteAuTemps(allume, -5)).toBeNull();
    const lignes = boiteAuTemps(allume, milieu);
    expect(lignes).not.toBeNull();
    expect(lignes!.length).toBe(1);
    expect(lignes![0].largeur).toBeGreaterThan(0);
    expect(lignes![0].hauteur).toBeGreaterThan(0);
  });

  it.skipIf(!AVEC_RENDU)("(b) rendu statique de CalqueSousTitres : un <path> non vide dans data-boite-arrondie ; éteint : rien", async () => {
    const d = demandeReelle();
    const allume = (await texteDe(d, true)).sousTitres!;
    const eteint = (await texteDe(d, false)).sousTitres!;
    const g = allume.segments[0];
    const milieu = (g.debutSec + g.finSec) / 2;
    const h = await html(allume, milieu);
    expect(h).toMatch(/<svg[^>]*data-boite-arrondie=""[^>]*>\s*<path d="M[^"]+"/);
    expect(h.indexOf("data-boite-arrondie")).toBeLessThan(h.indexOf(g.mots[0].mot));
    const h0 = await html(eteint, milieu);
    expect(h0).not.toContain("data-boite-arrondie");
    // Même donnée allumée sans le champ `boite` : rendu identique à l'éteint pour les mêmes segments.
    const { boite: _b, ...sansBoite } = allume as unknown as Record<string, unknown>;
    void _b;
    expect(await html(sansBoite, milieu)).not.toContain("data-boite-arrondie");
  });

  it("(c) avocat, face caméra, tableau, cas concret : jamais de `boite` (style sans le champ)", () => {
    const segments = [{ id: "s1", debutSec: 0, finSec: 2, mots: [{ mot: "Bonjour", debutSec: 0, finSec: 0.5 }, { mot: "monde", debutSec: 0.5, finSec: 1 }] }];
    for (const base of ["minimal", "karaoke"] as const) {
      const d = donneesCalque({ segments, base, ratio: "9:16" });
      expect(d).not.toHaveProperty("boite");
    }
    const style = { type: "style-sous-titres" as const, police: "Inter Bold", tailleRelative: 1, motsParLigne: 3, casse: "normale" as const, animation: "aucune" as const, couleurAccent: "orange" as const, position: "bas" as const };
    expect(donneesCalque({ segments, base: "minimal", ratio: "9:16", style })).not.toHaveProperty("boite");
    expect(donneesCalque({ segments, base: "minimal", ratio: "9:16", style: { ...style, boiteArrondie: false as never } })).not.toHaveProperty("boite");
    expect(donneesCalque({ segments, base: "minimal", ratio: "9:16", style: { ...style, boiteArrondie: true } })).toHaveProperty("boite");
  });

  it("(d) `instantsTexte` : même nombre d'images rendues avec et sans boîte", async () => {
    const d = demandeReelle();
    const texte = await texteDe(d, true);
    const { boite: _b, ...sansBoite } = texte.sousTitres as unknown as Record<string, unknown>;
    void _b;
    const a = instantsTexte(texte);
    const b = instantsTexte({ ...texte, sousTitres: sansBoite as never });
    expect(a.instants).toEqual(b.instants);
    expect(a.durees).toEqual(b.durees);
    expect(a.durees.reduce((x, y) => x + y, 0)).toBe(texte.images);
  });
});
