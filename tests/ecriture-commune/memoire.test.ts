/** C1.2 : mémoire commune (pure) : séquences, charpentes fréquentes, tirage sans récents, anonymisation, jamais dans le cache. */
import { describe, expect, it } from "vitest";
import {
  FENETRE_VERSIONS_MEMOIRE,
  anonymiserPourMemoire,
  assemblerConsigne,
  blocMemoire,
  copiesDe,
  memoireAntiCopie,
  memoireDansLeCache,
  moulesFrequents,
  tirerSansRecent,
} from "@/domaine/ecriture-commune/memoire";
import * as ancien from "@/domaine/cas-concret-variete";

const A = "Avant, vous passiez des heures à trier vos factures, et pour quoi ? On a tout automatisé.";
const B = "Avant, vous perdiez des journées à relire vos contrats, et pour quoi ? Le robot classe chaque dossier.";

describe("compatibilité avec le cas concret", () => {
  it("cas-concret-variete réexporte les mêmes fonctions", () => {
    expect(ancien.memoireAntiCopie).toBe(memoireAntiCopie);
    expect(ancien.blocMemoire).toBe(blocMemoire);
    expect(ancien.copiesDe).toBe(copiesDe);
  });
});

describe("fenêtre", () => {
  it("60 versions, partagées entre générateurs", () => {
    expect(FENETRE_VERSIONS_MEMOIRE).toBe(60);
  });
});

describe("moulesFrequents", () => {
  it("rend les charpentes présentes dans plusieurs scripts, les plus fréquentes d'abord", () => {
    const r = moulesFrequents([A, B, "Le devis part seul."], 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].scripts).toBe(2);
  });
  it("plafonne", () => {
    expect(moulesFrequents([A, B], 1).length).toBeLessThanOrEqual(1);
  });
  it("rien sous deux scripts", () => {
    expect(moulesFrequents([A], 5)).toEqual([]);
  });
});

describe("tirerSansRecent", () => {
  const options = ["a", "b", "c", "d", "e"];
  it("ne rend jamais un récent tant qu'il reste un choix", () => {
    for (let i = 0; i < 40; i++) expect(["d", "e"]).toContain(tirerSansRecent(options, ["a", "b", "c"], `g${i}`));
  });
  it("est déterministe pour une même graine", () => {
    expect(tirerSansRecent(options, [], "x")).toBe(tirerSansRecent(options, [], "x"));
  });
  it("répartit : des graines différentes donnent plusieurs formes", () => {
    const vus = new Set(Array.from({ length: 40 }, (_, i) => tirerSansRecent(options, [], `g${i}`)));
    expect(vus.size).toBeGreaterThan(2);
  });
  it("si tout est récent, rend le moins récemment utilisé (le plus ancien de la liste)", () => {
    expect(tirerSansRecent(options, ["c", "a", "b", "e", "d"], "z")).toBe("c");
  });
  it("une option absente des récents passe avant un récent, même ancien", () => {
    expect(tirerSansRecent(["a", "b"], ["a"], "z")).toBe("b");
  });
  it("refuse une liste vide", () => {
    expect(() => tirerSansRecent([], [], "x")).toThrow();
  });
});

describe("anonymiserPourMemoire", () => {
  it("remplace les noms sensibles par une forme neutre", () => {
    expect(anonymiserPourMemoire("Chez Dupont SARL, on trie les mails.", ["Dupont SARL"])).not.toContain("Dupont");
  });
  it("sans nom sensible : texte inchangé", () => {
    expect(anonymiserPourMemoire("On trie les mails.", [])).toBe("On trie les mails.");
  });
});

describe("jamais de mémoire dans la partie en cache", () => {
  const memoire = memoireAntiCopie([A, B, A], {});
  it("assemblerConsigne met le bloc dans la partie variable seulement", () => {
    const r = assemblerConsigne({ cache: "Règles fixes de Will.", variable: "Sujet du jour.", memoire });
    expect(r.cache).toBe("Règles fixes de Will.");
    expect(r.variable).toContain("Sujet du jour.");
    if (memoire.length) expect(r.variable).toContain(blocMemoire(memoire));
  });
  it("sans mémoire la partie variable est inchangée", () => {
    expect(assemblerConsigne({ cache: "c", variable: "v", memoire: [] }).variable).toBe("v");
  });
  it("memoireDansLeCache repère le BLOC de mémoire dans le cache (en-tête ou ligne du bloc), pas une simple tournure", () => {
    expect(memoire.length).toBeGreaterThan(0);
    expect(memoireDansLeCache(`Règles.\n${blocMemoire(memoire)}\nFin.`, memoire)).toBe(true);
    expect(memoireDansLeCache("Règles. À NE PAS REDIRE (déjà dit dans d'autres scripts) : rien", memoire)).toBe(true);
    expect(memoireDansLeCache("Règles fixes.", memoire)).toBe(false);
  });
  it("une tournure de la mémoire dans les règles fixes n'est PAS un refus : les scripts reprennent des tournures des règles", () => {
    const r = assemblerConsigne({ cache: `x ${memoire[0].texte}`, variable: "v", memoire });
    expect(r.avertissement).toBeUndefined();
    expect(r.variable).toContain(blocMemoire(memoire));
  });
  it("un bloc dans le cache est signalé (avertissement), sans lever, et la consigne continue", () => {
    const r = assemblerConsigne({ cache: `Règles.\n${blocMemoire(memoire)}`, variable: "v", memoire });
    expect(r.avertissement).toMatch(/cache/i);
    expect(r.variable).toContain(blocMemoire(memoire));
    expect(r.cache).toContain(blocMemoire(memoire));
  });
  it("l'en-tête seul dans le cache est signalé aussi", () => {
    expect(assemblerConsigne({ cache: "Règles. À ne pas redire (déjà dit", variable: "v", memoire }).avertissement).toMatch(/cache/i);
  });
  it("une séquence de plus de 12 mots, tronquée dans le bloc, est quand même repérée dans le cache", () => {
    const longue = [{ cle: "x", texte: "un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze", mots: 15, scripts: 2 }];
    expect(blocMemoire(longue)).toContain("…");
    expect(assemblerConsigne({ cache: `Règles.\n${blocMemoire(longue)}`, variable: "v", memoire: longue }).avertissement).toMatch(/cache/i);
    expect(memoireDansLeCache(`Règles.\n${blocMemoire(longue)}`, longue)).toBe(true);
  });
});
