/**
 * Lot L9 des carrousels : vague 1 des nouveaux gabarits (T22 mythe / réalité, T23 questions, T24 sans / avec, T26 cas concret, T27 checklist,
 * T28 schéma de flux). Contrats du registre, du schéma, de la porte, de la note et des sources de la composition ; le rendu réel est contrôlé
 * par `studio-rendu/scripts/essai-l9.ts` (Chrome Headless Shell de Remotion).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrasteWcag, CHARTE_CARROUSEL } from "@/briques/visuels/charte-carrousel";
import { ICONES, NOMS_ICONES, NOMS_ICONES_PAGE } from "@/briques/visuels/registre-illustrations";
import { CAPACITE_ANNOTATION, CAPACITE_CAS, CAPACITE_CHECKLIST, CAPACITE_COMPARAISON, CAPACITE_MYTHE, CAPACITE_NOEUD, capaciteQuestion, PAGES, TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { RUBRIQUES, TEXTES_FIXES_L9 } from "@/briques/visuels/textes-fixes";
import { noterCarrousel } from "@/domaine/controles-visuel/note";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { textesDe } from "@/domaine/controles-visuel/textes-de";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { FIXTURES_AXION } from "@/visuels/texte/fixtures";
import { NOMS_LUCIDE } from "../../studio-rendu/compositions/visuels/icones/lucide";
import { compterChevauchements, dessinsSurveilles, partVide, VIDE_MAX } from "../../studio-rendu/compositions/visuels/commun/zones";
import { PART_ENCRE_GRIS } from "../../studio-rendu/compositions/visuels/commun/constantes";

const NOUVEAUX = ["T22", "T23", "T24", "T26", "T27", "T28"] as const;
const RACINE = new URL("../../studio-rendu/compositions/visuels/", import.meta.url);
const lire = (f: string) => readFileSync(new URL(f, RACINE), "utf8");

const couv = { type: "T01", titre: "Une couverture" };
const fin = { type: "T21" };
const spec = (...pages: object[]) => ({ version: "carrousel/1", alt: "Un carrousel d'essai", pages: [couv, ...pages, fin] });
const valide = (page: object) => CarrouselSpec.safeParse(spec(page)).success;
/** Copie de `page` sans le champ `cle`. */
const sansChamp = (page: Record<string, unknown>, cle: string) => Object.fromEntries(Object.entries(page).filter(([k]) => k !== cle));

/** Une page valide de chaque nouveau type (contenu moyen, sans chiffre). */
const EXEMPLES: Record<(typeof NOUVEAUX)[number], Record<string, unknown>> = {
  T22: { type: "T22", titre: "Une idée reçue", mythe: "L'IA, c'est réservé aux grandes entreprises.", realite: "Une petite équipe s'y met sur une tâche précise." },
  T23: { type: "T23", titre: "Avant de choisir", questions: [{ question: "Quelle tâche revient ?", aide: "Celle qu'on refait chaque semaine.", icone: "horloge" }, { question: "Qui veut essayer ?", aide: "Une personne curieuse suffit." }], annotation: "Une réponse claire suffit." },
  T24: { type: "T24", titre: "Le suivi", lignes: [{ sans: "Messages éparpillés", avec: "Une seule file" }, { sans: "Relances oubliées", avec: "Rappel au bon moment" }, { sans: "Réponses à refaire", avec: "Brouillons prêts" }] },
  T26: { type: "T26", titre: "Un cabinet de conseil", avant: ["Chaque devis repart de zéro", "Les relances se font de mémoire"], avec: ["Un modèle de devis prérempli", "Un suivi qui relance"], outils: ["Tableur partagé"], vous: "plus de temps pour vos clients" },
  T27: { type: "T27", titre: "Prêt à démarrer ?", lignes: [{ texte: "Une tâche revient souvent" }, { texte: "Les informations sont dispersées" }, { texte: "Quelqu'un veut essayer" }, { texte: "Vous savez ce qui coûte du temps" }] },
  T28: { type: "T28", titre: "Le trajet d'une demande", noeuds: [{ texte: "La demande arrive", icone: "courrier" }, { texte: "Elle est triée" }, { texte: "Vous validez" }] },
};

describe("L9 : registre des pages", () => {
  it("ajoute T22, T23, T24, T26, T27, T28 ; T25 et T29 restent réservés ; les pages existantes ne changent pas", () => {
    for (const t of NOUVEAUX) expect(TYPES_PAGE).toContain(t);
    expect(TYPES_PAGE).not.toContain("T25");
    expect(TYPES_PAGE).not.toContain("T29");
    expect(TYPES_PAGE.slice(0, 9)).toEqual(["T01", "T01B", "T01C", "T02", "T06", "T08", "T10", "T20", "T21"]);
  });
  it("chaque type a une famille visuelle, une rubrique posée par le code et un titre de 30 signes au plus", () => {
    for (const t of TYPES_PAGE) expect(PAGES[t].famille, t).toBeTruthy();
    for (const t of NOUVEAUX) {
      expect(RUBRIQUES[t], t).toBe(RUBRIQUES[t].toLocaleUpperCase("fr-FR"));
      expect(PAGES[t].titreMax, t).toBe(30);
      expect(PAGES[t].cartesMax, t).toBe(0);
    }
    expect(PAGES.T22.famille).toBe(PAGES.T08.famille);
    expect(PAGES.T24.famille).toBe(PAGES.T08.famille);
    expect(PAGES.T23.famille).toBe(PAGES.T06.famille);
    expect(PAGES.T27.famille).toBe(PAGES.T06.famille);
    expect(PAGES.T28.famille).toBe(PAGES.T20.famille);
    expect(PAGES.T26.famille).toBe("cas");
  });
  it("bornes des éléments : questions 2 à 4, comparaison 3 à 5, cas 2 + 2, checklist 4 à 5, flux 3 à 5", () => {
    expect(PAGES.T23.elements).toEqual({ min: 2, max: 4 });
    expect(PAGES.T24.elements).toEqual({ min: 3, max: 5 });
    expect(PAGES.T26.elements).toEqual({ min: 2, max: 2 });
    expect(PAGES.T27.elements).toEqual({ min: 4, max: 5 });
    expect(PAGES.T28.elements).toEqual({ min: 3, max: 5 });
  });
  it("les noms d'icônes du registre sont exactement ceux de la banque Lucide (liste fermée)", () => {
    expect([...NOMS_ICONES].sort()).toEqual([...NOMS_LUCIDE].sort());
    expect([...NOMS_ICONES].sort()).toEqual(ICONES.map((i) => i.nom).sort());
  });
  it("une page choisit toutes les icônes sauf « lien » (SEC-01 : aucun mot de lien dans le schéma)", () => {
    expect([...NOMS_ICONES_PAGE].sort()).toEqual(NOMS_ICONES.filter((n) => n !== "lien").sort());
  });
});

describe("L9 : schéma", () => {
  it.each(NOUVEAUX)("%s : un contenu moyen est accepté", (t) => {
    expect(CarrouselSpec.safeParse(spec(EXEMPLES[t])).error?.issues ?? []).toEqual([]);
  });
  it.each(NOUVEAUX)("%s : clé inconnue et lien refusés", (t) => {
    expect(valide({ ...EXEMPLES[t], couleur: "orange" })).toBe(false);
    expect(valide({ ...EXEMPLES[t], titre: "Voir www.exemple.fr" })).toBe(false);
  });
  it("T22 : mythe et réalité bornés par leur budget", () => {
    expect(valide({ ...EXEMPLES.T22, mythe: "x".repeat(CAPACITE_MYTHE.mythe) })).toBe(true);
    expect(valide({ ...EXEMPLES.T22, mythe: "x".repeat(CAPACITE_MYTHE.mythe + 1) })).toBe(false);
    expect(valide({ ...EXEMPLES.T22, realite: "x".repeat(CAPACITE_MYTHE.realite + 1) })).toBe(false);
  });
  it("T23 : 2 à 4 questions, budgets selon le nombre, annotation obligatoire et bornée, icône de la liste fermée", () => {
    const q = (n: number, longueur = 10) => Array.from({ length: n }, () => ({ question: "q".repeat(longueur), aide: "Une aide." }));
    expect(valide({ ...EXEMPLES.T23, questions: q(1) })).toBe(false);
    expect(valide({ ...EXEMPLES.T23, questions: q(5) })).toBe(false);
    for (const n of [2, 3, 4]) {
      expect(valide({ ...EXEMPLES.T23, questions: q(n, capaciteQuestion(n).question) }), `${n}`).toBe(true);
      expect(valide({ ...EXEMPLES.T23, questions: q(n, capaciteQuestion(n).question + 1) }), `${n}`).toBe(false);
    }
    expect(valide(sansChamp(EXEMPLES.T23, "annotation"))).toBe(false);
    expect(valide({ ...EXEMPLES.T23, annotation: "x".repeat(CAPACITE_ANNOTATION + 1) })).toBe(false);
    expect(valide({ ...EXEMPLES.T23, questions: [{ question: "Une ?", aide: "Aide.", icone: "licorne" }, { question: "Deux ?", aide: "Aide." }] })).toBe(false);
  });
  it("T24 : 3 à 5 lignes, chaque case bornée", () => {
    const l = (n: number, longueur = 8) => Array.from({ length: n }, () => ({ sans: "s".repeat(longueur), avec: "a".repeat(longueur) }));
    expect(valide({ ...EXEMPLES.T24, lignes: l(2) })).toBe(false);
    expect(valide({ ...EXEMPLES.T24, lignes: l(6) })).toBe(false);
    expect(valide({ ...EXEMPLES.T24, lignes: l(5, CAPACITE_COMPARAISON.case) })).toBe(true);
    expect(valide({ ...EXEMPLES.T24, lignes: l(5, CAPACITE_COMPARAISON.case + 1) })).toBe(false);
  });
  it("T26 : exactement 2 lignes avant et 2 avec, outils en texte (3 au plus), bandeau « vous » borné", () => {
    expect(valide({ ...EXEMPLES.T26, avant: ["Une seule ligne"] })).toBe(false);
    expect(valide({ ...EXEMPLES.T26, avec: ["a", "b", "c"] })).toBe(false);
    expect(valide({ ...EXEMPLES.T26, avant: ["x".repeat(CAPACITE_CAS.ligne + 1), "ok"] })).toBe(false);
    expect(valide({ ...EXEMPLES.T26, outils: ["a", "b", "c", "d"] })).toBe(false);
    expect(valide({ ...EXEMPLES.T26, outils: ["x".repeat(CAPACITE_CAS.outil + 1)] })).toBe(false);
    expect(valide({ ...EXEMPLES.T26, vous: "x".repeat(CAPACITE_CAS.vous + 1) })).toBe(false);
    expect(valide(sansChamp(EXEMPLES.T26, "outils"))).toBe(true);
  });
  it("T27 : 4 à 5 lignes bornées ; T28 : 3 à 5 nœuds bornés", () => {
    const l = (n: number, longueur = 10) => Array.from({ length: n }, () => ({ texte: "x".repeat(longueur) }));
    expect(valide({ ...EXEMPLES.T27, lignes: l(3) })).toBe(false);
    expect(valide({ ...EXEMPLES.T27, lignes: l(6) })).toBe(false);
    expect(valide({ ...EXEMPLES.T27, lignes: l(5, CAPACITE_CHECKLIST.ligne) })).toBe(true);
    expect(valide({ ...EXEMPLES.T27, lignes: l(5, CAPACITE_CHECKLIST.ligne + 1) })).toBe(false);
    expect(valide({ ...EXEMPLES.T28, noeuds: l(2) })).toBe(false);
    expect(valide({ ...EXEMPLES.T28, noeuds: l(6) })).toBe(false);
    expect(valide({ ...EXEMPLES.T28, noeuds: l(5, CAPACITE_NOEUD.texte) })).toBe(true);
    expect(valide({ ...EXEMPLES.T28, noeuds: l(5, CAPACITE_NOEUD.texte + 1) })).toBe(false);
  });
});

describe("L9 : porte qualité", () => {
  const ctx = { faitsDisponibles: false, interditsDans: () => [] };
  const codes = (page: object) => controlerCarrousel(spec(page), ctx).rapport.controles.map((c) => c.code);
  it("les mots interdits sont bloqués dans les nouveaux champs", () => {
    expect(codes({ ...EXEMPLES.T22, mythe: "On ne forme qu'à Grenoble." })).toContain("EXPRESSION_BANNIE");
    expect(codes({ ...EXEMPLES.T26, vous: "aucun gain garanti" })).toContain("EXPRESSION_BANNIE");
    expect(codes({ ...EXEMPLES.T23, annotation: "J'aide les équipes." })).toContain("J_AIDE");
  });
  it("aucun chiffre factuel, même dans une ligne de checklist ou un nœud", () => {
    expect(codes({ ...EXEMPLES.T27, lignes: [...(EXEMPLES.T27.lignes as object[]).slice(0, 3), { texte: "Vous gagnez trois heures" }] })).toContain("CHIFFRE");
    expect(codes({ ...EXEMPLES.T28, noeuds: [{ texte: "Étape 2" }, { texte: "Suite" }, { texte: "Fin" }] })).toContain("CHIFFRE");
  });
  it("T24 : un mot de plus de 15 lettres dans une case est refusé (il ne tiendrait pas seul dans la case)", () => {
    const lignes = (mot: string) => [{ sans: mot, avec: "Une seule file" }, ...(EXEMPLES.T24.lignes as object[]).slice(1)];
    expect(codes({ ...EXEMPLES.T24, lignes: lignes("anticonstitutionnel") })).toContain("MOT_TROP_LONG");
    expect(codes({ ...EXEMPLES.T24, lignes: lignes("automatiquement") })).not.toContain("MOT_TROP_LONG");
  });
  it("le nom d'une icône n'est pas un texte lu (« telephone », « question » ne sont pas contrôlés)", () => {
    expect(textesDe(spec(EXEMPLES.T28)).some((t) => t.chemin.endsWith("icone"))).toBe(false);
  });
  it("un cas concret T26 compte dans la série des « Scénario type » (3 au plus)", () => {
    const quatre = { version: "carrousel/1", alt: "Une série de cas", pages: [couv, EXEMPLES.T26, EXEMPLES.T22, { ...EXEMPLES.T26, titre: "Un autre cas" }, EXEMPLES.T24, { ...EXEMPLES.T26, titre: "Un troisième cas" }, EXEMPLES.T27, { ...EXEMPLES.T26, titre: "Un dernier cas" }, fin] };
    expect(controlerCarrousel(quatre, ctx).rapport.controles.map((c) => c.code)).toContain("SERIE");
  });
});

describe("L9 : note sur 100 (règle de variété par famille)", () => {
  const diversite = (pages: object[]) => noterCarrousel({ version: "carrousel/1", alt: "Un carrousel", pages: [couv, ...pages, fin] }).criteres.find((c) => c.id === 7)!;
  it("deux pages de même famille à la suite sont signalées (T08 puis T22, T06 puis T27, T20 puis T28)", () => {
    const t08 = { type: "T08", titre: "Avant, après", avant: "Avant.", apres: "Après." };
    const t06 = { type: "T06", titre: "Une liste", points: [{ texte: "Un point" }, { texte: "Un autre" }, { texte: "Le dernier" }] };
    const t20 = { type: "T20", titre: "Des étapes", etapes: [{ titre: "Ouvrir", corps: "On ouvre." }, { titre: "Lire", corps: "On lit." }, { titre: "Fermer", corps: "On ferme." }] };
    expect(diversite([t08, EXEMPLES.T22]).raison).toMatch(/même famille de mise en page à la suite/);
    expect(diversite([t06, EXEMPLES.T27]).raison).toMatch(/même famille de mise en page à la suite/);
    expect(diversite([t20, EXEMPLES.T28]).raison).toMatch(/même famille de mise en page à la suite/);
    expect(diversite([EXEMPLES.T22, EXEMPLES.T23, EXEMPLES.T26, EXEMPLES.T28]).raison).not.toMatch(/même famille de mise en page à la suite/);
  });
  it("un T26 n'est pas une faute « cas concret sans Scénario type » : l'étiquette est posée par le code", () => {
    const r = noterCarrousel(spec({ ...EXEMPLES.T26, titre: "Un cas concret" }));
    expect(r.criteres[0].raison).not.toMatch(/Scénario type/);
  });
});

describe("L9 : textes posés par le code", () => {
  it("étiquette du cas concret, en-têtes et jauge : sans chiffre, sans lien, sans promesse", () => {
    expect(TEXTES_FIXES_L9.t26Etiquette).toBe("Scénario type · exemple illustratif");
    for (const t of Object.values(TEXTES_FIXES_L9)) {
      expect(t).not.toMatch(/\d|https?:|www\.|@|garanti/i);
      expect(CarrouselSpec.safeParse({ version: "carrousel/1", alt: t, pages: [couv, fin] }).success, t).toBe(true);
    }
  });
  it("T26 pose l'étiquette « Scénario type » par le code ; aucun champ du spec ne la porte", () => {
    expect(lire("pages/T26.tsx")).toContain("TEXTES_FIXES_L9.t26Etiquette");
    expect(Object.keys(EXEMPLES.T26)).not.toContain("etiquette");
  });
});

describe("L9 : consigne de session et fixtures de simulation", () => {
  const consigne = readFileSync(new URL("../../scripts/visuels/consigne-session-carrousel.md", import.meta.url), "utf8");
  const ligne = (t: string) => consigne.split("\n").find((l) => l.startsWith(`| ${t} |`)) ?? "";
  it("la consigne donne chaque nouveau type avec ses budgets du registre, et quand le choisir", () => {
    expect(ligne("T22")).toContain(`mythe ${CAPACITE_MYTHE.mythe}, réalité ${CAPACITE_MYTHE.realite}`);
    for (const n of [2, 3, 4]) expect(ligne("T23")).toContain(`${n} questions ${capaciteQuestion(n).question} / ${capaciteQuestion(n).aide}`);
    expect(ligne("T23")).toContain(`annotation ${CAPACITE_ANNOTATION}`);
    expect(ligne("T24")).toContain(`chaque case ${CAPACITE_COMPARAISON.case}, aucun mot de plus de ${CAPACITE_COMPARAISON.mot} signes`);
    expect(ligne("T26")).toContain(`chaque ligne ${CAPACITE_CAS.ligne}, chaque outil ${CAPACITE_CAS.outil}, vous ${CAPACITE_CAS.vous}`);
    expect(ligne("T27")).toContain(`chaque ligne ${CAPACITE_CHECKLIST.ligne}`);
    expect(ligne("T28")).toContain(`chaque nœud ${CAPACITE_NOEUD.texte}`);
    for (const t of NOUVEAUX) expect(consigne, t).toMatch(new RegExp(`\\*\\*${t} `));
    expect(consigne).toMatch(/n'est choisi que si le CONTENU a déjà cette forme/);
  });
  it("les modèles Axion de la simulation emploient les nouveaux types et passent la porte sans faute rouge", () => {
    const types = new Set(FIXTURES_AXION.flatMap((f) => f.spec.pages.map((p) => p.type)));
    for (const t of ["T22", "T23", "T26", "T27"]) expect(types, t).toContain(t);
    for (const f of FIXTURES_AXION) {
      const r = controlerCarrousel(f.spec, { faitsDisponibles: false, interditsDans: () => [] }).rapport;
      expect(r.controles.filter((c) => c.niveau === "rouge"), f.id).toEqual([]);
    }
  });
});

describe("L9 : sources de la composition", () => {
  it.each(NOUVEAUX)("%s : composant présent, branché dans VisuelPage, rubrique par PageBase, texte borné à x = 912", (t) => {
    const src = lire(`pages/${t}.tsx`);
    expect(lire("VisuelPage.tsx")).toContain(`case "${t}":`);
    expect(src).toContain(`type="${t}"`);
    // Colonnes bornées par `largeurTexteMax` ou par la géométrie pure des colonnes (`geometrie.ts`, tests `bords-droits`).
    expect(src).toMatch(/largeurTexteMax\(|largeurColonne\(/);
    expect(src).not.toMatch(/from "@\//);
    expect(src).not.toMatch(/from "zod"|server-only/);
    expect(src).not.toMatch(/from "[^"]+\.js"/);
  });
  it.each(NOUVEAUX)("%s : un élément visuel de la banque ou dessiné qui a du sens, jamais de photo ni d'image externe", (t) => {
    const src = lire(`pages/${t}.tsx`);
    expect(src).toMatch(/<Picto|<Scene|<Interrupteur|<CaseACocher|<Cadran/);
    expect(src).not.toMatch(/<img|<Img|staticFile|https?:/);
  });
  it.each(NOUVEAUX)("%s : aucun corps de texte écrit sous 26 px", (t) => {
    for (const m of lire(`pages/${t}.tsx`).matchAll(/fontSize: (\d+)/g)) expect(Number(m[1]), t).toBeGreaterThanOrEqual(26);
  });
  it("Kalam sert aux annotations, à l'encre, jamais sous 30 px", () => {
    expect(lire("commun/constantes.ts")).toMatch(/TAILLE_MANUSCRITE = (3\d|[4-9]\d)/);
    for (const f of ["pages/T22.tsx", "pages/T23.tsx"]) {
      const src = lire(f);
      expect(src).toContain("POLICE_MANUSCRITE");
      expect(src).toContain("chargerPoliceKalam()");
    }
  });
  it("le gris du « froid » est un mélange encre / blanc de la charte (jamais de bleu), lisible sur le blanc de carte", () => {
    const { encre, blanc } = CHARTE_CARROUSEL.couleurs;
    const melange = (a: string, b: string, part: number) =>
      `#${[1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) * part + parseInt(b.slice(i, i + 2), 16) * (100 - part)) / 100).toString(16).padStart(2, "0")).join("")}`;
    expect(contrasteWcag(melange(encre, blanc, PART_ENCRE_GRIS), blanc)).toBeGreaterThanOrEqual(4.5);
    for (const t of NOUVEAUX) expect(lire(`pages/${t}.tsx`)).not.toMatch(/bleu|blue/i);
  });
});

describe("L9 : contrôle automatique des chevauchements (mesure du rendu)", () => {
  const b = (gauche: number, haut: number, droite: number, bas: number) => ({ gauche, haut, droite, bas });
  it("deux lignes de deux textes différents l'une sur l'autre : un chevauchement", () => {
    expect(compterChevauchements([{ boite: b(100, 100, 400, 140), groupe: 1 }, { boite: b(300, 110, 600, 150), groupe: 2 }], [])).toBe(1);
  });
  it("deux lignes d'un même texte, ou deux textes qui se touchent : aucun", () => {
    expect(compterChevauchements([{ boite: b(100, 100, 400, 140), groupe: 1 }, { boite: b(100, 130, 400, 170), groupe: 1 }], [])).toBe(0);
    expect(compterChevauchements([{ boite: b(100, 100, 400, 140), groupe: 1 }, { boite: b(400, 100, 600, 140), groupe: 2 }], [])).toBe(0);
  });
  it("lignes de titre serrées (interligne 1,02 au grand corps) : la boîte déborde, le cœur des lettres non", () => {
    expect(compterChevauchements([{ boite: b(48, 100, 1000, 306), groupe: 1 }, { boite: b(48, 273, 1000, 479), groupe: 2 }], [])).toBe(0);
  });
  it("un texte posé sur une illustration ou une icône : un chevauchement", () => {
    expect(compterChevauchements([{ boite: b(100, 100, 400, 140), groupe: 1 }], [b(350, 90, 450, 190)])).toBe(1);
    expect(compterChevauchements([{ boite: b(100, 100, 400, 140), groupe: 1 }], [b(420, 90, 520, 190)])).toBe(0);
  });
  it("la mesure du rendu publie `chevauchements` et marque les dessins de la banque", () => {
    expect(lire("mesure/MesureVisuelPage.tsx")).toContain("compterChevauchements(");
    expect(lire("mesure/MesureVisuelPage.tsx")).toMatch(/chevauchements, vide[,} ]/);
    expect(lire("commun/Picto.tsx")).toContain("ATTRIBUT_DESSIN");
  });
});

describe("L9 : dessins faits sur place surveillés comme obstacles (tour 2)", () => {
  const b = (gauche: number, haut: number, droite: number, bas: number) => ({ gauche, haut, droite, bas });
  const texte = [{ boite: b(100, 100, 400, 140), groupe: 1 }];
  const svg = (boite: ReturnType<typeof b>, autres: Partial<Parameters<typeof dessinsSurveilles>[0][number]> = {}) => ({ boite, marque: false, svg: true, dansMarque: false, avecTexte: false, ...autres });
  it("un SVG NON marqué posé sous un texte compte comme un chevauchement", () => {
    expect(compterChevauchements(texte, dessinsSurveilles([svg(b(300, 80, 500, 180))]))).toBeGreaterThan(0);
  });
  it("le SVG d'une enveloppe marquée n'est compté qu'une fois ; un SVG qui porte son propre texte (pastille W01) n'est pas un obstacle", () => {
    const boite = b(300, 80, 500, 180);
    expect(dessinsSurveilles([{ boite, marque: true, svg: false, dansMarque: false, avecTexte: false }, svg(boite, { dansMarque: true })])).toHaveLength(1);
    expect(dessinsSurveilles([svg(boite, { avecTexte: true })])).toHaveLength(0);
  });
  it("la mesure relève tous les <svg> de la page, pas seulement les dessins marqués", () => {
    const src = lire("commun/occupation.ts");
    expect(src).toMatch(/\[\$\{ATTRIBUT_DESSIN\}\], svg/);
    expect(src).toContain("dessinsSurveilles(");
    expect(lire("mesure/MesureVisuelPage.tsx")).toContain("dessinsDe(");
  });
  it.each(NOUVEAUX)("%s : chaque dessin fait sur place (<svg>) est posé dans l'enveloppe commune `Dessin` (marquée)", (t) => {
    const src = lire(`pages/${t}.tsx`);
    const composants = [...src.matchAll(/function (\w+)\([^)]*\)[^{]*\{(?:(?!\nfunction )[\s\S])*?<svg/g)].map((m) => m[1]);
    for (const c of composants) {
      const usages = [...src.matchAll(new RegExp(`<${c}[\\s/>]`, "g"))].length;
      const enveloppes = [...src.matchAll(new RegExp(`<Dessin[^>]*>\\s*<${c}[\\s/>]`, "g"))].length;
      expect(usages, `${t} : ${c}`).toBeGreaterThan(0);
      expect(enveloppes, `${t} : ${c} hors de <Dessin>`).toBe(usages);
    }
    expect(lire("commun/Picto.tsx")).toMatch(/export function Dessin\(/);
  });
});

describe("L9 : mesure du VIDE (part du corps de page sans texte ni dessin, tour 2)", () => {
  const b = (haut: number, bas: number) => ({ gauche: 0, haut, droite: 900, bas });
  it("corps vide : 100 % ; corps couvert : 0 % ; le vide est la part non couverte (respiration comprise)", () => {
    expect(partVide({ haut: 0, bas: 1000 }, [], 0)).toBe(1);
    expect(partVide({ haut: 0, bas: 1000 }, [b(0, 1000)], 0)).toBe(0);
    expect(partVide({ haut: 0, bas: 1000 }, [b(100, 300), b(200, 400)], 0)).toBe(0.7);
    expect(partVide({ haut: 0, bas: 1000 }, [b(100, 300)], 50)).toBe(0.7);
    // Une boîte hors du corps ne compte pas.
    expect(partVide({ haut: 0, bas: 1000 }, [b(1100, 1200)], 0)).toBe(1);
  });
  it("seuil : 25 % au plus", () => expect(VIDE_MAX).toBe(0.25));
  it("la mesure publie `vide` sur le corps de page marqué par PageBase, les deux essais réels l'exigent ≤ VIDE_MAX", () => {
    expect(lire("mesure/MesureVisuelPage.tsx")).toContain("partVide(");
    expect(lire("commun/PageBase.tsx")).toMatch(/<Zone[^>]*\bcorps\b/);
    const essai = readFileSync(new URL("../../studio-rendu/scripts/essai-l9.ts", import.meta.url), "utf8");
    const capacites = readFileSync(new URL("../../studio-rendu/scripts/essai-capacites-max.ts", import.meta.url), "utf8");
    for (const src of [essai, capacites]) expect(src).toMatch(/m\.vide <= VIDE_MAX/);
  });
});

describe("L9 : retours visuels du tour 2", () => {
  it("T27 : cases à cocher NEUTRES (aucune coche, aucun orange « oui ») et jauge « peu → beaucoup » sans aiguille figée", () => {
    const src = lire("pages/T27.tsx");
    const interrupteur = src.slice(src.indexOf("function CaseACocher"), src.indexOf("function Jauge"));
    expect(interrupteur.length).toBeGreaterThan(0);
    expect(interrupteur).not.toContain("COULEURS.orange");
    expect(interrupteur).not.toMatch(/<path/);
    expect(src).toContain("linearGradient");
    expect(src).not.toMatch(/aiguille|function Cadran/i);
  });
  it("T22 : le mythe reste lisible (barré fin, pas un trait de 6 px au milieu des lettres)", () => {
    const src = lire("pages/T22.tsx");
    expect(src).not.toMatch(/textDecorationThickness:\s*6/);
  });
  it("T23 : plus de flèche d'annotation qui ne désigne rien", () => {
    expect(lire("pages/T23.tsx")).not.toContain("FlecheManuscrite");
  });
});

describe("L9 : ordre de mise en ligne (tour 2)", () => {
  it("la consigne dit : studio-rendu d'abord, vérifier `chevauchements`, puis le studio ; l'ordre inverse échoue, voulu et réessayable", () => {
    const consigne = readFileSync(new URL("../../scripts/visuels/consigne-session-carrousel.md", import.meta.url), "utf8");
    const section = consigne.slice(consigne.indexOf("## Mise en ligne des types T22 à T28"));
    expect(section).toMatch(/studio-rendu D'ABORD/);
    expect(section).toContain("`chevauchements`");
    expect(section.indexOf("studio-rendu D'ABORD")).toBeLessThan(section.indexOf("**Puis le studio**"));
    expect(section).toMatch(/VOULU/);
    expect(section).toMatch(/RÉESSAYABLE/);
    expect(section).toMatch(/ancien\s+studio-rendu échoue/);
  });
});
