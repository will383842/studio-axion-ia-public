/** Registre d'oppositions : rotation des secrets, lignes héritées, échec fermé. Secrets fictifs. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const E = await import("@/domaine/guide-reseau/empreinte-personne");
const Opp = await import("@/services/oppositions-mots");
const C = await import("@/services/_commun");

const S1 = "secret-fictif-numero-un-0123456789abcdef";
const S2 = "secret-fictif-numero-deux-0123456789abcd";
const ENV1 = { [E.VARIABLE_SECRET_EMPREINTE]: S1 };
const ENV2 = { [E.VARIABLE_SECRET_EMPREINTE]: S2, [E.VARIABLE_SECRETS_ANCIENS]: S1 };
const ENV3 = { [E.VARIABLE_SECRET_EMPREINTE]: S2 }; // S1 retiré
const lire = () => C.lireParametre<import("@/services/oppositions-mots").LigneOpposition[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);

beforeEach(() => reinitialiserDepots());
afterEach(() => vi.unstubAllEnvs());

describe("rotation", () => {
  it("opposition faite sous l'ancien secret reconnue après rotation, alias ajouté, ligne d'origine conservée", async () => {
    const p1 = await Opp.enregistrerOpposition("ct_a", "instagram", { env: ENV1 });
    expect(p1).toMatch(/^p1\.[0-9a-f]{8}\.[0-9a-f]{64}$/);
    expect(await Opp.personneOpposee("ct_a", "instagram", { env: ENV2 })).toBe(true);
    const l = await lire();
    expect(l).toHaveLength(1);
    expect(l[0].id).toBe(p1);
    expect(l[0].alias).toHaveLength(1);
    expect(l[0].alias![0]).not.toBe(p1);
    expect(await Opp.personneOpposee("ct_a", "instagram", { env: ENV2 })).toBe(true);
    expect((await lire())[0].alias).toHaveLength(1);
    expect(await Opp.personneOpposee("ct_b", "instagram", { env: ENV2 })).toBe(false);
    expect(await Opp.personneOpposee("ct_a", "facebook", { env: ENV2 })).toBe(false);
  });
  it("réenregistrer après rotation ne crée pas de doublon et rend l'empreinte courante", async () => {
    await Opp.enregistrerOpposition("ct_a", "instagram", { env: ENV1 });
    const p = await Opp.enregistrerOpposition("ct_a", "instagram", { env: ENV2 });
    const k = E.lireClesEmpreinte(ENV2);
    expect(k.ok && p).toBe(k.ok && E.empreintePersonne(k.courante, "instagram", "ct_a"));
    expect(await lire()).toHaveLength(1);
  });
  it("ligne héritée SHA-256 reconnue, alias p1 ajouté, ligne conservée", async () => {
    const h = E.empreinteHeritee("ct_old");
    await C.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [{ id: h, le: "2026-01-01T00:00:00.000Z", transmise: false }]);
    expect(await Opp.personneOpposee("ct_old", "zernio-contact", { env: ENV1 })).toBe(true);
    const l = await lire();
    expect(l).toHaveLength(1);
    expect(l[0].id).toBe(h);
    expect(l[0].alias).toHaveLength(1);
  });
  it("ancien secret retiré alors que des lignes existent sous son kid : erreur", async () => {
    await Opp.enregistrerOpposition("ct_a", "instagram", { env: ENV1 });
    await expect(Opp.personneOpposee("ct_z", "instagram", { env: ENV3 })).rejects.toBeInstanceOf(E.ErreurEmpreinteIndisponible);
  });
});

describe("échec fermé", () => {
  it("clés manquantes sur la nouvelle voie : erreur, jamais « non opposée »", async () => {
    await expect(Opp.personneOpposee("ct_a", "instagram", { env: {} })).rejects.toBeInstanceOf(E.ErreurEmpreinteIndisponible);
    await expect(Opp.enregistrerOpposition("ct_a", "instagram", { env: {} })).rejects.toBeInstanceOf(E.ErreurEmpreinteIndisponible);
  });
  it("appelant non migré sans secret : comportement ancien (forme héritée)", async () => {
    vi.stubEnv(E.VARIABLE_SECRET_EMPREINTE, "");
    await Opp.enregistrerOpposition("ct_vieux");
    expect((await lire())[0].id).toBe(E.empreinteHeritee("ct_vieux"));
    expect(await Opp.personneOpposee("ct_vieux")).toBe(true);
    expect(await Opp.personneOpposee("ct_autre")).toBe(false);
  });
  it("appelant non migré avec secret : forme p1 par défaut « zernio-contact »", async () => {
    vi.stubEnv(E.VARIABLE_SECRET_EMPREINTE, S1);
    await Opp.enregistrerOpposition("ct_n");
    expect((await lire())[0].id).toMatch(/^p1\./);
    expect(await Opp.personneOpposee("ct_n")).toBe(true);
  });
  it("les messages d'erreur ne contiennent ni secret, ni identifiant, ni empreinte", async () => {
    await Opp.enregistrerOpposition("ct_secret_id", "instagram", { env: ENV1 });
    const err = await Opp.personneOpposee("ct_secret_id", "instagram", { env: ENV3 }).catch((e: Error) => e);
    const txt = String((err as Error).message) + String((err as Error).stack);
    for (const m of [S1, S2, "ct_secret_id", "p1."]) expect(txt).not.toContain(m);
  });
});

describe("etatRegistreEmpreintes", () => {
  it("compte par kid, héritées et kids inconnus, sans montrer d'empreinte", async () => {
    await Opp.enregistrerOpposition("ct_1", "instagram", { env: ENV1 });
    await Opp.enregistrerOpposition("ct_2", "facebook", { env: ENV1 });
    await Opp.enregistrerOpposition("ct_3", "instagram", { env: ENV2 });
    await C.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [...(await lire()), { id: E.empreinteHeritee("x"), le: "2026-01-01T00:00:00.000Z", transmise: false }]);
    const k1 = E.lireClesEmpreinte(ENV1), k2 = E.lireClesEmpreinte(ENV2);
    const etat = await Opp.etatRegistreEmpreintes({ env: ENV3 });
    expect(etat.heritees).toBe(1);
    expect(etat.lignesParKid[k2.ok ? k2.courante.kid : ""]).toBe(1);
    expect(etat.kidsInconnus).toEqual([k1.ok ? k1.courante.kid : ""]);
    expect(JSON.stringify(etat)).not.toMatch(/[0-9a-f]{32}/);
  });
});
