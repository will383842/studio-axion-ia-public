/**
 * C9-27a — registre des petits objets livrés : table `id → DefinitionObjet`, côté plan de scènes (lu seulement par C9-34).
 * Liste écrite à la main, triée par famille puis id. Tout éteint : rien ne l'appelle encore. Non exporté par `index.ts`.
 * Jamais importé par le rendu ni par `briques/motion` (AM-18). Les pièces arrivées depuis : C9-27b.
 */
import type { DefinitionObjet, IdPetitObjet } from "../motion/petits-objets/contrat";
import { OBJET_BULLE_NOTIFICATION, OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE } from "../motion/petits-objets/bulles";
import { OBJET_CARTES_COCHE } from "../motion/petits-objets/cartes";
import { OBJET_CARTON_DEFINITION } from "../motion/petits-objets/carton-definition";
import { OBJET_ETAPE, OBJET_ETAPE_SEGMENTS } from "../motion/petits-objets/etapes";
import { OBJET_FENETRE_APP } from "../motion/petits-objets/fenetre-app";
import { OBJET_FLECHE_COURBE, OBJET_FLECHE_DROITE, OBJET_FLECHE_MAIN_LEVEE, OBJET_FLECHE_POINTILLEE } from "../motion/petits-objets/fleches";
import { OBJET_FRISE_MONTAGE } from "../motion/petits-objets/frise-montage";
import { OBJET_GRILLE_POINTILLEE, OBJET_VIGNETTES_NUMEROTEES } from "../motion/petits-objets/grille-vignettes";
import { OBJET_GROS_CHIFFRE } from "../motion/petits-objets/gros-chiffre";
import { OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE } from "../motion/petits-objets/marques";
import { OBJET_TOURNE } from "../motion/petits-objets/objet-tourne";
import { OBJET_ONDE_MOTIF } from "../motion/petits-objets/onde";
import { OBJET_PANNEAU_REGLAGES } from "../motion/petits-objets/panneau-reglages";
import { OBJET_PARTICULES } from "../motion/petits-objets/particules";
import { OBJET_PELLICULE } from "../motion/petits-objets/pellicule";
import { OBJET_SCHEMA_FLUX } from "../motion/petits-objets/schema-flux";
import { OBJET_AGENTS_GLOBE, OBJET_ICONES_RELIEES, OBJET_SCHEMA_ETOILE } from "../motion/petits-objets/schemas-relies";
import { OBJET_SOULIGNEMENT_DOUBLE, OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SURLIGNEUR } from "../motion/petits-objets/soulignements";
import { OBJET_TERMINAL_COMMANDE } from "../motion/petits-objets/terminal-commande";
import { OBJET_VOLET_AVANT_APRES } from "../motion/petits-objets/volet-avant-apres";

const LISTE: readonly DefinitionObjet<unknown>[] = [
  OBJET_ETAPE as DefinitionObjet<unknown>, // chiffre · objet-etape
  OBJET_ETAPE_SEGMENTS as DefinitionObjet<unknown>, // chiffre · objet-etape-segments
  OBJET_GROS_CHIFFRE as DefinitionObjet<unknown>, // chiffre · objet-gros-chiffre
  OBJET_FENETRE_APP as DefinitionObjet<unknown>, // ecran · objet-fenetre-app
  OBJET_FRISE_MONTAGE as DefinitionObjet<unknown>, // ecran · objet-frise-montage
  OBJET_PANNEAU_REGLAGES as DefinitionObjet<unknown>, // ecran · objet-panneau-reglages
  OBJET_PELLICULE as DefinitionObjet<unknown>, // ecran · objet-pellicule
  OBJET_TERMINAL_COMMANDE as DefinitionObjet<unknown>, // ecran · objet-terminal-commande
  OBJET_VOLET_AVANT_APRES as DefinitionObjet<unknown>, // ecran · objet-volet-avant-apres
  OBJET_BULLE_NOTIFICATION as DefinitionObjet<unknown>, // etiquette · objet-bulle-notification
  OBJET_BULLE_PAROLE as DefinitionObjet<unknown>, // etiquette · objet-bulle-parole
  OBJET_BULLE_PENSEE as DefinitionObjet<unknown>, // etiquette · objet-bulle-pensee
  OBJET_CARTES_COCHE as DefinitionObjet<unknown>, // etiquette · objet-cartes-coche
  OBJET_CARTON_DEFINITION as DefinitionObjet<unknown>, // etiquette · objet-carton-definition
  OBJET_COCHE as DefinitionObjet<unknown>, // marque · objet-coche
  OBJET_CROIX as DefinitionObjet<unknown>, // marque · objet-croix
  OBJET_MOT_BARRE as DefinitionObjet<unknown>, // marque · objet-mot-barre
  OBJET_PARTICULES as DefinitionObjet<unknown>, // marque · objet-particules
  OBJET_AGENTS_GLOBE as DefinitionObjet<unknown>, // schema · objet-agents-globe
  OBJET_GRILLE_POINTILLEE as DefinitionObjet<unknown>, // schema · objet-grille-pointillee
  OBJET_ICONES_RELIEES as DefinitionObjet<unknown>, // schema · objet-icones-reliees
  OBJET_ONDE_MOTIF as DefinitionObjet<unknown>, // schema · objet-onde-motif
  OBJET_SCHEMA_ETOILE as DefinitionObjet<unknown>, // schema · objet-schema-etoile
  OBJET_SCHEMA_FLUX as DefinitionObjet<unknown>, // schema · objet-schema-flux
  OBJET_TOURNE as DefinitionObjet<unknown>, // schema · objet-tourne
  OBJET_VIGNETTES_NUMEROTEES as DefinitionObjet<unknown>, // schema · objet-vignettes-numerotees
  OBJET_FLECHE_COURBE as DefinitionObjet<unknown>, // trait · objet-fleche-courbe
  OBJET_FLECHE_DROITE as DefinitionObjet<unknown>, // trait · objet-fleche-droite
  OBJET_FLECHE_MAIN_LEVEE as DefinitionObjet<unknown>, // trait · objet-fleche-main-levee
  OBJET_FLECHE_POINTILLEE as DefinitionObjet<unknown>, // trait · objet-fleche-pointillee
  OBJET_SOULIGNEMENT_DOUBLE as DefinitionObjet<unknown>, // trait · objet-soulignement-double
  OBJET_SOULIGNEMENT_DROIT as DefinitionObjet<unknown>, // trait · objet-soulignement-droit
  OBJET_SOULIGNEMENT_VAGUE as DefinitionObjet<unknown>, // trait · objet-soulignement-vague
  OBJET_SURLIGNEUR as DefinitionObjet<unknown>, // trait · objet-surligneur
];

/** Liste source (avant construction de la table), exposée pour tester l'unicité des identifiants. Non exportée par `index.ts`. */
export const OBJETS_INSCRITS: readonly DefinitionObjet<unknown>[] = Object.freeze([...LISTE]);

export const REGISTRE_OBJETS: Readonly<Record<IdPetitObjet, DefinitionObjet<unknown>>> = Object.freeze(
  Object.fromEntries(LISTE.map((d) => [d.id, d])) as Record<IdPetitObjet, DefinitionObjet<unknown>>,
);

/** Définition de l'objet, ou `undefined` s'il n'est pas inscrit. */
export function definitionObjet(id: string): DefinitionObjet<unknown> | undefined {
  return Object.prototype.hasOwnProperty.call(REGISTRE_OBJETS, id) ? REGISTRE_OBJETS[id as IdPetitObjet] : undefined;
}

/** Identifiants inscrits, triés. */
export function idsObjets(): IdPetitObjet[] {
  return (Object.keys(REGISTRE_OBJETS) as IdPetitObjet[]).sort();
}
