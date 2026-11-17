/** X4-12a : composant « Extraits gardés » (onglets), reçoit tout en propriétés, monté nulle part. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import { ExtraitsGardes, motsDeNote } from "@/components/bibliotheque/ExtraitsGardes";

const plage = (id: string, note?: number): PlageExtrait => ({
  id, debutSec: 10, finSec: 20, texte: `texte ${id}`, motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable",
  note, raisonsNote: note === undefined ? undefined : [{ code: "chiffre-visible", points: 20 }], sujet: "appels-offres", usages: ["ecran"],
});
const fiche = (notes: (number | undefined)[], extra: Partial<FicheSourceExtraits> = {}): FicheSourceExtraits => ({
  videoId: "v1", versionId: "ver1", sortieId: "s1", ratio: "9:16",
  licence: { type: "propriete", usageCommercial: true, reseaux: [] } as unknown as FicheSourceExtraits["licence"],
  famille: [], plages: notes.map((n, i) => plage(`p${i}`, n)), rangee: true, sourcePreferee: true, ...extra,
});
const rendre = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ExtraitsGardes as never, { titres: { v1: "Ma vidéo" }, noteActive: true, ...props }));

describe("ExtraitsGardes", () => {
  it("note éteinte (autre que true exact) → rien", () => {
    for (const v of [false, undefined, "true", 1]) expect(rendre({ fiches: [fiche([80])], noteActive: v })).toBe("");
  });
  it("aucune fiche notée → rien", () => {
    expect(rendre({ fiches: [fiche([undefined])] })).toBe("");
    expect(rendre({ fiches: [] })).toBe("");
  });
  it("3 onglets et bandeau", () => {
    const h = rendre({ fiches: [fiche([80])] });
    expect(h).toContain("Le Studio trie tout seul. Vous pouvez corriger si vous le souhaitez.");
    expect(h).toContain("Gardés");
    expect(h).toContain("Peut-être");
    expect(h).toContain("Ignorés (pourquoi)");
  });
  it("seuils par défaut : 59 → Peut-être, 60 → Gardés", () => {
    const h59 = rendre({ fiches: [fiche([59])] });
    expect(h59).toContain("Gardés (0)");
    expect(h59).toContain("Peut-être (1)");
    const h60 = rendre({ fiches: [fiche([60])] });
    expect(h60).toContain("Gardés (1)");
    expect(h60).toContain("Peut-être (0)");
  });
  it("seuils passés en propriété respectés", () => {
    const h = rendre({ fiches: [fiche([70])], seuils: { garde: 75, peutEtre: 50, gardesMax: 8 } });
    expect(h).toContain("Gardés (0)");
    expect(h).toContain("Peut-être (1)");
  });
  it("mots de note exacts", () => {
    expect(motsDeNote(80)).toBe("très utile");
    expect(motsDeNote(79)).toBe("utile");
    expect(motsDeNote(60)).toBe("utile");
    expect(motsDeNote(59)).toBe("peut-être");
    expect(motsDeNote(40)).toBe("peut-être");
  });
  it("carte : note en mots et en chiffre, sujet, usage, vidéo d'origine", () => {
    const h = rendre({ fiches: [fiche([85])] });
    expect(h).toContain("très utile");
    expect(h).toContain("85");
    expect(h).toContain("Appels d&#x27;offres");
    expect(h).toContain("Ma vidéo");
  });
  it("aucun bouton de geste sans rappel", () => {
    const h = rendre({ fiches: [fiche([85])] });
    expect(h).not.toContain("Ne plus proposer");
    expect(h).not.toContain("Garder quand même");
    expect(h).not.toContain("Chiffres réels");
    expect(h).not.toContain("Voir l&#x27;aperçu");
  });
  it("boutons présents seulement avec leur rappel, phrase des chiffres réels", () => {
    const f = () => undefined;
    const h = rendre({ fiches: [fiche([85])], surNePlusProposer: f, surChiffresReels: f, surApercu: f });
    expect(h).toContain("Ne plus proposer");
    expect(h).toContain("Chiffres réels");
    expect(h).toContain("Cochez seulement si les chiffres de cette vidéo sont vrais et vérifiables");
    expect(h).toContain("Voir l&#x27;aperçu");
    expect(h).not.toContain("Garder quand même");
  });
  it("aucun <video avant le clic", () => {
    expect(rendre({ fiches: [fiche([85])], surApercu: () => undefined })).not.toContain("<video");
  });
  it("pas de couleur en dur", () => {
    expect(rendre({ fiches: [fiche([85])] })).not.toMatch(/#[0-9a-f]{3,8}\b|orange/i);
  });
});
