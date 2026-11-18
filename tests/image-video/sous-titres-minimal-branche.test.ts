/**
 * BR-MINIMAL-IV-a · Sous-titres « minimal dynamique » de l'image → vidéo (réglage `imageVideo.sousTitresMinimal`, ÉTEINT).
 * Preuve par le CHEMIN RÉEL : réglage → `outilsImageVideo(...).rendre` (image-video.ts) → `rendreVersionIV` reçoit
 * `sousTitresMinimal` → `baseDuMontageIV` (image-video-rendu.ts) → `demandeComposition` / `parametresComposition` →
 * `texte.sousTitres` de la demande de rendu → rendu « par instants » (`instantsTexte`, studio-rendu) et `CalqueSousTitres`.
 * Aucun appel réel, aucun réseau, aucun test lancé à la construction d'une image.
 */
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 10, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 120_000 });
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

// La vraie `rendreVersionIV` est appelée par le vrai `rendre` ; on relève seulement les outils qu'elle reçoit (aucun rendu lancé).
const recu: { outils?: unknown } = {};
vi.mock("@/services/image-video-rendu", async (orig) => {
  const vrai = await orig<typeof import("@/services/image-video-rendu")>();
  return {
    ...vrai,
    rendreVersionIV: async (_d: unknown, o: unknown) => {
      recu.outils = o;
      return { cle: "k", dureeSec: 1, mesures: {} };
    },
  };
});

import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import type { SegmentSousTitres } from "@/domaine/types";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV, type DemandeRenduIV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { planMixageIV, type PisteVoixSeuleIV } from "@/moteurs/montage-image-video/assemblage";
import { sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { regrouperMinimalIV } from "@/moteurs/montage-image-video/sous-titres-minimal";
import { estNombre } from "@/briques/sous-titres/typographie";
import { instantsTexte } from "../../studio-rendu/src/composition/texte-instants";
import { carteFixe } from "./doubles-fabrication";

const { baseDuMontageIV, demandeMontageIV } = await import("@/services/image-video-rendu");
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { outilsImageVideo, PARAM_SOUS_TITRES_MINIMAL_IV } = await import("@/services/image-video");

function demandeReelle(): DemandeRenduIV {
  const carte = carteFixe("A");
  const fiche = FICHES_SIMULEES["essai-a"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const simulee = pisteSimulee(fiche, fin.muet ? null : fin);
  const ligne = mettreEnSceneIV({ carte, fiche, voix: simulee, fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
  const piste = { ...simulee, version: "v", reseaux: fin.reseaux, courte: false, cle: "voix", empreinte: "e" } as unknown as PisteVoixSeuleIV;
  const mixage = planMixageIV(piste, ligne.bruitages, ligne.dureeSec);
  return { id: "d", videoId: "v-minimal", version: "v", reseaux: fin.reseaux, ligne, mixage, piste } as unknown as DemandeRenduIV;
}

const mots = (s: SegmentSousTitres[]) => s.flatMap((g) => g.mots.map((m) => m.mot));
const marques = (g: SegmentSousTitres) => g.mots.filter((m) => m.enValeur).length;

describe("BR-MINIMAL-IV-a · regrouperMinimalIV (pur)", () => {
  const seg = (id: string, texte: string, t0 = 0): SegmentSousTitres => ({ id, debutSec: t0, finSec: t0 + texte.split(" ").length * 0.4, mots: texte.split(" ").map((mot, i) => ({ mot, debutSec: t0 + i * 0.4, finSec: t0 + i * 0.4 + 0.35, ...(mot === "clients" ? { enValeur: true } : {}) })) });

  it("ne lève jamais : un segment illisible est recopié tel quel ; liste vide = liste vide", () => {
    const casse = { id: "x", debutSec: 0, finSec: 1, mots: [] } as SegmentSousTitres;
    const pasDeMots = { id: "y" } as unknown as SegmentSousTitres;
    expect(regrouperMinimalIV([casse, pasDeMots])).toEqual([casse, pasDeMots]);
    expect(regrouperMinimalIV([])).toEqual([]);
  });

  it("id stable par groupe, déterministe, entrée jamais modifiée", () => {
    const e = [seg("s1", "Aujourd'hui je vous montre comment 87 % de clients sont satisfaits")];
    const copie = structuredClone(e);
    const a = regrouperMinimalIV(e);
    expect(regrouperMinimalIV(e)).toEqual(a);
    expect(e).toEqual(copie);
    expect(a.map((g) => g.id)).toEqual(a.map((_, k) => `s1-m${k}`));
  });
});

describe("BR-MINIMAL-IV-a · de bout en bout (vraie fabrication de la base et de la demande)", () => {
  beforeEach(() => void reinitialiserDepots());

  const outilsDeBase = { rendu: undefined as never, env: "dev", signerLecture: async (c: string) => `lecture:${c}`, signerDepot: async (c: string) => `depot:${c}`, sons: BRUITAGES_V4_IV };

  it("(a) sans option : la base est exactement celle d'aujourd'hui (deep equal) ; option absente, false ou {} : identique", () => {
    const d = demandeReelle();
    const attendue = { ...baseDuMontageIV(d, []), segments: sousTitresVariesIV(d.ligne, d.styleSousTitres) };
    expect(baseDuMontageIV(d, [])).toEqual(attendue);
    expect(baseDuMontageIV(d, [], undefined)).toEqual(attendue);
    expect(baseDuMontageIV(d, [], {})).toEqual(attendue);
  });

  it("(b) { minimal: true } : 1 à 3 mots, au plus 1 marqué, bornes inchangées, aucun mot perdu, nombre + unité jamais séparés", () => {
    const d = demandeReelle();
    const avant = sousTitresVariesIV(d.ligne, d.styleSousTitres);
    const apres = baseDuMontageIV(d, [], { minimal: true }).segments;
    expect(apres.length).toBeGreaterThan(avant.length);
    for (const g of apres) {
      expect(g.mots.length).toBeGreaterThanOrEqual(1);
      expect(g.mots.length).toBeLessThanOrEqual(3);
      expect(marques(g)).toBeLessThanOrEqual(1);
      expect(g.finSec).toBeGreaterThan(g.debutSec);
    }
    expect(apres[0].debutSec).toBe(avant[0].debutSec);
    expect(apres[apres.length - 1].finSec).toBe(avant[avant.length - 1].finSec);
    expect(mots(apres).join(" ")).toBe(mots(avant).join(" "));
    // Un nombre n'est jamais en fin de groupe avec son unité au début du suivant.
    apres.forEach((g, k) => {
      const dernier = g.mots[g.mots.length - 1].mot;
      const suivant = apres[k + 1]?.mots[0]?.mot;
      if (suivant && estNombre(dernier)) expect(["%", "€", "euros", "euro", "pour", "cent"].includes(suivant.toLowerCase())).toBe(false);
    });
    // Au moins un groupe porte un mot marqué (le mot fort ou le chiffre).
    expect(apres.some((g) => marques(g) === 1)).toBe(true);
  });

  it("(c) réglage → outilsImageVideo.rendre → base → parametresComposition → texte.sousTitres ; éteint : identique à avant", async () => {
    const d = demandeReelle();
    const chemin = async (allume: boolean | undefined) => {
      reinitialiserDepots();
      if (allume !== undefined) await ecrireParametre(PARAM_SOUS_TITRES_MINIMAL_IV, allume);
      const outils = await outilsImageVideo({ videoId: "v-minimal", travailId: "t-minimal", production: false, lireImageSource: async () => null });
      recu.outils = undefined;
      await outils.rendre(d);
      const o = recu.outils as Parameters<typeof demandeMontageIV>[1];
      const demande = await demandeMontageIV(d, { ...outilsDeBase, rendu: o.rendu, sousTitresMinimal: o.sousTitresMinimal });
      return { o, texte: (demande.parametres as unknown as { texte: { sousTitres: { segments: SegmentSousTitres[] }; fps: number; images: number; encadre: never; incrustations: never[] } }).texte };
    };
    const eteintAbsent = await chemin(undefined);
    expect(eteintAbsent.o).not.toHaveProperty("sousTitresMinimal");
    for (const faux of [false, "true", 1, null]) {
      reinitialiserDepots();
      await ecrireParametre(PARAM_SOUS_TITRES_MINIMAL_IV, faux as never);
      const outils = await outilsImageVideo({ videoId: "v-minimal", travailId: "t-minimal", production: false, lireImageSource: async () => null });
      await outils.rendre(d);
      expect(recu.outils).not.toHaveProperty("sousTitresMinimal");
    }
    const allume = await chemin(true);
    expect(allume.o).toMatchObject({ sousTitresMinimal: true });
    const longs = eteintAbsent.texte.sousTitres.segments.filter((g) => g.mots.length > 3);
    expect(longs.length).toBeGreaterThan(0); // éteint : les lignes longues d'aujourd'hui, inchangées
    expect(eteintAbsent.texte.sousTitres.segments.map((g) => g.id)).toEqual(sousTitresVariesIV(d.ligne, d.styleSousTitres).map((g) => g.id));
    const groupes = allume.texte.sousTitres.segments;
    expect(groupes.length).toBeGreaterThan(0);
    expect(groupes.every((g) => g.mots.length >= 1 && g.mots.length <= 3)).toBe(true);
    // La base montée à la main avec l'option donne les mêmes groupes que la demande réellement envoyée.
    expect(groupes.map((g) => g.id)).toEqual(baseDuMontageIV(d, [], { minimal: true }).segments.map((g) => g.id));
  });

  it.skipIf(!AVEC_RENDU)("(d) rendu « par instants » (texte-instants) et CalqueSousTitres : jamais plus de 3 mots à l'écran ; éteint : lignes longues", async () => {
    const d = demandeReelle();
    reinitialiserDepots();
    await ecrireParametre(PARAM_SOUS_TITRES_MINIMAL_IV, true);
    const outils = await outilsImageVideo({ videoId: "v-minimal", travailId: "t-minimal", production: false, lireImageSource: async () => null });
    await outils.rendre(d);
    const o = recu.outils as Parameters<typeof demandeMontageIV>[1];
    const demande = await demandeMontageIV(d, { ...outilsDeBase, rendu: o.rendu, sousTitresMinimal: o.sousTitresMinimal });
    const texte = (demande.parametres as unknown as { texte: Parameters<typeof instantsTexte>[0] }).texte;
    const eteint = await demandeMontageIV(d, { ...outilsDeBase, rendu: o.rendu });
    const texteEteint = (eteint.parametres as unknown as { texte: Parameters<typeof instantsTexte>[0] }).texte;

    const { sceneAuTemps } = await import("@/briques/sous-titres/scene");
    const nbMots = (t: Parameters<typeof instantsTexte>[0], s: number) => sceneAuTemps(t.sousTitres!, s)?.mots.length ?? 0;
    // Instants réellement dessinés par le rendu par instants (une image par état) : jamais plus de 3 mots.
    const { instants, durees } = instantsTexte(texte);
    expect(durees.reduce((a, b) => a + b, 0)).toBe(texte.images);
    expect(Math.max(...instants.map((s) => nbMots(texte, s)))).toBeLessThanOrEqual(3);
    expect(Math.max(...instants.map((s) => nbMots(texte, s)))).toBeGreaterThanOrEqual(1);
    const eteintInstants = instantsTexte(texteEteint).instants;
    expect(Math.max(...eteintInstants.map((s) => nbMots(texteEteint, s)))).toBeGreaterThan(3);
    // Le rendu par instants suit bien les groupes : les images dessinées ne sont pas celles du réglage éteint.
    expect(instants).not.toEqual(eteintInstants);

    // CalqueSousTitres (rendu statique) au milieu du 1er groupe : ≤ 3 mots dessinés.
    const premier = texte.sousTitres!.segments[0];
    const milieu = (premier.debutSec + premier.finSec) / 2;
    const chem = (c: string) => `../../studio-rendu/compositions/${c}`;
    const { CalqueSousTitres } = (await import(/* @vite-ignore */ chem("sous-titres/CalqueSousTitres"))) as { CalqueSousTitres: (p: { donnees: unknown; instantSec?: number }) => unknown };
    // @ts-expect-error le react de studio-rendu n'a pas de types ici
    const { createElement } = (await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
    // @ts-expect-error le react de studio-rendu n'a pas de types ici
    const { renderToStaticMarkup } = (await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server");
    const html = renderToStaticMarkup(createElement(CalqueSousTitres as never, { donnees: texte.sousTitres, instantSec: milieu } as never));
    const attendus = premier.mots.map((m) => m.mot);
    expect(attendus.length).toBeLessThanOrEqual(3);
    for (const m of attendus) expect(html).toContain(m.replace(/&/g, "&amp;"));
    const suivant = texte.sousTitres!.segments.find((g) => g.debutSec >= premier.finSec)!;
    expect(html).not.toContain(`>${suivant.mots[suivant.mots.length - 1].mot}<`);
  });
});
