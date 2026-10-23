/**
 * PANNE DU 15/10 (vidéo v-d3e2a726cf0c, voix payée) : la fabrication s'est arrêtée au dessin des scènes, refusée par le
 * contrôle « Blocs écrits à l'heure » (« Contrôles des données » fini 1,85 s après sa fin dite…). Quand la voix dit
 * plusieurs lignes coup sur coup, le crayon était encore occupé (une coche calée tard, un contour). Règle : une vidéo
 * n'est JAMAIS refusée pour ça ; chaque bloc est entier au plus tard à la fin de sa phrase dite + 0,15 s :
 *  (a) il part un peu plus tôt (jusqu'à 0,6 s avant ses mots, jamais pendant la transition) ;
 *  (b) sinon les gestes décoratifs qui le retardent (coche, souligné, contour) sont raccourcis, puis sautés ;
 *  (c) en dernier recours, il apparaît en fondu court (« posé ») à l'heure et le crayon passe au suivant.
 * Le témoin réel est rejoué sur un minutage de voix RAPIDE (listes dites d'une traite), dans les quatre sorties.
 */
import { describe, expect, it } from "vitest";
import type { MotCalage } from "../../../src/briques/motion/calage";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { AVANCE_DEPART_MAX_SEC, opaciteLigne3, planPage3, poseCrayon3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { controlerAnimation3, RETARD_ECRITURE_MAX_SEC } from "../../../src/moteurs/montage-tableau/controles-v3";
import { IDS_FORMATS_SORTIE, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { caleeEcritureALHeure, ficheEcritureALHeure, motsRapides } from "./fiches";

const fiche = ficheEcritureALHeure();
const texte = fiche.scenes.map((s) => s.texteDit).join(" ");

const MINUTAGES = [
  { nom: "rapide (virgules à peine marquées)", mots: motsRapides(fiche, 19, 0.03, 0.15) },
  { nom: "très rapide (listes d'une traite)", mots: motsRapides(fiche, 21, 0, 0.1) },
];

function proprietes(mots: MotCalage[], format: IdFormatSortie): ProprietesTableauScene[] {
  const r = caleeEcritureALHeure(mots);
  const mise = mettreEnPage(r.fiche, format === "vertical" ? {} : { format });
  return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: r.fiche.scenes as SceneCalee[], heures: r.elements, stylo: r.fiche.stylo, mots, temps3: tempsReference3(r.fiche, mots) });
}

describe("témoin réel v-d3e2a726cf0c (reference/3, 13 scènes), voix rapide", () => {
  it("le témoin est celui de la panne : 13 scènes, style reference/3", () => {
    expect(fiche.videoId).toBe("v-d3e2a726cf0c");
    expect(fiche.habillage).toBe("reference/3");
    expect(fiche.scenes).toHaveLength(13);
    expect(texte).toMatch(/Paramètres, Contrôles des données, décochez/);
  });

  for (const m of MINUTAGES)
    it(`${m.nom} : aucune faute d'animation, dans les quatre sorties`, () => {
      // Au moins 16,5 caractères par seconde sur toute la vidéo, pauses comprises.
      expect(texte.length / m.mots.at(-1)!.finSec).toBeGreaterThanOrEqual(16.5);
      for (const format of IDS_FORMATS_SORTIE) {
        const c = controlerAnimation3(proprietes(m.mots, format));
        expect(c.map((x) => x.libelle)).toContain("Blocs écrits à l'heure");
        expect(c.flatMap((x) => x.fautes.map((f) => `${format} · ${x.libelle} : ${f.message}`))).toEqual([]);
      }
    });
});

/** La page 8 du témoin (« Paramètres, Contrôles des données, décochez ») en vertical, voix rapide. */
const page8 = () => proprietes(MINUTAGES[0].mots, "vertical").find((p) => p.page.page === 8)!;
const planDe = (p: ProprietesTableauScene) => planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
const ecrit = (plan: ReturnType<typeof planDe>, id: string) => plan.actions.filter((a) => a.id === id && a.trace === "ecrire");
const finDite = (p: ProprietesTableauScene, id: string) => p.styleReference!.temps3![`${id}~fin`] / 1000;

describe("ordonnancement : chaque bloc entier à sa fin dite", () => {
  it("(a) un bloc trop long pour le temps où il est dit part un peu plus tôt (≤ 0,6 s, jamais pendant la transition)", () => {
    const p = page8();
    const r = p.styleReference!;
    // « Décochez « Améliorer le modèle » » dit en 0,15 s seulement, crayon libre avant : il ne tient qu'en partant plus tôt.
    const heure = r.temps3!["e35~fin"] - 150;
    const q = { ...p, styleReference: { ...r, heuresPage: { ...r.heuresPage, e35: heure }, temps3: { ...r.temps3!, "e35~debut": heure } } };
    const plan = planDe(q);
    const lignes = ecrit(plan, "e35");
    expect(lignes.some((a) => a.fondu)).toBe(false);
    expect(lignes[0].debut).toBeLessThan(heure / 1000);
    expect(lignes[0].debut).toBeGreaterThanOrEqual(heure / 1000 - AVANCE_DEPART_MAX_SEC - 1e-6);
    expect(lignes[0].debut).toBeGreaterThanOrEqual(plan.finTransition);
    expect(Math.max(...lignes.map((a) => a.debut + a.duree))).toBeLessThanOrEqual(finDite(q, "e35") + RETARD_ECRITURE_MAX_SEC);
  });

  it("(b) une coche calée tard (la panne : « Paramètres ») ne bloque plus le crayon : elle est faite plus tôt, plus vite, ou sautée", () => {
    const p = page8();
    const r = p.styleReference!;
    // La fin dite de « Paramètres » tombe à la fin de la phrase : sa coche était calée là, et tout attendait derrière.
    expect(finDite(p, "e33")).toBeGreaterThan(finDite(p, "e35"));
    const plan = planDe(p);
    const coche = plan.actions.find((a) => a.id === "e33" && a.trace === "coche");
    const e34 = ecrit(plan, "e34");
    if (coche) {
      expect(coche.debut + coche.duree).toBeLessThanOrEqual(e34[0].debut);
      expect(coche.duree).toBeLessThan(0.32 * 0.8);
    }
    for (const id of ["e33", "e34", "e35"]) {
      const l = ecrit(plan, id);
      expect(l.some((a) => a.fondu), id).toBe(false);
      expect(Math.max(...l.map((a) => a.debut + a.duree)), id).toBeLessThanOrEqual(finDite(p, id) + RETARD_ECRITURE_MAX_SEC);
    }
    // Avec la file serrée, plus rien à l'heure de l'ancienne coche (57,4 s) : le crayon a fini avant.
    expect(Math.max(...plan.actions.map((a) => a.debut + a.duree))).toBeLessThan(r.temps3!["e33~fin"] / 1000 - 0.5);
  });

  it("(b) le geste décoratif d'un bloc qui le retarde (souligné du titre) est raccourci ou sauté", () => {
    const p = page8();
    const r = p.styleReference!;
    // Le titre « Coupez » (souligné en arrivant) et la phrase clé à écrire tout de suite, dite très vite.
    const fin = Math.round(1000 * (planDe(p).finTransition + 0.62));
    const q = { ...p, styleReference: { ...r, poses: (r.poses ?? []).filter((x) => x !== "e31"), heuresPage: { ...r.heuresPage, e31: Math.round(planDe(p).finTransition * 1000) }, temps3: { ...r.temps3!, "e31~fin": fin } } };
    const plan = planDe(q);
    const souligne = plan.actions.find((a) => a.id === "e30" && a.trace === "souligne");
    expect(souligne === undefined || souligne.duree < 0.32 * 0.8).toBe(true);
    const l = ecrit(plan, "e31");
    expect(Math.max(...l.map((a) => a.debut + a.duree))).toBeLessThanOrEqual(fin / 1000 + RETARD_ECRITURE_MAX_SEC);
  });

  it("(c) un bloc impossible à écrire à temps apparaît en fondu court, entier à l'heure ; le crayon n'y va pas", () => {
    const p = page8();
    const r = p.styleReference!;
    // « Paramètres » et « Contrôles des données » dits au même instant, le second en 0,1 s : le crayon est pris.
    const heure = r.heuresPage.e34;
    const q = { ...p, styleReference: { ...r, heuresPage: { ...r.heuresPage, e33: heure }, temps3: { ...r.temps3!, "e34~fin": heure + 100 } } };
    const plan = planDe(q);
    const lignes = ecrit(plan, "e34");
    // Charte Axion (15/10) : « Contrôles des données » tient sur une ligne en Inter Medium (deux en Montserrat).
    expect(lignes.length).toBe(1);
    expect(lignes.every((a) => a.fondu)).toBe(true);
    const fin = Math.max(...lignes.map((a) => a.debut + a.duree));
    expect(fin).toBeLessThanOrEqual((heure + 100) / 1000 + RETARD_ECRITURE_MAX_SEC);
    // Fondu : transparent avant, entier à la fin.
    expect(opaciteLigne3(plan, "e34", "ligne:0", lignes[0].debut - 0.01)).toBe(0);
    expect(opaciteLigne3(plan, "e34", "ligne:0", fin)).toBe(1);
    // Le crayon ne s'arrête pas sur une ligne posée.
    for (let t = lignes[0].debut; t <= fin; t += 0.02) {
      const pose = poseCrayon3(plan, t);
      if (pose?.ecrit) expect(plan.actions.some((a) => !a.fondu && t >= a.debut && t <= a.debut + a.duree)).toBe(true);
    }
    // Le contrôle passe.
    const props = proprietes(MINUTAGES[0].mots, "vertical").map((x) => (x.page.page === 8 ? { ...x, styleReference: { ...x.styleReference!, heuresPage: { ...x.styleReference!.heuresPage, e33: heure }, temps3: { ...x.styleReference!.temps3!, "e34~fin": heure + 100 } } } : x));
    expect(controlerAnimation3(props).find((c) => c.libelle === "Blocs écrits à l'heure")!.fautes).toEqual([]);
  });
});
