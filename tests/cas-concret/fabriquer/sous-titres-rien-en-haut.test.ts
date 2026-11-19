/**
 * Essai réel du 15/10 (v-52c3dd9b4f37, cas « articles-blog ») : vers 27 s, le groupe « de droits est choisie » sortait en
 * BANDEAU, position « haut », et recouvrait le titre « LA PHOTO » de l'écran pendant ~1 s. Le haut de l'image est celui
 * du titre de chaque écran : aucun groupe n'y va. Les autres accents (Impact incliné dans la bande, comme « POUR CHAQUE
 * PERSONNE » de la v4, soulignement) restent. Mesuré sur la demande RÉELLEMENT envoyée à la composition.
 */
import { describe, expect, it } from "vitest";
import type { DonneesCalque } from "@/briques/sous-titres/scene";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles } from "./doubles";

async function segmentsSoumis() {
  const d = doubles();
  await fabriquerCasConcret(d.options);
  const soumises = d.compositionsSoumises();
  expect(soumises.length).toBeGreaterThan(0);
  return soumises.flatMap((c) => (c.parametres as { texte: { sousTitres: DonneesCalque } }).texte.sousTitres.segments);
}

const decrire = (s: { style?: string; position?: string; mots: { mot: string }[] }) => `${s.style}/${s.position} « ${s.mots.map((m) => m.mot).join(" ")} »`;

describe("sous-titres du cas concret : rien en haut, sur le titre d'un écran", () => {
  it("aucun groupe envoyé au rendu n'est en position « haut »", async () => {
    const segments = await segmentsSoumis();
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.filter((s) => s.position === "haut").map(decrire)).toEqual([]);
  });

  it("GV2-30 · un seul style (D2) : plus aucun Impact ni bandeau ; les groupes restent dans la bande, jamais en haut", async () => {
    const segments = await segmentsSoumis();
    expect(segments.filter((s) => s.style === "impact").map(decrire)).toEqual([]);
    expect(segments.filter((s) => s.style === "bandeau").map(decrire)).toEqual([]);
  });
});
