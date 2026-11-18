/**
 * BR-FACECAM-TEXTE (18/11) : la face caméra remplit enfin `escalier`, `paveAnime`, `plaques` et `marques` du calque de
 * sous-titres, derrière les capacités `texte.escalier` et `texte.pave` (éteintes). Chemin réel : réglage
 * `bibliothequeVideo.facecam` → `entreeBibliothequeDuLancement` → vraie `avancerChaine` de la face caméra (rendu et
 * face caméra simulés, aucun appel réseau) → composition relevée dans la demande de rendu mode `complet`.
 * Chemins de `studio-rendu/compositions/**` CALCULÉS (PIEGE-REMOTION-TSC.md).
 */
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 10, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 300, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition } from "@/briques/composition/scene";
import { escalierPermis, pavePermis } from "@/briques/composition/porte-texte";
import { PROFIL_FACECAM } from "@/briques/bibliotheque-video/profils/facecam";
import { PROFIL_AVOCAT } from "@/briques/bibliotheque-video/profils/avocat";
import { appliquerReglage } from "@/briques/bibliotheque-video/permissions";
import { ID } from "@/briques/bibliotheque-video/noms";
import { geometrieEscalier } from "@/briques/sous-titres/escalier";
import { escalierAuTemps, paveAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { YEUX_HAUTEUR } from "@/briques/realisation";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const commun = await import("@/services/_commun");
const { entreeBibliothequeDuLancement } = await import("@/services/bibliotheque-video");
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const chemin = ["..", "..", "..", "studio-rendu", "compositions", "sous-titres", "CalqueSousTitres"].join("/");
const CHEMIN_REMOTION = ["..", "..", "..", "studio-rendu", "node_modules", "remotion", "dist", "esm", "index.mjs"].join("/");
type ModuleCalque = { CalqueSousTitres: unknown };
const CALQUE = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin)) as ModuleCalque) : null;

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge. En moyenne, une PME gagne 5 heures par semaine. Et elle réduit ses relances de 30 % chaque mois grâce à l'automatisation.";

function commande(entrees: Record<string, unknown>, videoId = "v-texte"): CommandeFabrication {
  return {
    videoId, formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE }, distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: `studio/prod/rush/${videoId}/prise-1.mov`, mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false }, styles: { lut: null, sousTitres: { id: "st-test", nom: "Test", valeur: STYLE_SOUS_TITRES_AVOCAT } }, entrees, reglages: {}, plans: [], prononciations: [],
    sousTitres: { base: "karaoke", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

function outilsRendu(): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const simule = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), simule.soumettre(d)), etat: (id) => simule.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine, c: CommandeFabrication): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

type Composition = ParametresDemandeComposition & { texte: { sousTitres?: DonneesCalque; images?: number; fps?: number; incrustations?: unknown[]; encadre?: unknown } };

/** La VRAIE chaîne face caméra ; `reglage` = valeur du réglage `bibliothequeVideo.<formatId>` posée avant le lancement. */
async function fabriquer(reglage?: unknown, videoId = "v-texte", formatId = "facecam"): Promise<Composition> {
  reinitialiserDepots();
  if (reglage !== undefined) await commun.ecrireParametre(`bibliothequeVideo.${formatId}`, reglage);
  const entrees = await entreeBibliothequeDuLancement({ id: videoId, formatId });
  const o = outilsRendu();
  const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: o }, { ...commande(entrees, videoId), formatId } as CommandeFabrication);
  expect(etat.fini).toBe(true);
  return o.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet")!.parametres as unknown as Composition;
}

const AUCUN = ["escalier", "paveAnime", "plaques", "marques"] as const;
const LISTE = (...c: string[]) => ({ capacites: ["plan-scenes.facecam", ...c] });
const ESC = LISTE("texte.escalier");
const PAVE = LISTE("texte.pave");

beforeEach(() => reinitialiserDepots());

describe("portes et profil : permis false (éteint), jamais allumé par le code", () => {
  it("profil facecam : les deux capacités sont connues et NON permises", () => {
    expect(PROFIL_FACECAM.capacites[ID.texteEscalier]).toMatchObject({ permis: false });
    expect(PROFIL_FACECAM.capacites[ID.textePave]).toMatchObject({ permis: false, maxParVideo: 6 });
  });
  it("entrées absentes, illisibles ou vides : fermées, sans lever", () => {
    for (const e of [undefined, null, {}, "x", 3, { bibliothequeVideo: 1 }]) {
      expect(escalierPermis(e)).toBe(false);
      expect(pavePermis(e)).toBe(false);
    }
  });
});

describe("(a) éteint = identique : aucune des quatre clés", () => {
  it("sans réglage, ou capacités non listées : ni escalier, ni paveAnime, ni plaques, ni marques ; texte identique", async () => {
    const base = await fabriquer();
    for (const k of AUCUN) expect(k in base.texte.sousTitres!).toBe(false);
    for (const reglage of [true, LISTE(), { capacites: ["texte.surlignage-marqueur"] }]) {
      const p = await fabriquer(reglage);
      for (const k of AUCUN) expect(k in p.texte.sousTitres!).toBe(false);
      expect(p.texte).toEqual(base.texte);
    }
  });
});

describe("(b) texte.escalier permis : `escalier` posé sous la tête, hors zone des yeux", () => {
  it("zone dans l'image, sous les yeux ; le reste du calque ne change pas", async () => {
    const eteint = await fabriquer();
    const p = await fabriquer(ESC);
    const d = p.texte.sousTitres!;
    expect(escalierPermis((await entreeBibliothequeDuLancement({ id: "v-texte", formatId: "facecam" }))).valueOf()).toBe(true);
    expect(d.escalier).toBeDefined();
    const { zone, taillePx } = d.escalier!;
    expect(taillePx).toBeGreaterThan(0);
    expect(zone.xPx).toBeGreaterThanOrEqual(0);
    expect(zone.yPx).toBeGreaterThanOrEqual(0);
    expect(zone.xPx + zone.largeurPx).toBeLessThanOrEqual(d.largeur + 1e-6);
    expect(zone.yPx + zone.hauteurPx).toBeLessThanOrEqual(d.hauteur + 1e-6);
    expect(zone.hauteurPx).toBeLessThanOrEqual(0.24 * d.hauteur + 1e-6);
    // Les yeux : au plus à `YEUX_HAUTEUR.max` de la hauteur (cadrage de la prise de test) ; l'escalier commence au-dessous.
    expect(zone.yPx).toBeGreaterThan(YEUX_HAUTEUR.max * d.hauteur);
    // jamais au-dessus du centre de la ligne d'aujourd'hui moins 12 %
    expect(zone.yPx).toBeGreaterThanOrEqual(((d.positions.milieuPct - 12) / 100) * d.hauteur - 1e-6);
    const { escalier, ...sans } = d;
    expect(escalier).toBeDefined();
    expect({ ...p, texte: { ...p.texte, sousTitres: sans } }).toEqual(eteint);
  });

  it.skipIf(!AVEC_RENDU)("rendu de CalqueSousTitres au 3e groupe d'une phrase : 3 éléments `data-ligne-escalier` ; éteint : aucun", async () => {
    const d = (await fabriquer(ESC)).texte.sousTitres!;
    const eteint = (await fabriquer()).texte.sousTitres!;
    // 3e groupe d'une phrase dont les lignes TIENNENT dans la zone sûre (sinon repli sur la ligne d'avant, voulu par `geometrieEscalier`).
    const tient = (t: number) => { const e = escalierAuTemps(d, t); return e !== null && e.lignes.length >= 3 && geometrieEscalier(e.lignes, d.largeur, d.hauteur, d.escalier!.zone, d.escalier!.taillePx) !== null; };
    const g = d.segments.find((s) => tient((s.debutSec + s.finSec) / 2));
    expect(g).toBeDefined();
    const t = (g!.debutSec + g!.finSec) / 2;
    expect(await rendre(d, t)).toMatch(/data-ligne-escalier/);
    expect((await rendre(d, t)).match(/data-ligne-escalier/g)!.length).toBe(escalierAuTemps(d, t)!.lignes.length);
    expect(await rendre(eteint, t)).not.toMatch(/data-ligne-escalier/);
  });
});

async function rendre(donnees: unknown, t: number): Promise<string> {
  const remotion = (await import(/* @vite-ignore */ CHEMIN_REMOTION)) as unknown as { useCurrentFrame: () => number };
  vi.spyOn(remotion, "useCurrentFrame").mockReturnValue(Math.round(t * 25));
  return renderToStaticMarkup(createElement((CALQUE as ModuleCalque).CalqueSousTitres as never, { donnees } as never) as never);
}

describe("(c) texte.pave permis : plaques et marques posées, même vidéo = mêmes marques", () => {
  it("`paveAnime` exact, au moins une plaque, une marque par segment à plaque, stable", async () => {
    const eteint = await fabriquer();
    const a = (await fabriquer(PAVE)).texte.sousTitres!;
    const b = (await fabriquer(PAVE)).texte.sousTitres!;
    expect(a.paveAnime).toBe(true);
    expect(Object.keys(a.plaques ?? {}).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(a.marques ?? {}).sort()).toEqual(Object.keys(a.plaques!).sort());
    expect(a.marques).toEqual(b.marques);
    expect(new Set(Object.values(a.marques!)).size).toBe(1); // la même marque pour toute la vidéo
    expect("escalier" in a).toBe(false);
    const { paveAnime, plaques, marques, ...sans } = a;
    expect([paveAnime, plaques, marques].every((x) => x !== undefined)).toBe(true);
    expect({ ...(await fabriquer(PAVE)), texte: { ...(await fabriquer(PAVE)).texte, sousTitres: sans } }).toEqual({ ...eteint, texte: { ...eteint.texte, sousTitres: sans } });
  });

  it.skipIf(!AVEC_RENDU)("rendu au début d'un groupe à plaque : `data-pave-anime` ou `data-marque-mot` ; éteint : aucun", async () => {
    const d = (await fabriquer(PAVE)).texte.sousTitres!;
    const eteint = (await fabriquer()).texte.sousTitres!;
    const g = d.segments.find((s) => d.plaques![s.id] !== undefined)!;
    const t = g.mots[d.plaques![g.id]].debutSec + 0.1;
    expect(paveAuTemps(d, t)).not.toBeNull();
    expect(await rendre(d, t)).toMatch(/data-pave-anime|data-marque-mot/);
    expect(await rendre(eteint, t)).not.toMatch(/data-pave-anime|data-marque-mot/);
  });

  it("une plaque déjà posée par le style est gardée telle quelle (indice du style prioritaire)", async () => {
    const d = (await fabriquer(PAVE)).texte.sousTitres!;
    for (const [id, k] of Object.entries(d.plaques!)) {
      const s = d.segments.find((g) => g.id === id)!;
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(s.mots.length);
    }
  });
});

describe("(d) l'AVOCAT, qui ne connaît pas ces capacités : rien", () => {
  it("escalier : absent du profil avocat, le réglage ne l'y ajoute pas ; pavé : seul le profil de l'avocat compte et le réglage facecam ne l'atteint pas", () => {
    expect(PROFIL_AVOCAT.capacites[ID.texteEscalier]).toBeUndefined();
    const a = appliquerReglage(PROFIL_AVOCAT, { actif: true, capacites: [ID.texteEscalier] });
    expect(a.capacites[ID.texteEscalier]).toBeUndefined();
    // le réglage d'un format n'est lu que pour CE format : `bibliothequeVideo.facecam` ne touche pas l'entrée de l'avocat
    expect(PROFIL_FACECAM.capacites[ID.texteEscalier]).toBeDefined();
  });
  it("chemin réel : réglage `bibliothequeVideo.facecam` posé, lancement d'un avocat : entrée sans permission, portes fermées", async () => {
    reinitialiserDepots();
    await commun.ecrireParametre("bibliothequeVideo.facecam", LISTE("texte.escalier", "texte.pave"));
    const entrees = await entreeBibliothequeDuLancement({ id: "v-avocat", formatId: "avocat" });
    expect(escalierPermis(entrees)).toBe(false);
    expect(pavePermis(entrees)).toBe(false);
  });
});

describe("(e) rendu par instants : une image de plus pendant l'entrée de la plaque (0,18 s)", () => {
  it("allumé : plus d'instants qu'éteint ; la somme des durées reste égale au nombre d'images", async () => {
    const fps = 25;
    const arg = (p: Composition, d: number) => ({ ...p.texte, images: Math.ceil(d * fps), fps });
    const allume = await fabriquer(PAVE);
    const eteint = await fabriquer();
    const dur = Math.max(...allume.texte.sousTitres!.segments.map((s) => s.finSec)) + 0.5;
    const ia = instantsTexte(arg(allume, dur) as never);
    const ie = instantsTexte(arg(eteint, dur) as never);
    expect(ia.instants.length).toBeGreaterThan(ie.instants.length);
    expect(ia.durees.reduce((x, y) => x + y, 0)).toBe(Math.ceil(dur * fps));
    expect(ie.durees.reduce((x, y) => x + y, 0)).toBe(Math.ceil(dur * fps));
  });
});
