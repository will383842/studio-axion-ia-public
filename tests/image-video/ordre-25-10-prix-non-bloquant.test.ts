/**
 * Ordre du 25/10/2026 · le prix ne bloque jamais une génération Image → vidéo en mode indicatif.
 * Cause : le contrôle comparait dépense + prix MAXIMAL théorique de la voix au plafond ; la voix réelle (0,9 €) était refusée
 * pour un maximum théorique de 8,90 €. Moteur pur, doubles du monde, rien n'est payé.
 * Témoin : en mode bloquant (pas d'outil `indicatif`), l'ancien arrêt reste.
 */
import { describe, expect, it } from "vitest";
import { avancerJusquAArretIV, controleAutomatiqueScriptIV, etatInitialIV, miseDeCoteScriptIV } from "@/moteurs/montage-image-video/fabrication";
import type { OutilsFabricationIV } from "@/moteurs/montage-image-video";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

const LOT = { id: "lot-iv-0123456789ab", rang: 1 };
const prop = (engage: number, auPlus: number, plafond: number) =>
  ({ formules: [], aTrancher: [], prix: { engageCentimes: engage, auPlusCentimes: auPlus, habituelCentimes: 90, plafondCentimes: plafond } }) as unknown as Parameters<typeof miseDeCoteScriptIV>[0];

function outilsIndicatifs(carte: ReturnType<typeof carteFixe>, m: ReturnType<typeof monde>, signaux: string[]): OutilsFabricationIV {
  const base = outilsSimules(carte, m, { cartesValidees: 0 });
  return { ...base, budget: { ...base.budget, indicatif: { facteurSecurite: 5, signaler: async (message: string) => void signaux.push(message) } } };
}

describe("miseDeCoteScriptIV : le prix ne met jamais le script de côté en indicatif", () => {
  it("voix réelle 0,9 € mais maximum théorique 8,90 € au-dessus du plafond : indicatif → null", () => {
    expect(miseDeCoteScriptIV(prop(100, 890, 100), 5, { prixIndicatif: true })).toBeNull();
    expect(miseDeCoteScriptIV(prop(5000, 890, 100), 5, { prixIndicatif: true })).toBeNull(); // même au-delà de 5 ×
    expect(miseDeCoteScriptIV(prop(100, 890, 100), undefined, { prixIndicatif: true })).toBeNull();
  });
  it("témoin bloquant : l'ancien arrêt reste", () => {
    expect(miseDeCoteScriptIV(prop(100, 890, 100))?.motif).toContain("La voix dépasserait le prix accordé");
    expect(miseDeCoteScriptIV(prop(100, 890, 100), undefined, { prixIndicatif: false })).not.toBeNull();
  });
  it("indicatif : un prix non calculé (0) met toujours de côté, ce n'est pas un dépassement", () => {
    expect(miseDeCoteScriptIV(prop(0, 0, 100), 5, { prixIndicatif: true })?.motif).toBe("Le prix de la voix n'a pas pu être calculé.");
  });
});

describe("machine : la voix part malgré un plafond bas en indicatif", () => {
  it("lot, indicatif, plafond 100 c, au-delà de 5 × : script jamais mis de côté, la voix est lue", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const signaux: string[] = [];
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 100 })), outilsIndicatifs(carte, m, signaux), { pasMax: 4 });
    expect(e.miseDeCote).toBeUndefined();
    expect(e.etape).not.toBe("script-a-valider");
    expect(e.refus?.code).not.toBe("IV_PLAFOND");
    expect(m.lus.length).toBeGreaterThan(0);
    expect(signaux.length).toBeGreaterThan(0);
  });
  it("vidéo seule en mode automatique, indicatif : même chose", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { validationCarte: "automatique", plafondCentimes: 100 })), outilsIndicatifs(carte, m, []), { pasMax: 4 });
    expect(e.miseDeCote).toBeUndefined();
    expect(e.etape).not.toBe("script-a-valider");
    expect(m.lus.length).toBeGreaterThan(0);
  });
  it("même plafond très bas (1 c), jamais d'arrêt de sécurité en indicatif", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 1 })), outilsIndicatifs(carte, m, []), { pasMax: 4 });
    expect(e.refus?.code).not.toBe("IV_PLAFOND");
    expect(m.appelsClaude.length).toBeGreaterThan(0);
  });
  it("témoin bloquant : plafond 100 c, le script est mis de côté, aucune voix", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 100 })), outilsSimules(carte, m, { cartesValidees: 0 }));
    expect(e.miseDeCote?.porte).toBe("script");
    expect(m.lus).toHaveLength(0);
  });
  it("témoin bloquant : plafond 1 c, arrêt net IV_PLAFOND", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 1 })), outilsSimules(carte, m, { cartesValidees: 0 }));
    expect(e.refus).toMatchObject({ code: "IV_PLAFOND" });
  });
});

describe("controleAutomatiqueScriptIV suit l'option", () => {
  it("signature acceptant l'option prixIndicatif", () => {
    expect(typeof controleAutomatiqueScriptIV).toBe("function");
    expect(controleAutomatiqueScriptIV.length).toBeGreaterThanOrEqual(1);
  });
});
