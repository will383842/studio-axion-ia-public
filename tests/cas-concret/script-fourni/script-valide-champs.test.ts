/** Script validé : les champs `fourni` et `texteFourni` sont relus avec tolérance ; les anciens scripts sont relus à l'identique. */
import { describe, expect, it } from "vitest";
import { lireScriptValide, scriptDeFiche, SCRIPTS_VALIDES_CATALOGUE } from "@/moteurs/montage-cas-concret/script-valide";

const catalogue = SCRIPTS_VALIDES_CATALOGUE["recrutement-apporteurs"]!;
const base = JSON.parse(JSON.stringify(catalogue));

describe("script validé fourni", () => {
  it("un ancien script est relu à l'identique : ni fourni ni texteFourni n'apparaissent", () => {
    const lu = lireScriptValide(base)!;
    expect("fourni" in lu).toBe(false);
    expect("texteFourni" in lu).toBe(false);
    expect(lireScriptValide(JSON.parse(JSON.stringify(lu)))).toEqual(lu);
  });

  it("fourni seulement si exactement true ; texteFourni seulement si c'est un texte de 4000 caractères au plus", () => {
    expect(lireScriptValide({ ...base, fourni: true, texteFourni: "Mon texte." })).toMatchObject({ fourni: true, texteFourni: "Mon texte." });
    for (const mauvais of ["true", 1, "oui", null, false]) expect(lireScriptValide({ ...base, fourni: mauvais })!.fourni).toBeUndefined();
    expect(lireScriptValide({ ...base, texteFourni: "a".repeat(4000) })!.texteFourni).toHaveLength(4000);
    expect(lireScriptValide({ ...base, texteFourni: "a".repeat(4001) })!.texteFourni).toBeUndefined();
    expect(lireScriptValide({ ...base, texteFourni: 42 })!.texteFourni).toBeUndefined();
  });

  it("scriptDeFiche accepte fourni et texteFourni dans les métadonnées", () => {
    const s = scriptDeFiche({ casId: "c", ecrans: catalogue.ecrans as never }, { versionCas: 1, valideLe: "2026-10-24", source: "s", fourni: true, texteFourni: "x" });
    expect(s).toMatchObject({ fourni: true, texteFourni: "x" });
    expect(lireScriptValide(s)).toMatchObject({ fourni: true, texteFourni: "x" });
  });
});
