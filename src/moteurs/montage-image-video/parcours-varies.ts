/**
 * IMAGE → VIDÉO · Parcours VARIÉS par type d'image (diversité entre les vidéos). PUR : aucune entrée-sortie.
 *
 * `recettes.ts` pose les huit types sur UNE seule ossature et UN seul parcours d'explication ; deux vidéos du même type
 * ont donc le même squelette de scènes. Ici, chaque type a au moins trois parcours ALTERNATIFS (plus le parcours de
 * référence de `recettes.ts`, gardé comme candidat), tirés avec la graine (sha256 de l'id vidéo) et écartés s'ils ont
 * servi aux trois dernières vidéos. Rien de ce qui est contrôlé ne change : mêmes six parties dans l'ordre, mêmes
 * scènes permises (`scenesPermises`), même annonce du nombre pour les types qui l'annoncent, même phrase-choc.
 *
 * Deuxième levier : la liste des scènes à ÉVITER, calculée d'après les squelettes des trois dernières vidéos et dite à
 * Claude (`consigneAEviter`). Le contrôle de ressemblance des scènes vit dans `ressemblance-scenes.ts`.
 */
import { createHash } from "node:crypto";
import type { CarteImage, TypeImage } from "@/domaine/image-video/carte";
import type { FicheImage, Scene } from "@/domaine/image-video/fiche";
import { RECETTES, SCENES_COMMUNES, scenesPermises } from "./recettes";

/** Vidéos récentes qui comptent pour l'anti-répétition (parcours et scènes). */
export const VIDEOS_RECENTES_PARCOURS = 3;
/** Scènes permises qui restent toujours libres : la liste à éviter n'en prend jamais plus. */
export const SCENES_LIBRES_MIN = 7;
/** Code du parcours de `recettes.ts`, candidat comme les autres. */
export const CODE_PARCOURS_REFERENCE = "reference";

export interface ParcoursVarie {
  /** Code stable (gardé dans l'état de la fabrication). */
  code: string;
  /** Parcours dit à Claude à la place de celui de `recettes.ts` (écrit en mots, sans chiffre). */
  parcours: string;
  /** Scènes que ce parcours met en avant : toujours des scènes permises pour le type. */
  scenes: readonly Scene[];
}

/** Squelette d'une vidéo passée : le parcours tiré (s'il est connu) et la suite de ses scènes. */
export interface SqueletteRecent {
  parcours?: string;
  scenes: readonly Scene[];
}

const P = (code: string, scenes: readonly Scene[], parcours: string): ParcoursVarie => ({ code, scenes, parcours });

/**
 * Parcours alternatifs. Chaque texte garde l'accroche au début, la phrase-choc à la fin et, pour les types qui annoncent
 * un nombre, l'annonce AVANT le premier élément (Q07) ; une explication de processus reste dans l'ordre réel.
 */
export const PARCOURS_VARIES: Readonly<Record<TypeImage, readonly ParcoursVarie[]>> = Object.freeze({
  benefices: [
    P("benefices-cas", ["micro-objet", "titre", "carte-benefice", "ensemble"], "accroche en question en « vous » → douleur vécue, posée par un micro-objet → début de réponse qui annonce le nombre quand <annonce> le donne → pour chaque bénéfice, le micro-objet qui le joue vient d'abord, puis la phrase titre, puis la phrase concrète → vue d'ensemble des cartes → résultat → phrase-choc"),
    P("benefices-cartes", ["carte-benefice", "toile", "bandeau-chiffres"], "accroche par un compte ou un chiffre → douleur en deux phrases courtes → début de réponse qui annonce le nombre quand <annonce> le donne → les cartes se posent une à une, chacune dite en une seule phrase concrète, sans reprendre le titre → toile qui les relie → bandeau de chiffres → phrase-choc"),
    P("benefices-avant", ["alerte", "email", "carte-benefice", "micro-objet"], "accroche d'alerte qui montre le problème → douleur → début de réponse qui annonce le nombre quand <annonce> le donne → chaque bénéfice dit en deux temps : ce qui se passait avant, puis ce qui se passe maintenant (seulement si l'image le montre), avec un micro-objet pour appuyer → résultat → phrase-choc"),
  ],
  chaine: [
    P("chaine-fil", ["toile", "micro-objet", "titre"], "accroche par une situation précise → douleur → début de réponse qui annonce le nombre d'étapes quand <annonce> le donne → le fil avance d'étape en étape, chaque étape ouverte par un micro-objet, le repère en haut → résultat chiffré → phrase-choc"),
    P("chaine-ecran", ["email", "dossiers", "alerte", "recherche"], "accroche par un chiffre → douleur → début de réponse qui annonce le nombre d'étapes quand <annonce> le donne → chaque étape est un écran du quotidien (e-mail, dossier, alerte, recherche) qui montre ce qui arrive, dans l'ordre réel → vue d'ensemble de la chaîne → résultat → phrase-choc"),
    P("chaine-titres", ["titre", "chiffre", "ensemble"], "accroche en question → douleur dite sur fond ivoire → début de réponse qui annonce le nombre d'étapes quand <annonce> le donne → chaque étape ouvre sur son titre court, puis une phrase qui dit ce qui se passe, jamais deux étapes dans le même écran → vue d'ensemble → résultat → phrase-choc"),
  ],
  embranchement: [
    P("embranchement-decision", ["embranchement", "micro-objet", "titre"], "accroche par une situation → douleur → début de réponse : l'entrée et la décision, puis l'annonce des chemins quand <annonce> le donne, avant la première branche → branche majoritaire jusqu'au bout, retour visible au nœud de décision, puis branche minoritaire → vue d'ensemble → bandeau de chiffres → phrase-choc"),
    P("embranchement-cas", ["email", "alerte", "embranchement", "dossiers"], "accroche par une heure ou un message → douleur → début de réponse qui annonce les chemins quand <annonce> le donne → on suit un message qui arrive (écran e-mail ou alerte), il atteint la décision, puis chaque branche se joue avec ses dossiers ; la branche majoritaire passe d'abord → résultat → phrase-choc"),
    P("embranchement-ensemble", ["ensemble", "embranchement", "toile", "bandeau-chiffres"], "accroche par un chiffre → douleur → début de réponse qui annonce les chemins quand <annonce> le donne, avant la première branche → branche majoritaire en gros plan, retour au nœud de décision, puis branche minoritaire → vue d'ensemble de l'arbre en toile → bandeau de chiffres → phrase-choc"),
  ],
  entonnoir: [
    P("entonnoir-pluie", ["nuee", "entonnoir", "bandeau-chiffres"], "accroche par le volume → douleur → « et si l'IA faisait le tri ? » → les objets tombent en nuée au rythme de la voix, puis l'entonnoir les range → chaque sortie dite avec son compte et son pourcentage → bandeau → phrase-choc"),
    P("entonnoir-tri", ["recherche", "entonnoir", "dossiers", "micro-objet"], "accroche par une recherche qui n'aboutit pas → douleur → début de réponse : l'IA fait le tri → un objet à la fois passe dans l'entonnoir sous les yeux, chaque sortie finit dans son dossier avec son compte et son pourcentage → bandeau → phrase-choc"),
    P("entonnoir-sorties", ["entonnoir", "titre", "chiffre", "ensemble"], "accroche en question → douleur → début de réponse : le tri → l'entonnoir d'abord entier, montré en une phrase courte, puis chaque sortie ouvre sur son titre, son compte et son pourcentage dits dans cet ordre → vue d'ensemble des sorties → phrase-choc"),
  ],
  "avant-apres": [
    P("avant-apres-partage", ["ecran-partage", "additionneur", "bandeau-chiffres"], "accroche par le chiffre avant le plus douloureux → avant entier, chiffres qui s'additionnent → bascule « Maintenant… » → après entier → écran partagé : les deux côtés face à face → duel de chiffres → phrase-choc"),
    P("avant-apres-sources", ["sources", "additionneur", "titre", "ensemble"], "accroche par un chiffre → les sources de l'avant en rafale, une par mot, les chiffres s'additionnent → bascule « Maintenant… » → l'après se range d'un seul geste → vue d'ensemble → duel de chiffres → phrase-choc"),
    P("avant-apres-contraste", ["alerte", "email", "ecran-partage", "micro-objet"], "accroche d'alerte sur l'avant → avant joué par un e-mail ou une alerte, ses chiffres dits un à un → bascule « Maintenant… » → après joué par un micro-objet qui remplace le désordre → écran partagé en conclusion → duel de chiffres → phrase-choc"),
  ],
  convergence: [
    P("convergence-rafale", ["sources", "toile", "ensemble"], "accroche par la dispersion → sources en rafale, une par mot → elles se rejoignent sur la toile → l'IA au centre → sortie → résultat → phrase-choc"),
    P("convergence-cas", ["email", "dossiers", "recherche", "sources"], "accroche par une recherche qui traîne → chaque source apparaît sous la forme de son écran du quotidien (e-mail, dossier, recherche) → elles se rassemblent au centre → sortie → résultat → phrase-choc"),
    P("convergence-titres", ["titre", "chiffre", "bandeau-chiffres"], "accroche par un chiffre → douleur → les sources s'annoncent par leur titre court, une par phrase → le point de rencontre → sortie → bandeau de chiffres → phrase-choc"),
  ],
  "tableau-de-bord": [
    P("tableau-focus", ["chiffre", "bandeau-chiffres", "alerte"], "accroche par l'indicateur le plus parlant → douleur → deux ou trois indicateurs dits un à un, chacun plein écran, les autres seulement affichés → le point d'attention en alerte → résultat → phrase-choc"),
    P("tableau-recherche", ["recherche", "toile", "ensemble"], "accroche par une question que le tableau tranche → douleur → la recherche dans le tableau, la toile qui montre où regarder → deux ou trois indicateurs dits, les autres affichés → vue d'ensemble → phrase-choc"),
    P("tableau-comparaison", ["titre", "chiffre", "bandeau-chiffres"], "accroche par l'indicateur qui tranche avec un autre → douleur → deux ou trois indicateurs dits, par paire ou seuls, titre court puis chiffre, les autres seulement affichés → point d'attention → résultat → phrase-choc"),
  ],
  chronologie: [
    P("chronologie-frise", ["toile", "chiffre", "titre"], "accroche par une heure → douleur → la frise avance, chaque heure dite dans l'ordre avec son titre court → résultat → phrase-choc"),
    P("chronologie-journee", ["micro-objet", "email", "alerte", "ensemble"], "accroche par la première heure de la journée → douleur → chaque heure est jouée par un micro-objet, un e-mail ou une alerte, dans l'ordre réel → vue d'ensemble de la journée → résultat → phrase-choc"),
    P("chronologie-avant-apres", ["chiffre", "bandeau-chiffres", "ensemble"], "accroche par l'heure la plus parlante → douleur → les heures défilent dans l'ordre, chacune dite avec un seul chiffre à l'écran → la frise entière → bandeau de chiffres → phrase-choc"),
  ],
});

// ─── Tirage ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const rang = (cle: string, n: number) => parseInt(createHash("sha256").update(cle).digest("hex").slice(0, 12), 16) % n;
/** Essais au plus avant de garder le moins récent (aucun blocage, jamais). */
const ESSAIS_MAX = 40;

/** Candidats d'un type : le parcours de référence, puis les alternatifs. */
export function candidatsParcours(type: TypeImage): ParcoursVarie[] {
  return [{ code: CODE_PARCOURS_REFERENCE, parcours: RECETTES[type].parcours, scenes: RECETTES[type].scenes }, ...PARCOURS_VARIES[type]];
}

/** Parcours d'un type d'après son code ; `null` si le code est inconnu ou celui de la référence. */
export function parcoursDeCode(type: TypeImage, code: string | undefined): ParcoursVarie | null {
  if (!code || code === CODE_PARCOURS_REFERENCE) return null;
  return PARCOURS_VARIES[type].find((p) => p.code === code) ?? null;
}

/**
 * Parcours de la vidéo : même graine, même type, même historique → même parcours. Un parcours employé par l'une des
 * trois dernières vidéos est écarté ; si tous le sont (historique plus riche que le choix), le moins récemment employé.
 * `historique` : la plus récente d'abord.
 */
export function tirerParcoursIV(o: { graine: string; type: TypeImage; historique?: readonly { parcours?: string }[] }): string {
  const candidats = candidatsParcours(o.type);
  const recents = (o.historique ?? []).slice(0, VIDEOS_RECENTES_PARCOURS).map((h) => h.parcours ?? CODE_PARCOURS_REFERENCE);
  for (let k = 0; k < ESSAIS_MAX; k++) {
    const c = candidats[rang(`${o.graine}|parcours|${k}`, candidats.length)]!;
    if (!recents.includes(c.code)) return c.code;
  }
  const dernierRang = (code: string) => {
    const i = recents.indexOf(code);
    return i < 0 ? Infinity : i;
  };
  return [...candidats].sort((a, b) => dernierRang(b.code) - dernierRang(a.code))[0]!.code;
}

// ─── Scènes à éviter ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Squelette d'une fiche : la suite des scènes de ses écrans. */
export const squeletteDe = (fiche: Pick<FicheImage, "ecrans">): Scene[] => fiche.ecrans.map((e) => e.scene);

/**
 * Scènes à ne pas reprendre : celles déjà employées dans au moins deux des trois derniers squelettes (une seule s'il
 * n'en existe qu'un), parmi les scènes COMMUNES permises. Jamais l'accroche, la phrase-choc, les scènes propres au type ni celles du parcours tiré ; il reste
 * au moins `SCENES_LIBRES_MIN` scènes libres. `historique` : la plus récente d'abord.
 */
export function scenesAEviter(o: { types: readonly TypeImage[]; parcoursScenes?: readonly Scene[]; historique: readonly Pick<SqueletteRecent, "scenes">[] }): Scene[] {
  const recents = o.historique.slice(0, VIDEOS_RECENTES_PARCOURS);
  if (!recents.length) return [];
  const seuil = Math.min(2, recents.length);
  const protegees = new Set<Scene>(["phrase-choc", "accroche", ...o.types.flatMap((t) => RECETTES[t].scenes), ...(o.parcoursScenes ?? [])]);
  const permises = scenesPermises(o.types);
  const compte = new Map<Scene, number>();
  for (const s of recents) for (const sc of new Set(s.scenes)) compte.set(sc, (compte.get(sc) ?? 0) + 1);
  const ordreCommun = new Map(SCENES_COMMUNES.map((s, i) => [s, i]));
  const candidates = [...compte]
    .filter(([sc, n]) => n >= seuil && permises.has(sc) && !protegees.has(sc))
    .sort((a, b) => b[1] - a[1] || (ordreCommun.get(a[0]) ?? 99) - (ordreCommun.get(b[0]) ?? 99))
    .map(([sc]) => sc);
  return candidates.slice(0, Math.max(0, permises.size - SCENES_LIBRES_MIN));
}

/** Consigne dite à Claude (dans la partie variable, sous la balise `<a_eviter>`) ; vide s'il n'y a rien à éviter. */
export function consigneAEviter(scenes: readonly Scene[]): string {
  if (!scenes.length) return "";
  return `Scènes déjà très employées dans les dernières vidéos : ${scenes.map((s) => `« ${s} »`).join(", ")}. Varie l'enchaînement : n'emploie pas ces scènes, ou une seule fois si le contenu l'exige, et préfère les autres scènes de <scenes>. Les parties, leur ordre et la phrase-choc ne changent pas.`;
}

// ─── Historique ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** État minimal d'une fabrication passée (forme de `EtatFabricationIV`, sans l'importer). */
export interface EtatPourSquelette {
  etape: string;
  demande: { videoId: string };
  parcours?: { code: string };
  script?: { fiche: Pick<FicheImage, "ecrans"> };
}

/**
 * Squelettes des fabrications PRÊTES (la plus récente d'abord, comme `historiqueVarieteIV`), sans la vidéo en cours,
 * au plus `VIDEOS_RECENTES_PARCOURS`. Une fabrication sans script est sautée.
 */
export function squelettesRecentsIV(etats: readonly EtatPourSquelette[], videoId?: string): SqueletteRecent[] {
  return etats
    .filter((e) => e.etape === "prete" && e.script && e.demande.videoId !== videoId)
    .slice(0, VIDEOS_RECENTES_PARCOURS)
    .map((e) => ({ ...(e.parcours ? { parcours: e.parcours.code } : {}), scenes: squeletteDe(e.script!.fiche) }));
}

/** Choix complet d'une vidéo : le code du parcours et les scènes à éviter (gardés dans l'état, une reprise ne retire pas). */
export interface ChoixParcoursIV {
  code: string;
  aEviter: Scene[];
}

export function choisirParcoursIV(o: { graine: string; carte: Pick<CarteImage, "types">; historique?: readonly SqueletteRecent[] }): ChoixParcoursIV {
  const historique = o.historique ?? [];
  const code = tirerParcoursIV({ graine: o.graine, type: o.carte.types[0], historique });
  const tire = candidatsParcours(o.carte.types[0]).find((c) => c.code === code);
  return { code, aEviter: scenesAEviter({ types: o.carte.types, parcoursScenes: tire?.scenes ?? [], historique }) };
}
