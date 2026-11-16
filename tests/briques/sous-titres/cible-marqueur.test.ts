/** C2-U6 : cible du marqueur (expression entière, ou mot dit). Phrase écrite ici, aucune voix. */
import { describe, expect, it } from "vitest";
import { empreinteTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { donneesCalque } from "@/briques/sous-titres";
import { largeurElement, sceneAuTemps, SOULIGNEMENT, type DonneesCalque } from "@/briques/sous-titres/scene";
import type { MotRendu, SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { ValeurStyleSousTitres } from "@/domaine/types";

const mots = (texte: string, valeur: string[] = [], debut = 1): MotRendu[] =>
  texte.split(" ").map((mot, i) => ({ mot, debutSec: +(debut + i * 0.4).toFixed(3), finSec: +(debut + i * 0.4 + 0.3).toFixed(3), ...(valeur.includes(mot) ? { enValeur: true } : {}) }));
const groupe = (ms: MotRendu[], souligne: number | null, id = "g1"): SegmentRendu => ({ id, debutSec: ms[0].debutSec, finSec: ms.at(-1)!.finSec + 0.1, mots: ms, souligne, style: "base", position: "auto", importance: 1 });
const style = (cible?: "souligne" | "expression" | "mot-dit"): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, texteEcran: { marqueur: { teinte: "terracotta", ...(cible ? { cible } : {}) } } });
const calque = (segments: SegmentRendu[], cible?: "souligne" | "expression" | "mot-dit", base: "karaoke" | "minimal" = "karaoke") => donneesCalque({ segments, base, style: style(cible) });
const lumineux = (d: DonneesCalque, t: number) => (sceneAuTemps(d, t)?.mots ?? []).filter((m) => m.souligne > 0).map((m) => m.texte);

describe("C2-U6 : cible du marqueur", () => {
  it("(a) expression : la suite contiguë en valeur, forte ou nombre, 4 mots au plus, chacun à son debutSec", () => {
    const ms = mots("jamais les mails personnels", ["mails", "personnels"]);
    const d = calque([groupe(ms, 2)], "expression");
    const fin = ms.at(-1)!.debutSec + 0.2;
    expect(lumineux(d, fin)).toEqual(["mails", "personnels"]);
    const ms2 = mots("jamais les mails personnels", ["les", "mails", "personnels"]);
    const d2 = calque([groupe(ms2, 2)], "expression");
    expect(lumineux(d2, fin)).toEqual(["jamais", "les", "mails", "personnels"]);
    for (const m of ms2) {
      const el = (t: number) => sceneAuTemps(d2, t)?.mots.find((x) => x.texte === m.mot)?.souligne ?? 0;
      expect(el(m.debutSec - 0.01)).toBe(0);
      expect(el(m.debutSec + 0.02)).toBeGreaterThan(0);
      expect(el(m.debutSec + SOULIGNEMENT.dureeSec + 0.01)).toBe(1);
    }
    const six = mots("jamais rien aucun personne interdit gratuit");
    const d6 = calque([groupe(six, 2)], "expression");
    expect(lumineux(d6, six.at(-1)!.debutSec + 0.2)).toHaveLength(4);
    // groupe sans mot souligné : rien
    expect(lumineux(calque([groupe(ms2, null)], "expression"), fin)).toEqual([]);
  });

  it("(b) mot dit : au plus un mot, exactement un dès 0,02 s après son début, aucun en blanc", () => {
    const ms = mots("votre patron peut lire vos mails");
    const d = calque([groupe(ms.slice(0, 3), 1, "a"), groupe(ms.slice(3), 4, "b")], "mot-dit");
    const ts: number[] = [];
    for (let i = 0; i < 20; i++) ts.push(+(ms[i % ms.length].debutSec + 0.02 + (i % 3) * 0.05).toFixed(3));
    for (const t of ts) {
      if (sceneAuTemps(d, t)) expect(lumineux(d, t)).toHaveLength(1);
    }
    for (const m of ms) expect(lumineux(d, m.debutSec + 0.02)).toEqual([m.mot]);
    expect(sceneAuTemps(d, 0.2)).toBeNull();
    expect(lumineux(d, 0.2)).toEqual([]);
  });

  it("(c) mot dit sur base Minimal : repli, identique au calque sans cible", () => {
    const ms = mots("votre patron peut lire vos mails", ["mails"]);
    const segs = [groupe(ms, 5)];
    const avec = calque(segs, "mot-dit", "minimal");
    const sans = calque(segs, undefined, "minimal");
    for (let i = 0; i < 12; i++) {
      const t = 0.9 + i * 0.3;
      const a = sceneAuTemps(avec, t);
      const b = sceneAuTemps(sans, t);
      expect(a === null ? null : { ...a, margeMarqueurPx: undefined }).toEqual(b === null ? null : { ...b, margeMarqueurPx: undefined });
    }
  });

  it("(d) l'empreinte change entre deux mots successifs en mot dit", () => {
    const ms = mots("votre patron peut lire vos mails");
    const d = calque([groupe(ms, 1)], "mot-dit");
    const e = (t: number) => empreinteTexte({ sousTitres: d, encadre: undefined, incrustations: [] }, t);
    expect(e(ms[1].debutSec + 0.2)).not.toBe(e(ms[2].debutSec + 0.2));
  });

  it("(e) éteint = identique : sans cible et avec « souligne », aucune clé ajoutée", () => {
    const ms = mots("jamais les mails personnels", ["mails", "personnels"]);
    const segs = [groupe(ms, 2)];
    const base = calque(segs);
    const souligne = calque(segs, "souligne");
    expect(souligne).toEqual(base);
    expect("cibleMarqueur" in base).toBe(false);
    expect("cibleMarqueur" in souligne).toBe(false);
    for (let i = 0; i < 10; i++) {
      const t = 0.8 + i * 0.3;
      const a = sceneAuTemps(base, t);
      expect(sceneAuTemps(souligne, t)).toEqual(a);
      if (a) expect("margeMarqueurPx" in a).toBe(false);
    }
  });

  it("(f) largeurElement : + 2 × 0,1 × taillePx avec une cible", () => {
    const ms = mots("jamais les mails personnels", ["mails"]);
    const segs = [groupe(ms, 2)];
    const t = ms.at(-1)!.debutSec + 0.1;
    const sans = sceneAuTemps(calque(segs), t)!;
    const avec = sceneAuTemps(calque(segs, "expression"), t)!;
    expect(avec.margeMarqueurPx).toBeCloseTo(2 * 0.1 * avec.taillePx, 6);
    expect(largeurElement(avec) - largeurElement(sans)).toBeCloseTo(2 * 0.1 * sans.taillePx, 6);
  });
});
