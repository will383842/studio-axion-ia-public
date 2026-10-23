/**
 * CHOIX AUTOMATIQUE D'UN MODÈLE d'après une phrase (brique `motion`, précision du 09/10 « animations à la demande »,
 * façon 1 : automatiquement en lisant le texte). Règles fixes, sans appel : c'est aussi le repli de la version simple
 * (plafond atteint). Claude, quand il est appelé, peut choisir mieux ou écrire une carte sur mesure.
 * Le titre plein écran n'est JAMAIS choisi tout seul (B.21). PUR, sans alias « @/ ».
 */
import type { NomIcone } from "./icones";
import type { CarteModele, IdModeleMotion } from "./types";

export interface ChoixModele {
  modele: IdModeleMotion;
  carte: CarteModele;
  /** 0 à 1 : sous 0,5, mieux vaut ne rien poser (ou demander à Claude). */
  confiance: number;
  /** Pourquoi ce modèle (lisible). */
  raison: string;
}

const NOMBRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000 };
const UNITES: Record<string, string> = {
  h: "h",
  heure: "h",
  heures: "h",
  min: "min",
  minute: "min",
  minutes: "min",
  s: "s",
  seconde: "s",
  secondes: "s",
  jour: "jours",
  jours: "jours",
  semaine: "semaines",
  semaines: "semaines",
  mois: "mois",
  an: "ans",
  ans: "ans",
  "%": "%",
  pourcent: "%",
  "pour cent": "%",
  "€": "€",
  euro: "€",
  euros: "€",
  client: "clients",
  clients: "clients",
  fois: "fois",
};
const NOMBRE = String.raw`(\d+(?:[.,]\d+)?|${Object.keys(NOMBRES).join("|")})`;
const UNITE = String.raw`(?:(h|heures?|min(?:utes?)?|s(?:econdes?)?|jours?|semaines?|mois|ans?|%|pour ?cent|€|euros?|clients?|fois)(?![a-zà-ÿ]))`;

const valeurDe = (x: string) => NOMBRES[x.toLowerCase()] ?? Number(x.replace(",", "."));
const uniteDe = (x: string) => UNITES[x.toLowerCase().replace(/\s+/g, " ")] ?? x;
const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const propre = (s: string) => majuscule(s.replace(/\s+/g, " ").replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, "").trim());

/** Icône suggérée par les mots d'un élément (sinon aucune). */
export function iconePour(texte: string): NomIcone | undefined {
  const t = texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const table: [RegExp, NomIcone][] = [
    [/\b(ou|trouv|cherch|diagnos|analys|verif)/, "loupe"],
    [/\b(temps|heure|minute|quand|depuis|delai|vite|rapide)/, "horloge"],
    [/\b(eau|fuite|goutte|degat)/, "goutte"],
    [/\b(appel|telephon|rappel)/, "telephone"],
    [/\b(devis|document|papier|facture|contrat|dossier)/, "document"],
    [/\b(repar|outil|install|chantier|travaux)/, "cle"],
    [/\b(client|equipe|personne|gens)/, "equipe"],
    [/\b(ia|intelligence|automati|robot)/, "robot"],
    [/\b(argent|prix|cout|euro|budget)/, "euro"],
    [/\b(objectif|but|cible)/, "cible"],
    [/\b(idee|astuce|conseil)/, "ampoule"],
    [/\b(garanti|securi|protege)/, "bouclier"],
    [/\b(croiss|hausse|plus de)/, "hausse"],
    [/\b(erreur|attention|danger|piege)/, "alerte"],
    [/\b(calendrier|semaine|mois|jour|date)/, "calendrier"],
  ];
  return table.find(([m]) => m.test(t))?.[1];
}

/** Avant / après : « de 12 h à 3 h », « 12 h au lieu de… », « on passe de 12 heures à 3 heures ». */
function avantApres(phrase: string): ChoixModele | null {
  const re = new RegExp(String.raw`(?:de|d')\s*${NOMBRE}\s*${UNITE}?[^.?!]{0,30}?\s(?:à|a|en)\s+(?:seulement\s+|plus que\s+|juste\s+)?${NOMBRE}\s*${UNITE}`, "i");
  const m = re.exec(phrase) ?? new RegExp(String.raw`${NOMBRE}\s*${UNITE}\s*(?:→|->|au lieu de|contre)\s*${NOMBRE}\s*${UNITE}?`, "i").exec(phrase);
  if (!m) return null;
  const [, v1, u1, v2, u2] = m;
  const unite = uniteDe(u2 ?? u1 ?? "");
  const avant = valeurDe(v1);
  const apres = valeurDe(v2);
  if (!Number.isFinite(avant) || !Number.isFinite(apres) || avant === apres) return null;
  const sujet = phrase
    .slice(0, m.index)
    .replace(/\b(on|vous|je|nous)\s+(passe[sz]?|passons|êtes|suis)\b.*$/i, "")
    .replace(/^\s*(et|mais|donc|alors|bref|puis)\b[\s,]*/i, "")
    .trim();
  const titre = sujet.split(/\s+/).length >= 2 && sujet.split(/\s+/).length <= 6 ? propre(sujet) : undefined;
  return {
    modele: "avant-apres",
    carte: { modele: "avant-apres", donnees: { ...(titre ? { titre } : {}), avant: { valeur: avant, unite: uniteDe(u1 ?? unite) }, apres: { valeur: apres, unite } } },
    confiance: 0.9,
    raison: "un passage d'une valeur à une autre",
  };
}

/** Un chiffre marquant : « 45 minutes », « 32 % », « 200 clients ». */
function chiffre(phrase: string): ChoixModele | null {
  const m = new RegExp(String.raw`(?<![\d,.])${NOMBRE}\s*${UNITE}`, "i").exec(phrase);
  if (!m) return null;
  const valeur = valeurDe(m[1]);
  if (!Number.isFinite(valeur) || valeur === 0) return null;
  const apres = phrase.slice(m.index + m[0].length).split(/[.?!;]/)[0];
  const libelle = propre(apres).split(/\s+/).slice(0, 7).join(" ");
  const decimales = /[.,]\d/.test(m[1]) ? 1 : 0;
  return {
    modele: "chiffre",
    carte: { modele: "chiffre", donnees: { valeur, decimales, unite: uniteDe(m[2]), libelle: libelle ? libelle[0].toLowerCase() + libelle.slice(1) : "", icone: iconePour(phrase) } },
    confiance: libelle.length >= 6 ? 0.75 : 0.55,
    raison: "un chiffre marquant",
  };
}

/** Comparaison : « contrairement à », « d'un côté… de l'autre », « la différence entre A et B », « A ou B ». */
function comparaison(phrase: string): ChoixModele | null {
  const entre = /la\s+différence\s+entre\s+([^,.;]+?)\s+et\s+([^,.;?!]+)/i.exec(phrase);
  const cotes = /d'un\s+côté,?\s*([^,.;]+)[,.;]?\s*de\s+l'autre,?\s*([^,.;?!]+)/i.exec(phrase);
  const contre = /([^,.;]+?)\s+(?:contrairement\s+(?:à|aux?)|versus|vs\.?|comparé\s+(?:à|aux?))\s+([^,.;?!]+)/i.exec(phrase);
  const m = entre ?? cotes ?? contre;
  if (!m) return null;
  const g = propre(m[1]).split(/\s+/).slice(-4).join(" ");
  const d = propre(m[2]).split(/\s+/).slice(0, 4).join(" ");
  return {
    modele: "deux-colonnes",
    carte: { modele: "deux-colonnes", donnees: { gauche: { titre: propre(g), points: [] }, droite: { titre: propre(d), points: [] }, commun: { titre: "En commun", points: [] } } },
    confiance: 0.6,
    raison: "une comparaison entre deux choses (points à compléter par Claude ou par la parole qui suit)",
  };
}

/** Étapes : « d'abord… ensuite… enfin », « étape 1 », « en 4 étapes », « première étape ». */
function etapes(phrase: string): ChoixModele | null {
  const marqueurs = /\b(d'abord|premièrement|ensuite|puis|enfin|pour finir|étape|en\s+\S+\s+étapes|feuille de route|semaine\s+\d|mois\s+\d)\b/gi;
  const n = phrase.match(marqueurs)?.length ?? 0;
  if (n < 2 && !/en\s+\S+\s+étapes|feuille de route/i.test(phrase)) return null;
  const morceaux = phrase
    .split(/\b(?:d'abord|premièrement|ensuite|puis|enfin|pour finir)\b[,:]?/i)
    .map(propre)
    .filter((x) => x.split(/\s+/).length >= 1 && x.length <= 60);
  const corps = morceaux.slice(morceaux.length > 3 ? 1 : 0).slice(0, 6);
  if (corps.length < 3) return null;
  return {
    modele: "ligne-de-temps",
    carte: { modele: "ligne-de-temps", donnees: { etapes: corps.map((t) => ({ titre: t.split(/\s+/).slice(0, 5).join(" "), icone: iconePour(t) })), ...(/feuille de route|semaine|mois/i.test(phrase) ? { variante: "feuille-de-route" as const } : {}) } },
    confiance: 0.7,
    raison: "un processus en étapes",
  };
}

/** Liste : « trois questions : … », « les 4 erreurs », ou une énumération à virgules. */
function liste(phrase: string): ChoixModele | null {
  const annonce = new RegExp(String.raw`\b${NOMBRE}\s+(questions?|choses?|erreurs?|raisons?|points?|conseils?|règles?|outils?|avantages?|façons?|étapes?|pièges?|signes?|contrats?|statuts?|droits?|obligations?|documents?|preuves?|recours|options?|solutions?|conditions?|critères?)\b`, "i").exec(phrase);
  // Vérif A2 (10/10) : « trois erreurs à ne pas commettre : … » — le complément de l'annonce n'est pas un point ; les
  // points commencent après les deux-points qui suivent l'annonce.
  const deuxPoints = annonce ? phrase.indexOf(":", annonce.index + annonce[0].length) : -1;
  const apres = annonce ? (deuxPoints >= 0 && deuxPoints - (annonce.index + annonce[0].length) <= 40 ? phrase.slice(deuxPoints + 1).trim() : phrase.slice(annonce.index + annonce[0].length).replace(/^\s*[:,]\s*/, "")) : phrase;
  const elements = apres
    .split(/\s*(?:[,;:]|\?|\bet\b|\bou\b)\s*/i)
    .map(propre)
    .filter((x) => x.length >= 3 && x.split(/\s+/).length <= 8)
    // Un point fait seulement de mots de liaison (« De plus », « Et puis ») n'en est pas un (10/10).
    // Un sigle (« TVA », « CDI », « SAS ») est un vrai point (vérif A2 : listes de l'avocat vidées par ce filtre).
    .filter((x) => {
      const reste = x.replace(/\b(?:de|des|du|plus|puis|alors|ensuite|aussi|encore|donc|mais)\b/gi, "");
      return /[a-zà-ÿ]{4,}/i.test(reste) || /\b[A-Z]{2,}\b/.test(reste);
    });
  const attendus = annonce ? valeurDe(annonce[1]) : 0;
  // « un outil de plus » n'annonce pas une liste (10/10 : liste « De plus » à un seul point).
  if (annonce && attendus < 2) return null;
  if (elements.length < 2 || (!annonce && elements.length < 3)) return null;
  const points = elements.slice(0, Math.min(5, attendus || elements.length));
  const titre = annonce ? propre(`${phrase.slice(0, annonce.index).split(/[,.;]/).pop() ?? ""} ${annonce[0]}`).split(/\s+/).slice(-6).join(" ") : undefined;
  return {
    modele: "liste",
    carte: { modele: "liste", donnees: { ...(titre ? { titre } : {}), elements: points.map((p) => ({ texte: /\?$/.test(p) || !annonce || !/questions?/i.test(annonce[2]) ? p : `${p} ?`, icone: iconePour(p) })) } },
    confiance: annonce ? 0.85 : 0.55,
    raison: "une énumération",
  };
}

/**
 * Le modèle qui convient à une phrase (ou à quelques phrases qui se suivent), avec ses données remplies d'office.
 * Ordre : avant / après, étapes, liste, comparaison, chiffre. Null : rien qui mérite une carte.
 */
export function choisirModele(phrase: string): ChoixModele | null {
  const p = phrase.replace(/\s+/g, " ").trim();
  if (p.length < 8) return null;
  for (const f of [avantApres, etapes, liste, comparaison, chiffre]) {
    const c = f(p);
    if (c) return c;
  }
  return null;
}
