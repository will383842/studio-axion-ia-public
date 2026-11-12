/** L2-10 : ranger sans réseau les carrousels et images. Dépôt en mémoire, verrou factice : aucun appel réel. */
import { describe, expect, it } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { Visuel } from "@/domaine/visuels/visuel";
import { listerContenusARanger, rangerContenu, type DependancesRangement } from "@/services/rangement-contenus";

const T = (n: number) => new Date(Date.parse("2026-11-01T10:00:00.000Z") + n * 60_000).toISOString();

async function monter() {
  const depot = new DepotMemoire<Visuel>();
  const visuel = (id: string, famille: Visuel["famille"], reseaux: Visuel["reseaux"], n: number, extra: Partial<Visuel> = {}): Visuel => ({
    id, famille, titre: `Visuel ${id}`, entree: { type: "sujet", sujet: "Sujet inventé" }, statut: "valide", modeTexte: "simulation",
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: T(n), modifieLe: T(n), ...(reseaux ? { reseaux } : {}), ...extra,
  });
  await depot.enregistrer(visuel("c1", "carrousel", undefined, 1));
  await depot.enregistrer(visuel("c2", "carrousel", [], 2));
  await depot.enregistrer(visuel("c3", "carrousel", ["linkedin"], 3));
  await depot.enregistrer(visuel("c4", "carrousel", undefined, 4, { corbeilleLe: T(5) }));
  await depot.enregistrer(visuel("i1", "infographie", undefined, 6));
  // verrou en file : chaque appel attend la fin du précédent, comme le vrai verrou.
  let file: Promise<unknown> = Promise.resolve();
  const verrou = <U>(f: () => Promise<U>): Promise<U> => {
    const suite = file.then(f, f);
    file = suite.catch(() => undefined);
    return suite;
  };
  const deps: DependancesRangement = { depot, verrou };
  return { depot, deps };
}

describe("listerContenusARanger", () => {
  it("garde les contenus sans réseau (absent ou vide), hors corbeille, le plus récent d'abord", async () => {
    const { deps } = await monter();
    const l = await listerContenusARanger(deps);
    expect(l.map((c) => c.id)).toEqual(["i1", "c2", "c1"]);
  });
  it("dépôt vide : liste vide", async () => {
    const deps: DependancesRangement = { depot: new DepotMemoire<Visuel>(), verrou: (f) => f() };
    expect(await listerContenusARanger(deps)).toEqual([]);
  });
});

describe("rangerContenu", () => {
  it("un carrousel sans réseau est rangé en un geste et sort de la liste", async () => {
    const { deps, depot } = await monter();
    const r = await rangerContenu("c1", "instagram", deps);
    expect(r).toEqual({ ok: true, deja: false });
    expect((await depot.obtenir("c1"))?.reseaux).toEqual(["instagram"]);
    expect((await listerContenusARanger(deps)).map((c) => c.id)).not.toContain("c1");
  });
  it("un réseau vide [] est rangé aussi", async () => {
    const { deps, depot } = await monter();
    expect((await rangerContenu("c2", "facebook", deps)).ok).toBe(true);
    expect((await depot.obtenir("c2"))?.reseaux).toEqual(["facebook"]);
  });
  it("un second rangement ne crée pas de doublon (rejeu)", async () => {
    const { deps, depot } = await monter();
    await rangerContenu("c1", "linkedin", deps);
    const avant = (await depot.obtenir("c1"))!;
    const r = await rangerContenu("c1", "linkedin", deps);
    expect(r).toEqual({ ok: true, deja: true });
    const apres = (await depot.obtenir("c1"))!;
    expect(apres.reseaux).toEqual(["linkedin"]);
    expect(apres.modifieLe).toBe(avant.modifieLe);
    expect((await depot.lister()).length).toBe(5);
  });
  it("deux gestes en même temps : un seul réseau, une seule écriture", async () => {
    const { deps, depot } = await monter();
    const [a, b] = await Promise.all([rangerContenu("c1", "linkedin", deps), rangerContenu("c1", "linkedin", deps)]);
    expect([a, b].map((x) => (x.ok ? x.deja : null)).sort()).toEqual([false, true]);
    expect((await depot.obtenir("c1"))?.reseaux).toEqual(["linkedin"]);
  });
  it("deux réseaux différents en même temps : le premier gagne, le second est refusé", async () => {
    const { deps, depot } = await monter();
    const [a, b] = await Promise.all([rangerContenu("c1", "linkedin", deps), rangerContenu("c1", "facebook", deps)]);
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: false, code: "DEJA_RANGE" });
    expect((await depot.obtenir("c1"))?.reseaux).toEqual(["linkedin"]);
  });
  it("un contenu déjà rangé sous un autre réseau n'est pas écrasé", async () => {
    const { deps, depot } = await monter();
    const r = await rangerContenu("c3", "facebook", deps);
    expect(r).toMatchObject({ ok: false, code: "DEJA_RANGE" });
    expect((await depot.obtenir("c3"))?.reseaux).toEqual(["linkedin"]);
  });
  it("identifiant inconnu ou vide : introuvable, rien n'est écrit", async () => {
    const { deps, depot } = await monter();
    expect(await rangerContenu("nexiste-pas", "linkedin", deps)).toMatchObject({ ok: false, code: "INTROUVABLE" });
    expect(await rangerContenu("", "linkedin", deps)).toMatchObject({ ok: false, code: "INTROUVABLE" });
    expect((await depot.lister()).length).toBe(5);
  });
  it("un contenu en corbeille n'est pas rangé", async () => {
    const { deps, depot } = await monter();
    expect(await rangerContenu("c4", "linkedin", deps)).toMatchObject({ ok: false, code: "INTROUVABLE" });
    expect((await depot.obtenir("c4"))?.reseaux).toBeUndefined();
  });
  it("un réseau inconnu ou vidéo seulement est refusé", async () => {
    const { deps, depot } = await monter();
    for (const mauvais of ["", "tiktok", "LINKEDIN", "__proto__"]) {
      expect(await rangerContenu("c1", mauvais, deps)).toMatchObject({ ok: false, code: "RESEAU_INVALIDE" });
    }
    expect((await depot.obtenir("c1"))?.reseaux).toBeUndefined();
  });
  it("une infographie est rangée comme un carrousel", async () => {
    const { deps, depot } = await monter();
    expect((await rangerContenu("i1", "linkedin", deps)).ok).toBe(true);
    expect((await depot.obtenir("i1"))?.reseaux).toEqual(["linkedin"]);
  });
});
