/**
 * IMAGE → VIDÉO · Extraction des chiffres écrits sur une image (plan § 2, I1). PUR, sans accès au serveur.
 *
 * `nombresDe` du cas concret perd les unités et les heures : il n'est pas emprunté. `chiffresDe` rend, dans l'ordre du
 * texte, chaque chiffre avec son écriture exacte (`brut`), sa valeur et son unité :
 * - heures d'horloge (« 23h14 », « 23 h 14 », « 23 heures 14 », « 3h du matin ») → unité `heure`, valeur = minutes depuis minuit ;
 * - plages (« 24h/24 », « 7j/7 ») → unité `autre`, valeur `null` ;
 * - durées (« 4 sec », « 3 secondes », « 23 min », « 6h ») → `sec`, `min`, `h` ;
 * - unités composées (« 19 min/commande », « 20 cmd/jour ») → le `brut` garde la partie « /… » ;
 * - ordinaux (« 1er jour ») et zéros écrits (« 0 demande perdue » → « 0 demande ») ;
 * - milliers séparés par une espace, normale ou fine (« 1 900 € » → 1900 €).
 * Seuls les chiffres écrits en chiffres sont lus ; les nombres en lettres passent par `texteAvecNombres` (cas concret).
 */

export const UNITES_CHIFFRE = ["%", "min", "sec", "h", "heure", "jour", "€", "nombre", "autre"] as const;
export type UniteChiffre = (typeof UNITES_CHIFFRE)[number];

export interface ChiffreLu {
  /** Tel qu'écrit sur l'image (espaces internes réduits à une seule). */
  brut: string;
  /** Valeur numérique ; minutes depuis minuit pour une heure d'horloge ; `null` pour une plage (« 24h/24 »). */
  valeur: number | null;
  unite: UniteChiffre;
}

/** Mots qui suivent un nombre sans en être l'objet compté (« 20 sur 20 », « 8 + 6 »). */
const MOTS_LIBRES = new Set(["et", "ou", "a", "à", "au", "aux", "sur", "de", "du", "des", "en", "pour", "par", "le", "la", "les", "x", "×"]);

const LETTRE = "[\\p{L}]";
const MOT = `${LETTRE}[\\p{L}'’-]*`;

/**
 * Nombre écrit avec un séparateur de milliers (« 1 900 », « 12 500 000,5 ») : groupes de 3 chiffres séparés par UNE
 * espace normale, insécable (U+00A0) ou fine insécable (U+202F). Un groupe qui n'a pas 3 chiffres (« 1 90 », « 1 9000 »)
 * laisse deux nombres distincts.
 */
const MILLIERS = "\\d{1,3}(?:[ \\u00A0\\u202F]\\d{3})+(?:[.,]\\d+)?";

/**
 * Heure d'horloge écrite avec des espaces (« 23 h 14 », « 23h 14 », typographie française) ou dite (« 6 heures 20 »,
 * forme du script une fois les nombres en chiffres). Seule source de cette lecture : l'inventaire de l'image et le
 * script passent tous deux par `chiffresDe`, quel que soit le mot qui suit (« 6 h 20 récupérées » = « six heures
 * vingt récupérées »). Heure possible seulement, et jamais quand une unité suit (« 2 h 30 min », « 1 h 20 % »,
 * « 2 heures 30 minutes ») : ce sont alors deux chiffres. La minute ne commence jamais un groupe de milliers sur
 * la même ligne (« 2 h 5 000 € » : 2 h + 5 000 €) : seule une minute collée à un chiffre, ou suivie d'une espace
 * horizontale puis d'exactement 3 chiffres, est refusée ; un nombre à la ligne suivante (« 23 h 14\n5 000 € ») ne change
 * rien à l'heure. Ni le séparateur « h » → minute ni celui de l'exclusion ne traversent un saut de ligne dans
 * `chiffresDe` ; côté moteur, le texte d'une image est lu ligne par ligne AVANT `texteAvecNombres` (qui, lui,
 * remplace le saut de ligne par une espace : « 6 h\n20 clients » ne doit jamais permettre 6h20).
 */
const HEURE_ESPACEE = `(?<![\\p{L}\\p{N}])(?<eh>[01]?\\d|2[0-3])\\s?(?:h|heures?)[ \\t\\u00A0\\u202F](?<em>[0-5]?\\d)(?![\\p{N}]|[.,]\\d|[ \\t\\u00A0\\u202F]\\d{3}(?!\\d)|\\s?(?:%|€|euros?|secondes?|sec|s|minutes?|min|mn|heures?|h|jours?)(?![\\p{L}]))`;

/**
 * Un seul motif, essayé de gauche à droite. Groupes nommés :
 * - `eh`/`em` : heure d'horloge espacée (`HEURE_ESPACEE`) ;
 * - `hh`/`mm` : heure d'horloge collée (« 23h14 »), sauf minute suivie de « min » (« 6h20 min » = 6 h + 20 min, comme espacée) ;
 * - `pa`/`pb`/`pu` : plage (« 24h/24 », « 7j/7 ») ;
 * - `n`, `ord`, puis l'unité ou le mot compté.
 */
const MOTIF = new RegExp(
  [
    HEURE_ESPACEE,
    `(?<![\\p{L}\\p{N}])(?<hh>\\d{1,2})\\s?h(?<mm>\\d{2})(?![\\p{N}])`,
    `(?<![\\p{L}\\p{N}])(?<pa>\\d{1,3})\\s?(?<pu>h|j)\\s?\\/\\s?(?<pb>\\d{1,3})(?![\\p{N}])`,
    `(?<![\\p{L}\\p{N}])(?<n>${MILLIERS}|\\d+(?:[.,]\\d+)?)(?<ord>er|re|ère|e|ème)?(?![\\p{N}])`,
  ].join("|"),
  "gu",
);

const UNITES_APRES: { re: RegExp; unite: UniteChiffre }[] = [
  { re: /^\s?%/u, unite: "%" },
  { re: /^\s?(?:€|euros?(?![\p{L}]))/u, unite: "€" },
  { re: /^\s?(?:secondes?|sec|s)(?![\p{L}])/u, unite: "sec" },
  { re: /^\s?(?:minutes?|min|mn)(?![\p{L}])/u, unite: "min" },
  { re: /^\s?(?:heures?|h)(?![\p{L}])/u, unite: "h" },
  { re: /^\s?jours?(?![\p{L}])/u, unite: "jour" },
];

/** « du matin », « du soir », « de l'après-midi » après « 3h » : c'est une heure d'horloge, pas une durée. */
const HORLOGE_APRES = /^\s+(?:du\s+matin|du\s+soir|de\s+l['’]apr[eè]s-midi)(?![\p{L}])/u;
/** « min » après une heure collée (« 6h20 min ») : 6 h + 20 min, comme « 6 h 20 min ». */
const MINUTES_APRES = /^\s?(?:minutes?|min|mn)(?![\p{L}])/u;
/** Partie composée collée à l'unité (« /commande », « /jour »). */
const COMPOSEE = new RegExp(`^\\s?\\/\\s?${MOT}`, "u");
const MOT_SUIVANT = new RegExp(`^\\s(${MOT})`, "u");

function nombre(s: string): number {
  return Number(s.replace(/[ \u00A0\u202F]/g, "").replace(",", "."));
}

function reduit(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Tous les chiffres écrits dans `texte`, dans l'ordre où ils apparaissent. */
export function chiffresDe(texte: string): ChiffreLu[] {
  const res: ChiffreLu[] = [];
  const t = texte.normalize("NFC");
  const motif = new RegExp(MOTIF.source, MOTIF.flags);
  for (let m = motif.exec(t); m; m = motif.exec(t)) {
    const g = m.groups ?? {};
    if (g.eh !== undefined) {
      res.push({ brut: reduit(m[0]), valeur: Number(g.eh) * 60 + Number(g.em), unite: "heure" });
      continue;
    }
    if (g.hh !== undefined) {
      const h = Number(g.hh);
      const mn = Number(g.mm);
      const unite = t.slice(motif.lastIndex).match(MINUTES_APRES);
      if (unite) {
        res.push({ brut: `${g.hh}h`, valeur: h, unite: "h" }, { brut: reduit(`${g.mm}${unite[0]}`), valeur: mn, unite: "min" });
        motif.lastIndex += unite[0].length;
      } else if (h <= 23 && mn <= 59) res.push({ brut: reduit(m[0]), valeur: h * 60 + mn, unite: "heure" });
      continue;
    }
    if (g.pa !== undefined) {
      res.push({ brut: reduit(m[0]), valeur: null, unite: "autre" });
      continue;
    }
    const debut = m.index ?? 0;
    let fin = debut + m[0].length;
    const valeur = nombre(g.n);
    const suite = t.slice(fin);
    const unite = UNITES_APRES.find((u) => u.re.test(suite));
    if (unite) {
      const um = suite.match(unite.re)!;
      fin += um[0].length;
      let u = unite.unite;
      if (u === "h" && HORLOGE_APRES.test(t.slice(fin))) {
        res.push({ brut: reduit(t.slice(debut, fin)), valeur: valeur * 60, unite: "heure" });
        motif.lastIndex = fin;
        continue;
      }
      const composee = t.slice(fin).match(COMPOSEE);
      if (composee) fin += composee[0].length;
      if (g.ord && u !== "jour") u = "nombre";
      res.push({ brut: reduit(t.slice(debut, fin)), valeur, unite: u });
      motif.lastIndex = fin;
      continue;
    }
    const mot = suite.match(MOT_SUIVANT);
    if (mot && !MOTS_LIBRES.has(mot[1].toLowerCase())) {
      fin += mot[0].length;
      const composee = t.slice(fin).match(COMPOSEE);
      if (composee) fin += composee[0].length;
      res.push({ brut: reduit(t.slice(debut, fin)), valeur, unite: "nombre" });
      motif.lastIndex = fin;
      continue;
    }
    res.push({ brut: reduit(t.slice(debut, fin)), valeur, unite: "nombre" });
  }
  return res;
}

/** Clé de comparaison de deux écritures d'un même chiffre (« 80% » = « 80 % »). */
export function cleChiffre(brut: string): string {
  return brut.normalize("NFC").toLowerCase().replace(/\s+/g, "");
}
