/**
 * cartes : aucune liste de codes source n'est nommée par la fiche X2-02 (pas de module pur à importer) : table vide,
 * donc tout code local s'écrit `autre:cartes:<code>`. À remplir par une fiche suivante, jamais « au jugé ».
 */
import type { AxeCommun } from "../types";

export const TABLE_CARTES: Readonly<Partial<Record<AxeCommun, Readonly<Record<string, string>>>>> = Object.freeze({});
