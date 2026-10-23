/**
 * C94 (audit du 17/10) : la douleur est NOMMÉE dans CHAQUE script, quelle que soit l'intensité du sujet ; C80 ne règle
 * que l'intensité en série (alerte inchangée). C94 est une ALERTE, jamais bloquante.
 */
import { describe, expect, it } from "vitest";
import { c80SerieDouleur, codesLeves, controlerVersion, NIVEAUX, type EntreeControle } from "@/domaine/controles-script";
import { versionV4 } from "./helpers/v4";

/** Tout le texte dit remplacé par des phrases neutres, sans marqueur « cout » et sans problème déclaré. */
function sansDouleur(e: EntreeControle): void {
  for (const b of [...e.ouverture, ...e.corps]) for (const s of b.segments) Object.assign(s, { texte: "On organise les dossiers par client.", marqueurs: (s.marqueurs ?? []).filter((m) => m !== "cout") });
  if (e.maitre?.angle) e.maitre.angle = { ...e.maitre.angle, probleme: "" };
}

describe("C94 : douleur nommée dans chaque script", () => {
  it("la v4 de Will la nomme : rien n'est levé", () => {
    expect(codesLeves(controlerVersion(versionV4("machine")))).not.toContain("C94");
  });

  it("un script qui ne la nomme pas : alerte (jamais bloquante), même sujet en « gain »", () => {
    const r = controlerVersion(versionV4("machine", sansDouleur));
    const v = r.violations.find((x) => x.controle === "C94");
    expect(v?.niveau).toBe("alerte");
    expect(v?.bloquant).toBe(false);
    expect(NIVEAUX.C94).toEqual({ machine: "alerte", will: "info" });
  });

  it("des mots neutres (« pertinent », « minutes », « heures ») ne suffisent pas à nommer la douleur", () => {
    const neutre = (e: EntreeControle) => {
      sansDouleur(e);
      for (const b of e.corps) for (const s of b.segments) s.texte = "Un réglage pertinent, en dix minutes, deux heures par mois.";
    };
    expect(codesLeves(controlerVersion(versionV4("machine", neutre)))).toContain("C94");
  });

  it("C80 reste une alerte de série, sur l'intensité seulement", () => {
    expect(NIVEAUX.C80).toEqual({ machine: "alerte", will: "alerte" });
    expect(c80SerieDouleur(["douleur", "douleur"], "douleur").map((x) => x.niveau)).toEqual(["alerte"]);
    expect(c80SerieDouleur(["douleur", "douleur"], "gain")).toEqual([]);
  });
});
