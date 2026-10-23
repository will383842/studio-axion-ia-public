/**
 * CHOIX AUTOMATIQUE DES MODÈLES 7 À 13 d'après une phrase (brique `motion`, lot F2), en plus des 6 modèles validés
 * (`choix.ts`, inchangé). Règles fixes, sans appel : c'est aussi le repli de la version simple. Claude, quand il est
 * appelé, peut choisir mieux (il voit les images : position des annotations d'une capture).
 *
 *   - `choisirModeleTous(phrase, contexte)` : le meilleur des 13 modèles (ou null) ;
 *   - `choisirModeleEtendu(phrase, contexte)` : seulement parmi les modèles 7 à 13 ;
 *   - `lireDemandeModele(phrase)` : le modèle DEMANDÉ par Will (« mets un titre plein écran », « en camembert »).
 * Le titre plein écran n'est JAMAIS choisi tout seul (seulement à la demande) ; la capture annotée seulement quand
 * une image est fournie (Mes images, B-roll). PUR, sans alias « @/ ».
 */
import { choisirModele, iconePour } from "./choix";
import type { NomIcone } from "./icones";
import type { CarteMotionTous, DonneesCaptureAnnotee, DonneesGraphique, IdModeleMotionEtendu, IdModeleMotionTous, VarianteGraphique } from "./types-etendus";
import { contientNomOuBandeau } from "./documentaire";

export interface ChoixModeleTous {
  modele: IdModeleMotionTous;
  carte: CarteMotionTous;
  /** 0 à 1 : sous 0,5, mieux vaut ne rien poser (ou demander à Claude). */
  confiance: number;
  raison: string;
}

/** Ce que le moteur sait en plus de la phrase. */
export interface ContexteChoixMotion {
  /** Une image disponible pour ce passage (Mes images, B-roll) : rend possible la capture annotée. */
  capture?: DonneesCaptureAnnotee["image"];
}

const NOMBRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100 };
/** Nombres en lettres reconnus comme valeurs (« un », « une » exclus : « une PME » n'est pas un chiffre). */
const MOTS_NOMBRES = Object.keys(NOMBRES).filter((m) => m !== "un" && m !== "une").join("|");
const UNITES: [RegExp, string][] = [
  [/^(h|heures?)$/i, "h"],
  [/^min(utes?)?$/i, "min"],
  [/^jours?$/i, "jours"],
  [/^semaines?$/i, "semaines"],
  [/^mois$/i, "mois"],
  [/^ans?$/i, "ans"],
  [/^(%|pour ?cent)$/i, "%"],
  [/^(€|euros?)$/i, "€"],
  [/^clients?$/i, "clients"],
  [/^salari[ée]s?$/i, "salariés"],
  [/^(personnes?|dirigeants?|entreprises?|pme)$/i, ""],
];
const UNITE = String.raw`(h|heures?|min(?:utes?)?|jours?|semaines?|mois|ans?|%|pour ?cent|€|euros?|clients?|salari[ée]s?|personnes?|dirigeants?|entreprises?|PME)(?![a-zà-ÿ])`;

const valeurDe = (x: string) => NOMBRES[x.toLowerCase()] ?? Number(x.replace(/\s/g, "").replace(",", "."));
function uniteDe(x: string | undefined): string | undefined {
  if (!x) return undefined;
  for (const [re, u] of UNITES) if (re.test(x.trim())) return u || x.trim().toLowerCase();
  return x.trim();
}
const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const propre = (s: string) => majuscule(s.replace(/\s+/g, " ").replace(/^[\s,;:.–—-]+|[\s,;:.!?–—-]+$/g, "").trim());
const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’]/g, "'");
/** Coupe un texte à `max` mots puis à `car` caractères (au mot près). */
function court(s: string, max: number, car: number): string {
  const mots = propre(s).split(/\s+/).slice(0, max);
  while (mots.length > 1 && mots.join(" ").length > car) mots.pop();
  return mots.join(" ").slice(0, car);
}
const ARTICLES = /^(?:(?:de|d'|du|des|sur|pour|en|dans|à|a|au|aux|par)\s+|(?:d'|l'))*(?:(?:les|la|le|leurs?|vos|votre|nos|notre|ses|son|sa|mes|mon|ma|des|du|un|une)\s+|l')?/i;

/* ------------------------------------------------------------------ */
/* 10. Check-list                                                        */
/* ------------------------------------------------------------------ */

const INDICES_CHECK = /(?<![A-Za-zÀ-ÿ])(check-?lists?|liste de contr[oô]le|cochez|cocher|v[ée]rifiez|assurez-vous|avez-vous|[êe]tes-vous|est-ce que vous avez)\b|[✓✔☑]/i;

function checkList(p: string): ChoixModeleTous | null {
  const m = INDICES_CHECK.exec(p);
  if (!m) return null;
  const explicite = /check-?list|cochez|cocher|contr[oô]le|[✓✔☑]/i.test(m[0]);
  // Vérif A2 (10/10) : « Trois réflexes : lisez l'avis, vérifiez la plaque… » — l'indice est DANS l'énumération : les
  // cases commencent aux deux-points qui le précèdent (avant : titre « Trois réflexes : lisez l'avis », 2 cases sur 3).
  const deuxPointsAvant = p.lastIndexOf(":", m.index);
  const dansEnumeration = deuxPointsAvant >= 0 && !p.slice(deuxPointsAvant + 1, m.index).includes(".") && /[,;]/.test(p.slice(deuxPointsAvant + 1, m.index));
  const deuxPoints = dansEnumeration ? deuxPointsAvant : p.indexOf(":", m.index);
  const avant = p.slice(0, dansEnumeration ? deuxPointsAvant : m.index).replace(/[,;:]\s*$/, "");
  // Questions enchaînées (« Avez-vous… ? Êtes-vous… ? ») : une case par question.
  const questions = (p.match(/[^?]+\?/g) ?? []).filter((q) => INDICES_CHECK.test(q));
  let morceaux: string[];
  if (questions.length >= 2) {
    morceaux = questions.map((q) => q.replace(/^\s*(et\s+)?/i, "").replace(/\s*\?$/, " ?"));
  } else {
    const corps = deuxPoints >= 0 ? p.slice(deuxPoints + 1) : p.slice(m.index + m[0].length);
    morceaux = corps.split(/\s*(?:[,;]|\bet\b(?!\s+(?:de|d'))|\bpuis\b|\.)\s*/i);
  }
  const elements = morceaux
    .map((x) => x.replace(/^\s*(?:que|qu'|si|bien\s+que)\s+/i, ""))
    .map((x) => court(x, 8, 48))
    .filter((x) => x.replace(/\?/g, "").trim().length >= 4);
  if (elements.length < 2) return null;
  const titreBrut = propre(avant.split(/[.!?]/).pop() ?? "");
  const titre = titreBrut.split(/\s+/).length >= 2 && titreBrut.length <= 60 ? titreBrut : undefined;
  return {
    modele: "check-list",
    carte: { modele: "check-list", donnees: { ...(titre ? { titre } : {}), elements: elements.slice(0, 6).map((texte) => ({ texte })) } },
    confiance: explicite ? 0.88 : 0.74,
    raison: "des conditions à vérifier, une par une",
  };
}

/* ------------------------------------------------------------------ */
/* 9. Problème → solution                                                */
/* ------------------------------------------------------------------ */

function problemeSolution(p: string): ChoixModeleTous | null {
  const re =
    /\b(?:le|un|votre|notre|son|leur|mon|ce)\s+(?:vrai\s+|gros\s+|seul\s+|principal\s+|premier\s+)?(probl[eè]mes?|soucis?|freins?|difficult[ée]s?|pi[eè]ges?)\b\s*[,:]?\s*(?:c'est|ce sont|est|:)?\s*(.+?)\s*[.;!?,]?\s+(?:et\s+|mais\s+|alors\s+)?(?:la|une|ma|notre|votre|sa)\s+(?:bonne\s+|vraie\s+|seule\s+|meilleure\s+)?(solutions?|r[ée]ponses?|parades?|cl[ée]s?|astuces?|rem[eè]des?)\b\s*[,:]?\s*(?:c'est|est|:)?\s*(.+)$/i;
  const m = re.exec(p);
  if (m) {
    const probleme = court(m[2].replace(/^(?:de|d'|que|qu')\s*/i, ""), 7, 40);
    const solution = court(m[4].replace(/^(?:de|d'|que|qu')\s*/i, ""), 7, 40);
    if (probleme.length < 3 || solution.length < 3) return null;
    return {
      modele: "probleme-solution",
      carte: { modele: "probleme-solution", donnees: { probleme: { titre: probleme, icone: iconePour(probleme) ?? "alerte" }, solution: { titre: solution, icone: iconePour(solution) ?? "coche-cercle" } } },
      confiance: 0.86,
      raison: "un problème puis sa solution",
    };
  }
  // « Au lieu de passer vos soirées sur les devis, il suffit de… » (sans chiffres : sinon c'est un avant / après).
  const ali = /\bau lieu de\s+([^,.;\d]{4,80}?)\s*,\s*(?:il suffit de|vous pouvez|on peut|vous allez|faites|laissez)\s+([^.;!?]{4,80})/i.exec(p);
  if (!ali) return null;
  const probleme = court(ali[1], 7, 40);
  const solution = court(ali[2], 7, 40);
  return {
    modele: "probleme-solution",
    carte: { modele: "probleme-solution", donnees: { probleme: { titre: probleme, icone: iconePour(probleme) ?? "alerte" }, solution: { titre: solution, icone: iconePour(solution) ?? "coche-cercle" } } },
    confiance: 0.66,
    raison: "une façon de faire remplacée par une autre",
  };
}

/* ------------------------------------------------------------------ */
/* 13. Documentaire                                                      */
/* ------------------------------------------------------------------ */

const MOIS = "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre";

function documentaire(p: string): ChoixModeleTous | null {
  const date = new RegExp(String.raw`\b(?:(?:le\s+)?(\d{1,2}(?:er)?)\s+)?(${MOIS})\s+((?:19|20)\d{2})\b`, "i").exec(p) ?? /\ben\s+((?:19|20)\d{2})\b/i.exec(p);
  // Lieu : une préposition puis un nom propre (majuscule), éventuellement composé (« Saint-Étienne », « Aix-en-Provence »).
  const lieu = /(?<![A-Za-zÀ-ÿ])(?:à|au|aux|en|dans le|dans la|près de|pr[eè]s d')\s+((?:[A-ZÀ-Ý][a-zà-ÿ'’]+)(?:[- ](?:sur|en|de|du|la|le|lès|les)?-?[A-ZÀ-Ý][a-zà-ÿ'’]+)*)/.exec(p);
  if (!lieu || contientNomOuBandeau(lieu[1]) || new RegExp(`^(${MOIS})$`, "i").test(lieu[1])) return null;
  const sansDate = date ? p.slice(0, date.index) + " ".repeat(date[0].length) + p.slice(date.index + date[0].length) : p;
  const c = new RegExp(String.raw`(?<![\d,.A-Za-zÀ-ÿ])(\d+(?:[.,]\d+)?|(?:${MOTS_NOMBRES})(?![A-Za-zÀ-ÿ]))\s*${UNITE}`, "i").exec(sansDate);
  if (!date && !c) return null;
  const texteDate = date ? propre(date[2] && date[3] ? `${date[1] ? `${date[1]} ` : ""}${date[2]} ${date[3]}` : date[1]) : undefined;
  let chiffre: { valeur: number; unite?: string; libelle: string } | undefined;
  if (c) {
    const valeur = valeurDe(c[1]);
    const apres = sansDate.slice(c.index + c[0].length).split(/[.;!?]/)[0];
    const avant = sansDate.slice(0, c.index).split(/[,.;!?]/).pop() ?? "";
    const libelle = court(apres.trim().length >= 6 ? apres : avant, 7, 60);
    if (Number.isFinite(valeur) && libelle && !contientNomOuBandeau(libelle)) chiffre = { valeur, unite: uniteDe(c[2]), libelle: libelle[0].toLowerCase() + libelle.slice(1) };
  }
  return {
    modele: "documentaire",
    carte: { modele: "documentaire", donnees: { lieu: lieu[1], ...(texteDate ? { date: texteDate } : {}), ...(chiffre ? { chiffre } : {}) } },
    confiance: texteDate && chiffre ? 0.84 : 0.7,
    raison: "un fait situé (lieu, date, chiffre)",
  };
}

/* ------------------------------------------------------------------ */
/* 7. Graphique                                                          */
/* ------------------------------------------------------------------ */

/** Variante demandée ou suggérée par les mots de la phrase. */
export function varianteGraphique(phrase: string, valeurs: { libelle: string; valeur: number }[] = [], unite?: string): VarianteGraphique {
  const n = normaliser(phrase);
  if (/camembert|donut|repartition|se repartit|parts? (de|du)|la part/.test(n)) return "camembert";
  if (/courbe|evolution|progression|au fil|chaque mois|mois apres mois|croissance|tendance/.test(n)) return "courbe";
  if (/barres?|histogramme/.test(n)) return "barres";
  if (valeurs.length >= 3 && valeurs.every((v) => /^(19|20)\d{2}$|^mois\s+\d|^semaine\s+\d|^(janv|fevr|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)/i.test(normaliser(v.libelle)))) return "courbe";
  const somme = valeurs.reduce((s, v) => s + v.valeur, 0);
  if (unite === "%" && valeurs.length >= 2 && somme >= 90 && somme <= 101) return "camembert";
  return "barres";
}

function graphique(p: string): ChoixModeleTous | null {
  const segments = p.split(/\s*(?:[,;]|\bet\b(?=\s+(?:\d|en\s+(?:19|20)\d{2}))|\bpuis\b|\s[-–—]\s)\s*/i).filter(Boolean);
  const re = new RegExp(String.raw`(?<![\d,.A-Za-zÀ-ÿ])(\d+(?:[.,]\d+)?|(?:${MOTS_NOMBRES})(?![A-Za-zÀ-ÿ]))(?:\s*${UNITE})?`, "gi");
  const valeurs: { libelle: string; valeur: number; unite?: string }[] = [];
  let enAttente: string | undefined;
  for (const seg of segments) {
    const annee = /\b((?:19|20)\d{2})\b/.exec(seg) ?? /\b(mois|semaine|ann[ée]e)\s+(\d+)\b/i.exec(seg);
    const sansAnnee = annee ? seg.replace(annee[0], " ") : seg;
    // Un nombre écrit en lettres ne compte qu'avec son unité (« un dirigeant » n'est pas une valeur).
    const m = [...sansAnnee.matchAll(re)].find((x) => /\d/.test(x[1]) || !!x[2]);
    if (!m || m.index === undefined) {
      if (annee) enAttente = annee[2] ? propre(`${annee[1]} ${annee[2]}`) : annee[1];
      continue;
    }
    const valeur = valeurDe(m[1]);
    if (!Number.isFinite(valeur)) continue;
    const etiquetteTemps = annee ? (annee[2] ? propre(`${annee[1]} ${annee[2]}`) : annee[1]) : enAttente;
    enAttente = undefined;
    const apres = sansAnnee.slice(m.index + m[0].length).replace(/^\s*de\s+(?:leur|son|votre|notre)\s+temps\s+/i, " ").split(/[.!?]/)[0];
    const avant = sansAnnee.slice(0, m.index).replace(/[:=]\s*$/, "");
    const nettoyer = (x: string) => court(x.trim().replace(ARTICLES, ""), 3, 24);
    const libelle = etiquetteTemps ?? (nettoyer(apres) || nettoyer(avant.split(/\s+/).slice(-3).join(" ")));
    if (!libelle || libelle.length < 2) continue;
    valeurs.push({ libelle: propre(libelle), valeur, unite: uniteDe(m[2]) });
  }
  if (valeurs.length < 2) return null;
  const unites = [...new Set(valeurs.map((v) => v.unite).filter(Boolean))];
  if (unites.length > 1) return null;
  const unite = unites[0];
  const series = valeurs.slice(0, 6).map(({ libelle, valeur }) => ({ libelle, valeur }));
  const variante = varianteGraphique(p, series, unite);
  const donnees: DonneesGraphique = { variante, ...(unite ? { unite } : {}), series };
  return { modele: "graphique", carte: { modele: "graphique", donnees }, confiance: valeurs.length >= 3 ? 0.82 : 0.68, raison: variante === "camembert" ? "une répartition en parts" : variante === "courbe" ? "une évolution dans le temps" : "plusieurs valeurs à comparer" };
}

/* ------------------------------------------------------------------ */
/* 8. Icône + mot                                                        */
/* ------------------------------------------------------------------ */

const ANNONCES_MOT: [RegExp, string][] = [
  [/\bun seul mot\b/i, "Un seul mot"],
  [/\ben un mot\b/i, "En un mot"],
  [/\b(?:le|mon|notre) ma[iî]tre[- ]mot\b/i, "Le maître-mot"],
  [/\bretenez (?:ce|un|juste un) mot\b/i, "Retenez ce mot"],
  [/\b(?:le|mon|notre) mot d'ordre\b/i, "Le mot d'ordre"],
  [/\b(?:le|un) mot[- ]cl[ée]\b/i, "Le mot-clé"],
  [/\btout tient en un mot\b/i, "En un mot"],
];

function iconeMot(p: string): ChoixModeleTous | null {
  for (const [re, surTitre] of ANNONCES_MOT) {
    const m = re.exec(p);
    if (!m) continue;
    const reste = p.slice(m.index + m[0].length).replace(/^\s*[,:]?\s*(?:c'est|ce sera|ce serait|est|:)?\s*[,:]?\s*/i, "");
    const guillemets = /^[«"“]\s*([^»"”]{2,28}?)\s*[»"”]/.exec(reste);
    const brut = guillemets ? guillemets[1] : (/^(?:(?:de|d'|la|le|l'|les|un|une)\s*)?([A-Za-zÀ-ÿ'’-]{3,24})/.exec(reste)?.[1] ?? "");
    const mot = propre(brut.replace(/^(?:de|d'|la|le|l'|les)\s*/i, ""));
    if (mot.length < 3) continue;
    const suite = guillemets ? reste.slice(guillemets[0].length) : reste.slice(reste.indexOf(brut) + brut.length);
    const sousTitre = court(suite.split(/[.;!?]/)[0].replace(/^\s*[,:–—-]?\s*/, ""), 8, 60);
    const icone: NomIcone = iconePour(`${mot} ${sousTitre}`) ?? "ampoule";
    return {
      modele: "icone-mot",
      carte: { modele: "icone-mot", donnees: { surTitre, mot, icone, ...(sousTitre.split(/\s+/).length >= 2 ? { sousTitre: sousTitre[0].toLowerCase() + sousTitre.slice(1) } : {}) } },
      confiance: 0.78,
      raison: "un mot qui résume l'idée",
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 11. Capture annotée                                                   */
/* ------------------------------------------------------------------ */

const INDICES_CAPTURE = /(?<![A-Za-zÀ-ÿ])(regardez|voyez|vous voyez|ici|ce bouton|cet [ée]cran|cette (?:capture|page|fen[eê]tre|image|case|ligne)|ce (?:tableau|chiffre|menu|champ|document)|le tableau de bord|cliquez|en haut|en bas|[àa] gauche|[àa] droite)\b/i;

function captureAnnotee(p: string, ctx: ContexteChoixMotion): ChoixModeleTous | null {
  if (!ctx.capture) return null;
  const m = INDICES_CAPTURE.exec(p);
  if (!m) return null;
  const cible = /\b(?:ce|cette|le|la)\s+(bouton|chiffre|ligne|case|menu|champ|total|colonne)\b(?:\s+([«"“][^»"”]{2,18}[»"”]))?/i.exec(p);
  const texte = cible ? court(`${cible[1]}${cible[2] ? ` ${cible[2].replace(/[«»"“”]/g, "")}` : ""}`, 3, 24) : undefined;
  const n = normaliser(p);
  // Sans vision, la position vient des mots (« en haut », « à droite ») ; Claude, qui voit l'image, la précise.
  const y = /en haut/.test(n) ? 0.12 : /en bas/.test(n) ? 0.68 : 0.38;
  const x = /a gauche/.test(n) ? 0.08 : /a droite/.test(n) ? 0.5 : 0.25;
  const type = /\bbouton|cliquez/.test(n) ? "fleche" : /\bligne|colonne/.test(n) ? "surligne" : "cercle";
  const annotation = { type, x, y, largeur: type === "surligne" ? 0.84 : 0.42, hauteur: type === "surligne" ? 0.08 : 0.18, ...(texte ? { texte } : {}) } as const;
  return {
    modele: "capture-annotee",
    carte: { modele: "capture-annotee", donnees: { image: ctx.capture, annotations: [{ ...annotation, x: type === "surligne" ? 0.08 : annotation.x }] } },
    confiance: 0.62,
    raison: "on montre un écran ou un document (position des annotations à préciser d'après l'image)",
  };
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                            */
/* ------------------------------------------------------------------ */

/** Le meilleur modèle 7 à 13 pour une phrase (jamais le titre plein écran), ou null. */
export function choisirModeleEtendu(phrase: string, contexte: ContexteChoixMotion = {}): ChoixModeleTous | null {
  const p = phrase.replace(/\s+/g, " ").trim();
  if (p.length < 8) return null;
  return captureAnnotee(p, contexte) ?? checkList(p) ?? problemeSolution(p) ?? documentaire(p) ?? graphique(p) ?? iconeMot(p);
}

/**
 * Le modèle qui convient à une phrase parmi les 13, avec ses données remplies d'office. Ordre : capture annotée
 * (s'il y a une image et qu'on la montre), check-list, problème → solution, documentaire, avant / après (validé),
 * graphique (2 valeurs ou plus), puis les règles validées des 6 premiers (étapes, liste, comparaison, chiffre), puis
 * icône + mot. Le titre plein écran et le titre ne sont JAMAIS choisis tout seuls. Null : rien qui mérite une carte.
 */
export function choisirModeleTous(phrase: string, contexte: ContexteChoixMotion = {}): ChoixModeleTous | null {
  const p = phrase.replace(/\s+/g, " ").trim();
  if (p.length < 8) return null;
  const prioritaire = captureAnnotee(p, contexte) ?? checkList(p) ?? problemeSolution(p) ?? documentaire(p);
  if (prioritaire) return prioritaire;
  const valide = choisirModele(p);
  if (valide?.modele === "avant-apres") return valide;
  const g = graphique(p);
  if (g) return g;
  return valide ?? iconeMot(p);
}

/**
 * Carte d'un modèle 7 à 13 DÉJÀ DEMANDÉ (par Will ou par Claude), remplie d'après la phrase par la seule règle de ce
 * modèle (sans l'ordre de priorité de `choisirModeleTous`) ; null si la phrase ne suffit pas. Le titre plein écran n'a
 * pas de règle de choix : ses textes viennent de la demande elle-même (mission L).
 */
export function carteDuModeleDepuisPhrase(modele: IdModeleMotionEtendu, phrase: string, contexte: ContexteChoixMotion = {}): ChoixModeleTous | null {
  const p = phrase.replace(/\s+/g, " ").trim();
  if (p.length < 8) return null;
  switch (modele) {
    case "graphique":
      return graphique(p);
    case "icone-mot":
      return iconeMot(p);
    case "probleme-solution":
      return problemeSolution(p);
    case "check-list":
      return checkList(p);
    case "capture-annotee":
      return captureAnnotee(p, contexte);
    case "documentaire":
      return documentaire(p);
    case "titre-plein-ecran":
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* À la demande                                                          */
/* ------------------------------------------------------------------ */

const DEMANDES: [RegExp, IdModeleMotionEtendu][] = [
  [/titre (en )?plein ecran|titre de chapitre|grand titre|titre geant|chapitre en grand/, "titre-plein-ecran"],
  [/check-?list|cases? (a|qui se) coch|liste (a|de) cocher|qui se coche/, "check-list"],
  [/capture|entoure|annote|annotation|surligne|fleche (sur|vers)|montre (mon|l'|le) (ecran|tableau)/, "capture-annotee"],
  [/documentaire|reportage|carte (de )?(lieu|reportage)|facon reportage/, "documentaire"],
  [/probleme.{0,30}solution|bascule.{0,20}solution|avant.{0,10}la solution/, "probleme-solution"],
  [/graphique|camembert|courbe|histogramme|diagramme|en barres|donut/, "graphique"],
  [/icone.{0,30}mot|mot.{0,30}icone|mot (en )?(geant|tres grand)|en grand avec une icone|le mot .{1,30} en grand/, "icone-mot"],
];

/**
 * Modèle 7 à 13 DEMANDÉ dans une phrase de Will (consigne « Monteur, … », fil de discussion, « Vos demandes »), ou
 * null. C'est le seul chemin du titre plein écran.
 */
export function lireDemandeModele(phrase: string | null | undefined): IdModeleMotionEtendu | null {
  if (!phrase) return null;
  const n = normaliser(phrase);
  for (const [re, id] of DEMANDES) if (re.test(n)) return id;
  return null;
}
