/**
 * Vérification de bout en bout n° 2 — démarrage du serveur :
 * - données n° 6 : le journal disait « déjà à jour » quand l'étape 19 venait d'ajouter des documents (les étapes 12 à
 *   20 n'étaient pas comptées) et l'étape 19 n'écrivait aucun événement ;
 * - données n° 7 : en production sans `DATABASE_URL`, le studio démarrait sur la démonstration en mémoire ;
 * - données n° 8 : base injoignable au démarrage → réessais puis arrêt (et non un échec gardé à vie) ; sonde de santé.
 */
import { beforeEach, describe, expect, it } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { migrerDonnees, resumeDemarrage, totalChangements } = await import("@/services/migrations");
const { refusDemarrageSansBase, avecReessais, delaiDepasse } = await import("@/lib/demarrage");
const { etatSante } = await import("@/services/sante");

beforeEach(() => reinitialiserDepots());

describe("E2E-2 données n° 6 · journal de démarrage juste", () => {
  it("un rapport qui n'a changé QUE les étapes récentes (19) n'est pas « déjà à jour »", () => {
    const r = { elementsAjoutes: [], elementsConvertis: [], defautsDeplaces: [], visagesMigres: 0, videosMigrees: 0, modelesMigres: 0, mentionMiseAJour: false, lots: { generateur: { tournuresAjoutees: 98, reglesDateesAjoutees: 33, contexteAxion: "ctx" } } };
    expect(totalChangements(r)).toBeGreaterThan(0);
    expect(resumeDemarrage(r)).not.toBe("déjà à jour");
    expect(resumeDemarrage(r)).toMatch(/generateur : 132/);
  });

  it("la migration écrit un événement « Générateur de scripts installé » ; le rejeu est « déjà à jour »", async () => {
    const d = depots();
    const r1 = await migrerDonnees(d, "2026-10-04T08:00:00.000Z");
    expect(r1.lots?.generateur).toBeDefined();
    const ev = await d.evenements.lister((e) => e.id === "ev-migration-generateur-2026-10-04T08:00:00.000Z");
    expect(ev[0]?.message).toMatch(/^Générateur de scripts installé \(\d+ tournures à éviter/);
    const r2 = await migrerDonnees(d, "2026-10-04T09:00:00.000Z");
    expect(resumeDemarrage(r2)).toBe("déjà à jour");
  });
});

describe("E2E-2 données n° 7 · pas de production sans base", () => {
  it("refuse en production sans DATABASE_URL, avec un message clair", () => {
    expect(refusDemarrageSansBase({ NODE_ENV: "production" })).toMatch(/DATABASE_URL manque/);
  });
  it("ne gêne ni la construction, ni les tests, ni le développement, ni un essai local volontaire, ni la production avec base", () => {
    expect(refusDemarrageSansBase({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBeNull();
    expect(refusDemarrageSansBase({ NODE_ENV: "production", VITEST: "true" })).toBeNull();
    expect(refusDemarrageSansBase({ NODE_ENV: "development" })).toBeNull();
    expect(refusDemarrageSansBase({ NODE_ENV: "production", STUDIO_SANS_BASE: "1" })).toBeNull();
    expect(refusDemarrageSansBase({ NODE_ENV: "production", DATABASE_URL: "postgresql://x" })).toBeNull();
  });
  it("le mode mémoire des tests marche toujours (dépôts de démonstration)", async () => {
    expect(await depots().idees.compter()).toBeGreaterThan(0);
  });
});

describe("E2E-2 données n° 8 · réessais au démarrage et sonde de santé", () => {
  it("réessaie jusqu'au succès quand la base revient", async () => {
    let n = 0;
    const essais: number[] = [];
    const v = await avecReessais(async () => {
      if (++n < 3) throw new Error("injoignable");
      return 42;
    }, { essais: 12, delaiMs: 5000, attendre: async () => {}, surEchec: (e) => essais.push(e) });
    expect(v).toBe(42);
    expect(essais).toEqual([1, 2]);
  });
  it("relève l'erreur après le dernier essai (le démarrage arrête alors le processus)", async () => {
    await expect(avecReessais(async () => Promise.reject(new Error("toujours injoignable")), { essais: 3, delaiMs: 1, attendre: async () => {} })).rejects.toThrow("toujours injoignable");
  });
  it("délai dépassé : une sonde qui ne répond pas est rejetée", async () => {
    await expect(delaiDepasse(new Promise(() => {}), 20)).rejects.toThrow(/Pas de réponse/);
    expect(await delaiDepasse(Promise.resolve("ok"), 20)).toBe("ok");
  });
  it("sans base (tests, développement) la sonde dit « memoire », en bonne santé", async () => {
    expect(await etatSante()).toEqual({ ok: true, base: "memoire", boucle: "inactive", version: expect.any(String), bases: expect.objectContaining({ etat: "non-defini" }) });
  });
});
