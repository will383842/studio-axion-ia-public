/**
 * LOT G3 — 0 faux positif sur l'avocat de référence (critère n° 83, addendum point 11 ; `CALIBRAGE-ANTI-TEXTE-IA.md`).
 * Les 18 transcriptions du lot GR (texte dit, transcription automatique) passent dans les contrôles de STYLE comme si
 * la machine les avait écrites : aucune tournure bloquante, aucune grappe, aucun tic, aucune injonction rejetée
 * (« Il ne faut jamais… » est permis), aucune boucle ouverte annoncée. Puis, lues comme des textes de Will (témoins),
 * elles atteignent la note de 85.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyser, compterTournures, controlerVersion, controlesDeStyle, formesAdresse, noterVersion, type EntreeControle } from "@/domaine/controles-script";
import { bloc, MAINTENANT, PARAMS, RECETTE, seg, TOURNURES } from "./helpers/g3";

interface Transcription {
  code: string;
  segments: { debut: number; fin: number; texte: string }[];
}
const { videos } = JSON.parse(readFileSync("tests/fixtures/g3-avocatref-transcriptions.json", "utf8")) as { videos: Transcription[] };

function versionDe(t: Transcription, auteur: "machine" | "will"): EntreeControle {
  const texte = t.segments.map((s) => s.texte).join(" ");
  const f = formesAdresse(texte);
  const [premier, ...reste] = t.segments;
  return {
    auteur,
    mode: "teleprompteur",
    adresse: f.vous || !f.tu ? "vous" : "tu",
    debit: 4.5,
    ouverture: [bloc("accroche", seg(`${t.code}-0`, premier.texte))],
    corps: [bloc("coeur", ...reste.map((s, i) => seg(`${t.code}-${i + 1}`, s.texte, { changementVisuel: true })))],
    fin: [],
    recette: RECETTE,
    reseau: PARAMS.reseau("tiktok"),
    preuves: [],
    matieres: [],
    tournures: TOURNURES,
    maintenant: MAINTENANT,
  };
}

describe("18 transcriptions de l'avocat de référence (lot GR)", () => {
  it("le corpus est complet", () => {
    expect(videos.map((v) => v.code)).toEqual(Array.from({ length: 3 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`));
  });

  it.each(videos.map((v) => [v.code, v] as const))("%s : aucune tournure bloquante, au plus une grappe", (_c, v) => {
    const r = compterTournures(v.segments.map((s, i) => ({ texte: s.texte, segmentIndex: i })), TOURNURES);
    expect(r.bloquantes).toEqual([]);
    expect(r.grappes.length).toBeLessThan(2);
  });

  it.each(videos.map((v) => [v.code, v] as const))("%s : 0 alerte des contrôles de style (C3 bis, C5, C5 bis, C5 ter, C37, C40, C42)", (_c, v) => {
    const e = versionDe(v, "machine");
    expect(controlesDeStyle(e, analyser(e))).toEqual([]);
  });

  it.each(videos.map((v) => [v.code, v] as const))("%s : lu comme un texte de Will, aucun blocage et note ≥ 85 (témoin)", (_c, v) => {
    const r = controlerVersion(versionDe(v, "will"));
    expect(r.violations.filter((x) => x.bloquant)).toEqual([]);
    expect(noterVersion(r.violations).globale).toBeGreaterThanOrEqual(85);
  });

  it("le calibrage tient : « Car » et la question-réponse de D16 ne déclenchent rien seuls", () => {
    const d03 = videos.find((v) => v.code === "D03")!;
    const r = compterTournures([{ texte: d03.segments.map((s) => s.texte).join(" ") }], TOURNURES);
    expect(r.grappes.length).toBeLessThan(2);
  });
});
