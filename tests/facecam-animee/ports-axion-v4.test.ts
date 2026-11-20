/** C4-U4.4 (v19b) : prises archive → approvisionnement `axion:`. Dépôts en mémoire, ffmpeg factice, aucun réglage, 0 €. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extraitMaisonPourRecherche } from "@/services/extraits-maison-v4";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, Licence } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { portsAxionV4 } = await import("@/services/ports-axion-v4");
const { avecExtraitsMaisonV4 } = await import("@/moteurs/montage-facecam-animee/extraits-maison/approvisionner");
const { argumentsExtraitMaisonV4 } = await import("@/moteurs/montage-facecam-animee/extraits-maison/preparer");
const { cleUsageExtrait } = await import("@/briques/bibliotheque-video/types");
const { sourceSignee } = await import("@/services/telephone-extrait-v4");

const NOW = "2026-11-17T10:00:00.000Z";
const lic = (): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [] });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 8, texte: "un dirigeant qui signe un devis", motsCles: ["devis", "signature"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
async function semer(id = "a", plages: PlageExtrait[] = [plage("p1")], avecFichier = true) {
  await depots().elements.enregistrer({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m", licence: lic(), creeLe: NOW, modifieLe: NOW,
    valeur: { type: "source-extraits", fiche: { videoId: `v-${id}`, versionId: "ver", sortieId: `s-${id}`, ratio: "9:16", licence: lic(), famille: [], plages, rangee: false, sourcePreferee: false } },
  } as unknown as ElementBibliotheque);
  if (!avecFichier) return;
  await depots().fichiers.enregistrer({ id: `f-${id}`, cleStockage: `studio/dev/sorties/${id}.mp4`, nom: "v.mp4", mime: "video/mp4", taille: 1, creeLe: NOW, modifieLe: NOW } as never);
  await depots().sorties.enregistrer({ id: `s-${id}`, videoId: `v-${id}`, versionId: "ver", ratio: "9:16", resolution: "1080x1920", fichierId: `f-${id}`, creeLe: NOW, modifieLe: NOW } as never);
}
const faux = () => {
  const executer = vi.fn(async (_p: string, _a: string[]) => new Uint8Array());
  return {
    executer,
    outils: {
      executer, telecharger: async () => undefined, dossierTravail: async (n: string) => `/tmp/${n}`,
      taille: async () => 1000, deposer: async (_f: string, cle: string) => cle, supprimerDossier: async () => undefined,
    },
  };
};
const base = (outils: unknown, plus: Record<string, unknown> = {}) =>
  ({ videoId: "nouvelle", signerLecture: async (c: string) => `https://signe.test/${c}`, outils, archive: { depots, maintenant: () => NOW }, extraitPour: extraitMaisonPourRecherche, ...plus }) as never;
const fen = (i: number, recherche: string) => ({ debut: i * 5, fin: i * 5 + 4, recherche, media: `m${i}.mp4`, video: false }) as never;
const plan = (...r: string[]) => ({ fenetres: r.map((x, i) => fen(i, x)) }) as never;

beforeEach(() => { reinitialiserDepots(); });

describe("portsAxionV4", () => {
  it("a) chemin réel : la fenêtre axion: est servie, le défaut n'est jamais appelé", async () => {
    await semer();
    const { executer, outils } = faux();
    const defaut = vi.fn();
    const r = await avecExtraitsMaisonV4(defaut, portsAxionV4(base(outils)))(plan("axion:devis signature"), {} as never);
    expect(defaut).not.toHaveBeenCalled();
    expect(r.plan.fenetres[0]).toMatchObject({ media: "m0.mp4", video: true });
    expect(r.choix[0].source).toBe("mes-images");
    const a = executer.mock.calls[0][1];
    expect(a).toEqual(argumentsExtraitMaisonV4("/tmp/m0_mp4/source.mp4", "/tmp/m0_mp4/extrait.mp4", 0, a[a.indexOf("-t") + 1] ? Number(a[a.indexOf("-t") + 1]) : 0, 21));
    expect(a).toContain("-an");
  });
  it("b) éteint = identique : aucune fenêtre axion: → même plan au défaut, aucun port appelé", async () => {
    const trouver = vi.fn();
    const defaut = vi.fn(async (p: { fenetres: { recherche: string }[] }) => ({ plan: p }) as never);
    const p = plan("une facture");
    const ports = portsAxionV4(base(faux().outils, { extraitPour: trouver }));
    await avecExtraitsMaisonV4(defaut, ports)(p, {} as never);
    expect(defaut.mock.calls[0][0]).toBe(p);
    expect(trouver).not.toHaveBeenCalled();
  });
  it("b) sourceSignee exportée rend la vidéo signée, ou null si un maillon manque", async () => {
    await semer("a");
    await semer("b", [plage("p1")], false);
    const p = base(faux().outils) as Parameters<typeof sourceSignee>[1];
    expect(await sourceSignee("a", p)).toBe("https://signe.test/studio/dev/sorties/a.mp4");
    expect(await sourceSignee("b", p)).toBeNull();
    expect(await sourceSignee("absent", p)).toBeNull();
  });
  it("c) archive vide → repli : la recherche nettoyée part au défaut", async () => {
    const { executer, outils } = faux();
    const defaut = vi.fn(async (p: { fenetres: { recherche: string }[] }) => ({ plan: p }) as never);
    await avecExtraitsMaisonV4(defaut, portsAxionV4(base(outils)))(plan("axion:devis signature"), {} as never);
    expect(executer).not.toHaveBeenCalled();
    expect(defaut.mock.calls[0][0].fenetres[0].recherche).toBe("devis signature");
  });
  it("c) vidéo source absente ou ffmpeg qui lève → null, puis repli", async () => {
    await semer("a", [plage("p1")], false);
    const defaut = vi.fn(async (p: { fenetres: { recherche: string }[] }) => ({ plan: p }) as never);
    const ports = portsAxionV4(base(faux().outils));
    const e = await ports.trouver("devis signature", 4);
    expect(e).not.toBeNull();
    expect(await ports.preparer(e!, "m0.mp4")).toBeNull();
    expect(await ports.preparer({ cle: "inconnue", debutSec: 0, longueurSec: 4 }, "m0.mp4")).toBeNull();
    reinitialiserDepots();
    await semer("c");
    const casse = faux();
    casse.executer.mockRejectedValue(new Error("ffmpeg"));
    await avecExtraitsMaisonV4(defaut, portsAxionV4(base(casse.outils)))(plan("axion:devis signature"), {} as never);
    expect(defaut).toHaveBeenCalledTimes(1);
  });
  it("d) le second trouver reçoit dejaPris avec la clé d'usage du premier", async () => {
    await semer("a");
    const vus: (readonly string[])[] = [];
    const extraitPour = vi.fn(async (e: { dejaPris: readonly string[] }, ports?: unknown) => {
      vus.push([...e.dejaPris]);
      const m = await import("@/services/extraits-maison-v4");
      return m.extraitMaisonPourRecherche(e as never, ports as never);
    });
    const ports = portsAxionV4(base(faux().outils, { extraitPour }));
    const e1 = await ports.trouver("axion:devis signature", 4);
    expect(await ports.preparer(e1!, "m0.mp4")).toBe("m0.mp4");
    await ports.trouver("axion:devis signature", 4);
    expect(vus[0]).toEqual([]);
    expect(vus[1]).toEqual([cleUsageExtrait("a", "p1")]);
  });
});

describe("gardes statiques", () => {
  const src = readFileSync("src/services/ports-axion-v4.ts", "utf8");
  it("e) aucun import d'argent, de videos-v4-studio ni du service facecam-animee ; aucun réglage lu", () => {
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*from/.test(l)).join("\n");
    expect(imports).not.toMatch(/credits|budget|depense|couts|plafond|videos-v4-studio|facecam-animee["']|services\/facecam-animee/);
    expect(src).not.toContain("lireParametre");
  });
  it("e) aucun autre fichier de src/ ne l'importe encore", () => {
    const vus: string[] = [];
    const marcher = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) marcher(c);
        else if (/\.tsx?$/.test(n) && !c.endsWith("ports-axion-v4.ts") && readFileSync(c, "utf8").includes("ports-axion-v4")) vus.push(c);
      }
    };
    marcher("src");
    expect(vus).toEqual([]);
  });
});
