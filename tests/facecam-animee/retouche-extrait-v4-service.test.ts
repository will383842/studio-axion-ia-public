/**
 * R4-03-b2 : le service qui prépare le clip d'un extrait de l'archive pour un téléphone, ou dit pourquoi c'est impossible.
 * Dépôts mémoire, ffmpeg factice qui note ses arguments. Aucun appel réel, 0 €. Rien dans `src/**` n'importe le service.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { ElementBibliotheque, Licence } from "@/domaine/types";
import { argumentsExtraitMaisonV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/preparer";
import type { ProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import type { OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";

vi.mock("server-only", () => ({}));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { clipPourDemandeExtraitV4 } = await import("@/services/retouche-extrait-v4");
const { extraitMaisonPourRecherche } = await import("@/services/extraits-maison-v4");

const NOW = "2026-11-17T10:00:00.000Z";
const lic = (p: Partial<Licence> = {}): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 2, finSec: 8, texte: "un dirigeant qui signe un devis", motsCles: ["devis", "signature", "dirigeant"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
async function semer(videoId: string, plages: PlageExtrait[] = [plage("p1")], licence: Licence = lic()) {
  await depots().fichiers.enregistrer({ id: `f-${videoId}`, cleStockage: `studio/dev/sorties/${videoId}.mp4`, nom: "v.mp4", mime: "video/mp4", taille: 1, creeLe: NOW, modifieLe: NOW } as never);
  await depots().sorties.enregistrer({ id: `s-${videoId}`, videoId, versionId: "ver", ratio: "9:16", resolution: "1080x1920", fichierId: `f-${videoId}`, creeLe: NOW, modifieLe: NOW } as never);
  await depots().elements.enregistrer({
    id: `archive-extraits-${videoId}`, type: "source-extraits", nom: "Extraits", motsCles: [], formatsParDefaut: [], marqueId: "m", licence, creeLe: NOW, modifieLe: NOW,
    valeur: { type: "source-extraits", fiche: { videoId, versionId: "ver", sortieId: `s-${videoId}`, ratio: "9:16", licence, famille: [], plages, rangee: false, sourcePreferee: true } },
  } as unknown as ElementBibliotheque);
}

const RACINE = join(__dirname, "..", "..");
const PLAN_BASE = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const TEL = (debut: number, fin: number, extra: Partial<ElementV4Plan> = {}): ElementV4Plan => ({ id: "telephone-video", debut, fin, recherches: ["axion:devis"], ...extra });
const CHIFFRE: ElementV4Plan = { id: "CarteCalendrier", debut: 1, fin: 3, mots: ["A"], instants: [1.5, 2.5] };
const projetAvec = (elementsV4: ElementV4Plan[], videos?: ProjetGardeV4["videos"]): ProjetGardeV4 => ({
  priseCle: "k.mov", plan: { ...PLAN_BASE, elementsV4 }, gardes: [{ debutSec: 0, finSec: 20 }], ...(videos ? { videos } : {}),
});

const appels = { executer: [] as string[][], telecharger: [] as string[], deposer: [] as string[] };
const outils = (): OutilsPreparation => ({
  executer: async (_p, a) => (appels.executer.push(a), new Uint8Array()),
  telecharger: async (u) => void appels.telecharger.push(u),
  dossierTravail: async (n) => `/tmp/${n}`,
  taille: async () => 1000,
  deposer: async (_f, cle) => (appels.deposer.push(cle), cle),
  supprimerDossier: async () => undefined,
});
const signer = vi.fn(async (id: string) => `https://signe.test/${id}`);
const ports = (p: Record<string, unknown> = {}) => ({ videoId: "v-1", sourceSignee: signer, outils: outils(), cleClip: (n: string) => `studio/dev/${n}`, archive: { depots, maintenant: () => NOW }, extraitPour: extraitMaisonPourRecherche, ...p });

beforeEach(() => {
  reinitialiserDepots();
  appels.executer.length = 0; appels.telecharger.length = 0; appels.deposer.length = 0;
  signer.mockClear();
});

describe("R4-03-b2 : clip d'un extrait pour un téléphone", () => {
  it("(a) archive vide : ARCHIVE_VIDE, extraitPour et ffmpeg jamais appelés", async () => {
    const extraitPour = vi.fn(async () => null);
    const o = outils(); const exec = vi.spyOn(o, "executer");
    const r = await clipPourDemandeExtraitV4(projetAvec([CHIFFRE, TEL(10, 13)]), { rang: 1, recherche: "devis" }, ports({ extraitPour, outils: o }));
    expect(r).toMatchObject({ refus: { code: "ARCHIVE_VIDE" } });
    expect(extraitPour).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });

  it("(b) archive non vide, aucun mot commun : AUCUN_EXTRAIT, rien préparé", async () => {
    await semer("v-a");
    const r = await clipPourDemandeExtraitV4(projetAvec([CHIFFRE, TEL(10, 13)]), { rang: 1, recherche: "zzzz introuvable" }, ports());
    expect(r).toMatchObject({ refus: { code: "AUCUN_EXTRAIT" } });
    expect((r as { refus: { message: string } }).refus.message).toContain("zzzz introuvable");
    expect(appels.executer).toEqual([]);
  });

  it("(c) la recherche reçue commence par axion: ; axion:devis reste tel quel", async () => {
    const extraitPour = vi.fn(async () => null);
    await semer("v-a");
    await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "ma vidéo de mardi" }, ports({ extraitPour }));
    expect((extraitPour.mock.calls[0] as unknown as [{ recherche: string }])[0].recherche.startsWith("axion:")).toBe(true);
    await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "axion:devis" }, ports({ extraitPour }));
    expect((extraitPour.mock.calls[1] as unknown as [{ recherche: string }])[0].recherche).toBe("axion:devis");
  });

  it("(d) sourceVideoId : seules les fiches de cette vidéo sont vues ; inconnue → AUCUN_EXTRAIT", async () => {
    await semer("v-a", [plage("pa")]);
    await semer("v-b", [plage("pb")]);
    const vus: string[] = [];
    const extraitPour = vi.fn(async (e: Parameters<typeof extraitMaisonPourRecherche>[0], a?: Parameters<typeof extraitMaisonPourRecherche>[1]) => {
      const l = await (a!.depots as typeof depots)().elements.lister((x) => x.type === "source-extraits");
      vus.push(...l.map((x) => x.id));
      return extraitMaisonPourRecherche(e, a);
    });
    const r = await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "devis", sourceVideoId: "v-b" }, ports({ extraitPour }));
    expect(vus).toEqual(["archive-extraits-v-b"]);
    expect(r).toMatchObject({ choix: { id: "extrait:archive-extraits-v-b:pb" } });
    const inconnu = await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "devis", sourceVideoId: "v-zzz" }, ports());
    expect(inconnu).toMatchObject({ refus: { code: "AUCUN_EXTRAIT" } });
  });

  it("(e) plage trouvée : ffmpeg reçoit les arguments exacts ; nom v4-1-r1.mp4, puis r2 s'il est pris", async () => {
    await semer("v-a");
    const r = await clipPourDemandeExtraitV4(projetAvec([CHIFFRE, TEL(10, 13)]), { rang: 1, recherche: "devis" }, ports());
    expect(r).toEqual({ nom: "v4-1-r1.mp4", cle: "studio/dev/v4-1-r1.mp4", choix: { fichier: "v4-1-r1.mp4", source: "archive-axion", id: "extrait:archive-extraits-v-a:p1", scene: "axion:devis", licence: "vidéo de Will (archive)" } });
    expect(appels.telecharger).toEqual(["https://signe.test/archive-extraits-v-a"]);
    expect(appels.executer).toEqual([argumentsExtraitMaisonV4(expect.stringContaining("source.mp4") as unknown as string, expect.stringContaining("extrait.mp4") as unknown as string, 2, 3.5, 21)]);
    const deux = await clipPourDemandeExtraitV4(projetAvec([CHIFFRE, TEL(10, 13)], { fichiers: [{ nom: "v4-1-r1.mp4", cle: "x" }] }), { rang: 1, recherche: "devis" }, ports());
    expect(deux).toMatchObject({ nom: "v4-1-r2.mp4" });
  });

  it("(f) licence expirée : AUCUN_EXTRAIT", async () => {
    await semer("v-a", [plage("p1")], lic({ type: "abonnement", expireLe: "2026-01-01T00:00:00.000Z" }));
    const r = await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "devis" }, ports());
    expect(r).toMatchObject({ refus: { code: "AUCUN_EXTRAIT" } });
  });

  it("(g) dejaPris : la clé de l'autre téléphone y est, pas celle du téléphone remplacé", async () => {
    await semer("v-a", [plage("p1"), plage("p2")]);
    const extraitPour = vi.fn(async () => null);
    const projet = projetAvec(
      [TEL(10, 13, { medias: ["broll/v4-0-0.mp4"] }), TEL(20, 23, { medias: ["broll/v4-1-0.mp4"] })],
      { fichiers: [], choix: [
        { fichier: "v4-0-0.mp4", source: "archive-axion", id: "extrait:a:p1", scene: "s" },
        { fichier: "v4-1-0.mp4", source: "archive-axion", id: "extrait:a:p2", scene: "s" },
        { fichier: "b.mp4", source: "pexels", id: "px", scene: "s" },
      ] },
    );
    await clipPourDemandeExtraitV4(projet, { rang: 0, recherche: "devis" }, ports({ extraitPour }));
    expect((extraitPour.mock.calls[0] as unknown as [{ dejaPris: string[] }])[0].dejaPris).toEqual(["extrait:a:p2"]);
  });

  it("(h) éteint = identique : un rang qui n'est pas un téléphone ne touche aucun port, le projet est inchangé", async () => {
    await semer("v-a");
    const projet = projetAvec([CHIFFRE, TEL(10, 13)]);
    const avant = structuredClone(projet);
    const depotsEspion = vi.fn(depots);
    const extraitPour = vi.fn(async () => null);
    for (const rang of [0, 7, -1]) {
      const r = await clipPourDemandeExtraitV4(projet, { rang, recherche: "devis" }, ports({ extraitPour, archive: { depots: depotsEspion, maintenant: () => NOW } }));
      expect(r).toMatchObject({ refus: { code: "ELEMENT_INTROUVABLE" } });
    }
    expect(depotsEspion).not.toHaveBeenCalled();
    expect(extraitPour).not.toHaveBeenCalled();
    expect(signer).not.toHaveBeenCalled();
    expect(appels.executer).toEqual([]);
    expect(appels.deposer).toEqual([]);
    expect(projet).toEqual(avant);
  });

  it("source introuvable ou ffmpeg en échec : refus, ne lève jamais", async () => {
    await semer("v-a");
    expect(await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "devis" }, ports({ sourceSignee: async () => null }))).toMatchObject({ refus: { code: "AUCUN_EXTRAIT" } });
    const mauvais = { ...outils(), executer: async () => { throw new Error("ffmpeg"); } };
    expect(await clipPourDemandeExtraitV4(projetAvec([TEL(10, 13)]), { rang: 0, recherche: "devis" }, ports({ outils: mauvais }))).toMatchObject({ refus: { code: "AUCUN_EXTRAIT" } });
  });

  it("(i) gardes statiques : server-only, aucun réglage ni argent, et rien dans src/** ne l'importe", () => {
    const src = readFileSync(join(RACINE, "src/services/retouche-extrait-v4.ts"), "utf8");
    expect(src).toContain('import "server-only"');
    expect(src).not.toMatch(/lireParametre/);
    expect(src).not.toMatch(/^import .*(credits|budget|depense|couts|plafond|fournisseurs|retouche-chat|telephone-extrait-v4)/m);
    const parcourir = (d: string): string[] => readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
    const importeurs = parcourir(join(RACINE, "src")).filter((f) => !f.endsWith("services/retouche-extrait-v4.ts") && /services\/retouche-extrait-v4/.test(readFileSync(f, "utf8")));
    // R4-03-d2b : liste blanche +1, l'action serveur importe `@/services/retouche-extrait-v4-demande` (seconde lecture du pilote).
    expect(importeurs.map((f) => f.slice(RACINE.length + 1).split("\\").join("/"))).toEqual(["src/app/(studio)/videos/actions-changer-extrait-v4.ts"]);
  });
});
