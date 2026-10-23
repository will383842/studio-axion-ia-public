/**
 * SCRIPT PERSO, 6e tour (décision de Will du 18/10) : le texte que Will fournit lui-même est pris à l'identique.
 *  1. origine du texte selon la saisie (champ vidé, import, retour par « J'ai déjà mon texte ») : fonction pure ;
 *  2. le découpage payant ne refuse pas le texte dit de Will pour une phrase d'appel (règle 12) ou un numéro (règle 15) ;
 *  3. le garde-fou « ce texte est celui de Claude » compare des textes normalisés (casse, ponctuation) et la moitié des phrases.
 */
import { describe, expect, it } from "vitest";
import { origineApresSaisie, texteDeWillAccepte } from "@/domaine/relecture-tableau";
import { regleSansAppel, regleSansNumeroEpisode } from "../src/moteurs/montage-tableau/regles";
import { contexteFormationV3, ficheFormationV3Brute } from "./tableau/reference-3/fiches";
import { exempleV4 } from "./tableau-scripts/exemples-v4";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";

describe("1. origine selon la saisie", () => {
  const ref = "Le texte de Claude. Il est affiché.";
  it("champ vidé puis collage : « will », et il le reste", () => {
    expect(origineApresSaisie("generateur", "champ", "", ref)).toBe("will");
    expect(origineApresSaisie("will", "champ", "Son texte collé.", ref)).toBe("will");
  });
  it("retouche d'un texte de Claude dans le champ : l'origine ne change pas", () => {
    expect(origineApresSaisie("generateur", "champ", "Le texte de Claude retouché.", ref)).toBe("generateur");
  });
  it("import d'un fichier ou d'un texte : « will »", () => {
    expect(origineApresSaisie("generateur", "import", "Un texte importé.", ref)).toBe("will");
  });
  it("retour par « J'ai déjà mon texte » : « will » reste « will » ; sinon un texte de Claude retouché reste à Claude, champ vide = Will", () => {
    expect(origineApresSaisie("will", "bouton", "Son texte.", ref)).toBe("will");
    expect(origineApresSaisie("generateur", "bouton", "Le texte de Claude retouché.", ref)).toBe("generateur");
    expect(origineApresSaisie("generateur", "bouton", "", ref)).toBe("will");
    expect(origineApresSaisie("generateur", "bouton", "Un texte.", null)).toBe("will");
  });
});

describe("2. règles 12 et 15 sur le texte dit de Will", () => {
  const ficheDit = (phrase: string) => {
    const f = ficheFormationV3Brute();
    f.scenes[0].texteDit = `${f.scenes[0].texteDit} ${phrase}`;
    return f;
  };
  it("règle 12 : « le lien est en commentaire » dit par Will ne refuse pas ; sans l'origine will, refusé", () => {
    const f = ficheDit("Le lien est en commentaire.");
    expect(regleSansAppel(f, { ...contexteFormationV3(f), texteDeWill: true })).toEqual([]);
    expect(regleSansAppel(f, contexteFormationV3(f)).length).toBeGreaterThan(0);
  });
  it("règle 15 : « prochain épisode » dit par Will ne refuse pas ; sans l'origine will, refusé", () => {
    const f = ficheDit("On en parle dans le prochain épisode.");
    expect(regleSansNumeroEpisode(f, { ...contexteFormationV3(f), texteDeWill: true })).toEqual([]);
    expect(regleSansNumeroEpisode(f, contexteFormationV3(f)).length).toBeGreaterThan(0);
  });
  it("origine will : un appel ÉCRIT à l'écran reste refusé", () => {
    const f = ficheFormationV3Brute();
    const titre = f.scenes[1].elements.find((e) => e.id === "e03") as { texte: string };
    titre.texte = "Le lien est en commentaire";
    expect(regleSansAppel(f, { ...contexteFormationV3(f), texteDeWill: true }).length).toBeGreaterThan(0);
  });
});

describe("3. texteDeWillAccepte : comparaison normalisée", () => {
  const { ecriture, demande } = exempleV4("01-formation");
  const dit = texteDitDe(ecriture.script);
  const generation = { traceId: "t", demande, le: "2026-10-18T00:00:00Z", issue: { ok: false as const, motifs: [], meilleure: { passe: "ecriture", ecriture, defauts: [], valide: true } } };
  const b = { generation: generation as never, donnees: { texte: "" } };
  it("le texte de Claude en capitales ou sans ponctuation n'est pas accepté comme texte de Will", () => {
    expect(texteDeWillAccepte(dit.toUpperCase(), b)).toBe(false);
    expect(texteDeWillAccepte(dit.replace(/[.,;:!?«»]/g, ""), b)).toBe(false);
  });
  it("un mot changé, la moitié des phrases de Claude reprises : refusé", () => {
    const phrases = dit.split(/(?<=[.!?])\s+/).filter((p) => p.split(/\s+/).length >= 3);
    expect(texteDeWillAccepte(`${phrases.slice(0, Math.ceil(phrases.length / 2)).join(" ")} Et voici ma propre fin.`, b)).toBe(false);
    expect(texteDeWillAccepte(dit.replace(/\b(\w{5,})\b/, "autre"), b)).toBe(false);
  });
  it("un vrai texte de Will, quelques mots en commun : accepté", () => {
    expect(texteDeWillAccepte("Voici mon propre texte. Il parle d'autre chose, avec mes mots à moi.", b)).toBe(true);
  });
});
