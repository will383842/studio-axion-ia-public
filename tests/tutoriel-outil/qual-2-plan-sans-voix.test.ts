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
  const res = composerPlanSansVoix({ texte, mots: motsDe(texte), format: FORMAT, basPct: 87, ...extra });
  // Le filet global ne doit jamais masquer un bogue.
  expect(res.remarques.filter((r) => /interrompue/.test(r))).toEqual([]);
  return res;
}

/** Tous les instants d'une scène (cartes, rubriques, barre, après, déclencheur, clic…) tiennent dans [debutMs, finMs]. */
function verifierRienHorsScene(plan: PlanComposeSansVoix) {
  for (const sc of plan.scenes) {
    const instants: number[] = [];
    if (sc.genre === "repere") instants.push(sc.barreAMs, sc.apresAMs);
    if (sc.genre === "appel") instants.push(sc.clicAMs);
    if (sc.genre === "ecran") {
      for (const ev of sc.evenements) {
        instants.push(ev.aMs);
        if (ev.genre === "cartes-chiffres") instants.push(...ev.cartes.map((c) => c.aMs));
        if (ev.genre === "panneau") instants.push(...ev.rubriques.map((r) => r.aMs));
        if (ev.genre === "alerte" && ev.declencheurAMs !== undefined) instants.push(ev.declencheurAMs);
        if (ev.genre === "cartes-chiffres") expect(ev.cartes.length).toBeGreaterThan(0);
        if (ev.genre === "panneau") expect(ev.rubriques.length).toBeGreaterThan(0);
        if (ev.genre === "alerte" && ev.cartePulse !== undefined) {
          const cs = sc.evenements.find((x) => x.genre === "cartes-chiffres");
          expect(cs?.genre === "cartes-chiffres" ? cs.cartes.length : 0).toBeGreaterThan(ev.cartePulse);
        }
      }
    }
    for (const x of instants) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(sc.finMs);
    }
  }
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
        expect(ev.aMs).toBeLessThanOrEqual(mots[ev.source.premier].debutMs);
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

describe("QUAL-2 — rythme de l'alerte et points mineurs", () => {
  const mots = (s: string) => motsDe(s);
  it("l'alerte démarre au début de sa phrase (« Quand »)", () => {
    const { plan } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous" });
    const ecran = plan.scenes.find((s) => s.genre === "ecran");
    if (ecran?.genre !== "ecran") throw new Error("ecran");
    const alerte = ecran.evenements.find((e) => e.genre === "alerte");
    if (alerte?.genre !== "alerte") throw new Error("alerte");
    const m = mots(FONDATEUR);
    const quand = m.find((x) => x.texte === "Quand");
    expect(alerte.aMs).toBe(quand?.debutMs);
  });

  it("« Lorsqu'un … » : élision reconnue", async () => {
    const { sansElision } = await import("@/moteurs/montage-tutoriel-outil/plan-sans-voix-regles");
    expect(sansElision("lorsqu'un")).toBe("un");
    expect(sansElision("jusqu'a")).toBe("a");
    expect(sansElision("puisqu'il")).toBe("il");
    expect(sansElision("quoiqu'elle")).toBe("elle");
  });

  it("« Merci. » final n'annule pas la scène d'appel", () => {
    const { plan } = composer("Un souci ? Voici un tableau de bord. Un clic sur un article ouvre son historique : entrées et sorties. Vous voulez le même ? Prenez rendez-vous. Merci.", { fin: "rendez-vous" });
    expect(plan.scenes[plan.scenes.length - 1].genre).toBe("appel");
    expect(plan.scenes.some((s) => s.genre === "carte-phrase" && /merci/i.test(s.texte))).toBe(false);
  });

  it("bouton : le verbe d'appel l'emporte sur le nom", () => {
    const { plan } = composer("Un souci de stock ? Nous installons des meubles sur mesure. Devis, contactez-nous.");
    const appel = plan.scenes.find((s) => s.genre === "appel");
    if (appel?.genre !== "appel") throw new Error("appel");
    expect(appel.bouton).toBe("Contactez-nous");
  });

  it("dureeMs plus courte que la fin des mots : remarque", () => {
    const { remarques } = composer("Un souci ? Voici un tableau de bord. Prenez rendez-vous.", { dureeMs: 500 });
    expect(remarques.some((r) => /dureeMs/.test(r))).toBe(true);
  });

  it("1re phrase de ponctuation seule : jamais titre ni sur-titre", () => {
    const { plan } = composer("… Voici un tableau de bord simple. Prenez rendez-vous.");
    const titre = plan.scenes[0];
    if (titre.genre !== "titre") throw new Error("titre");
    expect(/[\p{L}]/u.test(titre.texte)).toBe(true);
    const a = composer(". Voici un tableau de bord. Prenez rendez-vous.", { phraseTitre: "Mon titre" }).plan.scenes[0];
    if (a.genre !== "titre") throw new Error("titre");
    expect(a.surTitre === undefined || /[\p{L}]/u.test(a.surTitre)).toBe(true);
  });

  describe("revue opus : aMs de l'alerte, élisions, politesses, titres, dureeMs", () => {
    const alerteDe = (plan: PlanComposeSansVoix) => {
      for (const sc of plan.scenes) if (sc.genre === "ecran") for (const ev of sc.evenements) if (ev.genre === "alerte") return ev;
      throw new Error("pas d'alerte");
    };
    const debutDe = (texte: string, mot: string, nieme = 0): number => {
      const m = motsDe(texte).filter((x) => x.texte.toLowerCase().replace(/[^a-zà-ÿ']/g, "") === mot.toLowerCase());
      return m[nieme].debutMs;
    };

    it("fondateur : aMs = « Quand »", () => {
      const { plan } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous" });
      expect(alerteDe(plan).aMs).toBe(debutDe(FONDATEUR, "Quand"));
    });

    it("fondateur : declencheurAMs = début du mot « alerte »", () => {
      const { plan } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous" });
      const a = alerteDe(plan);
      expect(a.declencheurAMs).toBe(debutDe(FONDATEUR, "alerte"));
      expect(a.declencheurAMs).toBeGreaterThan(a.aMs);
    });

    it("condition au milieu de la phrase : aMs = « quand », pas le début de la phrase", () => {
      const txt = "Un souci de stock ? Voici un tableau de bord. Juste en dessous, la liste des articles, et quand un article passe sous le seuil, une alerte part toute seule. Prenez rendez-vous.";
      const { plan } = composer(txt);
      const a = alerteDe(plan);
      expect(a.aMs).toBe(debutDe(txt, "quand"));
      expect(a.aMs).toBeGreaterThan(debutDe(txt, "liste"));
    });

    it("sans condition : aMs = début du texte affiché (« une alerte »), pas la phrase entière", () => {
      const txt = "Un souci de stock ? Voici un tableau de bord. Chaque matin à huit heures, après le café…, une alerte part. Prenez rendez-vous.";
      const { plan } = composer(txt);
      const a = alerteDe(plan);
      expect(a.aMs).toBe(debutDe(txt, "une"));
      expect(a.aMs).toBeGreaterThan(debutDe(txt, "Chaque"));
    });

    it("« Lorsqu'un article… » : conjonction reconnue, préfixe retiré du libellé", () => {
      const txt = "Un souci de stock ? Voici un tableau de bord. En haut, la liste des articles. Lorsqu'un article passe sous le seuil, une alerte part. Prenez rendez-vous.";
      const { plan } = composer(txt);
      const a = alerteDe(plan);
      expect(a.texte).toBe("Un article passe sous le seuil");
      expect(a.aMs).toBe(debutDe(txt, "Lorsqu'un"));
    });

    it.each(["Merci, bonne journée.", "À bientôt.", "Au revoir et bonne journée."])("politesse finale « %s » : scène d'appel gardée, fondue", (pol) => {
      const txt = `Un souci ? Voici un tableau de bord. Un clic sur un article ouvre son historique : entrées et sorties. Vous voulez le même ? Prenez rendez-vous. ${pol}`;
      const { plan } = composer(txt, { fin: "rendez-vous" });
      const dernier = plan.scenes[plan.scenes.length - 1];
      expect(dernier.genre).toBe("appel");
      expect(plan.scenes.some((s) => s.genre === "carte-phrase" && /merci|bientot|bientôt|revoir|bonne/i.test(s.texte))).toBe(false);
      expect(dernier.mots.dernier).toBe(motsDe(txt).length - 1);
    });

    it("titre tiré du script : jamais de ponctuation au début", () => {
      for (const t of [". Voici un tableau de bord simple. Prenez rendez-vous.", "… Voici un tableau de bord simple. Prenez rendez-vous."]) {
        const titre = composer(t).plan.scenes[0];
        if (titre.genre !== "titre") throw new Error("titre");
        expect(titre.texte).toBe("Voici un tableau de bord simple.");
        const avecSaisi = composer(t, { phraseTitre: "Mon titre" }).plan.scenes[0];
        if (avecSaisi.genre !== "titre") throw new Error("titre");
        expect(avecSaisi.surTitre === undefined || /^[\p{L}\p{N}]/u.test(avecSaisi.surTitre)).toBe(true);
      }
    });

    it("script de ponctuation seule : remarque et titre jamais de ponctuation vide", () => {
      const a = composer("… . ?");
      expect(a.remarques.some((r) => /sans mots/.test(r))).toBe(true);
      const ta = a.plan.scenes[0];
      if (ta.genre !== "titre") throw new Error("titre");
      expect(ta.texte).toBe("");
      const b = composer("… . ?", { phraseTitre: "Mon titre" });
      const tb = b.plan.scenes[0];
      if (tb.genre !== "titre") throw new Error("titre");
      expect(tb.texte).toBe("Mon titre");
    });

    it("dureeMs courte : aucun instant (cartes, rubriques, barre, après, déclencheur, clic) hors de sa scène", () => {
      const scripts = [
        "Voici. Vous décidez en une minute au lieu d'une heure.",
        FONDATEUR,
        "Un souci ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock et marge. Un clic sur un article ouvre son historique : entrées, sorties, ruptures. Quand le stock baisse, une alerte part. Vous décidez en une minute au lieu d'une heure. Prenez rendez-vous.",
      ];
      for (const txt of scripts) for (const dureeMs of [500, 1500, 2500, 6000, 12000, 20000, 30000]) {
        const { plan } = composer(txt, { fin: "rendez-vous", dureeMs });
        verifierRienHorsScene(plan);
      }
    });

    it("titre saisi trop long : plafonné à 60 caractères comme le plan minimal", () => {
      const long = "Un titre vraiment très long qui dépasse largement les soixante caractères permis pour un titre";
      const { plan } = composer("Un souci ? Voici un tableau de bord. Prenez rendez-vous.", { phraseTitre: long });
      const t = plan.scenes[0];
      if (t.genre !== "titre") throw new Error("titre");
      expect(t.texte.length).toBeLessThanOrEqual(60);
    });

    it("dureeMs plus courte que la parole : rien hors de sa scène, aucune scène au-delà", () => {
      const dureeMs = 20000;
      const { plan, remarques } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous", dureeMs });
      expect(remarques.some((r) => /dureeMs/.test(r))).toBe(true);
      expect(plan.dureeMs).toBe(dureeMs);
      expect(plan.scenes[plan.scenes.length - 1].finMs).toBe(dureeMs);
      for (const sc of plan.scenes) {
        expect(sc.debutMs).toBeLessThan(dureeMs);
        expect(sc.finMs).toBeLessThanOrEqual(dureeMs);
        if (sc.genre === "appel") expect(sc.clicAMs).toBeLessThanOrEqual(sc.finMs);
        if (sc.genre === "ecran") {
          expect(sc.evenements.length).toBeGreaterThan(0);
          for (const ev of sc.evenements) {
            expect(ev.aMs).toBeLessThan(sc.finMs);
            if (ev.genre === "focus") expect(ev.finMs).toBeLessThanOrEqual(sc.finMs);
          }
        }
      }
      verifierPavage(plan);
    });
  });
});

describe("QUAL-2 — politesse ou appel, aMs de l'alerte, mots tronqués", () => {
  const appelDe = (texte: string) => composer(texte).plan.scenes.find((s) => s.genre === "appel");
  it("« Merci de nous contacter. » reste un appel", () => {
    const a = appelDe("Voici un tableau de bord pour vos stocks. Une alerte part. Merci de nous contacter.");
    expect(a).toBeDefined();
    if (a?.genre === "appel") expect(a.bouton).toMatch(/contact/i);
  });
  it("« Bonne nouvelle, prenez rendez-vous dès aujourd'hui. » reste un appel", () => {
    const a = appelDe("Voici un tableau de bord pour vos stocks. Une alerte part. Bonne nouvelle, prenez rendez-vous dès aujourd'hui.");
    expect(a).toBeDefined();
    if (a?.genre === "appel") expect(norm(a.bouton)).toContain("rendez vous");
  });
  it("une vraie politesse est fondue dans l'appel", () => {
    const { plan } = composer("Voici un tableau de bord pour vos stocks. Une alerte part. Prenez rendez-vous. Merci, bonne journée.");
    const appels = plan.scenes.filter((s) => s.genre === "appel");
    expect(appels).toHaveLength(1);
    expect(plan.scenes[plan.scenes.length - 1].genre).toBe("appel");
  });
  it("alerte : conjonction après le texte affiché => aMs = début du texte affiché", () => {
    const script = "Voici un tableau de bord pour vos stocks. Une alerte part quand le stock baisse. Prenez rendez-vous.";
    const mots = motsDe(script);
    const { plan } = composer(script);
    const ev = plan.scenes.flatMap((s) => (s.genre === "ecran" ? s.evenements : [])).find((e) => e.genre === "alerte");
    expect(ev).toBeDefined();
    if (ev?.genre === "alerte") {
      const i = mots.findIndex((m) => m.texte === "Une");
      expect(ev.aMs).toBe(mots[i].debutMs);
    }
  });
  it("troncature : le dernier mot de la dernière scène commence avant dureeMs", () => {
    const script = FONDATEUR;
    const mots = motsDe(script);
    const dureeMs = Math.round(mots[mots.length - 6].debutMs + 10);
    const { plan } = composer(script, { dureeMs });
    const der = plan.scenes[plan.scenes.length - 1];
    expect(mots[der.mots.dernier].debutMs).toBeLessThan(dureeMs);
    expect(der.mots.dernier).toBeLessThanOrEqual(mots.length - 6);
  });
});

describe("QUAL-2 — revue opus 2 : troncature sans liste vide, focus orphelin, politesse, alerte", () => {
  const options = { phraseTitre: TITRE, fin: "rendez-vous" as const };

  function verifierInvariants(plan: PlanComposeSansVoix) {
    verifierRienHorsScene(plan);
    verifierPavage(plan);
    for (const sc of plan.scenes) {
      if (sc.genre !== "ecran") continue;
      const genres = new Set(sc.evenements.map((ev) => ev.genre));
      for (const ev of sc.evenements) {
        if (ev.genre === "cartes-chiffres") expect(ev.cartes.length).toBeGreaterThan(0);
        if (ev.genre === "panneau") expect(ev.rubriques.length).toBeGreaterThan(0);
        if (ev.genre === "focus" && ev.cible !== "ensemble") {
          const attendu = ev.cible === "cartes" ? "cartes-chiffres" : ev.cible;
          expect(genres.has(attendu), `focus orphelin : ${ev.cible}`).toBe(true);
        }
      }
    }
  }

  it("dureeMs 10000 et 24000 : aucune liste vide", () => {
    for (const dureeMs of [10000, 24000]) {
      const { plan } = composer(FONDATEUR, { ...options, dureeMs });
      verifierInvariants(plan);
    }
  });

  it("balayage tous les 100 ms sur le script du fondateur : invariants tenus", () => {
    for (let dureeMs = 100; dureeMs <= 40000; dureeMs += 100) {
      const { plan } = composer(FONDATEUR, { ...options, dureeMs });
      try {
        verifierInvariants(plan);
      } catch (err) {
        throw new Error(`dureeMs ${dureeMs} : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  it("dureeMs 9000 : un focus dont la cible a disparu vise l'ensemble", () => {
    const { plan } = composer(FONDATEUR, { ...options, dureeMs: 9000 });
    verifierInvariants(plan);
    for (const sc of plan.scenes) {
      if (sc.genre !== "ecran") continue;
      const genres = new Set(sc.evenements.map((ev) => ev.genre));
      for (const ev of sc.evenements) if (ev.genre === "focus" && ev.cible === "liste") expect(genres.has("liste")).toBe(true);
    }
  });

  it("politesse finale avec un NOM d'appel (« restons en contact ») : le bouton reste « Prenez rendez-vous »", () => {
    const texte = "Un souci ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock et marge. Prenez rendez-vous. Merci, à bientôt et restons en contact.";
    const { plan } = composer(texte);
    const appel = plan.scenes.find((s) => s.genre === "appel");
    if (!appel || appel.genre !== "appel") throw new Error("appel");
    expect(appel.bouton).toBe("Prenez rendez-vous");
    const b = composer(texte, { fin: "rendez-vous" }).plan.scenes.find((s) => s.genre === "appel");
    if (!b || b.genre !== "appel") throw new Error("appel");
    expect(b.bouton).toBe("Prendre rendez-vous");
  });

  it("alerte : le texte ne finit pas sur la conjonction", () => {
    const texte = "Un souci ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock et marge. Une alerte part toute seule quand un article passe sous le seuil, sans rien faire. Prenez rendez-vous.";
    const { plan } = composer(texte);
    const ecran = plan.scenes.find((s) => s.genre === "ecran");
    if (!ecran || ecran.genre !== "ecran") throw new Error("ecran");
    const alerte = ecran.evenements.find((ev) => ev.genre === "alerte");
    if (!alerte || alerte.genre !== "alerte") throw new Error("alerte");
    expect(alerte.texte).toBe("Une alerte part toute seule");
  });
});

describe("QUAL-2 — repère : l'écran est prolongé jusqu'à 600 ms avant « une minute »", () => {
  it("script du fondateur : l'écran finit ≥ 600 ms après « Vous », le repère démarre ≤ 600 ms avant « une minute »", () => {
    const mots = motsDe(FONDATEUR);
    const { plan } = composer(FONDATEUR, { phraseTitre: TITRE, fin: "rendez-vous" });
    const ecran = plan.scenes.find((s) => s.genre === "ecran");
    const repere = plan.scenes.find((s) => s.genre === "repere");
    if (!ecran || !repere || repere.genre !== "repere") throw new Error("scènes");
    const iVous = mots.findIndex((m, i) => /^vous$/i.test(m.texte) && /^d[ée]cidez$/i.test(mots[i + 1]?.texte ?? ""));
    expect(ecran.finMs - mots[iVous].debutMs).toBeGreaterThanOrEqual(600);
    expect(repere.debutMs).toBe(ecran.finMs);
    expect(repere.debutMs).toBeGreaterThanOrEqual(repere.apresAMs - 600);
    expect(repere.debutMs).toBeLessThanOrEqual(repere.apresAMs);
    expect(repere.apresAMs - repere.debutMs).toBeLessThanOrEqual(600);
  });

  describe("couverture des mots et repère non appel (fixer)", () => {
    const B = "Un souci de stock ? Voici un tableau de bord. En haut, trois chiffres : ventes, stock et marge. ";
    const SCRIPTS = [
      FONDATEUR,
      B + "Vous décidez en une minute au lieu d'une heure. Prenez rendez-vous.",
      B + "Une alerte part toute seule quand un article passe sous le seuil. Vous décidez en une minute au lieu d'une heure. Merci.",
      B + "Un clic sur un article ouvre son historique : entrées, sorties. Vous décidez en une minute au lieu d'une heure ! Bonne journée.",
    ];

    it("chaque mot non vide qui commence avant dureeMs appartient à exactement une scène (balayage tous les 100 ms)", () => {
      for (const txt of SCRIPTS) {
        const mots = motsDe(txt);
        const fin = mots[mots.length - 1].finMs;
        for (let d = 100; d <= fin + 1000; d += 100) {
          const { plan } = composer(txt, { dureeMs: d });
          mots.forEach((m, k) => {
            if (!m.texte.trim() || m.debutMs >= d) return;
            const n = plan.scenes.filter((s) => k >= s.mots.premier && k <= s.mots.dernier).length;
            expect(n, `mot ${k} « ${m.texte} » dureeMs ${d}`).toBe(1);
          });
        }
      }
    });

    it("fondateur, dureeMs 33900 à 34400 : « Vous décidez » est couvert", () => {
      const mots = motsDe(FONDATEUR);
      const k = mots.findIndex((m, i) => /^vous$/i.test(m.texte) && /^d[ée]cidez$/i.test(mots[i + 1]?.texte ?? ""));
      for (let d = 33900; d <= 34400; d += 100) {
        const { plan } = composer(FONDATEUR, { dureeMs: d });
        if (mots[k].debutMs < d) expect(plan.scenes.some((s) => k >= s.mots.premier && k <= s.mots.dernier)).toBe(true);
      }
    });

    it("« … en une minute au lieu d'une heure. Merci, restons en contact. » : le repère n'est pas la scène d'appel", () => {
      const txt = B + "Vous décidez en une minute au lieu d'une heure. Merci, restons en contact.";
      const { plan } = composer(txt);
      expect(plan.scenes.some((s) => s.genre === "repere")).toBe(true);
      expect(plan.scenes.some((s) => s.genre === "appel")).toBe(false);
      const txt2 = B + "Restons en contact, vous décidez en une minute au lieu d'une heure. Merci, restons en contact.";
      const r2 = composer(txt2).plan;
      expect(r2.scenes.some((s) => s.genre === "repere")).toBe(true);
      expect(r2.scenes.some((s) => s.genre === "appel")).toBe(false);
    });
  });
});
