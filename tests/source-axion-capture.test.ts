/**
 * SOURCE AXION-IA.COM — opération `capture-site` de `studio-rendu`, SANS navigateur ni réseau : une fausse page rejoue
 * ce que le navigateur répondrait. Seul axion-ia.com est accepté ; image et vidéo produites ; mouvement régulier.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OPERATIONS } from "../studio-rendu/src/contrat";
import {
  adresseAutorisee,
  capturerPage,
  distanceDefilement,
  FENETRES,
  lireParametres,
  positionsDefilement,
  posesSurvol,
  type PageCapture,
} from "../studio-rendu/src/operations/capture-site";

const dossiers: string[] = [];
async function dossier() {
  const d = await mkdtemp(join(tmpdir(), "essai-capture-"));
  dossiers.push(d);
  return d;
}
afterEach(async () => {
  while (dossiers.length) await rm(dossiers.pop()!, { recursive: true, force: true });
});

/** Fausse page : enregistre ce qu'on lui demande. */
function fausse(options: { arrivee?: string; hauteurPage?: number; cible?: { x: number; y: number } | null } = {}) {
  const appels = { ouvertures: [] as string[], evaluations: 0, photos: 0, survols: 0, fermee: false };
  const page: PageCapture = {
    async ouvrir(url) {
      appels.ouvertures.push(url);
      return options.arrivee ?? url;
    },
    async evaluer<T>(expression: string) {
      appels.evaluations++;
      if (expression.includes("studio-fleche") && expression.includes("hauteurPage")) return { hauteurPage: options.hauteurPage ?? 5000, titre: "Essai" } as T;
      if (expression.includes("voulu")) return (options.cible === undefined ? { x: 200, y: 1400 } : options.cible) as T;
      return 0 as T;
    },
    async photographier() {
      appels.photos++;
      return Buffer.from([0xff, 0xd8, 0xff]);
    },
    async survoler() {
      appels.survols++;
    },
    async fermer() {
      appels.fermee = true;
    },
  };
  return { page, appels };
}

describe("capture-site : contrat et adresses", () => {
  it("l'opération est déclarée au contrat de studio-rendu", () => expect(OPERATIONS).toContain("capture-site"));

  it("seul axion-ia.com en https est accepté (le conteneur est sur le réseau interne)", () => {
    expect(adresseAutorisee("https://axion-ia.com/fr/formations")).toBe(true);
    expect(adresseAutorisee("https://www.axion-ia.com/fr")).toBe(true);
    for (const a of ["http://axion-ia.com/fr", "https://studio.axion-ia.com/", "https://axion-ia.com.exemple.fr/", "http://base:5432/", "https://axion-ia.com:8443/", "https://x@axion-ia.com/", "pas une adresse"]) {
      expect(adresseAutorisee(a), a).toBe(false);
    }
  });

  it("paramètres relus et bornés : durée de 4 à 8 s, format connu, type obligatoire", () => {
    expect(lireParametres({ type: "video", format: "16:9", dureeSec: 30 })).toMatchObject({ dureeSec: 8, format: "16:9", mouvement: "defilement" });
    expect(lireParametres({ type: "video", dureeSec: 1, mouvement: "survol" })).toMatchObject({ dureeSec: 4, format: "9:16", mouvement: "survol" });
    expect(() => lireParametres({ type: "image", format: "4:3" })).toThrow();
    expect(() => lireParametres({ format: "9:16" })).toThrow();
  });
});

describe("capture-site : mouvement régulier", () => {
  it("défilement : de 0 à la distance, jamais en arrière, arrêt au début et à la fin", () => {
    const p = positionsDefilement(180, 1900);
    expect(p[0]).toBe(0);
    expect(p.at(-1)).toBe(1900);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    expect(p[10]).toBe(0);
    expect(p[170]).toBe(1900);
  });

  it("distance : deux écrans et demi au plus, jamais sous le bas de la page", () => {
    expect(distanceDefilement(20000, 768)).toBe(1920);
    expect(distanceDefilement(1000, 768)).toBe(232);
    expect(distanceDefilement(500, 768)).toBe(0);
  });

  it("survol : la page amène la cible au centre, la flèche s'y pose, l'appui se voit à la fin", () => {
    const f = FENETRES["9:16"];
    const poses = posesSurvol(180, { largeur: f.largeur, hauteur: f.hauteur }, { x: 200, y: 1400 }, 5000);
    const fin = poses.at(-1)!;
    expect(fin.defilement).toBe(1400 - f.hauteur / 2);
    expect(fin.curseur).toMatchObject({ x: 200, y: f.hauteur / 2, appui: 1 });
    expect(poses[0].curseur!.appui).toBe(0);
    expect(poses.filter((p) => p.curseur!.appui > 0).length).toBeLessThan(30);
  });
});

describe("capture-site : capture (fausse page)", () => {
  it("image : un JPEG à la taille du format, la page est refermée", async () => {
    const d = await dossier();
    const { page, appels } = fausse();
    const r = await capturerPage("https://axion-ia.com/fr", { type: "image", format: "9:16", mouvement: "defilement", dureeSec: 6 }, d, { ouvrir: async () => page });
    expect(r.mime).toBe("image/jpeg");
    expect(r.mesures).toMatchObject({ largeur: 1080, hauteur: 1920 });
    expect((await readFile(r.chemin)).length).toBe(3);
    expect(appels.fermee).toBe(true);
  });

  it("vidéo : 30 images par seconde, encodées en une vidéo", async () => {
    const d = await dossier();
    const { page, appels } = fausse();
    let images = 0;
    const r = await capturerPage("https://axion-ia.com/fr/formations", { type: "video", format: "16:9", mouvement: "survol", dureeSec: 5 }, d, {
      ouvrir: async () => page,
      encoder: async (dossierImages, chemin, largeur, hauteur) => {
        images = (await readdir(dossierImages)).length;
        expect([largeur, hauteur]).toEqual([1920, 1080]);
        await writeFile(chemin, "mp4");
      },
    });
    expect(images).toBe(150);
    expect(appels.photos).toBe(150);
    expect(appels.survols).toBeGreaterThan(0);
    expect(r).toMatchObject({ mime: "video/mp4", mesures: { survol: 1, dureeSec: 5 } });
  });

  it("survol sans cible trouvée : simple défilement (rien d'inventé)", async () => {
    const d = await dossier();
    const { page, appels } = fausse({ cible: null });
    const r = await capturerPage("https://axion-ia.com/fr", { type: "video", format: "9:16", mouvement: "survol", dureeSec: 4 }, d, { ouvrir: async () => page, encoder: async (_d, c) => writeFile(c, "mp4") });
    expect(r.mesures.survol).toBe(0);
    expect(appels.survols).toBe(0);
  });

  it("refus : une adresse hors du site n'ouvre même pas le navigateur ; une redirection hors du site est refusée", async () => {
    const d = await dossier();
    let ouvert = false;
    await expect(capturerPage("https://exemple.fr/", { type: "image", format: "9:16", mouvement: "defilement", dureeSec: 6 }, d, { ouvrir: async () => ((ouvert = true), fausse().page) })).rejects.toThrow(/axion-ia\.com/);
    expect(ouvert).toBe(false);
    const { page, appels } = fausse({ arrivee: "https://ailleurs.exemple/" });
    await expect(capturerPage("https://axion-ia.com/fr", { type: "image", format: "9:16", mouvement: "defilement", dureeSec: 6 }, d, { ouvrir: async () => page })).rejects.toThrow(/hors du site/);
    expect(appels.photos).toBe(0);
    expect(appels.fermee).toBe(true);
  });
});
