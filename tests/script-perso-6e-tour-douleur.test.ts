/**
 * SCRIPT PERSO, 6e tour (suite) : règle 10 vérifiée GRATUITEMENT avant le prix sur le texte de Will ; règles 12 et 15
 * branchées dans REGLES_TABLEAU ; garde-fou sur le texte rangé. Mémoire seulement.
 */
import { describe, expect, it } from "vitest";
import { defautDouleurDuTexteDeWill, texteDeWillAccepte } from "@/domaine/relecture-tableau";
import { REGLES_TABLEAU } from "../src/moteurs/montage-tableau/regles";
import { contexteFormationV3, ficheFormationV3Brute } from "./tableau/reference-3/fiches";
import { exempleV4 } from "./tableau-scripts/exemples-v4";

describe("règles 12 et 15 par REGLES_TABLEAU", () => {
  const avecAppelEtNumero = () => {
    const f = ficheFormationV3Brute();
    f.scenes[0].texteDit = `${f.scenes[0].texteDit} Le lien est en commentaire. C'est l'épisode 2.`;
    return f;
  };
  it("passe par REGLES_TABLEAU (règles 12 et 15 reçoivent le contexte)", () => {
    const f = avecAppelEtNumero();
    const c = { ...contexteFormationV3(f), texteDeWill: true };
    for (const n of [12, 15]) expect(REGLES_TABLEAU.find((r) => r.numero === n)!.verifier(f, c)).toEqual([]);
  });
});

describe("2. règle 10 : vérifiée GRATUITEMENT avant le prix, sur le texte de Will", () => {
  const texte = "Vous perdez une heure chaque jour sur vos devis. Voici un réflexe simple pour la rattraper dès ce soir.";
  it("un mot de la douleur dit au début : rien à dire", () => {
    expect(defautDouleurDuTexteDeWill(texte, "Vous perdez du temps", ["perdez une heure"])).toBeNull();
    expect(defautDouleurDuTexteDeWill(texte, "Vous perdez une heure", [])).toBeNull();
  });
  it("aucun mot de la douleur dit au début : une phrase claire dit ce qui manque", () => {
    const loin = `Bonjour à tous et bienvenue sur la chaîne, aujourd'hui je vous parle d'un sujet très précis. ${texte}`;
    const phrase = defautDouleurDuTexteDeWill(loin, "Vous perdez une heure", ["perdez une heure"]);
    expect(phrase).toMatch(/mots? de la douleur/i);
    expect(phrase).toMatch(/premières secondes/);
  });
});

describe("garde-fou : texte rangé d'un brouillon sans origine « will »", () => {
  const { ecriture, demande } = exempleV4("01-formation");
  const generation = { demande, issue: { ok: false as const, meilleure: { ecriture } } };
  it("comparé sur le texte normalisé", () => {
    const b = { generation, donnees: { texte: "Première phrase rangée. Deuxième phrase rangée." } };
    expect(texteDeWillAccepte("PREMIÈRE phrase rangée !", b)).toBe(false);
    expect(texteDeWillAccepte("Rien à voir du tout.", b)).toBe(true);
  });
});
