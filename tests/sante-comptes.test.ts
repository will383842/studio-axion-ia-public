/** L8-05 : santé des comptes (lecture seule, faux diffuseur, aucun appel réel, données fictives). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const J = 24 * 3600_000;
const T0 = Date.parse("2026-12-21T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const { lireSanteComptes, alertesSanteComptes } = await import("@/services/sante-comptes");

const faux = (comptes: Array<Record<string, unknown>>) => ({ listerComptes: async () => comptes as never });
const c = (id: string, platform: string, extra: Record<string, unknown> = {}) => ({ _id: id, platform, ...extra });

describe("lireSanteComptes", () => {
  it("compte en règle", async () => {
    const { comptes: r } = await lireSanteComptes({ client: faux([c("a1", "instagram", { isActive: true, metadata: { tokenExpiresAt: iso(T0 + 30 * J) } })]), maintenant: T0 });
    expect(r).toHaveLength(1);
    expect(r[0].etat).toBe("ok");
  });
  it("compte expiré simulé : état expiré et alerte", async () => {
    const { comptes: r } = await lireSanteComptes({ client: faux([c("a1", "facebook", { metadata: { tokenExpiresAt: iso(T0 - J) } })]), maintenant: T0 });
    expect(r[0].etat).toBe("expire");
    const a = alertesSanteComptes(r);
    expect(a).toHaveLength(1);
    expect(a[0].sujet).toBe("sante:a1");
  });
  it("bientôt expiré (moins de 7 jours), déconnecté, à reconnecter", async () => {
    const { comptes: r } = await lireSanteComptes({
      client: faux([
        c("a1", "linkedin", { metadata: { tokenExpiresAt: iso(T0 + 2 * J) } }),
        c("a2", "tiktok", { isActive: false }),
        c("a3", "instagram", { needsReconnection: true }),
      ]),
      maintenant: T0,
    });
    expect(r.map((x) => x.etat)).toEqual(["bientot", "deconnecte", "deconnecte"]);
    expect(alertesSanteComptes(r)).toHaveLength(3);
  });
  it("champ absent : en règle, aucune alerte inventée", async () => {
    const { comptes: r } = await lireSanteComptes({ client: faux([c("a1", "instagram")]), maintenant: T0 });
    expect(r[0].etat).toBe("ok");
    expect(alertesSanteComptes(r)).toEqual([]);
  });
  it("lecture impossible : état inconnu, pas d'alerte, pas d'exception", async () => {
    const client = { listerComptes: async () => { throw new Error("coupure"); } };
    const s = await lireSanteComptes({ client, maintenant: T0 });
    expect(s.lecture).toBe("inconnue");
    expect(s.comptes).toEqual([]);
    expect(alertesSanteComptes(s.comptes)).toEqual([]);
  });
  it("ne rend ni nom, ni pseudo, ni identifiant de réseau dans les libellés", async () => {
    const { comptes: r } = await lireSanteComptes({ client: faux([c("a1", "instagram", { username: "pseudo-secret", displayName: "Nom Secret", isActive: false })]), maintenant: T0 });
    const texte = JSON.stringify([r.map((x) => x.libelle), alertesSanteComptes(r)]);
    expect(texte).not.toMatch(/secret/i);
    expect(texte).not.toMatch(/zernio|buffer|api|jeton/i);
  });
});

describe("carte", () => {
  const src = readFileSync("src/components/reglages/CarteSanteComptes.tsx", "utf8");
  it("a un bouton Reconnecter, pas d'appel direct au diffuseur, pas de prix", () => {
    expect(src).toContain("Reconnecter");
    expect(src).not.toMatch(/zernio|fetch\(|€|\bprix\b/i);
    expect(src).not.toMatch(/bg-orange|bg-accent/);
  });
});
