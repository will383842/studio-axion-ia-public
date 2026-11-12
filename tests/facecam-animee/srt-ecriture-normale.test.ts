/**
 * Le fichier .srt de la face caméra animée garde l'écriture normale du script (décision du fondateur, 12/11/2026) :
 * les capitales ne servent qu'à comparer, la vidéo seule les affiche en capitales.
 */
import { describe, expect, it } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { exporterSrt } from "@/briques/sous-titres";
import { segmentsSrtV4 } from "@/moteurs/montage-facecam-animee/sous-titres-srt";

type Groupes = PlanFacecamAnimee["groupes"];
const mot = (w: string, a: number, fort?: boolean) => ({ w, a, ...(fort ? { fort: true } : {}) });
/** Plan d'essai (même fabrique que srt-identique.test.ts). */
const ESSAI: Groupes = [
  { mots: [mot("Vos", 0), mot("devis", 0.4), mot("partent,", 0.8)], fin: 1.4 },
  { mots: [mot("l", 1.5), mot("'IA", 1.7, true), mot("de", 2.2), mot("la", 2.5), mot("Certifexemple", 2.8)], fin: 3.4 },
  { mots: [mot("un", 3.5), mot("gain", 3.9), mot("garanti.", 4.2), mot("45", 5), mot("minutes", 5.4)], fin: 6 },
  { mots: [mot("et", 6.2), mot("c'est", 6.4), mot("fini.", 9.5)], fin: 10 },
];
const DUREE = 10.1;

describe("srt-ecriture-normale · exporterSrt(segmentsSrtV4(plan))", () => {
  const srt = exporterSrt(segmentsSrtV4(ESSAI, DUREE));
  const lignesTexte = srt.split(/\r?\n/).filter((l) => l.trim() !== "" && !/^\d+$/.test(l.trim()) && !l.includes("-->"));

  it("le texte garde l'écriture du script", () => {
    expect(srt).toContain("Vos devis");
    expect(srt).toContain("l'IA");
    expect(srt).not.toContain("VOS DEVIS");
  });

  it("aucune ligne de texte n'est entièrement en capitales (hors mots écrits ainsi dans le script)", () => {
    expect(lignesTexte.length).toBeGreaterThan(0);
    const motsCapitalesScript = new Set(ESSAI.flatMap((g) => g.mots.map((m) => m.w)).filter((w) => /[A-Z]{2,}/.test(w.replace(/^'/, ""))));
    for (const l of lignesTexte) {
      const sansMotsDuScript = l.split(/\s+/).filter((m) => ![...motsCapitalesScript].some((c) => m.includes(c.replace(/^'/, "")))).join(" ");
      if (/[A-Za-zÀ-ÿ]/.test(sansMotsDuScript)) expect(sansMotsDuScript).not.toBe(sansMotsDuScript.toUpperCase());
    }
  });
});
