/**
 * Registre d'AFFICHAGE des réseaux qui ne sont pas des sorties vidéo (Pinterest : une épingle = une image).
 * PUR : importable côté client.
 *
 * Pourquoi un registre à part : `RESEAUX` (reseaux/index.ts) est un profil VIDÉO (durée max, export h264, LUFS, zones
 * protégées) lu par ~34 appelants (montage, sous-titres, rôle « publication » du générateur…). Y ajouter Pinterest en
 * ferait une sortie vidéo possible. Ici, seulement ce qu'il faut pour AFFICHER le réseau : nom, monogramme, code,
 * légende. `listerReseaux()` et `obtenirReseau` restent vidéo seulement.
 */
import type { IdReseau } from "@/domaine/types";
import { DESCRIPTION_EPINGLE_MAX } from "../fournisseurs/publication/epingle-limites";
import { CODES_RESEAU } from "./codes";
import { RESEAUX } from "./index";

export interface DefinitionAffichageReseau {
  id: IdReseau;
  nom: string;
  /** Monogramme affiché dans la pastille du réseau (pas de logo de marque). */
  monogramme: string;
  /** Code de classement (lu dans `reseaux/codes.ts`, une seule source). */
  codeClassement: string;
  legende: { longueurMax: number; longueurVisible: number; motsDieseMax: number; motsDieseConseilles: number };
  /** Libellé de la case « contenu généré par l'IA » sur le réseau. */
  etiquetteIA: string;
}

export const RESEAUX_HORS_VIDEO: DefinitionAffichageReseau[] = [
  {
    id: "pinterest",
    nom: "Pinterest",
    monogramme: "P",
    codeClassement: CODES_RESEAU.pinterest,
    legende: { longueurMax: DESCRIPTION_EPINGLE_MAX, longueurVisible: 100, motsDieseMax: 0, motsDieseConseilles: 0 },
    etiquetteIA: "Mention « modifié par IA » de Pinterest",
  },
];

/** Définition d'affichage d'un réseau : registre vidéo d'abord, puis registre hors vidéo. Undefined si inconnu. */
export function chercherDefinitionAffichage(id: string): DefinitionAffichageReseau | undefined {
  return RESEAUX.find((r) => r.id === id) ?? RESEAUX_HORS_VIDEO.find((r) => r.id === id);
}

/** Comme `chercherDefinitionAffichage`, mais lève pour un identifiant inconnu (ne peut pas arriver pour un `IdReseau`). */
export function definitionAffichage(id: string): DefinitionAffichageReseau {
  const d = chercherDefinitionAffichage(id);
  if (!d) throw new Error(`Réseau inconnu : ${id}`);
  return d;
}

/** Nom lisible d'un réseau. Ne lève JAMAIS : repli sur l'identifiant (une page ne doit pas planter sur un réseau inattendu). */
export function nomDuReseau(id: string): string {
  return chercherDefinitionAffichage(id)?.nom ?? id;
}
