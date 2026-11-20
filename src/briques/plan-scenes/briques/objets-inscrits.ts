/**
 * BR-OBJETS-a (= C9-34b) — inscription des 4 petits objets des règles fixes C9-36a dans le plan de scènes, PORTE FERMÉE :
 * tant que `objetsPermis` est vide (défaut partout), la consigne de Claude et les vidéos restent identiques.
 * Lu par le rendu : imports RELATIFS seulement ; ne JAMAIS importer `plan-scenes-objets/registre.ts` (AM-18).
 * Aucun appel à Claude, aucun son, rien sur le visage.
 */
import type { DefinitionBrique } from "../catalogue";
import type { RenduBrique } from "./index";
import { OBJET_GROS_CHIFFRE, EXEMPLES_GROS_CHIFFRE } from "../../motion/petits-objets/gros-chiffre";
import { OBJET_ETAPE, EXEMPLES_ETAPES } from "../../motion/petits-objets/etapes";
import { OBJET_CARTES_COCHE, EXEMPLES_CARTES } from "../../motion/petits-objets/cartes";
import { OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE, EXEMPLES_MARQUES } from "../../motion/petits-objets/marques";
import { OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR, EXEMPLES_SOULIGNEMENTS } from "../../motion/petits-objets/soulignements";
import { OBJET_COMPTEUR_ROULEAU, EXEMPLES_ROULEAU } from "../../motion/petits-objets/compteur-rouleau";
import { OBJET_CARTON_DEFINITION, EXEMPLES_CARTON_DEFINITION } from "../../motion/petits-objets/carton-definition";
import { OBJET_FLECHE_MAIN_LEVEE, OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE, EXEMPLES_FLECHES } from "../../motion/petits-objets/fleches";
import { OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT, EXEMPLES_OBJETS_2027 } from "../../motion/petits-objets/objets-2027";
import { OBJET_CARTON_MAGAZINE, EXEMPLES_CARTON_MAGAZINE } from "../../motion/petits-objets/carton-magazine";
import { OBJET_TOURNE, EXEMPLES_OBJET_TOURNE } from "../../motion/petits-objets/objet-tourne";
import { OBJET_PARTICULES, EXEMPLES_PARTICULES } from "../../motion/petits-objets/particules";
import { OBJET_PANNEAU_REGLAGES, EXEMPLES_PANNEAU_REGLAGES } from "../../motion/petits-objets/panneau-reglages";
import { OBJET_ANNEAU_DONNEES, EXEMPLES_ANNEAU } from "../../motion/petits-objets/anneau-donnees";
import { DEF_CADRE_RECTANGLE, DEF_CADRE_COINS, DEF_CADRE_PASSAGE, EXEMPLES_CADRES } from "../../motion/petits-objets/cadres";
import { DEF_CERCLE, DEF_OVALE, DEF_DOUBLE_BOUCLE, EXEMPLES_ENTOURAGES } from "../../motion/petits-objets/entourages";
import { DEF_PASTILLE_ICONE, DEF_ETIQUETTE_ICONE, DEF_BADGE, DEF_TAMPON, EXEMPLES_ETIQUETTES } from "../../motion/petits-objets/etiquettes";
import { OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE, OBJET_BULLE_NOTIFICATION, EXEMPLES_BULLES } from "../../motion/petits-objets/bulles";
import { DEF_POST_IT, EXEMPLES_POST_IT } from "../../motion/petits-objets/post-it";
import { OBJET_SCHEMA_FLUX, EXEMPLES_FLUX } from "../../motion/petits-objets/schema-flux";
import { OBJET_SCHEMA_ETOILE, OBJET_ICONES_RELIEES, OBJET_AGENTS_GLOBE, EXEMPLES_SCHEMAS } from "../../motion/petits-objets/schemas-relies";
import { OBJET_GRILLE_POINTILLEE, OBJET_VIGNETTES_NUMEROTEES, EXEMPLES_GRILLE, EXEMPLES_VIGNETTES } from "../../motion/petits-objets/grille-vignettes";
import { OBJET_FENETRE_APP, EXEMPLES_FENETRE_APP } from "../../motion/petits-objets/fenetre-app";
import { OBJET_TERMINAL_COMMANDE, EXEMPLES_TERMINAL_COMMANDE } from "../../motion/petits-objets/terminal-commande";
import { DEF_DOSSIER, DEF_CHRONO, DEF_BARRE_PROGRESSION, EXEMPLES_DOSSIER_CHRONO_BARRE } from "../../motion/petits-objets/dossier-chrono-barre";
import { OBJET_ETAPE_SEGMENTS } from "../../motion/petits-objets/etapes";
import { DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION } from "../../motion/petits-objets/appel-action";
import { DEF_APPEL_MOT, EXEMPLES_APPEL_MOT } from "../../motion/petits-objets/appel-mot";
import { DEF_APPEL_RDV, EXEMPLES_APPEL_RDV } from "../../motion/petits-objets/appel-rdv";
import { OBJET_FRISE_MONTAGE, EXEMPLES_FRISE } from "../../motion/petits-objets/frise-montage";
import { OBJET_PELLICULE, EXEMPLES_PELLICULE } from "../../motion/petits-objets/pellicule";
import { OBJET_ONDE_MOTIF, EXEMPLES_ONDE } from "../../motion/petits-objets/onde";
import { OBJET_VOLET_AVANT_APRES } from "../../motion/petits-objets/volet-avant-apres";
import type { DefinitionObjet } from "../../motion/petits-objets/contrat";
import { validerVoletPlan } from "./volet-plan";
import { RenduVoletPlan } from "./rendu-volet-plan";
import { envelopperObjets } from "./objets";

// N-05-VOLET-d-v20j : le plan n'accepte qu'un volet SANS adresse ; les captures sont posées sur la copie de rendu (poser-captures-volet.ts).
const DEF_VOLET_PLAN = { ...OBJET_VOLET_AVANT_APRES, valider: validerVoletPlan, Rendu: RenduVoletPlan } as DefinitionObjet<unknown>;

export const OBJETS_PLAN_SCENES = [
  OBJET_GROS_CHIFFRE, OBJET_ETAPE, OBJET_CARTES_COCHE, OBJET_COCHE,
  // BR-OBJETS-c : 6 petits objets de plus (porte fermée)
  OBJET_SOULIGNEMENT_DROIT, OBJET_CROIX, OBJET_MOT_BARRE, OBJET_COMPTEUR_ROULEAU, OBJET_CARTON_DEFINITION, OBJET_FLECHE_MAIN_LEVEE,
  // BR-OBJETS-2027-b : croquis et traits de feutre
  OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT,
  // N-05-v19b : carton magazine, icône qui tourne, particules, panneau de réglages, anneau de données (porte fermée)
  OBJET_CARTON_MAGAZINE, OBJET_TOURNE, OBJET_PARTICULES, OBJET_PANNEAU_REGLAGES, OBJET_ANNEAU_DONNEES,
  // C9-34-TRAITS-v19c : 2 soulignements, surligneur, 3 flèches (porte fermée)
  OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR, OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE,
  // C9-34-CADRES-v20b : 3 cadres, cercle, ovale, double boucle (porte fermée)
  DEF_CADRE_RECTANGLE, DEF_CADRE_COINS, DEF_CADRE_PASSAGE, DEF_CERCLE, DEF_OVALE, DEF_DOUBLE_BOUCLE,
  // C9-34-ETIQUETTES-v20f (20/11/2026) : pastille, étiquette, badge, tampon, 3 bulles, post-it (porte fermée)
  DEF_PASTILLE_ICONE, DEF_ETIQUETTE_ICONE, DEF_BADGE, DEF_TAMPON, OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE, OBJET_BULLE_NOTIFICATION, DEF_POST_IT,
  // C9-34-SCHEMAS-v20g (20/11/2026) : 6 schémas, fenêtre d'application, terminal (porte fermée)
  OBJET_SCHEMA_FLUX, OBJET_SCHEMA_ETOILE, OBJET_ICONES_RELIEES, OBJET_AGENTS_GLOBE, OBJET_GRILLE_POINTILLEE, OBJET_VIGNETTES_NUMEROTEES, OBJET_FENETRE_APP, OBJET_TERMINAL_COMMANDE,
  // C9-34-FIN-v20h (20/11/2026) : 10 derniers petits objets (porte fermée)
  DEF_DOSSIER, DEF_CHRONO, DEF_BARRE_PROGRESSION, OBJET_ETAPE_SEGMENTS, DEF_APPEL_ACTION, DEF_APPEL_MOT, DEF_APPEL_RDV, OBJET_FRISE_MONTAGE, OBJET_PELLICULE, OBJET_ONDE_MOTIF,
  // N-05-VOLET-d-v20j : le volet avant / après, sans adresse (porte fermée)
  DEF_VOLET_PLAN,
];

/** Graine fixe et pure : somme des codes de caractères de l'identifiant. */
export function graineObjet(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  return somme;
}

export const PIECES_OBJETS = envelopperObjets(OBJETS_PLAN_SCENES, graineObjet);

const objet = (id: "objet-gros-chiffre" | "objet-etape" | "objet-cartes-coche" | "objet-coche" | "objet-soulignement-droit" | "objet-croix" | "objet-mot-barre" | "objet-compteur-rouleau" | "objet-carton-definition" | "objet-fleche-main-levee" | "objet-croquis" | "objet-feutre-entourage" | "objet-feutre-soulignement" | "objet-carton-magazine" | "objet-tourne" | "objet-particules" | "objet-panneau-reglages" | "objet-anneau-donnees" | "objet-soulignement-vague" | "objet-soulignement-double" | "objet-surligneur" | "objet-fleche-droite" | "objet-fleche-courbe" | "objet-fleche-pointillee" | "objet-cadre-rectangle" | "objet-cadre-coins" | "objet-cadre-passage" | "objet-cercle" | "objet-ovale" | "objet-double-boucle" | "objet-pastille-icone" | "objet-etiquette-icone" | "objet-badge" | "objet-tampon" | "objet-bulle-parole" | "objet-bulle-pensee" | "objet-bulle-notification" | "objet-post-it" | "objet-schema-flux" | "objet-schema-etoile" | "objet-icones-reliees" | "objet-agents-globe" | "objet-grille-pointillee" | "objet-vignettes-numerotees" | "objet-fenetre-app" | "objet-terminal-commande" | "objet-dossier" | "objet-chrono" | "objet-barre-progression" | "objet-etape-segments" | "objet-appel-action" | "objet-appel-mot" | "objet-appel-rdv" | "objet-frise-montage" | "objet-pellicule" | "objet-onde-motif" | "objet-volet-avant-apres", nom: string, description: string, def: { toile: { largeur: number; hauteur: number } }, exemple: unknown): DefinitionBrique => ({
  id,
  nom,
  description,
  famille: "objet",
  alias: [],
  toile: def.toile,
  schema: PIECES_OBJETS[id].schema,
  exemple,
});

export const BRIQUES_OBJETS = {
  "objet-gros-chiffre": objet("objet-gros-chiffre", "Gros chiffre", "Un nombre dit à voix haute, tracé en grand au moment où il est dit.", OBJET_GROS_CHIFFRE, EXEMPLES_GROS_CHIFFRE[0]),
  "objet-etape": objet("objet-etape", "Étape", "Une pastille « Étape n sur N » posée quand l'étape est annoncée.", OBJET_ETAPE, EXEMPLES_ETAPES[0]),
  "objet-cartes-coche": objet("objet-cartes-coche", "Cartes cochées", "Quelques cartes courtes qui se cochent au fil de ce qui est dit.", OBJET_CARTES_COCHE, EXEMPLES_CARTES[0]),
  "objet-coche": objet("objet-coche", "Coche", "Une coche tracée au moment où l'on dit que c'est fait.", OBJET_COCHE, EXEMPLES_MARQUES[0]),
  "objet-soulignement-droit": objet("objet-soulignement-droit", "Soulignement", "Un trait droit tracé sous le mot au moment où il est dit.", OBJET_SOULIGNEMENT_DROIT, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-croix": objet("objet-croix", "Croix", "Une croix tracée quand on dit que c'est faux.", OBJET_CROIX, EXEMPLES_MARQUES[0]),
  "objet-mot-barre": objet("objet-mot-barre", "Mot barré", "Un trait qui barre le mot qu'on corrige à voix haute.", OBJET_MOT_BARRE, EXEMPLES_MARQUES[0]),
  "objet-compteur-rouleau": objet("objet-compteur-rouleau", "Compteur qui roule", "Un nombre dit à voix haute, dont les chiffres roulent jusqu'à la valeur.", OBJET_COMPTEUR_ROULEAU, EXEMPLES_ROULEAU[0]),
  "objet-carton-definition": objet("objet-carton-definition", "Carton définition", "Un petit carton qui donne la définition d'un mot dit.", OBJET_CARTON_DEFINITION, EXEMPLES_CARTON_DEFINITION[0]),
  "objet-fleche-main-levee": objet("objet-fleche-main-levee", "Flèche à main levée", "Une flèche dessinée à la main qui désigne ce dont on parle.", OBJET_FLECHE_MAIN_LEVEE, EXEMPLES_FLECHES[0]),
  "objet-croquis": objet("objet-croquis", "Croquis", "Un rectangle esquissé à main levée autour de ce qui est dit.", OBJET_CROQUIS, EXEMPLES_OBJETS_2027.croquis[0]),
  "objet-feutre-entourage": objet("objet-feutre-entourage", "Entourage au feutre", "Un trait de feutre qui entoure le mot important au moment où il est dit.", OBJET_FEUTRE_ENTOURAGE, EXEMPLES_OBJETS_2027.feutreEntourage[0]),
  "objet-feutre-soulignement": objet("objet-feutre-soulignement", "Soulignement au feutre", "Un trait de feutre qui souligne le mot important au moment où il est dit.", OBJET_FEUTRE_SOULIGNEMENT, EXEMPLES_OBJETS_2027.feutreSoulignement[0]),
  // N-05-v19b
  "objet-carton-magazine": objet("objet-carton-magazine", "Carton magazine", "Un carton façon magazine qui met en avant le mot-clé dit à voix haute.", OBJET_CARTON_MAGAZINE, EXEMPLES_CARTON_MAGAZINE[0]),
  "objet-tourne": objet("objet-tourne", "Icône qui tourne", "Une icône qui tourne sur elle-même quand on en parle.", OBJET_TOURNE, EXEMPLES_OBJET_TOURNE[0]),
  "objet-particules": objet("objet-particules", "Particules", "De petites icônes qui tombent ou jaillissent pour marquer un moment fort.", OBJET_PARTICULES, EXEMPLES_PARTICULES[0]),
  "objet-panneau-reglages": objet("objet-panneau-reglages", "Panneau de réglages", "Un petit panneau de réglages dont les curseurs et les interrupteurs bougent.", OBJET_PANNEAU_REGLAGES, EXEMPLES_PANNEAU_REGLAGES[0]),
  "objet-anneau-donnees": objet("objet-anneau-donnees", "Anneau de données", "Un anneau qui se remplit jusqu'au pourcentage dit à voix haute.", OBJET_ANNEAU_DONNEES, EXEMPLES_ANNEAU[0]),
  // C9-34-TRAITS-v19c
  "objet-soulignement-vague": objet("objet-soulignement-vague", "Soulignement ondulé", "Un trait ondulé tracé sous le mot au moment où il est dit.", OBJET_SOULIGNEMENT_VAGUE, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-soulignement-double": objet("objet-soulignement-double", "Double soulignement", "Deux traits tracés sous le mot important au moment où il est dit.", OBJET_SOULIGNEMENT_DOUBLE, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-surligneur": objet("objet-surligneur", "Surligneur", "Un trait de surligneur passé sur le mot au moment où il est dit.", OBJET_SURLIGNEUR, EXEMPLES_SOULIGNEMENTS[0]),
  "objet-fleche-droite": objet("objet-fleche-droite", "Flèche droite", "Une flèche droite qui désigne ce dont on parle.", OBJET_FLECHE_DROITE, EXEMPLES_FLECHES[0]),
  "objet-fleche-courbe": objet("objet-fleche-courbe", "Flèche courbe", "Une flèche courbe qui désigne ce dont on parle.", OBJET_FLECHE_COURBE, EXEMPLES_FLECHES[1]),
  "objet-fleche-pointillee": objet("objet-fleche-pointillee", "Flèche en pointillés", "Une flèche en pointillés qui désigne ce dont on parle.", OBJET_FLECHE_POINTILLEE, EXEMPLES_FLECHES[2]),
  // C9-34-CADRES-v20b
  "objet-cadre-rectangle": objet("objet-cadre-rectangle", "Cadre", "Un cadre tracé autour de ce dont on parle au moment où on le dit.", DEF_CADRE_RECTANGLE, EXEMPLES_CADRES.rectangle[0]),
  "objet-cadre-coins": objet("objet-cadre-coins", "Cadre en coins", "Quatre coins tracés autour de ce dont on parle au moment où on le dit.", DEF_CADRE_COINS, EXEMPLES_CADRES.coins[0]),
  "objet-cadre-passage": objet("objet-cadre-passage", "Cadre qui passe", "Un cadre tracé autour d'un premier élément, puis qui glisse vers le suivant.", DEF_CADRE_PASSAGE, EXEMPLES_CADRES.passage[0]),
  "objet-cercle": objet("objet-cercle", "Cercle", "Un cercle tracé autour du mot important au moment où il est dit.", DEF_CERCLE, EXEMPLES_ENTOURAGES.cercle[0]),
  "objet-ovale": objet("objet-ovale", "Ovale", "Un ovale tracé autour du mot important au moment où il est dit.", DEF_OVALE, EXEMPLES_ENTOURAGES.ovale[0]),
  "objet-double-boucle": objet("objet-double-boucle", "Double boucle", "Une double boucle tracée autour du mot important au moment où il est dit.", DEF_DOUBLE_BOUCLE, EXEMPLES_ENTOURAGES.doubleBoucle[0]),
  // C9-34-ETIQUETTES-v20f
  "objet-pastille-icone": objet("objet-pastille-icone", "Pastille", "Une pastille avec une petite icône et un mot court, posée au moment où il est dit.", DEF_PASTILLE_ICONE, EXEMPLES_ETIQUETTES.pastille[0]),
  "objet-etiquette-icone": objet("objet-etiquette-icone", "Étiquette", "Une étiquette avec un mot court, posée au moment où il est dit.", DEF_ETIQUETTE_ICONE, EXEMPLES_ETIQUETTES.etiquette[0]),
  "objet-badge": objet("objet-badge", "Badge", "Un badge avec un mot court, posé quand on annonce que c'est validé ou nouveau.", DEF_BADGE, EXEMPLES_ETIQUETTES.badge[0]),
  "objet-tampon": objet("objet-tampon", "Tampon", "Un tampon frappé sur l'écran au moment où le mot est dit.", DEF_TAMPON, EXEMPLES_ETIQUETTES.tampon[0]),
  "objet-bulle-parole": objet("objet-bulle-parole", "Bulle de parole", "Une bulle de parole qui reprend quelques mots dits à voix haute.", OBJET_BULLE_PAROLE, EXEMPLES_BULLES[0]),
  "objet-bulle-pensee": objet("objet-bulle-pensee", "Bulle de pensée", "Une bulle de pensée qui reprend quelques mots pensés à voix haute.", OBJET_BULLE_PENSEE, EXEMPLES_BULLES[1]),
  "objet-bulle-notification": objet("objet-bulle-notification", "Bulle de notification", "Une bulle de notification qui reprend le message dont on parle.", OBJET_BULLE_NOTIFICATION, EXEMPLES_BULLES[2]),
  "objet-post-it": objet("objet-post-it", "Post-it", "Un post-it dont les mots apparaissent au fil de ce qui est dit.", DEF_POST_IT, EXEMPLES_POST_IT[0]),
  // C9-34-SCHEMAS-v20g
  "objet-schema-flux": objet("objet-schema-flux", "Schéma de flux", "Un schéma en étapes reliées qui se construit au fil de ce qui est expliqué.", OBJET_SCHEMA_FLUX, EXEMPLES_FLUX[0]),
  "objet-schema-etoile": objet("objet-schema-etoile", "Schéma en étoile", "Un schéma avec un élément au centre et des satellites qui apparaissent un à un.", OBJET_SCHEMA_ETOILE, EXEMPLES_SCHEMAS.etoile[0]),
  "objet-icones-reliees": objet("objet-icones-reliees", "Icônes reliées", "Une rangée d'icônes reliées entre elles, tracée au rythme de la parole.", OBJET_ICONES_RELIEES, EXEMPLES_SCHEMAS.icones[0]),
  "objet-agents-globe": objet("objet-agents-globe", "Agents reliés au globe", "Une rangée d'agents reliés à un globe, pour montrer plusieurs relais d'un même réseau.", OBJET_AGENTS_GLOBE, EXEMPLES_SCHEMAS.agents[0]),
  "objet-grille-pointillee": objet("objet-grille-pointillee", "Grille pointillée", "Une grille en pointillés qui se dessine derrière ce dont on parle.", OBJET_GRILLE_POINTILLEE, EXEMPLES_GRILLE[0]),
  "objet-vignettes-numerotees": objet("objet-vignettes-numerotees", "Vignettes numérotées", "Une série de vignettes numérotées qui apparaissent dans l'ordre où on les cite.", OBJET_VIGNETTES_NUMEROTEES, EXEMPLES_VIGNETTES[0]),
  "objet-fenetre-app": objet("objet-fenetre-app", "Fenêtre d'application", "Une fenêtre d'application dessinée, pour montrer l'outil dont on parle.", OBJET_FENETRE_APP, EXEMPLES_FENETRE_APP[0]),
  "objet-terminal-commande": objet("objet-terminal-commande", "Terminal", "Un terminal où une commande s'écrit au moment où elle est dite.", OBJET_TERMINAL_COMMANDE, EXEMPLES_TERMINAL_COMMANDE[0]),
  // C9-34-FIN-v20h
  "objet-dossier": objet("objet-dossier", "Dossier", "Un dossier dont les feuilles se posent une à une quand on parle des pièces à fournir.", DEF_DOSSIER, EXEMPLES_DOSSIER_CHRONO_BARRE.dossier[0]),
  "objet-chrono": objet("objet-chrono", "Chronomètre", "Un chronomètre qui affiche la durée dite à voix haute.", DEF_CHRONO, EXEMPLES_DOSSIER_CHRONO_BARRE.chrono[0]),
  "objet-barre-progression": objet("objet-barre-progression", "Barre de progression", "Une barre qui se remplit jusqu'à l'avancement dont on parle.", DEF_BARRE_PROGRESSION, EXEMPLES_DOSSIER_CHRONO_BARRE.barre[0]),
  "objet-etape-segments": objet("objet-etape-segments", "Étape en segments", "Une jauge en segments « Étape n sur N » posée quand l'étape est annoncée.", OBJET_ETAPE_SEGMENTS, EXEMPLES_ETAPES[0]),
  "objet-appel-action": objet("objet-appel-action", "Appel à l'action", "Un appel à l'action (abonne-toi, lien en bio) dessiné au moment où il est dit.", DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION[0]),
  "objet-appel-mot": objet("objet-appel-mot", "Appel par un mot", "Un appel « Tape / Commente + mot » dessiné au moment où le mot est dit.", DEF_APPEL_MOT, EXEMPLES_APPEL_MOT[0]),
  "objet-appel-rdv": objet("objet-appel-rdv", "Prendre rendez-vous", "Un bouton « Prendre rendez-vous » cliqué au moment où on invite à réserver.", DEF_APPEL_RDV, EXEMPLES_APPEL_RDV[0]),
  "objet-frise-montage": objet("objet-frise-montage", "Frise de montage", "Une frise de blocs de montage qui se pose au fil de ce qui est expliqué.", OBJET_FRISE_MONTAGE, EXEMPLES_FRISE[0]),
  "objet-pellicule": objet("objet-pellicule", "Pellicule", "Une pellicule de cases qui défile au rythme de ce qui est dit.", OBJET_PELLICULE, EXEMPLES_PELLICULE[0]),
  "objet-onde-motif": objet("objet-onde-motif", "Onde", "Une onde de barres qui bouge au rythme de la voix.", OBJET_ONDE_MOTIF, EXEMPLES_ONDE[0]),
  "objet-volet-avant-apres": objet("objet-volet-avant-apres", "Volet avant / après", "Un volet qui découvre un « après » par-dessus un « avant ».", DEF_VOLET_PLAN, { etiquettes: true }),
} as const;

export const RENDUS_OBJETS = {
  "objet-gros-chiffre": PIECES_OBJETS["objet-gros-chiffre"].Rendu as RenduBrique,
  "objet-etape": PIECES_OBJETS["objet-etape"].Rendu as RenduBrique,
  "objet-cartes-coche": PIECES_OBJETS["objet-cartes-coche"].Rendu as RenduBrique,
  "objet-coche": PIECES_OBJETS["objet-coche"].Rendu as RenduBrique,
  "objet-soulignement-droit": PIECES_OBJETS["objet-soulignement-droit"].Rendu as RenduBrique,
  "objet-croix": PIECES_OBJETS["objet-croix"].Rendu as RenduBrique,
  "objet-mot-barre": PIECES_OBJETS["objet-mot-barre"].Rendu as RenduBrique,
  "objet-compteur-rouleau": PIECES_OBJETS["objet-compteur-rouleau"].Rendu as RenduBrique,
  "objet-carton-definition": PIECES_OBJETS["objet-carton-definition"].Rendu as RenduBrique,
  "objet-fleche-main-levee": PIECES_OBJETS["objet-fleche-main-levee"].Rendu as RenduBrique,
  "objet-croquis": PIECES_OBJETS["objet-croquis"].Rendu as RenduBrique,
  "objet-feutre-entourage": PIECES_OBJETS["objet-feutre-entourage"].Rendu as RenduBrique,
  "objet-feutre-soulignement": PIECES_OBJETS["objet-feutre-soulignement"].Rendu as RenduBrique,
  // N-05-v19b
  "objet-carton-magazine": PIECES_OBJETS["objet-carton-magazine"].Rendu as RenduBrique,
  "objet-tourne": PIECES_OBJETS["objet-tourne"].Rendu as RenduBrique,
  "objet-particules": PIECES_OBJETS["objet-particules"].Rendu as RenduBrique,
  "objet-panneau-reglages": PIECES_OBJETS["objet-panneau-reglages"].Rendu as RenduBrique,
  "objet-anneau-donnees": PIECES_OBJETS["objet-anneau-donnees"].Rendu as RenduBrique,
  // C9-34-TRAITS-v19c
  "objet-soulignement-vague": PIECES_OBJETS["objet-soulignement-vague"].Rendu as RenduBrique,
  "objet-soulignement-double": PIECES_OBJETS["objet-soulignement-double"].Rendu as RenduBrique,
  "objet-surligneur": PIECES_OBJETS["objet-surligneur"].Rendu as RenduBrique,
  "objet-fleche-droite": PIECES_OBJETS["objet-fleche-droite"].Rendu as RenduBrique,
  "objet-fleche-courbe": PIECES_OBJETS["objet-fleche-courbe"].Rendu as RenduBrique,
  "objet-fleche-pointillee": PIECES_OBJETS["objet-fleche-pointillee"].Rendu as RenduBrique,
  // C9-34-CADRES-v20b
  "objet-cadre-rectangle": PIECES_OBJETS["objet-cadre-rectangle"].Rendu as RenduBrique,
  "objet-cadre-coins": PIECES_OBJETS["objet-cadre-coins"].Rendu as RenduBrique,
  "objet-cadre-passage": PIECES_OBJETS["objet-cadre-passage"].Rendu as RenduBrique,
  "objet-cercle": PIECES_OBJETS["objet-cercle"].Rendu as RenduBrique,
  "objet-ovale": PIECES_OBJETS["objet-ovale"].Rendu as RenduBrique,
  "objet-double-boucle": PIECES_OBJETS["objet-double-boucle"].Rendu as RenduBrique,
  // C9-34-ETIQUETTES-v20f
  "objet-pastille-icone": PIECES_OBJETS["objet-pastille-icone"].Rendu as RenduBrique,
  "objet-etiquette-icone": PIECES_OBJETS["objet-etiquette-icone"].Rendu as RenduBrique,
  "objet-badge": PIECES_OBJETS["objet-badge"].Rendu as RenduBrique,
  "objet-tampon": PIECES_OBJETS["objet-tampon"].Rendu as RenduBrique,
  "objet-bulle-parole": PIECES_OBJETS["objet-bulle-parole"].Rendu as RenduBrique,
  "objet-bulle-pensee": PIECES_OBJETS["objet-bulle-pensee"].Rendu as RenduBrique,
  "objet-bulle-notification": PIECES_OBJETS["objet-bulle-notification"].Rendu as RenduBrique,
  "objet-post-it": PIECES_OBJETS["objet-post-it"].Rendu as RenduBrique,
  // C9-34-SCHEMAS-v20g
  "objet-schema-flux": PIECES_OBJETS["objet-schema-flux"].Rendu as RenduBrique,
  "objet-schema-etoile": PIECES_OBJETS["objet-schema-etoile"].Rendu as RenduBrique,
  "objet-icones-reliees": PIECES_OBJETS["objet-icones-reliees"].Rendu as RenduBrique,
  "objet-agents-globe": PIECES_OBJETS["objet-agents-globe"].Rendu as RenduBrique,
  "objet-grille-pointillee": PIECES_OBJETS["objet-grille-pointillee"].Rendu as RenduBrique,
  "objet-vignettes-numerotees": PIECES_OBJETS["objet-vignettes-numerotees"].Rendu as RenduBrique,
  "objet-fenetre-app": PIECES_OBJETS["objet-fenetre-app"].Rendu as RenduBrique,
  "objet-terminal-commande": PIECES_OBJETS["objet-terminal-commande"].Rendu as RenduBrique,
  // C9-34-FIN-v20h
  "objet-dossier": PIECES_OBJETS["objet-dossier"].Rendu as RenduBrique,
  "objet-chrono": PIECES_OBJETS["objet-chrono"].Rendu as RenduBrique,
  "objet-barre-progression": PIECES_OBJETS["objet-barre-progression"].Rendu as RenduBrique,
  "objet-etape-segments": PIECES_OBJETS["objet-etape-segments"].Rendu as RenduBrique,
  "objet-appel-action": PIECES_OBJETS["objet-appel-action"].Rendu as RenduBrique,
  "objet-appel-mot": PIECES_OBJETS["objet-appel-mot"].Rendu as RenduBrique,
  "objet-appel-rdv": PIECES_OBJETS["objet-appel-rdv"].Rendu as RenduBrique,
  "objet-frise-montage": PIECES_OBJETS["objet-frise-montage"].Rendu as RenduBrique,
  "objet-pellicule": PIECES_OBJETS["objet-pellicule"].Rendu as RenduBrique,
  "objet-onde-motif": PIECES_OBJETS["objet-onde-motif"].Rendu as RenduBrique,
  "objet-volet-avant-apres": PIECES_OBJETS["objet-volet-avant-apres"].Rendu as RenduBrique,
} as const;
