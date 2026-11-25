/**
 * QUAL-2 — plan sans voix composé, déduit du script (0 €, aucun appel d'IA).
 * Vérifie : séquence exacte pour le script du fondateur, littéralité, aucun chiffre inventé, pavage, déterminisme, robustesse.
 */
import { describe, expect, it } from "vitest";
import { horodaterTexte } from "@/domaine/derivations";
import { MOTS_PAR_SECONDE } from "@/moteurs/montage-tutoriel-outil/script";
import { composerPlanSansVoix } from "@/moteurs/montage-tutoriel-outil/plan-sans-voix";
import { nettoyerLibelle } from "@/moteurs/montage-tutoriel-outil/plan-sans-voix-regles";
import type { MotMinute } from "@/briques/plan-scenes/schema";
import type { FormatImage, PlanComposeSansVoix } from "@/briques/plan-scenes/tutoriel/sans-voix/types";

const FORMAT: FormatImage = { largeur: 1080, hauteur: 1350, fps: 25 };
const FONDATEUR =
  "Vous perdez du temps à compter vos stocks à la main ? Voici un tableau de bord qui le fait pour vous. En haut, trois chiffres : les articles en stock, ceux qui passent sous le seuil, et la valeur totale. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article ouvre son historique : entrées, sorties, et date de la prochaine rupture prévue. Quand un article passe sous le seuil, une alerte part toute seule. Vous décidez en une minute au lieu d'une heure. Vous voulez le même pour votre entreprise ? Prenez rendez-vous.";
const TITRE = "Suivre ses stocks avec un tableau de bord simple";

function motsDe(texte: string): MotMinute[] {
  return horodaterTexte(texte, MOTS_PAR_SECONDE).map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(m.finSec * 1000) }));
}
const norm = (s: string) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

function textesAffiches(plan: PlanComposeSansVoix): string[] {
  const sortie: string[] = [];
  for (const s of plan.scenes) {
    if (s.genre === "titre") sortie.push(s.texte, ...(s.surTitre ? [s.surTitre] : []));
    if (s.genre === "carte-phrase") sortie.push(s.texte);
    if (s.genre === "repere") sortie.push(s.avant, s.apres);
    if (s.genre === "appel") sortie.push(s.bouton, ...(s.question ? [s.question] : []));
    if (s.genre === "ecran") {
      sortie.push(s.titreFenetre);
      for (const ev of s.evenements) {
        if (ev.genre === "cartes-chiffres") sortie.push(...ev.cartes.map((c) => c.libelle));
        if (ev.genre === "liste") sortie.push(ev.titre);
        if (ev.genre === "tri") sortie.push(ev.etiquette);
        if (ev.genre === "panneau") sortie.push(ev.titre, ...ev.rubriques.map((r) => r.libelle));
        if (ev.genre === "alerte") sortie.push(ev.texte);
      }
    }
  }
  return sortie;
}

function verifierLitteralite(plan: PlanComposeSansVoix, script: string, titre?: string, fin?: string) {
  const s = norm(script);
  for (const texte of textesAffiches(plan)) {
    const ok = s.includes(norm(texte)) || (titre !== undefined && norm(titre) === norm(texte)) || (fin !== undefined && norm(fin) === norm(texte));
    expect(ok, `texte non littéral : « ${texte} »`).toBe(true);
  }
}

function verifierPavage(plan: PlanComposeSansVoix) {
  expect(plan.scenes.length).toBeGreaterThan(0);
  expect(plan.scenes[0].debutMs).toBe(0);
  for (let i = 1; i < plan.scenes.length; i++) expect(plan.scenes[i].debutMs - plan.scenes[i - 1].finMs).toBeLessThanOrEqual(300);
  expect(plan.dureeMs - plan.scenes[plan.scenes.length - 1].finMs).toBeLessThanOrEqual(300);
  for (const sc of plan.scenes) expect(sc.finMs).toBeGreaterThanOrEqual(sc.debutMs);
}

function composer(texte: string, extra: { phraseTitre?: string; fin?: "aucune" | "rendez-vous" } = {}) {
  return composerPlanSansVoix({ texte, mots: motsDe(texte), format: FORMAT, basPct: 87, ...extra });
}

describe("QUAL-2 — script du fondateur", () => {
  const { plan, remarques } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous" });

  it("séquence exacte titre → ecran → repere → appel", () => {
    expect(plan.scenes.map((s) => s.genre)).toEqual(["titre", "ecran", "repere", "appel"]);
    const [titre, ecran, repere, appel] = plan.scenes;
    if (titre.genre !== "titre" || ecran.genre !== "ecran" || repere.genre !== "repere" || appel.genre !== "appel") throw new Error("genres");
    expect(titre.texte).toBe(TITRE);
    expect(titre.surTitre).toBe("Vous perdez du temps à compter vos stocks à la main ?");
    expect(ecran.titreFenetre).toBe("Tableau de bord");
    expect(repere.avant).toBe("une heure");
    expect(repere.apres).toBe("une minute");
    expect(appel.bouton).toBe("Prendre rendez-vous");
    expect(appel.question).toBe("Vous voulez le même pour votre entreprise ?");
    expect(remarques.filter((r) => /Pas d'appel|Pas de repère|Aucun nom/.test(r))).toEqual([]);
  });

  it("événements de l'écran", () => {
    const ecran = plan.scenes[1];
    if (ecran.genre !== "ecran") throw new Error("ecran");
    const genres = ecran.evenements.map((e) => e.genre);
    expect(genres.slice(0, 6)).toEqual(["cartes-chiffres", "liste", "tri", "clic", "panneau", "alerte"]);
    expect(genres.slice(6).every((g) => g === "focus")).toBe(true);
    expect(genres.length).toBeGreaterThan(6);
    const par = <G extends string>(g: G) => ecran.evenements.find((e) => e.genre === g) as never as Record<string, unknown> & { cartes: { libelle: string; aMs: number }[]; rubriques: { libelle: string }[]; titre: string; lignes: number; etiquette: string; cible: string; texte: string; cartePulse: number };
    expect(par("cartes-chiffres").cartes.map((c) => c.libelle)).toEqual(["Articles en stock", "Passent sous le seuil", "Valeur totale"]);
    const instants = par("cartes-chiffres").cartes.map((c) => c.aMs);
    expect([...instants].sort((a, b) => a - b)).toEqual(instants);
    expect(par("liste").titre).toBe("Articles à commander");
    expect(par("liste").lignes).toBe(4);
    expect(par("tri").etiquette).toBe("Par urgence");
    expect(par("clic").cible).toBe("ligne-1");
    expect(par("panneau").titre).toBe("Historique");
    expect(par("panneau").rubriques.map((r) => r.libelle)).toEqual(["Entrées", "Sorties", "Date de la prochaine rupture prévue"]);
    expect(par("alerte").texte).toBe("Un article passe sous le seuil");
    expect(par("alerte").cartePulse).toBe(1);
    const cibles = ecran.evenements.filter((e) => e.genre === "focus").map((e) => (e as { cible: string }).cible);
    expect(cibles).toContain("cartes");
    expect(cibles).toContain("liste");
  });

  it("instants calés sur les mots, dans l'écran", () => {
    const mots = motsDe(FONDATEUR);
    const ecran = plan.scenes[1];
    if (ecran.genre !== "ecran") throw new Error("ecran");
    const clic = ecran.evenements.find((e) => e.genre === "clic")!;
    expect(clic.aMs).toBe(mots.find((m) => m.texte === "clic")!.debutMs);
    for (const ev of ecran.evenements) {
      expect(ev.aMs).toBeGreaterThanOrEqual(ecran.debutMs);
      expect(ev.aMs).toBeLessThanOrEqual(ecran.finMs);
    }
    const appel = plan.scenes[3];
    if (appel.genre !== "appel") throw new Error("appel");
    expect(appel.clicAMs).toBe(mots.find((m) => m.texte.startsWith("rendez-vous"))!.debutMs);
  });

  it("littéralité, aucun chiffre, pavage, déterminisme", () => {
    verifierLitteralite(plan, FONDATEUR, TITRE, "Prendre rendez-vous");
    for (const t of textesAffiches(plan)) expect(t).not.toMatch(/\d/);
    verifierPavage(plan);
    const mots = motsDe(FONDATEUR);
    expect(plan.dureeMs).toBeGreaterThanOrEqual(mots[mots.length - 1].finMs);
    expect(plan.dureeMs - mots[mots.length - 1].finMs).toBeLessThanOrEqual(800);
    const deux = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous" });
    expect(JSON.stringify(deux.plan)).toBe(JSON.stringify(plan));
  });
});

describe("QUAL-2 — robustesse", () => {
  it("script sans outil : titre + cartes-phrases + appel, jamais vide", () => {
    const script = "Votre cuisine vous ralentit ? Nous installons des meubles sur mesure. Chaque projet est suivi par un seul artisan. Vous voulez un devis ? Contactez-nous.";
    const { plan, remarques } = composer(script);
    expect(plan.scenes.map((s) => s.genre)).toEqual(["titre", "carte-phrase", "carte-phrase", "appel"]);
    expect(plan.scenes.some((s) => s.genre === "ecran")).toBe(false);
    verifierLitteralite(plan, script);
    verifierPavage(plan);
    expect(remarques.length).toBeGreaterThan(0);
    for (const s of plan.scenes) if (s.genre === "carte-phrase") expect(s.texte.length).toBeLessThanOrEqual(48);
    const a = plan.scenes[3];
    if (a.genre !== "appel") throw new Error("appel");
    expect(a.bouton).toBe("Contactez-nous");
  });

  it("chiffres dits : seulement s'ils sont dans le script", () => {
    const script = "Trois commandes en retard ? Voici un outil qui les trouve. 3 commandes en retard sont signalées chaque matin. Prenez rendez-vous.";
    const { plan } = composer(script, { phraseTitre: "Suivre ses commandes" });
    verifierLitteralite(plan, script, "Suivre ses commandes", "Prendre rendez-vous");
    verifierPavage(plan);
    const avecChiffre = textesAffiches(plan).filter((t) => /\d/.test(t));
    for (const t of avecChiffre) expect(norm(script).includes(norm(t))).toBe(true);
  });

  it("très court : une scène titre qui couvre tout", () => {
    const { plan } = composer("Bonjour tout le monde.");
    expect(plan.scenes.map((s) => s.genre)).toEqual(["titre"]);
    expect(plan.scenes[0].debutMs).toBe(0);
    expect(plan.scenes[0].finMs).toBe(plan.dureeMs);
    verifierPavage(plan);
  });

  it("ne lève jamais (vide, ponctuation seule, mots absents)", () => {
    expect(() => composerPlanSansVoix({ texte: "", mots: [], format: FORMAT, basPct: 87 })).not.toThrow();
    expect(() => composerPlanSansVoix({ texte: "?!", mots: [], format: FORMAT, basPct: 87 })).not.toThrow();
    const { plan } = composerPlanSansVoix({ texte: "Voici un tableau de bord. En haut, trois chiffres : A, B, et C.", mots: [], format: FORMAT, basPct: 87 });
    verifierPavage(plan);
  });

  it("nettoyage des libellés", () => {
    expect(nettoyerLibelle(["ceux", "qui", "passent", "sous", "le", "seuil,"], { maxMots: 6, maxCar: 30 })?.texte).toBe("Passent sous le seuil");
    expect(nettoyerLibelle(["et", "la", "valeur", "totale."], { maxMots: 6, maxCar: 30 })?.texte).toBe("Valeur totale");
    expect(nettoyerLibelle(["l'historique", ":"], { maxMots: 3, maxCar: 28 })?.texte).toBe("Historique");
    expect(nettoyerLibelle(["les", "des"], { maxMots: 3, maxCar: 28 })).toBeNull();
  });
});
