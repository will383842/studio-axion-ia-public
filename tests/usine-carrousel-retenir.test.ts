/**
 * Plan usine #63 · PR B · « Retenir ce sujet » sur une carte CARROUSEL : un brouillon à relire, jamais validé, préparé, programmé ni publié.
 * Aucun réseau, aucun modèle : dépôt en mémoire, faux texte, `fetch` espionné.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DepotMemoire } from "@/donnees/memoire";
import type { Porte } from "@/domaine/visuels/contrats";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { IdeeUsine } from "@/domaine/usine";
import type { DependancesCarrousels } from "@/visuels/services/carrousels";

const espions = vi.hoisted(() => ({ preparer: vi.fn(), valider: vi.fn(), programmer: vi.fn(), publier: vi.fn() }));
vi.mock("@/visuels/services/carrousels", async (orig) => {
  const reel = await orig<typeof import("@/visuels/services/carrousels")>();
  return { ...reel, preparerPourReseaux: espions.preparer, valider: espions.valider };
});

const parametres = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/services/_commun", async (orig) => {
  const reel = await orig<typeof import("@/services/_commun")>();
  return { ...reel, lireParametre: async (id: string, defaut: unknown) => (parametres.has(id) ? parametres.get(id) : defaut), ecrireParametre: async (id: string, v: unknown) => void parametres.set(id, v) };
});

const { creerCarrouselDeLUsine, PHRASE_RESEAU_SANS_CARROUSEL, PHRASE_GENERATEUR_ETEINT_USINE } = await import("@/services/usine-carrousel");

const SPEC = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T21" }] } as CarrouselSpecType;
const ENV = { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: "x".repeat(40) };

const idee: IdeeUsine = {
  signature: "plombier|tpe|devis|d12|c01||carrousel|liste",
  parts: { metier: "plombier", taille: "TPE", format: "carrousel" },
  metier: "Plombier",
  taille: "TPE",
  douleur: "Les devis traînent trois jours.",
  casUsage: "Un devis envoyé dans l'heure.",
  sujet: "Le devis du plombier en une heure",
} as IdeeUsine;

function monter(options: { allume?: boolean; usineOk?: boolean } = {}) {
  const depot = new DepotMemoire<Visuel>();
  let allume = options.allume ?? true;
  let usineOk = options.usineOk ?? true;
  let instant = Date.parse("2026-11-23T10:00:00.000Z");
  let chaine: Promise<unknown> = Promise.resolve();
  const ecrire = vi.fn(async () => ({ titre: "Titre écrit", spec: SPEC, pourquoi: ["inventé"], mode: "simulation" as const }));
  const rendreReseaux = vi.fn(async () => []);
  const deps: DependancesCarrousels = {
    depot,
    texte: () => ({ mode: "simulation" as const, ecrire: () => ecrire() }) as never,
    porte: (() => ({ rapport: { version: "porte-carrousel/1", verdict: "vert", controles: [], corrections: [] }, specCorrige: SPEC })) as Porte,
    contextePorte: async () => ({ interditsDans: () => [], faitsDisponibles: false }),
    allume: async () => allume,
    rendre: async () => { throw new Error("pas de rendu ici"); },
    rendreReseaux,
    urlLecture: async (c) => `https://stockage.invente/${c}`,
    verrou: (f) => {
      const suite = chaine.then(f, f);
      chaine = suite.catch(() => undefined);
      return suite;
    },
    maintenant: () => new Date(instant).toISOString(),
    lireParametre: async <T>(_id: string, defaut: T) => defaut,
    ecrireParametre: async () => undefined,
  };
  const appels: Record<string, unknown>[] = [];
  const fetchEspion = vi.fn(async (_u: unknown, init?: { body?: string }) => {
    appels.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
    return usineOk ? new Response(JSON.stringify({ signature: idee.signature, deja: false }), { status: 200 }) : new Response("{}", { status: 500 });
  });
  vi.stubGlobal("fetch", fetchEspion);
  return { deps, depot, ecrire, rendreReseaux, appels, fetchEspion, eteindre: () => void (allume = false), usineOk: (v: boolean) => void (usineOk = v), avancer: (ms: number) => void (instant += ms) };
}

const lancer = (m: ReturnType<typeof monter>, reseau: string = "instagram") =>
  creerCarrouselDeLUsine(idee, { reseau, jour: "2026-11-24", titre: "Le devis du plombier en une heure" }, m.deps);
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code ?? "AUTRE";
  }
  return "AUCUNE";
};

beforeEach(() => {
  vi.stubEnv("USINE_URL", ENV.USINE_URL);
  vi.stubEnv("USINE_PORTE_SECRET", ENV.USINE_PORTE_SECRET);
  for (const e of Object.values(espions)) e.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("carte carrousel retenue", () => {
  it("un seul visuel carrousel, brouillon à relire, au réseau visé, avec l'origine usine et le jour visé", async () => {
    const m = monter();
    const r = await lancer(m);
    const tous = await m.depot.lister(() => true);
    expect(tous).toHaveLength(1);
    const v = tous[0]!;
    expect(r.id).toBe(v.id);
    expect(v.famille).toBe("carrousel");
    expect(["brouillon", "ecrit"]).toContain(v.statut);
    expect(v.reseaux).toEqual(["instagram"]);
    expect(v.origineUsine).toMatchObject({ signature: idee.signature, typeContenu: "carrousel", parts: idee.parts });
    expect(v.dateVisee).toBe("2026-11-24");
    expect(v.valideLe).toBeUndefined();
  });

  it("l'usine est prévenue par `retenir` : type carrousel, jour, réseau, référence = id du visuel", async () => {
    const m = monter();
    const r = await lancer(m);
    expect(m.appels).toHaveLength(1);
    expect(m.appels[0]).toMatchObject({ signature: idee.signature, type_contenu: "carrousel", jour: "2026-11-24", reseau: "instagram", reference_studio: r.id });
    expect(r.rappelUsine).toBe(false);
    expect((await m.depot.obtenir(r.id))!.origineUsine?.prevenueLe).toBeTruthy();
  });

  it("usine injoignable : le brouillon existe, rappelUsine vrai, pas de prevenueLe", async () => {
    const m = monter({ usineOk: false });
    const r = await lancer(m);
    expect(r.rappelUsine).toBe(true);
    expect((await m.depot.obtenir(r.id))!.origineUsine?.prevenueLe).toBeUndefined();
  });

  it("deux appels : un seul visuel, le second refuse RETENIR_DEJA ; l'usine non prévenue au premier est rappelée au second", async () => {
    const m = monter({ usineOk: false });
    const r = await lancer(m);
    m.usineOk(true);
    m.avancer(120_000);
    expect(await code(lancer(m))).toBe("RETENIR_DEJA");
    expect(await m.depot.lister(() => true)).toHaveLength(1);
    expect(m.appels.at(-1)).toMatchObject({ type_contenu: "carrousel", reference_studio: r.id });
    expect((await m.depot.obtenir(r.id))!.origineUsine?.prevenueLe).toBeTruthy();
    // Prévenue : un troisième appel ne rappelle plus l'usine.
    const avant = m.appels.length;
    expect(await code(lancer(m))).toBe("RETENIR_DEJA");
    expect(m.appels).toHaveLength(avant);
  });

  it("un visuel à la corbeille ne compte pas comme « déjà retenu »", async () => {
    const m = monter();
    const r = await lancer(m);
    await m.depot.modifier(r.id, { corbeilleLe: "2026-11-23T11:00:00.000Z" });
    m.avancer(120_000);
    const r2 = await lancer(m);
    expect(r2.id).not.toBe(r.id);
  });

  it("générateur éteint : phrase exacte, aucun visuel, usine non appelée", async () => {
    const m = monter({ allume: false });
    const e = await lancer(m).catch((x: unknown) => x as { code: string; message: string });
    expect(e).toMatchObject({ message: "Le générateur de carrousels est éteint (Réglages › Carrousels) : allumez-le, puis retenez le sujet." });
    expect(PHRASE_GENERATEUR_ETEINT_USINE).toBe((e as { message: string }).message);
    expect(await m.depot.lister(() => true)).toHaveLength(0);
    expect(m.fetchEspion).not.toHaveBeenCalled();
  });

  it("réseau sans carrousel (tiktok, youtube) : refus avec la phrase, rien d'écrit, usine non appelée", async () => {
    for (const reseau of ["tiktok", "youtube", "youtube-shorts"]) {
      const m = monter();
      const e = await lancer(m, reseau).catch((x: unknown) => x as { message: string });
      expect((e as { message: string }).message).toBe("Ce réseau ne reçoit pas de carrousel : le sujet n'a pas été retenu.");
      expect(PHRASE_RESEAU_SANS_CARROUSEL).toBe((e as { message: string }).message);
      expect(await m.depot.lister(() => true)).toHaveLength(0);
      expect(m.fetchEspion).not.toHaveBeenCalled();
    }
  });

  it("garde : jamais de préparation, de validation, de rendu pour les réseaux ni de programmation", async () => {
    const m = monter();
    await lancer(m, "linkedin");
    expect(espions.preparer).not.toHaveBeenCalled();
    expect(espions.valider).not.toHaveBeenCalled();
    expect(espions.programmer).not.toHaveBeenCalled();
    expect(espions.publier).not.toHaveBeenCalled();
    expect(m.rendreReseaux).not.toHaveBeenCalled();
    const [v] = await m.depot.lister(() => true);
    expect(["valide", "programme", "rendu_en_cours", "a_valider"]).not.toContain(v!.statut);
  });

  it("titre trop long : coupé à 200 signes sur un mot ; titre vide : le sujet, puis la douleur ; lien : refus clair", async () => {
    const m = monter();
    const long = "mot ".repeat(80);
    const r = await creerCarrouselDeLUsine(idee, { reseau: "facebook", jour: "2026-11-24", titre: long }, m.deps);
    const v = (await m.depot.obtenir(r.id))!;
    expect(v.entree.type === "sujet" && v.entree.sujet.length).toBeLessThanOrEqual(200);
    expect(v.entree.type === "sujet" && v.entree.sujet.endsWith("mot")).toBe(true);

    const m2 = monter();
    const r2 = await creerCarrouselDeLUsine({ ...idee, sujet: undefined, signature: "autre" } as IdeeUsine, { reseau: "facebook", jour: "2026-11-24", titre: "" }, m2.deps);
    const v2 = (await m2.depot.obtenir(r2.id))!;
    expect(v2.entree.type === "sujet" && v2.entree.sujet).toBe(idee.douleur);

    const m3 = monter();
    expect(await code(creerCarrouselDeLUsine({ ...idee, signature: "lien" }, { reseau: "facebook", jour: "2026-11-24", titre: "Voir www.exemple.fr" }, m3.deps))).toBe("RETENIR_TEXTE");
    expect(await m3.depot.lister(() => true)).toHaveLength(0);
  });
});

describe("semaine gardée : le type de la carte est conservé", () => {
  const sujet = { signature: "s", parts: {}, metier: "m", taille: "t", douleur: "d", casUsage: "c" };
  it("le type est relu ; absent ou inconnu : vidéo", async () => {
    const { lireDerniereSemaine, PARAM_DERNIERE_SEMAINE } = await import("@/services/proposer-semaine");
    parametres.set(PARAM_DERNIERE_SEMAINE, {
      debut: "2026-11-23",
      propositions: [
        { cle: "a", jour: "2026-11-24", reseau: "instagram", type: "carrousel", sujet },
        { cle: "b", jour: "2026-11-24", reseau: "instagram", sujet },
        { cle: "c", jour: "2026-11-24", reseau: "instagram", type: "n'importe quoi", sujet },
        { cle: "d", jour: "2026-11-24", reseau: "instagram", type: "video", sujet },
      ],
    });
    const d = await lireDerniereSemaine();
    expect(d!.propositions.map((p) => p.type)).toEqual(["carrousel", "video", "video", "video"]);
  });
});
