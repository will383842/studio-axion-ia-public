/**
 * X4-13a : ligne « Extraits gardés de cette vidéo » (composant en lecture seule, monté nulle part).
 * Rendu serveur seulement. Éteint (archive ou note) = rien du tout.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExtraitsDeLaVideo } from "@/components/bibliotheque/ExtraitsDeLaVideo";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

const plage = (id: string, o: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 5, texte: "x", motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable", ...o,
});
const fiche = (plages: PlageExtrait[], o: Partial<FicheSourceExtraits> = {}): FicheSourceExtraits => ({
  videoId: "v1", versionId: "ver1", sortieId: "s1", ratio: "9:16",
  licence: { type: "propriete", usageCommercial: true, reseaux: [] } as unknown as FicheSourceExtraits["licence"],
  famille: [], plages, rangee: true, sourcePreferee: false, ...o,
});
const LIEN = "/bibliotheque/source-extraits";
const rendre = (p: Partial<Parameters<typeof ExtraitsDeLaVideo>[0]> & { fiche: FicheSourceExtraits | null }) =>
  renderToStaticMarkup(createElement(ExtraitsDeLaVideo, { archiveActive: true, noteActive: true, lien: LIEN, ...p }));

const trois = [
  plage("a", { note: 80, sujet: "appels-offres", usages: ["telephone", "ecran"] }),
  plage("b", { note: 65, sujet: "appels-offres", usages: ["telephone"] }),
  plage("c", { note: 30, sujet: "appels-offres", usages: ["fond"] }),
];

describe("ExtraitsDeLaVideo", () => {
  it("archive éteinte → rien", () => {
    expect(rendre({ fiche: fiche(trois), archiveActive: false })).toBe("");
    expect(rendre({ fiche: fiche(trois), archiveActive: undefined as unknown as boolean })).toBe("");
  });
  it("note éteinte → rien", () => {
    expect(rendre({ fiche: fiche(trois), noteActive: false })).toBe("");
    expect(rendre({ fiche: fiche(trois), noteActive: "true" as unknown as boolean })).toBe("");
  });
  it("fiche nulle → rien", () => {
    expect(rendre({ fiche: null })).toBe("");
  });
  it("3 plages notées dont 2 ≥ 60 → « 2 », sujet et usages en mots, lien reçu", () => {
    const html = rendre({ fiche: fiche(trois) });
    expect(html).toContain("Extraits gardés de cette vidéo");
    expect(html).toMatch(/:\s*(<[^>]+>)*2(<\/[^>]+>)*/);
    expect(html).toContain("Appels d&#x27;offres");
    expect(html).toContain("téléphone");
    expect(html).toContain(`href="${LIEN}"`);
    expect(html).toContain("Voir");
  });
  it("une plage écartée n'est pas comptée", () => {
    const f = fiche([...trois, plage("d", { note: 90, etat: "ecartee" })]);
    expect(rendre({ fiche: f })).toMatch(/:\s*(<[^>]+>)*2(<\/[^>]+>)*/);
    expect(rendre({ fiche: f })).not.toMatch(/:\s*(<[^>]+>)*3(<\/[^>]+>)*/);
  });
  it("seuil reçu respecté", () => {
    expect(rendre({ fiche: fiche(trois), seuilGarde: 70 })).toMatch(/:\s*(<[^>]+>)*1(<\/[^>]+>)*/);
  });
  it("rienARetenir → « Rien à retenir »", () => {
    const html = rendre({ fiche: fiche(trois, { rienARetenir: true }) });
    expect(html).toContain("Rien à retenir");
    expect(html).not.toContain("Extraits gardés");
  });
  it("aucune couleur en dur, jetons seulement", () => {
    const html = rendre({ fiche: fiche(trois) });
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|style=/);
  });
});
