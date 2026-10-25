import { z } from "zod";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import type { DefinitionGabarit } from "../registre-gabarits";

/** Base commune : `type`, `alt` (≤ 125), `rubrique?` ; chaque appel ajoute ses textes, tous bornés au budget mesuré au rendu. */
const base = <T extends string>(type: T) => ({
  type: z.literal(type),
  alt: texteSansLien(1, 125),
  rubrique: texteSansLien(1, RUBRIQUE_MAX).optional(),
});

/** Un seul appel par page, de valeur (écrire, enregistrer, partager) : jamais « commentez », aucun domaine (SEC-01). */
export const APPELS: DefinitionGabarit[] = [
  {
    type: "A01",
    famille: "appel",
    nom: "Message privé",
    role: "appel",
    sombre: true,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        ...base("A01"),
        titre: texteSansLien(1, 20),
        accent: texteSansLien(1, 22),
        recu: texteSansLien(1, 40),
        envoye: texteSansLien(1, 36),
        bouton: texteSansLien(1, 30),
      })
      .strict(),
    exemple: {
      type: "A01",
      alt: "Conversation : « Par où dois-je commencer ? », réponse du studio, et un bouton pour écrire en message privé.",
      titre: "Racontez-nous",
      accent: "votre situation",
      recu: "On répond avec une première piste.",
      envoye: "Par où dois-je commencer ?",
      bouton: "Écrire en message privé",
    },
    bordsLibres: { gauche: [[0, 1440]], droite: [[0, 1440]] },
    actif: true,
  },
  {
    type: "A02",
    famille: "appel",
    nom: "À retenir",
    role: "relance",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        ...base("A02"),
        titre: texteSansLien(1, 6),
        accent: texteSansLien(1, 12),
        suite: texteSansLien(1, 12),
        idees: z.array(texteSansLien(1, 34)).length(3),
      })
      .strict(),
    exemple: {
      type: "A02",
      alt: "À retenir en trois idées : un seul cas pour démarrer, vous validez chaque envoi, on ajuste tant que c'est utile.",
      titre: "En",
      accent: "trois",
      suite: "idées",
      idees: ["Un seul cas pour démarrer", "Vous validez chaque envoi", "On ajuste tant que c’est utile"],
    },
    bordsLibres: { gauche: [[0, 1440]], droite: [[0, 1440]] },
    actif: true,
  },
  {
    type: "A03",
    famille: "appel",
    nom: "Enregistrer et partager",
    role: "appel",
    sombre: false,
    orangeFort: true,
    version: 1,
    schema: z
      .object({
        ...base("A03"),
        titre: texteSansLien(1, 16),
        accent: texteSansLien(1, 24),
        texte: texteSansLien(1, 80),
      })
      .strict(),
    exemple: {
      type: "A03",
      alt: "Enregistrez pour y revenir et envoyez-le à votre équipe ; un marque-page et un avion en papier.",
      titre: "Enregistrez",
      accent: "pour y revenir",
      texte: "Et envoyez-le à la personne qui se pose la question dans votre équipe.",
    },
    bordsLibres: { gauche: [[0, 1440]], droite: [[0, 1440]] },
    actif: true,
  },
];
