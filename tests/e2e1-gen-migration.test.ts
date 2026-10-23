/**
 * Rapport sécurité de la vérification E2E n° 1, point n° 9 : si la migration 19 s'interrompait entre la fiche de style
 * et les tournures, les mots interdits de Will n'étaient plus jamais semés (la boucle vivait dans `if (aucune fiche)`).
 * Ils sont désormais semés même quand la fiche existe déjà, sans doublon, et une tournure archivée par Will n'est pas recréée.
 */
import { beforeEach, describe, expect, it } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { etape19Generateur } = await import("@/services/migrations/etape-19-generateur");

beforeEach(() => reinitialiserDepots());

async function faconDeParler(motsInterdits: string[]) {
  await depots().parametres.enregistrer({ id: "style.faconDeParler", valeur: { expressions: [], motsInterdits, tutoiement: false, notes: "" }, creeLe: "x", modifieLe: "x" });
}

describe("E2E-1 sécurité n° 9 · mots interdits de Will semés même si la fiche de style existe", () => {
  it("fiche déjà là (migration interrompue) : le mot interdit devient quand même une tournure bloquante", async () => {
    const d = depots();
    await etape19Generateur(d, "2026-10-03T08:00:00.000Z");
    expect(await d.fichesStyle.compter()).toBeGreaterThan(0);
    await faconDeParler(["disruptif"]);
    await etape19Generateur(d, "2026-10-03T09:00:00.000Z");
    expect(await d.tournesInterdites.obtenir("tournure-will-disruptif")).toMatchObject({ source: "will", niveau: "bloquant" });
  });

  it("idempotent : deux passages, une seule tournure ; une tournure archivée par Will n'est pas recréée", async () => {
    const d = depots();
    await faconDeParler(["disruptif"]);
    await etape19Generateur(d, "2026-10-03T08:00:00.000Z");
    await etape19Generateur(d, "2026-10-03T09:00:00.000Z");
    expect((await d.tournesInterdites.lister((t) => t.id === "tournure-will-disruptif")).length).toBe(1);
    await d.tournesInterdites.modifier("tournure-will-disruptif", { archiveLe: "2026-10-03T10:00:00.000Z" } as never);
    await etape19Generateur(d, "2026-10-03T11:00:00.000Z");
    expect((await d.tournesInterdites.obtenir("tournure-will-disruptif")) as { archiveLe?: string } | null).toMatchObject({ archiveLe: "2026-10-03T10:00:00.000Z" });
  });
});
