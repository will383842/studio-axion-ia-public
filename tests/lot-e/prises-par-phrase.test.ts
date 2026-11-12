/**
 * Lot E (3, 6) : la voix est rangée PHRASE PAR PHRASE. Chaque phrase a sa prise (empreinte = texte + voix + vitesse) ;
 * refaire UNE phrase ne touche pas aux autres, et l'ancienne prise reste dans le stockage (version parente).
 * Rouge avant `prises-phrases.ts`.
 */
import { describe, expect, it } from "vitest";
import { REGLES_BLANCS_CAS_CONCRET, empreintePriseVoix } from "@/moteurs/montage-cas-concret/voix";
import { decouperEnPhrases, morceauxDuCorps, planDesPrises, rangerPrise, refaireUnePhrase, type ContextePhrases, type StockPrises } from "@/moteurs/montage-cas-concret/prises-phrases";

const ctx: ContextePhrases = { fournisseurVoix: "heygen", idVoix: "b22b1a358ca740eda753772ebaaf11f7", reglages: { vitesse: 1.1, stabilite: 45, emotion: 30 }, regles: REGLES_BLANCS_CAS_CONCRET };
const TEXTE = "Vous perdez du temps. Axion IA le fait pour vous. Et chez vous ?";

describe("découpage et empreintes", () => {
  it("une phrase par prise, point final compris", () => {
    expect(decouperEnPhrases("Vous perdez du temps Axion IA le fait.")).toEqual(["Vous perdez du temps Axion IA le fait."]);
    expect(decouperEnPhrases(TEXTE)).toEqual(["Vous perdez du temps.", "Axion IA le fait pour vous.", "Et chez vous ?"]);
  });

  it("l'empreinte d'une phrase = texte + voix + vitesse (la brique `empreintePriseVoix`, pas une copie)", () => {
    const p = planDesPrises(TEXTE, ctx, {});
    expect(p.map((x) => x.texte)).toEqual(decouperEnPhrases(TEXTE));
    expect(p[1].empreinte).toBe(empreintePriseVoix({ texte: "Axion IA le fait pour vous.", fournisseurVoix: "heygen", idVoix: ctx.idVoix, reglages: ctx.reglages, regles: ctx.regles }));
    const autreVitesse = planDesPrises(TEXTE, { ...ctx, reglages: { ...ctx.reglages!, vitesse: 1.05 } }, {});
    expect(autreVitesse.every((x, i) => x.empreinte !== p[i].empreinte)).toBe(true);
    const autreVoix = planDesPrises(TEXTE, { ...ctx, idVoix: "autre" }, {});
    expect(autreVoix.every((x, i) => x.empreinte !== p[i].empreinte)).toBe(true);
  });

  it("changer un mot d'une phrase ne change que l'empreinte de cette phrase", () => {
    const avant = planDesPrises(TEXTE, ctx, {});
    const apres = planDesPrises(TEXTE.replace("temps", "heures"), ctx, {});
    expect(apres.map((x, i) => x.empreinte === avant[i].empreinte)).toEqual([false, true, true]);
  });
});

describe("stockage et reprise", () => {
  const stockComplet = (): StockPrises => {
    let s: StockPrises = {};
    for (const p of planDesPrises(TEXTE, ctx, {})) s = rangerPrise(s, p.empreinte, { texte: p.texte, fichierCle: `voix/${p.empreinte}.wav`, dureeSec: 2, mots: [] });
    return s;
  };

  it("toutes les phrases déjà rangées : rien à lire", () => {
    expect(planDesPrises(TEXTE, ctx, stockComplet()).map((x) => x.etat)).toEqual(["gardee", "gardee", "gardee"]);
  });

  it("une phrase modifiée : seule elle est à lire", () => {
    expect(planDesPrises(TEXTE.replace("temps", "heures"), ctx, stockComplet()).map((x) => x.etat)).toEqual(["a-lire", "gardee", "gardee"]);
  });

  it("refaire UNE phrase : nouvelle prise de cette phrase seule, les autres gardées, l'ancienne prise reste rangée", () => {
    const stock = stockComplet();
    const avant = planDesPrises(TEXTE, ctx, stock);
    const apres = refaireUnePhrase(TEXTE, ctx, stock, {}, 1);
    expect(apres.essais).toEqual({ 1: 2 });
    expect(apres.plan.map((x) => x.etat)).toEqual(["gardee", "a-lire", "gardee"]);
    expect(apres.plan[1].empreinte).not.toBe(avant[1].empreinte);
    expect(apres.plan[0].empreinte).toBe(avant[0].empreinte);
    expect(apres.plan[2].empreinte).toBe(avant[2].empreinte);
    expect(apres.plan[1].parente).toBe(avant[1].empreinte);
    expect(stock[avant[1].empreinte]).toBeDefined();
    // et une deuxième fois : essai 3, parente = la prise de l'essai 2
    const stock2 = rangerPrise(stock, apres.plan[1].empreinte, { texte: apres.plan[1].texte, fichierCle: "voix/n2.wav", dureeSec: 2, mots: [] });
    const encore = refaireUnePhrase(TEXTE, ctx, stock2, apres.essais, 1);
    expect(encore.essais).toEqual({ 1: 3 });
    expect(encore.plan[1].parente).toBe(apres.plan[1].empreinte);
  });

  it("refaire une phrase qui n'existe pas est refusé en clair", () => {
    expect(() => refaireUnePhrase(TEXTE, ctx, stockComplet(), {}, 7)).toThrow(/phrase/i);
  });

  it("les morceaux du corps : une entrée par phrase, dans l'ordre, la phrase refaite à la place de l'ancienne", () => {
    let stock = stockComplet();
    const r = refaireUnePhrase(TEXTE, ctx, stock, {}, 1);
    stock = rangerPrise(stock, r.plan[1].empreinte, { texte: r.plan[1].texte, fichierCle: "voix/neuve.wav", dureeSec: 1.5, mots: [] });
    const m = morceauxDuCorps(planDesPrises(TEXTE, ctx, stock, r.essais), stock);
    expect(m.map((x) => x.entree)).toEqual([expect.stringContaining("voix/voix-cc-"), "voix/neuve.wav", expect.stringContaining("voix/voix-cc-")]);
    expect(m[1]).toEqual({ entree: "voix/neuve.wav", deSec: 0, aSec: 1.5 });
  });
});
