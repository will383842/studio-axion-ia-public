/**
 * RÈGLES FRANÇAISES DU PLAN SANS VOIX COMPOSÉ (lot qualité 25-11, QUAL-2) — lexiques, motifs et nettoyage des libellés.
 * Pur, déterministe, sans réseau : aucun appel d'IA. Règle de littéralité : un libellé est toujours une SUITE CONTIGUË
 * de mots du script (on ne fait que retirer des mots aux extrémités, jamais en réordonner ni en ajouter).
 */

/** Minuscules, sans accents, apostrophes droites. */
export function plier(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/œ/g, "oe");
}

/** Forme de comparaison d'un mot : pliée, sans ponctuation aux bords (garde l'apostrophe et le trait d'union). */
export function nu(s: string): string {
  return plier(s).replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9]+$/, "");
}

/** Retire l'élision initiale (« l'article » → « article »). */
export function sansElision(nuMot: string): string {
  return nuMot.replace(/^(l|d|qu|j|n|s|m|t|c)'/, "");
}

/* ------------------------------------------------------------------ */
/* Lexiques (formes pliées)                                             */
/* ------------------------------------------------------------------ */

/** Nom de l'outil → titre de la fenêtre. Les suites les plus longues d'abord. */
export const TERMES_OUTIL: { mots: string[]; titre: string }[] = [
  { mots: ["tableau", "de", "bord"], titre: "Tableau de bord" },
  { mots: ["feuille", "de", "calcul"], titre: "Feuille de calcul" },
  { mots: ["dashboard"], titre: "Dashboard" },
  { mots: ["tableur"], titre: "Tableur" },
  { mots: ["application"], titre: "Application" },
  { mots: ["applications"], titre: "Application" },
  { mots: ["appli"], titre: "Appli" },
  { mots: ["logiciel"], titre: "Logiciel" },
  { mots: ["plateforme"], titre: "Plateforme" },
  { mots: ["interface"], titre: "Interface" },
  { mots: ["outil"], titre: "Outil" },
  { mots: ["outils"], titre: "Outil" },
];

/** Annonce d'une énumération (« trois chiffres : »). */
export const NOMS_ANNONCE = new Set(["chiffres", "chiffre", "indicateurs", "indicateur", "compteurs", "compteur", "nombres", "statistiques", "metriques", "kpi", "mesures"]);
export const NOMBRES = new Set(["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "plusieurs", "ces", "vos"]);

export const NOMS_LISTE = new Set(["liste", "listes", "tableau", "tableaux", "table"]);
export const MOTS_TRI = new Set(["triee", "triees", "trie", "tries", "classee", "classees", "classe", "classes", "ordonnee", "ordonnees", "rangee", "rangees"]);
export const PREPOSITIONS_TRI = new Set(["par", "selon", "suivant"]);

export const MOTS_CLIC = new Set(["clic", "cliquez", "cliquer", "clique", "touchez", "toucher", "tapez", "appuyez", "survolez"]);
export const MOTS_OUVRE = new Set(["ouvre", "ouvrent", "affiche", "affichent", "montre", "montrent", "revele", "devoile", "donne"]);
export const POSSESSIFS = new Set(["son", "sa", "ses", "leur", "leurs"]);

export const MOTS_ALERTE = new Set([
  "alerte", "alertes", "notification", "notifications", "previent", "previennent", "prevenu", "prevenue", "prevenez", "avertit", "avertissent",
  "e-mail", "email", "e-mails", "emails", "courriel", "courriels", "mail", "mails", "sms",
]);
export const CONJONCTIONS_CONDITION = [["quand"], ["lorsque"], ["lorsqu'"], ["si"], ["des", "que"], ["a", "chaque", "fois", "que"], ["chaque", "fois", "que"]];

export const MOTS_APPEL = new Set([
  "rendez-vous", "rendez", "rdv", "contactez", "contactez-nous", "contact", "contacter", "appelez", "appelez-nous", "ecrivez", "ecrivez-nous", "reservez",
  "reserver", "demandez", "essayez", "decouvrez", "echangeons", "parlons", "discutons", "devis", "prenez", "lancez-vous", "telephonez", "joignez",
]);

export const DETERMINANTS = new Set(["le", "la", "les", "l'", "des", "du", "un", "une", "ces", "cet", "cette", "ses", "son", "sa", "vos", "votre", "leurs", "leur"]);
export const MOTS_VIDES_FIN = new Set([
  "de", "du", "des", "le", "la", "les", "l'", "d'", "un", "une", "a", "au", "aux", "et", "ou", "en", "pour", "avec", "dans", "par", "que", "qui", "sur", "puis",
]);
/** Débuts de phrase sans contenu (cartes-phrases) : pronoms sujets et connecteurs. */
export const DEBUTS_VIDES = new Set([
  "vous", "nous", "je", "tu", "il", "elle", "on", "ils", "elles", "ca", "cela", "voici", "voila", "ensuite", "puis", "enfin", "alors", "donc", "mais", "car", "ainsi",
  "aussi", "ici", "et", "ou", "bref", "du", "coup",
]);
export const RELATIFS = new Set(["qui", "que", "dont", "ou", "parce", "afin", "pour", "quand", "lorsque", "si"]);

/** Positions dites (« En haut », « Juste en dessous ») → partie de l'écran visée. */
export const POSITIONS_DITES: { mots: string[]; cible: "cartes" | "liste" | "panneau" }[] = [
  { mots: ["en", "haut"], cible: "cartes" },
  { mots: ["tout", "en", "haut"], cible: "cartes" },
  { mots: ["juste", "en", "dessous"], cible: "liste" },
  { mots: ["juste", "dessous"], cible: "liste" },
  { mots: ["en", "dessous"], cible: "liste" },
  { mots: ["en", "bas"], cible: "liste" },
  { mots: ["plus", "bas"], cible: "liste" },
  { mots: ["a", "droite"], cible: "panneau" },
  { mots: ["sur", "le", "cote"], cible: "panneau" },
];

/* ------------------------------------------------------------------ */
/* Nettoyage des libellés                                               */
/* ------------------------------------------------------------------ */

export function majuscule(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Retire ponctuation, guillemets et espaces aux deux bords. */
export function nettoyerBords(s: string): string {
  return s.replace(/^[\s«"“(\[:;,.!?…–—-]+/, "").replace(/[\s»"”)\]:;,.!?…–—-]+$/, "").replace(/\s+/g, " ");
}

export interface OptionsLibelle {
  maxMots: number;
  maxCar: number;
  /** Garde les déterminants initiaux (alerte, repère, cartes-phrases). Défaut : faux. */
  garderDeterminants?: boolean;
  /** Ne met pas la 1re lettre en capitale (repère « une heure »). */
  minuscule?: boolean;
}

export interface LibelleNettoye {
  /** Indices relatifs aux mots donnés (bornes comprises) : la suite contiguë gardée. */
  premier: number;
  dernier: number;
  texte: string;
  tronque: boolean;
}

/**
 * Nettoie un libellé : retire déterminants initiaux (« les/la/le/l'/des/ceux qui/celles qui/et »), ponctuation finale,
 * mots vides finaux ; coupe au mot ; 1re lettre en capitale. Renvoie `null` s'il ne reste rien.
 */
export function nettoyerLibelle(mots: string[], opt: OptionsLibelle): LibelleNettoye | null {
  let a = 0;
  let b = mots.length - 1;
  while (a <= b && nu(mots[a]) === "") a++;
  while (b >= a && nu(mots[b]) === "") b--;
  while (a <= b) {
    const n = nu(mots[a]);
    if (n === "et" || n === "ou" || n === "puis") { a++; continue; }
    if (!opt.garderDeterminants) {
      if (DETERMINANTS.has(n)) { a++; continue; }
      if (n === "ceux" || n === "celles" || n === "celui" || n === "celle") {
        a++;
        if (a <= b && nu(mots[a]) === "qui") a++;
        continue;
      }
    }
    break;
  }
  if (a > b) return null;
  const rogner = () => {
    while (b >= a && (nu(mots[b]) === "" || MOTS_VIDES_FIN.has(nu(mots[b])))) b--;
  };
  rogner();
  if (b < a) return null;
  const finInitiale = b;
  if (b - a + 1 > opt.maxMots) { b = a + opt.maxMots - 1; rogner(); }
  const construire = (): string => {
    const morceaux = mots.slice(a, b + 1).map((m, i) => (i === 0 && !opt.garderDeterminants ? m.replace(/^([lLdD])['’]/, "") : m));
    return nettoyerBords(morceaux.join(" "));
  };
  let texte = construire();
  while (texte.length > opt.maxCar && b > a) {
    b--;
    rogner();
    if (b < a) return null;
    texte = construire();
  }
  if (!texte || texte.length > opt.maxCar) return null;
  const tronque = b < finInitiale;
  return { premier: a, dernier: b, texte: opt.minuscule ? texte : majuscule(texte), tronque };
}
