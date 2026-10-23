/**
 * SÉRIE « CHIFFRES » (audit de bout en bout, non bloquants 4.1, 4.2 et 4.5) — Réglages › Budget.
 *  - 4.1 : « Par mois » et « Par poste » ne comptent que ce qui est PAYÉ (ni lignes simulées, ni dépenses d'exemple),
 *    au mois de PARIS ; le mois en cours concorde avec la jauge ;
 *  - 4.5 : les dépenses d'exemple (`estDemo`) ne comptent ni dans la jauge, ni dans « Par outil », ni dans le coût moyen ;
 *  - 4.2 : « Annoncé / réel » ne compare que le payé : un réel en partie simulé ne figure pas comme réel.
 * Dépôts en mémoire, aucune clé, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DepenseEnregistree, LigneCout, Video } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const couts = await import("@/services/couts");
const { coutsParFournisseurEtMois } = await import("@/services/C-videos-publication-complements");

const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (fournisseur: string, c: number, etape = "Voix"): LigneCout => ({ etape, fournisseur, unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "reel" });
const horo = (date: string) => ({ creeLe: date, modifieLe: date });

async function depense(id: string, date: string, lignes: LigneCout[], extra: Partial<DepenseEnregistree> = {}) {
  const total = eur(lignes.reduce((s, l) => s + l.total.centimes, 0));
  await depots().depenses.enregistrer({ id, date, lignes, total, ...horo(date), ...extra });
}

beforeEach(() => {
  reinitialiserDepots();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("4.1 · Budget « Par mois » et « Par poste » : seulement le payé", () => {
  it("le mois en cours de « Par mois » concorde avec la jauge ; les essais (simulés) n'y sont pas", async () => {
    const maintenant = new Date().toISOString();
    await depense("dep-reel", maintenant, [ligne("heygen", 300, "Voix"), ligne("simulation", 200, "Export"), ligne("montage-avocat", 70, "Habillage")]);
    const mois = await coutsParFournisseurEtMois(3);
    const budget = await couts.resumeBudget();
    const courant = mois[mois.length - 1];
    expect(courant.mois).toBe(couts.moisParis());
    expect(courant.total.centimes).toBe(budget.depense.centimes);
    expect(courant.total.centimes).toBe(300);
    expect(courant.parFournisseur).toEqual([{ fournisseur: "Voix", total: eur(300) }]);
  });

  it("mois de Paris : le 31 octobre à 23 h 30 UTC, la dépense compte en novembre, comme dans la jauge", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z"));
    await depense("dep-minuit", "2026-10-31T23:30:00Z", [ligne("heygen", 100)]);
    const mois = await coutsParFournisseurEtMois(3);
    expect(mois.map((m) => m.mois)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(mois.map((m) => m.libelle)).toEqual(["sept.", "oct.", "nov."]);
    expect(mois[2].total.centimes).toBe(100);
    expect(mois[2].total.centimes).toBe((await couts.resumeBudget()).depense.centimes);
  });

  it("une dépense sans détail compte en entier, rangée dans « Autres »", async () => {
    const maintenant = new Date().toISOString();
    await depots().depenses.enregistrer({ id: "dep-nu", date: maintenant, lignes: [], total: eur(42), ...horo(maintenant) });
    const courant = (await coutsParFournisseurEtMois(3)).at(-1)!;
    expect(courant.total.centimes).toBe((await couts.resumeBudget()).depense.centimes);
    expect(courant.parFournisseur).toEqual([{ fournisseur: "Autres", total: eur(42) }]);
  });
});

describe("4.5 · les dépenses d'exemple ne sont jamais de l'argent dépensé", () => {
  it("jauge, « Par mois », « Par poste », « Par outil » : une dépense d'exemple (même « payée ») n'y est pas", async () => {
    const maintenant = new Date().toISOString();
    await depense("dep-exemple", maintenant, [ligne("heygen", 500)], { estDemo: true });
    await depense("dep-vrai", maintenant, [ligne("fal", 80, "Illustrations")]);
    const budget = await couts.resumeBudget();
    expect(budget.depense.centimes).toBe(80);
    expect(budget.parPoste).toEqual([{ poste: "Illustrations", total: eur(80) }]);
    const courant = (await coutsParFournisseurEtMois(3)).at(-1)!;
    expect(courant.total.centimes).toBe(80);
    const tableau = await couts.tableauCouts();
    expect(tableau.parOutil.map((o) => [o.nom, o.total.centimes])).toEqual([["fal.ai", 80]]);
  });

  it("de l'argent payé par une vraie fabrication compte toujours, même sur une vidéo d'exemple", async () => {
    await depense("dep-fab-exemple", new Date().toISOString(), [ligne("heygen", 250)], { estDemo: true, travailId: "trav-1", videoId: "v-01" });
    expect((await couts.resumeBudget()).depense.centimes).toBe(250);
    expect((await coutsParFournisseurEtMois(3)).at(-1)!.total.centimes).toBe(250);
  });

  it("coût moyen : les vidéos d'exemple terminées ce mois-ci ne comptent pas", () => {
    const videos = [
      { id: "v-ex", terminee: "2026-10-03T10:00:00Z", coutReel: eur(900), estDemo: true },
      { id: "v-1", terminee: "2026-10-03T10:00:00Z", coutReel: eur(100) },
    ] as Video[];
    const depenses = [{ id: "d-ex", videoId: "v-ex", date: "2026-10-03T10:00:00Z", lignes: [ligne("heygen", 900)], total: eur(900), estDemo: true, ...horo("2026-10-03T10:00:00Z") }] as DepenseEnregistree[];
    const t = couts.calculerTableauCouts(depenses, videos, "2026-10", 0.92);
    expect(t.nbVideos).toBe(1);
    expect(t.coutMoyen?.centimes).toBe(100);
    expect(t.parOutil).toEqual([]);
  });
});

describe("4.2 · « Annoncé / réel » : seulement le payé", () => {
  it("un travail dont une partie du réel est simulée ne figure pas ; un travail payé, si", () => {
    const depenses = [
      { id: "d1", videoId: "v1", travailId: "t1", date: "2026-10-03T10:00:00Z", lignes: [ligne("heygen", 300), ligne("simulation", 200, "Double")], total: eur(500) },
      { id: "d2", videoId: "v2", travailId: "t2", date: "2026-10-03T10:00:00Z", lignes: [ligne("heygen", 400)], total: eur(400) },
    ] as DepenseEnregistree[];
    const videos = [
      { id: "v1", terminee: "2026-10-03T11:00:00Z", coutEstime: eur(480), coutReel: eur(500) },
      { id: "v2", terminee: "2026-10-03T11:00:00Z", coutEstime: eur(380), coutReel: eur(400) },
    ] as Video[];
    const travauxListe = [
      { id: "t1", cibleId: "v1", type: "fabrication" as const, statut: "termine" as const, creeLe: "2026-10-03T09:00:00Z" },
      { id: "t2", cibleId: "v2", type: "fabrication" as const, statut: "termine" as const, creeLe: "2026-10-03T09:00:00Z" },
    ];
    const t = couts.calculerTableauCouts(depenses, videos, "2026-10", 0.92, travauxListe);
    expect(t.ecart).toEqual({ estime: eur(380), reel: eur(400), pourcentage: 5 });
  });

  it("vidéo entièrement simulée : rien à comparer (jamais « −100 % »)", () => {
    const depenses = [{ id: "d1", videoId: "v1", travailId: "t1", date: "2026-10-03T10:00:00Z", lignes: [ligne("simulation", 500, "Double")], total: eur(500) }] as DepenseEnregistree[];
    const videos = [{ id: "v1", terminee: "2026-10-03T11:00:00Z", coutEstime: eur(480), coutReel: eur(500) }] as Video[];
    const t = couts.calculerTableauCouts(depenses, videos, "2026-10", 0.92, [{ id: "t1", cibleId: "v1", type: "fabrication", statut: "termine", creeLe: "2026-10-03T09:00:00Z" }]);
    expect(t.ecart).toBeNull();
  });
});
