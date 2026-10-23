/**
 * VERSION SIMPLE DU MONTEUR — DEMANDES À PLUSIEURS POINTS (vérif V1 du 10/10). PUR.
 *
 * Le 10/10, Will a écrit au monteur : « IL MAnque pplusierus plan de caméra. ET BEAUCOUP D4ANIMATION AU DEBUT; PUIS
 * VERS LA FIN de la video je bégueille et je reprned des memes phrase. fixe ce probleme ». Claude était en panne : la
 * version simple, qui ne lisait qu'UNE règle par message, a répondu « Je n'ai pas compris ». Ici :
 *  - `decouperDemande` : un message → ses points (phrases, « puis », « ensuite »), fautes de frappe lissées (« D4 » tapé
 *    pour « D' » sur un clavier AZERTY) ;
 *  - `operationsComposees` : les demandes d'ensemble qu'une règle mot-clé ne sait pas faire seule — plus de plans de
 *    caméra (changements de cadre répartis), plus d'animations au début (cartes dans les trous), bégaiements et phrases
 *    redites (première tentative coupée), dans la zone dite (« au début », « vers la fin »).
 * Tout est calé sur les index de mots de la transcription vue par le monteur ; rien n'est inventé hors des mots.
 */
import type { OperationFacecam } from "./operations";

/** Mot vu par la version simple : index de la transcription, mot, seconde de la vidéo montée (null : retiré). */
export interface MotSimple {
  index: number;
  mot: string;
  sec: number | null;
}

export interface ContexteRegles {
  mots: MotSimple[];
  /** Éléments déjà posés (cartes, zooms, cartes automatiques), en temps monté. */
  occupes: { debutSec: number; finSec: number; type: string }[];
  /** Ancre d'un point de la demande (« à 0:32 », « quand je dis … ») ; absente : celle du message. */
  ancrer?: (texte: string) => { debutMot: number; finMot: number };
}

export interface PointCompose {
  operations: OperationFacecam[];
  resume: string;
  comprise: boolean;
}

/** Minuscules, sans accents, « D4ANIMATION » → « d animation », espaces simples. */
export function normaliserFrappe(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])4([a-z])/g, "$1 $2")
    .replace(/[’'`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Points sans contenu propre (« fixe ce problème », « merci ») : ils renvoient aux autres points. */
const RENVOI = /^(et )?(fixe|fixer|corrige|corriger|regle|regler|arrange|repare|change|fais|occupe toi de)( moi)? (ce|ca|cela|le|les|tout|ces)( (probleme|problemes|truc|trucs|souci|soucis|ca))?( stp| svp| merci)?$|^(merci|stp|svp|s il te plait|s il vous plait)$/;

/** Un message → ses points : phrases (. ; ! ? retour à la ligne) et « puis », « ensuite », « et aussi ». */
export function decouperDemande(texte: string): string[] {
  return texte
    .split(/[.;!?\n]+|\b(?:puis|ensuite|et aussi|et puis)\b/i)
    .map((p) => p?.trim().replace(/^(et|mais|alors)\s+/i, "").replace(/[,:\s]+$/, ""))
    .filter((p): p is string => !!p && p.length > 1 && !RENVOI.test(normaliserFrappe(p)));
}

/** Morceaux d'un point reliés par « et » (« plus lumineux et bonne mine »). */
export function morceauxEt(point: string): string[] {
  return point.split(/\s+et\s+/i).map((x) => x.trim()).filter((x) => x.length > 1);
}

/** Zone de la vidéo dite dans le point (fraction de la durée montée), ou null. */
export function zoneDite(t: string): [number, number] | null {
  if (/\b(debut|commencement|intro|introduction|premieres? secondes?|accroche)\b/.test(t)) return [0, 0.3];
  if (/\b(fin|conclusion|dernieres? secondes?)\b/.test(t)) return [0.65, 1];
  if (/\bmilieu\b/.test(t)) return [0.3, 0.7];
  return null;
}

/** Plusieurs changements de cadre : « plans de caméra », « plus de zooms », « ça manque de rythme ». */
const DEMANDE_CADRE = /\b(plans? de cam\w*|angles? de cam\w*|changements? de (plan|cadre)s?|cadrages|zooms|rythme|dynamique|dynamisme|mouvements? de cam\w*)\b|\b(plusieurs|plus de|des|d autres|autres|beaucoup de|manque de|manque)\s+(plans?|angles?|zooms?|cadres?)\b/;
/** Plus d'animations : « beaucoup d'animation au début », « plein d'animations », « des cartes ». */
const DEMANDE_ANIMATION = /\b(animations|anims|cartes|visuels)\b|\b(beaucoup|plein|plus|davantage|manque|peu)\s+(d |de |des )?(animation|anim|carte|motion|visuel)/;
/** « enlève les cartes », « moins de zooms », « trop d'animations » : pas une demande d'en ajouter. */
const RETRAIT = /\b(enleve|enlever|retire|retirer|supprime|supprimer|moins|pas de|sans|trop|aucun|aucune)\b/;
const BEGAIEMENT = /\b(beg\w*|bafou\w*|repet\w*|repren\w*|reprned\w*|repris\w*|redi[st]\w*|redit|hesit\w*|bute|butte|bloque|bredouill\w*)\b|\bmemes? phrases?\b|\bdeux fois\b/;

const nettoyerMot = (m: string) => normaliserFrappe(m).replace(/[^a-z0-9]/g, "");
const MOTS_VIDES = new Set(["le", "la", "les", "de", "des", "du", "un", "une", "et", "a", "en", "on", "je", "vous", "que", "qui", "ce", "c", "l", "d", "n", "s"]);

function bornes(ctx: ContexteRegles, zone: [number, number]): { mots: MotSimple[]; debut: number; fin: number } {
  const gardes = ctx.mots.filter((m): m is MotSimple & { sec: number } => m.sec !== null);
  const duree = gardes.length ? gardes[gardes.length - 1].sec : 0;
  const debut = zone[0] * duree;
  // « Au début » : 25 s au plus (une vidéo de 3 min ne s'anime pas sur 54 s).
  const fin = zone[0] === 0 && zone[1] < 1 ? Math.min(zone[1] * duree, 25) : zone[1] * duree + 1;
  return { mots: gardes.filter((m) => m.sec >= debut && m.sec <= fin), debut, fin };
}

const motVers = (mots: MotSimple[], sec: number) => mots.find((m) => (m.sec ?? -1) >= sec);

/** Changements de cadre (punch-in) répartis dans la zone, toutes les 8 à 10 s, loin des zooms déjà posés. */
function changementsDeCadre(ctx: ContexteRegles, zone: [number, number], max = 8, pas = 9): OperationFacecam[] {
  const { mots, debut, fin } = bornes(ctx, zone);
  const zooms = ctx.occupes.filter((o) => o.type === "zoom");
  const ops: OperationFacecam[] = [];
  for (let t = debut + (pas < 9 ? 1.5 : 3); t < fin - 2 && ops.length < max; t += pas) {
    const m = motVers(mots, t);
    if (!m || m.sec === null || zooms.some((z) => Math.abs(z.debutSec - m.sec!) < Math.min(3, pas - 1))) continue;
    const f = motVers(mots, m.sec + 2.5) ?? m;
    ops.push({ type: "zoom", debutMot: m.index, finMot: Math.max(m.index, f.index), style: "punch-in", cible: "visage" });
  }
  return ops;
}

/** Cartes (titre animé de la phrase dite) dans les trous libres de la zone, 3 au plus. */
function animationsDansLaZone(ctx: ContexteRegles, zone: [number, number], max = 3): OperationFacecam[] {
  const { mots } = bornes(ctx, zone);
  const libres = (d: number, f: number, posees: { debutSec: number; finSec: number }[]) => posees.every((o) => f <= o.debutSec - 0.5 || d >= o.finSec + 0.5);
  const posees = ctx.occupes.filter((o) => o.type !== "zoom").map((o) => ({ debutSec: o.debutSec, finSec: o.finSec }));
  const ops: OperationFacecam[] = [];
  mots.forEach((m, k) => {
    if (ops.length >= max || m.sec === null) return;
    const debutPhrase = k === 0 || /[.!?,]$/.test(mots[k - 1].mot);
    if (!debutPhrase || !libres(m.sec, m.sec + 3.5, posees)) return;
    const phrase: MotSimple[] = [];
    for (const x of mots.slice(k)) {
      phrase.push(x);
      if (/[.!?,]$/.test(x.mot) || phrase.length >= 6) break;
    }
    const texte = phrase.map((x) => x.mot).join(" ").replace(/\s+'/g, "'").replace(/\s+-/g, "-").replace(/[.!?,;:]+$/, "");
    if (texte.split(" ").length < 2) return;
    ops.push({ type: "ajouterCarte", debutMot: m.index, finMot: phrase[phrase.length - 1].index, modele: "titre", textes: [texte.charAt(0).toUpperCase() + texte.slice(1)], html: null, disposition: "ecran-partage", description: texte, animationGardeeId: null });
    posees.push({ debutSec: m.sec, finSec: m.sec + 3.5 });
  });
  return ops;
}

/**
 * Phrases redites (bégaiement, reprise) dans la zone : une suite d'au moins 3 mots dite deux fois à moins de 20 s
 * d'écart → la PREMIÈRE tentative est coupée (du premier mot jusqu'au mot avant la reprise). Rend les coupes.
 */
export function phrasesRedites(mots: MotSimple[]): { debutMot: number; finMot: number }[] {
  const gardes = mots.filter((m): m is MotSimple & { sec: number } => m.sec !== null);
  const n = gardes.map((m) => nettoyerMot(m.mot));
  const coupes: { debutMot: number; finMot: number }[] = [];
  let i = 0;
  while (i < gardes.length) {
    let meilleur: { j: number; k: number } | null = null;
    for (let j = i + 3; j < gardes.length && gardes[j].sec - gardes[i].sec <= 20; j++) {
      let k = 0;
      while (j + k < gardes.length && i + k < j && n[i + k] && n[i + k] === n[j + k]) k++;
      const pleins = n.slice(i, i + k).filter((x) => !MOTS_VIDES.has(x)).length;
      if (k >= 3 && pleins >= 2 && (!meilleur || k > meilleur.k)) meilleur = { j, k };
    }
    if (meilleur) {
      coupes.push({ debutMot: gardes[i].index, finMot: gardes[meilleur.j - 1].index });
      i = meilleur.j + meilleur.k;
    } else i++;
  }
  return coupes;
}

/**
 * Une demande d'ensemble (cadre, animations, bégaiements) → ses opérations. `zoneDuPoint` : zone dite dans la phrase
 * entière (« vers la fin … je bégaie et je reprends »). Null : ce n'est pas une demande d'ensemble.
 */
export function operationsComposees(point: string, ctx: ContexteRegles, zoneDuPoint?: [number, number] | null): PointCompose | null {
  const t = normaliserFrappe(point);
  const zone = zoneDite(t) ?? zoneDuPoint ?? null;
  const ou = zone ? (zone[0] === 0 ? " au début" : zone[1] === 1 ? " vers la fin" : " au milieu") : "";
  if (BEGAIEMENT.test(t)) {
    const coupes = phrasesRedites(bornes(ctx, zone ?? [0, 1]).mots);
    if (!coupes.length) return { operations: [], resume: `Je n'ai pas trouvé de phrase redite${ou} : dites-moi à quel moment (par exemple « coupe de 1:41 à 1:50 »).`, comprise: false };
    return { operations: coupes.map((c): OperationFacecam => ({ type: "couper", ...c })), resume: coupes.length > 1 ? `${coupes.length} phrases redites retirées${ou}` : `Phrase redite retirée${ou}`, comprise: true };
  }
  if (RETRAIT.test(t)) return null;
  if (DEMANDE_CADRE.test(t)) {
    const ops = changementsDeCadre(ctx, zone ?? [0, 1]);
    return ops.length ? { operations: ops, resume: `${ops.length} changements de cadre ajoutés${ou}`, comprise: true } : null;
  }
  if (DEMANDE_ANIMATION.test(t)) {
    const z = zone ?? [0, 1];
    const cartes = animationsDansLaZone(ctx, z, zone ? 3 : 5);
    // Cartes déjà partout dans la zone : l'animation passe par des mouvements de cadre plus serrés.
    const ops = cartes.length ? cartes : changementsDeCadre(ctx, z, 4, 4);
    if (!ops.length) return null;
    return { operations: ops, resume: cartes.length ? `${cartes.length} animation${cartes.length > 1 ? "s" : ""} ajoutée${cartes.length > 1 ? "s" : ""}${ou}` : `Mouvements de cadre ajoutés${ou}, entre les cartes déjà posées`, comprise: true };
  }
  return null;
}
