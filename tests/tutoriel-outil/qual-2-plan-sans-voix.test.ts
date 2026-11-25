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

function composer(texte: string, extra: { phraseTitre?: string; fin?: "aucune" | "rendez-vous"; dureeMs?: number } = {}) {
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

  it("instants et indices source calés sur les mots horodatés", () => {
    const mots = motsDe(FONDATEUR);
    const ecran = plan.scenes[1];
    if (ecran.genre !== "ecran") throw new Error("ecran");
    const suite = (r: { premier: number; dernier: number }) => norm(mots.slice(r.premier, r.dernier + 1).map((m) => m.texte).join(" "));
    for (const ev of ecran.evenements) {
      if (ev.genre === "cartes-chiffres") for (const c of ev.cartes) { expect(suite(c.source)).toContain(norm(c.libelle)); expect(c.aMs).toBe(mots[c.source.premier].debutMs); }
      if (ev.genre === "liste") { expect(suite(ev.source)).toContain(norm(ev.titre)); expect(ev.aMs).toBe(mots[ev.source.premier].debutMs); }
      if (ev.genre === "tri") { expect(suite(ev.source)).toContain(norm(ev.etiquette)); expect(ev.aMs).toBe(mots[ev.source.premier].debutMs); }
      if (ev.genre === "panneau") for (const r of ev.rubriques) { expect(suite(r.source)).toContain(norm(r.libelle)); expect(r.aMs).toBe(mots[r.source.premier].debutMs); }
      if (ev.genre === "alerte") {
        expect(suite(ev.source)).toContain(norm(ev.texte));
        expect(ev.aMs).toBeGreaterThanOrEqual(mots[ev.source.premier].debutMs);
        expect(ev.aMs).toBeLessThanOrEqual(mots[ev.source.dernier].finMs);
      }
    }
    const rep = plan.scenes[2];
    if (rep.genre !== "repere") throw new Error("repere");
    const iAu = mots.findIndex((m) => m.texte === "lieu");
    expect(rep.apresAMs).toBe(mots[iAu - 3].debutMs);
    expect(rep.barreAMs).toBe(mots[iAu + 1].debutMs);
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
    verifierLitteralite(plan, script, "Suivre ses commandes");
    const appel = plan.scenes[plan.scenes.length - 1];
    if (appel.genre !== "appel") throw new Error("appel");
    expect(appel.bouton).toBe("Prenez rendez-vous");
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

describe("QUAL-2 — corrections des relecteurs", () => {
  const ecranDe = (plan: PlanComposeSansVoix) => plan.scenes.find((s) => s.genre === "ecran");

  it("élisions : « l'application », « l'alerte » reconnus", () => {
    const script = "Un souci de suivi ? Ouvrez l'application. En haut, trois chiffres : ventes, stock et marge. Quand le stock baisse, l'alerte part toute seule. Prenez rendez-vous.";
    const { plan } = composer(script);
    const ecran = ecranDe(plan);
    expect(ecran).toBeDefined();
    if (!ecran || ecran.genre !== "ecran") return;
    expect(ecran.titreFenetre).toBe("Application");
    expect(ecran.evenements.some((e) => e.genre === "alerte")).toBe(true);
    const { plan: p2 } = composer("Un souci ? Voici l'outil. Un clic sur la liste des articles ouvre l'historique : entrées, sorties. Une alerte d'alerte part. Prenez rendez-vous.");
    expect(ecranDe(p2)).toBeDefined();
  });

  it("bouton d'appel : « Prendre rendez-vous » seulement si fin = rendez-vous", () => {
    const script = "Un souci de suivi ? Voici le nouveau tableau de bord. Nos clients prennent rendez-vous en ligne. Contactez-nous.";
    const a = composer(script).plan.scenes.at(-1)!;
    if (a.genre !== "appel") throw new Error("appel");
    expect(a.bouton).toBe("Contactez-nous");
    const b = composer(script, { fin: "rendez-vous" }).plan.scenes.at(-1)!;
    if (b.genre !== "appel") throw new Error("appel");
    expect(b.bouton).toBe("Prendre rendez-vous");
  });

  it("énumérations sans virgule d'Oxford : 3 cartes, 3 rubriques", () => {
    const script = "Un souci ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock et marge. Un clic sur un article ouvre l'historique : téléphone, adresse et notes. La liste des articles est triée par urgence. Prenez rendez-vous.";
    const ecran = ecranDe(composer(script).plan);
    if (!ecran || ecran.genre !== "ecran") throw new Error("ecran");
    const cartes = ecran.evenements.find((e) => e.genre === "cartes-chiffres");
    if (cartes?.genre !== "cartes-chiffres") throw new Error("cartes");
    expect(cartes.cartes.map((c) => c.libelle)).toEqual(["Ventes", "Stock", "Marge"]);
  });

  it("rubriques sans virgule d'Oxford", () => {
    const script = "Un souci ? Voici un tableau de bord. La liste des articles à commander est triée par urgence. Un clic sur un article ouvre son historique : téléphone, adresse et notes. Prenez rendez-vous.";
    const ecran = ecranDe(composer(script).plan);
    if (!ecran || ecran.genre !== "ecran") throw new Error("ecran");
    const pan = ecran.evenements.find((e) => e.genre === "panneau");
    if (pan?.genre !== "panneau") throw new Error("panneau");
    expect(pan.rubriques.map((r) => r.libelle)).toEqual(["Téléphone", "Adresse", "Notes"]);
  });

  it("titre plafonné : 1re phrase de 380 caractères, script sans ponctuation", () => {
    const longue = "Vous perdez beaucoup de temps chaque semaine à recopier à la main les mêmes informations dans plusieurs fichiers différents sans jamais savoir laquelle des versions est la bonne ni qui l'a modifiée en dernier et cela finit par coûter cher à toute votre équipe qui s'épuise sur des tâches répétitives que rien ne justifie vraiment aujourd'hui dans une petite entreprise moderne et bien organisée comme la vôtre ? Prenez rendez-vous.";
    expect(longue.split("?")[0].length).toBeGreaterThan(300);
    const { plan } = composer(longue);
    const titre = plan.scenes[0];
    if (titre.genre !== "titre") throw new Error("titre");
    expect(titre.texte.length).toBeLessThanOrEqual(60);
    expect(norm(longue).includes(norm(titre.texte))).toBe(true);
    const sansPonct = "voici un script très long sans aucune ponctuation qui continue encore et encore pour dépasser largement la taille raisonnable d'un titre affiché";
    const p2 = composer(sansPonct).plan.scenes[0];
    if (p2.genre !== "titre") throw new Error("titre");
    expect(p2.texte.length).toBeLessThanOrEqual(60);
    expect(norm(sansPonct).includes(norm(p2.texte))).toBe(true);
  });

  it("indices source exacts avec un mot vide à l'indice 1", () => {
    const script = "Un souci ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock et marge. Prenez rendez-vous.";
    const mots = motsDe(script);
    mots.splice(1, 0, { texte: "", debutMs: mots[1].debutMs, finMs: mots[1].debutMs });
    const { plan } = composerPlanSansVoix({ texte: script, mots, format: FORMAT, basPct: 87 });
    const ecran = ecranDe(plan);
    if (!ecran || ecran.genre !== "ecran") throw new Error("ecran");
    const cartes = ecran.evenements.find((e) => e.genre === "cartes-chiffres");
    if (cartes?.genre !== "cartes-chiffres") throw new Error("cartes");
    const ventes = cartes.cartes[0];
    expect(mots[ventes.source.premier].texte.toLowerCase()).toContain("ventes");
    expect(ventes.aMs).toBe(mots[ventes.source.premier].debutMs);
    for (const sc of plan.scenes) { expect(sc.mots.premier).toBeGreaterThanOrEqual(0); expect(sc.mots.dernier).toBeLessThan(mots.length); }
  });

  it("sans mots horodatés : plages vides cohérentes + remarque", () => {
    const { plan, remarques } = composerPlanSansVoix({ texte: "Un souci ? Voici un tableau de bord. En haut, trois chiffres : A, B, et C. Prenez rendez-vous.", mots: [], format: FORMAT, basPct: 87 });
    verifierPavage(plan);
    for (const sc of plan.scenes) expect(sc.mots).toEqual({ premier: 0, dernier: -1 });
    expect(remarques.some((r) => /horodat/.test(r))).toBe(true);
  });

  it("dureeMs facultative : le plan finit exactement là", () => {
    const { plan } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous", dureeMs: 60000 });
    expect(plan.dureeMs).toBe(60000);
    expect(plan.scenes.at(-1)!.finMs).toBe(60000);
    verifierPavage(plan);
  });

  it("script vide : jamais de scènes vides, le plan pave", () => {
    const { plan } = composerPlanSansVoix({ texte: "", mots: [], format: FORMAT, basPct: 87, dureeMs: 4000 });
    expect(plan.scenes.length).toBe(1);
    expect(plan.dureeMs).toBe(4000);
    verifierPavage(plan);
  });

  it("titre de liste qui finit sur un verbe", () => {
    expect(nettoyerLibelle(["10", "dernières", "commandes", "est"], { maxMots: 5, maxCar: 30 })?.texte).toBe("10 dernières commandes");
  });

  it("« A » seul n'est jamais retiré ; parenthèses orphelines", () => {
    expect(nettoyerLibelle(["A,"], { maxMots: 6, maxCar: 30 })?.texte).toBe("A");
    expect(nettoyerLibelle(["Stock", "(en", "temps", "réel"], { maxMots: 6, maxCar: 30 })?.texte).toBe("Stock");
    expect(nettoyerLibelle(["Stock", "(en", "temps", "réel)"], { maxMots: 6, maxCar: 30 })?.texte).toBe("Stock (en temps réel)");
  });

  it("éléments en trop retirés avant nettoyage, avec remarque", () => {
    const script = "Un souci ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock, marge et retards. Prenez rendez-vous.";
    const { plan, remarques } = composer(script);
    const ecran = ecranDe(plan);
    if (!ecran || ecran.genre !== "ecran") throw new Error("ecran");
    const cartes = ecran.evenements.find((e) => e.genre === "cartes-chiffres");
    if (cartes?.genre !== "cartes-chiffres") throw new Error("cartes");
    expect(cartes.cartes.length).toBe(3);
    expect(remarques.some((r) => /élément retiré : « (et )?retards/.test(r))).toBe(true);
  });

  it("cartes-phrases vides de sens fondues dans la voisine", () => {
    const script = "Votre cuisine vous ralentit ? Nous installons des meubles sur mesure. Voici. Chaque projet est suivi par un seul artisan. Merci. Contactez-nous.";
    const { plan } = composer(script);
    const textes = plan.scenes.filter((s) => s.genre === "carte-phrase").map((s) => (s.genre === "carte-phrase" ? s.texte : ""));
    expect(textes.some((t) => /^(voici|merci)$/i.test(t))).toBe(false);
    verifierPavage(plan);
  });
});
