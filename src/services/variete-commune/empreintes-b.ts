/**
 * Empreintes visuelles (E2, fiche X2-07) : face caméra animée v4, cartes (avocat, face caméra), choix figés de la
 * bibliothèque. Module PUR, côté Studio seulement : aucun appelant, aucune date du jour, aucun hasard, aucun réseau.
 * Éteint par construction : rien ne l'importe en production.
 */
import type { AxeCommun, EmpreinteVideo } from "@/briques/variete-commune/types";
import { VERSION_EMPREINTE } from "@/briques/variete-commune/version";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import type { HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import type { Choix } from "@/briques/bibliotheque-video/types";

export type AxesEmpreinte = Partial<Record<AxeCommun, string[]>>;

const FORMAT_V4 = "facecam-animee-v4";
/** Code local de la palette des plaquettes v4 (une seule palette : l'ivoire v4) dans la table de correspondance. */
const CODE_PALETTE_V4 = "v4";

const uniquesTries = (l: readonly string[]): string[] => [...new Set(l)].sort();

/** Retire les axes vides : un axe sans valeur n'existe pas. */
const sansVides = (axes: AxesEmpreinte): AxesEmpreinte =>
  Object.fromEntries(Object.entries(axes).filter(([, v]) => v && v.length > 0)) as AxesEmpreinte;

/** Face caméra animée v4 : ouverture = famille de la 1re plaquette, objets = familles, typo = Montserrat v4. */
export function empreinteV4(videoId: string, le: string, historique: HistoriqueVideo): EmpreinteVideo {
  // Plaquettes v4 : ids → famille (CATALOGUE_V4, lecture seule) ; id inconnu : on garde l'id, sans exception.
  const familleDe = (id: string): string => CATALOGUE_V4.find((f) => f.id === id)?.famille ?? id;
  const ids = historique.plaquettesV4 ?? [];
  const familles = ids.length ? ids.map(familleDe) : [...(historique.familles ?? [])];
  const premiere = historique.ouvertureV4 ? familleDe(historique.ouvertureV4) : familles[0];
  return {
    version: VERSION_EMPREINTE, videoId, formatId: FORMAT_V4, le,
    axes: sansVides({
      ouverture: premiere ? [versCommun("facecam-animee", "ouverture", premiere)] : [],
      objets: uniquesTries(familles.map((f) => versCommun("facecam-animee", "objets", f))),
      typo: ["montserrat-v4"],
      palette: [versCommun("facecam-animee", "palette", CODE_PALETTE_V4)],
    }),
  };
}

/** Cartes (avocat, face caméra) : ouverture = 1re carte dans le temps, objets = modèles. */
export function empreinteCartes(videoId: string, le: string, formatId: string, cartes: readonly { modele: string; debutSec: number }[]): EmpreinteVideo {
  const ordre = [...cartes].sort((a, b) => a.debutSec - b.debutSec);
  return {
    version: VERSION_EMPREINTE, videoId, formatId, le,
    axes: sansVides({
      ouverture: ordre.length ? [versCommun("cartes", "ouverture", ordre[0].modele)] : [],
      objets: uniquesTries(ordre.map((c) => versCommun("cartes", "objets", c.modele))),
    }),
  };
}

/**
 * Choix figés de la bibliothèque → axes communs. `texte.style-varie` → sousTitres (la signature) ; `son.*` → sons ;
 * `etalonnage.*` → palette ; `transition.*` → transitions ; tout autre choix est ignoré sans exception.
 */
export function axesDesChoix(choix: readonly Choix[]): AxesEmpreinte {
  const axes: Record<string, string[]> = {};
  const ajoute = (axe: AxeCommun, v: string) => (axes[axe] ??= []).push(v);
  for (const c of choix ?? []) {
    const cap = typeof c?.capacite === "string" ? c.capacite : "";
    if (cap === "texte.style-varie") { if (c.signature) ajoute("sousTitres", c.signature); }
    else if (cap.startsWith("son.")) ajoute("sons", c.cle);
    else if (cap.startsWith("etalonnage.")) ajoute("palette", c.cle);
    else if (cap.startsWith("transition.")) ajoute("transitions", c.cle);
  }
  return sansVides(Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, uniquesTries(v)])) as AxesEmpreinte);
}

/** Union triée, sans doublon, axe par axe. */
export function fusionnerAxes(...liste: readonly AxesEmpreinte[]): AxesEmpreinte {
  const r: Record<string, string[]> = {};
  for (const axes of liste) for (const [k, v] of Object.entries(axes)) r[k] = [...(r[k] ?? []), ...(v ?? [])];
  return sansVides(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, uniquesTries(v)])) as AxesEmpreinte);
}
