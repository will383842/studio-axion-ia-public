/** STU-JETONS : alerte (cloche seulement) avant l'expiration d'un jeton de réseau relié à Zernio, ou compte déconnecté. Données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const TITRE = "Zernio : compte ou jeton à surveiller";
const J = 24 * 3600_000;
const T0 = Date.parse("2026-11-10T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const { alertesJetonsZernio, compteSurveilleDepuisZernio } = await import("@/fournisseurs/publication/zernio-alertes-jetons");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");

const compte = (extra: Record<string, unknown> = {}) => ({ id: "exemple-c1", nom: "Compte exemple", ...extra });

describe("fonction pure", () => {
  it("rien à signaler : aucun jeton à risque", () => {
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ actif: true, expireLe: iso(T0 + 30 * J) })], quotaRestantPct: 80 })).toEqual([]);
  });
  it("expiration dans moins de 7 jours : alerte ; à 7 jours pile : rien", () => {
    const a = alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: iso(T0 + 3 * J) })] });
    expect(a).toHaveLength(1);
    expect(a[0].sujet).toBe("jeton:exemple-c1");
    expect(a[0].message).toMatch(/3 jours/);
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: iso(T0 + 7 * J) })] })).toEqual([]);
  });
  it("déjà expiré, déconnecté ou à reconnecter : une seule alerte par compte", () => {
    for (const c of [compte({ expireLe: iso(T0 - J) }), compte({ actif: false }), compte({ aReconnecter: true }), compte({ actif: false, expireLe: iso(T0 - J) })]) {
      const a = alertesJetonsZernio({ maintenant: T0, comptes: [c] });
      expect(a).toHaveLength(1);
      expect(a[0].sujet).toBe("jeton:exemple-c1");
    }
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: iso(T0 - J) })] })[0].message).toMatch(/expiré/);
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ actif: false })] })[0].message).toMatch(/déconnecté/);
  });
  it("quota restant strictement sous 20 % : alerte « quota » ; 20 % pile, absent ou invalide : rien", () => {
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [], quotaRestantPct: 19 }).map((x) => x.sujet)).toEqual(["quota"]);
    for (const q of [20, 50, null, undefined, Number.NaN, -3, 140]) expect(alertesJetonsZernio({ maintenant: T0, comptes: [], quotaRestantPct: q as never })).toEqual([]);
  });
  it("date illisible : n'invente rien, pas d'alerte", () => {
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: "n'importe quoi" })] })).toEqual([]);
  });
  it("aucun identifiant dans le message", () => {
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ actif: false })] })[0].message).not.toContain("exemple-c1");
  });
  it("lecture d'un compte Zernio : isActive, needsReconnection et metadata.tokenExpiresAt seulement", () => {
    expect(compteSurveilleDepuisZernio({ _id: "x1", platform: "instagram", displayName: "Nom", isActive: false, needsReconnection: true, metadata: { tokenExpiresAt: "2026-12-01T00:00:00Z" } } as never)).toEqual({ id: "x1", nom: "instagram", actif: false, aReconnecter: true, expireLe: "2026-12-01T00:00:00Z" });
    expect(compteSurveilleDepuisZernio({ _id: "x2", platform: "facebook" } as never)).toEqual({ id: "x2", nom: "facebook", actif: undefined, aReconnecter: undefined, expireLe: undefined });
  });
});

describe("correction de relecture", () => {
  it("le nom affiché ou le pseudo (personne) ne part jamais dans le message : réseau + rang", () => {
    expect(compteSurveilleDepuisZernio({ _id: "x1", platform: "facebook", displayName: "Prénom Nom", username: "pseudo.perso", isActive: false } as never).nom).toBe("facebook");
    const a = alertesJetonsZernio({ maintenant: T0, comptes: [{ id: "b2", nom: "facebook", actif: false }, { id: "a1", nom: "facebook", actif: false }, { id: "z9", nom: "linkedin", actif: false }] });
    expect(a.find((x) => x.sujet === "jeton:a1")!.message).toMatch(/^facebook n°1 :/);
    expect(a.find((x) => x.sujet === "jeton:b2")!.message).toMatch(/^facebook n°2 :/);
    expect(a.find((x) => x.sujet === "jeton:z9")!.message).toMatch(/^linkedin :/);
  });
  it("une date numérique en secondes Unix est lue comme des secondes (pas 1970)", () => {
    const sec = Math.floor((T0 + 30 * J) / 1000);
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: sec })] })).toEqual([]);
    const proche = alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: Math.floor((T0 + 2 * J) / 1000) })] });
    expect(proche).toHaveLength(1);
    expect(proche[0].message).toMatch(/2 jours/);
  });
  it("une date numérique en millisecondes reste lue comme des millisecondes", () => {
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: T0 + 30 * J })] })).toEqual([]);
    expect(alertesJetonsZernio({ maintenant: T0, comptes: [compte({ expireLe: T0 + 2 * J })] })).toHaveLength(1);
  });
});

describe("service : cloche seulement, une par sujet et par jour", () => {
  beforeEach(() => reinitialiserDepots());
  it("une seule notification par jour pour un sujet, sans push ; le lendemain elle revient", async () => {
    const { alerterJetonsZernio } = await import("@/services/zernio");
    const comptes = [{ _id: "exemple-c1", platform: "instagram", displayName: "Compte exemple", isActive: false }] as never;
    await alerterJetonsZernio(comptes, T0);
    await alerterJetonsZernio(comptes, T0 + 3600_000);
    let liste = (await depots().notifications.lister()).filter((n) => n.titre === TITRE);
    expect(liste).toHaveLength(1);
    expect(liste[0].envoi).toBeUndefined(); // cloche seule : jamais de file d'envoi (push / e-mail)
    await alerterJetonsZernio(comptes, T0 + J);
    liste = (await depots().notifications.lister()).filter((n) => n.titre === TITRE);
    expect(liste).toHaveLength(2);
  });
  it("rien à signaler : aucune notification", async () => {
    const { alerterJetonsZernio } = await import("@/services/zernio");
    await alerterJetonsZernio([{ _id: "c", platform: "instagram", isActive: true }] as never, T0);
    expect((await depots().notifications.lister()).filter((n) => n.titre === TITRE)).toHaveLength(0);
  });
});

describe("service : concurrence, échec de création, purge", () => {
  beforeEach(() => reinitialiserDepots());
  const comptes = [{ _id: "exemple-c1", platform: "instagram", isActive: false }] as never;
  it("deux synchronisations simultanées : une seule alerte", async () => {
    const { alerterJetonsZernio } = await import("@/services/zernio");
    await Promise.all([alerterJetonsZernio(comptes, T0), alerterJetonsZernio(comptes, T0 + 1000)]);
    expect((await depots().notifications.lister()).filter((n) => n.titre === TITRE)).toHaveLength(1);
  });
  it("si la création de la notification échoue, la marque n'est pas écrite : l'alerte reviendra", async () => {
    const svc = await import("@/services/zernio");
    const notif = await import("@/services/notifications");
    const espion = vi.spyOn(notif, "creerNotification").mockRejectedValueOnce(new Error("panne"));
    await svc.alerterJetonsZernio(comptes, T0).catch(() => undefined);
    espion.mockRestore();
    await svc.alerterJetonsZernio(comptes, T0 + 1000);
    expect((await depots().notifications.lister()).filter((n) => n.titre === TITRE)).toHaveLength(1);
  });
  it("l'état ne garde que les sujets du jour : un compte disparu est purgé", async () => {
    const { alerterJetonsZernio, PARAM_ALERTES_JETONS_ZERNIO } = await import("@/services/zernio");
    const { lireParametre } = await import("@/services/_commun");
    await alerterJetonsZernio([{ _id: "vieux", platform: "instagram", isActive: false }] as never, T0);
    await alerterJetonsZernio(comptes, T0 + J);
    const etat = await lireParametre<Record<string, string>>(PARAM_ALERTES_JETONS_ZERNIO, {});
    expect(Object.keys(etat)).toEqual(["jeton:exemple-c1"]);
  });
});
