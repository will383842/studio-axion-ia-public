/**
 * Le .srt d'un tableau animé = les groupes et les instants DONNÉS à la composition (GV-ST-11).
 * Mesuré sur la demande réellement envoyée au rendu et sur la sortie de la fabrication.
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau, type SortieFaite } from "../../src/moteurs/montage-tableau/fabriquer";
import { sousTitresDeLaSortiePrincipale } from "../../src/moteurs/montage-tableau";
import type { ParametresDemandeComposition } from "../../src/briques/composition/scene";
import { ficheDemonstration } from "./regles/exemples";
import { doubles } from "./fabriquer/doubles";

const sortieBidon = (format: string, ratio: string, sousTitres?: SortieFaite["sousTitres"]) => ({ format, ratio, sousTitres }) as unknown as SortieFaite;
const seg = (t: string) => [{ id: t, debutSec: 0, finSec: 1, mots: [{ mot: t, debutSec: 0, finSec: 1 }] }];
const texteDe = (segs: readonly { mots: readonly { mot: string }[] }[]) => segs.map((s) => s.mots.map((m) => m.mot).join(" ")).join(" ");

describe("sous-titres du tableau : le .srt est celui de la composition", () => {
  it("la sortie rend les groupes envoyés à la composition, à 1 ms près, texte intact", async () => {
    const d = doubles(ficheDemonstration, { fin: "Enregistrez cette vidéo pour la refaire" });
    const compte = await fabriquerTableau(d.outils);
    const envoyes = (d.compositionsSoumises()[0].parametres as unknown as Extract<ParametresDemandeComposition, { mode: "complet" }>).texte.sousTitres!.segments;
    const rendus = compte.sorties[0].sousTitres!;
    expect(rendus.length).toBeGreaterThan(0);
    expect(rendus).toHaveLength(envoyes.length);
    rendus.forEach((s, i) => {
      expect(s.mots.map((m) => m.mot)).toEqual(envoyes[i].mots.map((m) => m.mot));
      expect(Math.abs(s.debutSec - envoyes[i].debutSec)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(s.finSec - envoyes[i].finSec)).toBeLessThanOrEqual(0.001);
    });
    expect(texteDe(rendus)).toBe(texteDe(envoyes));
    expect(texteDe(rendus).length).toBeGreaterThan(0);
    // Gardé au journal avec l'étape : une reprise rend les mêmes groupes.
    const reprise = await fabriquerTableau({ ...d.outils });
    expect(reprise.sorties[0].sousTitres).toEqual(rendus);
  });

  it("sousTitresDeLaSortiePrincipale : le premier 9:16 de l'ordre donné ; sinon la première sortie", () => {
    const portrait = sortieBidon("portrait", "4:5", seg("portrait"));
    const v1 = sortieBidon("vertical-liens", "9:16", seg("premier"));
    const v2 = sortieBidon("vertical", "9:16", seg("second"));
    expect(sousTitresDeLaSortiePrincipale([portrait, v1, v2])).toEqual(seg("premier"));
    expect(sousTitresDeLaSortiePrincipale([portrait])).toEqual(seg("portrait"));
    expect(sousTitresDeLaSortiePrincipale([])).toBeUndefined();
    expect(sousTitresDeLaSortiePrincipale([sortieBidon("vertical", "9:16")])).toBeUndefined();
  });
});
