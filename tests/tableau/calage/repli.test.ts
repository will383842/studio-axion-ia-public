/**
 * Calage approché (GV2-35) : un mot écrit avec un chiffre ou un symbole (« 3h », « 50% », « 1er », « 2,5 », « 100 € »,
 * « & », adresse web) que la voix dit autrement n'arrête plus la fabrication quand la voix est déjà payée : les heures
 * sont approchées entre les mots reconnus, une alerte demande de vérifier l'écriture. Un vrai désaccord reste refusé.
 */
import { describe, expect, it } from "vitest";
import type { MotCalage } from "../../../src/briques/motion/calage";
import type { MotHorodate } from "../../../src/domaine/types";
import { calerFicheTableau, type ResultatCalage } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { contexteExemple, copie, ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";

/** Mots horodatés fabriqués : un jeton par mot dit ; `remplacer` rend les mots que la voix dit à la place d'un jeton. */
function motsFabriques(fiche: FicheTableau, remplacer: (jeton: string) => string[] = (j) => [j]): MotHorodate[] {
  const res: MotHorodate[] = [];
  let t = 120;
  for (const s of fiche.scenes) {
    for (const jeton of s.texteDit.split(/\s+/).filter(Boolean)) {
      // Les mots dits à la place d'un jeton se partagent le temps d'un seul : le débit de la voix ne change pas.
      const dits = remplacer(jeton);
      const part = 330 / Math.max(1, dits.length);
      for (const mot of dits) {
        res.push({ mot, debutSec: t / 1000, finSec: (t + part - 20) / 1000 });
        t += part;
      }
      if (!dits.length) t += 330;
    }
    t += 250;
  }
  return res;
}

const caler = (fiche: FicheTableau, dits: MotCalage[]): ResultatCalage => calerFicheTableau(fiche, dits, { contexte: contexteExemple(fiche) });

/** La fiche d'exemple où le mot « suffit. » de la scène s03 est remplacé par `ecrit` (même nombre de mots, sauf « 10 000 »). */
function avec(ecrit: string): FicheTableau {
  const f = copie(ficheErreurCorrigee);
  f.scenes[2].texteDit = f.scenes[2].texteDit.replace("suffit.", ecrit);
  expect(f.scenes[2].texteDit).toContain(ecrit);
  return f;
}

const SONDE: [string, string[]][] = [
  ["3h", ["trois", "heures"]],
  ["50%", ["cinquante", "pour", "cent"]],
  ["1er", ["premier"]],
  ["10 000", ["dix", "mille"]],
  ["2,5", ["deux", "virgule", "cinq"]],
  ["100 €", ["cent", "euros"]],
  ["&", ["et"]],
  ["axion-ia.com", ["axion", "ia", "point", "com"]],
];

describe("calage approché des chiffres et symboles", () => {
  for (const [ecrit, dit] of SONDE) {
    it(`« ${ecrit} » dit « ${dit.join(" ")} » : calé avec une alerte, heures croissantes et sans trou`, () => {
      const f = avec(ecrit);

      // La voix dit les mots du symbole à la place du jeton écrit (sauf « 10 000 » et « 100 € » : deux jetons écrits).
      const jetons = ecrit.split(" ");
      const lues = motsFabriques(f, (j) => (j === jetons[0] ? dit : jetons.slice(1).includes(j) ? [] : [j]));
      const r = caler(f, lues);
      expect(r.ok, r.ok ? "" : r.problemes.join("\n")).toBe(true);
      if (!r.ok) return;
      expect(r.alertes).toHaveLength(1);
      expect(r.alertes![0]).toMatch(/^Calage approché sur \d+ mots? \(à partir de « .+ », scène s0[34]\) : vérifiez l'écriture à l'image\.$/);
      const sc = r.fiche.scenes;
      expect(sc[0].debutMs).toBe(0);
      for (const s of sc) expect(s.finMs!).toBeGreaterThan(s.debutMs!);
      for (let i = 1; i < sc.length; i++) expect(sc[i].debutMs).toBe(sc[i - 1].finMs);
      // Le texte dit reste celui du script validé, mot pour mot.
      expect(sc[2].texteDit).toBe(f.scenes[2].texteDit);
      let d = -1;
      for (const e of r.elements) {
        expect(e.debutMs).toBeGreaterThanOrEqual(0);
        d = Math.max(d, e.debutMs);
      }
    });
  }

  it("un calage exact ne porte aucune alerte", () => {
    const r = caler(ficheErreurCorrigee, motsFabriques(ficheErreurCorrigee));
    expect(r.ok && r.alertes).toBeFalsy();
  });
});

describe("un vrai désaccord reste refusé", () => {
  it("« suffit. » dit « suffira. » : refusé, même quand ce sont plus de 10 % des mots", () => {
    const f = ficheErreurCorrigee;
    const [p] = (() => {
      const r = caler(f, motsFabriques(f, (j) => (j === "suffit." ? ["suffira."] : [j])));
      expect(r.ok).toBe(false);
      return r.ok ? [] : r.problemes;
    })();
    expect(p).toMatch(/^Scène s03 · le mot 6 écrit « suffit\. » ne correspond pas au mot dit « suffira\. »/);
    const tous = caler(f, motsFabriques(f, (j) => (j.endsWith(".") ? ["suffira."] : [j])));
    expect(tous.ok).toBe(false);
  });

  it("« devis » dit « deu vi » : refusé", () => {
    const f = ficheQuestionAbonne;
    const r = caler(f, motsFabriques(f, (j) => (j === "devis" ? ["deu", "vi"] : [j])));
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problemes[0]).toContain("Scène s01 · le mot 2 écrit « devis »");
  });

  it("un mot à chiffre dit tout autrement et suivi d'un autre écart : refusé (moins de 90 % reconnus)", () => {
    const f = avec("3h");
    const jeux = motsFabriques(f, (j) => (j === "3h" ? ["trois", "heures"] : j.endsWith(".") ? ["autre"] : [j]));
    expect(caler(f, jeux).ok).toBe(false);
  });
});
