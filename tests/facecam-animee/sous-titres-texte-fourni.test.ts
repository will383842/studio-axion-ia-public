/**
 * GV2-24 · face caméra animée, texte fourni : tout mot entendu et gardé a son sous-titre (phrase improvisée, phrase dite autrement,
 * mot ajouté), un mot du texte non dit n'est pas affiché, et la prise de référence (lot-i) ne bouge pas d'un caractère.
 * Les cas sont fabriqués à partir de la vraie prise de référence (mots insérés ou retirés, la suite décalée). AUCUN appel réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { couperPriseV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";

const RACINE = join(__dirname, "..", "..");
const BRUT = (JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] }).mots;
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const TRANS = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/transcription.json"), "utf8")) as { motsMontesTexteValide: { w: string; a: number; f: number }[] };
const DUREE = 130.732;
const r = (x: number) => +x.toFixed(3);

/** Insère des mots dits à `t0` (pas de `pas` s chacun) et décale toute la suite. */
function inserer(mots: MotHorodate[], t0: number, ajout: string[], pas: number, marge = 0): MotHorodate[] {
  const decal = ajout.length * pas + marge;
  const avant = mots.filter((m) => m.debutSec < t0);
  const apres = mots.filter((m) => m.debutSec >= t0).map((m) => ({ ...m, debutSec: r(m.debutSec + decal), finSec: r(m.finSec + decal) }));
  return [...avant, ...ajout.map((mot, k) => ({ mot, debutSec: r(t0 + k * pas), finSec: r(t0 + (k + 1) * pas) })), ...apres];
}
/** Retire les mots dits entre `de` et `a` ; `fermer` : la suite est avancée (aucun blanc laissé). */
function retirer(mots: MotHorodate[], de: number, a: number, fermer: boolean): MotHorodate[] {
  const decal = fermer ? a - de : 0;
  return mots.filter((m) => m.debutSec < de - 1e-6 || m.debutSec >= a - 1e-6).map((m) => (m.debutSec >= a - 1e-6 ? { ...m, debutSec: r(m.debutSec - decal), finSec: r(m.finSec - decal) } : m));
}
const texte = (mots: MotHorodate[], duree: number) => couperPriseV4({ mots, dureeSec: duree, texteValide: SCRIPT }).mots.map((m) => m.w).join(" ");

describe("GV2-24 · sous-titres avec un texte fourni", () => {
  it("cas A : la prise de référence est rendue mot pour mot comme la répétition validée", () => {
    expect(couperPriseV4({ mots: BRUT, dureeSec: DUREE, texteValide: SCRIPT }).mots).toEqual(TRANS.motsMontesTexteValide);
  });

  it("cas B : une phrase improvisée entre deux phrases du texte est sous-titrée", () => {
    const mots = inserer(BRUT, 67.4, "et franchement ça change tout pour vous".split(" "), 0.28, 0.4);
    expect(texte(mots, DUREE + 2.36)).toContain("commencer par là. et franchement ça change tout pour vous Le diagnostic fuite.");
  });

  it("cas C : une phrase dite autrement est sous-titrée avec les mots dits, sans doublon de la phrase suivante", () => {
    const mots = inserer(retirer(BRUT, 96.31, 97.4, true), 96.31, "Et là vous allez piger un truc.".split(" "), 0.22, 0.05);
    const t = texte(mots, DUREE + 0.5);
    expect(t).toContain("classées. Et là vous allez piger un truc. L 'IA ne rapporte");
    expect(t).not.toContain("comprendrez");
  });

  it("cas D : un mot ajouté dans une phrase du texte est affiché", () => {
    expect(texte(inserer(BRUT, 66.76, ["facilement"], 0.4), DUREE + 0.4)).toContain("on vous propose de commencer facilement par là.");
  });

  it("deux mots du texte non prononcés ne sont pas affichés (blanc laissé ou refermé)", () => {
    expect(texte(retirer(BRUT, 65.98, 66.48, false), DUREE)).toContain("Alors, on vous commencer par là.");
    expect(texte(retirer(BRUT, 65.98, 66.48, true), DUREE - 0.5)).toContain("Alors, on vous commencer par là.");
  });

  it("un nom de marque improvisé passe par le lexique (« Action IA » → « Axion-IA »), avec et sans texte", () => {
    const mots = inserer(BRUT, 67.4, "merci Action IA".split(" "), 0.28, 0.4);
    expect(texte(mots, DUREE + 1.24)).toContain("par là. merci Axion-IA Le diagnostic");
    expect(couperPriseV4({ mots, dureeSec: DUREE + 1.24 }).mots.map((m) => m.w).join(" ")).toContain("merci Axion-IA Le");
  });
});
