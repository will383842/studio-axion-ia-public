/**
 * BR-ETIQUETTES-OUTIL (17/11) : l'étiquette « HUBSPOT », « ZAPIER » (texte seul, sans logo) est BRANCHÉE à la fabrication
 * de l'avocat. Le réglage part du vrai chemin de lancement (`bibliothequeVideo.avocat` → `entreeBibliothequeDuLancement`,
 * la fonction qui remplit `commande.entrees` dans `src/services/fabrication.ts`), puis `parametresComposition` (appelé par
 * `montage-avocat/index.ts`) ; le rendu de `CalqueSousTitres` montre l'étiquette à l'instant attendu.
 * Éteint (réglage absent, ou capacité non listée) = propriétés de composition identiques, aucune clé neuve.
 */
import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { parametresComposition } from "@/moteurs/montage-avocat/composition";
import { etiquettesOutilPermises } from "@/briques/composition/porte-texte";
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
  it("profil : permis false, 3 au plus", () => {
    expect(PROFIL_AVOCAT.capacites[ID.texteNomOutilAutonome]).toMatchObject({ permis: false, maxParVideo: 3 });
  });
  it("entrées absentes, illisibles ou vides : fermée, sans lever", () => {
    for (const e of [undefined, null, {}, "x", 3, { bibliothequeVideo: 1 }]) expect(etiquettesOutilPermises(e)).toBe(false);
  });
});

describe("(a) éteint : réglage absent = composition identique, aucune clé neuve", () => {
  it("pas d'entrée bibliothèque", async () => {
    const entrees = await entreesDuLancement(false); // v20g : avocat allumé par défaut, `false` écrit en base
    expect(entrees).toEqual({});
    const p = composer(commande(entrees));
    expect(p.texte.sousTitres).toBeDefined();
    expect("etiquettesOutils" in p.texte.sousTitres!).toBe(false);
    expect(p).toEqual(composer(commande({})));
  });
});

describe("(c) profil seul : entrée présente, capacité non listée = aucune étiquette", () => {
  it.each([["true", true], ["autre capacité", { capacites: ["texte.surlignage-marqueur"] }]])("%s", async (_n, reglage) => {
    const entrees = await entreesDuLancement(reglage);
    expect(Object.keys(entrees)).toEqual(["bibliothequeVideo"]);
    expect(etiquettesOutilPermises(entrees)).toBe(false);
    const p = composer(commande(entrees));
    expect("etiquettesOutils" in p.texte.sousTitres!).toBe(false);
    expect(p.texte).toEqual(composer(commande({})).texte);
  });
});

describe("(b) allumé par le réglage, via le chemin de lancement", () => {
  const REGLAGE = { capacites: ["texte.nom-outil-autonome"] };

  it("HUBSPOT puis ZAPIER, ≤ 3, jamais avant 0,8 s, jamais hors vidéo, une par outil", async () => {
    const entrees = await entreesDuLancement(REGLAGE);
    expect(etiquettesOutilPermises(entrees)).toBe(true);
    const e = composer(commande(entrees)).texte.sousTitres!.etiquettesOutils!;
    expect(e.map((x) => x.texte)).toEqual(["HUBSPOT", "ZAPIER"]);
    expect(e.length).toBeLessThanOrEqual(3);
    for (const x of e) {
      expect(x.debutSec).toBeGreaterThanOrEqual(0.8);
      expect(x.finSec).toBeLessThanOrEqual(12);
    }
    expect(e[0].debutSec).toBeLessThan(e[1].debutSec);
  });

  it("le reste de la composition ne change pas (seule la clé etiquettesOutils s'ajoute)", async () => {
    const eteint = composer(commande({}));
    const allume = composer(commande(await entreesDuLancement(REGLAGE)));
    const { etiquettesOutils, ...sansEtiquettes } = allume.texte.sousTitres!;
    expect(etiquettesOutils?.length).toBeGreaterThan(0);
    expect({ ...allume, texte: { ...allume.texte, sousTitres: sansEtiquettes } }).toEqual(
      // les entrées figées au lancement ne figurent pas dans les propriétés rendues
      { ...eteint, texte: { ...eteint.texte, sousTitres: eteint.texte.sousTitres } },
    );
  });

  it("sans sous-titres : aucune étiquette", async () => {
    const c = commande(await entreesDuLancement(REGLAGE));
    const p = composer({ ...c, briques: { ...c.briques, "sous-titres": false } });
    expect(p.texte.sousTitres).toBeUndefined();
  });
});

describe.skipIf(!AVEC_RENDU)("(d) rendu de CalqueSousTitres", () => {
  it("« HUBSPOT » à début + 0,3 s ; absent à fin + 0,5 s", async () => {
    const donnees = composer(commande(await entreesDuLancement({ capacites: ["texte.nom-outil-autonome"] }))).texte.sousTitres!;
    const premiere = donnees.etiquettesOutils![0];
    const rendre = async (t: number) => {
      const remotion = (await import(/* @vite-ignore */ CHEMIN_REMOTION)) as unknown as { useCurrentFrame: () => number };
      vi.spyOn(remotion, "useCurrentFrame").mockReturnValue(Math.round(t * 25));
      return renderToStaticMarkup(createElement((CALQUE as ModuleCalque).CalqueSousTitres as never, { donnees } as never) as never);
    };
    expect(await rendre(premiere.debutSec + 0.3)).toContain("HUBSPOT");
    expect(await rendre(donnees.etiquettesOutils!.at(-1)!.finSec + 0.5)).not.toContain("HUBSPOT");
  });
});
