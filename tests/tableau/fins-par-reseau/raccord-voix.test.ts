/**
 * RACCORD DE LA VOIX (fins propres à chaque sortie, 12/10/2026) : le corps lu une fois, la phrase de fin lue à part, puis
 * raccordée AVANT le traitement final commun. Fonction pure (`planRaccordVoix`) : morceaux, durées, horodatages, aucun
 * mot perdu ; graphe FFmpeg à deux entrées (`argumentsRecette`) ; et, FFmpeg étant installé ici, un vrai raccord de
 * deux sons synthétiques (aucun appel payant).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "../../../src/domaine/types";
import { BLANC_RACCORD_SEC, parametresRaccord, parametresRecette, planRaccordVoix, planRecetteVoix, RECETTE_VOIX_TABLEAU } from "../../../src/moteurs/montage-tableau/recette-voix";
import { argumentsRecette } from "../../../studio-rendu/src/operations/nettoyage-audio";

/** Mots réguliers : `n` mots de 0,3 s séparés de `blanc`, à partir de `debut` ; le dernier finit une phrase. */
function motsReguliers(textes: string[], debut: number, blanc = 0.25): MotHorodate[] {
  return textes.map((mot, i) => ({ mot, debutSec: +(debut + i * (0.3 + blanc)).toFixed(3), finSec: +(debut + i * (0.3 + blanc) + 0.3).toFixed(3) }));
}

const corps = { mots: motsReguliers(["Le", "détail", "tient", "sur", "une", "page."], 0.4), dureeSec: 4.2 };
const fin = { mots: motsReguliers(["Écrivez", "CINQ", "en", "commentaire.", "Je", "vous", "l'envoie."], 0.05), dureeSec: 4.6 };

describe("planRaccordVoix (pur)", () => {
  const plan = planRaccordVoix(corps, fin);
  const k = RECETTE_VOIX_TABLEAU.filtres.atempo;

  it("aucun mot perdu, dans l'ordre : ceux du corps puis ceux de la fin", () => {
    expect(plan.mots.map((m) => m.mot)).toEqual([...corps.mots, ...fin.mots].map((m) => m.mot));
    expect(plan.motsCorps).toBe(corps.mots.length);
    for (let i = 1; i < plan.mots.length; i++) expect(plan.mots[i].debutSec).toBeGreaterThanOrEqual(plan.mots[i - 1].finSec);
    for (const m of plan.mots) expect(m.finSec).toBeGreaterThan(m.debutSec);
  });

  it("les mots du corps gardent exactement les heures de la voix du corps seul", () => {
    const seul = planRecetteVoix(corps.mots, corps.dureeSec);
    expect(plan.mots.slice(0, corps.mots.length)).toEqual(seul.mots);
  });

  it("blanc de 0,20 s au raccord (son final : ÷ atempo), comblé de silence quand la fin commence trop tôt", () => {
    const dernierCorps = plan.mots[plan.motsCorps - 1];
    const premierFin = plan.mots[plan.motsCorps];
    expect(premierFin.debutSec - dernierCorps.finSec).toBeCloseTo(BLANC_RACCORD_SEC / k, 3);
    // La fin commence à 0,05 s : le silence complète la demi-pause d'avant son premier mot (0,15 s en voix-tableau/3, 0,10 s avant).
    const silences = plan.morceaux.filter((m) => m.silence);
    expect(silences).toHaveLength(1);
    expect(silences[0].finSec - silences[0].debutSec).toBeCloseTo(BLANC_RACCORD_SEC / 2 - 0.05, 3);
    expect(plan.morceaux.filter((m) => m.source === 1 && !m.silence).length).toBeGreaterThan(0);
  });

  it("queue naturelle de la fin gardée (+0,45 s), puis le silence final ; durée = parole ÷ atempo + silence", () => {
    const derniers = plan.morceaux.filter((m) => m.source === 1 && !m.silence).at(-1)!;
    expect(derniers.finSec).toBeCloseTo(Math.min(fin.dureeSec, fin.mots.at(-1)!.finSec + RECETTE_VOIX_TABLEAU.resserrage.queueSec), 3);
    const parole = plan.morceaux.reduce((s, m) => s + (m.finSec - m.debutSec), 0);
    expect(plan.dureeSec).toBeCloseTo(parole / k + RECETTE_VOIX_TABLEAU.fin.silenceSec, 3);
    expect(plan.debutFonduSortieSec).toBeCloseTo(parole / k - RECETTE_VOIX_TABLEAU.fin.fonduSortieSec, 3);
  });

  it("sans phrase de fin : la recette du corps seul, à l'identique (paramètres compris)", () => {
    const seul = planRaccordVoix(corps);
    const recette = planRecetteVoix(corps.mots, corps.dureeSec);
    expect(seul.mots).toEqual(recette.mots);
    expect(seul.dureeSec).toBe(recette.dureeSec);
    expect(parametresRaccord(seul)).toEqual(parametresRecette(recette));
  });
});

describe("graphe FFmpeg du raccord (studio-rendu)", () => {
  const plan = planRaccordVoix(corps, fin);
  const p = parametresRaccord(plan);

  it("deux entrées, tout remis à 48 kHz mono, silence généré, un seul traitement final", () => {
    const args = argumentsRecette("/tmp/corps", "/tmp/sortie.wav", p, "/tmp/fin");
    expect(args.filter((a) => a === "-i")).toHaveLength(2);
    const graphe = args[args.indexOf("-filter_complex") + 1];
    expect(graphe).toContain("[1:a]atrim");
    expect(graphe).toContain("anullsrc=r=48000:cl=mono");
    expect(graphe.match(/loudnorm/g)).toHaveLength(1);
    expect(graphe).toContain(`concat=n=${plan.morceaux.length}`);
  });

  it("sans seconde entrée, un morceau de la fin est refusé ; une voix seule garde le graphe d'avant", () => {
    expect(() => argumentsRecette("/tmp/corps", "/tmp/s.wav", p)).toThrow(/audio2/);
    const avant = parametresRecette(planRecetteVoix(corps.mots, corps.dureeSec));
    expect(argumentsRecette("/tmp/c", "/tmp/s.wav", avant)).toEqual(argumentsRecette("/tmp/c", "/tmp/s.wav", parametresRaccord(planRaccordVoix(corps))));
    expect(argumentsRecette("/tmp/c", "/tmp/s.wav", avant).join(" ")).not.toContain("aformat");
  });

  const ffmpeg = (() => {
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(ffmpeg)("vrai raccord par FFmpeg (deux sons synthétiques, 44,1 et 24 kHz) : durée attendue, même niveau final", () => {
    const dossier = mkdtempSync(join(tmpdir(), "raccord-"));
    const c = join(dossier, "corps.wav");
    const f = join(dossier, "fin.wav");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=220:sample_rate=44100:duration=${corps.dureeSec}`, "-af", "volume=0.3", c]);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=330:sample_rate=24000:duration=${fin.dureeSec}`, "-af", "volume=0.05", f]);
    const sortie = join(dossier, "sortie.wav");
    execFileSync("ffmpeg", argumentsRecette(c, sortie, p, f));
    const duree = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sortie]).toString().trim());
    expect(duree).toBeCloseTo(plan.dureeSec, 1);
    const info = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels", "-of", "csv=p=0", sortie]).toString().trim();
    expect(info).toBe("48000,1");
  });
});
