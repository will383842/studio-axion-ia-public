/**
 * Portée d'une retouche et garde gratuite / payante (D4-F5). PUR : aucun accès base, réseau, voix ni argent.
 * La garde est faite pour être appelée AVANT `lancerRetouche` ; son branchement est hors de cette fiche.
 */
import type { TypeOperationRetouche } from "../operations";
import type { OperationMontage } from "../../moteurs/types";
import type { TypeOperationRetouche as TypeOperationTableau } from "../../moteurs/montage-tableau/retouches";
import type { TypeOperationRetoucheCasConcret } from "../../moteurs/montage-cas-concret/retouches";
import { PORTEE_CAS_CONCRET, PORTEE_CHAT, PORTEE_MOTEURS, PORTEE_TABLEAU, type PorteeOperation } from "./catalogues";

export type { PorteeOperation } from "./catalogues";
export { PORTEE_CAS_CONCRET, PORTEE_CHAT, PORTEE_MOTEURS, PORTEE_TABLEAU } from "./catalogues";

export type Vocabulaire = "chat" | "moteurs" | "tableau" | "cas-concret";

/** Type d'une opération selon son vocabulaire. */
export interface TypesParVocabulaire {
  chat: TypeOperationRetouche;
  moteurs: OperationMontage["type"];
  tableau: TypeOperationTableau;
  "cas-concret": TypeOperationRetoucheCasConcret;
}

const CATALOGUES: Readonly<Record<Vocabulaire, Readonly<Record<string, PorteeOperation>>>> = {
  chat: PORTEE_CHAT,
  moteurs: PORTEE_MOTEURS,
  tableau: PORTEE_TABLEAU,
  "cas-concret": PORTEE_CAS_CONCRET,
};

/** Une opération ou son seul type. */
type OperationOuType<V extends Vocabulaire> = TypesParVocabulaire[V] | { type: TypesParVocabulaire[V] };

const ORDRE: readonly PorteeOperation[] = ["scenes", "final", "voix", "claude", "ia"];

/** Portées distinctes des opérations (ordre fixe). Un type inconnu compte comme `ia` (le plus prudent). */
export function porteesDe<V extends Vocabulaire>(vocabulaire: V, operations: readonly OperationOuType<V>[]): PorteeOperation[] {
  const table = CATALOGUES[vocabulaire];
  const vues = new Set<PorteeOperation>();
  for (const o of operations) {
    const type = typeof o === "string" ? o : (o as { type: string }).type;
    vues.add(Object.prototype.hasOwnProperty.call(table, type) ? table[type] : "ia");
  }
  return ORDRE.filter((p) => vues.has(p));
}

/** Vrai si toutes les portées sont `scenes` ou `final`. */
export const estGratuite = (portees: readonly PorteeOperation[]): boolean => portees.every((p) => p === "scenes" || p === "final");

export type ResultatGarde = { ok: true; portees: PorteeOperation[] } | { ok: false; portees: PorteeOperation[]; phrase: string };

const PHRASES: Readonly<Record<"voix" | "claude" | "ia", string>> = {
  voix: "Cette retouche refait la voix : elle est payante et n'est pas faite ici.",
  claude: "Cette retouche demande un appel à Claude : elle est payante et n'est pas faite ici.",
  ia: "Cette retouche demande une image, un avatar ou un clip IA : elle est payante et n'est pas faite ici.",
};

/** Refuse `voix`, `claude`, `ia` par défaut ; `voixPermise: true` laisse passer `voix` seulement. Aucune phrase ne cite de prix. */
export function garderPortee<V extends Vocabulaire>(vocabulaire: V, operations: readonly OperationOuType<V>[], options?: { voixPermise?: boolean }): ResultatGarde {
  const portees = porteesDe(vocabulaire, operations);
  const refusee = portees.find((p) => (p === "voix" ? options?.voixPermise !== true : p === "claude" || p === "ia"));
  if (refusee === undefined) return { ok: true, portees };
  return { ok: false, portees, phrase: PHRASES[refusee as "voix" | "claude" | "ia"] };
}
