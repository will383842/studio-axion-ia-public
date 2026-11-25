/**
 * ESS-2 · client du service de rendu : une coupure réseau pendant une LECTURE d'état est relue (courte attente), jamais un
 * échec tout de suite ; un 409 (même identifiant, demande différente) est un refus clair, non réessayable. Doubles : aucun
 * réseau réel, aucune vraie attente.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { creerServiceRenduHttp, ErreurRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu } from "@/fournisseurs/types";

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
const coupure = (code = "ECONNRESET") => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(`read ${code}`), { code }) });
const demande = { idRendu: "t-1", operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: "https://depot.test/signe?X-Sig=secret", cle: "k" }, parametres: {} } as unknown as DemandeRendu;

function client(fetchDouble: typeof fetch) {
  const attentes: number[] = [];
  const service = creerServiceRenduHttp("http://rendu.test", { fetch: fetchDouble, attendre: async (ms) => void attentes.push(ms) });
  return { service, attentes };
}

afterEach(() => vi.restoreAllMocks());

describe("ESS-2 · client de rendu : lecture d'état relue après une coupure", () => {
  it("un GET qui lève ECONNRESET une fois puis répond « termine » rend « termine »", async () => {
    const appels: string[] = [];
    const f = (async (url: string) => {
      appels.push(String(url));
      if (appels.length === 1) throw coupure();
      return json({ statut: "termine", sortieCle: "k" });
    }) as unknown as typeof fetch;
    const { service, attentes } = client(f);
    const e = await service.etat("t-1");
    expect(e).toMatchObject({ statut: "termine", sortieCle: "k" });
    expect(appels).toHaveLength(2);
    expect(attentes).toEqual([1000]);
  });

  it("un GET qui lève toujours : trois essais (attentes 1 s puis 3 s), puis ErreurRendu réessayable, cause journalisée sans adresse", async () => {
    const alerte = vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const f = (async () => {
      n++;
      throw coupure("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const { service, attentes } = client(f);
    const erreur = await service.etat("t-1").catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurRendu);
    expect(erreur.reessayable).toBe(true);
    expect(n).toBe(3);
    expect(attentes).toEqual([1000, 3000]);
    const journal = alerte.mock.calls.map((c) => String(c[0])).join("\n");
    expect(journal).toContain("ECONNREFUSED");
    expect(journal).not.toContain("rendu.test");
  });

  it("une soumission (POST) n'est jamais relue : une seule tentative", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const f = (async () => {
      n++;
      throw coupure();
    }) as unknown as typeof fetch;
    const { service, attentes } = client(f);
    await expect(service.soumettre(demande)).rejects.toMatchObject({ reessayable: true });
    expect(n).toBe(1);
    expect(attentes).toEqual([]);
  });

  it("409 à la soumission : refus non réessayable, message clair, aucune adresse", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = (async () => json({ erreur: "demande différente sous le même identifiant" }, 409)) as unknown as typeof fetch;
    const { service } = client(f);
    const erreur = await service.soumettre(demande).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurRendu);
    expect(erreur.erreur.code).toBe("refuse");
    expect(erreur.reessayable).toBe(false);
    expect(erreur.message).toContain("déjà un rendu différent sous cet identifiant : la vidéo doit être relancée");
    expect(erreur.message).not.toMatch(/https?:/);
  });

  it("409 sans corps lisible : même refus clair", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = (async () => new Response("pas du json", { status: 409 })) as unknown as typeof fetch;
    const erreur = await client(f).service.soumettre(demande).catch((e) => e);
    expect(erreur.erreur.code).toBe("refuse");
    expect(erreur.reessayable).toBe(false);
  });
});
