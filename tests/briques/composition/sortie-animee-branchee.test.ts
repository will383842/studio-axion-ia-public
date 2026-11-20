/**
 * BR-SORTIE-ANIMEE (18/11) : la sortie animée des groupes de sous-titres (fondu 0,2 s + glissement de 16 px, sans rebond)
 * est BRANCHÉE à la fabrication de l'avocat. Le réglage part du vrai chemin de lancement (`bibliothequeVideo.avocat` →
 * `entreeBibliothequeDuLancement`), puis `parametresComposition` (appelé par `montage-avocat/index.ts`) pose le champ
 * `sortie` ; `sceneAuTemps`, le rendu « par instants » (`instantsTexte` : une image par état, recopiée par FFmpeg) et le
 * rendu de `CalqueSousTitres` le lisent. Éteint (réglage absent ou capacité non listée) = propriétés identiques, aucune clé neuve.
 */
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { parametresComposition } from "@/moteurs/montage-avocat/composition";
import { sortieAnimeePermise } from "@/briques/composition/porte-texte";
import { SORTIE_PAR_DEFAUT } from "@/briques/sous-titres/sortie";
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import { empreinteTexte, instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { parametresComposition as parametresCommun, type RecetteComposition } from "@/briques/composition";
import { RECETTE_COMPOSITION_CAS_CONCRET } from "@/moteurs/montage-cas-concret/fabriquer";
import { RECETTE_COMPOSITION_TABLEAU } from "@/moteurs/montage-tableau/fabriquer";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { PROFIL_AVOCAT } from "@/briques/bibliotheque-video/profils/avocat";
import { ID } from "@/briques/bibliotheque-video/noms";

// Le rendu de studio-rendu ne se charge que si ses dépendances sont installées ; chemins CALCULÉS (PIEGE-REMOTION-TSC.md).
const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => 10, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 300, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

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
const SEGMENTS: SegmentSousTitres[] = [
  { id: "g1", debutSec: 0.5, finSec: 2.5, mots: [mot("Avec", 0.5), mot("HubSpot", 1.2), mot("vos", 1.7), mot("devis", 2)] },
  { id: "g2", debutSec: 3, finSec: 5, mots: [mot("et", 3), mot("Zapier", 3.4), mot("partent", 4), mot("seuls", 4.5)] },
  { id: "g3", debutSec: 5.5, finSec: 7, mots: [mot("HubSpot", 5.6), mot("encore", 6.2)] },
];
const PLANS = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];
const composer = (c: CommandeFabrication) => parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 12 });

async function entreesDuLancement(reglage?: unknown) {
  if (reglage !== undefined) await commun.ecrireParametre(CLE, reglage);
  return entreeBibliothequeDuLancement({ id: "v-test", formatId: "avocat" });
}

beforeEach(() => { reinitialiserDepots(); });

describe("porte : la capacité est connue du profil avocat mais éteinte", () => {
  it("profil : permis false", () => {
    expect(PROFIL_AVOCAT.capacites[ID.texteSortieAnimee]).toMatchObject({ permis: false });
  });
  it("entrées absentes, illisibles ou vides : fermée, sans lever", () => {
    for (const e of [undefined, null, {}, "x", 3, { bibliothequeVideo: 1 }]) expect(sortieAnimeePermise(e)).toBe(false);
  });
});

const REGLAGE = { capacites: ["texte.sortie-animee"] };
const fin = SEGMENTS[0].finSec;

describe("(a) éteint : réglage absent = pas de `sortie`, le groupe disparaît net", () => {
  it("pas d'entrée bibliothèque", async () => {
    const entrees = await entreesDuLancement(false); // v20g : avocat allumé par défaut, `false` écrit en base
    expect(entrees).toEqual({});
    const p = composer(commande(entrees));
    expect("sortie" in p.texte.sousTitres!).toBe(false);
    expect(sceneAuTemps(p.texte.sousTitres!, fin + 0.1)).toBeNull();
    expect(p).toEqual(composer(commande({})));
  });
  it("entrée présente mais capacité non listée : identique", async () => {
    for (const reglage of [true, { capacites: ["texte.surlignage-marqueur"] }]) {
      reinitialiserDepots();
      const entrees = await entreesDuLancement(reglage);
      expect(sortieAnimeePermise(entrees)).toBe(false);
      const p = composer(commande(entrees));
      expect("sortie" in p.texte.sousTitres!).toBe(false);
      expect(p.texte).toEqual(composer(commande({})).texte);
    }
  });
});

describe("(b) allumé par le réglage, via le chemin de lancement", () => {
  it("`sortie` = SORTIE_PAR_DEFAUT ; fin + 0,1 s : élément estompé et décalé ; fin + 0,25 s : plus rien", async () => {
    const entrees = await entreesDuLancement(REGLAGE);
    expect(sortieAnimeePermise(entrees)).toBe(true);
    const d = composer(commande(entrees)).texte.sousTitres!;
    expect(d.sortie).toEqual(SORTIE_PAR_DEFAUT);
    const el = sceneAuTemps(d, fin + 0.1)!;
    expect(el).not.toBeNull();
    expect(el.opacite).toBeGreaterThan(0);
    expect(el.opacite).toBeLessThan(1);
    expect(el.decalageYPx).toBeGreaterThan(0);
    expect(sceneAuTemps(d, fin + 0.25)).toBeNull();
  });
  it("le reste de la composition ne change pas (seule la clé `sortie` s'ajoute)", async () => {
    const eteint = composer(commande({}));
    const allume = composer(commande(await entreesDuLancement(REGLAGE)));
    const { sortie, ...sans } = allume.texte.sousTitres!;
    expect(sortie).toBeDefined();
    expect({ ...allume, texte: { ...allume.texte, sousTitres: sans } }).toEqual(eteint);
  });
  it("sans sous-titres : rien", async () => {
    const c = commande(await entreesDuLancement(REGLAGE));
    expect(composer({ ...c, briques: { ...c.briques, "sous-titres": false } }).texte.sousTitres).toBeUndefined();
  });
});

describe("(b') rendu PAR INSTANTS (texte-instants : une image par état, recopiée par FFmpeg)", () => {
  it("allumé : les images de la fenêtre [fin, fin + 0,2 s[ ont chacune leur état (fondu visible) ; éteint : un seul saut net", async () => {
    const fps = 25;
    const arg = (p: ReturnType<typeof composer>) => ({ ...p.texte, images: 12 * fps, fps });
    const allume = composer(commande(await entreesDuLancement(REGLAGE)));
    const eteint = composer(commande({}));
    const ia = instantsTexte(arg(allume) as never);
    const ie = instantsTexte(arg(eteint) as never);
    const dansFenetre = (i: { instants: number[] }) => i.instants.filter((t) => t >= fin - 1e-9 && t < fin + 0.2 - 1e-9);
    expect(dansFenetre(ia).length).toBeGreaterThanOrEqual(4);
    expect(dansFenetre(ie).length).toBeLessThanOrEqual(1);
    expect(ia.durees.reduce((a, b) => a + b, 0)).toBe(12 * fps);
    expect(ie.durees.reduce((a, b) => a + b, 0)).toBe(12 * fps);
    // l'empreinte d'une image de la fenêtre n'est pas celle de la page vide d'après
    expect(empreinteTexte(allume.texte as never, fin + 0.1)).not.toBe(empreinteTexte(allume.texte as never, fin + 0.3));
    expect(empreinteTexte(eteint.texte as never, fin + 0.1)).toBe(empreinteTexte(eteint.texte as never, fin + 0.3));
  });
});

describe("(c) autres formats : même capacité listée pour EUX, rien ne change (isolement par générateur, chemin réel)", () => {
  // CORRECTION 18/11 (relecture Opus, point 1) : le réglage `bibliothequeVideo.<format>` est posé, l'entrée passe par le vrai
  // `entreeBibliothequeDuLancement`, puis `parametresComposition` reçoit la recette RÉELLE du générateur.
  const FORMATS: Array<[string, RecetteComposition]> = [
    ["cas-concret", RECETTE_COMPOSITION_CAS_CONCRET],
    ["tableau-anime", RECETTE_COMPOSITION_TABLEAU],
    ["facecam-animee", RECETTE_COMPOSITION_FACECAM], // facecam-animee n'a pas de recette propre : la recette face caméra est la seule du dépôt
    ["facecam", RECETTE_COMPOSITION_FACECAM],
  ];
  for (const [formatId, recette] of FORMATS) {
    it(`${formatId} : capacité listée → pas de clé \`sortie\`, texte identique à « sans réglage »`, async () => {
      reinitialiserDepots();
      await commun.ecrireParametre(`bibliothequeVideo.${formatId}`, REGLAGE);
      const entrees = await entreeBibliothequeDuLancement({ id: "v-test", formatId });
      expect(sortieAnimeePermise(entrees)).toBe(false);
      const pose = (e: Record<string, unknown>) => parametresCommun({ ...commande(e), formatId, moteurId: `montage-${formatId}` } as CommandeFabrication, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 12 }, recette);
      const p = pose(entrees);
      expect("sortie" in p.texte.sousTitres!).toBe(false);
      expect(sceneAuTemps(p.texte.sousTitres!, fin + 0.1)).toBeNull();
      expect(p.texte).toEqual(pose({}).texte);
    });
  }
  it("aucun `sortie:` posé sur un calque ailleurs que parametres.ts (src/** ET studio-rendu/**)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const marche = (d: string): string[] => readdirSync(d).flatMap((f) => (f === "node_modules" ? [] : statSync(join(d, f)).isDirectory() ? marche(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));
    const fichiers = [...marche("src"), ...marche("studio-rendu/src"), ...marche("studio-rendu/compositions")];
    const motif = /\bsortie\s*:\s*(SORTIE_PAR_DEFAUT|\{\s*dureeSec)/;
    const poseurs = fichiers.filter((f) => motif.test(readFileSync(f, "utf8")) && !f.endsWith("sous-titres/sortie.ts") && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
    expect(poseurs).toEqual(["src/briques/composition/parametres.ts"]);
  });
});

describe.skipIf(!AVEC_RENDU)("(d) rendu de CalqueSousTitres", () => {
  it("fin + 0,1 s : le texte du groupe est présent avec une opacité < 1 ; éteint : absent", async () => {
    const rendre = async (donnees: unknown, t: number) => {
      const remotion = (await import(/* @vite-ignore */ CHEMIN_REMOTION)) as unknown as { useCurrentFrame: () => number };
      vi.spyOn(remotion, "useCurrentFrame").mockReturnValue(Math.round(t * 25));
      return renderToStaticMarkup(createElement((CALQUE as ModuleCalque).CalqueSousTitres as never, { donnees } as never) as never);
    };
    const allume = composer(commande(await entreesDuLancement(REGLAGE))).texte.sousTitres!;
    const eteint = composer(commande({})).texte.sousTitres!;
    const html = await rendre(allume, fin + 0.1);
    expect(html).toContain("devis");
    const op = [...html.matchAll(/opacity:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(op.some((o) => o > 0 && o < 1)).toBe(true);
    expect(await rendre(eteint, fin + 0.1)).not.toContain("devis");
    expect(await rendre(allume, fin + 0.5)).not.toContain("devis");
  });
});
