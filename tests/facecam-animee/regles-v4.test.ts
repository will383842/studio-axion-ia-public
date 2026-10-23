/**
 * FACE CAMÉRA ANIMÉE — RÈGLES « v4 » (17/10) : une règle = au moins un test. Les décisions fixes de Will (V1 à V7), le rythme (H1, H2),
 * le catalogue (D0), la littéralité (D15), puis le branchement au réalisateur (plan v4 complet lu par `verifierPlan`, `realiser`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { realiser, verifierPlan, type EntreeRealisateur, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { CATALOGUE_V4, ficheV4, type FicheCatalogueV4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import {
  controlerSuiteV4, densiteV4, erreursSousTitresV4, estRendableV4, evenementsDuPlanV4, priseSeuleV4, resoudreElementsV4, SEUILS_V4, type ElementResoluV4,
} from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

const fiche = (id: string) => CATALOGUE_V4.find((f) => f.id === id)!;
/** Élément résolu, de `debut` à `debut + durée minimale de la fiche` (ou `duree`). */
function el(id: string, debut: number, duree?: number, extra: Partial<ElementResoluV4> = {}, f?: Readonly<FicheCatalogueV4>): ElementResoluV4 {
  const fi = f ?? fiche(id);
  return { fiche: fi, debut, fin: debut + (duree ?? fi.dureeSec[0]), mots: [], lignes: [], instants: [], recherches: [], illustre: "x", rang: 1, ...extra };
}
const ctx = (duree = 60) => ({ duree, finDebut: duree });
const codes = (erreurs: string[]) => erreurs.map((e) => e.split(" — ")[0]);
/** Suite valide : alternance d'emplacements, bout à bout. */
function suite(ids: string[], debut = 0): ElementResoluV4[] {
  let t = debut;
  return ids.map((id) => { const e = el(id, t); t = e.fin; return e; });
}

describe("règles v4 · décisions fixes de Will", () => {
  it("V1 : tolérance de 3 images de visage partiel ACCEPTÉE, 4 REFUSÉE", () => {
    const tel = fiche("FenetreTelephone");
    const trois = el("FenetreTelephone", 6, 2, {}, { ...tel, imagesVisagePartiel: 3 });
    const quatre = el("FenetreTelephone", 6, 2, {}, { ...tel, imagesVisagePartiel: 4 });
    expect(codes(controlerSuiteV4([trois], ctx()).erreurs)).not.toContain("V1b");
    expect(codes(controlerSuiteV4([quatre], ctx()).erreurs)).toContain("V1b");
    expect(SEUILS_V4.imagesVisagePartielMax).toBe(3);
  });
  it("V1 : une plaquette qui laisse le visage entier ne le touche jamais ; une emprise qui le cache à moitié est refusée", () => {
    const e = el("EtiquetteTete", 0, 1.2, {}, { ...fiche("EtiquetteTete"), imagesVisagePartiel: 1 });
    expect(codes(controlerSuiteV4([e], ctx()).erreurs)).toContain("V1c");
    const demi = el("EtiquetteTete", 0, 1.2, {}, { ...fiche("EtiquetteTete"), gabarit: "M4", descente: 0.3 });
    expect(codes(controlerSuiteV4([demi], ctx()).erreurs)).toContain("V1a");
  });
  it("V2 : aucun zoom ni mouvement de cadrage sur la prise", () => {
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0)], { ...ctx(), prisBougee: true }).erreurs)).toContain("V2");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0)], ctx()).erreurs)).not.toContain("V2");
  });
  it("V3 : rien sur le visage avant 5 s, aucun plein cadre avant 8 s, une plaquette dès 0-1 s ; objets au-dessus de la tête permis dès 0", () => {
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.2), el("FenetreTelephone", 1.2, 2.5)], ctx()).erreurs)).toContain("V3a");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.2), el("FenetreTelephone", 5.0, 2.5)], ctx()).erreurs)).not.toContain("V3a");
    expect(codes(controlerSuiteV4([el("CarteCalendrier", 0, 2.5), el("dalle-claquee", 2.5)], ctx()).erreurs)).toContain("V3b");
    expect(codes(controlerSuiteV4([el("CarteCalendrier", 0, 2.5), el("EtiquetteTete", 2.5, 1.2), el("dalle-claquee", 8.0)], ctx()).erreurs)).not.toContain("V3b");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.2)], ctx()).erreurs)).not.toContain("V3c");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 1.5, 1.2)], ctx()).erreurs)).toContain("V3c");
    // 18/10 (Will) : V3c resserré à 0,75 s pour ne plus contredire H1b (calme 0,75 s) : 0,75 passe, 0,9 est refusé par V3c.
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0.75, 1.2)], ctx()).erreurs)).not.toContain("V3c");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0.9, 1.2)], ctx()).erreurs)).toContain("V3c");
    expect(SEUILS_V4.premierElementAvantSec).toBe(SEUILS_V4.calmeMaxSec);
  });
  it("V4 : aucune musique, que des bruitages de sons/", () => {
    const musique = el("EtiquetteTete", 0, 1.2, {}, { ...fiche("EtiquetteTete"), sons: ["musique-fond"] });
    expect(codes(controlerSuiteV4([musique], ctx()).erreurs)).toContain("V4a");
    const inconnu = el("EtiquetteTete", 0, 1.2, {}, { ...fiche("EtiquetteTete"), sons: ["boom-inconnu"] });
    expect(codes(controlerSuiteV4([inconnu], ctx()).erreurs)).toContain("V4b");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0)], ctx()).erreurs)).not.toContain("V4a");
  });
  it("V5 : sous-titres jamais sur les yeux, pour toutes les plaquettes ; une fiche fautive est refusée", () => {
    for (const f of CATALOGUE_V4) expect(erreursSousTitresV4(f), f.id).toEqual([]);
    expect(erreursSousTitresV4({ id: "x", sousTitres: 0.3, descente: 0 }).join()).toMatch(/^V5a/);
    expect(erreursSousTitresV4({ id: "x", sousTitres: 0.99, descente: 0 }).join()).toMatch(/^V5b/);
  });
  it("V6 : jamais deux fois de suite la même plaquette ni le même emplacement", () => {
    expect(codes(controlerSuiteV4(suite(["EtiquetteTete", "EtiquetteTete"]), ctx()).erreurs)).toContain("V6a");
    expect(codes(controlerSuiteV4(suite(["EtiquetteTete", "Interjection"]), ctx()).erreurs)).toContain("V6b");
    expect(codes(controlerSuiteV4(suite(["CarteCalendrier", "CarteChecklist"]), ctx()).erreurs)).toContain("V6b");
    const bien = codes(controlerSuiteV4(suite(["EtiquetteTete", "CarteCalendrier", "Interjection"]), ctx()).erreurs);
    expect(bien).not.toContain("V6a");
    expect(bien).not.toContain("V6b");
  });
  it("V7 : coups de poing — 8 s au moins entre deux, 4 au plus par 60 s, le dernier 6 s avant la fin", () => {
    const c = (t: number) => el("dalle-claquee", t);
    const t = (x: number) => el("EtiquetteTete", x, 1.2);
    expect(codes(controlerSuiteV4([c(10), t(11), c(13)], ctx()).erreurs)).toContain("V7a");
    const cinq = [10, 20, 30, 40, 50].flatMap((x, k) => [c(x), el(k % 2 ? "CarteCalendrier" : "EtiquetteTete", x + 0.9, 2.5)]);
    expect(codes(controlerSuiteV4(cinq, ctx(90)).erreurs)).toContain("V7b");
    expect(codes(controlerSuiteV4([c(57)], ctx(60)).erreurs)).toContain("V7d");
    expect(codes(controlerSuiteV4([c(30)], ctx(60)).erreurs)).not.toContain("V7d");
  });
  it("D0 : une plaquette en coulisse, inconnue, hors durée ou superposée est refusée", () => {
    expect(resoudreElementsV4([{ id: "LogoOutil", debut: 0, fin: 1.5 }], 10).erreurs.join()).toMatch(/EN COULISSE/);
    expect(resoudreElementsV4([{ id: "Inconnue", debut: 0, fin: 1.5 }], 10).erreurs.join()).toMatch(/n'existe pas/);
    expect(resoudreElementsV4([{ id: "EtiquetteTete", debut: 0, fin: 5 }], 10).erreurs.join()).toMatch(/la fiche prévoit/);
    expect(resoudreElementsV4([{ id: "EtiquetteTete", debut: 0, fin: 1.5 }, { id: "CarteCalendrier", debut: 1, fin: 3.6 }], 10).erreurs.join()).toMatch(/en même temps/);
    expect(resoudreElementsV4([{ id: "EtiquetteTete", debut: 0, fin: 1.5 }], 10).erreurs).toEqual([]);
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0)], { ...ctx(), anciens: 2 }).erreurs)).toContain("D0b");
  });
});

describe("règles v4 · rythme", () => {
  it("H1 : densité d'au moins 2,2 événements par seconde sur toute fenêtre de 5 s ; un trou la fait échouer", () => {
    const dense = suite(["EtiquetteTete", "CarteCalendrier", "Interjection", "CarteChecklist", "MotSaute", "PileNotifications", "element-barre", "CarteStatuts"]);
    const horizon = dense[dense.length - 1].fin;
    const d = densiteV4(evenementsDuPlanV4(dense), horizon);
    expect(d.min).toBeGreaterThanOrEqual(SEUILS_V4.densiteMin);
    expect(codes(controlerSuiteV4(dense, ctx(horizon)).erreurs)).not.toContain("H1a");
    expect(densiteV4([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 12).min).toBeLessThan(2.2);
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.2), el("EtiquetteTete", 20, 1.2)], ctx(25)).erreurs)).toContain("H1a");
  });
  it("H2 : prise seule de 0,5 s acceptée, de 0,6 s refusée", () => {
    const a = el("EtiquetteTete", 0, 1.2);
    expect(priseSeuleV4([a, el("CarteCalendrier", 1.7, 2.5)], 4.2)).toEqual([[1.2, 1.7]]);
    expect(codes(controlerSuiteV4([a, el("CarteCalendrier", 1.7, 2.5)], ctx(4.2)).erreurs)).not.toContain("H2a");
    expect(codes(controlerSuiteV4([a, el("CarteCalendrier", 1.8, 2.5)], ctx(4.3)).erreurs)).toContain("H2a");
  });
  it("H2b : la prise seule ne dépasse pas 3 % du temps", () => {
    const e = [el("EtiquetteTete", 0, 1.2), el("CarteCalendrier", 1.6, 2.5), el("EtiquetteTete", 4.5, 1.2)];
    expect(codes(controlerSuiteV4(e, ctx(5.7)).erreurs)).toContain("H2b");
  });
  it("H9 : jamais plus de 5,5 s dans le même gabarit ; H10 : 8 plaquettes différentes par tranche de 30 s ; D14 : 3 fois au plus", () => {
    const long = el("CarteChecklist", 0, 5.0, {}, { ...fiche("CarteChecklist"), dureeSec: [2.5, 6] });
    expect(codes(controlerSuiteV4([{ ...long, fin: 6 }], ctx(6)).erreurs)).toContain("H9a");
    const peu = suite(["EtiquetteTete", "CarteCalendrier", "EtiquetteTete", "CarteCalendrier", "EtiquetteTete", "CarteCalendrier", "EtiquetteTete", "CarteCalendrier", "EtiquetteTete", "CarteCalendrier", "EtiquetteTete", "CarteCalendrier"]);
    expect(codes(controlerSuiteV4(peu, ctx(Math.max(30, peu[peu.length - 1].fin))).erreurs)).toEqual(expect.arrayContaining(["H10a", "D14"]));
  });
});

describe("règles v4 · littéralité (D15) et calage sur la voix", () => {
  const voix: MotTranscrit[] = [{ w: "devis", a: 1.0, f: 1.3 }, { w: "relances", a: 1.4, f: 1.9 }, { w: "45", a: 2.0, f: 2.3 }, { w: "minutes", a: 2.3, f: 2.7 }];
  it("D15 : un mot ou un chiffre non dit, « Villeexemple », « Certifexemple », un nombre absent, un illustre manquant sont refusés ; un mot dit passe", () => {
    const base = { illustre: "les devis" };
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { ...base, mots: ["DEVIS RELANCES"] })], ctx(), voix).erreurs)).not.toContain("D15e");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { ...base, mots: ["DEVIS FACTURES"] })], ctx(), voix).erreurs)).toContain("D15e");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { ...base, mots: ["VILLEEXEMPLE"] })], ctx(), voix).erreurs)).toContain("V8a");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { ...base, mots: ["CERTIFEXEMPLE"] })], ctx(), voix).erreurs)).toContain("V8a");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { ...base, mots: ["AUCUN GAIN GARANTI"] })], ctx(), voix).erreurs)).toContain("V8a");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { illustre: undefined, mots: ["LES DEVIS"] })], ctx(), voix).erreurs)).toContain("D15g");
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.5, { ...base, mots: ["DEVIS", "A", "B"] })], ctx(), voix).erreurs)).toContain("D15a");
  });
  it("D15 : un nombre affiché doit être dit (BadgeCompteur 45 accepté, 99 refusé, nombre absent refusé)", () => {
    const m = (nombre?: number) => el("BadgeCompteur", 0, 2.4, { mots: ["MINUTES"], nombre, illustre: "45 minutes" });
    expect(codes(controlerSuiteV4([m(45)], ctx(), voix).erreurs)).not.toContain("D15d");
    expect(codes(controlerSuiteV4([m(99)], ctx(), voix).erreurs)).toContain("D15d");
    expect(codes(controlerSuiteV4([m(undefined)], ctx(), voix).erreurs)).toContain("D15c");
  });
  it("D15 : une vidéo doit reprendre un mot de ce que la plaquette illustre ; une ligne doit tomber sur son mot dit", () => {
    const av = (r: string) => el("AvantApres", 5, 2.5, { mots: ["DEVIS", "RELANCES", "DEVIS"], recherches: [r], illustre: "les devis" });
    expect(codes(controlerSuiteV4([av("une feuille de devis sur un bureau")], ctx(), voix).erreurs)).not.toContain("D15h");
    expect(codes(controlerSuiteV4([av("un coucher de soleil")], ctx(), voix).erreurs)).toContain("D15h");
    const ligne = (a: number) => controlerSuiteV4([el("CarteChecklist", 0, 3, { mots: ["DEVIS"], lignes: [{ texte: "LES DEVIS", a }, { texte: "LES RELANCES", a: 1.4 }, { texte: "LES DEVIS", a: 1.0 }], illustre: "devis" })], ctx(), voix).avertissements.join();
    expect(ligne(1.0)).not.toMatch(/D15j/);
    expect(ligne(2.9)).toMatch(/D15j/);
  });
});

describe("branchement au réalisateur", () => {
  const donnees = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/transcription.json", "utf8")) as { dureeMonteeSec: number; motsMontesTexteValide: MotTranscrit[] };
  const plan = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/plan-realisateur.json", "utf8"));
  const mots = donnees.motsMontesTexteValide;
  it("le plan de la répétition générale (validé avant les plafonds de variété) : exactement ces D14 et aucune autre erreur, rendable, 30 i/s, aucun zoom, aucune carte de l'ancien catalogue", () => {
    const v = verifierPlan(plan, mots);
    expect(v.erreurs.every((e) => e.startsWith("D14 — "))).toBe(true);
    expect(v.erreurs.map((e) => /« (.+?) »/.exec(e)![1]).sort()).toEqual(["CarteChecklist", "CarteStatuts", "EtiquetteTete", "Interjection", "MotSaute"]);
    expect(v.rendable).toBe(true);
    expect(plan.fps).toBe(30);
    expect(plan.zooms).toEqual([]);
    expect(plan.cartes).toEqual([]);
    expect(plan.sons).toEqual([]);
    expect(plan.elementsV4.length).toBeGreaterThan(30);
    for (const e of plan.elementsV4 as ElementV4Plan[]) expect(ficheV4(e.id)?.actif, e.id).toBe(true);
  });
  it("même plan, une règle violée : verifierPlan le refuse et `estRendableV4` bloque le rendu", () => {
    const deux = structuredClone(plan);
    deux.elementsV4[1] = { ...deux.elementsV4[0], debut: deux.elementsV4[1].debut, fin: deux.elementsV4[1].fin };
    const v = verifierPlan(deux, mots);
    expect(v.erreurs.some((e: string) => /^V6a/.test(e))).toBe(true);
    expect(v.rendable).toBe(false);
    const zoom = structuredClone(plan);
    zoom.zooms = [[1, 2, 1.2]];
    expect(verifierPlan(zoom, mots).erreurs.some((e: string) => /^V2 /.test(e))).toBe(true);
    expect(estRendableV4(["V3a — x"])).toBe(false);
    expect(estRendableV4(["D15e — x"])).toBe(true);
  });
  it("`realiser` : la réponse du réalisateur (plaquettes v4) est lue, contrôlée et assemblée ; un plan fautif est refait avec la liste exacte des erreurs", async () => {
    const entree: EntreeRealisateur = { mots, dureeSec: donnees.dureeMonteeSec, prise: { src: "prise-montee.mp4", finSec: donnees.dureeMonteeSec }, fin: { debut: donnees.dureeMonteeSec, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };
    const bon = { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: plan.elementsV4, motsForts: ["fuite"] };
    const mauvais = { ...bon, elementsV4: [{ id: "LogoOutil", debut: 0, fin: 1.5, mots: ["X"], illustre: "x" }] };
    const messages: string[] = [];
    const r = await realiser(entree, { appeler: async (q) => { messages.push(q.message); return { ok: true, donnees: messages.length === 1 ? mauvais : bon }; } });
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(2); // le bon plan garde ses D14 : il est gardé dès le 2ᵉ essai
    expect(messages[1]).toContain("<erreurs_essai_precedent>");
    expect(messages[1]).toContain("EN COULISSE");
    expect(r.plan.fps).toBe(30);
    expect(r.plan.elementsV4?.length).toBe(plan.elementsV4.length);
    expect(r.plan.groupes.length).toBeGreaterThan(50);
  });
});

/* ---------------- 17/10 : mots interdits à l'écran, H1 recalée sur la mesure, H1b ---------------- */
import { groupesSousTitres } from "@/moteurs/montage-facecam-animee/realisateur";
import { indicesMotsInterditsEcran, motsInterditsDans } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { controlerDiversiteV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";


describe("mots interdits à l'écran (décision de Will du 17/10)", () => {
  it("la liste : Certifexemple (toutes casses, avec ou sans accent, apostrophe ou ponctuation), certifié / certifiée / certification, Villeexemple, gain garanti", () => {
    for (const t of ["Certifexemple", "CERTIFEXEMPLE", "certifexemple", "à Certifexemple", "grâce à Certifexemple,", "l'Certifexemple", "Certifexemple.", "QUALIÔPI".replace("Ô", "O")]) expect(motsInterditsDans(t), t).toContain("Certifexemple");
    for (const t of ["certifié", "Certifiée", "CERTIFICATION", "certifiés", "certifications", "organisme certifié"]) expect(motsInterditsDans(t), t).toContain("certifié / certification");
    expect(motsInterditsDans("à Villeexemple")).toContain("Villeexemple");
    expect(motsInterditsDans("Aucun gain garanti")).toContain("gain garanti");
    expect(motsInterditsDans("gains garantis")).toContain("gain garanti");
    for (const t of ["diagnostic gratuit", "45 minutes", "des aides OPCO possibles"]) expect(motsInterditsDans(t), t).toEqual([]);
  });

  it("dans un texte de plaquette (mots ou ligne) : refus V8a, quelle que soit la casse", () => {
    const e = (texte: string, ligne = false): ElementResoluV4 => {
      const base = el("EtiquetteTete", 0, 1.4);
      return ligne ? { ...base, lignes: [{ texte, a: 0.5 }] } : { ...base, mots: [texte] };
    };
    for (const t of ["CERTIFEXEMPLE", "grâce à Certifexemple", "ORGANISME CERTIFIÉ", "CERTIFICATION", "VILLEEXEMPLE", "AUCUN GAIN GARANTI"]) {
      expect(codes(controlerSuiteV4([e(t)], ctx(5)).erreurs), t).toContain("V8a");
      expect(codes(controlerSuiteV4([e(t, true)], ctx(5)).erreurs), `${t} (ligne)`).toContain("V8a");
    }
    expect(codes(controlerSuiteV4([e("DIAGNOSTIC")], ctx(5)).erreurs)).not.toContain("V8a");
  });

  const mot = (w: string, a: number): MotTranscrit => ({ w, a, f: a + 0.25 });
  const phrase: MotTranscrit[] = [mot("avec", 0), mot("des", 0.3), mot("aides", 0.6), mot("OPCO", 0.9), mot("possibles", 1.2), mot("grâce", 1.5), mot("à", 1.7), mot("Certifexemple,", 1.9), mot("en", 2.3), mot("vous", 2.5), mot("orientant", 2.7)];
  const affiches = (g: ReturnType<typeof groupesSousTitres>) => g.flatMap((x) => x.mots.map((m) => m.w));

  it("dans les sous-titres : le mot est masqué (le groupe saute le mot, sans trou), même si Will le prononce", () => {
    const g = groupesSousTitres(phrase);
    const mots = affiches(g);
    expect(mots.join(" ")).not.toMatch(/certifexemple/i);
    expect(mots).toContain("orientant");
    expect(mots).toContain("grâce");
    // Aucun groupe vide, aucun trou : chaque groupe a au moins un mot et finit avant le début du suivant ou au plus 0,5 s après son dernier mot.
    g.forEach((x, k) => { expect(x.mots.length).toBeGreaterThan(0); if (g[k + 1]) expect(x.fin).toBeLessThanOrEqual(g[k + 1].mots[0].a + 1e-6); });
    expect(indicesMotsInterditsEcran(phrase)).toEqual(new Set([7]));
  });

  it("dans les sous-titres : « certification », « Villeexemple » et « gain garanti » (deux mots) sont masqués aussi, CERTIFEXEMPLE en capitales aussi", () => {
    const g = affiches(groupesSousTitres([mot("une", 0), mot("certification", 0.3), mot("à", 0.9), mot("Villeexemple", 1.1), mot("sans", 1.6), mot("gain", 1.9), mot("garanti", 2.2), mot("CERTIFEXEMPLE", 2.6), mot("merci", 3.2)])).join(" ");
    expect(g).not.toMatch(/certification|villeexemple|gain|garanti|certifexemple/i);
    expect(g).toContain("merci");
    expect(g).toContain("sans");
  });

  it("verifierPlan : un plan dont les sous-titres gardent un mot interdit est refusé (V8b)", () => {
    const plan = { duree: 10, fin: { debut: 10 }, cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: suiteElementsPlan(), groupes: [{ mots: [{ w: "Certifexemple", a: 1 }], fin: 1.5 }] } as unknown as PlanFacecamAnimee;
    expect(codes(controlerDiversiteV4(plan).erreurs)).toContain("V8b");
    const propre = { ...plan, groupes: [{ mots: [{ w: "diagnostic", a: 1 }], fin: 1.5 }] } as unknown as PlanFacecamAnimee;
    expect(codes(controlerDiversiteV4(propre).erreurs)).not.toContain("V8b");
  });
});

function suiteElementsPlan(): ElementV4Plan[] {
  return [{ id: "EtiquetteTete", debut: 0, fin: 1.4, mots: ["DIAGNOSTIC"], illustre: "diagnostic" }];
}

describe("règles v4 · H1 recalée sur la mesure du rendu", () => {
  it("les événements à moins de 4 images forment UNE salve (comme `mesurer-densite.mjs`)", () => {
    const a = el("EtiquetteTete", 0, 1.2);
    const brut = evenementsDuPlanV4([a]);
    for (let k = 1; k < brut.length; k++) expect(brut[k] - brut[k - 1]).toBeGreaterThanOrEqual(4 / 30 - 1e-3);
  });
  it("H1b : plus de 0,75 s sans rien qui change est refusé", () => {
    const longue = el("CarteCalendrier", 0, 4.5);
    const sans = { ...longue, fiche: { ...longue.fiche, evts: [0] } } as ElementResoluV4;
    // Les gestes de vie visibles tiennent la plaquette en vie : pas de calme.
    expect(codes(controlerSuiteV4([sans], ctx(4.5)).erreurs)).not.toContain("H1b");
    // Une suite où rien ne se passe entre deux plaquettes lointaines : refus.
    expect(codes(controlerSuiteV4([el("EtiquetteTete", 0, 1.2), el("CarteCalendrier", 8, 3)], ctx(11)).erreurs)).toContain("H1b");
  });
});
