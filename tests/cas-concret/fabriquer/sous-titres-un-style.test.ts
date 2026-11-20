/**
 * FIX-CC-SOUS-TITRES-UN-STYLE (décision D2 de Williams, 17/11) : dans le cas concret, UN SEUL style de sous-titres du début
 * à la fin : la base, avec les mots orange. Plus de grandes capitales penchées (Impact), ni bandeau, ni souligné, ni
 * mouvement, même quand la variation tirée de la vidéo (« vif » / « calme ») ou le dosage « dynamique » en demandent.
 * Mesuré sur ce qui est RÉELLEMENT envoyé au rendu. Doubles seulement : aucun rendu, aucune dépense.
 */
import { describe, expect, it, vi } from "vitest";
import type { DonneesCalque } from "@/briques/sous-titres/scene";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { TIRAGE_V4 } from "@/moteurs/montage-cas-concret/variete";
import { doubles } from "./doubles";

const commandesVues: { sousTitres?: { intensite?: string } }[] = [];
vi.mock("@/briques/composition/montage", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/briques/composition/montage")>();
  return {
    ...m,
    avancerCompositions: ((e: unknown, commande: { sousTitres?: { intensite?: string } }, ...reste: unknown[]) => {
      commandesVues.push(commande);
      return (m.avancerCompositions as (...a: unknown[]) => unknown)(e, commande, ...reste);
    }) as typeof m.avancerCompositions,
  };
});

type Segment = DonneesCalque["segments"][number];
type Mise = { version: string; tirage: unknown; ecrans: Record<string, never> };

const miseAvec = (intensite: "calme" | "equilibre" | "vif"): Mise => ({ version: "variete/1", tirage: { ...TIRAGE_V4, sousTitres: { ...TIRAGE_V4.sousTitres, intensite } }, ecrans: {} });

async function fabriquer(mise?: Mise, dosage?: "dynamique") {
  commandesVues.length = 0;
  const d = mise ? doubles({ retoucherFiche: (f) => ({ ...f, mise }) }) : doubles();
  if (dosage) d.options.dosage = dosage;
  await fabriquerCasConcret(d.options);
  const soumises = d.compositionsSoumises();
  expect(soumises.length).toBeGreaterThan(0);
  const segments = soumises.flatMap((c) => (c.parametres as { texte: { sousTitres: DonneesCalque } }).texte.sousTitres.segments) as Segment[];
  return { segments, ids: soumises.map((c) => c.idRendu), commandes: [...commandesVues] };
}

function toutEstDeLaBase(segments: Segment[]) {
  expect(segments.length).toBeGreaterThan(0);
  expect(segments.filter((s) => s.style !== undefined && s.style !== "base").map((s) => s.style)).toEqual([]);
  expect(segments.filter((s) => s.souligne != null).length).toBe(0);
  expect(segments.filter((s) => s.inclinaison).length).toBe(0);
  expect(segments.filter((s) => s.position !== "auto").length).toBe(0);
}

describe("cas concret : un seul style de sous-titres (« sobre »)", () => {
  it("(a) doubles de base : aucun impact, bandeau, souligné ni mouvement ; les mots orange restent", async () => {
    const { segments } = await fabriquer();
    toutEstDeLaBase(segments);
    expect(segments.some((s) => s.mots.some((m) => m.enValeur))).toBe(true);
  });

  it.each(["vif", "calme"] as const)("(a bis) tirage « %s » : toujours le même style du début à la fin", async (intensite) => {
    const { segments } = await fabriquer(miseAvec(intensite));
    toutEstDeLaBase(segments);
  });

  it("(a bis) dosage « dynamique » : toujours le même style du début à la fin", async () => {
    const { segments } = await fabriquer(miseAvec("vif"), "dynamique");
    toutEstDeLaBase(segments);
  });

  it("(b) la commande envoyée au rendu porte l'intensité « sobre »", async () => {
    const { commandes } = await fabriquer();
    expect(commandes.length).toBeGreaterThan(0);
    expect(commandes.every((c) => c.sousTitres?.intensite === "sobre")).toBe(true);
  });

  it("(c) l'empreinte du montage porte le marqueur : une reprise ne réutilise pas l'ancien montage", async () => {
    const src = (await import("node:fs")).readFileSync("src/moteurs/montage-cas-concret/fabriquer.ts", "utf8");
    expect(src).toContain('"sous-titres-gv2-30", "sous-titres-un-style-17-11"');
  });
});
