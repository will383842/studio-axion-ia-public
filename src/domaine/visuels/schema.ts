import { z } from "zod";
import { LIMITES } from "../../briques/visuels/limites";
import { CAPACITE_ANNOTATION, CAPACITE_CAS, CAPACITE_CHECKLIST, CAPACITE_CITATION, CAPACITE_COMPARAISON, CAPACITE_MYTHE, CAPACITE_NOEUD, CAPACITE_PANNEAU, capaciteCarte, capaciteEtape, capaciteListe, capaciteQuestion, PAGES, TYPES_COUVERTURE, TYPES_PAGE } from "../../briques/visuels/registre-pages";
import { NOMS_ICONES_PAGE } from "../../briques/visuels/registre-illustrations";
import { TYPES_MINI } from "../../briques/visuels/registre-mini";
import { TYPES_DECOR } from "../../briques/visuels/registre-decor";
import { chargerReglesCarrousel } from "../../briques/visuels/regles/charger-regles";
import { placeSombrePermise, TYPES_SOMBRES } from "./familles-pages";

const REGLES = chargerReglesCarrousel();

// SEC-01 : aucun champ URL ni couleur ; objets stricts (clé inconnue refusée) ; énumérations ; longueurs bornées.
// Refusés : schémas (http, mailto, file, ftp, blob, vbscript, javascript, data), « www. », « // », tout domaine nu
// (y compris axion-ia.com : l'unique domaine nu autorisé par page viendra avec la règle QV-121), caractères de
// contrôle (hors \n) et invisibles (U+200B-200F, U+2028-202E, U+2060, U+FEFF).
const SANS_LIEN = new RegExp(
  "^(?![\\s\\S]*(?:" +
    "(?<![a-z0-9])(?:https?|mailto|file|ftp|blob|vbscript|javascript|data)\\s*:" +
    "|www\\.|\\/\\/" +
    "|[\\p{L}\\p{N}][\\p{L}\\p{N}-]*(?:\\.[\\p{L}\\p{N}-]+)*\\.\\p{L}{2,}(?![\\p{L}\\p{N}])" +
    "|[\\u0000-\\u0009\\u000B-\\u001F\\u200B-\\u200F\\u2028-\\u202E\\u2060\\uFEFF]" +
    "))",
  "iu",
);

const texte = (min: number, max: number) =>
  z.string().trim().min(min).max(max).regex(SANS_LIEN, "Aucun lien n'est permis dans un texte");

/** Texte sans lien (SEC-01), réutilisé par la lecture des paquets de session. */
export const texteSansLien = texte;

const Carte = z
  .object({
    titre: texte(1, LIMITES.titreMax),
    corps: texte(1, LIMITES.corpsMax),
    mini: z.enum(TYPES_MINI).optional(),
  })
  .strict();

/** Titre de page : borné par le type (budget mesuré au rendu), jamais au-delà du plafond général. */
const titrePage = (type: keyof typeof PAGES) => texte(1, Math.min(PAGES[type].titreMax, LIMITES.titreMax));

const Deco = z.enum(TYPES_DECOR);

const PageT01 = z
  .object({
    type: z.literal("T01"),
    titre: titrePage("T01"),
    sousTitre: texte(1, LIMITES.sousTitreMax).optional(),
  })
  .strict();

// Variantes B et C : même schéma que T01, plus un élément décoratif facultatif (sans texte) choisi dans le registre.
const PageT01B = PageT01.extend({ type: z.literal("T01B"), titre: titrePage("T01B"), deco: Deco.optional() });
const PageT01C = PageT01.extend({ type: z.literal("T01C"), titre: titrePage("T01C"), deco: Deco.optional() });

/** Signale chaque chaîne plus longue que son budget : le texte ne doit pas être coupé au rendu. */
function verifierBudget(ctx: z.RefinementCtx, chemin: (string | number)[], valeur: string, max: number, libelle: string): void {
  if (valeur.length > max) ctx.addIssue({ code: "custom", path: chemin, message: `${libelle} trop long (${max} signes au plus)` });
}

const PageT02 = z
  .object({
    type: z.literal("T02"),
    titre: titrePage("T02"),
    cartes: z.array(Carte).min(REGLES.cartes.min).max(PAGES.T02.cartesMax),
  })
  .strict()
  .superRefine((page, ctx) => {
    // Le texte d'une carte ne doit pas être coupé au rendu : budget mesuré selon le nombre de cartes de la page.
    const capacite = capaciteCarte(page.cartes.length);
    page.cartes.forEach((carte, i) => {
      verifierBudget(ctx, ["cartes", i, "titre"], carte.titre, capacite.titre, `Titre de carte (pour ${page.cartes.length} cartes)`);
      verifierBudget(ctx, ["cartes", i, "corps"], carte.corps, capacite.corps, `Texte de carte (pour ${page.cartes.length} cartes)`);
    });
  });

const PageT06 = z
  .object({
    type: z.literal("T06"),
    titre: titrePage("T06"),
    points: z.array(z.object({ texte: texte(1, LIMITES.corpsMax) }).strict()).min(PAGES.T06.elements.min).max(PAGES.T06.elements.max),
  })
  .strict()
  .superRefine((page, ctx) => {
    const { texte: max } = capaciteListe(page.points.length);
    page.points.forEach((p, i) => verifierBudget(ctx, ["points", i, "texte"], p.texte, max, `Point de liste (pour ${page.points.length} points)`));
  });

const PageT08 = z
  .object({
    type: z.literal("T08"),
    titre: titrePage("T08"),
    avant: texte(1, LIMITES.corpsMax),
    apres: texte(1, LIMITES.corpsMax),
  })
  .strict()
  .superRefine((page, ctx) => {
    verifierBudget(ctx, ["avant"], page.avant, CAPACITE_PANNEAU.texte, "Texte « avant »");
    verifierBudget(ctx, ["apres"], page.apres, CAPACITE_PANNEAU.texte, "Texte « après »");
  });

const PageT10 = z
  .object({
    type: z.literal("T10"),
    message: texte(1, CAPACITE_CITATION.message),
    legende: texte(1, CAPACITE_CITATION.legende).optional(),
    deco: Deco.optional(),
  })
  .strict();

const PageT20 = z
  .object({
    type: z.literal("T20"),
    titre: titrePage("T20"),
    etapes: z.array(Carte.omit({ mini: true })).min(PAGES.T20.elements.min).max(PAGES.T20.elements.max),
  })
  .strict()
  .superRefine((page, ctx) => {
    const capacite = capaciteEtape(page.etapes.length);
    page.etapes.forEach((e, i) => {
      verifierBudget(ctx, ["etapes", i, "titre"], e.titre, capacite.titre, `Titre d'étape (pour ${page.etapes.length} étapes)`);
      verifierBudget(ctx, ["etapes", i, "corps"], e.corps, capacite.corps, `Texte d'étape (pour ${page.etapes.length} étapes)`);
    });
  });

// Dernière page sombre : AUCUN champ, tout le texte est posé par le code (`textes-fixes.ts`) : ni lien, ni nom, ni mot-clé d'appel.
const PageT21 = z.object({ type: z.literal("T21") }).strict();

// --- Vague 1 des nouveaux gabarits (L9) : chaque texte est borné par son budget MESURÉ au rendu ; les étiquettes sont posées par le code. ---

/** Icône de la banque (liste fermée) : le contenu CHOISIT un nom, il n'apporte jamais de dessin. */
const Icone = z.enum(NOMS_ICONES_PAGE);

const PageT22 = z
  .object({
    type: z.literal("T22"),
    titre: titrePage("T22"),
    mythe: texte(1, CAPACITE_MYTHE.mythe),
    realite: texte(1, CAPACITE_MYTHE.realite),
  })
  .strict();

const PageT23 = z
  .object({
    type: z.literal("T23"),
    titre: titrePage("T23"),
    questions: z
      .array(z.object({ question: texte(1, LIMITES.corpsMax), aide: texte(1, LIMITES.corpsMax), icone: Icone.optional() }).strict())
      .min(PAGES.T23.elements.min)
      .max(PAGES.T23.elements.max),
    annotation: texte(1, CAPACITE_ANNOTATION),
  })
  .strict()
  .superRefine((page, ctx) => {
    const capacite = capaciteQuestion(page.questions.length);
    page.questions.forEach((q, i) => {
      verifierBudget(ctx, ["questions", i, "question"], q.question, capacite.question, `Question (pour ${page.questions.length} questions)`);
      verifierBudget(ctx, ["questions", i, "aide"], q.aide, capacite.aide, `Aide (pour ${page.questions.length} questions)`);
    });
  });

const PageT24 = z
  .object({
    type: z.literal("T24"),
    titre: titrePage("T24"),
    lignes: z
      .array(z.object({ sans: texte(1, CAPACITE_COMPARAISON.case), avec: texte(1, CAPACITE_COMPARAISON.case) }).strict())
      .min(PAGES.T24.elements.min)
      .max(PAGES.T24.elements.max),
  })
  .strict();

const ligneCas = texte(1, CAPACITE_CAS.ligne);
const PageT26 = z
  .object({
    type: z.literal("T26"),
    titre: titrePage("T26"),
    avant: z.array(ligneCas).min(PAGES.T26.elements.min).max(PAGES.T26.elements.max),
    avec: z.array(ligneCas).min(PAGES.T26.elements.min).max(PAGES.T26.elements.max),
    /** Noms d'outils en pastilles de TEXTE (jamais de logo). */
    outils: z.array(texte(1, CAPACITE_CAS.outil)).max(CAPACITE_CAS.outilsMax).optional(),
    vous: texte(1, CAPACITE_CAS.vous),
  })
  .strict();

const PageT27 = z
  .object({
    type: z.literal("T27"),
    titre: titrePage("T27"),
    lignes: z.array(z.object({ texte: texte(1, CAPACITE_CHECKLIST.ligne) }).strict()).min(PAGES.T27.elements.min).max(PAGES.T27.elements.max),
  })
  .strict();

const PageT28 = z
  .object({
    type: z.literal("T28"),
    titre: titrePage("T28"),
    noeuds: z.array(z.object({ texte: texte(1, CAPACITE_NOEUD.texte), icone: Icone.optional() }).strict()).min(PAGES.T28.elements.min).max(PAGES.T28.elements.max),
  })
  .strict();

export const Page = z.discriminatedUnion("type", [PageT01, PageT01B, PageT01C, PageT02, PageT06, PageT08, PageT10, PageT20, PageT21, PageT22, PageT23, PageT24, PageT26, PageT27, PageT28]);

export const CarrouselSpec = z
  .object({
    version: z.literal("carrousel/1"),
    alt: texte(1, LIMITES.altMax),
    pages: z.array(Page).min(LIMITES.pagesMin).max(LIMITES.pagesMax),
  })
  .strict()
  .superRefine((spec, ctx) => {
    // La première page est la couverture, et seule la première.
    spec.pages.forEach((page, i) => {
      const couverture = (TYPES_COUVERTURE as readonly string[]).includes(page.type);
      if (i === 0 && !couverture) ctx.addIssue({ code: "custom", path: ["pages", 0], message: "La première page est une couverture (T01, T01B ou T01C)" });
      if (i > 0 && couverture) ctx.addIssue({ code: "custom", path: ["pages", i], message: "Une couverture n'est admise qu'en première page" });
    });
    if (spec.pages.length < 2 && spec.pages.at(-1)?.type === "T21") {
      ctx.addIssue({ code: "custom", path: ["pages"], message: "La page sombre (T21) suit au moins une autre page" });
    }
    // Une seule page sombre par carrousel (L7), en page 2 ou en dernière page.
    const sombres = spec.pages.flatMap((page, i) => (TYPES_SOMBRES.includes(page.type) ? [i] : []));
    for (const i of sombres) {
      if (!placeSombrePermise(i, spec.pages.length)) {
        ctx.addIssue({ code: "custom", path: ["pages", i], message: `la page sombre (${spec.pages[i].type}) n'est permise qu'en page 2 ou en dernière page ; déplacez-la` });
      }
    }
    if (sombres.length > 1) {
      ctx.addIssue({ code: "custom", path: ["pages", sombres[1]], message: `une seule page sombre par carrousel (pages ${sombres.map((i) => i + 1).join(" et ")}) ; gardez-en une` });
    }
  });

export { TYPES_PAGE };
