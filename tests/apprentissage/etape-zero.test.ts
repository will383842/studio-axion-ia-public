/**
 * L2 et L3 dans l'étape 0 (gratuite, pure) : la structure demandée est reprise ; les poids de « ce qui marche »
 * orientent le choix sans rendre l'étape impossible.
 */
import { describe, expect, it } from "vitest";
import { briefMinimal, etapeZero } from "@/generateur/etape-zero";
import { CONTEXTE_BANC, MAINTENANT_BANC, SUJETS_BANC } from "../generateur/banc/registre-banc-g4";
import { TOURNURES_G4 } from "../helpers/g4";

const s = SUJETS_BANC[0];
const lancer = (extra: { structureImposee?: string; familleAccroche?: string } = {}, poidsCorrection?: Parameters<typeof etapeZero>[0]["poidsCorrection"]) => {
  const brief = { ...briefMinimal({ idee: s.idee, phraseWill: s.phraseWill, reseaux: s.reseaux, formatId: "avocat", pilier: s.pilier.id }), ...extra };
  return etapeZero({ maintenant: MAINTENANT_BANC, brief, mode: "avatar", matieres: s.matieres, preuves: s.preuves, contexteAxion: CONTEXTE_BANC, tournures: TOURNURES_G4, poidsCorrection });
};

describe("étape 0 : refaire une structure et pondération", () => {
  it("une structure demandée est reprise par le choix", () => {
    const base = lancer();
    if (!base.ok) throw new Error("étape 0");
    const autre = base.donnees.combinaisons.map((c) => c.structure).find((x) => x !== base.donnees.choix.structure);
    expect(autre).toBeDefined();
    const r = lancer({ structureImposee: autre });
    if (!r.ok) throw new Error("étape 0");
    expect(r.donnees.choix.structure).toBe(autre);
  });

  it("une famille d'accroche demandée passe seule dans le tirage ; une famille inconnue ou exclue laisse le tirage intact", () => {
    const base = lancer();
    if (!base.ok) throw new Error("étape 0");
    const familles = Object.keys(base.donnees.choix.poidsFamilles);
    expect(familles.length).toBeGreaterThan(1);
    const voulue = familles[familles.length - 1];
    const r = lancer({ familleAccroche: voulue });
    if (!r.ok) throw new Error("étape 0");
    expect(Object.keys(r.donnees.choix.poidsFamilles)).toEqual([voulue]);
    const inconnue = lancer({ familleAccroche: "famille-qui-n-existe-pas" });
    if (!inconnue.ok) throw new Error("étape 0");
    expect(Object.keys(inconnue.donnees.choix.poidsFamilles)).toEqual(familles);
  });

  it("un poids de famille ×1,5 augmente son poids de tirage, sans rien exclure", () => {
    const base = lancer();
    if (!base.ok) throw new Error("étape 0");
    const familles = Object.keys(base.donnees.choix.poidsFamilles);
    const f = familles[0] as keyof typeof base.donnees.choix.poidsFamilles;
    const r = lancer({}, { famille: { [f]: 1.5 } });
    if (!r.ok) throw new Error("étape 0");
    expect(Object.keys(r.donnees.choix.poidsFamilles)).toEqual(familles);
    expect(r.donnees.choix.poidsFamilles[f]).toBeCloseTo((base.donnees.choix.poidsFamilles[f] ?? 1) * 1.5, 2);
  });
});
