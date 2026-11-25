/**
 * REPRISE APRÈS ÉCHEC SANS PAYER DEUX FOIS (T-EXT-45a) — pur : aucun appel, aucune horloge, aucun réseau.
 *
 * RÈGLE DES PAS PAYANTS (à recopier dans les fiches des rôles 18 à 23) :
 *   « un pas qui paie rend son état dès que le résultat payé est là ; le traitement du résultat se fait au pas suivant ».
 * Tout appel payant (Claude, voix, rendu) passe par `payerUneFois` : même étape ET même entrée = résultat gardé, jamais
 * un second appel ; entrée changée = nouvel appel légitime. Le registre ne garde que des résultats : jamais le texte
 * d'une personne ni un secret.
 *
 * Ce fichier ne branche rien (45b le fera dans `chaine.ts` et `index.ts`).
 */
import type { EtatTutoriel, RenduTutoriel } from "./chaine";

export interface EntreePayee {
  etape: string;
  empreinteEntree: string;
  resultat: unknown;
  faitLe: string;
}

export type RegistrePaye = Record<string, EntreePayee>;

/** Clé d'un appel : l'étape et l'empreinte de son entrée. */
export function cleAppel(etape: string, empreinteEntree: string): string {
  return `${etape}:${empreinteEntree}`;
}

/** Le résultat déjà payé pour cette étape ET cette entrée, sinon `null`. */
export function dejaPaye(registre: RegistrePaye | undefined, etape: string, empreinteEntree: string): unknown | null {
  const trouve = registre?.[cleAppel(etape, empreinteEntree)];
  if (!trouve || trouve.etape !== etape || trouve.empreinteEntree !== empreinteEntree) return null;
  return trouve.resultat;
}

/**
 * Fait l'appel une seule fois. Déjà payé : résultat repris, `faire` jamais appelé. Sinon `faire` une fois, et le registre
 * rendu contient le résultat. Une erreur de `faire` remonte telle quelle, sans rien écrire (rien n'a été payé, ou l'appel
 * interrompu est déjà compté par `executerRolePourVideo`).
 */
export async function payerUneFois<T>(
  registre: RegistrePaye | undefined,
  etape: string,
  empreinteEntree: string,
  faire: () => Promise<T>,
  maintenantIso: string,
): Promise<{ registre: RegistrePaye; resultat: T; repris: boolean }> {
  const base: RegistrePaye = registre ?? {};
  const cle = cleAppel(etape, empreinteEntree);
  const garde = base[cle];
  if (garde && garde.etape === etape && garde.empreinteEntree === empreinteEntree) {
    return { registre: base, resultat: garde.resultat as T, repris: true };
  }
  const resultat = await faire();
  return { registre: { ...base, [cle]: { etape, empreinteEntree, resultat, faitLe: maintenantIso } }, resultat, repris: false };
}

/**
 * Chaque rendu SANS sortie repart en série neuve (identifiant neuf pour `studio-rendu`) ; un rendu fini n'est jamais touché.
 * Jamais « remettre l'essai à 0 sur la même demande ».
 */
/** Le rendu tel que 45b le gardera : `serie` et `aSoumettre` s'ajouteront à `RenduTutoriel` dans `chaine.ts`. */
type RenduRelance = RenduTutoriel & { serie?: number; aSoumettre?: true };

export function relancerRendusTombes<E extends Pick<EtatTutoriel, "rendus">>(etat: E): E {
  // Le compte d'attente réseau repart de zéro avec « Réessayer » : sinon le réseau encore coupé ferait échouer dès la première lecture.
  const rendus = etat.rendus.map((r: RenduRelance): RenduRelance => {
    if (r.sortie) return r;
    const { attentesReseau: _n, ...sans } = r;
    void _n;
    return { ...sans, serie: (r.serie ?? 0) + 1, essai: 0, aSoumettre: true };
  });
  return { ...etat, rendus };
}

const ETAPES_DU_RENDU = ["montage", "exports"];

export interface BilanReprise {
  refait: string[];
  garde: string[];
  /** Texte de l'interface avant « Réessayer » ; jamais dit ni affiché dans une vidéo ; aucun montant. */
  phrase: string;
}

/** Ce qui sera refait et ce qui est gardé, en une phrase simple. */
export function bilanReprise(etat: Pick<EtatTutoriel, "audio" | "plan" | "rendus">, etapesEnEchec: readonly string[]): BilanReprise {
  const refait: string[] = [];
  const garde: string[] = [];
  const enEchec = new Set(etapesEnEchec);

  if (etat.audio && !enEchec.has("voix")) garde.push("voix");
  else if (enEchec.has("voix")) refait.push("voix");
  if (etat.plan && !enEchec.has("plan")) garde.push("plan");
  else if (enEchec.has("plan")) refait.push("plan");

  const rendusTombes = etat.rendus.filter((r) => !r.sortie).map((r) => r.ratio);
  const rendusFinis = etat.rendus.filter((r) => r.sortie).map((r) => r.ratio);
  if (ETAPES_DU_RENDU.some((e) => enEchec.has(e))) {
    for (const ratio of rendusTombes) refait.push(`rendu ${ratio}`);
  }
  for (const ratio of rendusFinis) garde.push(`rendu ${ratio}`);

  const parts: string[] = [];
  if (garde.includes("voix")) parts.push("La voix déjà lue est gardée : elle ne sera pas payée une deuxième fois.");
  if (garde.includes("plan")) parts.push("Le plan déjà établi est gardé.");
  const finis = garde.filter((g) => g.startsWith("rendu "));
  if (finis.length) parts.push(`Les rendus déjà finis (${finis.map((g) => g.slice(6)).join(", ")}) sont gardés.`);
  const tombes = refait.filter((r) => r.startsWith("rendu "));
  if (tombes.length) parts.push(`Seul le rendu ${tombes.map((r) => r.slice(6)).join(", ")} est refait.`);
  const autres = refait.filter((r) => !r.startsWith("rendu "));
  if (autres.length) parts.push(`Sera refait : ${autres.join(", ")}.`);
  if (!parts.length) parts.push("Rien de déjà payé ne sera payé une deuxième fois.");
  return { refait, garde, phrase: parts.join(" ") };
}
