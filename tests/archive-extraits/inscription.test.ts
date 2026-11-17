/**
 * C3-UT-3.6b : service d'inscription de l'archive des extraits. Base en mémoire, horloge injectée, aucun appel externe.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TAILLE_MAX_FICHE_CARACTERES } from "@/domaine/archive-extraits";
import type { Video, VersionVideo, Sortie, SousTitres, Fichier, Plan } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/archive-extraits");

const T0 = "2026-11-17T10:00:00.000Z";
const apres = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();
const ANCIEN = "2026-11-01T00:00:00.000Z";
const INSCRIPTION = "bibliothequeVideo.archive.inscription";
const SOURCES = "bibliothequeVideo.archive.sources";
let horlogeMin = 0;
const ports = () => ({ maintenant: () => apres(horlogeMin) });

function mots(depart: number, phrases: string[]) {
  let t = depart;
  return phrases.map((texte) => {
    const m = texte.split(" ").map((mot, i) => ({ mot, debutSec: t + i * 0.4, finSec: t + i * 0.4 + 0.35 }));
    t += m.length * 0.4 + 0.6;
    return m;
  });
}

async function semer(id: string, o: { video?: Partial<Video>; essai?: boolean; cle?: string; sousTitres?: boolean; modifieLe?: string; vue?: boolean } = {}) {
  const d = depots();
  const base = { creeLe: ANCIEN, modifieLe: o.modifieLe ?? ANCIEN };
  await d.videos.enregistrer({
    id, titre: `Vidéo ${id}`, formatId: "avocat", statut: "prete", etapeEditoriale: "publiee", marqueId: "m1", styles: {}, entrees: {}, reglages: {},
    versionChoisieId: `ver-${id}`, ...base, ...o.video,
  } as unknown as Video);
  await d.versions.enregistrer({
    id: `ver-${id}`, videoId: id, numero: 1, statut: "prete", choisie: true, ...base,
    commande: { versionContrat: 2, moteurId: o.essai ? "simulation" : "montage-avocat", videoId: id, formatId: "avocat" },
  } as unknown as VersionVideo);
  await d.fichiers.enregistrer({ id: `fic-${id}`, cleStockage: o.cle ?? `studio/prod/video/${id}/a.mp4`, nom: "a.mp4", mime: "video/mp4", taille: 1, origine: "genere", statut: "pret", ...base } as unknown as Fichier);
  await d.sorties.enregistrer({ id: `sor-${id}`, videoId: id, versionId: `ver-${id}`, ratio: "9:16", appelAuMot: false, fichierId: `fic-${id}`, dureeSec: 60, ...base } as unknown as Sortie);
  if (o.sousTitres !== false) {
    const segs = mots(1, ["Bonjour à tous voici une première phrase claire.", "Ensuite une deuxième phrase tout aussi claire."]).map((m, i) => ({ id: `s${i}`, debutSec: m[0].debutSec, finSec: m[m.length - 1].finSec, mots: m }));
    await d.sousTitres.enregistrer({ id: `st-${id}`, videoId: id, versionId: `ver-${id}`, langue: "fr", version: 1, segments: segs, ...base } as unknown as SousTitres);
  }
}

beforeEach(() => {
  reinitialiserDepots();
  horlogeMin = 0;
  vi.restoreAllMocks();
});

describe("interrupteur absent", () => {
  it("zéro écriture, zéro lecture de vidéos, une seule lecture de paramètre", async () => {
    await semer("a");
    const d = depots();
    const lectureVideos = vi.spyOn(d.videos, "lister");
    const lectureVideo = vi.spyOn(d.videos, "obtenir");
    const lectureParam = vi.spyOn(d.parametres, "obtenir");
    const ecritElements = vi.spyOn(d.elements, "enregistrer");
    const ecritParam = vi.spyOn(d.parametres, "enregistrer");
    const r = await svc.inscrireLesVideosPubliees(ports());
    expect(r).toEqual({ traitees: 0, ecrites: 0 });
    expect(lectureVideos).not.toHaveBeenCalled();
    expect(lectureVideo).not.toHaveBeenCalled();
    expect(lectureParam).toHaveBeenCalledTimes(1);
    expect(ecritElements).not.toHaveBeenCalled();
    expect(ecritParam).not.toHaveBeenCalled();
  });
  it("seul `true` exact allume", async () => {
    await semer("a");
    for (const v of ["true", 1, "oui"]) {
      await ecrireParametre(INSCRIPTION, v);
      expect((await svc.inscrireLesVideosPubliees(ports())).traitees).toBe(0);
    }
  });
});

describe("interrupteur allumé", () => {
  beforeEach(async () => ecrireParametre(INSCRIPTION, true));

  it("vidéo publiée avec sous-titres : une fiche, plages utilisables hors fenêtres interdites", async () => {
    await semer("a");
    const d = depots();
    await d.plans.enregistrer({ id: "pl1", videoId: "a", versionId: "ver-a", ordre: 0, debutSec: 0, finSec: 3, texte: "x", sourceImage: "illustration", illustration: { source: "banque", verrouille: false, candidats: [] }, creeLe: ANCIEN, modifieLe: ANCIEN } as unknown as Plan);
    const r = await svc.inscrireLesVideosPubliees(ports());
    expect(r).toEqual({ traitees: 1, ecrites: 1 });
    const fiche = (await svc.ficheDeLaVideo("a"))!;
    expect(fiche.videoId).toBe("a");
    expect(fiche.sourcePreferee).toBe(true);
    expect(fiche.rangee).toBe(false);
    const utilisables = fiche.plages.filter((p) => p.etat === "utilisable");
    expect(utilisables.length).toBeGreaterThan(0);
    for (const p of utilisables) expect(p.debutSec >= 3).toBe(true);
    expect(fiche.plages.some((p) => p.etat === "exclue" && p.raisonExclusion === "tiers")).toBe(true);
    expect((await svc.fichesUtilisables())[0].plages.every((p) => p.etat === "utilisable")).toBe(true);
  });

  it("prête non publiée : rien sous publiees, une fiche sous pretes", async () => {
    await semer("a", { video: { etapeEditoriale: "validee" } });
    expect((await svc.inscrireLesVideosPubliees(ports())).ecrites).toBe(0);
    expect(await svc.ficheDeLaVideo("a")).toBeNull();
    await ecrireParametre(SOURCES, "pretes");
    horlogeMin = 11;
    expect((await svc.inscrireLesVideosPubliees(ports())).ecrites).toBe(1);
    expect(await svc.ficheDeLaVideo("a")).not.toBeNull();
  });

  it("sous cochees : seules les vidéos listées donnent une fiche", async () => {
    await semer("a", { video: { etapeEditoriale: "validee" } });
    await semer("b", { video: { etapeEditoriale: "validee" } });
    await ecrireParametre(SOURCES, "cochees");
    await ecrireParametre("bibliothequeVideo.archive.cochees", ["b"]);
    await svc.inscrireLesVideosPubliees(ports());
    expect(await svc.ficheDeLaVideo("a")).toBeNull();
    expect(await svc.ficheDeLaVideo("b")).not.toBeNull();
  });

  it("valeur inconnue de sources : politique par défaut (publiees)", async () => {
    await semer("a", { video: { etapeEditoriale: "validee" } });
    await ecrireParametre(SOURCES, "n'importe quoi");
    expect((await svc.inscrireLesVideosPubliees(ports())).ecrites).toBe(0);
  });

  it("refus : démonstration, version en essai, sortie /demo/, sans sous-titres", async () => {
    await semer("demo", { video: { estDemo: true } });
    await semer("essai", { essai: true });
    await semer("sortie-demo", { cle: "/demo/avocat-1.mp4" });
    await semer("muet", { sousTitres: false });
    const ecritElements = vi.spyOn(depots().elements, "enregistrer");
    for (const id of ["demo", "essai", "sortie-demo", "muet"]) expect((await svc.inscrireVideo(id, ports())).ecrite).toBe(false);
    expect(ecritElements).not.toHaveBeenCalled();
  });
});

describe("idempotence et gestes", () => {
  beforeEach(async () => ecrireParametre(INSCRIPTION, true));

  it("seconde inscription sans changement : zéro écriture", async () => {
    await semer("a");
    expect((await svc.inscrireVideo("a", ports())).ecrite).toBe(true);
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    expect((await svc.inscrireVideo("a", ports())).ecrite).toBe(false);
    expect(ecrit).not.toHaveBeenCalled();
  });

  it("nouvelle version choisie : plages recalculées, écartée reste écartée, validée garde valideeLe", async () => {
    await semer("a");
    await svc.inscrireVideo("a", ports());
    const d = depots();
    const el = (await d.elements.obtenir(svc.idElementArchive("a")))!;
    if (el.valeur.type !== "source-extraits") throw new Error("type");
    const [p1, p2] = el.valeur.fiche.plages.filter((p) => p.etat === "utilisable");
    p1.etat = "ecartee";
    p1.ecarteeLe = "2026-11-10T00:00:00.000Z";
    p2.valideeLe = "2026-11-11T00:00:00.000Z";
    await d.elements.enregistrer(el);
    // nouvelle version choisie, mêmes mots, autre fichier de sortie
    await d.videos.modifier("a", { versionChoisieId: "ver-a2" });
    const v = (await d.versions.obtenir("ver-a"))!;
    await d.versions.enregistrer({ ...v, id: "ver-a2", numero: 2 });
    const s = (await d.sorties.obtenir("sor-a"))!;
    await d.sorties.enregistrer({ ...s, id: "sor-a2", versionId: "ver-a2" });
    const st = (await d.sousTitres.obtenir("st-a"))!;
    await d.sousTitres.enregistrer({ ...st, id: "st-a2", versionId: "ver-a2" });
    expect((await svc.inscrireVideo("a", ports())).ecrite).toBe(true);
    const fiche = (await svc.ficheDeLaVideo("a"))!;
    expect(fiche.versionId).toBe("ver-a2");
    expect(fiche.plages.find((p) => p.id === p1.id)?.etat).toBe("ecartee");
    const gardee = fiche.plages.find((p) => p.id === p2.id)!;
    expect(gardee.etat).toBe("utilisable");
    expect(gardee.valideeLe).toBe("2026-11-11T00:00:00.000Z");
  });
});

describe("rangement", () => {
  beforeEach(async () => ecrireParametre(INSCRIPTION, true));

  it("archivée : fiche rangée avec archiveLe ; restaurée : remise ; rien n'est supprimé", async () => {
    await semer("a");
    await svc.inscrireVideo("a", ports());
    const d = depots();
    await d.videos.modifier("a", { statut: "archivee" });
    expect(await svc.rangerSiNecessaire((await d.videos.obtenir("a"))!, ports())).toBe(true);
    let el = (await d.elements.obtenir(svc.idElementArchive("a")))!;
    expect(el.archiveLe).toBeTruthy();
    expect((await svc.ficheDeLaVideo("a"))!.rangee).toBe(true);
    expect(await svc.fichesUtilisables()).toEqual([]);
    await d.videos.modifier("a", { statut: "prete" });
    expect(await svc.rangerSiNecessaire((await d.videos.obtenir("a"))!, ports())).toBe(true);
    el = (await d.elements.obtenir(svc.idElementArchive("a")))!;
    expect(el.archiveLe).toBeUndefined();
    expect((await svc.ficheDeLaVideo("a"))!.rangee).toBe(false);
  });
});

describe("limites de passe", () => {
  beforeEach(async () => ecrireParametre(INSCRIPTION, true));

  it("25 vidéos : 20 puis 5 après 10 minutes ; pas de passe avant", async () => {
    for (let i = 0; i < 25; i++) await semer(`v${String(i).padStart(2, "0")}`);
    expect(await svc.inscrireLesVideosPubliees(ports())).toEqual({ traitees: 20, ecrites: 20 });
    horlogeMin = 5;
    expect(await svc.inscrireLesVideosPubliees(ports())).toEqual({ traitees: 0, ecrites: 0 });
    horlogeMin = 11;
    expect(await svc.inscrireLesVideosPubliees(ports())).toEqual({ traitees: 5, ecrites: 5 });
    expect(await depots().elements.compter((e) => e.type === "source-extraits")).toBe(25);
  });

  it("une vidéo qui lève n'arrête pas la passe et rien ne remonte", async () => {
    await semer("a");
    await semer("b");
    const vrai = depots().versions.obtenir.bind(depots().versions);
    vi.spyOn(depots().versions, "obtenir").mockImplementation(async (id: string) => {
      if (id === "ver-a") throw new Error("lecture impossible");
      return vrai(id);
    });
    const r = await svc.inscrireLesVideosPubliees(ports());
    expect(r.traitees).toBe(2);
    expect(await svc.ficheDeLaVideo("b")).not.toBeNull();
    expect(await svc.ficheDeLaVideo("a")).toBeNull();
  });
});

describe("taille", () => {
  it("fiche pleine (30 plages, famille de 10) sous la taille maximale", async () => {
    await ecrireParametre(INSCRIPTION, true);
    const phrases = Array.from({ length: 40 }, (_, i) => `Phrase numéro ${i} ${"mot ".repeat(8)}tout à fait claire.`);
    await semer("a", { sousTitres: false });
    const d = depots();
    const segs = mots(1, phrases).map((m, i) => ({ id: `s${i}`, debutSec: m[0].debutSec, finSec: m[m.length - 1].finSec, mots: m }));
    await d.sousTitres.enregistrer({ id: "st-a", videoId: "a", versionId: "ver-a", langue: "fr", version: 1, segments: segs, creeLe: ANCIEN, modifieLe: ANCIEN } as unknown as SousTitres);
    await d.sorties.modifier("sor-a", { dureeSec: 600 });
    for (let i = 0; i < 9; i++) await d.videos.enregistrer({ id: `f${i}`, titre: "f", formatId: "avocat", statut: "prete", scriptId: "sc", marqueId: "m1", styles: {}, entrees: {}, reglages: {}, creeLe: ANCIEN, modifieLe: ANCIEN } as unknown as Video);
    await d.videos.modifier("a", { scriptId: "sc" });
    await svc.inscrireVideo("a", ports());
    const fiche = (await svc.ficheDeLaVideo("a"))!;
    expect(fiche.famille.length).toBe(10);
    expect(fiche.plages.length).toBeLessThanOrEqual(30);
    expect(JSON.stringify(fiche).length).toBeLessThan(TAILLE_MAX_FICHE_CARACTERES);
  });
});

describe("garde statique", () => {
  it("aucun fournisseur payant, aucun module de rendu ni de génération, aucun outil vidéo", () => {
    const src = readFileSync(new URL("../../src/services/archive-extraits.ts", import.meta.url), "utf8");
    const imports = [...src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) {
      expect(i).not.toMatch(/fournisseurs|generation-claude|studio-rendu|ffmpeg|remotion|anthropic/i);
    }
  });
});
