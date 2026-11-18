/** Fiche VL-02 : brique voix-longue. Aucun réseau : le fournisseur de voix est un faux injecté. */
import { describe, expect, it } from "vitest";
import { CARACTERES_MAX_MORCEAU, decouperScript, lireVoixLongue, mesurerVoixLongue, recollerHorodatages, type FournisseurVoixLongue } from "@/briques/voix-longue";

const mots = (t: string) => t.split(/\s+/).filter(Boolean);
const phrase = (n: number) => `Phrase numéro ${n} du script validé par l'utilisateur.`;
const chapitre = (id: string, nb: number, debut = 0) => ({ id, texte: Array.from({ length: nb }, (_, i) => phrase(debut + i)).join(" ") });

describe("découpage", () => {
  it("un texte de moins de 5 000 caractères = 1 seul morceau, inchangé", () => {
    const c = [{ id: "a", texte: "Bonjour. Voici la réponse." }];
    const m = decouperScript(c);
    expect(m).toHaveLength(1);
    expect(m[0].texte).toBe("Bonjour. Voici la réponse.");
  });

  it("plusieurs chapitres courts tiennent en un morceau", () => {
    const m = decouperScript([chapitre("a", 5), chapitre("b", 5, 5)]);
    expect(m).toHaveLength(1);
    expect(m[0].chapitreIds).toEqual(["a", "b"]);
  });

  it("aucun morceau au-dessus de 5 000, aucun mot perdu ni ajouté, ordre gardé", () => {
    const c = [chapitre("a", 60), chapitre("b", 120, 60), chapitre("c", 40, 180)];
    const m = decouperScript(c);
    expect(m.length).toBeGreaterThan(1);
    for (const x of m) expect(x.texte.length).toBeLessThanOrEqual(CARACTERES_MAX_MORCEAU);
    expect(mots(m.map((x) => x.texte).join(" "))).toEqual(mots(c.map((x) => x.texte).join(" ")));
    expect(m.map((x) => x.index)).toEqual(m.map((_, i) => i));
  });

  it("coupe un long chapitre à une fin de phrase", () => {
    const m = decouperScript([chapitre("a", 200)], 1000);
    for (const x of m) expect(x.texte).toMatch(/\.$/);
  });

  it("une phrase plus longue que la limite est coupée sans perdre de mot", () => {
    const longue = Array.from({ length: 300 }, (_, i) => `mot${i}`).join(" ");
    const m = decouperScript([{ id: "a", texte: longue }], 500);
    for (const x of m) expect(x.texte.length).toBeLessThanOrEqual(500);
    expect(mots(m.map((x) => x.texte).join(" "))).toEqual(mots(longue));
  });

  it("un mot unique plus long que la limite n'est jamais perdu", () => {
    const m = decouperScript([{ id: "a", texte: "x".repeat(25) }], 10);
    expect(m.map((x) => x.texte).join("")).toBe("x".repeat(25));
    for (const x of m) expect(x.texte.length).toBeLessThanOrEqual(10);
  });

  it("ignore les chapitres vides et refuse une limite invalide", () => {
    expect(decouperScript([{ id: "a", texte: "  " }])).toEqual([]);
    expect(() => decouperScript([], 0)).toThrow(RangeError);
  });
});

describe("recollage", () => {
  const lecture = (d: number, n: number) => ({ dureeSec: d, mots: Array.from({ length: n }, (_, i) => ({ mot: `m${i}`, debutSec: (i * d) / n, finSec: ((i + 1) * d) / n })) });

  it("décale les morceaux bout à bout, heures croissantes, aucun mot perdu", () => {
    const r = recollerHorodatages([lecture(10, 5), lecture(20, 8), lecture(4, 2)]);
    expect(r.mots).toHaveLength(15);
    expect(r.dureeSec).toBe(34);
    expect(r.debutsMorceauxSec).toEqual([0, 10, 30]);
    for (let i = 1; i < r.mots.length; i++) expect(r.mots[i].debutSec).toBeGreaterThanOrEqual(r.mots[i - 1].finSec);
    expect(r.mots[5].debutSec).toBe(10);
  });

  it("un seul morceau : identique à la lecture d'origine", () => {
    const l = lecture(7, 4);
    const r = recollerHorodatages([l]);
    expect(r.mots).toEqual(l.mots);
    expect(r.dureeSec).toBe(7);
  });

  it("garde la pause demandée et corrige un horodatage qui recule", () => {
    const r = recollerHorodatages([{ dureeSec: 2, mots: [{ mot: "a", debutSec: 0, finSec: 1.5 }, { mot: "b", debutSec: 1, finSec: 2 }] }, lecture(2, 1)], 0.5);
    expect(r.mots[1].debutSec).toBeGreaterThanOrEqual(r.mots[0].finSec);
    expect(r.debutsMorceauxSec[1]).toBe(2.5);
    expect(r.mots[2].debutSec).toBe(2.5);
  });

  it("refuse une durée ou une pause invalide", () => {
    expect(() => recollerHorodatages([{ dureeSec: -1, mots: [] }])).toThrow(RangeError);
    expect(() => recollerHorodatages([], -1)).toThrow(RangeError);
  });
});

describe("lecture par morceaux avec fournisseur injecté", () => {
  it("lit dans l'ordre, un à la fois, sans autre appel que le port", async () => {
    const appels: number[] = [];
    let enCours = 0;
    let maxEnCours = 0;
    const faux: FournisseurVoixLongue = {
      async lire(m) {
        enCours++;
        maxEnCours = Math.max(maxEnCours, enCours);
        appels.push(m.index);
        await Promise.resolve();
        const w = mots(m.texte);
        enCours--;
        return { dureeSec: w.length * 0.4, mots: w.map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4 })) };
      },
    };
    const c = [chapitre("a", 80), chapitre("b", 80, 80), chapitre("c", 80, 160)];
    const r = await lireVoixLongue(c, faux, { max: 2000 });
    expect(appels).toEqual(r.morceaux.map((m) => m.index));
    expect(maxEnCours).toBe(1);
    expect(r.mots.map((m) => m.mot)).toEqual(mots(c.map((x) => x.texte).join(" ")));
    for (let i = 1; i < r.mots.length; i++) expect(r.mots[i].debutSec).toBeGreaterThanOrEqual(r.mots[i - 1].finSec);
  });

  it("texte court : un seul appel au port", async () => {
    let n = 0;
    const faux: FournisseurVoixLongue = { async lire() { n++; return { dureeSec: 1, mots: [{ mot: "Bonjour.", debutSec: 0, finSec: 1 }] }; } };
    await lireVoixLongue([{ id: "a", texte: "Bonjour." }], faux);
    expect(n).toBe(1);
  });

  it("une erreur du port s'arrête là, sans lire les morceaux suivants", async () => {
    let n = 0;
    const faux: FournisseurVoixLongue = { async lire() { n++; throw new Error("refus"); } };
    await expect(lireVoixLongue([chapitre("a", 200)], faux, { max: 1000 })).rejects.toThrow("refus");
    expect(n).toBe(1);
  });

  it("l'estimation ne fait aucun appel et compte des quantités", () => {
    const e = mesurerVoixLongue([chapitre("a", 200)], 1000);
    expect(e.morceaux).toBeGreaterThan(1);
    expect(e.caracteres).toBeGreaterThan(5000);
  });
});
