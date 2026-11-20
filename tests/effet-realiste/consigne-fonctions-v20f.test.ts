import { describe, expect, it } from "vitest";
import { actionAnglaise, descriptionFrancaise, nettoyerConsigneClaude, NOMS_ANGLAIS } from "../../src/briques/effet-realiste/consigne";
import type { DemandeEffetLue } from "../../src/briques/effet-realiste/demande";
import type { ObjetConnu } from "../../src/briques/effet-realiste/types";

const demande = (o: Partial<DemandeEffetLue> = {}): DemandeEffetLue => ({
  objet: "telephone",
  dansLaMain: true,
  finitSurEcran: false,
  dansLeDecor: false,
  dureeSec: null,
  sonSuggere: null,
  ...o,
});

const OBJETS: ObjetConnu[] = ["telephone", "logo-axion", "tasse", "livre", "stylo", "carte-bancaire", "cle", "autre"];

describe("actionAnglaise", () => {
  it("dans la main : phrase exacte avec le nom anglais de l'objet", () => {
    expect(actionAnglaise(demande(), false)).toBe(
      "A modern black smartphone with its screen on appears in the person's open hand, resting on the palm facing up, fingers slightly curled around it, held naturally at chest height.",
    );
  });

  it("finit sur l'écran : ajoute le lancer vers l'objectif après la phrase de la main", () => {
    const main = actionAnglaise(demande(), false);
    const lance = actionAnglaise(demande({ finitSurEcran: true }), false);
    expect(lance.startsWith(`${main} After a short beat, the person throws it straight toward the camera`)).toBe(true);
    expect(lance.endsWith("hits the camera lens at the very end of the clip (impact on the screen).")).toBe(true);
  });

  it("dans le décor : posé sur le bureau, et le décor l'emporte sur finitSurEcran", () => {
    const attendu =
      "A white ceramic cup of hot coffee with light steam appears naturally on the desk in front of the person, resting on the surface with a soft contact shadow, as if it had always been there.";
    expect(actionAnglaise(demande({ objet: "tasse", dansLeDecor: true, dansLaMain: false }), false)).toBe(attendu);
    expect(actionAnglaise(demande({ objet: "tasse", dansLeDecor: true, finitSurEcran: true }), false)).toBe(attendu);
  });

  it("objet « autre » : avec image de référence → « the object shown in the reference image »", () => {
    expect(actionAnglaise(demande({ objet: "autre" }), true)).toBe(
      "The object shown in the reference image appears in the person's open hand, resting on the palm facing up, fingers slightly curled around it, held naturally at chest height.",
    );
  });

  it("objet « autre » sans référence : « the requested object » ; référence sans effet pour un objet connu", () => {
    expect(actionAnglaise(demande({ objet: "autre" }), false).startsWith("The requested object appears in the person's open hand")).toBe(true);
    expect(actionAnglaise(demande({ objet: "livre" }), true)).toBe(actionAnglaise(demande({ objet: "livre" }), false));
    expect(actionAnglaise(demande({ objet: "livre" }), true).startsWith("A hardcover book appears")).toBe(true);
  });

  it("chaque objet connu : la phrase commence par son nom anglais en majuscule initiale", () => {
    for (const objet of OBJETS.filter((x) => x !== "autre")) {
      const nom = NOMS_ANGLAIS[objet];
      expect(actionAnglaise(demande({ objet }), false).startsWith(`${nom.charAt(0).toUpperCase()}${nom.slice(1)} appears`)).toBe(true);
    }
  });
});

describe("nettoyerConsigneClaude", () => {
  const ANGLAIS = "The person holds a black pen in the open hand with a soft light.";

  it("null, undefined et chaîne vide → null", () => {
    expect(nettoyerConsigneClaude(null)).toBeNull();
    expect(nettoyerConsigneClaude(undefined)).toBeNull();
    expect(nettoyerConsigneClaude("")).toBeNull();
  });

  it("espaces seuls → null", () => {
    expect(nettoyerConsigneClaude("     \n\t  ")).toBeNull();
  });

  it("moins de 20 caractères après nettoyage → null ; exactement 20 → gardé", () => {
    expect(nettoyerConsigneClaude("  short text  ")).toBeNull();
    expect(nettoyerConsigneClaude("a pen in the hand ok")).toBe("a pen in the hand ok");
    expect("a pen in the hand ok".length).toBe(20);
    expect(nettoyerConsigneClaude("a pen in the hand o")).toBeNull();
  });

  it("une seule ligne : retours à la ligne, tabulations et espaces multiples réduits à un espace, bords coupés", () => {
    expect(nettoyerConsigneClaude("  The person holds\n\n a black   pen\tin the hand.  ")).toBe("The person holds a black pen in the hand.");
  });

  it("guillemets conservés tels quels (non retirés)", () => {
    expect(nettoyerConsigneClaude('"The person holds a black pen in the hand."')).toBe('"The person holds a black pen in the hand."');
  });

  it("texte trop long : coupé à 900 caractères exactement", () => {
    const long = `The person holds a pen. ${"word ".repeat(400)}`;
    const r = nettoyerConsigneClaude(long);
    expect(r).not.toBeNull();
    expect(r!.length).toBe(900);
    expect(r!.startsWith("The person holds a pen. word word")).toBe(true);
  });

  it("texte juste sous 900 caractères : inchangé", () => {
    const t = `The person holds a pen ${"x".repeat(600)}`;
    expect(nettoyerConsigneClaude(t)).toBe(t);
  });

  it("consigne en français sans mot anglais → null", () => {
    expect(nettoyerConsigneClaude("Une personne tient un stylo dans la main avec une lumière douce")).toBeNull();
  });

  it("consigne mixte (mots français ET anglais) → gardée", () => {
    const mixte = "The person holds le stylo with a soft light in the room.";
    expect(nettoyerConsigneClaude(mixte)).toBe(mixte);
  });

  it("consigne anglaise ordinaire → renvoyée telle quelle", () => {
    expect(nettoyerConsigneClaude(ANGLAIS)).toBe(ANGLAIS);
  });
});

describe("descriptionFrancaise", () => {
  const NOMS: Record<ObjetConnu, string> = {
    telephone: "Un téléphone",
    "logo-axion": "Le logo Axion",
    tasse: "Une tasse de café",
    livre: "Un livre",
    stylo: "Un stylo",
    "carte-bancaire": "Une carte bancaire",
    cle: "Des clés",
    autre: "L'objet demandé",
  };

  it("dans la main (cas par défaut) pour chaque objet", () => {
    for (const objet of OBJETS) expect(descriptionFrancaise(demande({ objet }))).toBe(`${NOMS[objet]} apparaît dans votre main, en vrai.`);
  });

  it("dans le décor pour chaque objet", () => {
    for (const objet of OBJETS) expect(descriptionFrancaise(demande({ objet, dansLeDecor: true, dansLaMain: false }))).toBe(`${NOMS[objet]} apparaît sur votre bureau, en vrai.`);
  });

  it("finit sur l'écran pour chaque objet", () => {
    for (const objet of OBJETS)
      expect(descriptionFrancaise(demande({ objet, finitSurEcran: true }))).toBe(`${NOMS[objet]} apparaît dans votre main, puis vous le jetez vers l'écran (la vitre se brise à l'impact).`);
  });

  it("décor prioritaire sur finitSurEcran", () => {
    expect(descriptionFrancaise(demande({ dansLeDecor: true, finitSurEcran: true }))).toBe("Un téléphone apparaît sur votre bureau, en vrai.");
  });
});
