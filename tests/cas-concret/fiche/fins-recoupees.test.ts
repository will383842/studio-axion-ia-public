/**
 * M0 · Recoupement des suites de `finsParReseau` (fiche du format, F1) avec `TABLE_FINS_DIAGNOSTIC` (C2) : chaque
 * identifiant existe et vise le groupe et le réseau où il est dit. Depuis X6, toute suite produite est utilisable : la fin
 * « diagnostic » ou la fin au mot ; les lignes remplacées et les cadeaux transposés ne sont plus jamais demandés.
 */
import { describe, expect, it } from "vitest";
import { finsParReseau, type ReseauCas } from "@/formats/cas-concret";
import { NATURES, OFFRES, type NatureCas, type Offre } from "@/formats/cas-concret/cas";
import { TABLE_FINS_DIAGNOSTIC, groupeDe, suiteDeFins } from "@/briques/fins";

const options = { mot: "IA", motDit: "I.A." };
/** Le mot branché nulle part, sur un compte, sur les deux. */
const MOT_SUR: ReseauCas[][] = [[], ["instagram"], ["facebook", "instagram"]];
/** Chaque offre, et l'intégration sous chacune de ses natures (le cadeau en dépend). */
const OFFRES_NATURES = OFFRES.flatMap((offre): { offre: Offre; nature?: NatureCas }[] => (offre === "integration" ? NATURES.map((nature) => ({ offre, nature })) : [{ offre }]));

describe("M0 · fins par réseau et table d'appel au diagnostic", () => {
  it("chaque identifiant existe dans la table et vise le groupe et le réseau où il est dit", () => {
    const vus = new Set<string>();
    for (const { offre, nature } of OFFRES_NATURES)
      for (const motSur of MOT_SUR)
        for (const [reseau, ids] of Object.entries(finsParReseau(offre, motSur, nature)) as [keyof ReturnType<typeof finsParReseau>, string[]][])
          for (const id of ids) {
            vus.add(id);
            const fin = TABLE_FINS_DIAGNOSTIC.find((f) => f.id === id);
            expect(fin, `${offre} ${reseau} ${id}`).toBeDefined();
            expect(fin!.groupe, id).toBe(groupeDe(reseau));
            if (fin!.reseaux) expect(fin!.reseaux, id).toContain(reseau);
          }
    // Les deux « Réservez votre diagnostic gratuit. » réactivées le 14/10 (OUI de Will du 12/10) ne sont pas tirées par ce format,
    // ni les fins DE SECOURS de Facebook (15/10, propres à l'image → vidéo) : ses choix ne changent pas.
    expect([...vus].sort()).toEqual(TABLE_FINS_DIAGNOSTIC.filter((f) => f.validee && !f.secours && !/cadeau/.test(f.id) && f.id !== "fin-if-rdv-seul" && f.id !== "fin-ty-rdv").map((f) => f.id).sort());
    expect(vus.has("fin-fb-lien-premier-commentaire")).toBe(false);
    expect(vus.has("fin-fb-lien-sous-video")).toBe(false);
  });

  it("toute suite passe `suiteDeFins`", () => {
    for (const { offre, nature } of OFFRES_NATURES)
      for (const motSur of MOT_SUR)
        for (const [reseau, ids] of Object.entries(finsParReseau(offre, motSur, nature)) as [keyof ReturnType<typeof finsParReseau>, string[]][])
          expect(suiteDeFins(reseau, ids, options, TABLE_FINS_DIAGNOSTIC).map((f) => f.id), `${offre} ${reseau}`).toEqual(ids);
    expect(finsParReseau("integration", ["facebook"], "automatisation").facebook).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
  });
});
