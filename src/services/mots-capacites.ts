/**
 * MOTS (PV-5) · capacités par réseau et graphe adapté. MODULE PUR, aucun réseau, aucun état.
 *
 * Source de la matrice : ADR parcours « mot → e-mail → guide », décision P2 (docs/zernio/parcours-viral/01-ADR-…) :
 *   - Facebook, Instagram : réponse publique + message privé (automatique) ;
 *   - LinkedIn page, TikTok : réponse publique À LA MAIN uniquement (décision du dirigeant, RC-43 : jamais automatique) ;
 *   - LinkedIn profil : manuel (aucune automatisation).
 *
 * ⚠ À CONFIRMER : l'extrait OpenAPI du dépôt (docs/zernio/openapi-extrait-1.418.1.json, 9 chemins) ne décrit AUCUN chemin
 * de commentaires ni de réponse privée. Que Zernio permette réellement la réponse publique sur LinkedIn page et TikTok
 * n'est donc PAS documenté ici : c'est le périmètre voulu par l'ADR, à confirmer par un essai réel avant toute activation.
 * Le graphe de PV-3 (`mots-graphe.ts`) est réutilisé tel quel (non modifié) : on le construit puis on en retire l'étape
 * de message privé quand le réseau ne la permet pas.
 */
import { construireGrapheMot, type DefinitionWorkflow, type EtapeGraphe, type ResultatGraphe } from "./mots-graphe";
import type { TextesMot } from "./mots-textes";

export const RESEAUX = ["facebook", "instagram", "linkedin_page", "tiktok", "linkedin_profil"] as const;
export type Reseau = (typeof RESEAUX)[number];

export interface Capacite {
  /** « auto » = posée par le workflow ; « manuel » = faite à la main par l'opérateur ; « non » = jamais. */
  reponsePublique: "auto" | "manuel";
  messagePrive: "auto" | "non";
  /** Un workflow Zernio peut-il être posé pour ce réseau ? */
  automatisable: boolean;
  /** Source de la règle ; `confirmeChezZernio: false` = À CONFIRMER (non documenté dans l'extrait OpenAPI du dépôt). */
  source: "ADR P2";
  confirmeChezZernio: false;
}

const base = { source: "ADR P2", confirmeChezZernio: false } as const;
export const CAPACITES: Readonly<Record<Reseau, Capacite>> = {
  facebook: { reponsePublique: "auto", messagePrive: "auto", automatisable: true, ...base },
  instagram: { reponsePublique: "auto", messagePrive: "auto", automatisable: true, ...base },
  linkedin_page: { reponsePublique: "manuel", messagePrive: "non", automatisable: false, ...base },
  tiktok: { reponsePublique: "manuel", messagePrive: "non", automatisable: false, ...base },
  linkedin_profil: { reponsePublique: "manuel", messagePrive: "non", automatisable: false, ...base },
};

export const estReseau = (v: unknown): v is Reseau => typeof v === "string" && (RESEAUX as readonly string[]).includes(v);
export const capaciteDe = (r: Reseau): Capacite => CAPACITES[r];
export const peutMessagePrive = (r: Reseau): boolean => CAPACITES[r].messagePrive === "auto";

export type CodeRefusReseau = "reseau_inconnu" | "manuel_seulement";
export type ResultatGrapheReseau = ResultatGraphe | { ok: false; code: CodeRefusReseau; refus: [] };

/**
 * Graphe adapté à la capacité du réseau. Les textes sont validés et contrôlés par `construireGrapheMot` (PV-3), puis :
 *  - réseau à message privé (Facebook, Instagram) : graphe complet de PV-3, déclencheur limité à ce réseau ;
 *  - LinkedIn page, TikTok, LinkedIn profil : refus (`manuel_seulement`), réponse publique à la main avec le kit à copier
 *    (RC-43 : jamais de réponse publique automatique sur ces réseaux).
 */
export function construireGrapheReseau(textes: TextesMot, reseau: unknown): ResultatGrapheReseau {
  if (!estReseau(reseau)) return { ok: false, code: "reseau_inconnu", refus: [] };
  const cap = CAPACITES[reseau];
  if (!cap.automatisable) return { ok: false, code: "manuel_seulement", refus: [] };
  const g = construireGrapheMot(textes, { reseaux: [reseau === "linkedin_page" ? "linkedin" : reseau] });
  if (!g.ok || cap.messagePrive === "auto") return g;
  const reponse = g.workflow.etapes.find((e) => e.type === "repondre_commentaire");
  if (!reponse || reponse.type !== "repondre_commentaire") return { ok: false, code: "texte_refuse", refus: [] };
  const etapes: EtapeGraphe[] = [
    { id: "e1", type: "repondre_commentaire", texte: reponse.texte, suite: "e2" },
    { id: "e2", type: "terminer", texte: null },
  ];
  return { ok: true, workflow: { ...g.workflow, nom: `${g.workflow.nom}-${reseau}`, etapes } };
}

/** Garde finale (défense en profondeur) : un workflow destiné à ce réseau ne contient jamais d'étape interdite. PUR. */
export function grapheConformeAuReseau(w: DefinitionWorkflow, reseau: Reseau): boolean {
  const cap = CAPACITES[reseau];
  if (!cap.automatisable) return false;
  if (cap.messagePrive === "non" && w.etapes.some((e) => e.type === "envoyer_message_prive" || e.type === "relancer" || e.type === "attendre_reponse")) return false;
  return true;
}
