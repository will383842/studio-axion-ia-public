/**
 * C9-27a — registre des petits objets livrés : table `id → DefinitionObjet`, côté plan de scènes (lu seulement par C9-34).
 * Liste écrite à la main, triée par famille puis id. Tout éteint : rien ne l'appelle encore. Non exporté par `index.ts`.
 * Jamais importé par le rendu ni par `briques/motion` (AM-18). Place définitive : PSO (C9-27b). Toute nouvelle `DefinitionObjet` de `PO` s'ajoute ici, dans la même PR ou la suivante.
 */
import type { DefinitionObjet, IdPetitObjet } from "../motion/petits-objets/contrat";
import { OBJET_ANNEAU_DONNEES } from "../motion/petits-objets/anneau-donnees";
import { DEF_APPEL_ACTION } from "../motion/petits-objets/appel-action";
import { DEF_APPEL_MOT } from "../motion/petits-objets/appel-mot";
import { DEF_APPEL_RDV } from "../motion/petits-objets/appel-rdv";
import { OBJET_BULLE_NOTIFICATION, OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE } from "../motion/petits-objets/bulles";
import { DEF_CADRE_COINS, DEF_CADRE_PASSAGE, DEF_CADRE_RECTANGLE } from "../motion/petits-objets/cadres";
import { OBJET_CARTES_COCHE } from "../motion/petits-objets/cartes";
import { OBJET_CARTON_DEFINITION } from "../motion/petits-objets/carton-definition";
import { OBJET_CARTON_MAGAZINE } from "../motion/petits-objets/carton-magazine";
import { OBJET_COMPTEUR_ROULEAU } from "../motion/petits-objets/compteur-rouleau";
import { DEF_BARRE_PROGRESSION, DEF_CHRONO, DEF_DOSSIER } from "../motion/petits-objets/dossier-chrono-barre";
import { DEF_CERCLE, DEF_DOUBLE_BOUCLE, DEF_OVALE } from "../motion/petits-objets/entourages";
import { OBJET_ETAPE, OBJET_ETAPE_SEGMENTS } from "../motion/petits-objets/etapes";
import { DEF_BADGE, DEF_ETIQUETTE_ICONE, DEF_PASTILLE_ICONE, DEF_TAMPON } from "../motion/petits-objets/etiquettes";
import { OBJET_FENETRE_APP } from "../motion/petits-objets/fenetre-app";
import { OBJET_FLECHE_COURBE, OBJET_FLECHE_DROITE, OBJET_FLECHE_MAIN_LEVEE, OBJET_FLECHE_POINTILLEE } from "../motion/petits-objets/fleches";
import { OBJET_FRISE_MONTAGE } from "../motion/petits-objets/frise-montage";
import { OBJET_GRILLE_POINTILLEE, OBJET_VIGNETTES_NUMEROTEES } from "../motion/petits-objets/grille-vignettes";
import { OBJET_GROS_CHIFFRE } from "../motion/petits-objets/gros-chiffre";
import { OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE } from "../motion/petits-objets/marques";
import { OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT } from "../motion/petits-objets/objets-2027";
import { OBJET_TOURNE } from "../motion/petits-objets/objet-tourne";
import { OBJET_ONDE_MOTIF } from "../motion/petits-objets/onde";
import { OBJET_PANNEAU_REGLAGES } from "../motion/petits-objets/panneau-reglages";
import { OBJET_PARTICULES } from "../motion/petits-objets/particules";
import { OBJET_PELLICULE } from "../motion/petits-objets/pellicule";
import { DEF_POST_IT } from "../motion/petits-objets/post-it";
import { OBJET_SCHEMA_FLUX } from "../motion/petits-objets/schema-flux";
import { OBJET_AGENTS_GLOBE, OBJET_ICONES_RELIEES, OBJET_SCHEMA_ETOILE } from "../motion/petits-objets/schemas-relies";
import { OBJET_SOULIGNEMENT_DOUBLE, OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SURLIGNEUR } from "../motion/petits-objets/soulignements";
import { OBJET_TERMINAL_COMMANDE } from "../motion/petits-objets/terminal-commande";
import { OBJET_VOLET_AVANT_APRES } from "../motion/petits-objets/volet-avant-apres";

const LISTE: readonly DefinitionObjet<unknown>[] = [
  OBJET_ANNEAU_DONNEES as DefinitionObjet<unknown>, // chiffre · objet-anneau-donnees
  DEF_BARRE_PROGRESSION as DefinitionObjet<unknown>, // chiffre · objet-barre-progression
  DEF_CHRONO as DefinitionObjet<unknown>, // chiffre · objet-chrono
  OBJET_COMPTEUR_ROULEAU as DefinitionObjet<unknown>, // chiffre · objet-compteur-rouleau
  OBJET_ETAPE as DefinitionObjet<unknown>, // chiffre · objet-etape
  OBJET_ETAPE_SEGMENTS as DefinitionObjet<unknown>, // chiffre · objet-etape-segments
  OBJET_GROS_CHIFFRE as DefinitionObjet<unknown>, // chiffre · objet-gros-chiffre
  OBJET_FENETRE_APP as DefinitionObjet<unknown>, // ecran · objet-fenetre-app
  OBJET_FRISE_MONTAGE as DefinitionObjet<unknown>, // ecran · objet-frise-montage
  OBJET_PANNEAU_REGLAGES as DefinitionObjet<unknown>, // ecran · objet-panneau-reglages
  OBJET_PELLICULE as DefinitionObjet<unknown>, // ecran · objet-pellicule
  OBJET_TERMINAL_COMMANDE as DefinitionObjet<unknown>, // ecran · objet-terminal-commande
  OBJET_VOLET_AVANT_APRES as DefinitionObjet<unknown>, // ecran · objet-volet-avant-apres
  DEF_APPEL_ACTION as DefinitionObjet<unknown>, // etiquette · objet-appel-action
  DEF_APPEL_MOT as DefinitionObjet<unknown>, // etiquette · objet-appel-mot
  DEF_APPEL_RDV as DefinitionObjet<unknown>, // etiquette · objet-appel-rdv
  DEF_BADGE as DefinitionObjet<unknown>, // etiquette · objet-badge
  OBJET_BULLE_NOTIFICATION as DefinitionObjet<unknown>, // etiquette · objet-bulle-notification
  OBJET_BULLE_PAROLE as DefinitionObjet<unknown>, // etiquette · objet-bulle-parole
  OBJET_BULLE_PENSEE as DefinitionObjet<unknown>, // etiquette · objet-bulle-pensee
  OBJET_CARTES_COCHE as DefinitionObjet<unknown>, // etiquette · objet-cartes-coche
  OBJET_CARTON_DEFINITION as DefinitionObjet<unknown>, // etiquette · objet-carton-definition
  OBJET_CARTON_MAGAZINE as DefinitionObjet<unknown>, // etiquette · objet-carton-magazine
  DEF_ETIQUETTE_ICONE as DefinitionObjet<unknown>, // etiquette · objet-etiquette-icone
  DEF_PASTILLE_ICONE as DefinitionObjet<unknown>, // etiquette · objet-pastille-icone
  DEF_POST_IT as DefinitionObjet<unknown>, // etiquette · objet-post-it
  DEF_TAMPON as DefinitionObjet<unknown>, // etiquette · objet-tampon
  OBJET_CROQUIS as DefinitionObjet<unknown>, // manuscrit · objet-croquis
  OBJET_COCHE as DefinitionObjet<unknown>, // marque · objet-coche
  OBJET_CROIX as DefinitionObjet<unknown>, // marque · objet-croix
  OBJET_MOT_BARRE as DefinitionObjet<unknown>, // marque · objet-mot-barre
  OBJET_PARTICULES as DefinitionObjet<unknown>, // marque · objet-particules
  OBJET_AGENTS_GLOBE as DefinitionObjet<unknown>, // schema · objet-agents-globe
  DEF_DOSSIER as DefinitionObjet<unknown>, // schema · objet-dossier
  OBJET_GRILLE_POINTILLEE as DefinitionObjet<unknown>, // schema · objet-grille-pointillee
  OBJET_ICONES_RELIEES as DefinitionObjet<unknown>, // schema · objet-icones-reliees
  OBJET_ONDE_MOTIF as DefinitionObjet<unknown>, // schema · objet-onde-motif
  OBJET_SCHEMA_ETOILE as DefinitionObjet<unknown>, // schema · objet-schema-etoile
  OBJET_SCHEMA_FLUX as DefinitionObjet<unknown>, // schema · objet-schema-flux
  OBJET_TOURNE as DefinitionObjet<unknown>, // schema · objet-tourne
  OBJET_VIGNETTES_NUMEROTEES as DefinitionObjet<unknown>, // schema · objet-vignettes-numerotees
  DEF_CADRE_COINS as DefinitionObjet<unknown>, // trait · objet-cadre-coins
  DEF_CADRE_PASSAGE as DefinitionObjet<unknown>, // trait · objet-cadre-passage
  DEF_CADRE_RECTANGLE as DefinitionObjet<unknown>, // trait · objet-cadre-rectangle
  DEF_CERCLE as DefinitionObjet<unknown>, // trait · objet-cercle
  DEF_DOUBLE_BOUCLE as DefinitionObjet<unknown>, // trait · objet-double-boucle
  OBJET_FEUTRE_ENTOURAGE as DefinitionObjet<unknown>, // trait · objet-feutre-entourage
  OBJET_FEUTRE_SOULIGNEMENT as DefinitionObjet<unknown>, // trait · objet-feutre-soulignement
  OBJET_FLECHE_COURBE as DefinitionObjet<unknown>, // trait · objet-fleche-courbe
  OBJET_FLECHE_DROITE as DefinitionObjet<unknown>, // trait · objet-fleche-droite
  OBJET_FLECHE_MAIN_LEVEE as DefinitionObjet<unknown>, // trait · objet-fleche-main-levee
  OBJET_FLECHE_POINTILLEE as DefinitionObjet<unknown>, // trait · objet-fleche-pointillee
  DEF_OVALE as DefinitionObjet<unknown>, // trait · objet-ovale
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
