import { z } from "zod";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
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
        rubrique: texteSansLien(1, RUBRIQUE_MAX).optional(),
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
  // Contenus d'essai supplémentaires (P2) : une toile de 10 pages exige 10 plaquettes différentes.
  gabaritEssai("X03", "contenu", "Contenu d'essai 3", "Un seul cas pour commencer", "Ce qui revient chaque semaine et vous pèse."),
  gabaritEssai("X04", "contenu", "Contenu d'essai 4", "On installe chez vous", "À votre façon, avec vos outils actuels."),
  gabaritEssai("X05", "contenu", "Contenu d'essai 5", "Vous gardez la main", "Chaque envoi se relit avant de partir."),
  gabaritEssai("X06", "contenu", "Contenu d'essai 6", "Ensuite, on étend", "Un deuxième cas, quand le premier tourne."),
];
