/**
 * UO-11 — une jaquette par réseau avant la validation. Aucun appel réel : faux fournisseur de miniature, faux stockage.
 * Règle du pilote : la jaquette d'un réseau = le ratio de sortie EXISTANT de la vidéo (aucun recadrage) ;
 * Instagram se rabat sur son ratio d'emplacement (4:5), jamais un 3:4.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dimensionsMiniature } from "@/domaine/miniatures";
import { RESEAUX, obtenirReseau } from "@/reseaux";
import type { IdReseau, Miniature, Ratio, Video } from "@/domaine/types";
import { GABARIT_IMAGE_VIDEO_RATIO } from "@/domaine/vignettes";
import { jaquettesAttendues, jaquettesPretesDomaine, ratioCibleJaquette, choisirRatioJaquette } from "@/domaine/jaquettes-reseau";

const appels: { titre: string; nombre: number; source?: { ratio: Ratio; gabarit?: string; depots: { cle: string }[] }; couverture?: unknown }[] = [];
let cles: string[] = [];
let modeOutil: "reel" | "simulation" = "reel";

vi.mock("@/services/_commun", async (orig) => {
  const reel = (await orig()) as Record<string, unknown>;
  return {
    ...reel,
    fournisseur: async (type: string) => {
      if (type === "stockage") return { mode: "reel", urlLectureDuree: async (c: string) => `https://r2.exemple/${c}`, urlDepotDuree: async (c: string) => `https://r2.exemple/depot/${c}` };
      return {
        mode: modeOutil,
        async proposer(d: (typeof appels)[number]) {
          appels.push(d);
          const cle = cles.shift() ?? `studio/dev/videos/v/miniatures/${d.source?.depots[0]?.cle ?? "x"}.jpg`;
          return [{ fichierCle: cle, titre: d.titre }];
        },
      };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const service = await import("@/services/jaquettes-reseau");

const T = "2026-11-16T10:00:00.000Z";
async function preparer(opts: { ratios: Ratio[]; estDemo?: boolean; titre?: string }): Promise<Video> {
  const d = depots();
  const video = { id: "vid-j", titre: opts.titre ?? "0005-FC-TT-L · Facturer en retard — v5", estDemo: opts.estDemo ?? false, ratios: [opts.ratios[0]], versionChoisieId: "ver-j", statut: "prete", creeLe: T, modifieLe: T } as unknown as Video;
  await d.videos.enregistrer(video);
  for (const r of opts.ratios) {
    const f = { id: `f-${r}`, cleStockage: `studio/dev/videos/vid-j/sortie-${r.replace(":", "x")}.mp4`, nom: "s.mp4", mime: "video/mp4", taille: 1, largeur: dimensionsMiniature(r).largeur, hauteur: dimensionsMiniature(r).hauteur, origine: "fabrication", statut: "pret", dureeSec: 30, creeLe: T, modifieLe: T };
    await d.fichiers.enregistrer(f as never);
    await d.sorties.enregistrer({ id: `s-${r}`, videoId: "vid-j", versionId: "ver-j", ratio: r, resolution: "x", fichierId: f.id, vignetteFichierId: "", dureeSec: 30, creeLe: T, modifieLe: T } as never);
  }
  return video;
}

beforeEach(() => {
  reinitialiserDepots();
  appels.length = 0;
  cles = [];
  modeOutil = "reel";
});

describe("UO-11 domaine · tailles lues, jamais écrites en dur", () => {
  it("le ratio cible d'un réseau est celui de son registre ; Instagram (3:4 hors Ratio) se rabat sur son ratio d'emplacement 4:5", () => {
    for (const r of RESEAUX) {
      const cible = ratioCibleJaquette(r.id);
      expect(["9:16", "1:1", "4:5", "16:9"]).toContain(cible);
      if (r.miniature.ratio !== "3:4") expect(cible).toBe(r.miniature.ratio);
    }
    expect(ratioCibleJaquette("instagram")).toBe("4:5");
    expect(obtenirReseau("instagram").ratios).toContain("4:5");
  });

  it("choisit le ratio de sortie existant : la cible si elle existe, sinon un ratio de sortie accepté par le réseau, sinon rien (aucun recadrage)", () => {
    expect(choisirRatioJaquette("youtube", ["9:16", "16:9"])).toBe("16:9");
    expect(choisirRatioJaquette("linkedin", ["9:16"])).toBe("9:16"); // LinkedIn accepte 9:16
    expect(choisirRatioJaquette("youtube", ["9:16"])).toBeNull(); // YouTube n'accepte que 16:9
    expect(choisirRatioJaquette("instagram", ["9:16"])).toBe("9:16");
    expect(choisirRatioJaquette("instagram", ["16:9"])).toBeNull();
  });

  it("N réseaux cochés = exactement N jaquettes attendues, à la taille de dimensionsMiniature", () => {
    const reseaux: IdReseau[] = ["tiktok", "youtube", "instagram"];
    const a = jaquettesAttendues(reseaux, ["9:16", "16:9", "4:5"]);
    expect(a).toHaveLength(3);
    expect(a.map((x) => x.reseau)).toEqual(reseaux);
    for (const x of a) expect(x.dimensions).toEqual(dimensionsMiniature(x.ratio!));
    expect(jaquettesAttendues(["tiktok", "tiktok"], ["9:16"])).toHaveLength(1);
  });

  it("jaquettesPretesDomaine : faux avec une phrase française qui nomme le réseau tant qu'une jaquette manque", () => {
    const mini = (reseau: IdReseau, ratio: Ratio) => ({ id: `m-${reseau}`, videoId: "v", fichierId: "f", titre: "", choisie: false, ratio, reseau }) as Miniature;
    const v = jaquettesPretesDomaine(["tiktok", "youtube"], ["9:16", "16:9"], [mini("tiktok", "9:16")]);
    expect(v.pretes).toBe(false);
    expect(v.phrase).toContain("YouTube");
    expect(v.phrase).toMatch(/jaquette/i);
    expect(jaquettesPretesDomaine(["tiktok", "youtube"], ["9:16", "16:9"], [mini("tiktok", "9:16"), mini("youtube", "16:9")]).pretes).toBe(true);
    // Une jaquette à un autre ratio que celui attendu ne compte pas.
    expect(jaquettesPretesDomaine(["youtube"], ["16:9"], [mini("youtube", "9:16")]).pretes).toBe(false);
    // Ratio de vidéo inacceptable : faux, la phrase nomme le réseau.
    const i = jaquettesPretesDomaine(["youtube"], ["9:16"], []);
    expect(i.pretes).toBe(false);
    expect(i.phrase).toContain("YouTube");
  });
});

describe("UO-11 service · fabrication par le faux fournisseur", () => {
  it("une vidéo cochée pour 3 réseaux reçoit exactement 3 jaquettes, une par réseau, à la taille du ratio ; aucune rejouée", async () => {
    await preparer({ ratios: ["9:16", "16:9", "4:5"] });
    const reseaux: IdReseau[] = ["tiktok", "youtube", "instagram"];
    const faites = await service.fabriquerJaquettes("vid-j", reseaux);
    expect(faites).toHaveLength(3);
    const minis = await depots().miniatures.lister((m) => m.videoId === "vid-j" && !!m.reseau);
    expect(minis.map((m) => m.reseau).sort()).toEqual([...reseaux].sort());
    for (const m of minis) {
      expect(m.ratio).toBe(ratioCibleJaquette(m.reseau!));
      const f = await depots().fichiers.obtenir(m.fichierId);
      expect(f?.largeur).toBe(dimensionsMiniature(m.ratio).largeur);
      expect(f?.hauteur).toBe(dimensionsMiniature(m.ratio).hauteur);
      expect(m.choisie).toBe(false);
      expect(m.gabarit).toBe(GABARIT_IMAGE_VIDEO_RATIO);
    }
    // Idempotent : un deuxième passage n'en ajoute aucune.
    expect(await service.fabriquerJaquettes("vid-j", reseaux)).toHaveLength(0);
    expect(await depots().miniatures.compter((m) => m.videoId === "vid-j" && !!m.reseau)).toBe(3);
    expect((await service.jaquettesPretes((await depots().videos.obtenir("vid-j"))!, reseaux)).pretes).toBe(true);
  });

  it("vignette de marque : gabarit existant, aucune couleur ni police passée, jamais le titre interne, jamais d'image de démonstration", async () => {
    await preparer({ ratios: ["9:16"] });
    cles = ["demo/miniatures/mini-1.jpg"]; // le faux fournisseur tente une image de démo
    const faites = await service.fabriquerJaquettes("vid-j", ["tiktok"]);
    expect(faites).toHaveLength(0); // écartée : jamais une démo sur une vraie vidéo
    expect(await depots().miniatures.compter((m) => m.videoId === "vid-j")).toBe(0);
    cles = [];
    await service.fabriquerJaquettes("vid-j", ["tiktok"]);
    const a = appels[appels.length - 1];
    expect(a.source?.gabarit).toBe("image-video-v3");
    expect(a.source?.ratio).toBe("9:16");
    expect(a.titre).not.toMatch(/0005-FC|— v5/);
    const json = JSON.stringify(a);
    expect(json).not.toMatch(/#[0-9a-f]{3,8}\b|Manrope|police|couleur|font/i);
  });

  it("l'ancienne miniature reste dans les fichiers", async () => {
    await preparer({ ratios: ["9:16"] });
    await depots().miniatures.enregistrer({ id: "ancienne", videoId: "vid-j", fichierId: "f-9:16", titre: "avant", choisie: true, ratio: "9:16", creeLe: T, modifieLe: T } as never);
    await service.fabriquerJaquettes("vid-j", ["tiktok"]);
    const ancienne = await depots().miniatures.obtenir("ancienne");
    expect(ancienne?.choisie).toBe(true);
    expect(await depots().miniatures.compter((m) => m.videoId === "vid-j")).toBe(2);
  });

  it("jaquettesPretes(video) est faux avec la phrase française nommant le réseau tant qu'une jaquette manque", async () => {
    const video = await preparer({ ratios: ["9:16", "16:9"] });
    const r = await service.jaquettesPretes(video, ["tiktok", "youtube"]);
    expect(r.pretes).toBe(false);
    expect(r.phrase).toMatch(/TikTok|YouTube/);
  });

  it("fournisseur en simulation sur une vraie vidéo : rien n'est inventé, la jaquette reste manquante", async () => {
    modeOutil = "simulation";
    const video = await preparer({ ratios: ["9:16"] });
    expect(await service.fabriquerJaquettes("vid-j", ["tiktok"])).toHaveLength(0);
    expect((await service.jaquettesPretes(video, ["tiktok"])).pretes).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("aucun appel réel : les fichiers du lot n'importent ni studio-rendu ni le diffuseur, et n'écrivent aucune couleur, police ou dimension", () => {
    for (const f of ["src/domaine/jaquettes-reseau.ts", "src/services/jaquettes-reseau.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(new RegExp(`studio-rendu|fetch\\(|${"Buf" + "fer"}|zernio`, "i"));
      expect(s).not.toMatch(/#[0-9a-fA-F]{6}\b|Manrope|\b1080\b|\b1920\b|\b1350\b|\b720\b|\b1280\b/);
    }
  });
});
