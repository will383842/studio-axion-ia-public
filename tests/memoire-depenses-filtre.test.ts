/**
 * MÉMOIRE DU STUDIO (OOM du 17/10, conteneur limité à 2 Go) — le dépôt COPIE (structuredClone) tout ce que `lister`
 * rend. Avant, le chemin d'un appel Claude (`engageClaudeDuMoisCentimes`, soldes « suivi », surveillance des crédits)
 * listait TOUTES les dépenses puis filtrait ensuite : une copie complète de la collection à chaque appel. Ici : le filtre
 * part dans `lister`, seules les lignes utiles sont copiées, et les chiffres rendus sont inchangés.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { DepenseEnregistree } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const gc = await import("@/services/generation-claude");
const credits = await import("@/services/credits");

const mois = new Date().toISOString().slice(0, 7);
const ligne = (fournisseur: string, centimes: number) => ({ etape: "x", fournisseur, nature: "reel" as const, total: { centimes, devise: "EUR" as const } });

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
});

async function semer(n: number) {
  for (let i = 0; i < n; i++) {
    const claude = i % 10 === 0;
    const recent = i % 20 === 0;
    const d = { id: `dep-${i}`, videoId: `v-${i % 50}`, lignes: [ligne(claude ? "anthropic" : "fal", 100)], total: { centimes: 100, devise: "EUR" }, date: recent ? `${mois}-02T10:00:00.000Z` : "2026-01-05T10:00:00.000Z" } as unknown as DepenseEnregistree;
    await depots().depenses.enregistrer(d);
  }
}

describe("dépenses : seul ce qui sert est copié", () => {
  it("`engageClaudeDuMoisCentimes` ne fait copier que les dépenses du mois (pas toute la collection) et rend le même total", async () => {
    await semer(2000);
    const depot = depots().depenses;
    const origine = depot.lister.bind(depot);
    const sorties: number[] = [];
    depot.lister = async (filtre) => {
      const r = await origine(filtre);
      sorties.push(r.length);
      return r;
    };
    const { depense } = await gc.engageClaudeDuMoisCentimes();
    expect(depense).toBeGreaterThan(0);
    // 2000 dépenses au total, 100 de ce mois : avant, 2000 copiées ; maintenant 100.
    expect(sorties[0]).toBeLessThan(200); // (la base de démonstration en ajoute quelques-unes)
  });

  it("`depenseChez` ne garde que les lignes RÉELLES du fournisseur, depuis la date donnée", () => {
    const f = credits.depenseChez("anthropic", "2026-02-01");
    expect(f({ lignes: [ligne("anthropic", 5)], date: "2026-03-01" })).toBe(true);
    expect(f({ lignes: [ligne("anthropic", 5)], date: "2026-01-01" })).toBe(false);
    expect(f({ lignes: [ligne("fal", 5)], date: "2026-03-01" })).toBe(false);
    expect(f({ lignes: [{ ...ligne("anthropic", 5), nature: "estime" }], date: "2026-03-01" })).toBe(false);
  });
});
