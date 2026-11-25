/**
 * Plan usine #63 · PR B · l'ACTION « Retenir ce sujet » sur une carte carrousel, de bout en bout : semaine proposée (fetch doublé) → semaine gardée
 * → action → service → dépôt en mémoire. Aucun réseau réel, aucune dépense. L'action ne prend toujours que `debut` et `cle`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
const apres = vi.hoisted(() => ({ taches: [] as (() => Promise<void>)[] }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (f: () => Promise<void>) => void apres.taches.push(f) }));
const parametres = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/services/_commun", async (orig) => {
  const reel = await orig<typeof import("@/services/_commun")>();
  return { ...reel, lireParametre: async (id: string, defaut: unknown) => (parametres.has(id) ? parametres.get(id) : defaut), ecrireParametre: async (id: string, v: unknown) => void parametres.set(id, v) };
});
const rendus = vi.hoisted(() => ({ lancerRendu: vi.fn(async () => undefined), valider: vi.fn(), preparer: vi.fn() }));
vi.mock("@/visuels/services/carrousels", async (orig) => ({ ...(await orig<typeof import("@/visuels/services/carrousels")>()), lancerRendu: rendus.lancerRendu, valider: rendus.valider, preparerPourReseaux: rendus.preparer }));
const banc = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/visuels/services/production", () => ({ dependancesCarrousels: () => banc.deps }));
const ecrireVideo = vi.hoisted(() => vi.fn(async () => ({ id: "suj-1", rappelUsine: false })));
vi.mock("@/services/usine-sujet", () => ({ ecrireSujetDeLUsine: ecrireVideo }));

import { DepotMemoire, reinitialiserDepots } from "@/donnees/memoire";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { DependancesCarrousels } from "@/visuels/services/carrousels";

const { retenirSujetSemaineAction } = await import("@/app/(studio)/calendrier/retenir-sujet");
const { proposerSemaine, PARAM_DERNIERE_SEMAINE } = await import("@/services/proposer-semaine");
const { depots } = await import("@/services/_commun");

const SPEC = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T21" }] } as CarrouselSpecType;
const DEBUT = "2026-11-23";
const sujet = { signature: "plombier|tpe|devis|carrousel", parts: { metier: "plombier" }, metier: "Plombier", taille: "TPE", douleur: "Les devis traînent trois jours.", casUsage: "Un devis dans l'heure.", sujet: "Le sujet du plombier" };
/** Ligne brute telle que l'usine l'envoie (lue par `lireIdeesUsine`). */
const brut = (signature: string, titreSujet: string | null = "Le sujet du plombier") => ({
  signature, parts: { metier: "plombier" }, metier: { code: "plombier", libelle: "Plombier" }, taille: { code: "tpe", libelle: "TPE" },
  douleur: { code: "d1", dite: "Les devis traînent trois jours." }, cas_usage: { code: "c1", titre: "Un devis dans l'heure", ce_que_ca_change: "Gain de temps" },
  ...(titreSujet ? { sujet: { code: "s1", titre: titreSujet } } : {}),
});
const ligne = (o: Record<string, unknown>) => ({ cle: "k", jour: "2026-11-24", reseau: "instagram", type: "carrousel", heure: "09:00", titre: "Titre de la carte", sujet: brut(sujet.signature), ...o });

function monterBanc() {
  const depot = new DepotMemoire<Visuel>();
  let chaine: Promise<unknown> = Promise.resolve();
  let instant = Date.parse("2026-11-23T10:00:00.000Z");
  const deps: DependancesCarrousels = {
    depot,
    texte: () => ({ mode: "simulation" as const, ecrire: async () => ({ titre: "Écrit", spec: SPEC, pourquoi: ["inventé"], mode: "simulation" as const }) }) as never,
    porte: (() => ({ rapport: { version: "porte-carrousel/1", verdict: "vert", controles: [], corrections: [] }, specCorrige: SPEC })) as never,
    contextePorte: async () => ({ interditsDans: () => [], faitsDisponibles: false }),
    allume: async () => true,
    rendre: async () => { throw new Error("pas de rendu"); },
    rendreReseaux: async () => [],
    urlLecture: async (c) => `https://stockage.invente/${c}`,
    verrou: (f) => { const s = chaine.then(f, f); chaine = s.catch(() => undefined); return s; },
    maintenant: () => new Date(instant).toISOString(),
    lireParametre: async <T>(_i: string, d: T) => d,
    ecrireParametre: async () => undefined,
  };
  banc.deps = deps;
  return { depot, avancer: (ms: number) => void (instant += ms) };
}

const retenirAppels: Record<string, unknown>[] = [];
function fetchUsine(lignes: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (u: unknown, init?: { body?: string }) => {
    if (String(u).includes("planification")) return new Response(JSON.stringify({ propositions: lignes }), { status: 200 });
    retenirAppels.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
    return new Response(JSON.stringify({ signature: sujet.signature, deja: false }), { status: 200 });
  }));
}
const proposer = async (lignes: unknown[]) => { fetchUsine(lignes); const r = await proposerSemaine({ debut: DEBUT }, { env: { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: "x".repeat(40) }, maintenant: new Date("2026-11-22T10:00:00Z") }); return r; };

beforeEach(() => {
  reinitialiserDepots();
  parametres.clear();
  apres.taches.length = 0;
  retenirAppels.length = 0;
  for (const f of [rendus.lancerRendu, rendus.valider, rendus.preparer, ecrireVideo]) f.mockClear();
  vi.stubEnv("USINE_URL", "https://usine.test");
  vi.stubEnv("USINE_PORTE_SECRET", "x".repeat(40));
});

describe("action « Retenir ce sujet » : carte carrousel", () => {
  it("aiguille vers le carrousel : un brouillon, `scriptsMaitres` inchangé, le titre de la carte sert de texte, jour et réseau viennent du serveur", async () => {
    const m = monterBanc();
    await proposer([ligne({})]);
    const r = await retenirSujetSemaineAction(DEBUT, "k");
    expect(r).toMatchObject({ ok: true, donnees: { type: "carrousel", rappelUsine: false } });
    expect(await depots().scriptsMaitres.lister(() => true)).toHaveLength(0);
    expect(ecrireVideo).not.toHaveBeenCalled();
    const [v] = await m.depot.lister(() => true);
    expect(v!.entree).toMatchObject({ type: "sujet", sujet: "Titre de la carte" }); // (2) titre, pas `sujet.sujet`
    expect(v!.reseaux).toEqual(["instagram"]);
    expect(v!.dateVisee).toBe("2026-11-24");
    expect(["brouillon", "ecrit"]).toContain(v!.statut);
    expect(retenirAppels).toHaveLength(1);
    expect(retenirAppels[0]).toMatchObject({ type_contenu: "carrousel", jour: "2026-11-24", reseau: "instagram" });
  });

  it("(2) sans titre : le sujet ; sans titre ni sujet : la douleur", async () => {
    let m = monterBanc();
    await proposer([ligne({ titre: undefined })]);
    await retenirSujetSemaineAction(DEBUT, "k");
    expect((await m.depot.lister(() => true))[0]!.entree).toMatchObject({ sujet: "Le sujet du plombier" });
    reinitialiserDepots(); parametres.clear();
    m = monterBanc();
    await proposer([ligne({ titre: undefined, sujet: brut(sujet.signature, null) })]);
    await retenirSujetSemaineAction(DEBUT, "k");
    expect((await m.depot.lister(() => true))[0]!.entree).toMatchObject({ sujet: sujet.douleur });
  });

  it("le rendu part APRÈS la réponse (`after`), une seule fois, sur le bon id, et rien ne valide ni ne prépare", async () => {
    const m = monterBanc();
    await proposer([ligne({})]);
    const r = await retenirSujetSemaineAction(DEBUT, "k");
    expect(rendus.lancerRendu).not.toHaveBeenCalled();
    expect(apres.taches).toHaveLength(1);
    await apres.taches[0]!();
    expect(rendus.lancerRendu).toHaveBeenCalledTimes(1);
    expect(rendus.lancerRendu).toHaveBeenCalledWith(r.ok ? r.donnees.id : "", banc.deps);
    expect(rendus.valider).not.toHaveBeenCalled();
    expect(rendus.preparer).not.toHaveBeenCalled();
    expect((await m.depot.lister(() => true))[0]!.valideLe).toBeUndefined();
  });

  it("un rendu qui échoue après la réponse ne fait rien tomber", async () => {
    monterBanc();
    await proposer([ligne({})]);
    await retenirSujetSemaineAction(DEBUT, "k");
    rendus.lancerRendu.mockRejectedValueOnce(new Error("bloqué par la porte"));
    await expect(apres.taches[0]!()).resolves.toBeUndefined();
  });

  it("deux appels SIMULTANÉS de la même carte : un seul visuel, une seule fois l'usine, le second reçoit « déjà retenu »", async () => {
    const m = monterBanc();
    await proposer([ligne({})]);
    const [a, b] = await Promise.all([retenirSujetSemaineAction(DEBUT, "k"), retenirSujetSemaineAction(DEBUT, "k")]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const refus = (a.ok ? b : a) as { ok: false; erreur?: { message?: string }; message?: string };
    expect(JSON.stringify(refus)).toContain("Ce sujet est déjà retenu.");
    expect(await m.depot.lister(() => true)).toHaveLength(1);
    expect(retenirAppels).toHaveLength(1);
  });

  it("(1) deux cartes au même texte, retenues l'une après l'autre : le premier visuel garde sa signature ; la seconde est refusée clairement", async () => {
    const m = monterBanc();
    const autre = brut("plombier|tpe|devis|carrousel|fb");
    await proposer([ligne({ cle: "k1" }), ligne({ cle: "k2", reseau: "facebook", sujet: autre })]);
    expect((await retenirSujetSemaineAction(DEBUT, "k1")).ok).toBe(true);
    m.avancer(10_000);
    const r2 = await retenirSujetSemaineAction(DEBUT, "k2");
    expect(r2.ok).toBe(false);
    expect(JSON.stringify(r2)).toContain("attendez une minute");
    const tous = await m.depot.lister(() => true);
    expect(tous).toHaveLength(1);
    expect(tous[0]!.origineUsine?.signature).toBe(sujet.signature);
    expect(tous[0]!.reseaux).toEqual(["instagram"]);
    expect(retenirAppels).toHaveLength(1);
    expect(apres.taches).toHaveLength(1); // aucun rendu pour la carte refusée
  });

  it("(3) générateur éteint : la phrase du générateur, jamais « Un souci est survenu »", async () => {
    const m = monterBanc();
    (banc.deps as DependancesCarrousels).allume = async () => false;
    await proposer([ligne({})]);
    const r = await retenirSujetSemaineAction(DEBUT, "k");
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("Le générateur");
    expect(JSON.stringify(r)).not.toContain("Un souci est survenu");
    expect(await m.depot.lister(() => true)).toHaveLength(0);
  });

  it("vidéo, type absent ou inconnu : chemin vidéo inchangé, aucun carrousel", async () => {
    const m = monterBanc();
    await proposer([ligne({ cle: "v", type: "video" })]);
    const brut = parametres.get(PARAM_DERNIERE_SEMAINE) as { propositions: Record<string, unknown>[] };
    brut.propositions.push({ ...brut.propositions[0]!, cle: "sans", type: undefined }, { ...brut.propositions[0]!, cle: "inconnu", type: "n'importe quoi" });
    for (const cle of ["v", "sans", "inconnu"]) {
      const r = await retenirSujetSemaineAction(DEBUT, cle);
      expect(r).toEqual({ ok: true, donnees: { id: "suj-1", rappelUsine: false } });
    }
    expect(ecrireVideo).toHaveBeenCalledTimes(3);
    expect(await m.depot.lister(() => true)).toHaveLength(0);
    expect(apres.taches).toHaveLength(0);
  });
});
