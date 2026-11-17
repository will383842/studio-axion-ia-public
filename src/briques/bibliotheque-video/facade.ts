/**
 * Façade de la bibliothèque côté moteur (G2-03) : « ce que le générateur déclare consommer » ∩ « ce que le profil figé permet ».
 * Aucun consommateur (G2-03) : les nouveaux générateurs la liront ; les neuf existants restent tels quels (G2.md:98).
 * Pur : aucun service, aucun réglage lu, aucun argent, aucun fournisseur ; jamais importé par `studio-rendu`.
 * Une capacité permise par le profil mais absente de la déclaration n'apparaît jamais. Ne lève jamais.
 */
import { declarationDuFormat } from "@/generateurs/declaration";
import { porteCapacite } from "./moteur";
import { estIdCapacite, familleDe } from "./noms";
import { lireEntreeBibliotheque } from "./schema";
import type { FamilleCapacite, IdCapacite } from "./types";

export type BriquesDuMoteur =
  | { readonly formatId: string; readonly bibliotheque: false }
  | {
      readonly formatId: string;
      readonly bibliotheque: true;
      readonly permises: readonly IdCapacite[];
      readonly fermees: readonly IdCapacite[];
      readonly maxParVideo: Readonly<Partial<Record<IdCapacite, number>>>;
      readonly parFamille: Readonly<Partial<Record<FamilleCapacite, readonly IdCapacite[]>>>;
    };

/** `bibliotheque: false` = le moteur fait comme aujourd'hui (chaque capacité à réglage propre décide par son réglage). */
export function briquesDuMoteur(formatId: string, entrees: unknown): BriquesDuMoteur {
  const sans: BriquesDuMoteur = Object.freeze({ formatId, bibliotheque: false as const });
  try {
    const declaration = declarationDuFormat(formatId);
    if (!declaration || !lireEntreeBibliotheque(entrees)) return sans;
    const permises: IdCapacite[] = [];
    const fermees: IdCapacite[] = [];
    const maxParVideo: Partial<Record<IdCapacite, number>> = {};
    const groupes: Partial<Record<FamilleCapacite, IdCapacite[]>> = {};
    for (const id of declaration.consomme) {
      if (!estIdCapacite(id)) continue;
      const porte = porteCapacite(entrees, id);
      if (!porte.bibliotheque) return sans;
      (porte.permis ? permises : fermees).push(id);
      if (porte.maxParVideo !== undefined) maxParVideo[id] = porte.maxParVideo;
      (groupes[familleDe(id)] ??= []).push(id);
    }
    const parFamille: Partial<Record<FamilleCapacite, readonly IdCapacite[]>> = {};
    for (const [f, ids] of Object.entries(groupes)) parFamille[f as FamilleCapacite] = Object.freeze([...ids]);
    return Object.freeze({
      formatId, bibliotheque: true as const, permises: Object.freeze(permises), fermees: Object.freeze(fermees),
      maxParVideo: Object.freeze(maxParVideo), parFamille: Object.freeze(parFamille),
    });
  } catch {
    return sans;
  }
}
