/**
 * BR-POIDS-VARIABLE-IV-a · Le mot dit s'épaissit (graisse 500 → 800, X1-01) derrière l'option `poidsVariable` des outils de rendu
 * de l'image → vidéo (aucun réglage lu ici : BR-POIDS-VARIABLE-IV-b). Preuve par le CHEMIN RÉEL de fabrication
 * (`demandeMontageIV` → `commandeDuMontageIV` → `donneesCalque` → `texte.sousTitres`) puis rendu statique du calque.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

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
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import { graisseAuTemps } from "@/briques/sous-titres/poids-variable";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { carteFixe } from "../../image-video/doubles-fabrication";

const { demandeMontageIV } = await import("@/services/image-video-rendu");

function demandeReelle(): DemandeRenduIV {
  const carte = carteFixe("A");
  const fiche = FICHES_SIMULEES["essai-a"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const simulee = pisteSimulee(fiche, fin.muet ? null : fin);
  const ligne = mettreEnSceneIV({ carte, fiche, voix: simulee, fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
  const piste = { ...simulee, version: "v", reseaux: fin.reseaux, courte: false, cle: "voix", empreinte: "e" } as unknown as PisteVoixSeuleIV;
  const mixage = planMixageIV(piste, ligne.bruitages, ligne.dureeSec);
  return { id: "d", videoId: "v-poids", version: "v", reseaux: fin.reseaux, ligne, mixage, piste } as unknown as DemandeRenduIV;
}

const outilsDeBase = { rendu: undefined as never, env: "dev", signerLecture: async (c: string) => `lecture:${c}`, signerDepot: async (c: string) => `depot:${c}`, sons: BRUITAGES_V4_IV };
type Texte = Parameters<typeof instantsTexte>[0];
/** La voix simulée dit chaque mot en 0,26 s : le premier groupe est recalé à 0,4 s par mot (le reste du texte est celui de la fabrication). */
function allongerLePremierGroupe(t: Texte): Texte {
  const copie = structuredClone(t);
  const g = copie.sousTitres!.segments[0];
  g.mots.forEach((m, i) => { m.debutSec = g.debutSec + i * 0.4; m.finSec = m.debutSec + 0.4; });
  g.finSec = g.debutSec + g.mots.length * 0.4;
  copie.sousTitres!.segments = copie.sousTitres!.segments.slice(0, 1);
  return copie;
}
const texteDe = async (d: DemandeRenduIV, poids: boolean) => allongerLePremierGroupe(((await demandeMontageIV(d, { ...outilsDeBase, ...(poids ? { poidsVariable: true as const } : {}) })).parametres as unknown as { texte: Texte }).texte);

/** Premier mot d'au moins 0,3 s du premier groupe qui en a un. */
function motLong(t: Texte) {
  for (const s of t.sousTitres!.segments) for (const m of s.mots) if (m.finSec - m.debutSec >= 0.3) return { s, m };
  throw new Error("aucun mot de 0,3 s");
}

const chem = (c: string) => `../../../studio-rendu/compositions/${c}`;
async function html(donnees: unknown, instantSec: number): Promise<string> {
  const { CalqueSousTitres } = (await import(/* @vite-ignore */ chem("sous-titres/CalqueSousTitres"))) as { CalqueSousTitres: unknown };
  // @ts-expect-error le react de studio-rendu n'a pas de types ici
  const { createElement } = (await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
  // @ts-expect-error le react de studio-rendu n'a pas de types ici
  const { renderToStaticMarkup } = (await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server");
  return renderToStaticMarkup(createElement(CalqueSousTitres as never, { donnees, instantSec } as never));
}
/** Pour chaque mot dessiné en police variable : [graisse, largeur réservée]. */
const spansVariables = (h: string) => [...h.matchAll(/<span style="([^"]*Axion Manrope Variable[^"]*)"/g)].map((r) => ({ graisse: Number(/font-weight:([\d.]+)/.exec(r[1])?.[1]), largeur: Number(/;width:([\d.]+)px/.exec(r[1])?.[1] ?? /^width:([\d.]+)px/.exec(r[1])?.[1]) }));

describe("BR-POIDS-VARIABLE-IV-a · de bout en bout (vraie fabrication de la demande de montage)", () => {
  it("(a) sans option : aucune clé poidsVariable, aucune graisse dans la scène", async () => {
    const d = demandeReelle();
    const t = await texteDe(d, false);
    expect(t.sousTitres).not.toHaveProperty("poidsVariable");
    const { s, m } = motLong(t);
    for (const instant of [m.debutSec, (m.debutSec + m.finSec) / 2, m.finSec - 1e-6]) {
      const el = sceneAuTemps(t.sousTitres!, instant)!;
      expect(el.mots.every((x) => !("graisse" in x))).toBe(true);
    }
    expect(JSON.stringify(await texteDe(d, false))).toBe(JSON.stringify(t));
    expect(s.mots.length).toBeGreaterThan(0);
  });

  it("(b) { poidsVariable: true } : le drapeau est dans texte.sousTitres ; le mot dit passe de 500 à 800 à largeur constante", async () => {
    const d = demandeReelle();
    const t = await texteDe(d, true);
    expect(t.sousTitres!.poidsVariable).toBe(true);
    const { m } = motLong(t);
    const debut = sceneAuTemps(t.sousTitres!, m.debutSec)!;
    const fin = sceneAuTemps(t.sousTitres!, m.finSec - 1e-6)!;
    const k = debut.mots.findIndex((x) => x.texte === m.mot.replace(/[.,;:!?]+$/, "") || x.texte === m.mot);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(debut.mots[k].graisse).toBe(graisseAuTemps(m.debutSec, m.debutSec, m.finSec));
    expect(debut.mots[k].graisse).toBe(500);
    expect(fin.mots[k].graisse).toBeGreaterThanOrEqual(799.9);
  });

  it.skipIf(!AVEC_RENDU)("(b) rendu statique : font-weight 500 au début du mot, 800 à sa fin, largeur réservée identique", async () => {
    const d = demandeReelle();
    const t = await texteDe(d, true);
    const { m } = motLong(t);
    const debut = sceneAuTemps(t.sousTitres!, m.debutSec)!;
    const k = debut.mots.findIndex((x) => x.texte === m.mot.replace(/[.,;:!?]+$/, "") || x.texte === m.mot);
    const a = spansVariables(await html(t.sousTitres, m.debutSec));
    const b = spansVariables(await html(t.sousTitres, m.finSec - 1e-6));
    expect(a.length).toBe(debut.mots.length);
    expect(a[k].graisse).toBe(500);
    expect(b[k].graisse).toBeGreaterThanOrEqual(799.9);
    expect(a.map((x) => x.largeur)).toEqual(b.map((x) => x.largeur));
    expect(a.every((x) => x.largeur > 0)).toBe(true);
    // Éteint : aucun mot en police variable.
    expect(spansVariables(await html((await texteDe(d, false)).sousTitres, m.debutSec))).toEqual([]);
  });

  it("(c) instantsTexte : au moins 3 instants distincts pendant un mot de 0,3 s ; éteint : identique à master ; surcoût d'images noté", async () => {
    const d = demandeReelle();
    const allume = await texteDe(d, true);
    const eteint = await texteDe(d, false);
    const { m } = motLong(allume);
    const dedans = (inst: number[]) => inst.filter((x) => x >= m.debutSec - 1e-9 && x < m.finSec);
    const ia = instantsTexte(allume);
    expect(new Set(dedans(ia.instants)).size).toBeGreaterThanOrEqual(3);
    const ie = instantsTexte(eteint);
    expect(dedans(ie.instants).length).toBeLessThan(dedans(ia.instants).length);
    console.info(`[poids-variable] images rendues : éteint ${ie.instants.length}, allumé ${ia.instants.length} (+${Math.round((100 * (ia.instants.length - ie.instants.length)) / ie.instants.length)} %), durée ${allume.images} images`);
  });

  it("(d) hors image → vidéo : le style sans option n'a jamais poidsVariable (donneesCalque pur)", async () => {
    const { donneesCalque } = await import("@/briques/sous-titres");
    const base = { segments: [], base: "karaoke" as never, ratio: "9:16" as never };
    expect(donneesCalque(base as never)).not.toHaveProperty("poidsVariable");
    expect(donneesCalque({ ...base, style: { poidsVariable: false } } as never)).not.toHaveProperty("poidsVariable");
    expect(donneesCalque({ ...base, style: { poidsVariable: true } } as never).poidsVariable).toBe(true);
  });
});
