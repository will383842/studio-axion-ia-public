/** Ciblage, lot B : migration 22 (scripts de l'ancien atelier marqués, hors-sujet, doublons). Aucun appel réseau. */
import { beforeEach, describe, expect, it } from "vitest";
import type { Script, Video } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { etape22Ciblage } = await import("@/services/migrations/etape-22-ciblage");
const { scriptsReferenceFiche } = await import("@/donnees/references-avocat");
const { migrerDonnees } = await import("@/services/migrations");

const T1 = "2026-11-09T08:00:00.000Z";
const T2 = "2026-11-09T09:00:00.000Z";

beforeEach(() => reinitialiserDepots());

function script(id: string, sujet: string, texte: string, extra: Partial<Script> = {}): Script {
  return {
    id, formatId: "talking-head", versionFormat: 1, sujet, version: 1,
    blocs: [{ id: `${id}-b`, blocRecette: "corps", segments: [{ id: `${id}-s`, texte }] }],
    favori: false, reference: false, statutEditorial: "brouillon", marqueId: "marque-axion", creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z",
    ...extra,
  } as Script;
}

async function semer() {
  const d = depots();
  for (const s of scriptsReferenceFiche("2026-01-01T00:00:00.000Z")) await d.scripts.enregistrer(s);
  await d.scripts.enregistrer(script("s-plombier", "Devis plus vite pour les plombiers", "Les plombiers perdent du temps sur les devis et factures.", { cible: "Plombiers indépendants" }));
  await d.scripts.enregistrer(script("s-plombier-bis", "Devis plus vite pour les plombiers", "Les plombiers perdent du temps sur les devis et factures.", { cible: "Plombiers indépendants" }));
  await d.scripts.enregistrer(script("s-libre", "Une astuce", "Voici une astuce."));
  await d.scripts.enregistrer(script("s-generateur", "Sujet du générateur", "Texte.", { scriptMaitreId: "maitre-1" }));
  await d.scripts.enregistrer(script("s-publie", "Relances pour les comptables", "Relancer les impayés des comptables.", { cible: "comptables" }));
  const v = { id: "v-1", titre: "V", formatId: "talking-head", versionFormat: 1, profilRenduVersion: 1, marqueId: "marque-axion", statut: "prete", scriptId: "s-plombier", creeLe: "x", modifieLe: "x" } as unknown as Video;
  await d.videos.enregistrer(v);
  await d.videos.enregistrer({ ...v, id: "v-pub", scriptId: "s-publie", etapeEditoriale: "publiee" } as Video);
  await d.videos.enregistrer({ ...v, id: "v-sans", scriptId: undefined } as Video);
}

describe("migration 22 · ciblage", () => {
  it("deux passages : rien de supprimé, 3 scripts radar hors-sujet, cible jamais écrasée, idempotente", async () => {
    await semer();
    const d = depots();
    const avant = await d.scripts.compter();
    const r1 = await etape22Ciblage(d, T1);
    expect(r1).not.toBeNull();
    expect(await d.scripts.compter()).toBe(avant);
    for (const id of ["script-ref-fiche-radar", "script-ref-fiche-controle", "script-ref-fiche-6-points"]) {
      expect((await d.scripts.obtenir(id))?.ancien).toEqual({ depuis: T1, raison: "hors-sujet" });
    }
    const p = (await d.scripts.obtenir("s-plombier"))!;
    expect(p.cible).toBe("Plombiers indépendants");
    expect(p.ciblage).toMatchObject({ niveau: "metier", libelle: "plombier", origine: "deduite" });
    expect(p.typeAutomatisation).toBe("devis-factures");
    expect(p.ancien).toEqual({ depuis: T1, raison: "avant-ciblage" });
    expect(p.doublonsPossibles).toEqual(["s-plombier-bis"]);
    expect((await d.scripts.obtenir("s-libre"))?.cible).toBeUndefined();
    expect((await d.scripts.obtenir("s-generateur"))?.ancien).toBeUndefined();
    expect((await d.videos.obtenir("v-1"))).toMatchObject({ typeAutomatisation: "devis-factures", ciblage: { libelle: "plombier" } });
    expect((await d.videos.obtenir("v-pub"))).not.toHaveProperty("ancien");
    expect((await d.scripts.obtenir("s-publie"))?.ancien).toBeUndefined();
    expect((r1 as { scriptsHorsSujet: number }).scriptsHorsSujet).toBeGreaterThanOrEqual(3);
    expect(r1).toMatchObject({ scriptsAnciens: expect.any(Number), groupesDoublons: expect.any(Number) });
    const photo = JSON.stringify(await d.scripts.lister());
    expect(await etape22Ciblage(d, T2)).toBeNull();
    expect(JSON.stringify(await d.scripts.lister())).toBe(photo);
    expect(await d.scripts.compter()).toBe(avant);
  });

  it("la réinsertion des accroches de référence ne remet pas `ancien` à zéro", async () => {
    await migrerDonnees(depots(), T1);
    expect((await depots().scripts.obtenir("script-ref-fiche-radar"))?.ancien?.raison).toBe("hors-sujet");
    await migrerDonnees(depots(), T2);
    expect((await depots().scripts.obtenir("script-ref-fiche-radar"))?.ancien).toEqual({ depuis: T1, raison: "hors-sujet" });
  });
});
