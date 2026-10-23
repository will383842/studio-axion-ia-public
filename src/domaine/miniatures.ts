/**
 * MINIATURES RÉELLES (lot R4, 03/10) — règles PURES, testées :
 *   - le TITRE DE COUVERTURE (5 mots au plus, lisibles sur un téléphone) et le mot mis en valeur ;
 *   - les 3 INSTANTS de la vidéo où chercher l'image (le visage d'abord, jamais la première seconde) ;
 *   - ce qui est une image de démonstration (jamais posée sur une vraie vidéo).
 * Le calcul de l'image (5 images autour de chaque instant, la plus nette, titre posé dans la zone sûre) est fait
 * par `studio-rendu` (opération `miniature`).
 */
import type { Ratio, SourceImage } from "./types";

/** Nombre de mots au plus sur une couverture : au-delà, illisible en petit (grille d'un profil sur téléphone). */
export const MOTS_COUVERTURE_MAX = 5;

/** Taille d'une miniature selon le format de la vidéo (la même que `studio-rendu`, vérifiée par un test). */
export function dimensionsMiniature(ratio: Ratio): { largeur: number; hauteur: number } {
  if (ratio === "16:9") return { largeur: 1280, hauteur: 720 };
  if (ratio === "4:5") return { largeur: 1080, hauteur: 1350 };
  if (ratio === "1:1") return { largeur: 1080, hauteur: 1080 };
  return { largeur: 1080, hauteur: 1920 };
}

/** Une clé de stockage d'une image de DÉMONSTRATION (fichiers de `public/demo/`). */
export function estCleDemo(cle: string | undefined | null): boolean {
  return !!cle && /^\/?demo\//.test(cle);
}

/** Mots qui ne terminent jamais une couverture coupée (« l'erreur que tout le » → « l'erreur »). */
const FINS_INTERDITES = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "à", "a", "en", "et", "ou", "que", "qu", "qui", "quoi", "dont", "pour", "par", "sur", "sous", "dans", "avec", "sans",
  "ce", "cet", "cette", "ces", "son", "sa", "ses", "mon", "ma", "mes", "votre", "vos", "notre", "nos", "leur", "leurs", "tout", "tous", "toute", "toutes", "très", "plus", "moins", "si", "ne", "n", "pas", "est", "sont", "vous", "nous", "on", "il", "elle", "je", "j", "se", "s", "y",
]);

/** Mots outils : jamais choisis comme mot mis en valeur. */
const MOTS_OUTILS = new Set([...FINS_INTERDITES, "comment", "pourquoi", "quand", "faut", "faire", "fait", "faites", "peut", "peuvent", "être", "avoir", "votre", "cela", "ça", "c", "voici", "voilà"]);

const normaliser = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^[^\p{L}\p{N}€%]+|[^\p{L}\p{N}€%]+$/gu, "");

/** Mot « nu » pour comparer (« l'erreur » → « erreur », « PV ? » → « pv »). */
export function motNormalise(m: string): string {
  const n = normaliser(m);
  const apostrophe = n.split(/['’]/);
  return apostrophe.length > 1 && apostrophe[0].length <= 2 ? apostrophe.slice(1).join("'") : n;
}

const mots = (texte: string) => texte.split(/\s+/).filter((m) => /[\p{L}\p{N}€%]/u.test(m));

/** Une fin de couverture acceptable : ni mot outil, ni ponctuation pendante. */
function finAcceptable(m: string): boolean {
  const n = normaliser(m);
  const tete = n.split(/['’]/)[0];
  return !!n && !FINS_INTERDITES.has(n) && !(n.includes("'") && FINS_INTERDITES.has(tete) && n.length <= 2);
}

/**
 * Titre de couverture tiré du titre de la vidéo : 5 mots au plus. Le titre entier s'il tient ; sinon la partie
 * qui tient (« Amende : l'erreur que tout le monde fait » → « Amende : l'erreur ») ; jamais un mot outil en dernier.
 * Will peut toujours le changer (onglet Miniature) : la miniature est alors refaite.
 */
export function couvertureDepuisTitre(titre: string): string {
  const propre = titreSansCodeInterne(titre);
  if (!propre) return "";
  if (mots(propre).length <= MOTS_COUVERTURE_MAX) return propre;
  // Parties séparées par « : », « — », « | » ou une fin de phrase : la première qui tient en entier (au moins 2 mots).
  const parties = propre.split(/\s*[:—–|]\s+|(?<=[?!.])\s+/).map((p) => p.trim()).filter(Boolean);
  const tient = parties.find((p) => mots(p).length >= 2 && mots(p).length <= MOTS_COUVERTURE_MAX);
  if (tient) return tient.replace(/[.,;]+$/, "");
  // Sinon : les premiers mots, coupés proprement (un « : » isolé entre deux mots gardés reste).
  const plein = (j: string) => /[\p{L}\p{N}€%]/u.test(j);
  const gardes: string[] = [];
  let compte = 0;
  for (const j of propre.split(" ")) {
    if (plein(j) && compte === MOTS_COUVERTURE_MAX) break;
    gardes.push(j);
    if (plein(j)) compte++;
  }
  while (gardes.length > 1 && (!plein(gardes.at(-1)!) || !finAcceptable(gardes.at(-1)!))) gardes.pop();
  return gardes.join(" ").replace(/[,;:]+$/, "");
}

/** Code interne en tête d'un titre de vidéo : « 0005-FC-TT-L · sujet ». */
const CODE_INTERNE = /^\s*\d{3,5}(?:-[A-Z0-9]{1,4}){2,4}\s*[·•]\s*/i;
/** Suffixe de version : « — v5 », « - v2 », « (v3) ». */
const SUFFIXE_VERSION = /\s*(?:[—–-]\s*v\d+|\(\s*v\d+\s*\))\s*$/i;

/** Vrai si le titre commence par un code interne (« 0005-FC-TT-L · … ») : jamais écrit sur une couverture. */
export function titreCommenceParCodeInterne(titre: string): boolean {
  return CODE_INTERNE.test(titre);
}

/** Titre nettoyé pour une couverture : sans code interne en tête ni suffixe de version. PUR. */
export function titreSansCodeInterne(titre: string): string {
  return titre.replace(/\s+/g, " ").trim().replace(CODE_INTERNE, "").replace(SUFFIXE_VERSION, "").trim();
}

/**
 * Instants ramenés HORS des sous-titres (quand l'image source est la vidéo finale, faute de vidéo sans texte) : un
 * instant tombant dans un groupe de sous-titres glisse au bord libre le plus proche (0,15 s de marge), dans la vidéo.
 * Un instant qui ne trouve aucun bord libre reste tel quel. PUR.
 */
export function instantsHorsSousTitres(instants: number[], segments: { debutSec: number; finSec: number }[], dureeSec: number): number[] {
  const marge = 0.15;
  const min = Math.min(MARGE_DEBUT_SEC, dureeSec / 3);
  const max = Math.max(min, dureeSec - Math.min(MARGE_FIN_SEC, dureeSec / 4));
  const dedans = (t: number) => segments.some((g) => t >= g.debutSec - marge && t <= g.finSec + marge);
  // Candidats : bords libres des groupes et milieu de chaque trou entre deux groupes.
  const tries = [...segments].sort((a, b) => a.debutSec - b.debutSec);
  const candidats: number[] = [];
  let fin = 0;
  for (const g of [...tries, { debutSec: dureeSec, finSec: dureeSec }]) {
    const debutTrou = fin + marge + 0.05;
    const finTrou = g.debutSec - marge - 0.05;
    if (finTrou >= debutTrou) candidats.push(debutTrou, (debutTrou + finTrou) / 2, finTrou);
    fin = Math.max(fin, g.finSec);
  }
  const libres = candidats.map(arrondi).filter((c) => c >= min && c <= max && !dedans(c));
  const retenus: number[] = [];
  for (const t of instants) {
    let choix = t;
    if (dedans(t)) {
      const proche = libres.filter((c) => retenus.every((r) => Math.abs(r - c) >= 0.5)).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0];
      if (proche !== undefined) choix = proche;
    }
    retenus.push(choix);
  }
  return retenus;
}

/**
 * Mot (ou groupe) mis en valeur sur la couverture : un nombre d'abord (« 135 € », « 45 jours » → « 135 € »),
 * sinon le mot plein le plus long (le dernier à longueur égale). Vide si rien ne s'y prête.
 */
export function motCleCouverture(couverture: string): string {
  const liste = couverture.split(/\s+/).filter(Boolean);
  const iNombre = liste.findIndex((m) => /\d/.test(m));
  if (iNombre >= 0) {
    const suivant = liste[iNombre + 1];
    return suivant && /^[€%$]$/.test(suivant) ? `${liste[iNombre]} ${suivant}` : liste[iNombre].replace(/[,;:!?.]+$/, "");
  }
  let meilleur = "";
  for (const m of liste) {
    const n = motNormalise(m);
    if (n.length < 4 || MOTS_OUTILS.has(n)) continue;
    // Sans élision (« l'erreur » → « erreur ») : c'est le mot qui est mis en valeur.
    if (n.length >= motNormalise(meilleur).length) meilleur = m.replace(/^[«"“(]+|[,;:!?.»"”)]+$/g, "").replace(/^(?:qu|[cdjlmnst])['’]/i, "");
  }
  return meilleur;
}

/** Ce qu'il faut d'un plan pour choisir les instants. */
export interface PlanInstant {
  debutSec: number;
  finSec: number;
  sourceImage: SourceImage;
}

/** Bornes des instants : jamais la première seconde (ouverture), ni la toute fin (fondu). */
export const MARGE_DEBUT_SEC = 1;
export const MARGE_FIN_SEC = 0.8;
/** Écart minimal entre deux instants (trois images vraiment différentes). */
export const ECART_MIN_SEC = 1.5;

const arrondi = (s: number) => Math.round(s * 100) / 100;

/**
 * Les 3 instants où chercher une miniature, du MEILLEUR au moins bon (le premier devient la miniature choisie) :
 *   1. l'instant de couverture choisi par le générateur, s'il existe ;
 *   2. le cœur des plans où l'on voit la personne (double ou prise filmée), les plus longs d'abord ;
 *   3. les autres plans (illustrations), puis des repères réguliers (30 %, 55 %, 80 %).
 * Instants à 1,5 s au moins les uns des autres, dans [1 s ; fin − 0,8 s]. PUR.
 */
export function instantsMiniature(plans: PlanInstant[], dureeSec: number, prefere?: { debutSec: number; finSec: number }, nombre = 3): number[] {
  const min = Math.min(MARGE_DEBUT_SEC, dureeSec / 3);
  const max = Math.max(min, dureeSec - Math.min(MARGE_FIN_SEC, dureeSec / 4));
  const borne = (s: number) => arrondi(Math.min(max, Math.max(min, s)));
  const ecart = Math.min(ECART_MIN_SEC, Math.max(0.2, (max - min) / (nombre + 1)));
  const retenus: number[] = [];
  const proposer = (s: number) => {
    if (retenus.length >= nombre || !Number.isFinite(s)) return;
    const b = borne(s);
    if (retenus.every((r) => Math.abs(r - b) >= ecart)) retenus.push(b);
  };
  if (prefere && prefere.finSec > prefere.debutSec) proposer((prefere.debutSec + prefere.finSec) / 2);
  // Au cœur du plan, un peu après le milieu : la phrase est lancée, l'expression posée.
  const coeur = (p: PlanInstant) => p.debutSec + (p.finSec - p.debutSec) * 0.55;
  const parLongueur = (a: PlanInstant, b: PlanInstant) => b.finSec - b.debutSec - (a.finSec - a.debutSec) || a.debutSec - b.debutSec;
  const valides = plans.filter((p) => p.finSec > p.debutSec && p.finSec > min && p.debutSec < max);
  for (const p of valides.filter((x) => x.sourceImage === "double" || x.sourceImage === "rush").sort(parLongueur)) proposer(coeur(p));
  for (const p of valides.filter((x) => x.sourceImage !== "double" && x.sourceImage !== "rush").sort(parLongueur)) proposer(coeur(p));
  for (const f of [0.3, 0.55, 0.8, 0.42, 0.68, 0.15, 0.92]) proposer(dureeSec * f);
  return retenus;
}
