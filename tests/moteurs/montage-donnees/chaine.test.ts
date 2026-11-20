/**
 * Chaîne du montage « données » (G4-09a). DONNÉE ENTIÈREMENT FICTIVE : aucun chiffre réel.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { nombresPermis } from "../../../src/briques/donnees-video/garde-chiffres";
import { nombresAffirmes, memeValeur } from "../../../src/domaine/nombres-fr";
import { garderPlanScenes } from "../../../src/briques/donnees-video/garde-plan-scenes";
import { chaineMontageDonnees, type PortVoix } from "../../../src/moteurs/montage-donnees/chaine";
import { lireEntreesDonnees } from "../../../src/moteurs/montage-donnees/entrees";
import { proprietesMontageDonnees } from "../../../src/moteurs/montage-donnees/proprietes";

const donnee = (surcharge: Record<string, unknown> = {}) => ({
  version: "tableau-de-bord.v1",
  titre: "Tableau exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Chiffre d'affaires de février", valeur: 10200, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Chiffre d'affaires de mars", valeur: 12480, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "visites", libelle: "Visites du site", valeur: 3450, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Taux de rebond", valeur: 42, unite: "%", precision: 0, sens: "baisse-bonne" },
    { id: "clients", libelle: "Nouveaux clients", valeur: 87, unite: "clients", precision: 0, sens: "hausse-bonne" },
  ],
  series: [],
  comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
  alertes: [{ texte: "Le taux de rebond reste à surveiller", indicateurId: "rebond" }],
  calculs: [{ id: "evolution", formule: "ca-mars / ca-fevrier * 100 - 100", resultat: (12480 / 10200) * 100 - 100 }],
  ...surcharge,
});
const entrees = (d: unknown = donnee(), extra: Record<string, unknown> = {}) => ({ montageDonnees: { donnee: d, ...extra } });

/** Voix factice : un mot toutes les 400 ms. */
function voixDouble(): PortVoix & { lire: ReturnType<typeof vi.fn> } {
  const lire = vi.fn(async (texte: string) => {
    const mots = texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4 }));
    return { audio: "https://exemple.invalide/voix.mp3", dureeSec: mots.length * 0.4, mots };
  });
  return { lire };
}

describe("entrées", () => {
  it("refuse l'absence, un format inconnu et une donnée hors schéma", () => {
    expect(lireEntreesDonnees(undefined).ok).toBe(false);
    expect(lireEntreesDonnees(entrees(donnee(), { ratio: "3:2" })).ok).toBe(false);
    expect(lireEntreesDonnees(entrees({ ...donnee(), champInconnu: 1 })).ok).toBe(false);
  });
  it("muette : seul true exact", () => {
    const m = (v: unknown) => {
      const l = lireEntreesDonnees(entrees(donnee(), { muette: v }));
      return l.ok && l.entrees.muette;
    };
    expect(m(true)).toBe(true);
    expect(m(1)).toBe(false);
    expect(m("true")).toBe(false);
  });
});

describe("chaîne", () => {
  it("donnée valide avec voix : plan non vide, propriétés complètes, plan sous reprise.plan", async () => {
    const voix = voixDouble();
    const r = await chaineMontageDonnees(entrees(), { voix });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(voix.lire).toHaveBeenCalledTimes(1);
    expect(r.muette).toBe(false);
    expect(r.proprietes.plan.scenes.length).toBeGreaterThan(0);
    expect(r.proprietes.audio).toBe("https://exemple.invalide/voix.mp3");
    expect(r.proprietes.sousTitres).toBeDefined();
    expect(r.projetMontage.reprise.plan.plan).toBe(r.proprietes.plan);
    expect(r.projetMontage.reprise.plan.empreinte).toMatch(/^[0-9a-f]{16}$/);
  });

  it("donnée refusée par la garde : erreur claire, aucun appel à la voix", async () => {
    const voix = voixDouble();
    const faux = donnee({ calculs: [{ id: "evolution", formule: "ca-mars / ca-fevrier * 100 - 100", resultat: 99 }] });
    const r = await chaineMontageDonnees(entrees(faux), { voix });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.etape).toBe("garde-chiffres");
    expect(r.erreurs.length).toBeGreaterThan(0);
    expect(voix.lire).not.toHaveBeenCalled();
  });

  it("entrée invalide : arrêt à l'entrée, aucun appel à la voix", async () => {
    const voix = voixDouble();
    const r = await chaineMontageDonnees(entrees({ nimporte: "quoi" }), { voix });
    expect(r).toMatchObject({ ok: false, etape: "entree" });
    expect(voix.lire).not.toHaveBeenCalled();
  });

  it("variante muette (demandée) : aucun appel à la voix, plan sous-titré seul", async () => {
    const voix = voixDouble();
    const r = await chaineMontageDonnees(entrees(donnee(), { muette: true }), { voix });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(voix.lire).not.toHaveBeenCalled();
    expect(r.muette).toBe(true);
    expect(r.proprietes.audio).toBeUndefined();
    expect(r.proprietes.sousTitres).toBeDefined();
    expect(r.proprietes.plan.scenes.length).toBeGreaterThan(0);
  });

  it("sans port voix : muette d'office", async () => {
    const r = await chaineMontageDonnees(entrees());
    expect(r.ok && r.muette && r.proprietes.audio === undefined).toBe(true);
  });

  it("une voix qui échoue arrête la chaîne avec un message", async () => {
    const r = await chaineMontageDonnees(entrees(), { voix: { lire: async () => Promise.reject(new Error("coupée")) } });
    expect(r).toMatchObject({ ok: false, etape: "voix" });
  });

  it("le calage injecté est appelé et ses mots servent", async () => {
    const caler = vi.fn(async (e: { mots: { mot: string; debutSec: number; finSec: number }[] }) => e.mots);
    const r = await chaineMontageDonnees(entrees(), { voix: voixDouble(), calage: { caler } });
    expect(r.ok).toBe(true);
    expect(caler).toHaveBeenCalledTimes(1);
  });

  it("même donnée = même plan (empreinte identique)", async () => {
    const a = await chaineMontageDonnees(entrees(), { voix: voixDouble() });
    const b = await chaineMontageDonnees(entrees(), { voix: voixDouble() });
    expect(a.ok && b.ok && a.projetMontage.reprise.plan.empreinte === b.projetMontage.reprise.plan.empreinte).toBe(true);
    const c = await chaineMontageDonnees(entrees(), {});
    const d = await chaineMontageDonnees(entrees(), {});
    expect(c.ok && d.ok && c.projetMontage.reprise.plan.empreinte === d.projetMontage.reprise.plan.empreinte).toBe(true);
  });

  it("tout chiffre affiché ou dit figure dans la donnée", async () => {
    const d = donnee();
    for (const ports of [{ voix: voixDouble() }, {}]) {
      const r = await chaineMontageDonnees(entrees(d), ports);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const permis = nombresPermis(d as never);
      for (const n of nombresAffirmes(r.texteDit)) expect(permis.some((p) => memeValeur(p, n.valeur))).toBe(true);
      expect(garderPlanScenes(r.proprietes.plan, d as never).ok).toBe(true);
    }
  });

  it("les propriétés ne posent aucun champ vide", () => {
    const r = proprietesMontageDonnees({ plan: { scenes: [] } as never });
    expect(Object.keys(r)).toEqual(["plan"]);
  });
});

describe("garde statique : moteur inscrit, masqué, sans dépense, imports interdits", () => {
  const racine = process.cwd();
  const dossier = join(racine, "src/moteurs/montage-donnees");
  const fichiers = ["entrees.ts", "proprietes.ts", "chaine.ts", "index.ts"].map((f) => join(dossier, f));

  const tous = (rep: string): string[] =>
    readdirSync(rep).flatMap((n) => {
      const p = join(rep, n);
      return statSync(p).isDirectory() ? tous(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });

  it("seuls l'inscription du moteur, ses ids et le format masqué citent montage-donnees (liste exacte, G4-09b)", () => {
    const citeurs = tous(join(racine, "src"))
      .filter((p) => !p.startsWith(dossier))
      .filter((f) => /montage-donnees/.test(readFileSync(f, "utf8")))
      .map((f) => relative(racine, f).split(sep).join("/"))
      .sort();
    expect(citeurs).toEqual(["src/formats/tableau-de-bord/index.ts", "src/moteurs/ids.ts", "src/moteurs/index.ts"]);
  });
  it("ids.ts le cite une fois", () => {
    expect(readFileSync(join(racine, "src/moteurs/ids.ts"), "utf8").match(/montage-donnees/g)).toHaveLength(1);
  });
  it("aucun des 4 fichiers n'importe de module interdit (fournisseur, argent, serveur, rendu)", () => {
    for (const f of fichiers) {
      const imports = readFileSync(f, "utf8").split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
      expect(imports, f).not.toMatch(/@\/fournisseurs|@\/services|credits|couts|budget|server-only|remotion/);
    }
  });
  it("index.ts existe dans le dossier (moteur inscrit, en pause sans dépense)", () => {
    expect(readdirSync(dossier)).toContain("index.ts");
  });
});
