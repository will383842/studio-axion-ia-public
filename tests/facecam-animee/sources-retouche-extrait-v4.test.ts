/** R4-03-b4 : liste des vidéos de l'archive où prendre un extrait (lecture seule, branchée nulle part). Dépôts en mémoire. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, Licence, Video } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { sourcesPourRetoucheExtraitV4 } = await import("@/services/sources-retouche-extrait-v4");
const { extraitMaisonPourRecherche } = await import("@/services/extraits-maison-v4");

const NOW = "2026-11-17T10:00:00.000Z";
const ports = () => ({ depots, maintenant: () => NOW });
const lic = (p: Partial<Licence> = {}): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 12, texte: "Une facture claire", motsCles: ["facture"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
interface Opt { licence: Licence; famille: string[]; plages: PlageExtrait[]; rangee: boolean; archiveLe: string }
const el = (id: string, o: Partial<Opt> = {}): ElementBibliotheque =>
  ({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m", licence: o.licence ?? lic(),
    creeLe: NOW, modifieLe: NOW, ...(o.archiveLe ? { archiveLe: o.archiveLe } : {}),
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId: `v-${id}`, versionId: "ver", sortieId: "s", ratio: "9:16", licence: o.licence ?? lic(),
        famille: o.famille ?? [], plages: o.plages ?? [plage("p1")], rangee: o.rangee ?? false, sourcePreferee: false,
      },
    },
  }) as unknown as ElementBibliotheque;
const semer = async (...els: ElementBibliotheque[]) => { for (const e of els) await depots().elements.enregistrer(e); };
const titrer = async (id: string, titre: string) =>
  { await depots().videos.enregistrer({ id, titre, creeLe: NOW, modifieLe: NOW } as unknown as Video); };

beforeEach(() => { reinitialiserDepots(); vi.restoreAllMocks(); });

describe("sourcesPourRetoucheExtraitV4", () => {
  it("a) seule la vidéo A (2 plages utilisables) est rendue, avec son titre", async () => {
    await semer(
      el("A", { plages: [plage("p1"), plage("p2")] }),
      el("B", { plages: [plage("p1", { texteIncruste: true })] }),
      el("C", { licence: lic({ type: "a-verifier" }) }),
    );
    await titrer("v-A", "Ma vidéo de mardi");
    expect(await sourcesPourRetoucheExtraitV4("V", ports())).toEqual([{ videoId: "v-A", titre: "Ma vidéo de mardi", plages: 2 }]);
  });
  it("b) la vidéo en cours et sa famille sont absentes", async () => {
    await semer(el("A"), el("D", { famille: ["v-V"] }), el("V"));
    expect((await sourcesPourRetoucheExtraitV4("v-V", ports())).map((s) => s.videoId)).toEqual(["v-A"]);
    expect((await sourcesPourRetoucheExtraitV4("autre", ports())).map((s) => s.videoId).sort()).toEqual(["v-A", "v-D", "v-V"]);
  });
  it("c) plage de 2 s non comptée ; fiche rangée ou archivée absente ; titre vide → « Vidéo sans titre »", async () => {
    await semer(
      el("A", { plages: [plage("p1"), plage("p2", { finSec: 2 })] }),
      el("R", { rangee: true }),
      el("X", { archiveLe: NOW }),
      el("Z"),
    );
    await titrer("v-Z", "");
    const r = await sourcesPourRetoucheExtraitV4("V", ports());
    expect(r).toEqual([
      { videoId: "v-A", titre: "Vidéo sans titre", plages: 1 },
      { videoId: "v-Z", titre: "Vidéo sans titre", plages: 1 },
    ]);
  });
  it("tri par titre (français)", async () => {
    await semer(el("A"), el("B"));
    await titrer("v-A", "Zèbre");
    await titrer("v-B", "Abeille");
    expect((await sourcesPourRetoucheExtraitV4("V", ports())).map((s) => s.titre)).toEqual(["Abeille", "Zèbre"]);
  });
  it("d) cohérence : chaque source rendue donne un extrait au choix réel", async () => {
    await semer(el("A"), el("B", { plages: [plage("p1", { texteIncruste: true })] }), el("C", { plages: [plage("p1", { finSec: 2 })] }));
    const r = await sourcesPourRetoucheExtraitV4("V", ports());
    expect(r.length).toBe(1);
    for (const s of r) {
      const choix = await extraitMaisonPourRecherche(
        { recherche: "axion:facture", dureeFenetreSec: 3, videoId: "V", dejaPris: [], recents: [] }, ports());
      expect(choix).not.toBeNull();
      expect(choix?.extrait.cle.startsWith(`extrait:${s.videoId.replace("v-", "")}:`)).toBe(true);
    }
  });
  it("e) les deux constantes recopiées sont celles du service réel", () => {
    const reel = readFileSync("src/services/extraits-maison-v4.ts", "utf8");
    const neuf = readFileSync("src/services/sources-retouche-extrait-v4.ts", "utf8");
    for (const re of [/const CAPACITE_EXTRAIT = [^;]+;/, /const TOUS_RESEAUX[^;]+;/]) {
      const a = reel.match(re)?.[0];
      expect(a).toBeTruthy();
      expect(neuf).toContain(a!);
    }
  });
  it("f) éteint = identique : archive vide → [], dépôt qui lève → [], aucun état partagé", async () => {
    expect(await sourcesPourRetoucheExtraitV4("V", ports())).toEqual([]);
    await semer(el("A"));
    const avant = await extraitMaisonPourRecherche({ recherche: "axion:facture", dureeFenetreSec: 3, videoId: "V", dejaPris: [], recents: [] }, ports());
    await sourcesPourRetoucheExtraitV4("V", ports());
    const apres = await extraitMaisonPourRecherche({ recherche: "axion:facture", dureeFenetreSec: 3, videoId: "V", dejaPris: [], recents: [] }, ports());
    expect(apres).toEqual(avant);
    const casse = (() => ({ elements: { lister: async () => { throw new Error("panne"); } } })) as unknown as typeof depots;
    expect(await sourcesPourRetoucheExtraitV4("V", { depots: casse, maintenant: () => NOW })).toEqual([]);
  });
  it("aucune écriture", async () => {
    await semer(el("A"));
    const e1 = vi.spyOn(depots().elements, "enregistrer");
    const e2 = vi.spyOn(depots().videos, "enregistrer");
    await sourcesPourRetoucheExtraitV4("V", ports());
    expect(e1).not.toHaveBeenCalled();
    expect(e2).not.toHaveBeenCalled();
  });
  it("g) gardes statiques : server-only, ni réglage ni argent, et aucun fichier de src ne l'importe", () => {
    const src = readFileSync("src/services/sources-retouche-extrait-v4.ts", "utf8");
    expect(src).toContain('import "server-only";');
    expect(src).not.toMatch(/lireParametre/);
    expect(src).not.toMatch(/from "[^"]*(argent|plafond|caisse|budget|cout)[^"]*"/i);
    const marche = (d: string): string[] =>
      readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? marche(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
    const importeurs = marche("src").filter((p) => !p.endsWith("sources-retouche-extrait-v4.ts") && readFileSync(p, "utf8").includes("sources-retouche-extrait-v4"));
    expect(importeurs.map((f) => f.split("\\").join("/"))).toEqual(["src/services/changer-extrait-v4-ecran.ts"]);
  });
});
