/**
 * Stockage et lecture de la fiche d'une entrée du calendrier (L4-04). Ni « use server » ni Next : les actions du
 * calendrier l'appellent, et un service d'envoi peut le lire sans importer une action.
 * Le texte d'un créneau et le premier commentaire (créneau ou publication) sont rangés par entrée et par réseau
 * dans le dépôt des réglages, sous `calendrier.fiche.<clé de la carte>`. Rien ne part d'ici.
 */
import type { EntreeFiche, CleFiche } from "@/components/calendrier/FicheEntree";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { etatDepuisStatut } from "@/components/calendrier/PastilleStatutPlan";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import type { Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import { depots, ecrireParametre, ErreurStudio, lireParametre } from "@/services/_commun";

export const FICHE_INTROUVABLE = "Cette publication est introuvable dans le calendrier. Rechargez la page.";
const ETATS_ENVOI_CONFIES: readonly string[] = ["en-cours", "envoye", "a-verifier"];

export type SourceFiche = { origine: "publication"; publication: Publication } | { origine: "creneau"; creneau: CreneauEditorial };
export interface FicheChargee {
  cle: CleFiche;
  source: SourceFiche;
  entree: EntreeFiche;
}

/** Texte et premier commentaire saisis dans la fiche. */
export interface StockageFiche {
  texte?: string;
  premierCommentaire?: string;
}

const cleStockage = (cle: CleFiche) => `calendrier.fiche.${cle.cle}`;
const chaine = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

/** Lit ce que la fiche a rangé pour cette entrée ; une valeur illisible ne rend rien. */
export async function lireStockageFiche(cle: CleFiche): Promise<StockageFiche> {
  const brut = await lireParametre<unknown>(cleStockage(cle), null);
  const o = brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  return { texte: chaine(o.texte), premierCommentaire: chaine(o.premierCommentaire) };
}

/** Range le texte et/ou le premier commentaire de cette entrée (ce qui est absent n'est pas écrit). */
export async function ecrireStockageFiche(cle: CleFiche, valeur: { texte?: string; premierCommentaire?: string }): Promise<void> {
  const propre: Record<string, string> = {};
  if (valeur.texte !== undefined) propre.texte = valeur.texte;
  if (valeur.premierCommentaire !== undefined) propre.premierCommentaire = valeur.premierCommentaire;
  await ecrireParametre(cleStockage(cle), propre);
}

/** « HH:MM » à Paris, ou rien si l'instant est illisible. */
function heureParis(instant: string | undefined): string | undefined {
  if (!instant || Number.isNaN(Date.parse(instant))) return undefined;
  return heureAffichageParis(instant);
}

/** Relit l'entrée là où elle vit et la présente comme la fiche la montre. Lève « introuvable » sinon. */
export async function chargerFiche(cleBrute: unknown): Promise<FicheChargee> {
  const cle = lireCleFiche(cleBrute);
  if (!cle) throw new ErreurStudio("FICHE_INTROUVABLE", FICHE_INTROUVABLE);
  const garde = await lireStockageFiche(cle);
  if (cle.origine === "publication") {
    const p = await depots().publications.obtenir(cle.id);
    const etat = p && p.reseau === cle.reseau ? etatDepuisStatut(p.statut) : null;
    if (!p || !etat) throw new ErreurStudio("FICHE_INTROUVABLE", FICHE_INTROUVABLE);
    const lisible = !Number.isNaN(Date.parse(p.date));
    const confiee = p.statut === "programmee" || Boolean(p.idExterne) || ETATS_ENVOI_CONFIES.includes(p.etatEnvoi ?? "");
    return {
      cle,
      source: { origine: "publication", publication: p },
      entree: { cle: cle.cle, jour: lisible ? cleJour(p.date) : "", reseau: cle.reseau, type: p.visuelId ? "carrousel" : "video", etat, heure: heureParis(p.date), texte: p.texte ?? "", premierCommentaire: garde.premierCommentaire, confiee },
    };
  }
  const c = await depots().creneauxEditoriaux.obtenir(cle.id);
  // Même règle que la vue du calendrier : un réseau sans heure n'est pas une entrée.
  const etat = c && c.heuresParReseau[cle.reseau] ? etatDepuisStatut(c.statut) : null;
  if (!c || !etat) throw new ErreurStudio("FICHE_INTROUVABLE", FICHE_INTROUVABLE);
  return {
    cle,
    source: { origine: "creneau", creneau: c },
    entree: { cle: cle.cle, jour: c.jourVise, reseau: cle.reseau, type: c.visuelId ? "carrousel" : "video", etat, heure: heureParis(c.heuresParReseau[cle.reseau]), texte: garde.texte ?? "", premierCommentaire: garde.premierCommentaire, confiee: c.statut === "programme" },
  };
}
