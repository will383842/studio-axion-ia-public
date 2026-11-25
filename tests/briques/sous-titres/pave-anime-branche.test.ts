/**
 * BR-PAVE-MARQUES-a : la plaque animée du mot fort (entrée 0,18 s, inclinée de −2°) et sa marque (pinceau, papier déchiré,
 * chevauchement, évidé) sont montées dans `CalqueSousTitres`, pilotées par les champs facultatifs `paveAnime` et `marques`
 * de `DonneesCalque`. Absents : HTML ET instants identiques au caractère près (empreintes figées AVANT le changement,
 * sur master). Le calque texte est rendu PAR INSTANTS : la plaque se lit sur `instantSec`, jamais sur `useCurrentFrame`.
 * Chemin réel : le réglage de lancement passe par `entreeBibliothequeDuLancement` puis `parametresComposition` ; aucun
 * producteur ne remplit encore les champs (BR-FACECAM-TEXTE), donc même capacité listée = propriétés identiques.
 * Rendu statique seulement, aucun réseau. Le rendu se saute si les dépendances de studio-rendu ne sont pas installées.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, SegmentSousTitres as SegmentDomaine } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { parametresComposition } from "@/moteurs/montage-avocat/composition";
import { donneesCalque } from "@/briques/sous-titres";
import { PAVE_ANIM } from "@/briques/sous-titres/pave";
import { paveAuTemps, sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { empreinteTexte, instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  // useCurrentFrame vaut 0 : si le calque lisait l'image au lieu de `instantSec`, la plaque ne bougerait jamais.
  return { ...vrai, useCurrentFrame: () => 0, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 300, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const commun = await import("@/services/_commun");
const { entreeBibliothequeDuLancement } = await import("@/services/bibliotheque-video");
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas cet import (PIEGE-REMOTION-TSC.md).
const chemin = ["..", "..", "..", "studio-rendu", "compositions", "sous-titres", "CalqueSousTitres"].join("/");
const CALQUE = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin)) as { CalqueSousTitres: unknown }) : null;

const seg = (id: string, debut: number, texte: string): SegmentRendu => ({
  id,
  debutSec: debut,
  finSec: debut + 2,
  mots: texte.split(" ").map((mot, i, tous) => ({ mot, debutSec: debut + (2 * i) / tous.length, finSec: debut + (2 * (i + 1)) / tous.length })),
});
const SEGMENTS = [seg("a", 0.5, "Avec HubSpot vos devis"), seg("b", 3, "partent seuls")];
const base = donneesCalque({ segments: SEGMENTS, base: "karaoke", ratio: "9:16" });
const AVEC_PLAQUE: DonneesCalque = { ...base, plaques: { a: 1 } };
const ANIME: DonneesCalque = { ...AVEC_PLAQUE, paveAnime: true };
// « HubSpot » est le mot d'indice 1 du groupe a : dit à 0,5 + 2 × 1/4 = 1 s.
const DEBUT_MOT = 1;
const html = (d: DonneesCalque, t: number) => renderToStaticMarkup(createElement(CALQUE!.CalqueSousTitres as never, { donnees: d, instantSec: t }) as never);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const INSTANTS = [0.2, 0.7, 1.0, 1.05, 1.3, 2.2, 3.4, 5.5];
const FPS = 25;
const sansImage = { encadre: undefined, incrustations: [] as never[] };

/** Empreintes figées sur master AVANT le changement (plaque fixe d'aujourd'hui, champs absents). */
const EMPREINTE_HTML = "ad848b26b2bad7b27f5b316b68f7e337d23c96461d45d16454fd60da5f2476c3"; // CONTOURS-b-v21s : contour V2 seul (trait 6→3 px, ombre 8→10,4 px / 0,65→0,55, taille/gap/padding Impact dérivés)
const EMPREINTE_INSTANTS = "31e81284f297fa22f7233bcdb2b7d40aeeb557aee0838aa71ae348f694c29023";

describe("(a) éteint = identique au caractère près (champs absents)", () => {
  it("instants : la liste des instants rendus est celle d'avant (empreinte figée)", () => {
    const r = instantsTexte({ sousTitres: AVEC_PLAQUE, ...sansImage, images: 8 * FPS, fps: FPS } as never);
    expect(sha(JSON.stringify(r))).toBe(EMPREINTE_INSTANTS);
  });
  it("`paveAuTemps` sans le champ : null, même avec une plaque fixe et un marque posée", () => {
    for (const t of INSTANTS) expect(paveAuTemps(AVEC_PLAQUE, t)).toBeNull();
    expect(paveAuTemps({ ...AVEC_PLAQUE, marques: { a: "pinceau" } }, 1.3)).toBeNull();
  });
  it.skipIf(!AVEC_RENDU)("HTML du calque : celui d'avant (empreinte figée), plaque fixe comprise", () => {
    expect(sha(INSTANTS.map((t) => html(AVEC_PLAQUE, t)).join("\n"))).toBe(EMPREINTE_HTML);
  });
  it.skipIf(!AVEC_RENDU)("`marques` seul (sans `paveAnime`) : HTML identique, rien n'est dessiné", () => {
    const seul = { ...AVEC_PLAQUE, marques: { a: "papier" as const } };
    for (const t of INSTANTS) expect(html(seul, t)).toBe(html(AVEC_PLAQUE, t));
  });
  it("seul `true` exact allume (`paveAnime` à une autre valeur : null)", () => {
    for (const v of [false, 1, "true", undefined]) expect(paveAuTemps({ ...AVEC_PLAQUE, paveAnime: v as never }, 1.3)).toBeNull();
  });
});

describe("`paveAuTemps` (pure)", () => {
  it("groupe sans plaque, avant le mot ou hors groupe : null", () => {
    expect(paveAuTemps(ANIME, 3.4)).toBeNull(); // groupe b : pas de plaque
    expect(paveAuTemps(ANIME, 9)).toBeNull(); // aucun groupe
    expect(paveAuTemps({ ...base, paveAnime: true }, 1.3)).toBeNull(); // aucune plaque choisie
  });
  it("donne la boîte du mot, son début et sa marque", () => {
    const p = paveAuTemps({ ...ANIME, marques: { a: "pinceau" } }, 1.3)!;
    expect(p.debutS).toBeCloseTo(DEBUT_MOT, 6);
    expect(p.texte).toBe("HubSpot");
    expect(p.marque).toBe("pinceau");
    expect(p.boite.largeurPx).toBeGreaterThan(100);
    expect(p.boite.xPx).toBeGreaterThan(0);
    expect(p.boite.xPx + p.boite.largeurPx).toBeLessThan(1080);
    expect(p.boite.hauteurPx).toBeGreaterThan(0);
    expect(p.taillePx).toBe(sceneAuTemps(ANIME, 1.3)!.taillePx);
  });
  it("une plaque sans marque posée : pas de marque", () => {
    expect(paveAuTemps(ANIME, 1.3)!.marque).toBeUndefined();
  });
});

const ECHELLE = /scale\(([\d.]+)\)/;
const ROTATION = /rotate\((-?[\d.]+)deg\)/;
const plaque = (h: string) => h.match(/data-pave-anime="[^"]*"[^>]*style="([^"]*)"/)?.[1] ?? null;

describe.skipIf(!AVEC_RENDU)("(b) plaque animée : entrée inclinée puis posée (lue sur `instantSec`, pas sur l'image)", () => {
  it("avant le mot : pas de plaque dessinée ; la fixe n'est plus dessinée non plus pour ce mot", () => {
    const h = html(ANIME, DEBUT_MOT - 0.1);
    expect(plaque(h)).toBeNull();
    expect(h).not.toBe(html(AVEC_PLAQUE, DEBUT_MOT - 0.1));
  });
  it("à début + 0,05 s : inclinée de −2° et réduite, encore translucide", () => {
    const s = plaque(html(ANIME, DEBUT_MOT + 0.05))!;
    expect(s).not.toBeNull();
    expect(Number(s.match(ROTATION)![1])).toBeCloseTo(PAVE_ANIM.inclinaisonDeg, 6);
    expect(Number(s.match(ECHELLE)![1])).toBeLessThan(0.95);
    expect(Number(s.match(ECHELLE)![1])).toBeGreaterThan(PAVE_ANIM.echelleDepart - 1e-9);
    expect(Number(s.match(/opacity:([\d.]+)/)![1])).toBeLessThan(0.95);
  });
  it("à début + 0,3 s : posée (échelle 1, opaque), toujours inclinée de −2°", () => {
    const s = plaque(html(ANIME, DEBUT_MOT + 0.3))!;
    expect(Number(s.match(ECHELLE)![1])).toBe(1);
    expect(Number(s.match(ROTATION)![1])).toBeCloseTo(PAVE_ANIM.inclinaisonDeg, 6);
    expect(Number(s.match(/opacity:([\d.]+)/)![1])).toBe(1);
  });
  it("le rendu suit l'instant reçu : deux instants de l'entrée donnent deux dessins différents (useCurrentFrame figé à 0)", () => {
    expect(html(ANIME, DEBUT_MOT + 0.04)).not.toBe(html(ANIME, DEBUT_MOT + 0.1));
  });
});

describe("(b') rendu PAR INSTANTS : une image rendue par état pendant l'entrée", () => {
  it("≥ 3 instants distincts dans [début, début + 0,18 s[ ; éteint : au plus 1 ; empreinte stable une fois posée", () => {
    const arg = (d: DonneesCalque) => ({ sousTitres: d, ...sansImage, images: 8 * FPS, fps: FPS }) as never;
    const dans = (r: { instants: number[] }) => r.instants.filter((t) => t >= DEBUT_MOT - 1e-9 && t < DEBUT_MOT + PAVE_ANIM.dureeEntreeS - 1e-9);
    const allume = instantsTexte(arg(ANIME));
    const eteint = instantsTexte(arg(AVEC_PLAQUE));
    expect(new Set(dans(allume)).size).toBeGreaterThanOrEqual(3);
    expect(dans(eteint).length).toBeLessThanOrEqual(1);
    expect(allume.durees.reduce((a, b) => a + b, 0)).toBe(8 * FPS);
    const p = ANIME;
    expect(empreinteTexte({ sousTitres: p, ...sansImage } as never, DEBUT_MOT + 0.04)).not.toBe(empreinteTexte({ sousTitres: p, ...sansImage } as never, DEBUT_MOT + 0.12));
    expect(empreinteTexte({ sousTitres: p, ...sansImage } as never, DEBUT_MOT + 0.3)).toBe(empreinteTexte({ sousTitres: p, ...sansImage } as never, DEBUT_MOT + 0.4));
  });
});

describe.skipIf(!AVEC_RENDU)("(c) marque : l'élément de marque est présent", () => {
  it("pinceau et papier : un tracé ; chevauche : plaque décalée ; évidé : contour seul ; sans marque : aucun élément de marque", () => {
    const h = (m?: "pinceau" | "papier" | "chevauche" | "evide") => html({ ...ANIME, ...(m ? { marques: { a: m } } : {}) }, DEBUT_MOT + 0.3);
    expect(h()).not.toMatch(/data-marque-mot/);
    for (const m of ["pinceau", "papier"] as const) expect(h(m)).toMatch(new RegExp(`data-marque-mot="${m}"[^>]*>\\s*<path d="M`));
    expect(h("chevauche")).toMatch(/data-marque-mot="chevauche"/);
    expect(h("evide")).toMatch(/data-marque-mot="evide"[^>]*style="[^"]*border:[^"]*solid/);
  });
  it("la marque est fixe pour une graine : même HTML deux fois", () => {
    const d = { ...ANIME, marques: { a: "papier" as const } };
    expect(html(d, DEBUT_MOT + 0.3)).toBe(html(d, DEBUT_MOT + 0.3));
  });
});

// ── Chemin RÉEL de fabrication (avocat) : la capacité `texte.pave` listée ne remplit aucun champ (BR-FACECAM-TEXTE le fera).
const CLE = "bibliothequeVideo.avocat";
const MAINTENANT = "2026-11-17T08:00:00.000Z";
const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
function commande(entrees: Record<string, unknown>): CommandeFabrication {
  return {
    versionContrat: 2, moteurId: "montage-avocat", videoId: "v-test", formatId: "avocat", versionFormat: 2, profilRenduVersion: 1,
    dureeCibleSec: 12, ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "accroche", segments: [{ id: "s1", texte: "Avec HubSpot et Zapier vos devis partent seuls" }] }], texteComplet: "Avec HubSpot et Zapier vos devis partent seuls" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: null,
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees, reglages: {}, plans: [], prononciations: [], mentionIA: { active: false } as never, budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme, profilRendu: formatAvocat.profilRendu, recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT, sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: { "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" } },
  } as CommandeFabrication;
}
const mot = (m: string, d: number) => ({ mot: m, debutSec: d, finSec: d + 0.3 });
const SEGMENTS_REELS: SegmentDomaine[] = [
  { id: "g1", debutSec: 0.5, finSec: 2.5, mots: [mot("Avec", 0.5), mot("HubSpot", 1.2), mot("vos", 1.7), mot("devis", 2)] },
  { id: "g2", debutSec: 3, finSec: 5, mots: [mot("et", 3), mot("Zapier", 3.4), mot("partent", 4), mot("seuls", 4.5)] },
];
const PLANS = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];
const composer = (c: CommandeFabrication) => parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: SEGMENTS_REELS, dureeSec: 12 });
async function entrees(reglage?: unknown) {
  if (reglage !== undefined) await commun.ecrireParametre(CLE, reglage);
  return entreeBibliothequeDuLancement({ id: "v-test", formatId: "avocat" });
}
beforeEach(() => { reinitialiserDepots(); });

describe("(d) chemin réel de fabrication : éteint par défaut, rien ne remplit les champs ici", () => {
  it("réglage `false`, `true`, ou capacité `texte.pave` listée : aucune clé `paveAnime` ni `marques`, propriétés identiques", async () => {
    const eteint = composer(commande({}));
    for (const reglage of [false, true, { capacites: ["texte.pave"] }, { capacites: ["texte.pave", "texte.escalier"] }]) {
      reinitialiserDepots();
      const p = composer(commande(await entrees(reglage)));
      expect("paveAnime" in p.texte.sousTitres!).toBe(false);
      expect("marques" in p.texte.sousTitres!).toBe(false);
      expect(p.texte).toEqual(eteint.texte);
    }
  });
  it("réglage absent (avocat allumé par défaut, ALLUMER-BIBLIO-DEFAUTS-v20g) : toujours aucune clé `paveAnime` ni `marques`", async () => {
    reinitialiserDepots();
    const p = composer(commande(await entrees(undefined)));
    expect("paveAnime" in p.texte.sousTitres!).toBe(false);
    expect("marques" in p.texte.sousTitres!).toBe(false);
  });
  it("sur ces propriétés fabriquées : `paveAuTemps` null à chaque instant, instants rendus identiques à ceux d'une scène sans les champs", async () => {
    const p = composer(commande(await entrees({ capacites: ["texte.pave"] })));
    const d = p.texte.sousTitres!;
    for (let t = 0; t < 7; t += 0.04) expect(paveAuTemps(d, t)).toBeNull();
    const eteint = composer(commande({})).texte;
    expect(instantsTexte({ ...p.texte, images: 12 * FPS, fps: FPS } as never)).toEqual(instantsTexte({ ...eteint, images: 12 * FPS, fps: FPS } as never));
    // contrôle positif : la même propriété fabriquée AVEC les champs posés à la main fait bien bouger l'empreinte (la garde n'est pas vide)
    const avec = { ...d, plaques: { g1: 1 }, paveAnime: true as const };
    const un = empreinteTexte({ ...p.texte, sousTitres: avec } as never, 1.25);
    const deux = empreinteTexte({ ...p.texte, sousTitres: avec } as never, 1.45);
    expect(un).not.toBe(deux);
  });
  it.skipIf(!AVEC_RENDU)("HTML du calque fabriqué : identique avec ou sans la capacité listée, à 60 instants", async () => {
    const sans = composer(commande({})).texte.sousTitres!;
    const avec = composer(commande(await entrees({ capacites: ["texte.pave"] }))).texte.sousTitres!;
    for (let i = 0; i < 60; i++) expect(html(avec, i * 0.1)).toBe(html(sans, i * 0.1));
  });
});
