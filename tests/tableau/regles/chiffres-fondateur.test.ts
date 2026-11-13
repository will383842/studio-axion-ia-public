/**
 * GV2-31 · règle 7 (chiffres sourcés) : dans le texte du fondateur (`texteDeWill`), un chiffre écrit est permis s'il est
 * DIT dans le texte de la même scène ; un chiffre jamais dit reste refusé ; les scripts du générateur gardent la règle entière.
 */
import { describe, expect, it } from "vitest";
import { REGLES_TABLEAU } from "../../../src/moteurs/montage-tableau/regles";
import { copie, ficheErreurCorrigee } from "./exemples";
import { accepte, element, refuse, scene } from "./outils";

const nom = REGLES_TABLEAU.find((r) => r.numero === 7)!.nom;

/** Fiche d'exemple : la ligne e03 (scène s02) écrit « 2 heures », et la scène le dit (ou non). */
const DIT_2_HEURES = "Vous perdez 2 heures par semaine, et l'IA répond.";
const DIT_EN_LETTRES = "Vous perdez deux heures par semaine, et l'IA répond.";

function avecLigne(texte: string, dit?: string) {
  const f = copie(ficheErreurCorrigee);
  element(f, "e03", "ligne").texte = texte;
  if (dit) scene(f, "s02").texteDit = dit;
  return f;
}

describe("règle 7 · chiffres du texte du fondateur", () => {
  it("texte du fondateur : « 2 heures » écrit dans une scène qui dit « 2 heures » → acceptée", () => {
    accepte(avecLigne("Perdre 2 heures", DIT_2_HEURES), { texteDeWill: true, sourcesChiffres: [] });
  });

  it("texte du fondateur : chiffre dit en lettres (« deux heures ») → acceptée", () => {
    accepte(avecLigne("Perdre 2 heures", DIT_EN_LETTRES), { texteDeWill: true, sourcesChiffres: [] });
  });

  it("texte du fondateur : « 40 % » jamais dit → refusée", () => {
    const [p] = refuse(avecLigne("40 % de perte", DIT_2_HEURES), nom, { texteDeWill: true, sourcesChiffres: [] });
    expect(p.message).toContain("« 40 % de perte » contient un chiffre sans élément chiffre sourcé");
  });

  it("texte du fondateur : un chiffre dit dans une AUTRE scène ne suffit pas → refusée", () => {
    const f = avecLigne("Perdre 2 heures");
    scene(f, "s01").texteDit = "Vos réponses de 2 heures sont vagues ? Voici pourquoi.";
    refuse(f, nom, { texteDeWill: true, sourcesChiffres: [] });
  });

  it("script du générateur : « 2 heures » sans source → refusée comme aujourd'hui", () => {
    const f = avecLigne("Perdre 2 heures", DIT_2_HEURES);
    const [p] = refuse(f, nom, { sourcesChiffres: [] });
    expect(p.message).toContain("« Perdre 2 heures » contient un chiffre sans élément chiffre sourcé");
    refuse(f, nom, { texteDeWill: false, sourcesChiffres: [] });
  });
});
