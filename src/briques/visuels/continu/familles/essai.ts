import { z } from "zod";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import type { DefinitionGabarit, RoleGabarit } from "../registre-gabarits";

/** Gabarits d'essai génériques : jamais en production. */
function gabaritEssai(type: string, role: RoleGabarit, nom: string, titre: string, texte: string): DefinitionGabarit {
  return {
    type,
    famille: "essai",
    nom,
    role,
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal(type),
        alt: texteSansLien(1, 125),
        rubrique: texteSansLien(1, 40).optional(),
        titre: texteSansLien(1, 40),
        texte: texteSansLien(1, 90),
      })
      .strict(),
    exemple: { type, alt: titre, titre, texte },
    bordsLibres: { gauche: [[0, 1440]], droite: [[0, 1440]] },
    actif: false,
    essai: true,
  };
}

export const ESSAI: DefinitionGabarit[] = [
  gabaritEssai("X00", "couverture", "Couverture d'essai", "Par où commencer avec l’IA ?", "Un point de départ simple, pas à pas."),
  gabaritEssai("X01", "contenu", "Contenu d'essai", "On avance par étapes", "Chaque étape se vérifie avant la suivante."),
  gabaritEssai("X02", "appel", "Appel d'essai", "Commencez par là", "Dites-nous ce qui vous freine."),
];
