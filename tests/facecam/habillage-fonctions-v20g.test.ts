import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { marquerMotsDuScript, phrasesDesMots, planUnique } from "@/moteurs/montage-facecam/habillage";

const mot = (m: string, debutSec: number, finSec: number): MotHorodate => ({ mot: m, debutSec, finSec });
const seg = (...mots: string[]): { mots: { mot: string; enValeur?: boolean }[] } => ({ mots: mots.map((m) => ({ mot: m })) });

describe("phrasesDesMots", () => {
  it("liste vide : aucune phrase", () => {
    expect(phrasesDesMots([])).toEqual([]);
  });
  it("coupe sur la ponctuation forte (. ! ? …) et garde les bornes de temps exactes", () => {
    const mots = [mot("Bonjour", 0, 0.4), mot("à", 0.5, 0.6), mot("tous.", 0.6, 1), mot("Voici", 1.1, 1.4), mot("Axion", 1.4, 1.9), mot("!", 1.9, 2)];
    expect(phrasesDesMots(mots)).toEqual([
      { texte: "Bonjour à tous.", debutSec: 0, finSec: 1 },
      { texte: "Voici Axion !", debutSec: 1.1, finSec: 2 },
    ]);
  });
  it("coupe sur un blanc de plus de 0,6 s, pas sur un blanc plus court ; la virgule ne coupe pas", () => {
    // Écarts exacts en binaire (0,5 et 0,75) : pas d'erreur d'arrondi flottant sur le seuil.
    const mots = [mot("un,", 0, 1), mot("deux", 1.5, 2), mot("trois", 2.75, 3), mot("quatre", 3.25, 4)];
    expect(phrasesDesMots(mots).map((p) => p.texte)).toEqual(["un, deux", "trois quatre"]);
    expect(phrasesDesMots([mot("a", 0, 1), mot("b", 1.5, 2)])).toEqual([{ texte: "a b", debutSec: 0, finSec: 2 }]);
  });
  it("un seul mot, sans point final : une phrase ; le tableau d'entrée n'est pas modifié", () => {
    const mots = [mot("Salut", 3, 3.5)];
    const avant = JSON.stringify(mots);
    expect(phrasesDesMots(mots)).toEqual([{ texte: "Salut", debutSec: 3, finSec: 3.5 }]);
    expect(JSON.stringify(mots)).toBe(avant);
  });
});

describe("planUnique", () => {
  it("un seul plan plein cadre de 0 à la durée, sur l'angle face, coupe sèche", () => {
    const p = planUnique(42.5);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ ordre: 1, debutSec: 0, finSec: 42.5, texte: "", segmentId: "facecam", sourceImage: "double", motsEnValeur: [], transition: "coupe", angle: "face" });
    expect(p[0].cadrage).toEqual({ pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" });
  });
  it("durée 0 : le plan existe quand même, de 0 à 0 ; deux appels rendent des objets distincts", () => {
    const a = planUnique(0);
    expect(a).toHaveLength(1);
    expect([a[0].debutSec, a[0].finSec]).toEqual([0, 0]);
    expect(planUnique(1)[0]).not.toBe(planUnique(1)[0]);
  });
});

describe("marquerMotsDuScript", () => {
  it("emphase du script qui marque des mots : source « script », seuls ces mots passent en valeur ; entrée intacte", () => {
    const segments = [seg("Le", "loyer", "augmente"), seg("tout", "va", "bien"), seg("merci")];
    const avant = JSON.stringify(segments);
    const r = marquerMotsDuScript(segments, ["Loyer"]);
    expect(r.source).toBe("script");
    expect(r.segments.map((s) => s.mots.filter((m) => m.enValeur).map((m) => m.mot))).toEqual([["loyer"], [], []]);
    expect(JSON.stringify(segments)).toBe(avant);
  });
  it("emphase dont aucun mot n'est dit : repli sur les mots forts de la transcription", () => {
    const segments = [seg("Le", "devis", "arrive"), seg("bonjour", "tout", "le", "monde")];
    const r = marquerMotsDuScript(segments, ["inexistant"]);
    expect(r.source).toBe("transcription");
    expect(r.segments[0].mots.map((m) => !!m.enValeur)).toEqual([false, true, false]);
    expect(r.segments[1].mots.some((m) => m.enValeur)).toBe(false);
  });
  it("sans emphase ni mot fort : source « transcription » et aucun mot marqué ; liste vide : rien", () => {
    const r = marquerMotsDuScript([seg("la", "vie", "est", "belle")]);
    expect(r.source).toBe("transcription");
    expect(r.segments[0].mots.some((m) => m.enValeur)).toBe(false);
    // Aucun groupe : rien à marquer, l'emphase n'a rien marqué, donc repli sur la transcription.
    expect(marquerMotsDuScript([], ["x"])).toEqual({ segments: [], source: "transcription" });
  });
  it("emphase vide ou à blancs : traitée comme absente ; un chiffre dit est un mot fort", () => {
    const r = marquerMotsDuScript([seg("il", "y", "a", "67", "cas")], ["", "  "]);
    expect(r.source).toBe("transcription");
    expect(r.segments[0].mots.map((m) => !!m.enValeur)).toEqual([false, false, false, true, false]);
  });
});
