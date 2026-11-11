import { describe, expect, it } from "vitest";
import { estMotOpposition, formeCanonique } from "@/domaine/guide-reseau/opposition";
import { motSeulDe, MOTS_DECLENCHEURS_CONNUS } from "@/domaine/guide-reseau/crochet-zernio";

// Règle : une opposition est au moins aussi tolérante qu'un déclencheur (accents, casse, bordures, guillemets, pleine chasse).
describe("opposition tolérante (valeurs fictives)", () => {
  it.each(["STOP !", "stop ?", "« stop »", "\"stop\"", "stop 🙏", "Arrêtez.", "#STOP", "ＳＴＯＰ", "  Stop…  ", "ARRÊT", "arret!!", "Arrêtez 🙏🙏"])("« %s » est une opposition", (t) => {
    expect(estMotOpposition(t)).toBe(true);
  });

  it.each(["je ne vais pas stop tout de suite", "GUIDE stop", "stop guide", "s t o p", "stopper", "", "🙏", "GUIDE", "12345"])("« %s » n'est PAS une opposition", (t) => {
    expect(estMotOpposition(t)).toBe(false);
  });

  it("« stop stop » est une opposition ; « stopper » reste non", () => {
    expect(estMotOpposition("stop stop")).toBe(true);
    expect(estMotOpposition("stopper")).toBe(false);
  });

  it("non-texte : jamais une opposition", () => {
    expect(estMotOpposition(null)).toBe(false);
    expect(estMotOpposition(undefined)).toBe(false);
  });

  it("« GUIDE stop » (deux mots) : ni déclencheur ni opposition", () => {
    expect(motSeulDe("GUIDE stop")).toBeNull();
    expect(estMotOpposition("GUIDE stop")).toBe(false);
  });

  it("l'opposition reste reconnue par motSeulDe avec ses variantes", () => {
    for (const t of ["stop ?", "« stop »", "stop 🙏", "Arrêtez."]) expect(motSeulDe(t)).toBe(formeCanonique(t)); // forme canonique, jamais le texte brut
    expect(motSeulDe("stop ?")).toBe("STOP");
    expect(motSeulDe("Arrêtez.")).toBe("ARRETEZ");
  });

  it("propriété : toute décoration acceptée pour un déclencheur est acceptée pour « stop »", () => {
    const decos: Array<(m: string) => string> = [
      (m) => m, (m) => m.toLowerCase(), (m) => `${m} !`, (m) => `${m} ?`, (m) => `« ${m} »`, (m) => `"${m}"`, (m) => `#${m}`, (m) => `${m} 👍`, (m) => `${m}.`,
      (m) => `  ${m}  `, (m) => m.toUpperCase(), (m) => m.replace(/./, (c) => c.toUpperCase()), (m) => m.normalize("NFKC").replace(/[A-Za-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)),
    ];
    for (const d of decos) {
      const decoree = d(MOTS_DECLENCHEURS_CONNUS[0]);
      if (motSeulDe(decoree) === null) continue;
      for (const mot of ["stop", "arrêtez"]) expect(estMotOpposition(d(mot)), d(mot)).toBe(true);
    }
  });
});
