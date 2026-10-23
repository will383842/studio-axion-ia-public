/**
 * Le test de propriété comme test (voir `propriete.ts`) : chaque fiche du banc × chaque style × chaque graine, par la
 * vraie fabrication, 4 formats. Objectif : AUCUN refus après la voix dû au moteur. Seuls sont admis, et comptés à part :
 *  - un refus AVANT la voix (relecture de la fiche, contrôles d'avant la voix : rien n'est payé) ;
 *  - au calage, les deux règles de CONTENU que seule la voix peut juger : la durée (90 s au plus) et le rythme (un
 *    événement visuel toutes les 4 s) — un minutage tiré très lent sur toutes les pages à la fois les dépasse.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { fichesBanc } from "../banc/fiches-banc";
import { essai, type ResultatEssai } from "./propriete";

/** Graines tirées par fiche et par style. */
export const GRAINES = [1, 2, 3];
export const CALAGE_CONTENU = /^calage · Scène \S+ · règle « (durée de 90 secondes au plus|du rythme : un événement visuel toutes les 4 secondes) »/;

export function verifierPropriete(part: number, parts: number): void {
  const fiches = fichesBanc().filter((_, i) => i % parts === part);
  const tous: ResultatEssai[] = [];
  for (const fb of fiches)
    describe(fb.nom, () => {
      for (const style of STYLES_TABLEAU)
        it(`${style} : aucun minutage tiré ne fait refuser la vidéo après la voix`, async () => {
          const fautes: string[] = [];
          for (const g of GRAINES) {
            const r = await essai(fb, style, g);
            tous.push(r);
            const moteur = r.issue === "refus" ? r.raisons.filter((x) => !CALAGE_CONTENU.test(x)) : [];
            if (moteur.length) fautes.push(`graine ${g} : ${moteur.join(" | ")} — tirages ${JSON.stringify(r.tirages)}`);
          }
          expect(fautes).toEqual([]);
        }, 600_000);
    });
  it("bilan", () => {
    const n = (i: ResultatEssai["issue"]) => tous.filter((r) => r.issue === i).length;
    const calage = tous.filter((r) => r.issue === "refus").length;
    // Le détail de chaque essai, pour le compte rendu (facultatif : `BILAN_PROPRIETE=<dossier>`).
    if (process.env.BILAN_PROPRIETE) writeFileSync(`${process.env.BILAN_PROPRIETE}/propriete-${part + 1}.json`, JSON.stringify(tous));
    console.log(`[propriété ${part + 1}/${parts}] essais ${tous.length} · ok ${n("ok")} · refusés avant la voix ${n("avant-voix")} · refusés au calage (contenu) ${calage} · combinaisons page × format jugées ${tous.filter((r) => r.issue === "ok").reduce((s, r) => s + r.combinaisons, 0)}`);
  });
}
