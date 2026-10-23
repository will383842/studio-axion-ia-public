/**
 * ESSAI RÉEL n° 2 (05/10/2026) : le décor « salon … veste bleu marine sur chemise claire, assis » est sorti en t-shirt,
 * debout : la consigne imposait « same outfit » (la traduction mot à mot perdait la tenue). Le texte de HeyGen en cas de
 * refus est désormais lisible en console, masqué.
 */
import { describe, expect, it } from "vitest";
import { consigneLook, sujetDecorEn } from "@/domaine/decors";
import { detailMasque } from "@/fournisseurs/heygen/client";

const PHRASE = "salon d'interview éditorial tons sable et cognac, deux fauteuils en cuir cognac, lampe chaude, plante, veste bleu marine sur chemise claire, assis";

describe("ESSAI RÉEL n° 2 : la tenue et la posture décrites sont demandées à HeyGen", () => {
  it("une tenue décrite en français remplace la tenue d'origine, la posture « assis » est demandée", () => {
    const c = consigneLook(sujetDecorEn(PHRASE), "trois-quarts", PHRASE);
    expect(c).not.toMatch(/same outfit/);
    expect(c).toMatch(/NEW outfit/);
    expect(c).toMatch(/Seated/);
    expect(c).toContain("veste bleu marine sur chemise claire");
    expect(c.length).toBeLessThanOrEqual(1000);
  });
  it("sans tenue décrite, la tenue d'origine est gardée", () => {
    const c = consigneLook(sujetDecorEn("une bibliothèque lumineuse"), "face", "une bibliothèque lumineuse");
    expect(c).toMatch(/same outfit/);
  });
  it("le texte d'erreur de HeyGen est masqué (aucune suite longue, ni clé ni jeton)", () => {
    const d = detailMasque("invalid parameter fit for photo_avatar; key sk_V2_hgu_kD8Xa9qLmZp3RtYw7Bn2 rejected");
    expect(d).toContain("invalid parameter fit");
    expect(d).not.toMatch(/sk_V2_hgu_kD8Xa9qLmZp3RtYw7Bn2/);
  });
});
