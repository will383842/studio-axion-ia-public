/** CAL-15 · champs éditoriaux facultatifs de la publication et indicateur d'équilibre replié par défaut. */
import { describe, expect, it } from "vitest";
import { EQUILIBRE_SEMAINE_PAR_DEFAUT, basculerEquilibreSemaine, type Publication } from "@/domaine/types";

const base: Publication = {
  id: "p1", creeLe: "2026-01-01T00:00:00Z", modifieLe: "2026-01-01T00:00:00Z",
  videoId: "v1", reseau: "linkedin" as Publication["reseau"], statut: "brouillon" as Publication["statut"],
  via: "simulation" as Publication["via"], date: "2026-01-02T00:00:00Z", texte: "Texte fictif",
};

describe("CAL-15 · champs éditoriaux", () => {
  it("une publication sans aucun des cinq champs reste valide", () => {
    expect(base.pilier).toBeUndefined();
    expect(base.sujet).toBeUndefined();
    expect(base.angle).toBeUndefined();
    expect(base.campagne).toBeUndefined();
    expect(base.motCle).toBeUndefined();
  });
  it("accepte chaque champ seul ou les cinq ensemble", () => {
    const seul: Publication = { ...base, pilier: "Pédagogie" };
    expect(seul.pilier).toBe("Pédagogie");
    const tous: Publication = { ...base, pilier: "Pédagogie", sujet: "Sujet fictif", angle: "Pas à pas", campagne: "Rentrée", motCle: "automatisation" };
    expect([tous.pilier, tous.sujet, tous.angle, tous.campagne, tous.motCle]).toEqual(["Pédagogie", "Sujet fictif", "Pas à pas", "Rentrée", "automatisation"]);
  });
});

describe("CAL-15 · indicateur d'équilibre de la semaine", () => {
  it("est replié par défaut", () => {
    expect(EQUILIBRE_SEMAINE_PAR_DEFAUT.deplie).toBe(false);
  });
  it("se déplie d'un clic, et se replie au clic suivant", () => {
    const ouvert = basculerEquilibreSemaine(EQUILIBRE_SEMAINE_PAR_DEFAUT);
    expect(ouvert.deplie).toBe(true);
    expect(basculerEquilibreSemaine(ouvert).deplie).toBe(false);
    expect(EQUILIBRE_SEMAINE_PAR_DEFAUT.deplie).toBe(false);
  });
});
