/** R4-03-d2a : données du panneau « Changer un extrait » (v4). Lecture seule, montée nulle part, 0 €. Doubles injectés. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { VersionVideo, Video } from "@/domaine/types";

vi.mock("server-only", () => ({}));
const { donneesChangerExtraitV4 } = await import("@/services/changer-extrait-v4-ecran");

const RACINE = join(__dirname, "..", "..");
const PLAN_BASE = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const ELEMENTS: ElementV4Plan[] = [
  { id: "CarteCalendrier", debut: 1, fin: 3, mots: ["A"], instants: [1.5, 2.5] },
  { id: "telephone-video", debut: 12.4, fin: 15.4, recherches: ["axion:devis client"], medias: ["broll/v4-1-0.mp4"] },
  { id: "telephone-video", debut: 20, fin: 23.25, recherches: ["devis signature"], medias: ["broll/v4-2-0.mp4"] },
];
const version = (o: { moteurId?: string; plan?: boolean } = {}) =>
  ({
    id: "ver1", videoId: "V", commande: { formatId: "facecam-animee", moteurId: o.moteurId ?? "montage-facecam-animee" },
    projetMontage: o.plan === false ? { priseCle: "k.mov" } : { priseCle: "k.mov", plan: { ...PLAN_BASE, elementsV4: ELEMENTS }, gardes: [], videos: { fichiers: [], choix: [] } },
  }) as unknown as VersionVideo;
const video = (versionChoisieId: string | undefined = "ver1") => ({ id: "V", titre: "T", ...(versionChoisieId ? { versionChoisieId } : {}) }) as unknown as Video;
const SOURCES = [{ videoId: "A", titre: "Ma vidéo de mardi", plages: 2 }];

const deps = (o: Partial<Parameters<typeof donneesChangerExtraitV4>[1]> = {}) => ({
  actif: async () => true,
  lireVideo: async () => video(),
  lireVersion: async () => version(),
  sources: vi.fn(async () => SOURCES),
  ...o,
});

describe("R4-03-d2a : donneesChangerExtraitV4", () => {
  it("a) actif faux ou qui lève → null, rien d'autre n'est lu", async () => {
    for (const actif of [async () => false, async () => { throw new Error("réglage illisible"); }]) {
      const d = deps({ actif });
      const lireVideo = vi.fn(d.lireVideo);
      expect(await donneesChangerExtraitV4("V", { ...d, lireVideo })).toBeNull();
      expect(lireVideo).not.toHaveBeenCalled();
      expect(d.sources).not.toHaveBeenCalled();
    }
  });

  it("b) vidéo absente, sans version choisie, version d'un autre moteur, projet sans plan → null", async () => {
    expect(await donneesChangerExtraitV4("V", deps({ lireVideo: async () => undefined }))).toBeNull();
    expect(await donneesChangerExtraitV4("V", deps({ lireVideo: async () => video("") }))).toBeNull();
    expect(await donneesChangerExtraitV4("V", deps({ lireVersion: async () => version({ moteurId: "montage-facecam" }) }))).toBeNull();
    expect(await donneesChangerExtraitV4("V", deps({ lireVersion: async () => version({ plan: false }) }))).toBeNull();
    expect(await donneesChangerExtraitV4("V", deps({ lireVersion: async () => undefined }))).toBeNull();
  });

  it("c) version FA avec 2 téléphones : 2 entrées { rang, libelle, debut, fin } ; sources réduites à { videoId, titre }", async () => {
    const r = await donneesChangerExtraitV4("V", deps());
    expect(r).toEqual({
      telephones: [
        { rang: 1, libelle: "Téléphone à 12,4 s (3,0 s) : « devis client »", debut: 12.4, fin: 15.4 },
        { rang: 2, libelle: "Téléphone à 20,0 s (3,3 s) : « devis signature »", debut: 20, fin: 23.25 },
      ],
      sources: [{ videoId: "A", titre: "Ma vidéo de mardi" }],
    });
    expect(Object.keys(r!.sources[0]).sort()).toEqual(["titre", "videoId"]);
  });

  it("d) sources qui lève → null, aucune exception", async () => {
    await expect(donneesChangerExtraitV4("V", deps({ sources: vi.fn(async () => { throw new Error("archive"); }) }))).resolves.toBeNull();
    await expect(donneesChangerExtraitV4("V", deps({ lireVideo: async () => { throw new Error("base"); } }))).resolves.toBeNull();
  });

  it("e) gardes statiques : server-only, ni réglage, ni argent, ni fabrication, ni action de retouche", () => {
    const src = readFileSync(join(RACINE, "src/services/changer-extrait-v4-ecran.ts"), "utf8");
    expect(src).toContain('import "server-only";');
    expect(src).not.toMatch(/lireParametre/);
    expect(src).not.toMatch(/from "[^"]*(fabrication|\/videos|credits|budget|couts|plafond|fournisseurs)[^"]*"/i);
    expect(src).not.toMatch(/retouche-gratuite|reprise-rendu-v4|(?<!sources-)retouche-extrait-v4|lecture-capture|extraits-maison-v4/);
  });
});
