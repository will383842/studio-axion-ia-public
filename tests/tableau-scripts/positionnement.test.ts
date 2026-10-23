/** Lot A2 : positionnement de Will dans le tableau (clôture, « à retenir », fin). ÉLIMINATOIRE depuis le lot B1 (D1, 18/10) pour les scripts de Claude. */
import { describe, expect, it } from "vitest";
import { aDesEliminatoires, controlerEcriture, controlerPositionnement } from "@/domaine/scripts-tableau-controles";
import type { DemandeScriptTableau, ScriptTableau } from "@/domaine/scripts-tableau";
import { DEMANDE_MODELE as DEMANDE_TEMOIN, ecritureModele as ecritureTemoin } from "./modele-valide";

const DEMANDE: DemandeScriptTableau = { ...DEMANDE_TEMOIN, reseau: "fil", fin: { type: "commentaire", mot: "ROUGE" } };
const modele = () => ecritureTemoin().script;
const avec = (f: (s: ScriptTableau) => void): ScriptTableau => {
  const s = modele();
  f(s);
  return s;
};

describe("controlerPositionnement (tableau)", () => {
  it("le script validé ne lève rien", () => {
    expect(controlerPositionnement(modele())).toEqual([]);
  });
  it("une clôture « faites-le vous-même » est relevée, éliminatoire (lot B1)", () => {
    const d = controlerPositionnement(avec((s) => (s.appel.at(-1)!.dit = "Faites-le vous-même.")));
    expect(d.map((x) => x.code)).toEqual(["positionnement"]);
    expect(d[0].eliminatoire).toBe(true);
  });
  it("« à retenir » qui annonce un outil est relevé", () => {
    const d = controlerPositionnement(avec((s) => (s.aRetenir[0].dit = "Ce nouvel outil change tout.")));
    expect(d.map((x) => x.code)).toEqual(["positionnement"]);
  });
  it("branché dans controlerEcriture : relevé, le script est éliminé (lot B1)", () => {
    const e = ecritureTemoin();
    e.script.appel.at(-1)!.dit = "À vous de jouer.";
    const d = controlerEcriture(e, DEMANDE).filter((x) => x.code === "positionnement");
    expect(d).toHaveLength(1);
    expect(aDesEliminatoires(d)).toBe(true);
  });
});
