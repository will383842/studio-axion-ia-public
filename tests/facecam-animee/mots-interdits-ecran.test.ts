/**
 * FACE CAMÉRA ANIMÉE — LISTE DE MOTS INTERDITS À L'ÉCRAN (décision de Will du 17/10) : « Certifexemple », certifié / certification, Villeexemple,
 * « gain garanti » n'apparaissent JAMAIS, ni dans une plaquette (refus V8a) ni dans les sous-titres (le groupe saute le mot), même dits.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifierPlan, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { indicesMotsInterditsEcran, motsInterditsDans, sansMotsInterditsEcran } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { groupesSousTitres } from "@/moteurs/montage-facecam-animee/realisateur/sous-titres";

const mot = (w: string, a: number): MotTranscrit => ({ w, a, f: a + 0.3 });

describe("mots interdits à l'écran · la liste", () => {
  it.each(["Certifexemple", "CERTIFEXEMPLE", "certifexemple", "à Certifexemple", "grâce à Certifexemple.", "Certifexemple,", "l'organisme Certifexemple", "certifié", "Certifiée", "CERTIFICATION", "certifiés", "Villeexemple", "VILLEEXEMPLE", "aucun gain garanti", "gains garantis"])(
    "« %s » est interdit", (t) => expect(motsInterditsDans(t).length).toBeGreaterThan(0));
  it.each(["certain", "certainement", "accompagnement", "grandes entreprises", "gagner du temps", "garantie"])("« %s » reste permis", (t) => expect(motsInterditsDans(t)).toEqual([]));
  it("expression de deux mots : « gain » puis « garanti » consécutifs", () => {
    expect([...indicesMotsInterditsEcran([mot("aucun", 0), mot("gain", 0.4), mot("garanti", 0.8), mot("ici", 1.2)])].sort()).toEqual([1, 2]);
  });
});

describe("mots interdits à l'écran · sous-titres (le groupe saute le mot)", () => {
  const phrase = [mot("des", 0), mot("aides", 0.3), mot("OPCO", 0.6), mot("grâce", 0.9), mot("à", 1.2), mot("Certifexemple", 1.4), mot("et", 1.9), mot("certifié", 2.2), mot("Villeexemple", 2.6), mot("voilà", 3.0)];
  it("aucun groupe ne porte un mot interdit ; les autres mots gardent leurs instants et le groupe garde une forme normale", () => {
    const g = groupesSousTitres(phrase);
    const affiches = g.flatMap((x) => x.mots.map((m) => m.w));
    expect(affiches.join(" ")).not.toMatch(/certifexemple|certifi|villeexemple/i);
    for (const attendu of ["aides", "OPCO", "grâce", "à", "et", "voilà"]) expect(affiches).toContain(attendu);
    expect(g.find((x) => x.mots.some((m) => m.w === "voilà"))?.mots.find((m) => m.w === "voilà")?.a).toBe(3.0);
    for (const x of g) { expect(x.mots.length).toBeGreaterThan(0); expect(x.fin).toBeGreaterThan(x.mots[0].a); }
  });
  it("sansMotsInterditsEcran retire aussi l'expression « gain garanti »", () => {
    expect(sansMotsInterditsEcran([mot("aucun", 0), mot("gain", 0.3), mot("garanti", 0.6), mot("promis", 0.9)]).map((m) => m.w)).toEqual(["aucun", "promis"]);
  });
});

describe("mots interdits à l'écran · verifierPlan", () => {
  const donnees = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/transcription.json", "utf8")) as { motsMontesTexteValide: MotTranscrit[] };
  const plan = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/plan-realisateur.json", "utf8"));
  const mots = donnees.motsMontesTexteValide;
  it("le plan de la répétition : zéro mot interdit dans les plaquettes comme dans les sous-titres", () => {
    expect(verifierPlan(plan, mots).erreurs.filter((e) => /^V8/.test(e))).toEqual([]);
    expect(JSON.stringify(plan.groupes)).not.toMatch(/certifexemple|certifi|villeexemple/i);
  });
  it("un mot interdit dans le texte d'une plaquette = refus bloquant (V8a)", () => {
    const faux = structuredClone(plan);
    faux.elementsV4[0].mots = ["À CERTIFEXEMPLE"];
    const v = verifierPlan(faux, mots);
    expect(v.erreurs.some((e: string) => /^V8a — /.test(e))).toBe(true);
    expect(v.rendable).toBe(false);
  });
  it("un mot interdit dans un groupe de sous-titres du plan = refus bloquant (V8b)", () => {
    const faux = structuredClone(plan);
    faux.groupes[3].mots[0].w = "Certifexemple";
    const v = verifierPlan(faux, mots);
    expect(v.erreurs.some((e: string) => /^V8b — /.test(e))).toBe(true);
    expect(v.rendable).toBe(false);
  });
});

describe("mots interdits à l'écran · rendu (copie dans VideoAnimeeV4)", () => {
  it("la copie du conteneur de rendu retient exactement les mêmes mots que la liste du réalisateur", async () => {
    const { motsInterditsEcran } = await import("../../studio-rendu/compositions/interface-claire/VideoAnimeeV4");
    const mots = ["des", "grâce", "à", "Certifexemple", "certifié", "certification", "Villeexemple", "aucun", "gain", "garanti", "certain", "gagner", "temps"];
    expect([...motsInterditsEcran(mots)].sort((a, b) => a - b)).toEqual([...indicesMotsInterditsEcran(mots.map((w) => ({ w })))].sort((a, b) => a - b));
  });
});
