/** L8-05 : santé des comptes (lecture seule, faux diffuseur, aucun appel réel, données fictives). */
import { describe, expect, it } from "vitest";

const J = 24 * 3600_000;
const T0 = Date.parse("2026-12-21T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const { lireSanteComptes } = await import("@/services/sante-comptes");
const { alertesJetonsZernio, compteSurveilleDepuisZernio } = await import("@/fournisseurs/publication/zernio-alertes-jetons");
const { CarteSanteComptes } = await import("@/components/reglages/CarteSanteComptes");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");

const faux = (comptes: Array<Record<string, unknown>>) => ({ listerComptes: async () => comptes as never });
const c = (id: string, platform: string, extra: Record<string, unknown> = {}) => ({ _id: id, platform, ...extra });

const lire = (comptes: Array<Record<string, unknown>>) => lireSanteComptes({ client: faux(comptes), maintenant: T0 });
const alertes = (comptes: Array<Record<string, unknown>>) => alertesJetonsZernio({ comptes: comptes.map((x) => compteSurveilleDepuisZernio(x as never)), maintenant: T0 });

describe("lireSanteComptes", () => {
  it("compte en règle", async () => {
    const { comptes } = await lire([c("a1", "instagram", { isActive: true, metadata: { tokenExpiresAt: iso(T0 + 30 * J) } })]);
    expect(comptes.map((x) => x.etat)).toEqual(["ok"]);
  });
  it("compte expiré simulé : état expiré ET alerte de STU-JETONS (une seule famille d'alertes)", async () => {
    const brut = [c("a1", "facebook", { metadata: { tokenExpiresAt: iso(T0 - J) } })];
    expect((await lire(brut)).comptes[0].etat).toBe("expire");
    expect(alertes(brut).map((a) => a.sujet)).toEqual(["jeton:a1"]);
  });
  it("bientôt expiré, déconnecté, à reconnecter", async () => {
    const { comptes } = await lire([
      c("a1", "linkedin", { metadata: { tokenExpiresAt: iso(T0 + 2 * J) } }),
      c("a2", "tiktok", { isActive: false }),
      c("a3", "instagram", { needsReconnection: true }),
    ]);
    expect(comptes.map((x) => x.etat)).toEqual(["bientot", "deconnecte", "deconnecte"]);
  });
  it("cas limites : exactement maintenant = expiré ; exactement 7 jours = en règle ; secondes Unix ; date illisible", async () => {
    const m = (v: unknown) => c("a1", "instagram", { metadata: { tokenExpiresAt: v } });
    expect((await lire([m(iso(T0))])).comptes[0].etat).toBe("expire");
    expect((await lire([m(iso(T0 + 7 * J))])).comptes[0].etat).toBe("ok");
    expect((await lire([m(Math.floor((T0 + 2 * J) / 1000))])).comptes[0].etat).toBe("bientot");
    expect((await lire([m("pas une date")])).comptes[0].etat).toBe("ok");
  });
  it("champ absent : en règle, aucune alerte inventée", async () => {
    const brut = [c("a1", "instagram")];
    expect((await lire(brut)).comptes[0].etat).toBe("ok");
    expect(alertes(brut)).toEqual([]);
  });
  it("lecture impossible : état inconnu, pas d'exception", async () => {
    const client = { listerComptes: async () => { throw new Error("coupure"); } };
    const s = await lireSanteComptes({ client, maintenant: T0 });
    expect(s.lecture).toBe("inconnue");
    expect(s.comptes).toEqual([]);
  });
  it("libellés : un rang quand un réseau (même inconnu, même casse) a plusieurs comptes", async () => {
    const { comptes } = await lire([c("b2", "Instagram"), c("b1", "instagram"), c("p1", "pinterest2"), c("p2", "mastodon")]);
    expect(comptes.map((x) => x.libelle)).toEqual(["Instagram n°2", "Instagram n°1", "Autre réseau n°1", "Autre réseau n°2"]);
  });
  it("aucun nom, pseudo ni nom de prestataire, quel que soit l'état", async () => {
    const extra = { username: "pseudo-secret", displayName: "Nom Secret" };
    const { comptes } = await lire([
      c("a1", "instagram", { ...extra, isActive: false }),
      c("a2", "facebook", { ...extra, metadata: { tokenExpiresAt: iso(T0 - J) } }),
      c("a3", "linkedin", { ...extra, metadata: { tokenExpiresAt: iso(T0 + 2 * J) } }),
      c("a4", "tiktok", extra),
    ]);
    expect(comptes.map((x) => x.etat).sort()).toEqual(["bientot", "deconnecte", "expire", "ok"]);
    const texte = JSON.stringify(comptes.map((x) => [x.libelle, x.message]));
    expect(texte).not.toMatch(/secret|zernio|buffer|\bapi\b|jeton/i);
  });
});

describe("carte", () => {
  const rendu = (sante: never, ouverts: string[] = []) => renderToStaticMarkup(createElement(CarteSanteComptes, { sante, ouverts }));
  it("état inconnu et liste vide : un message, aucun bouton", () => {
    expect(rendu({ lecture: "inconnue", comptes: [] } as never)).toMatch(/inconnu/);
    const vide = rendu({ lecture: "ok", comptes: [] } as never);
    expect(vide).toMatch(/Aucun compte/);
    expect(vide).not.toContain("Reconnecter");
  });
  it("compte expiré : bouton Reconnecter, aide liée au bouton ; compte en règle : pas de bouton", async () => {
    const sante = await lire([c("a1", "facebook", { metadata: { tokenExpiresAt: iso(T0 - J) } }), c("a2", "instagram")]);
    const ferme = rendu(sante as never);
    expect(ferme.match(/Reconnecter/g)?.length).toBe(1);
    expect(ferme).toContain('aria-controls="aide-reconnexion-a1"');
    expect(ferme).not.toContain('id="aide-reconnexion-a1"');
    const ouvert = rendu(sante as never, ["a1"]);
    expect(ouvert).toContain('id="aide-reconnexion-a1"');
    expect(ouvert).toMatch(/chez le diffuseur/);
    expect(ouvert).not.toMatch(/zernio|bg-orange|€/i);
  });
});
