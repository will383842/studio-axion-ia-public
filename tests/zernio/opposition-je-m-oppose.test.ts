/**
 * RGPD · « Je m'oppose » dans le message privé doit être reconnu comme une opposition (sinon relance par erreur).
 * PUR : aucune base, aucun réseau. Données fictives.
 */
import { describe, expect, it } from "vitest";
import { classerOpposition, estMotOpposition } from "@/domaine/guide-reseau/opposition";

const OPPOSITIONS = ["Je m'oppose", "JE M'OPPOSE", "je m’oppose", "Je me oppose", "m'oppose", "Opposition", "opposition svp", "Je m'oppose, merci"];
const DOUTES = ["Je ne m'oppose pas", "Opposé à tout ça, voici a@example.test", "Je m'oppose à cette idée de guide pour mon équipe"];
const NON = ["Je veux le guide", "Merci beaucoup !", "a@example.test"];

describe("opposition « je m'oppose » et variantes", () => {
  it.each(OPPOSITIONS)("« %s » → opposition", (t) => {
    expect(classerOpposition(t)).toBe("opposition");
    expect(estMotOpposition(t)).toBe(true);
  });
  it.each(DOUTES)("« %s » → doute (jamais une relance)", (t) => expect(classerOpposition(t)).toBe("doute"));
  it.each(NON)("« %s » → non", (t) => expect(classerOpposition(t)).toBe("non"));
});
