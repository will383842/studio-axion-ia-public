/**
 * X4-13b : la ligne « Extraits gardés de cette vidéo » sur la page d'une vidéo et la tuile « Extraits gardés »
 * dans Bibliothèque › Les images. Visibles seulement archive (et note pour la ligne) allumées ; éteint = pages identiques.
 *
 * Chemin réel : vrais `lireParametre` / `ecrireParametre`, vrais dépôts mémoire, vraie `proprietesExtraitsDeLaVideo`
 * (et donc vraie `ficheDeLaVideo`), vraie page Bibliothèque. La page vidéo entière (≈ 60 services) est trop lourde à monter :
 * le bloc est rendu par la vraie fonction et une garde texte vérifie les 4 endroits de `videos/[id]/page.tsx`.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque } from "@/domaine/types";

vi.mock("server-only", () => ({}));

// Note d'intérêt : vraie fonction, sauf quand un test la fait lever (cas d).
let noteLeve = false;
vi.mock("@/briques/note-extraits/reglage", async (importer) => {
  const vrai = await importer<typeof import("@/briques/note-extraits/reglage")>();
  return {
    ...vrai,
    lireNoteInteret: async (...a: Parameters<typeof vrai.lireNoteInteret>) => {
      if (noteLeve) throw new Error("panne de la note");
      return vrai.lireNoteInteret(...a);
    },
  };
});

// Page Bibliothèque : session et compteurs doublés (aucun réseau) ; le réglage de l'archive est lu pour de vrai.
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/B-personnages-bibliotheque", () => ({ compterRushs: async () => 2, donneesApercuImage: async () => null }));
vi.mock("@/services/mes-images", () => ({ resumeMesImages: async () => ({ total: 0 }) }));
vi.mock("@/services/monteur-facecam", () => ({ listerAnimations: async () => [] }));
vi.mock("@/services/bibliotheque", () => ({
  compterElementsParType: async () => ({ "source-extraits": 1, logo: 1 }),
  listerPrononciations: async () => [],
}));
vi.mock("@/components/bibliotheque/ApercuImageVideo", () => ({ ApercuImageVideo: () => null }));
let typesAjout: Array<{ type: string; nom: string }> = [];
vi.mock("@/components/bibliotheque/ChoixAjout", () => ({
  ChoixAjout: (p: { types: Array<{ type: string; nom: string }> }) => {
    typesAjout = p.types;
    return null;
  },
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { idElementArchive } = await import("@/services/archive-extraits");
const { proprietesExtraitsDeLaVideo } = await import("@/services/extraits-de-la-video");
const { ExtraitsDeLaVideo } = await import("@/components/bibliotheque/ExtraitsDeLaVideo");
const { TYPES_BIBLIOTHEQUE } = await import("@/domaine/libelles");
const { default: PageBibliotheque } = await import("../../src/app/(studio)/bibliotheque/page");

const INSCRIPTION = "bibliothequeVideo.archive.inscription";
const NOTE = "archiveExtraits.noteInteret";
const LIEN = "/bibliotheque/source-extraits";
const PAGE_VIDEO = readFileSync("src/app/(studio)/videos/[id]/page.tsx", "utf8");
const PAGE_BIBLIO = readFileSync("src/app/(studio)/bibliotheque/page.tsx", "utf8");

const plage = (id: string, o: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 5, texte: "x", motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable", ...o,
});
const fiche = (videoId: string): FicheSourceExtraits => ({
  videoId, versionId: "ver1", sortieId: "s1", ratio: "9:16",
  licence: { type: "propriete", usageCommercial: true, reseaux: [] } as unknown as FicheSourceExtraits["licence"],
  famille: [],
  plages: [
    plage("a", { note: 80, sujet: "appels-offres", usages: ["telephone"] }),
    plage("b", { note: 70, sujet: "appels-offres", usages: ["telephone"] }),
    plage("c", { note: 65, sujet: "appels-offres", usages: ["ecran"] }),
    plage("d", { note: 20, sujet: "appels-offres", usages: ["fond"] }),
  ],
  rangee: false, sourcePreferee: true,
});

async function inscrire(videoId: string): Promise<void> {
  const m = new Date().toISOString();
  await depots().elements.enregistrer({
    id: idElementArchive(videoId), type: "source-extraits", nom: `Extraits ${videoId}`, motsCles: [],
    valeur: { type: "source-extraits", fiche: fiche(videoId) },
    licence: { type: "propriete" }, formatsParDefaut: [], marqueId: "m1", creeLe: m, modifieLe: m,
  } as unknown as ElementBibliotheque);
}

/** Exactement ce que fait la page vidéo : lecture jamais bloquante, puis la ligne. */
async function ligneDeLaPageVideo(videoId: string): Promise<string> {
  const extraits = await proprietesExtraitsDeLaVideo(videoId).catch(() => null);
  return extraits ? renderToStaticMarkup(createElement(ExtraitsDeLaVideo, extraits)) : "";
}

async function bibliotheque(): Promise<string> {
  typesAjout = [];
  return renderToStaticMarkup(await PageBibliotheque());
}
const hrefsTuiles = (html: string) => [...html.matchAll(/href="(\/bibliotheque\/[^"]+)"/g)].map((m) => m[1]);
/** Tuiles de master, dans l'ordre de la page (même construction que la ligne 39, inchangée). */
const TUILES_MASTER = [
  ...TYPES_BIBLIOTHEQUE.flatMap((t) => (t.type === "illustration-video" ? [] : t.type === "illustration-image" ? [{ type: "illustration-image", groupe: "medias" }] : [t])),
  { type: "rushs", groupe: "medias" },
  { type: "animations", groupe: "style" },
];
const ordreMaster = ["style", "medias", "son"].flatMap((g) => TUILES_MASTER.filter((t) => t.groupe === g).map((t) => `/bibliotheque/${t.type}`));

beforeEach(async () => {
  reinitialiserDepots();
  noteLeve = false;
  await inscrire("v1");
});

describe("page vidéo : garde des 4 endroits (aucune autre ligne)", () => {
  it("imports, lecture jamais bloquante, bloc « Pour cette vidéo » ouvert, ligne avant les options payantes", () => {
    expect(PAGE_VIDEO).toContain('import { ExtraitsDeLaVideo } from "@/components/bibliotheque/ExtraitsDeLaVideo";');
    expect(PAGE_VIDEO).toContain('import { proprietesExtraitsDeLaVideo } from "@/services/extraits-de-la-video";');
    expect(PAGE_VIDEO).toMatch(/const extraits = await proprietesExtraitsDeLaVideo\(v\.id\)\.catch\(\(\) => null\);/);
    expect(PAGE_VIDEO).toMatch(/const aSpecifique = Boolean\([^\n]*\|\| Boolean\(extraits\?\.archiveActive && extraits\.noteActive && extraits\.fiche\)\);/);
    const ligne = PAGE_VIDEO.indexOf("{extraits && <ExtraitsDeLaVideo {...extraits} />}");
    expect(ligne).toBeGreaterThan(0);
    expect(ligne).toBeLessThan(PAGE_VIDEO.indexOf("<OptionsPayantesVideo videoId={v.id}"));
    expect(ligne).toBeGreaterThan(PAGE_VIDEO.indexOf('<Section id="pour-cette-video"'));
  });
});

describe("page vidéo : la ligne par la vraie lecture", () => {
  it.each([["absent", undefined], ["false", false], ["chaîne « true »", "true"]])("(a) archive éteinte (%s) → aucune ligne", async (_n, v) => {
    if (v !== undefined) await ecrireParametre(INSCRIPTION, v);
    await ecrireParametre(NOTE, true);
    expect(await ligneDeLaPageVideo("v1")).toBe("");
  });

  it("(b) archive + note allumées, fiche à 3 plages gardées → « Extraits gardés de cette vidéo : 3 » et lien", async () => {
    await ecrireParametre(INSCRIPTION, true);
    await ecrireParametre(NOTE, true);
    const html = await ligneDeLaPageVideo("v1");
    expect(html).toContain("Extraits gardés de cette vidéo : ");
    expect(html).toContain(">3</span>");
    expect(html).toContain(`href="${LIEN}"`);
    // Aucune donnée d'une autre vidéo : sans fiche, rien.
    expect(await ligneDeLaPageVideo("v2")).toBe("");
  });

  it("(c) archive allumée, note éteinte → pas de ligne", async () => {
    await ecrireParametre(INSCRIPTION, true);
    expect(await ligneDeLaPageVideo("v1")).toBe("");
    await ecrireParametre(NOTE, "true");
    expect(await ligneDeLaPageVideo("v1")).toBe("");
  });

  it("(d) lireNoteInteret qui lève → page rendue sans ligne (jamais bloquant)", async () => {
    await ecrireParametre(INSCRIPTION, true);
    await ecrireParametre(NOTE, true);
    noteLeve = true;
    await expect(proprietesExtraitsDeLaVideo("v1")).rejects.toThrow("panne de la note");
    expect(await ligneDeLaPageVideo("v1")).toBe("");
  });
});

describe("Bibliothèque : tuile « Extraits gardés »", () => {
  it.each([["absent", undefined], ["false", false], ["chaîne « true »", "true"]])("(a) archive éteinte (%s) → tuiles de master, aucune tuile extraits", async (_n, v) => {
    const reference = await bibliotheque();
    if (v !== undefined) await ecrireParametre(INSCRIPTION, v);
    const html = await bibliotheque();
    expect(html).toBe(reference);
    expect(html).not.toContain(LIEN);
    expect(html).not.toContain("Extraits gardés");
    expect(hrefsTuiles(html)).toEqual(ordreMaster);
  });

  it("(b, c) archive allumée (note éteinte ou non) → tuile « Extraits gardés » dans Les images, rien d'autre ne bouge", async () => {
    const eteinte = await bibliotheque();
    await ecrireParametre(INSCRIPTION, true);
    const html = await bibliotheque();
    expect(html).toContain(`href="${LIEN}"`);
    expect(html).toContain("Extraits gardés");
    const attendu = ["style", "medias", "son"].flatMap((g) => [
      ...TUILES_MASTER.filter((t) => t.groupe === g).map((t) => `/bibliotheque/${t.type}`),
      ...(g === "medias" ? [LIEN] : []),
    ]);
    expect(hrefsTuiles(html)).toEqual(attendu);
    expect(hrefsTuiles(eteinte)).toEqual(ordreMaster);
    await ecrireParametre(NOTE, true);
    expect(hrefsTuiles(await bibliotheque())).toEqual(attendu);
  });

  it("(e) ChoixAjout ne propose jamais « Extraits gardés » (allumé ou non)", async () => {
    await bibliotheque();
    const eteint = typesAjout.map((t) => t.type);
    expect(eteint).not.toContain("source-extraits");
    await ecrireParametre(INSCRIPTION, true);
    await bibliotheque();
    expect(typesAjout.map((t) => t.type)).toEqual(eteint);
  });

  it("(f) la ligne 39 de la page reste celle que garde r8a", () => {
    expect(PAGE_BIBLIO).toContain("RUSHS, ANIMATIONS]");
    expect(PAGE_BIBLIO).toContain('t.type === "illustration-video" ? []');
  });
});
