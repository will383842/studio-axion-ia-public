/**
 * Mots importants du tableau animé (fiche GV-ST-09) : la règle unique de la brique centrale s'applique aux sous-titres du
 * tableau (« trois jours », « devis » passent en valeur), `motsEnValeur: false` éteint tout, et les groupes restent dans
 * la bande réservée.
 */
import { describe, expect, it } from "vitest";
import { sceneAuTemps } from "../../src/briques/sous-titres";
import type { CommandeFabrication } from "../../src/domaine/types";
import { bandeDe, bandeDuCalque, emphaseTableau, encombrementTableau, sousTitresTableau, zoneTexteTableau, type SousTitresTableau } from "../../src/moteurs/montage-tableau/sous-titres-tableau";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, reseauxDuRatio, segmentsSousTitresTableau } from "../../src/moteurs/montage-tableau/fabriquer";
import { parametresComposition } from "../../src/briques/composition/parametres";
import { formatSortie } from "../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../src/moteurs/montage-tableau/mise-en-page";
import type { FicheTableau } from "../../src/moteurs/montage-tableau/fiche";
import { caleeEcritureALHeure } from "./reference-3/fiches";

const TEXTE = "Il faut trois jours pour un devis.";
const scenes = [{ id: "s01", debutSec: 0, finSec: 4, cle: "k" }];
// Seuls champs lus par la voie sans mélange : la commande (style, base) et le style du tableau (motsEnValeur).
const commandeMinimale = { styles: {}, sousTitres: { base: "karaoke", intensite: "equilibre" } } as unknown as CommandeFabrication;
const stMinimal = (motsEnValeur: boolean) => ({ motsEnValeur }) as unknown as SousTitresTableau;
const reseaux = reseauxDuRatio("9:16");
const brut = (motsEnValeur: boolean) =>
  segmentsSousTitresTableau({ c: commandeMinimale, st: stMinimal(motsEnValeur), dynamiques: false, texte: TEXTE, dureeSec: 4, ratio: "9:16", reseaux, scenes, mise: undefined as never });
const enValeur = (motsEnValeur: boolean) => brut(motsEnValeur).flatMap((s) => s.mots).filter((m) => m.enValeur).map((m) => m.mot);

describe("mots importants du tableau animé", () => {
  it("« trois jours » et « devis » sont en valeur, pas « faut » ni « pour »", () => {
    const v = enValeur(true);
    expect(v).toContain("trois");
    expect(v).toContain("jours");
    expect(v).toContain("devis.");
    expect(v).not.toContain("faut");
    expect(v).not.toContain("pour");
  });

  it("motsEnValeur: false n'en met aucun en valeur", () => {
    expect(enValeur(false)).toEqual([]);
    expect(emphaseTableau({ texte: TEXTE, motsEnValeur: false })).toEqual([]);
  });

  it("le texte et l'ordre des mots ne changent pas", () => {
    expect(brut(true).flatMap((s) => s.mots.map((m) => m.mot)).join(" ")).toBe(brut(false).flatMap((s) => s.mots.map((m) => m.mot)).join(" "));
  });

  it("l'emphase du script, si elle existe, passe avant les mots forts", () => {
    expect(emphaseTableau({ texte: TEXTE, emphaseScript: ["faut"], motsEnValeur: true })).toEqual(["faut"]);
  });
});

describe("sous-titres dans la bande après mise en valeur", () => {
  it("chaque groupe reste dans la bande réservée (chaîne complète)", () => {
    const { fiche: ficheBase, mots } = caleeEcritureALHeure();
    const texte = ficheBase.scenes.map((s) => s.texteDit).join(" ");
    const dureeSec = mots.at(-1)!.finSec + 0.5;
    const sc = [{ id: "s01", debutSec: 0, finSec: dureeSec, cle: "k" }];
    const fiche: FicheTableau = { ...ficheBase, styleTableau: "ardoise" };
    const mise = mettreEnPage(fiche, { format: "carre" });
    const f = formatSortie("carre");
    const rs = reseauxDuRatio(f.ratio);
    const bande = bandeDe(mise, f.ratio, false, rs);
    const st = sousTitresTableau({ fiche, positionPct: centreBandePct(mise), bande });
    const c = commandeTableau({ videoId: "v", fiche, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes: sc, ratio: f.ratio, bandeSousTitres: bande });
    const segments = segmentsSousTitresTableau({ c, st, dynamiques: true, texte, dureeSec, mots, ratio: f.ratio, reseaux: rs, scenes: sc, mise });
    expect(segments.some((s) => s.mots.some((m) => m.enValeur))).toBe(true);
    const calque = parametresComposition(c, { ratio: f.ratio, plans: plansTableau(sc), segments, dureeSec, mots, pistesDouble: { face: "k" } }, RECETTE_COMPOSITION_TABLEAU).texte.sousTitres!;
    const bandeCalque = bandeDuCalque(mise, calque);
    const zone = zoneTexteTableau(st, bandeCalque);
    const e = calque.echelleTexte ?? calque.largeur / 1080;
    for (const s of calque.segments) {
      const el = sceneAuTemps(calque, Math.min(Math.max(s.debutSec + 0.3, s.mots.at(-1)!.debutSec + 0.01), s.finSec - 0.001))!;
      const demi = encombrementTableau(el, e).demiHauteur;
      expect(el.yPx + el.decalageYPx - demi).toBeGreaterThanOrEqual(zone.y - 1);
      expect(el.yPx + el.decalageYPx + demi).toBeLessThanOrEqual(bandeCalque.y + bandeCalque.hauteur + 1);
    }
  });
});
