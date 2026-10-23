/**
 * Essai réel du 14/10 : Claude a rendu deux fois la fiche sous une clôture Markdown (```json … ```) et le studio l'a
 * refusée (0,44 € perdus). Seule une clôture qui enveloppe TOUTE la réponse est retirée.
 */
import { describe, expect, it } from "vitest";
import { lireReponse, sansCloture } from "../../../src/moteurs/montage-cas-concret/ecriture";

const FICHE = '{"ecrans":[{"type":"accroche"}]}';
const F = "```";

describe("clôture Markdown autour de la fiche", () => {
  it("une clôture « json » qui enveloppe toute la réponse est lue", () => {
    const l = lireReponse(`${F}json\n${FICHE}\n${F}`);
    expect(l.ok).toBe(true);
    if (l.ok) expect(l.brute).toEqual({ ecrans: [{ type: "accroche" }] });
  });

  it("clôture sans nom, fins de ligne Windows, espaces autour : lue", () => {
    expect(lireReponse(`  ${F}\r\n${FICHE}\r\n${F}  \r\n`).ok).toBe(true);
  });

  it("un JSON nu reste lu tel quel (texte inchangé)", () => {
    const l = lireReponse(FICHE);
    expect(l.ok && l.texte).toBe(FICHE);
  });

  it("du texte AVANT ou APRÈS la clôture reste refusé : aucune autre réparation", () => {
    expect(lireReponse(`Voici la fiche :\n${F}json\n${FICHE}\n${F}`).ok).toBe(false);
    expect(lireReponse(`${F}json\n${FICHE}\n${F}\nBonne chance !`).ok).toBe(false);
  });

  it("une clôture autour d'un JSON invalide reste refusée, avec le message habituel", () => {
    const l = lireReponse(`${F}json\n{"ecrans":[\n${F}`);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.refus).toContain("n'est pas un JSON lisible");
  });

  it("sansCloture ne touche pas un texte sans clôture", () => {
    expect(sansCloture("abc")).toBe("abc");
  });
});
