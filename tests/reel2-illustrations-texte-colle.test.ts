/**
 * CORRECTEUR RÉEL 2 · tâche 1 (04/10) : la 1re vraie vidéo avocat (texte COLLÉ de 90 mots, mode « Rapide », un seul
 * angle) est sortie avec 9 plans TOUS « double » : aucune illustration, alors que la recette en vise ~1 plan sur 3.
 *
 * Cause : un texte collé n'est jamais réécrit, ses segments n'ont donc aucune « intention d'illustration » ; les plans
 * de l'Aperçu (`plansDepuisScript`) ne posaient une illustration QUE sur une intention écrite (générateur) ; la cascade
 * n'avait rien à chercher, la commande partait sans plan d'illustration et le moteur n'en plaçait aucun.
 *
 * Chemin reproduit de bout en bout, sans réseau : texte collé → blocs (`decouperTexte`, comme « Rapide ») → plans de
 * l'Aperçu (mode « auto ») → cascade simulée (« à fabriquer ») → commande → découpage du moteur réel sur l'audio.
 */
import { describe, expect, it } from "vitest";
import { decouperTexte } from "@/fournisseurs/simulation/script";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { STYLE_MONTAGE_AVOCAT } from "@/donnees/elements-avocat";
import { horodaterTexte, plansDepuisScript } from "@/domaine/derivations";
import { intentionsAutomatiques, requeteDuPlan } from "@/domaine/illustrations";
import type { BlocScript, Plan, PlanCommande } from "@/domaine/types";
import { decouperEnPlans } from "@/moteurs/montage-avocat/decoupage";
import { plansAFabriquer, plansProduitsAFabriquer } from "@/moteurs/montage-avocat/fabrication-illustrations";
import { preparerTexteVoix, reporterHorodatages } from "@/moteurs/montage-avocat/report";

/** ≈ 90 mots, collés tels quels (une phrase par ligne, comme un texte écrit à la main). */
const TEXTE_90_MOTS = [
  "Vous avez reçu une contravention pour un excès de vitesse ?",
  "Ne payez pas tout de suite.",
  "Regardez d'abord la date inscrite sur l'avis.",
  "Si le délai est dépassé, la procédure peut tomber.",
  "Vérifiez ensuite la photo du radar et la plaque de votre voiture.",
  "Une seule lettre illisible, et le doute vous profite.",
  "Vous pouvez contester par lettre recommandée, en gardant une copie du dossier.",
  "Un conducteur a ainsi gardé ses points et 135 euros.",
  "Gardez cette vidéo, elle vous servira le jour où le courrier arrive.",
].join("\n");

const recetteScript = formatAvocat.recetteScript;
const segmentsDe = (blocs: BlocScript[]) => blocs.flatMap((b) => b.segments.map((s) => ({ ...s, bloc: b.blocRecette })));

function plansRapide(blocs: BlocScript[], mode: "auto" | "manuel" | "aucune" = "auto"): Plan[] {
  return plansDepuisScript({ videoId: "v1", versionId: "v1-brouillon", blocs, dureeSec: 30, modeIllustrations: mode, personnageId: "perso-will", maintenant: "2026-10-04T10:00:00.000Z" });
}

describe("RÉEL 2 · texte collé + Rapide : des illustrations selon la recette", () => {
  const blocs = decouperTexte(TEXTE_90_MOTS, recetteScript);
  const segments = segmentsDe(blocs);

  it("le texte collé n'a aucune intention écrite (il n'est jamais réécrit) — point de départ du bug", () => {
    expect(segments.length).toBe(9);
    expect(segments.every((s) => !s.intentionIllustration)).toBe(true);
  });

  it("les plans de l'Aperçu posent ~1 illustration sur 3, jamais sur l'accroche, jamais deux de suite, ni sur le dernier", () => {
    const plans = plansRapide(blocs);
    const illus = plans.filter((p) => p.sourceImage === "illustration");
    expect(illus.length).toBeGreaterThanOrEqual(1);
    expect(illus.length).toBeLessThanOrEqual(Math.ceil(plans.length / 3));
    const accroche = new Set(blocs.filter((b) => b.blocRecette === "accroche").flatMap((b) => b.segments.map((s) => s.id)));
    for (const p of illus) {
      expect(accroche.has(p.segmentId!)).toBe(false);
      expect(p.ordre).not.toBe(1);
      expect(p.ordre).not.toBe(plans.length);
      expect(p.illustration?.requete?.trim()).toBeTruthy();
      expect(p.illustration?.verrouille).toBe(false);
    }
    const ordres = illus.map((p) => p.ordre);
    for (let i = 1; i < ordres.length; i++) expect(ordres[i] - ordres[i - 1]).toBeGreaterThan(1);
  });

  it("moteur réel : la commande issue de ces plans donne au moins un plan illustration au montage, dans la limite du prix", () => {
    // Cascade simulée sans banque : chaque illustration reste « à fabriquer » (le cas le plus cher, celui du prix affiché).
    const plans = plansRapide(blocs).map((p) => (p.sourceImage === "illustration" ? { ...p, illustration: { ...p.illustration!, source: "generee-ia" as const } } : p));
    const commande = { plans: plans as unknown as PlanCommande[], briques: { illustrations: true } as never, entrees: {} };
    const aPayer = plansAFabriquer(commande).length;
    expect(aPayer).toBeGreaterThanOrEqual(1);
    const segs = segments.map((s) => ({ id: s.id, texte: s.texte, bloc: s.bloc }));
    const t = preparerTexteVoix(segs, []);
    const mots = reporterHorodatages(t, horodaterTexte(t.texte, 3.2));
    const produits = decouperEnPlans({ mots, segments: segs, plansIndicatifs: commande.plans, recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, repartition: { principal: 1, second: 0 }, deuxAngles: false, ouvertureSurIllustration: false, illustrations: true, personnageId: "perso-will" });
    const illus = produits.filter((p) => p.sourceImage === "illustration");
    expect(illus.length).toBeGreaterThanOrEqual(1);
    // Jamais plus d'illustrations payées au moteur que celles comptées dans le prix accepté.
    expect(plansProduitsAFabriquer(commande, produits).length).toBeLessThanOrEqual(aPayer);
    // Jamais l'accroche : aucune illustration dans les 3 premières secondes.
    for (const p of illus) expect(p.debutSec).toBeGreaterThanOrEqual(3);
  });

  it("un script du générateur (intentions écrites) n'est pas touché ; modes « manuel » et « aucune » non plus", () => {
    const ecrit: BlocScript[] = blocs.map((b, i) => ({ ...b, segments: b.segments.map((s, j) => (i === 2 && j === 0 ? { ...s, intentionIllustration: "un radar au bord de la route" } : s)) }));
    const illusEcrit = plansRapide(ecrit).filter((p) => p.sourceImage === "illustration");
    expect(illusEcrit.map((p) => p.illustration?.requete)).toEqual(["un radar au bord de la route"]);
    expect(plansRapide(blocs, "manuel").every((p) => p.sourceImage === "double")).toBe(true);
    expect(plansRapide(blocs, "aucune").every((p) => p.sourceImage === "double")).toBe(true);
  });

  it("intentionsAutomatiques : seulement des objets concrets montrables (jamais une personne), tirés des mots du texte", () => {
    const choix = intentionsAutomatiques(blocs);
    expect(choix.size).toBeGreaterThanOrEqual(1);
    for (const [id, intention] of choix) {
      const texte = segments.find((s) => s.id === id)!.texte.toLowerCase();
      for (const mot of intention.split(" ")) expect(texte).toContain(mot);
      expect(intention).not.toMatch(/conducteur|avocat|client/);
    }
  });

  it("texte « bureautique » (Excel, alertes, tableau de bord) : des clips concrets ~1 plan sur 3, jamais l'accroche", () => {
    const texte = [
      "Vous perdez des heures chaque semaine ?",
      "Je vous montre comment l'éviter.",
      "Chaque matin, vous recopiez vos commandes dans Excel.",
      "Vous vérifiez vos stocks à la main.",
      "Une erreur de saisie, et la facture part fausse.",
      "Avec une automatisation simple, le logiciel remplit le tableur tout seul.",
      "Votre téléphone reçoit une alerte quand un stock baisse.",
      "Un client a gagné dix heures par mois.",
      "Écrivez-moi, je regarde votre fichier Excel.",
    ].join("\n");
    const b = decouperTexte(texte, recetteScript);
    const plans = plansRapide(b);
    const illus = plans.filter((p) => p.sourceImage === "illustration");
    expect(illus.length).toBeGreaterThanOrEqual(2);
    expect(illus.length).toBeLessThanOrEqual(Math.ceil(plans.length / 3));
    for (const p of illus) expect(p.ordre).not.toBe(1);
    // Les requêtes des banques (clips vidéo verticaux) nomment des objets concrets du texte.
    const requetes = illus.map((p) => requeteDuPlan({ id: p.id, ordre: p.ordre, texte: p.texte, requete: p.illustration?.requete }).requeteEn);
    expect(requetes.join(" ")).toMatch(/spreadsheet/);
  });
});
