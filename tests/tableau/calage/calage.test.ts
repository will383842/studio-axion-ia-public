/**
 * Calage du tableau animé (TB-02) : les 4 fiches d'exemple calées sur des mots horodatés fabriqués (aucune voix
 * réelle), les refus (ancre hors du texte, mot qui ne correspond pas, voix trop courte ou trop longue, fiche calée
 * refusée par la validation), l'écart toléré des prononciations, le déterminisme.
 */
import { describe, expect, it } from "vitest";
import type { MotCalage } from "../../../src/briques/motion/calage";
import { mots } from "../../../src/domaine/controles-script/texte";
import type { MotHorodate } from "../../../src/domaine/types";
import { calerFicheTableau, type ResultatCalage } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";

/** Mots horodatés fabriqués : un jeton par mot du texte dit (ponctuation comprise, comme une voix), à débit régulier. */
function motsFabriques(
  fiche: FicheTableau,
  o: { parMotMs?: number; pauseMs?: number; remplacer?: (jeton: string) => string[] } = {},
): MotHorodate[] {
  const parMot = o.parMotMs ?? 330;
  const pause = o.pauseMs ?? 250;
  const res: MotHorodate[] = [];
  let t = 120;
  for (const s of fiche.scenes) {
    for (const jeton of s.texteDit.split(/\s+/).filter(Boolean)) {
      for (const mot of o.remplacer?.(jeton) ?? [jeton]) {
        res.push({ mot, debutSec: t / 1000, finSec: (t + parMot - 40) / 1000 });
        t += parMot;
      }
    }
    t += pause;
  }
  return res;
}

const caler = (fiche: FicheTableau, dits: MotCalage[], extra: Partial<Parameters<typeof calerFicheTableau>[2]> = {}) =>
  calerFicheTableau(fiche, dits, { contexte: contexteExemple(fiche), ...extra });

function reussi(r: ResultatCalage) {
  if (!r.ok) throw new Error(r.problemes.join("\n"));
  return r;
}

function refuse(r: ResultatCalage): string[] {
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.problemes;
}

describe.each(Object.entries(EXEMPLES))("exemple %s calé", (_nom, fiche) => {
  const dits = motsFabriques(fiche);
  const r = reussi(caler(fiche, dits));

  it("chaque scène a son début et sa fin ; elles se suivent sans trou ni chevauchement", () => {
    const sc = r.fiche.scenes;
    expect(sc[0].debutMs).toBe(0);
    for (const s of sc) expect(s.finMs!).toBeGreaterThan(s.debutMs!);
    for (let i = 1; i < sc.length; i++) expect(sc[i].debutMs).toBe(sc[i - 1].finMs);
    expect(sc.at(-1)!.finMs).toBe(Math.round(dits.at(-1)!.finSec * 1000));
  });

  it("une scène commence au premier mot qu'elle dit", () => {
    let rang = 0;
    const ecrits = dits.filter((d) => /[\p{L}\p{N}]/u.test(d.mot));
    r.fiche.scenes.forEach((s, i) => {
      if (i > 0) expect(s.debutMs).toBe(Math.round(ecrits[rang].debutSec * 1000));
      rang += mots(s.texteDit).length;
    });
  });

  it("chaque élément part à son mot d'ancre (ancre 0 : au début de la scène)", () => {
    expect(r.elements).toHaveLength(fiche.scenes.flatMap((s) => s.elements).length);
    const ecrits = dits.filter((d) => /[\p{L}\p{N}]/u.test(d.mot));
    let rang = 0;
    for (const s of r.fiche.scenes) {
      for (const e of s.elements) {
        const cale = r.elements.find((x) => x.elementId === e.id)!;
        expect(cale.sceneId).toBe(s.id);
        const ancre = "ancre" in e ? e.ancre : 0;
        expect(cale.debutMs).toBe(ancre === 0 ? s.debutMs : Math.round(ecrits[rang + ancre].debutSec * 1000));
        expect(cale.debutMs).toBeGreaterThanOrEqual(s.debutMs!);
        expect(cale.debutMs).toBeLessThanOrEqual(s.finMs!);
      }
      rang += mots(s.texteDit).length;
    }
  });

  it("la fiche calée ne change que les heures et repasse la validation", () => {
    const sansHeures = r.fiche.scenes.map((s) => {
      const c: Partial<typeof s> = { ...s };
      delete c.debutMs;
      delete c.finMs;
      return c;
    });
    expect(sansHeures).toEqual(fiche.scenes);
    expect({ ...r.fiche, scenes: [] }).toEqual({ ...fiche, scenes: [] });
    expect(caler(r.fiche, dits)).toEqual(r);
  });

  it("déterministe ; la fiche d'entrée n'est pas modifiée", () => {
    const avant = JSON.stringify(fiche);
    expect(JSON.stringify(caler(copie(fiche), motsFabriques(fiche)))).toBe(JSON.stringify(r));
    expect(JSON.stringify(fiche)).toBe(avant);
  });
});

describe("refus", () => {
  it("une ancre hors du texte dit, en nommant la scène", () => {
    const f = copie(ficheErreurCorrigee);
    const e = f.scenes[2].elements.find((x) => "ancre" in x)! as { ancre: number; id: string };
    e.ancre = 40;
    const [p, ...reste] = refuse(caler(f, motsFabriques(f)));
    expect(reste).toEqual([]);
    expect(p).toMatch(/^Scène s03 · l'élément « e\d+ » part du mot 41, mais le texte dit n'a que \d+ mots\.$/);
  });

  it("un mot dit qui ne correspond pas au mot écrit", () => {
    const f = ficheErreurCorrigee;
    const dits = motsFabriques(f, { remplacer: (j) => [j === "suffit." ? "suffira." : j] });
    const [p] = refuse(caler(f, dits));
    expect(p).toMatch(/^Scène s03 · le mot 6 écrit « suffit\. » ne correspond pas au mot dit « suffira\. »/);
  });

  it("une prononciation qui n'est pas dans la liste est refusée", () => {
    const f = ficheQuestionAbonne;
    const dits = motsFabriques(f, { remplacer: (j) => (j === "devis" ? ["deu", "vi"] : [j]) });
    const [p] = refuse(caler(f, dits));
    expect(p).toContain("Scène s01 · le mot 2 écrit « devis »");
  });

  it("la voix s'arrête trop tôt, ou dit plus que le texte", () => {
    const f = ficheErreurCorrigee;
    const dits = motsFabriques(f);
    expect(refuse(caler(f, dits.slice(0, -2)))[0]).toMatch(/^Scène s06 · la voix s'arrête avant le mot 7/);
    const trop = [...dits, { mot: "merci", debutSec: 99, finSec: 99.3 }];
    expect(refuse(caler(f, trop))[0]).toBe("Scène s06 · la voix dit 1 mot de plus que le texte dit (à partir de « merci »).");
  });

  it("des heures incohérentes", () => {
    const f = ficheErreurCorrigee;
    const dits = motsFabriques(f);
    dits[3] = { ...dits[3], debutSec: 0 };
    expect(refuse(caler(f, dits))[0]).toMatch(/^Le mot dit n° 4 .* a des heures incohérentes/);
  });

  it("une fiche calée qui ne passe plus la validation (voix trop lente : plus de 90 s)", () => {
    const f = ficheErreurCorrigee;
    const r = caler(f, motsFabriques(f, { parMotMs: 2500 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.validation?.map((p) => p.regle)).toContain("durée de 90 secondes au plus");
  });
});

describe("écart toléré (prononciations)", () => {
  it("un mot de la liste dit sous sa prononciation", () => {
    const f = ficheQuestionAbonne;
    const dits = motsFabriques(f, { remplacer: (j) => (j === "devis" ? ["deu", "vi"] : [j]) });
    const r = reussi(caler(f, dits, { prononciations: [{ mot: "devis", prononciation: "deu vi" }] }));
    // « Vos deu vi restent sans réponse ? » : 7 jetons dits ; la scène s02 commence au 8e.
    expect(r.fiche.scenes[1].debutMs).toBe(Math.round(dits[7].debutSec * 1000));
    // L'élément ancré sur « restent » (mot 3 écrit) part au 4e mot dit.
    expect(dits[3].mot).toBe("restent");
  });

  it("un sigle de la liste dit autrement, à l'intérieur d'un mot élidé (« l'IA », « d'IA »)", () => {
    const f = ficheErreurCorrigee;
    const dits = motsFabriques(f, { remplacer: (j) => (j === "l'IA" ? ["l'hi", "ha"] : j === "d'IA" ? ["d'hiha"] : [j]) });
    expect(refuse(caler(f, dits))[0]).toContain("« d'IA »");
    reussi(caler(f, dits, { prononciations: [{ mot: "IA", prononciation: "hi ha" }] }));
  });

  it("un nombre écrit en chiffres et dit en lettres (« 3 » → « trois »)", () => {
    const f = ficheQuestionAbonne;
    const dits = motsFabriques(f, { remplacer: (j) => [j === "3" ? "trois" : j] });
    reussi(caler(f, dits));
  });

  it("un mot coupé ou collé autrement par la voix, casse et accents ignorés", () => {
    const f = ficheErreurCorrigee;
    const dits = motsFabriques(f, { remplacer: (j) => (j === "d'abord." ? ["d'", "ABORD"] : j === "Vous" ? ["vous"] : [j]) });
    reussi(caler(f, dits));
  });

  it("la fin du son, plus tardive que le dernier mot, ferme la dernière scène", () => {
    const f = ficheErreurCorrigee;
    const dits = motsFabriques(f);
    const r = reussi(caler(f, dits, { dureeSec: dits.at(-1)!.finSec + 1.3 }));
    expect(r.fiche.scenes.at(-1)!.finMs).toBe(Math.round((dits.at(-1)!.finSec + 1.3) * 1000));
    expect(reussi(caler(f, dits, { dureeSec: 1 })).fiche.scenes.at(-1)!.finMs).toBe(Math.round(dits.at(-1)!.finSec * 1000));
  });
});
