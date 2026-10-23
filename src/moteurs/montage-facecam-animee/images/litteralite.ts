/**
 * MINI-VIDÉOS — LITTÉRALITÉ D'UNE SCÈNE DE REMPLACEMENT, PUR (passe 4, revue passe 3 point 3).
 *
 * Vidéo 4 : 3 fenêtres (1, 4 et 8) ont été remplies par une scène de remplacement qui ne reprenait AUCUN mot dit
 * (« homme qui travaille tard le soir » pour « vos journées n'en finissent plus »). Toute scène qui remplace la
 * recherche du réalisateur (autre scène demandée, scène de secours) passe donc les MÊMES contrôles que le plan
 * (`verifierPlan`, section fenêtres) AVANT d'être cherchée :
 *  - 3 mots porteurs au moins (sujet + action + lieu) ;
 *  - au moins un mot dit repris (même racine sur 4 lettres ; « IA » comptée) ;
 *  - aucune MÉTAPHORE non dite (horloge, sablier, goutte…) ;
 *  - la personne et l'action nommées par la phrase sont montrées (`exigencesScene`) ;
 *  - une action qui se FILME (pas « sent », « pense »…), et une action tout court.
 * Une scène refusée n'est jamais cherchée ; le motif est rendu au réalisateur pour sa proposition suivante.
 *
 * SCÈNES DE SECOURS (`scenesDeSecours`) : quand le réalisateur n'a plus de proposition, des scènes filmables écrites
 * d'avance pour les mots du métier (temps, journée, équipe, formation, accompagnement…) ; elles aussi passent le contrôle.
 */
import { EPS } from "@/briques/intensite/orchestrateur";
import { exigencesScene, metaphoresDe, motsSimples, racinesDe, sceneDe, SEUILS } from "../realisateur/regles";


/** Mots dits autour d'une fenêtre (2 s avant, 1 s après), simplifiés : ils autorisent un objet DIT (« la fuite » → robinet). */
export function ditsAutour(mots: readonly { w: string; a: number }[] | undefined, debut: number, fin: number): string[] {
  if (!mots?.length) return [];
  return mots.filter((m) => m.a >= debut - SEUILS.illustreAvantSec - EPS && m.a <= fin + SEUILS.illustreApresSec + EPS).flatMap((m) => motsSimples(m.w));
}

const avecIa = (t: string) => /(^|[\s'’])ia\b/i.test(t);

/**
 * Défauts de littéralité d'une scène pour les mots dits `illustre` (liste vide : la scène est permise).
 * Les mêmes règles que `verifierPlan` pour une fenêtre : une scène qui passe ici ne fait aucune erreur de fenêtre au plan.
 */
export function controleScene(scene: string, illustre: string | undefined, dits: readonly string[] = []): string[] {
  const defauts: string[] = [];
  const porteurs = racinesDe(scene);
  if (porteurs.length < SEUILS.rechercheMotsMin) defauts.push(`trop vague (${porteurs.length} mot(s) porteur(s), ${SEUILS.rechercheMotsMin} au moins : sujet + action + lieu)`);
  else if (illustre?.trim() && !porteurs.some((r) => racinesDe(illustre).some((x) => x.slice(0, 4) === r.slice(0, 4))) && !(avecIa(scene) && avecIa(illustre))) {
    defauts.push(`ne reprend aucun mot dit (« ${illustre} »)`);
  }
  // Les mots de « illustre » sont dits par définition (contrôlé au plan) : ils comptent parmi les mots dits.
  const metaphores = metaphoresDe(scene, [...dits, ...motsSimples(illustre ?? "")]);
  if (metaphores.length) defauts.push(`métaphore non dite (${metaphores.join(", ")})`);
  if (illustre?.trim()) {
    for (const x of exigencesScene(illustre, scene)) defauts.push(x.quoi === "personne" ? `ne montre pas de personne (la phrase dit « ${x.mot} »)` : `ne montre pas l'action « ${x.quoi} » (la phrase dit « ${x.mot} »)`);
  }
  if (porteurs.length >= SEUILS.rechercheMotsMin) {
    const sc = sceneDe(scene);
    if (sc.invisible) defauts.push(`action qui ne se filme pas (« ${sc.invisible} »)`);
    else if (!sc.action) defauts.push("ne dit pas ce qui se passe à l'image (qui fait quoi)");
  }
  return defauts;
}

/**
 * Scènes filmables écrites d'avance, par mot dit (sans accents). Chacune reprend le mot dit, montre une personne qui
 * FAIT quelque chose, dans un lieu ; aucune métaphore. Elles servent après les propositions du réalisateur.
 */
export const SCENES_DE_SECOURS: readonly { dit: RegExp; scenes: readonly string[] }[] = Object.freeze([
  { dit: /\btemps\b|\bheures?\b|echapp/, scenes: ["dirigeant pressé par le temps qui marche vite dans un couloir de bureau", "gérant qui regarde sa montre, pressé par le temps, au bureau", "salariée qui court contre le temps entre deux dossiers au bureau"] },
  { dit: /journees?|\bjours?\b|n.?en finissent/, scenes: ["gérant qui prolonge ses journées en travaillant tard au bureau", "dirigeant qui finit ses journées tard devant son ordinateur au bureau"] },
  { dit: /\bsoirs?\b|soirees?|\bnuit\b/, scenes: ["dirigeant qui travaille le soir sur son ordinateur au bureau", "gérante qui tape ses devis le soir au bureau"] },
  { dit: /forme|formation|formateur|formatrice/, scenes: ["formatrice qui forme des salariés devant un écran en salle", "formateur qui forme une équipe autour d'une table en salle de réunion"] },
  { dit: /equipes?/, scenes: ["équipe qui travaille ensemble autour d'une table au bureau", "équipe qui discute autour d'un ordinateur au bureau"] },
  { dit: /accompagn|one.?to.?one|tete.?a.?tete|individuel/, scenes: ["consultant qui accompagne un dirigeant en tête-à-tête au bureau", "consultante qui accompagne une gérante devant un ordinateur au bureau"] },
  { dit: /\baudit/, scenes: ["consultant qui audite des documents avec un dirigeant au bureau", "consultante qui fait un audit des dossiers sur ordinateur au bureau"] },
  { dit: /commenc|demarr|propos/, scenes: ["consultant qui commence un rendez-vous avec un gérant au bureau", "consultante qui propose un plan à un dirigeant autour d'une table au bureau"] },
  { dit: /diagnostic/, scenes: ["consultant qui fait un diagnostic des documents d'un gérant au bureau"] },
  { dit: /fuite/, scenes: ["consultant qui cherche la fuite dans les comptes avec un dirigeant au bureau", "plombier qui cherche une fuite sous un évier dans une cuisine"] },
  { dit: /recrut|embauch/, scenes: ["dirigeant qui fait passer un entretien d'embauche au bureau", "recruteuse qui reçoit un candidat en entretien d'embauche au bureau"] },
  { dit: /apres.?midi|\bmidi\b/, scenes: ["salariés qui quittent le bureau en souriant l'après-midi", "collègues qui sortent du bureau ensemble l'après-midi"] },
  { dit: /week.?end|vacances|conges?/, scenes: ["père qui joue avec ses enfants au parc le week-end", "famille qui se promène dans un parc le week-end"] },
  { dit: /reserv|rendez.?vous|\bappel\b/, scenes: ["personne qui réserve un rendez-vous sur son téléphone au bureau", "femme qui réserve un appel sur son smartphone au bureau"] },
  { dit: /\bgroupes?\b/, scenes: ["salariés d'un grand groupe qui travaillent en open space au bureau", "salariés d'un groupe en réunion dans une grande salle"] },
  { dit: /structures?|entreprises?|\bpme\b|artisan/, scenes: ["artisans d'une petite entreprise qui travaillent ensemble dans leur atelier", "employés d'une petite entreprise qui travaillent ensemble au bureau"] },
  { dit: /\bdevis\b/, scenes: ["gérante qui rédige un devis sur son ordinateur au bureau"] },
  { dit: /factur/, scenes: ["comptable qui saisit des factures sur un ordinateur au bureau"] },
  { dit: /client/, scenes: ["commerciale qui reçoit un client autour d'une table au bureau"] },
]);

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ");

/** Scènes de secours pour des mots dits, dans l'ordre de la table, sans celles déjà essayées ; contrôlées (`controleScene`). */
export function scenesDeSecours(illustre: string | undefined, dits: readonly string[] = [], essayees: readonly string[] = []): string[] {
  if (!illustre?.trim()) return [];
  const t = sansAccents(illustre);
  const deja = new Set(essayees.map((s) => s.trim().toLowerCase()));
  const sortie: string[] = [];
  for (const { dit, scenes } of SCENES_DE_SECOURS) {
    if (!dit.test(t)) continue;
    for (const s of scenes) if (!deja.has(s.toLowerCase()) && !sortie.includes(s) && controleScene(s, illustre, dits).length === 0) sortie.push(s);
  }
  return sortie;
}

/**
 * Consigne pour demander une AUTRE scène au réalisateur (production : Opus ; outil local : Claude), avec les scènes
 * déjà essayées et pourquoi elles n'ont rien donné. La réponse est contrôlée par `controleScene` avant toute recherche.
 */
export function consigneAutreScene(d: { illustre?: string; phrase?: string; essayees: readonly string[]; refus: readonly string[] }): string {
  const refus = d.refus.slice(-8).map((r) => `- ${r.slice(0, 220)}`).join("\n");
  return `Tu es le réalisateur d'une courte vidéo verticale où un dirigeant parle face caméra. Une fenêtre doit montrer une MINI-VIDÉO de banque gratuite (Pexels, Pixabay) qui illustre LITTÉRALEMENT ce qui est dit.
Phrase dite : « ${d.phrase ?? d.illustre ?? ""} ».
Mots que la fenêtre illustre : « ${d.illustre ?? d.phrase ?? ""} ».
Scènes déjà essayées sans vidéo qui convienne : ${d.essayees.map((s) => `« ${s} »`).join(", ")}.
Pourquoi les vidéos trouvées ont été refusées :
${refus || "- aucune vidéo trouvée"}
Propose UNE autre scène, plus courante dans les banques de vidéos, qui :
1. reprend au moins un mot dit (même mot ou même famille) ;
2. dit QUI fait QUOI, OÙ (une personne qui fait une action visible, un lieu) : « consultant qui accompagne un dirigeant au bureau » ;
3. ne montre aucun symbole (horloge, sablier, goutte, ampoule…) dont l'objet n'est pas dit ;
4. tient en 60 caractères au plus, en français.
Réponds seulement par la scène, sans guillemets.`;
}
