/**
 * CAL-21 : une seule fonction de validation (services/valider-entree.ts), appelée par validerEntree (ajouter.ts) et accepterEntree (statuts.ts).
 * Faux dépôt, faux envoi : aucun appel réel, aucun réglage écrit, données fictives.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { validerEntree, PHRASE_HEURE_PASSEE_VALIDATION, type DepsValiderEntree } from "@/services/valider-entree";
import type { CreneauPlan } from "@/services/plan-editorial";
import type { LigneCreneau } from "@/services/envoi-depuis-creneau";

const MAINT = new Date("2026-11-20T10:00:00Z");
const creneau = (o: Partial<CreneauPlan> = {}): CreneauPlan => ({
  id: "c1", jourVise: "2026-12-03", heuresParReseau: { linkedin: "2026-12-03T08:00:00.000Z" }, compteCible: "compte-fictif-1", statut: "propose", decalages: 0, videoId: "v1", ...o,
});

function faux(c: CreneauPlan | null, ligne?: Partial<LigneCreneau>, reglagesOuverts = false) {
  let courant = c;
  const envoyer = vi.fn(async (id: string): Promise<LigneCreneau | undefined> => ({ cle: "k", creneauId: id, etat: "brouillon-cree", ...ligne }));
  const deps: DepsValiderEntree = {
    obtenir: async () => courant,
    enregistrer: async (x) => { courant = x; return x; },
    versAValider: async () => { if (courant) courant = { ...courant, statut: "a_valider" }; },
    reglagesOuverts: async () => reglagesOuverts,
    envoyer,
  };
  return { deps, envoyer, lire: () => courant };
}

describe("CAL-21 · service unique", () => {
  it("écrit seulement `valide` + valideeLe/valideePar, jamais `programme`", async () => {
    const f = faux(creneau());
    const r = await validerEntree(f.deps, "c1", "fondateur-1", MAINT);
    expect(r.ok).toBe(true);
    const l = f.lire()!;
    expect(l.statut).toBe("valide");
    expect(l.valideePar).toBe("fondateur-1");
    expect(l.valideeLe).toBe(MAINT.toISOString());
  });

  it("appelle l'envoi du créneau une seule fois, et pas deux fois sur un double clic", async () => {
    const f = faux(creneau(), undefined, true);
    await validerEntree(f.deps, "c1", "f", MAINT);
    await validerEntree(f.deps, "c1", "f", MAINT);
    expect(f.envoyer).toHaveBeenCalledTimes(1);
  });

  it("réglages fermés : libellé « Programmé, envoi éteint », jamais « Partira seule »", async () => {
    const f = faux(creneau(), { etat: "envoi-eteint" }, false);
    const r = await validerEntree(f.deps, "c1", "f", MAINT);
    if (!r.ok) throw new Error("attendu ok");
    expect(r.libelle).toMatch(/envoi éteint/);
    expect(r.libelle).not.toMatch(/Partira seule/);
  });

  it("réglages ouverts et brouillon confirmé : « Partira seule à <heure de Paris> »", async () => {
    const f = faux(creneau(), { etat: "brouillon-cree" }, true);
    const r = await validerEntree(f.deps, "c1", "f", MAINT);
    if (!r.ok) throw new Error("attendu ok");
    expect(r.libelle).toBe("Partira seule à 09:00 (heure de Paris).");
  });

  it("heure passée : refus sans écriture ni appel", async () => {
    const f = faux(creneau({ jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T08:00:00.000Z" } }));
    const r = await validerEntree(f.deps, "c1", "f", MAINT);
    expect(r).toMatchObject({ ok: false, message: PHRASE_HEURE_PASSEE_VALIDATION });
    expect(f.lire()!.statut).toBe("propose");
    expect(f.envoyer).not.toHaveBeenCalled();
  });

  it("à moins de 30 min : message en vouvoiement qui propose une autre heure, rien n'est appelé", async () => {
    const f = faux(creneau({ jourVise: "2026-11-20", heuresParReseau: { linkedin: "2026-11-20T10:20:00.000Z" } }));
    const r = await validerEntree(f.deps, "c1", "f", MAINT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.libelle).toMatch(/Choisissez une autre heure/);
    expect(f.envoyer).not.toHaveBeenCalled();
  });

  it("TikTok sans consentement ou niveau : validé, « à compléter », pas de blocage", async () => {
    const f = faux(creneau({ heuresParReseau: { tiktok: "2026-12-03T08:00:00.000Z" } }), { etat: "refuse" }, true);
    const r = await validerEntree(f.deps, "c1", "f", MAINT);
    expect(r.ok).toBe(true);
    expect(f.lire()!.statut).toBe("valide");
  });

  it("créneau introuvable : refus clair", async () => {
    const f = faux(null);
    expect(await validerEntree(f.deps, "x", "f", MAINT)).toMatchObject({ ok: false });
  });

  it("une erreur de l'envoi ne défait pas la validation", async () => {
    const f = faux(creneau());
    f.envoyer.mockRejectedValueOnce(new Error("coupure"));
    const r = await validerEntree(f.deps, "c1", "f", MAINT);
    expect(r.ok).toBe(true);
    expect(f.lire()!.statut).toBe("valide");
  });
});

describe("CAL-21 · les deux actions passent par le service", () => {
  const lire = (p: string) => readFileSync(p, "utf8");
  for (const [fichier, nom] of [["src/app/(studio)/calendrier/actions/ajouter.ts", "validerEntree"], ["src/app/(studio)/calendrier/actions/statuts.ts", "accepterEntree"]] as const) {
    it(`${nom} appelle services/valider-entree et jamais validerProposition`, () => {
      const src = lire(fichier);
      expect(src).toMatch(/services\/valider-entree/);
      expect(src).not.toMatch(/validerProposition\s*\(/);
    });
  }
});

describe("CAL-21 suite · réglages absents", () => {
  it("réglages absents, illisibles ou autres que `true` : 0 appel au faux diffuseur, validation acquise", async () => {
    for (const valeur of [undefined, null, "true", 1]) {
      const f = faux(creneau());
      f.deps.reglagesOuverts = async () => valeur as unknown as boolean;
      const r = await validerEntree(f.deps, "c1", "f", MAINT);
      expect(r.ok).toBe(true);
      expect(f.envoyer).toHaveBeenCalledTimes(0);
      expect(f.lire()!.statut).toBe("valide");
    }
    const g = faux(creneau());
    g.deps.reglagesOuverts = async () => { throw new Error("réglage illisible"); };
    expect((await validerEntree(g.deps, "c1", "f", MAINT)).ok).toBe(true);
    expect(g.envoyer).toHaveBeenCalledTimes(0);
  });

  it("validerEntreeServeur est exporté (fonction à deux arguments)", async () => {
    const m = await import("@/services/valider-entree");
    expect(typeof m.validerEntreeServeur).toBe("function");
    expect(m.validerEntreeServeur.length).toBe(2);
  });
});
