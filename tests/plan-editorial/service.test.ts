/**
 * L1-08 : service du plan éditorial. Dépôts en mémoire (doublures locales), aucun appel réel, données fictives.
 */
import { describe, expect, it } from "vitest";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import {
  annuler, changerStatut, creerCreneau, decaler, identifiantsProgrammation, lirePeriode, peutProgrammer,
  type CreneauPlan, type DepotsPlan,
} from "@/services/plan-editorial";

function faux<T extends { id: string }>(): Depot<T> {
  const m = new Map<string, T>();
  return {
    async lister(f) { return [...m.values()].filter((e) => !f || f(e)).map((e) => structuredClone(e)); },
    async obtenir(id) { const e = m.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...m.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { m.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) {
      const e = m.get(id);
      if (!e) throw new Error("absent");
      const n = { ...e, ...p }; m.set(id, n); return structuredClone(n);
    },
  } as Depot<T>;
}
function depots(): DepotsPlan & { journal: Depot<JournalDecalage> } {
  return { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>() };
}
const T0 = "2026-11-20T10:00:00.000Z";
const base = (id: string, extra: Partial<CreneauEditorial> = {}): Omit<CreneauEditorial, "statut" | "decalages"> => ({
  id, jourVise: "2026-11-25", heuresParReseau: { linkedin: "2026-11-25T08:30:00.000Z" }, compteCible: "compte-fictif-1", videoId: "v1", ...extra,
});

describe("plan éditorial : création", () => {
  it("crée un créneau propose, sans décalage ; même id = une seule ligne", async () => {
    const d = depots();
    const a = await creerCreneau(d, base("c1"), T0);
    const b = await creerCreneau(d, base("c1", { jourVise: "2026-12-01" }), T0);
    expect(a.statut).toBe("propose");
    expect(a.decalages).toBe(0);
    expect(b.jourVise).toBe("2026-11-25");
    expect(await d.creneaux.lister()).toHaveLength(1);
  });
  it("refuse un créneau invalide (vidéo ET visuel)", async () => {
    await expect(creerCreneau(depots(), base("c2", { visuelId: "x" }), T0)).rejects.toThrow(/vidéo et un visuel/);
  });
});

describe("plan éditorial : décalage et journal en ajout seul", () => {
  it("un décalage = une ligne de journal ; l'heure de Paris est conservée", async () => {
    const d = depots();
    await creerCreneau(d, base("c1"), T0);
    const c = await decaler(d, "c1", { nouveauJour: "2026-11-27", raison: "essai", cle: "k1" }, T0);
    expect(c.jourVise).toBe("2026-11-27");
    expect(c.heuresParReseau.linkedin).toBe("2026-11-27T08:30:00.000Z");
    expect(c.decalages).toBe(1);
    const lignes = await d.journal.lister();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ creneauId: "c1", ancienJour: "2026-11-25", nouveauJour: "2026-11-27", raison: "essai" });
  });
  it("même clé d'idempotence = une seule ligne, un seul décalage", async () => {
    const d = depots();
    await creerCreneau(d, base("c1"), T0);
    await decaler(d, "c1", { nouveauJour: "2026-11-27", raison: "r", cle: "k1" }, T0);
    const again = await decaler(d, "c1", { nouveauJour: "2026-11-27", raison: "r", cle: "k1" }, T0);
    expect(await d.journal.lister()).toHaveLength(1);
    expect(again.decalages).toBe(1);
  });
  it("décaler un créneau publié lève une erreur et n'écrit rien", async () => {
    const d = depots();
    await creerCreneau(d, base("c1"), T0);
    for (const s of ["a_valider", "valide", "programme", "publie"] as const) await changerStatut(d, "c1", s, "studio", T0);
    await expect(decaler(d, "c1", { nouveauJour: "2026-11-27", raison: "r", cle: "k" }, T0)).rejects.toThrow(/publi/);
    expect(await d.journal.lister()).toHaveLength(0);
  });
  it("décaler un créneau confié à l'usine pose aRenvoyer, sans aucun appel", async () => {
    const d = depots();
    await creerCreneau(d, base("c1", { repereUsine: "rep-1", signatureUsine: "sig-1" }), T0);
    const c = await decaler(d, "c1", { nouveauJour: "2026-11-26", raison: "r", cle: "k" }, T0);
    expect(c.aRenvoyer).toBe(true);
    await creerCreneau(d, base("c2"), T0);
    expect((await decaler(d, "c2", { nouveauJour: "2026-11-26", raison: "r", cle: "k2" }, T0)).aRenvoyer).toBeFalsy();
  });
  it("refuse un jour invalide et un créneau inconnu", async () => {
    const d = depots();
    await creerCreneau(d, base("c1"), T0);
    await expect(decaler(d, "c1", { nouveauJour: "demain", raison: "r", cle: "k" }, T0)).rejects.toThrow(/jour/i);
    await expect(decaler(d, "nope", { nouveauJour: "2026-11-27", raison: "r", cle: "k" }, T0)).rejects.toThrow(/introuvable/);
  });
});

describe("plan éditorial : statuts, annulation, période", () => {
  it("l'usine n'écrit jamais programme ; transition hors tableau refusée", async () => {
    const d = depots();
    await creerCreneau(d, base("c1"), T0);
    await changerStatut(d, "c1", "a_valider", "usine", T0);
    await expect(changerStatut(d, "c1", "programme", "usine", T0)).rejects.toThrow();
    await expect(changerStatut(d, "c1", "publie", "studio", T0)).rejects.toThrow(/refusée/);
  });
  it("annuler archive ; un créneau publié ne s'annule pas par le service en dehors du tableau", async () => {
    const d = depots();
    await creerCreneau(d, base("c1"), T0);
    expect((await annuler(d, "c1", "studio", T0)).statut).toBe("archive");
    expect(await d.creneaux.obtenir("c1")).not.toBeNull();
  });
  it("lirePeriode : bornes incluses, triées par jour, archivés exclus par défaut", async () => {
    const d = depots();
    await creerCreneau(d, base("a", { jourVise: "2026-11-30" }), T0);
    await creerCreneau(d, base("b", { jourVise: "2026-11-25" }), T0);
    await creerCreneau(d, base("c", { jourVise: "2026-12-05" }), T0);
    await creerCreneau(d, base("z", { jourVise: "2026-11-26" }), T0);
    await annuler(d, "z", "studio", T0);
    expect((await lirePeriode(d, "2026-11-25", "2026-11-30")).map((c) => c.id)).toEqual(["b", "a"]);
    expect((await lirePeriode(d, "2026-11-25", "2026-11-30", { avecArchives: true })).map((c) => c.id)).toEqual(["b", "z", "a"]);
  });
});

describe("plan éditorial : porte unique peutProgrammer", () => {
  const c = (extra: Partial<CreneauPlan> = {}): CreneauPlan => ({ ...base("c1"), statut: "valide", decalages: 0, ...extra });
  it("accepte un créneau validé complet", () => { expect(peutProgrammer(c())).toEqual({ ok: true }); });
  it("refuse tout statut autre que valide", () => {
    for (const s of ["propose", "a_valider", "programme", "publie", "echec", "archive"] as const) expect(peutProgrammer(c({ statut: s })).ok).toBe(false);
  });
  it("refuse sans heure, sans média, ou à renvoyer", () => {
    expect(peutProgrammer(c({ heuresParReseau: {} })).ok).toBe(false);
    expect(peutProgrammer(c({ videoId: undefined })).ok).toBe(false);
    expect(peutProgrammer(c({ aRenvoyer: true })).ok).toBe(false);
  });
  it("correspondance des identifiants : une clé d'envoi par réseau géré par les envois planifiés", () => {
    const ids = identifiantsProgrammation(c({ heuresParReseau: { linkedin: "2026-11-25T08:30:00.000Z", youtube: "2026-11-25T09:00:00.000Z" }, decalages: 2 }));
    expect(ids).toEqual([{ reseau: "linkedin", cle: "envoi:v1:linkedin:v2" }]);
  });
});
