import { afterEach, describe, expect, it, vi } from "vitest";
import { creerFauxCrm, MESSAGE_RESEAU_INTERDIT, crochets } from "./helpers";

describe("socle « aucun appel réel » (L0-02)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("un fetch non doublé échoue avec un message clair", async () => {
    await expect(fetch("https://exemple.fr/api")).rejects.toThrow(MESSAGE_RESEAU_INTERDIT);
    await expect(fetch("https://exemple.fr/api")).rejects.toThrow(/https:\/\/exemple\.fr\/api/);
  });

  it("avec une doublure (vi.stubGlobal), le test passe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    expect(await (await fetch("https://exemple.fr/api")).text()).toBe("ok");
  });

  it("le faux CRM répond en mémoire, sans réseau, avec des données fictives", async () => {
    const crm = creerFauxCrm();
    vi.stubGlobal("fetch", crm.fetch);
    const r = await fetch("https://crm.exemple.fr/contacts", { method: "POST", body: JSON.stringify({ email: "lea@exemple.fr" }) });
    expect(r.status).toBe(201);
    const liste = (await (await fetch("https://crm.exemple.fr/contacts")).json()) as { email: string }[];
    expect(liste).toEqual([{ email: "lea@exemple.fr" }]);
    expect(crm.appels).toHaveLength(2);
  });

  it("le faux CRM refuse un contact sans adresse @exemple.fr", async () => {
    const crm = creerFauxCrm();
    const r = await crm.fetch("https://crm.exemple.fr/contacts", { method: "POST", body: JSON.stringify({ email: "vrai@autre.com" }) });
    expect(r.status).toBe(422);
  });

  it("les aides existantes sont ré-exportées", () => {
    expect(typeof crochets.useState).toBe("function");
  });
});
