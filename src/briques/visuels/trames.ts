import { PAGES, TYPES_PAGE, type TypePage } from "./registre-pages";

/**
 * Trames par INTENTION (L12) : l'enchaînement des pages d'un carrousel dépend de ce qu'il veut produire chez le lecteur (un déclic, une
 * méthode, une preuve). Cible commune : les TPE et PME qui entendent parler d'IA sans savoir par où commencer. Une étape facultative dont le
 * type n'est pas (encore) au registre est retirée ; sans intention, le moteur garde son comportement d'avant.
 */
export const INTENTIONS = ["eveil", "methode", "preuve"] as const;
export type Intention = (typeof INTENTIONS)[number];

export function estIntention(v: unknown): v is Intention {
  return typeof v === "string" && (INTENTIONS as readonly string[]).includes(v);
}

export interface EtapeTrame {
  /** Type de page ; une chaîne pour annoncer un type à venir (T29). */
  type: string;
  /** Ce que la page apporte dans le plan (consigne au rédacteur). */
  role: string;
  /** Retirée tant que son type n'est pas au registre. */
  facultatif?: true;
}

export interface Trame {
  intention: Intention;
  nom: string;
  but: string;
  etapes: readonly EtapeTrame[];
  /** Consignes d'écriture propres à la trame. */
  ecriture: readonly string[];
}

const RELANCE: EtapeTrame = { type: "T29", role: "relance : une phrase qui remet le lecteur face à sa propre situation avant l'appel", facultatif: true };
const APPEL: EtapeTrame = { type: "T21", role: "appel : la page sombre, posée par le code, invite à écrire en message privé" };

export const TRAMES: Record<Intention, Trame> = {
  eveil: {
    intention: "eveil",
    nom: "Éveil / déclic",
    but: "Faire sentir au lecteur qu'attendre lui coûte déjà, et qu'un premier pas est à sa portée.",
    etapes: [
      { type: "T01", role: "problème : une situation vécue, nommée en peu de mots" },
      { type: "T06", role: "ce qui coince au quotidien : les tâches qui reviennent et pèsent" },
      { type: "T10", role: "coût de l'inaction : ce que l'on perd à attendre, dit sans chiffre" },
      { type: "T22", role: "mythe / réalité : l'idée reçue qui bloque, et ce qu'il en est" },
      { type: "T23", role: "questions à se poser : de quoi situer sa propre entreprise" },
      RELANCE,
      APPEL,
    ],
    ecriture: ["Partir de ce que le lecteur vit, pas de l'outil.", "Le coût de l'inaction se dit en temps, en relances, en occasions manquées : jamais en montant."],
  },
  methode: {
    intention: "methode",
    nom: "Méthode / comment faire",
    but: "Donner un chemin clair, étape par étape, que le lecteur peut suivre dès la semaine suivante.",
    etapes: [
      { type: "T01", role: "promesse : ce que le lecteur saura faire en fin de lecture" },
      { type: "T02", role: "sommaire : les parties du chemin, une carte chacune" },
      { type: "T10", role: "principe à retenir : la règle qui guide toute la méthode" },
      { type: "T20", role: "étapes : la méthode, dans l'ordre, chaque étape avec son geste" },
      { type: "T27", role: "checklist : de quoi vérifier que l'on est prêt" },
      { type: "T08", role: "avant / après : la journée sans la méthode, puis avec" },
      { type: "T28", role: "schéma : le circuit d'une tâche une fois la méthode en place" },
      RELANCE,
      APPEL,
    ],
    ecriture: ["Chaque étape commence par un verbe d'action.", "Rester concret : une tâche réelle du bureau ou de l'atelier à chaque page."],
  },
  preuve: {
    intention: "preuve",
    nom: "Preuve / cas",
    but: "Montrer sur un scénario type ce qui change vraiment, pour que le lecteur s'y reconnaisse.",
    etapes: [
      { type: "T01C", role: "question : celle que le lecteur se pose sur l'IA dans une entreprise comme la sienne" },
      { type: "T26", role: "cas concret : un scénario type inventé et vraisemblable, jamais un client réel" },
      { type: "T24", role: "comparaison sans / avec : les points qui se répondent deux à deux" },
      { type: "T10", role: "ce qui change : le message à retenir du cas" },
      { type: "T08", role: "avant / après : la situation de départ, puis celle d'arrivée" },
      { type: "T27", role: "et chez vous : des affirmations pour se situer" },
      RELANCE,
      APPEL,
    ],
    ecriture: ["Le cas reste un « scénario type » : aucun nom, aucun lieu, aucun résultat chiffré.", "Ce qui change se voit dans le quotidien (moins de ressaisie, réponses plus rapides), sans promesse."],
  },
};

/** Pages chargées (plusieurs éléments à lire) : jamais trois de suite. Un type inconnu du registre compte comme chargé (prudence). */
export const TYPES_DENSES: ReadonlySet<string> = new Set(["T02", "T06", "T20", "T23", "T24", "T26", "T27", "T28"]);
const dense = (t: string) => TYPES_DENSES.has(t) || !(t in PAGES);

const auRegistre = (t: string): t is TypePage => (TYPES_PAGE as readonly string[]).includes(t);

/** Enchaînement des types d'une trame, résolu sur le registre actuel (étapes facultatives absentes retirées). */
export function typesDeLaTrame(intention: Intention): TypePage[] {
  return TRAMES[intention].etapes.filter((e) => !e.facultatif || auRegistre(e.type)).map((e) => e.type as TypePage);
}

/** Écarts d'un enchaînement aux règles de variété (liste vide : conforme). PUR. */
export function ecartsTrame(types: readonly string[]): string[] {
  const res: string[] = [];
  const famille = (t: string) => (t in PAGES ? PAGES[t as TypePage].famille : t);
  for (let k = 1; k < types.length; k++) if (famille(types[k]) === famille(types[k - 1])) res.push(`pages ${k} et ${k + 1} : même famille (${famille(types[k])})`);
  const requis = types.length >= 8 ? 5 : 4;
  const distincts = new Set(types).size;
  if (distincts < requis) res.push(`${distincts} types pour ${types.length} pages ; ${requis} au moins`);
  for (let k = 2; k < types.length; k++) if (dense(types[k - 2]) && dense(types[k - 1]) && dense(types[k])) res.push(`pages ${k - 1} à ${k + 1} : trois pages denses de suite`);
  const sombres = types.flatMap((t, k) => (t === "T21" ? [k] : []));
  if (sombres.length !== 1 || (sombres[0] !== 1 && sombres[0] !== types.length - 1)) res.push("une seule page sombre, en page 2 ou en dernière");
  return res;
}

/** Consignes communes à toutes les trames : la cible, et ce que le carrousel fait sentir sans le dire. */
const ECRITURE_COMMUNE = [
  "Lecteur : dirigeants et équipes de TPE et PME qui entendent parler d'IA sans savoir par où commencer.",
  "Faire sentir le temps gagné, le travail mieux payé de retour et les clients mieux servis, sans jamais l'annoncer ni le promettre.",
  "Vouvoiement, phrases courtes, zéro jargon ; aucun chiffre, aucun mot-nombre, aucun lien.",
];

/** Consigne de plan et d'écriture d'une trame, pour le rédacteur (API ou session). */
export function consigneTrame(intention: Intention): string {
  const trame = TRAMES[intention];
  const types = typesDeLaTrame(intention);
  const plan = types.map((t, k) => `${k + 1}. ${t} : ${trame.etapes.find((e) => e.type === t)!.role}.`);
  return [
    `Intention du carrousel : ${trame.nom}. ${trame.but}`,
    `Plan, page par page, dans cet ordre (${types.length} pages) :`,
    ...plan,
    "Écriture :",
    ...[...ECRITURE_COMMUNE, ...trame.ecriture].map((l) => `- ${l}`),
  ].join("\n");
}
