/**
 * Type d'automatisation de chaque fiche du catalogue d'origine. Table à part : les fiches et le stock par métier ne sont pas
 * édités (leur empreinte ne bouge pas), le type est lu ici ou déduit du texte. Absent : « À classer » (null).
 */
import { deduireTypeAutomatisation } from "@/domaine/ciblage/controles";
import type { TypeAutomatisation } from "@/domaine/ciblage/types";
import type { CasConcret } from "./cas";

export const TYPE_PAR_CAS: Readonly<Record<string, TypeAutomatisation>> = {
  "recrutement-apporteurs": "recrutement",
  "rappels-rendez-vous": "rendez-vous-planning",
  "email-difficile": "emails-messages",
  "compte-rendu-dicte": "comptes-rendus",
  "audit-une-journee": "trouver-quoi-automatiser",
  "contact-vers-crm": "suivi-commercial",
  "devis-signe-alerte": "devis-factures",
  "articles-blog": "publication-contenu",
  "cycle-de-formation": "former-equipes",
  "programme-par-ia": "former-equipes",
  "audit-departement": "trouver-quoi-automatiser",
  "diagnostic-gratuit": "trouver-quoi-automatiser",
  "dossier-laisse-relance": "relances-impayes",
  "documents-formation": "documents-signatures",
  "autofacture-formateurs": "devis-factures",
  "devis-relances": "relances-impayes",
  "cv-tries": "recrutement",
  "alerte-courte": "emails-messages",
  "outils-branches": "trouver-quoi-automatiser",
  "crm-qui-note": "suivi-commercial",
  "compte-rendu-visio": "comptes-rendus",
  "rendez-vous-classes": "rendez-vous-planning",
};

/** Champ déclaré du cas, puis table, puis déduction du titre, de la promesse et du sujet ; null = « À classer ». */
export function typeAutomatisationDuCas(cas: Pick<CasConcret, "id" | "titre" | "promesse" | "typeAutomatisation" | "recit">): TypeAutomatisation | null {
  return cas.typeAutomatisation ?? TYPE_PAR_CAS[cas.id] ?? deduireTypeAutomatisation(`${cas.titre} ${cas.promesse} ${cas.recit?.sujet ?? ""}`);
}
