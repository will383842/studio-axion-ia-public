/**
 * 25/10/2026 · Filet « zéro blocage » de la mise en scène (v-b54bb4798246) : un défaut de détail (Q13 chiffre dit mais pas
 * montré, Q14 rythme trop lent) ne refuse plus la vidéo. Les écrans cités passent en « titre » (3 essais au plus) ; si le
 * défaut persiste, la vidéo continue ; seul un défaut d'une autre sorte (Q12, bloc dessiné manquant) garde le refus.
 */
import { describe, expect, it } from "vitest";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { ecransEnDefautIV, ESSAIS_ADAPTATION_IV, ficheAdapteeIV, mettreEnSceneAvecFiletIV } from "@/moteurs/montage-image-video/adaptation-scene";
import type { ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";

const bloquant = (code: string, phrase: string) => ({ code, ok: false, bloquant: true, phrase, details: [phrase] });

/** Résultat simulé : ligne avec un chiffre « 30 » dit à 40,4 s (écran e12) et jamais montré, tant que e12 n'est pas adapté. */
function resultat(codes: [string, string][], ecranEnDefaut = "e12"): ResultatMiseEnSceneIV {
  const bloquants = codes.map(([c, p]) => bloquant(c, p));
  return {
    ok: bloquants.length === 0,
    phrases: bloquants.map((b) => b.phrase),
    rapport: { lignes: bloquants, bloquants, rythme: {} },
    ligne: {
      finVoixSec: 50,
      plans: [{ id: "p1", debut: 0, fin: 3, ecran: "e01" }, { id: "p2", debut: 3, fin: 50, ecran: ecranEnDefaut }],
      evenements: [1, 3].map((instantSec) => ({ instantSec, visible: true, genre: "bloc", chiffres: [], remplissage: false })),
      chiffresDits: [{ cle: "30", brut: "30", t: 40.4, ecran: ecranEnDefaut }],
    },
  } as unknown as ResultatMiseEnSceneIV;
}

const fiche = { ecrans: [{ id: "e01", scene: "toile" }, { id: "e12", scene: "alerte" }] } as unknown as FicheImage;

describe("filet zéro blocage de la mise en scène", () => {
  it("ecransEnDefautIV : le chiffre non montré (Q13) et le trou de rythme (Q14) citent l'écran du plan concerné", () => {
    const d = ecransEnDefautIV(resultat([["Q13", "x"]]).ligne);
    expect(d.q13).toEqual(["e12"]);
    expect(d.q14).toEqual(["e12"]);
  });

  it("ficheAdapteeIV : les écrans cités passent en « titre », les autres et la fiche d'origine restent intacts", () => {
    const f = ficheAdapteeIV(fiche, ["e12"]);
    expect(f.ecrans.map((e) => e.scene)).toEqual(["toile", "titre"]);
    expect(fiche.ecrans[1].scene).toBe("alerte");
    expect(ficheAdapteeIV(fiche, undefined)).toBe(fiche);
  });

  it("un écran adapté qui règle le défaut : la vidéo passe, l'adaptation est journalisée", () => {
    const appels: (readonly string[])[] = [];
    const issue = mettreEnSceneAvecFiletIV((adaptes) => {
      appels.push(adaptes);
      return adaptes.includes("e12") ? resultat([]) : resultat([["Q13", "Chiffre dit mais pas montré : « 30 »"]]);
    });
    expect(issue.refus).toEqual([]);
    expect(issue.gardes).toEqual([]);
    expect(issue.resultat.ok).toBe(true);
    expect(issue.adaptes).toEqual(["e12"]);
    expect(appels).toHaveLength(2);
    expect(issue.journal.join("\n")).toMatch(/essai 1\/3.*e12.*titre/);
  });

  it("le défaut persiste après les essais : la vidéo continue (aucun refus), défaut gardé au journal", () => {
    let n = 0;
    const issue = mettreEnSceneAvecFiletIV(() => {
      n++;
      // Chaque essai désigne un nouvel écran en défaut : e12, puis e13, e14, e15.
      return resultat([["Q14", "Rythme trop lent : 5,3 s"]], `e${11 + n}`);
    });
    expect(issue.refus).toEqual([]);
    expect(issue.gardes).toEqual(["Rythme trop lent : 5,3 s"]);
    // Aucun essai ne réduit le nombre de défauts : toutes les adaptations sont annulées (on garde le meilleur résultat, le premier).
    expect(issue.adaptes).toEqual([]);
    expect(n).toBe(ESSAIS_ADAPTATION_IV + 1);
    expect(issue.journal.at(-1)).toMatch(/la vidéo continue/);
  });

  it("un défaut Q12 (bloc dessiné manquant) garde le refus, même mêlé à un défaut de détail", () => {
    const issue = mettreEnSceneAvecFiletIV(() => resultat([["Q12", "Il manque quelque chose à l'écran : le bloc « A » n'apparaît jamais."], ["Q13", "Chiffre dit mais pas montré"]]));
    expect(issue.refus).toHaveLength(2);
    expect(issue.adaptes).toEqual([]);
  });

  it("une adaptation qui FAIT APPARAÎTRE un Q12 est annulée : la vidéo continue avec le résultat d'avant", () => {
    const issue = mettreEnSceneAvecFiletIV((adaptes) => (adaptes.includes("e12") ? resultat([["Q12", "Il manque le bloc « A »."]]) : resultat([["Q13", "Chiffre dit mais pas montré"]])));
    expect(issue.refus).toEqual([]);
    expect(issue.adaptes).toEqual([]);
    expect(issue.gardes).toEqual(["Chiffre dit mais pas montré"]);
  });

  it("une adaptation qui réduit les défauts de détail est gardée ; un écran déjà en « titre » ou sans texte n'est jamais désigné", () => {
    const f = { ecrans: [{ id: "e01", scene: "toile", textesEcran: [{}] }, { id: "e12", scene: "alerte", textesEcran: [{}] }, { id: "e13", scene: "titre", textesEcran: [{}] }, { id: "e14", scene: "alerte", textesEcran: [] }] } as unknown as FicheImage;
    const vus: (readonly string[])[] = [];
    const issue = mettreEnSceneAvecFiletIV((a) => { vus.push(a); return a.includes("e12") ? resultat([["Q13", "un seul"]]) : resultat([["Q13", "un"], ["Q14", "deux"]]); }, [], "A", f);
    expect(issue.adaptes).toEqual(["e12"]);
    expect(vus.flat().some((id) => id === "e13" || id === "e14")).toBe(false);
  });

  // Limite assumée : `pasMiseEnScene` (état `ecransAdaptes` par version, `e.scenes`, journal ; rendu et contrôles relisent la même fiche via
  // `sceneDe`) n'est pas exporté et dépend de la chaîne complète (carte, voix, bruitages) ; il n'a pas de test de bout en bout ici.
  // Ce qui le porte est couvert au-dessus : le filet pur (`mettreEnSceneAvecFiletIV`) et `ficheAdapteeIV`.

  it("les écrans déjà adaptés (reprise) sont passés à la mise en scène dès le premier appel", () => {
    const premier: (readonly string[])[] = [];
    mettreEnSceneAvecFiletIV((a) => { premier.push(a); return resultat([]); }, ["e12"]);
    expect(premier[0]).toEqual(["e12"]);
  });
});
