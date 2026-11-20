/** RAP-1 · service de rapatriement : client réduit à `listerPosts` (toute autre propriété lève), dépôts injectés. Données fictives. */
import { describe, expect, it, vi } from "vitest";
import type { Publication } from "@/domaine/types";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";

const { lirePostsAVenirZernio, rapatrierPostsZernio } = await import("@/services/rapatriement-zernio");
const { depots, reinitialiserDepots } = await import("@/donnees/memoire");

const fabrique = (n: number, status: string): PostZernio => ({
  _id: `p-${status}-${n}`,
  content: "t",
  status,
  scheduledFor: "2026-12-01T09:00:00.000Z",
  platforms: [{ platform: "instagram", accountId: "compte-fictif" }],
  metadata: { origine: "import-buffer", studioCle: `imp-${status}-${n}` },
});
const lot = (n: number, status: string) => Array.from({ length: n }, (_, i) => fabrique(i, status));

/** Client factice : sert les posts par statut et par page ; compte les requêtes ; toute autre propriété lève. */
function clientFactice(parStatut: Record<string, PostZernio[]>) {
  const requetes: Record<string, unknown>[] = [];
  const base = {
    async listerPosts(q?: Record<string, string | number | boolean>) {
      requetes.push({ ...q });
      const tous = parStatut[String(q?.status)] ?? [];
      const page = Number(q?.page ?? 1);
      const limite = Number(q?.limit ?? 50);
      return tous.slice((page - 1) * limite, page * limite);
    },
  };
  const client = new Proxy(base, {
    get(cible, cle) {
      if (cle in cible) return (cible as never)[cle];
      throw new Error(`appel interdit : ${String(cle)}`);
    },
  });
  return { client: client as unknown as Pick<import("@/fournisseurs/publication/zernio-client").ClientZernio, "listerPosts">, requetes };
}

describe("RAP-1 · lirePostsAVenirZernio", () => {
  it("130 scheduled + 12 draft → 142 lus en 4 requêtes (scheduled ×2, draft, publishing), lecture complète", async () => {
    const { client, requetes } = clientFactice({ scheduled: lot(130, "scheduled"), draft: lot(12, "draft") });
    const r = await lirePostsAVenirZernio(client, { restant: 6 });
    expect(r.posts).toHaveLength(142);
    expect(r.complete).toBe(true);
    expect(requetes).toHaveLength(4);
    expect(requetes.map((q) => q.status)).toEqual(["scheduled", "scheduled", "draft", "publishing"]);
    expect(requetes.every((q) => q.limit === 100)).toBe(true);
  });

  it("budget à 2 → lecture incomplète (jamais déclarée complète) ; le budget est décompté", async () => {
    const { client, requetes } = clientFactice({ scheduled: lot(130, "scheduled"), draft: lot(12, "draft") });
    const budget = { restant: 2 };
    const r = await lirePostsAVenirZernio(client, budget);
    expect(r.complete).toBe(false);
    expect(requetes).toHaveLength(2);
    expect(budget.restant).toBe(0);
  });

  it("une erreur du diffuseur rend complete:false sans lever", async () => {
    const client = { listerPosts: vi.fn(async () => { throw new Error("débit"); }) };
    const r = await lirePostsAVenirZernio(client as never, { restant: 6 });
    expect(r.complete).toBe(false);
  });
});

function deps(client: ReturnType<typeof clientFactice>["client"], creerSiAbsente = vi.fn(async () => "creee" as const)) {
  return {
    client,
    publications: async () => [] as Publication[],
    clesCreneaux: async () => new Set<string>(),
    nomsComptes: async () => new Map<string, string>(),
    creerSiAbsente,
    instant: () => "2026-11-20T10:00:00.000Z",
    budget: { restant: 6 },
  };
}

describe("RAP-1 · rapatrierPostsZernio", () => {
  it("à blanc (défaut) : on décide et on compte, creerSiAbsente n'est jamais appelé", async () => {
    const { client } = clientFactice({ scheduled: lot(3, "scheduled") });
    const creer = vi.fn(async () => "creee" as const);
    const r = await rapatrierPostsZernio(deps(client, creer));
    expect(creer).not.toHaveBeenCalled();
    expect(r.lus).toBe(3);
    expect(r.crees).toBe(0);
    expect(r.lectureComplete).toBe(true);
  });

  it("aBlanc:false : crée les publications inconnues, une par post", async () => {
    const { client } = clientFactice({ scheduled: lot(3, "scheduled"), draft: lot(2, "draft") });
    const creer = vi.fn(async () => "creee" as const);
    const r = await rapatrierPostsZernio(deps(client, creer), { aBlanc: false });
    expect(creer).toHaveBeenCalledTimes(5);
    expect(r.crees).toBe(5);
  });

  it("lecture incomplète : aucune création n'est déclarée comme écart nul", async () => {
    const { client } = clientFactice({ scheduled: lot(130, "scheduled") });
    const d = deps(client);
    d.budget = { restant: 1 };
    const r = await rapatrierPostsZernio(d);
    expect(r.lectureComplete).toBe(false);
  });

  it("deux créations concurrentes du même identifiant (dépôts en mémoire) → une seule publication", async () => {
    reinitialiserDepots();
    const { depsRapatriementServeur } = await import("@/services/rapatriement-zernio");
    const d = await depsRapatriementServeur();
    const p = { id: "zr_p_c", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-12-01T09:00:00.000Z", texte: "t", idExterne: "p" } as never;
    const res = await Promise.all([d.creerSiAbsente(p), d.creerSiAbsente(p)]);
    expect(res.sort()).toEqual(["creee", "existait"]);
    expect(await depots().publications.compter((x) => x.id === "zr_p_c")).toBe(1);
  });
});
