/**
 * GV2-24 · face caméra animée : le rapport dit quand le texte n'a pas été retrouvé, quand des phrases manquent, quand la transcription
 * a des trous et quand des mots interdits à l'écran ont été retirés. Jamais un échec. Un ancien état (sans contrôle) : aucune alerte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { alertesSousTitresV4 } from "@/moteurs/montage-facecam-animee";
import { compterTrousV4, couperPriseV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";

const RACINE = join(__dirname, "..", "..");
const BRUT = (JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] }).mots;
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE = 130.732;
const messages = (mots: MotHorodate[], duree: number, texteValide?: string) => alertesSousTitresV4(couperPriseV4({ mots, dureeSec: duree, ...(texteValide ? { texteValide } : {}) }).controle).map((a) => a.message);

describe("GV2-24 · alertes du rapport", () => {
  it("prise de référence : seule l'alerte des mots interdits (« Certifexemple ») ; aucun trou, aucune phrase manquante", () => {
    const c = couperPriseV4({ mots: BRUT, dureeSec: DUREE, texteValide: SCRIPT }).controle;
    expect(c).toEqual({ texteNonRetrouve: false, phrasesManquantes: 0, ditesAutrement: 0, trous: 0, motsInterdits: 1 });
    expect(alertesSousTitresV4(c)).toEqual([{ code: "synchronisation", gravite: "attention", message: "1 mot(s) dit(s) non affiché(s) (liste des mots interdits à l'écran)." }]);
  });

  it("texte sans rapport avec la prise → « non retrouvé »", () => {
    expect(messages(BRUT, DUREE, "Les pommes de terre se plantent au printemps dans un sol meuble. Arrosez-les souvent pendant l'été.")).toContain("Votre texte n'a pas été retrouvé dans la vidéo : les sous-titres viennent de ce qui a été entendu.");
  });

  it("2 s gardées sans aucun mot → un trou, et l'alerte qui va avec", () => {
    const mots = [{ w: "Bonjour", a: 0.1, f: 0.5 }, { w: "à", a: 0.5, f: 0.6 }, { w: "tous", a: 2.6, f: 3 }];
    expect(compterTrousV4(mots, 3.2)).toBe(1);
    expect(compterTrousV4(mots, 5)).toBe(2); // fin gardée sans mot
    expect(alertesSousTitresV4({ texteNonRetrouve: false, phrasesManquantes: 0, ditesAutrement: 0, trous: 1, motsInterdits: 0 }).map((a) => a.message)).toEqual(["1 passage(s) parlé(s) sans sous-titre : vérifiez la transcription."]);
  });

  it("prise de référence, avec et sans texte : aucun trou", () => {
    expect(couperPriseV4({ mots: BRUT, dureeSec: DUREE }).controle.trous).toBe(0);
    expect(couperPriseV4({ mots: BRUT, dureeSec: DUREE, texteValide: SCRIPT }).controle.trous).toBe(0);
  });

  it("ancien état (sans contrôle) : aucune alerte", () => {
    expect(alertesSousTitresV4(undefined)).toEqual([]);
  });

  it("phrases manquantes et mots interdits : nombres seuls, jamais les mots", () => {
    const a = alertesSousTitresV4({ texteNonRetrouve: false, phrasesManquantes: 2, ditesAutrement: 1, trous: 0, motsInterdits: 3 });
    expect(a.map((x) => x.message)).toEqual(["2 phrase(s) de votre texte ne sont pas dans la vidéo.", "3 mot(s) dit(s) non affiché(s) (liste des mots interdits à l'écran)."]);
    expect(a.every((x) => x.gravite === "attention" && x.code === "synchronisation")).toBe(true);
  });
});
