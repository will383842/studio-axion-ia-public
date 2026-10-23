/**
 * CORRECTEUR 3 · B8 (audit B, 03/10) : découpage d'un texte COLLÉ.
 *  - les retours à la ligne et les paragraphes de Will sont respectés (jamais deux lignes dans un même morceau,
 *    jamais un paragraphe coupé entre deux blocs) ;
 *  - un texte SANS ponctuation est découpé en morceaux lisibles (plus un seul bloc géant) ;
 *  - JAMAIS un mot réécrit : la suite des mots est identique, mot pour mot.
 */
import { describe, expect, it } from "vitest";
import { decouperTexte } from "@/fournisseurs/simulation/script";
import { formatAvocat } from "@/formats/avocat";
import type { BlocScript } from "@/domaine/types";

const recette = formatAvocat.recetteScript;
const mots = (t: string) => t.split(/\s+/).filter(Boolean);
const motsDesBlocs = (b: BlocScript[]) => b.flatMap((x) => x.segments.flatMap((s) => mots(s.texte)));

describe("B8 · découpage d'un texte collé", () => {
  it("une ligne = au moins un morceau : deux lignes ne sont jamais collées dans le même morceau", () => {
    const texte = "Votre patron lit vos mails\nIl en a le droit\nSauf un mail marqué personnel\nRetenez ce mot";
    const blocs = decouperTexte(texte, recette);
    const segments = blocs.flatMap((b) => b.segments.map((s) => s.texte));
    expect(segments).toEqual(["Votre patron lit vos mails", "Il en a le droit", "Sauf un mail marqué personnel", "Retenez ce mot"]);
    expect(blocs[0].blocRecette).toBe("accroche");
    expect(blocs.at(-1)!.blocRecette).toBe("boucle");
  });

  it("les paragraphes sont gardés entiers : un paragraphe n'est jamais coupé entre deux blocs", () => {
    const p1 = "Votre patron lit vos mails ? Je vous explique.";
    const p2 = "Il peut ouvrir les mails professionnels. Un mail est présumé professionnel. Un salarié a perdu 2 500 €.";
    const p3 = "Retenez le mot personnel. Et c'est l'erreur de tous.";
    const blocs = decouperTexte(`${p1}\n\n${p2}\n\n${p3}`, recette);
    const blocDe = (phrase: string) => blocs.findIndex((b) => b.segments.some((s) => s.texte === phrase));
    expect(blocDe("Votre patron lit vos mails ?")).toBe(blocDe("Je vous explique."));
    expect(blocDe("Retenez le mot personnel.")).toBe(blocDe("Et c'est l'erreur de tous."));
    expect(blocDe("Il peut ouvrir les mails professionnels.")).toBe(blocDe("Un salarié a perdu 2 500 €."));
    expect(blocs[0].blocRecette).toBe("accroche");
    expect(blocs.at(-1)!.blocRecette).toBe("boucle");
  });

  it("un texte sans aucune ponctuation ni retour à la ligne est découpé en plusieurs blocs", () => {
    const texte = Array.from({ length: 80 }, (_, i) => `mot${i}`).join(" ");
    const blocs = decouperTexte(texte, recette);
    expect(blocs.length).toBeGreaterThan(1);
    expect(blocs[0].blocRecette).toBe("accroche");
    expect(blocs.at(-1)!.blocRecette).toBe("boucle");
    for (const b of blocs) for (const s of b.segments) expect(mots(s.texte).length).toBeLessThanOrEqual(20);
  });

  it("jamais un mot réécrit : la suite des mots est identique, mot pour mot (ponctuation, majuscules, chiffres)", () => {
    const textes = [
      "Votre patron lit vos mails ? Je vous explique.\nIl peut ouvrir les mails professionnels…\n\n  Un salarié a perdu 2 500 € !  Retenez : « personnel ».",
      "sans ponctuation du tout et pourtant il faut que chaque mot reste exactement le même du début à la fin même les mots bizarres comme l'API ou 3,5 % ou C'est-à-dire",
      "Une ligne\r\nUne autre ligne\r\n\r\nUn paragraphe.\tAvec une tabulation.",
    ];
    for (const t of textes) expect(motsDesBlocs(decouperTexte(t, recette))).toEqual(mots(t));
  });
});
