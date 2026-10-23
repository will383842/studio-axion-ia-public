/**
 * 10/10 — passage DIT AUTREMENT (montage v4 d'IMG_7747, master fde7a39), sur la vraie transcription : le texte validé dit
 * « avec des aides autant que possible grâce à Certifexemple », Will a dit « avec des aides OPCO possibles, IA Calliopi »
 * (82,4 → 87,9 s). Avant : ~5 s sans sous-titres, « Ou » mal calé, et « phrase absente du montage » (fausse alerte).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { calculerCoupes, controlerCoupes, motsDuMontage, texteDesSousTitres, versMontage } from "@/briques/coupes";
import { horodaterMotsPrononces } from "@/briques/calage/report";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const DUREE_PRISE = 130.732;

/** Le texte de la transcription, orthographe du script, avec la phrase VALIDÉE de la prod (dite autrement). */
const TEXTE = reel.mots
  .map((m) => m.mot)
  .reduce((s, m) => (/^['-]/.test(m) ? s + m : s ? `${s} ${m}` : m), "")
  .replace("avec des aides OPCO possibles, IA Calliopi,", "avec des aides autant que possible grâce à Certifexemple,");

describe("passage dit autrement — IMG_7747 v4, données réelles", () => {
  const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: TEXTE });
  const index = plan.phrases.findIndex((p) => p.texte.startsWith("Une formation pour vos équipes"));

  it("la phrase n'est plus « absente du montage » : elle est « dite autrement » (82,4 → 87,1 s)", () => {
    expect(plan.mode).toBe("texte");
    expect(index).toBeGreaterThan(0);
    const p = plan.phrases[index];
    expect(p.diteAutrement?.debutSec).toBeCloseTo(82.39, 2);
    expect(p.diteAutrement?.finSec).toBeGreaterThan(87);
    const ctrl = controlerCoupes(plan, reel.mots);
    expect(ctrl.phrasesManquantes).toEqual([]);
    expect(ctrl.phrasesDitesAutrement).toEqual([index]);
  });

  it("sous-titres : les mots dits sur leurs vrais instants (lexique : Certifexemple), aucun trou, « Ou » bien calé", () => {
    const texte = texteDesSousTitres(plan.phrases);
    expect(texte).toContain("Une formation pour vos équipes, avec des aides OPCO possibles, IA Certifexemple, en vous orientant vers les bonnes.");
    const montes = motsDuMontage(reel.mots, plan.gardes);
    const sous = horodaterMotsPrononces(texte.split(/\s+/).filter(Boolean), montes);
    const debut = versMontage(82.39, plan.gardes)!;
    const ou = sous.find((m) => m.mot === "Ou" && m.debutSec > debut - 1)!;
    expect(ou.debutSec).toBeCloseTo(versMontage(87.53, plan.gardes)!, 1);
    const passage = sous.filter((m) => m.debutSec >= debut - 0.05 && m.finSec <= ou.debutSec + 0.01);
    expect(passage.map((m) => m.mot).join(" ")).toBe("Une formation pour vos équipes, avec des aides OPCO possibles, IA Certifexemple, en vous orientant vers les bonnes.");
    // Jamais de mot sous-titré hors de sa parole.
    const parole = montes.filter((m) => m.debutSec >= debut - 0.05 && m.finSec <= ou.finSec + 0.01);
    for (const s of [...passage, ou]) expect(parole.some((m) => s.debutSec < m.finSec + 1e-3 && s.finSec > m.debutSec - 1e-3)).toBe(true);
  });
});
