import { z } from "zod";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import type { DefinitionGabarit } from "../registre-gabarits";

/** Profils de hauteur des trois barres de D03 (clé technique `variante`) : le composant en tire hauteurs et barre en vedette. */
export const PROFILS_BARRES = ["descendant", "montant", "pic"] as const;

/** Un texte sans aucun chiffre (D03 : la plaquette ne montre jamais de chiffre). */
const sansChiffre = (max: number) => texteSansLien(1, max).regex(/^[^\p{N}]+$/u, "Aucun chiffre dans cette plaquette");

const base = { alt: texteSansLien(1, 125), rubrique: texteSansLien(1, RUBRIQUE_MAX).optional() };

/**
 * Données et citations (maquette v3 : « Grand chiffre », « Citation », « Trois barres »). Étiquettes fixes posées par le code
 * (D01 « Exemple de mise en page · chiffre à valider », D03 « Exemple illustratif ») : jamais des champs.
 */
export const DONNEES: DefinitionGabarit[] = [
  {
    type: "D01",
    famille: "donnees",
    nom: "Grand chiffre",
    role: "contenu",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("D01"),
        ...base,
        /** Identifiant du fait validé (clé technique). */
        faitId: z.string().regex(/^F\d{3}$/, "Identifiant de fait attendu : F001"),
        /** Fraction « n sur m » : l'anneau se remplit de n/m. */
        numerateur: z.string().regex(/^[1-9]$/, "Un chiffre de 1 à 9"),
        denominateur: z.string().regex(/^[2-9]$/, "Un chiffre de 2 à 9"),
        legende: texteSansLien(1, 70),
        source: texteSansLien(1, 60),
        date: texteSansLien(1, 24),
      })
      .strict(),
    exemple: {
      type: "D01",
      alt: "Trois dirigeants sur quatre disent ne pas savoir par où commencer.",
      faitId: "F001",
      numerateur: "3",
      denominateur: "4",
      legende: "dirigeants disent ne pas savoir par où commencer.",
      source: "Source du fait validé",
      date: "date du fait",
    },
    bordsLibres: { gauche: [[0, 196], [1210, 1440]], droite: [[0, 196], [1210, 1440]] },
    exigeFait: true,
    actif: false,
  },
  {
    type: "D02",
    famille: "donnees",
    nom: "Citation",
    role: "contenu",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("D02"),
        ...base,
        citation: texteSansLien(1, 80),
        auteur: texteSansLien(1, 32),
        fonction: texteSansLien(1, 60),
      })
      .strict(),
    exemple: {
      type: "D02",
      alt: "Citation d'un client sur le temps gagné dès la première semaine.",
      citation: "On a gagné du temps dès la première semaine, sans changer nos habitudes.",
      auteur: "Exemple de citation",
      fonction: "Nom, fonction, entreprise : accord écrit requis",
    },
    bordsLibres: { gauche: [[0, 196], [1210, 1440]], droite: [[0, 196], [1210, 1440]] },
    exigeAccord: true,
    actif: false,
  },
  {
    type: "D03",
    famille: "donnees",
    nom: "Trois barres",
    role: "contenu",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("D03"),
        ...base,
        titre: sansChiffre(24),
        accent: sansChiffre(16),
        /** Profil de hauteur des trois barres. */
        variante: z.enum(PROFILS_BARRES),
        /** Une étiquette par barre, de gauche à droite. */
        libelles: z.tuple([sansChiffre(14), sansChiffre(14), sansChiffre(14)]),
      })
      .strict(),
    exemple: {
      type: "D03",
      alt: "Barres de hauteurs différentes : la saisie, les relances et le métier.",
      titre: "Où part",
      accent: "le temps",
      variante: "descendant",
      libelles: ["Saisie", "Relances", "Métier"],
    },
    bordsLibres: { gauche: [[0, 196], [1210, 1440]], droite: [[0, 196], [1210, 1440]] },
    actif: true,
  },
];
