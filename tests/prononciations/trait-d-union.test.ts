/**
 * PR 1a (plan scripts du tableau, §3 point 1) : un mot courant écrit en minuscules AVEC trait d'union
 * (« peut-être », « c'est-à-dire ») n'est reconnu qu'avec son trait d'union : « il peut être utile » (le verbe) ne change pas.
 * Les noms et sigles gardent leur souplesse (« Axion-IA » reconnaît « AXION IA » et « AxionIA »).
 * Fonctions pures, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { contientMot, motifMot, PRONONCIATIONS_DEPART, substituerPrononciations, variantesMot } from "@/domaine/prononciations";
import { fabriquerSousTitres } from "@/briques/sous-titres";

const affiche = (texte: string, mot: string) =>
  fabriquerSousTitres({ texte, dureeSec: 6, motsParLigne: 8, prononciations: [{ mot, prononciation: "x" }], emphase: [] })
    .flatMap((s) => s.mots.map((m) => m.mot))
    .join(" ");

const PEUT_ETRE = [{ mot: "peut-être", prononciation: "peuh-têtre" }];

describe("mot courant avec trait d'union", () => {
  it("ne touche pas « il peut être utile » (le verbe)", () => {
    expect(substituerPrononciations("Il peut être utile de relire.", PEUT_ETRE)).toBe("Il peut être utile de relire.");
    expect(contientMot("Il peut être utile de relire.", "peut-être")).toBe(false);
  });

  it("change « peut-être » et « Peut-être »", () => {
    expect(substituerPrononciations("Vous avez peut-être déjà vu ça.", PEUT_ETRE)).toBe("Vous avez peuh-têtre déjà vu ça.");
    expect(substituerPrononciations("Peut-être demain.", PEUT_ETRE)).toBe("peuh-têtre demain.");
  });

  it("exige le trait d'union pour « c'est-à-dire »", () => {
    expect(motifMot("c'est-à-dire").test("donc c'est-à-dire que")).toBe(true);
    expect(motifMot("c'est-à-dire").test("donc c'est à dire que")).toBe(false);
  });
});

describe("sous-titres : même règle que la voix", () => {
  it("« il peut être utile » reste inchangé à l'écran, « peut être » aussi", () => {
    expect(affiche("Il peut être utile de relire.", "peut-être")).toBe("Il peut être utile de relire.");
  });

  it("« Peut-être » à l'écran est gardé tel quel avec son trait d'union", () => {
    expect(affiche("Vous avez peut-être déjà vu ça.", "peut-être")).toBe("Vous avez peut-être déjà vu ça.");
  });

  it("un nom garde la souplesse à l'écran (« AXION IA » → « Axion-IA »)", () => {
    expect(affiche("Chez AXION IA on aide.", "Axion-IA")).toBe("Chez Axion-IA on aide.");
  });
});

describe("mot mêlant espace et trait d'union (« peut-être pas »)", () => {
  it("exige « - » là où le mot a un tiret et une espace là où il a une espace", () => {
    expect(contientMot("Ah, peut-être pas.", "peut-être pas")).toBe(true);
    expect(contientMot("Ah, peut-être\u00a0pas.", "peut-être pas")).toBe(true);
    expect(contientMot("Ah, peut être pas.", "peut-être pas")).toBe(false);
    expect(contientMot("Ah, peut-être-pas.", "peut-être pas")).toBe(false);
    expect(contientMot("Ah, peut-êtrepas.", "peut-être pas")).toBe(false);
    expect(affiche("Il peut être pas utile.", "peut-être pas")).toBe("Il peut être pas utile.");
  });
});

describe("variantes d'un mot courant à trait d'union", () => {
  it("pas de forme espacée ni collée pour « peut-être »", () => {
    const v = variantesMot("peut-être");
    expect(v).not.toContain("peut être");
    expect(v).not.toContain("peutêtre");
    expect(v).toContain("peut-être");
  });

  it("un nom garde ses variantes (« Axion-IA »)", () => {
    expect(variantesMot("Axion-IA")).toEqual(expect.arrayContaining(["Axion IA", "AxionIA"]));
  });
});

describe("noms et sigles : souplesse inchangée", () => {
  it("« Axion-IA » reconnaît encore « AXION IA », « AxionIA » et « axion-ia »", () => {
    for (const t of ["AXION IA", "AxionIA", "axion-ia", "Axion-IA", "axion ia"]) expect(contientMot(`Chez ${t} on aide.`, "Axion-IA")).toBe(true);
  });

  it("un mot à trait d'union avec une majuscule garde la souplesse", () => {
    expect(contientMot("le Peut Être", "Peut-Être")).toBe(true);
  });

  it("les 15 entrées de départ donnent exactement le résultat d'avant", () => {
    const texte =
      "Axion-IA, AXION IA et AxionIA aident les PME, les TPE et les PV : IA, I.A., RGPD, TVA, CRM, API, SEO. " +
      "Excel, Telegram, ChatGPT, Claude et HeyGen. Les PVs aussi.";
    const attendu = substituerPrononciations(texte, PRONONCIATIONS_DEPART);
    expect(PRONONCIATIONS_DEPART).toHaveLength(15);
    expect(attendu).toBe(ATTENDU_DEPART);
  });
});

// Valeur figée avant le changement (calculée avec le code de master f85d13e2).
const ATTENDU_DEPART = "axion i-a, axion i-a et axion i-a aident les pé-èm-eu, les té-pé-eu et les pé-vé : i-a, i-a, èr-jé-pé-dé, té-vé-a, cé-èr-èm, a-pé-i, èss-eu-o. ekssèl, télégrame, tchatte jé-pé-té, clôde et hé-djène. Les pé-vé aussi.";
