/**
 * REGISTRE DES RÔLES DU GÉNÉRATEUR (plan v5 B.3.1 ; lot G4). PUR.
 * Chaque rôle est un module versionné ; la fiche figée d'une version garde `versionsRoles` (B.8).
 */
import { EVALUATIONS_ACCROCHES, roleAccroches } from "./accroches";
import { EVALUATIONS_DECLINAISON, roleDeclinaison } from "./declinaison";
import { EVALUATIONS_FOND, roleFond } from "./fond";
import { EVALUATIONS_JUGE, roleJuge } from "./juge";
import { EVALUATIONS_PLAN, rolePlan } from "./plan";
import { EVALUATIONS_PREFERENCE, rolePreference } from "./preference";
import { EVALUATIONS_PROSE, roleProse } from "./prose";
import { EVALUATIONS_REECRITURE, roleReecriture } from "./reecriture";
import { EVALUATIONS_STRATEGE, roleStratege } from "./stratege";
import type { DefinitionRole } from "./types";
import { ROLES_CHAINE_COURTE } from "../chaine-courte";
import { roleEquipeAccroches } from "./equipe-accroches";
import { roleEquipeChef } from "./equipe-chef";
import { roleEquipeRelecteur } from "./equipe-relecteur";
import { roleEquipeScenariste } from "./equipe-scenariste";

export const ROLES_ECRITURE = {
  stratege: roleStratege,
  fond: roleFond,
  accroches: roleAccroches,
  juge: roleJuge,
  plan: rolePlan,
  prose: roleProse,
  preference: rolePreference,
  reecriture: roleReecriture,
  declinaison: roleDeclinaison,
} as const;

/** Étape de la chaîne (B.3.5) de chaque rôle. */
export const ETAPE_DU_ROLE: Readonly<Record<keyof typeof ROLES_ECRITURE, number[]>> = {
  stratege: [1],
  fond: [2],
  accroches: [3],
  juge: [4, 9, 12],
  plan: [5],
  prose: [7],
  preference: [9],
  reecriture: [10],
  declinaison: [11],
};

export const EVALUATIONS_DES_ROLES = {
  stratege: EVALUATIONS_STRATEGE,
  fond: EVALUATIONS_FOND,
  accroches: EVALUATIONS_ACCROCHES,
  juge: EVALUATIONS_JUGE,
  plan: EVALUATIONS_PLAN,
  prose: EVALUATIONS_PROSE,
  preference: EVALUATIONS_PREFERENCE,
  reecriture: EVALUATIONS_REECRITURE,
  declinaison: EVALUATIONS_DECLINAISON,
} as const;

/** Versions des rôles (fiche figée, B.8), ceux de la chaîne courte (la chaîne de production) et de la chaîne « équipe » compris. */
export function versionsRoles(): Record<string, number> {
  return Object.fromEntries([...Object.values(ROLES_ECRITURE), ...Object.values(ROLES_CHAINE_COURTE), roleEquipeChef, roleEquipeScenariste, roleEquipeAccroches, roleEquipeRelecteur].map((r: DefinitionRole) => [r.id, r.version]));
}

export { roleAccroches, roleDeclinaison, roleFond, roleJuge, rolePlan, rolePreference, roleProse, roleReecriture, roleStratege };
