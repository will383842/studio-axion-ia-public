/**
 * PATRONS DE FORME PAR VIDÉO (écriture du cas concret, 18/10/2026). Chaque vidéo reçoit, de façon déterministe à partir
 * d'une graine, une FORME pour l'accroche, le « avant », la bascule, le résultat et la question finale : deux vidéos, du
 * même cas ou de cas différents, n'ont pas la même. Un patron décrit une FORME, jamais une phrase à recopier.
 *
 * Graine : celle de la variété du motion (`graineDe(videoId)`, `variete.ts`) ; `sel` change à chaque « autre tirage » de la
 * même vidéo (reprise de l'écriture). PUR.
 */
import type { Offre } from "@/formats/cas-concret/cas";
import { structureEffective } from "@/formats/cas-concret/recette";
import { graineDe, hacher32, STRUCTURES, type Structure } from "./variete";

export const ROLES_PATRON = ["accroche", "avant", "bascule", "resultat", "question"] as const;
export type RolePatron = (typeof ROLES_PATRON)[number];

export interface Patron {
  id: string;
  /** La forme à suivre, décrite ; jamais une phrase à recopier. */
  forme: string;
}

export const PATRONS: Readonly<Record<RolePatron, readonly Patron[]>> = {
  // R03 : la promesse du cas, avec tous ses mots pleins et ses nombres, dans les 8 premiers mots dits, avant 3 s.
  accroche: [
    { id: "affirme", forme: "un constat : la promesse du cas dite telle quelle, d'une traite, sans préambule ni « oui »." },
    { id: "question", forme: "une question très courte dont la promesse du cas est la réponse ; la promesse, avec tous ses mots pleins et ses nombres, tient dans les huit premiers mots dits." },
    { id: "contraste", forme: "le gain en tête puis la matière : la promesse du cas coupée en deux temps, le nombre d'abord, ce qu'il couvre ensuite." },
    { id: "scene", forme: "un geste ou un instant précis où le gain se voit, en une image, qui contient tous les mots pleins et les nombres de la promesse du cas." },
    { id: "defi", forme: "la promesse du cas posée comme un défi tenu (« c'est possible ») sans rien promettre de plus que la promesse du cas." },
  ],
  avant: [
    { id: "verbes", forme: "les tâches de <avant> en infinitifs enchaînés d'un souffle, puis le total en une phrase." },
    { id: "scene", forme: "une scène : un lieu, un moment, une personne qui enchaîne les tâches de <avant> (elles restent toutes dites, dans l'ordre)." },
    { id: "question", forme: "les tâches de <avant> posées en questions courtes (« qui s'en charge ? ») ; la dernière phrase donne le total." },
    { id: "cout", forme: "d'abord ce que ça coûtait (le total de <avant>, s'il existe), puis le détail des tâches, une par phrase courte." },
    { id: "lundi", forme: "une journée type racontée au présent : le matin, l'après-midi, le soir, avec chaque tâche de <avant> à sa place." },
  ],
  bascule: [
    { id: "courte", forme: "une bascule de cinq mots au plus, au présent (en posture « offre » : sans « on a » ni « nous »)." },
    { id: "detour", forme: "un court détour qui dit pourquoi les choses ont changé, en deux phrases, avant la première étape." },
    { id: "question", forme: "une question qui ouvre la méthode (« et si… ? » ou « comment… ? ») à laquelle la première étape répond." },
    { id: "constat", forme: "un constat d'une phrase : l'ancienne façon ne tenait plus, il y en avait une autre." },
    { id: "regle", forme: "la règle qui change tout, dite en une phrase simple, sans chiffre ni fait nouveau." },
  ],
  resultat: [
    { id: "chiffre", forme: "le fait chiffré principal du cas en tête, puis ce qu'il change pour la personne." },
    { id: "image", forme: "une comparaison concrète, sans nouveau chiffre : ce qu'on voit maintenant là où on voyait l'ancien désordre." },
    { id: "contraste", forme: "deux phrases courtes qui s'opposent : l'ancien état, puis le nouveau." },
    { id: "libere", forme: "ce que le temps gagné permet de faire à la place, dit simplement." },
    { id: "durable", forme: "ce qui reste vrai chaque jour désormais, au présent, sans promesse de gain garanti." },
  ],
  question: [
    { id: "metier", forme: "une question sur la tâche la plus répétitive du public, dans son métier." },
    { id: "temps", forme: "une question sur le temps que le public perd encore à ce genre de tâche." },
    { id: "choix", forme: "une question de choix entre deux tâches que le public voudrait voir tourner seules." },
    { id: "imaginer", forme: "une courte invitation à imaginer la même situation sans la tâche, puis une question (jamais une invitation à écrire, à cliquer ou à réserver)." },
    { id: "premier", forme: "une question sur la première tâche que le public confierait à une automatisation." },
  ],
};

export type PatronsDeLaVideo = Record<RolePatron, Patron>;

/**
 * Les patrons qui vont avec chaque structure autre que la v4 (les rôles absents acceptent tous leurs patrons). Un patron
 * écarté contredirait la structure : « chiffre » du résultat quand le chiffre n'est plus dit, « lundi » quand la vidéo
 * est déjà une journée, etc.
 */
export const PATRONS_COMPATIBLES: Readonly<Record<Exclude<Structure, "v4-avant-etapes-resultat">, Partial<Record<RolePatron, readonly string[]>>>> = {
  "resultat-d-abord": { accroche: ["affirme", "contraste", "defi"], resultat: ["image", "contraste", "libere", "durable"] },
  "probleme-solution": { avant: ["cout", "question", "verbes"], bascule: ["courte", "constat", "regle"] },
  "une-journee": { accroche: ["affirme", "scene", "contraste"], avant: ["lundi", "scene"], bascule: ["courte", "constat", "detour"], resultat: ["contraste", "libere", "durable"] },
};

/**
 * Les patrons gardés quand le cas a un récit (`cas.recit`) : jamais « c'est possible » (defi), « le nombre d'abord »
 * (contraste d'accroche), le détour, le constat « l'ancienne façon ne tenait plus » ni le choix, que le script recopiait
 * sans les comprendre. Le tableau PATRONS ne change pas (EMPREINTE_PATRONS_V4).
 */
export const PATRONS_AVEC_RECIT: Readonly<Partial<Record<RolePatron, readonly string[]>>> = {
  accroche: ["affirme", "question", "scene"],
  avant: ["scene"],
  bascule: ["courte", "regle", "question"],
  resultat: ["image", "contraste", "libere", "durable"],
  question: ["metier", "imaginer", "premier"],
};

/**
 * Les patrons d'une vidéo : même identifiant (et même `sel`), mêmes patrons. Sans structure ou en v4 : le tirage de
 * toujours ; sinon le même hachage, sur la liste des patrons compatibles avec la structure.
 */
export function patronsDeLaVideo(videoId: string, sel = 0, demandee?: Structure, offre?: Offre, options: { sansChiffre?: boolean; recit?: boolean } = {}): PatronsDeLaVideo {
  const graine = graineDe(`${videoId}#${sel}`);
  // Coaching + « une-journee » : se comporte comme la v4 (voir `structureEffective`).
  const structure = demandee && offre ? structureEffective(offre, demandee) : demandee;
  const compatibles = structure && structure !== STRUCTURES[0] ? PATRONS_COMPATIBLES[structure] : undefined;
  const choisi = (r: RolePatron) => {
    let liste = compatibles?.[r] ? PATRONS[r].filter((p) => compatibles[r]!.includes(p.id)) : PATRONS[r];
    if (options.sansChiffre) {
      // Aucun nombre à dire : pas de « chiffre » en résultat, pas d'accroche « le nombre d'abord », pas de « total » en fin d'avant.
      const ecartes: Partial<Record<RolePatron, readonly string[]>> = { resultat: ["chiffre"], accroche: ["contraste"], avant: ["verbes", "question"] };
      const ecart = ecartes[r];
      if (ecart) liste = liste.filter((p) => !ecart.includes(p.id));
    }
    if (options.recit && PATRONS_AVEC_RECIT[r]) {
      // Un cas qui a un récit : seuls les patrons qui le laissent se comprendre ; si la structure n'en laisse aucun, on garde sa liste.
      const gardes = liste.filter((p) => PATRONS_AVEC_RECIT[r]!.includes(p.id));
      if (gardes.length) liste = gardes;
    }
    return liste[hacher32(`${graine}:${r}`) % liste.length]!;
  };
  return Object.fromEntries(ROLES_PATRON.map((r) => [r, choisi(r)])) as PatronsDeLaVideo;
}

const FORME_DE_STRUCTURE: Readonly<Record<Exclude<Structure, "v4-avant-etapes-resultat">, string>> = {
  "resultat-d-abord":
    "STRUCTURE DE CETTE VIDÉO : le résultat d'abord. Juste après l'accroche, un court écran « resultat » dit le gain obtenu en quelques mots ; la vidéo montre ensuite d'où l'on part, puis comment on y arrive. Pour cette vidéo, le premier écran après l'accroche n'est PAS un écran « chiffre » : c'est le « resultat » court de cette structure (3 à 6 mots dits), qui porte son titre et ses deux barres avant / maintenant tirées des faits du cas (cas sans fait chiffré : leurs libellés seuls, sans nombre). Pas d'écran « chiffre » : le gain est dit par l'accroche et par ce premier résultat. Le dernier écran « resultat » vient après la dernière étape et redit le gain autrement, sans nouveau chiffre.",
  "probleme-solution":
    "STRUCTURE DE CETTE VIDÉO : le problème, puis la solution. Après l'accroche, la liste « avant » est un vrai problème : ce que chaque tâche coûte, tâche par tâche, le total en dernier s'il existe. Une phrase pose ensuite la solution, puis les étapes la déroulent. Pas d'écran « chiffre ».",
  "une-journee":
    "STRUCTURE DE CETTE VIDÉO : une journée. La liste « avant » raconte une journée type au présent, chaque tâche à son moment ; la bascule reprend la même journée, depuis que c'est en place ; chaque étape prend place dans cette journée, sans heure chiffrée sauf si un fait la donne ; le dernier écran « resultat » dit comment la journée finit. Pas d'écran « chiffre ».",
};

const RAPPEL_R04 =
  "Les règles d'ordre restent vraies : l'accroche vient en premier ; la liste « avant » commence avant six secondes ; un écran « titre » sépare la liste de la première étape ; ce qui reste humain vient après la première étape ; le dernier écran « resultat » suit la dernière étape ; la question est le dernier écran, et il n'y en a qu'une. Cette description donne une FORME, jamais une phrase à recopier.";

/** La structure en mots pour la partie variable de l'écriture ; `null` pour la v4 (rien n'est ajouté, rien n'est repayé). */
export function blocStructure(demandee: Structure, offre?: Offre): string | null {
  const structure = offre ? structureEffective(offre, demandee) : demandee;
  if (structure === STRUCTURES[0]) return null;
  return `${FORME_DE_STRUCTURE[structure]}\n${RAPPEL_R04}`;
}

const NOMS_ROLE: Record<RolePatron, string> = { accroche: "accroche (e01)", avant: "« avant »", bascule: "bascule", resultat: "résultat", question: "question finale" };

/** Le bloc de la consigne : la forme choisie pour cette vidéo, rôle par rôle. */
export function blocPatrons(p: PatronsDeLaVideo): string {
  return [
    "FORME POUR CETTE VIDÉO (une description de la FORME à suivre, jamais une phrase à recopier ; toutes les règles ci-dessus restent vraies) :",
    ...ROLES_PATRON.map((r) => `- ${NOMS_ROLE[r]} : ${p[r].forme}`),
  ].join("\n");
}

const PLACES_RESTE_HUMAIN = [
  "juste après la première étape",
  "au milieu des étapes (après l'étape du milieu)",
  "juste après la dernière étape, avant le résultat",
] as const;

/**
 * Où dire ce qui reste humain, quand le cas ne fixe pas sa place (R04 : après la première étape ; R23 : à sa place si
 * `resteHumainApresEtape` est donné, auquel cas rien n'est libre : `null`). Ordre des blocs : seule variation permise.
 */
export function placeDuResteHumain(videoId: string, sel: number, resteHumainApresEtape: number | undefined, nbEtapes: number): string | null {
  if (resteHumainApresEtape !== undefined || nbEtapes < 2) return null;
  return PLACES_RESTE_HUMAIN[hacher32(`${graineDe(`${videoId}#${sel}`)}:reste`) % PLACES_RESTE_HUMAIN.length]!;
}
