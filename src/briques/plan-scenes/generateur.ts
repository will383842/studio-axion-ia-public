/**
 * GÉNÉRATEUR DU PLAN DE SCÈNES (lot C) — script + minutage des mots → plan validé, via l'interface existante
 * `src/fournisseurs/claude` (`RequeteClaude` / `ReponseClaude`, JSON demandé dans la consigne, `extraireJson`).
 * Le fournisseur est INJECTÉ (`AppelClaude`) : les tests passent un faux, jamais d'appel réel.
 * Jamais d'échec : sortie illisible → un second essai avec le motif, puis plan de repli niveau 1 ; panne du fournisseur
 * → plan de repli, avec une remarque. Le branchement au pré-vol et à la réservation des crédits
 * (`services/generation-claude.ts`) reste à faire avant tout usage en production.
 */
import { ErreurClaude, extraireJson, type RequeteClaude, type ReponseClaude } from "@/fournisseurs/claude/client";
import { CATALOGUE_BRIQUES } from "./catalogue";
import { VERSION_PLAN_SCENES, type FormatPlan, type MotMinute, type PlanValide } from "./schema";
import { planDeRepli, validerPlan, type Remarque } from "./validateur";
import { POSITIONS, TRANSITIONS, ZONE_VISAGE } from "./zones";
import { z } from "zod";

/** Modèle du générateur de plan (réglable ici). */
export const MODELE_PLAN_SCENES = "claude-opus-5-5";
export const EFFORT_PLAN_SCENES = "high" as const;
export const MAX_JETONS_PLAN_SCENES = 16_000;

export type AppelClaude = (requete: RequeteClaude) => Promise<ReponseClaude>;

export interface EntreeGenerateurPlan {
  script: string;
  mots: MotMinute[];
  format: FormatPlan;
  facecam: boolean;
}

export interface ResultatGenerateurPlan {
  plan: PlanValide;
  remarques: Remarque[];
  /** `llm` : plan composé par le LLM (réparé au besoin) ; `repli` : plan simple, le LLM n'a rien donné d'utilisable. */
  source: "llm" | "repli";
}

/** Consigne figée (cache 1 h) : le catalogue, les règles de la charte et la forme JSON attendue. */
export function consignePlan(): string {
  const catalogue = Object.values(CATALOGUE_BRIQUES)
    .map((d) => `- ${d.id} (${d.nom}) : ${d.description}\n  paramètres (exemple) : ${JSON.stringify(d.exemple)}\n  schéma : ${JSON.stringify(z.toJSONSchema(d.schema))}`)
    .join("\n");
  return [
    "Vous composez le PLAN DE SCÈNES d'une vidéo Axion IA : du motion design de fausse interface logicielle, au mot près.",
    "Le script de Williams fait foi : ne changez aucun mot, ne retirez aucune phrase.",
    "Chaque scène couvre des mots consécutifs (indices du minutage, `mots.premier` et `mots.dernier`) ; son `debutMs` est celui du premier mot, son `finMs` au moins la fin du dernier mot et au plus le début de la scène suivante.",
    "Niveaux : 1 = une pièce du catalogue (`piece` + `parametres`) ; 2 = une composition de calques (`calques` : pièces posées dans une zone, décalées de `debutMs` depuis le début de la scène ; un calque `zoom-camera` agrandit les autres), avec toujours une `piece` niveau 1 de repli ; n'utilisez pas le niveau 3.",
    `Positions : ${POSITIONS.join(", ")}. En face caméra, rien devant le visage (zone x ${ZONE_VISAGE.x}–${ZONE_VISAGE.x + ZONE_VISAGE.largeur} %, y ${ZONE_VISAGE.y}–${ZONE_VISAGE.y + ZONE_VISAGE.hauteur} %) : utilisez « bas » ou « haut ».`,
    `Transitions douces seulement : ${TRANSITIONS.join(", ")} (200 à 800 ms). Aucune couleur ni police dans les paramètres : la charte Axion s'applique seule (fond ivoire ou noir, accent terracotta ; orange seulement sur noir).`,
    "Catalogue :",
    catalogue,
    `Répondez par UN objet JSON seul : { "version": "${VERSION_PLAN_SCENES}", "format": {…}, "facecam": bool, "dureeMs": n, "habillage": { "fond": "ivoire"|"noir", "accent": "terracotta"|"orange" }, "mots": [recopiez le minutage], "scenes": [ { "id", "version": 1, "mots": { "premier", "dernier" }, "debutMs", "finMs", "niveau", "texte"?, "position", "transition": { "entree", "sortie", "dureeMs" }, "piece", "parametres", "calques"? } ] }.`,
  ].join("\n");
}

export function construireRequetePlan(e: EntreeGenerateurPlan, precedents: { reponse: string; motif: string }[] = []): RequeteClaude {
  const demande = [
    `Format : ${e.format.largeur} × ${e.format.hauteur}, 25 i/s. Face caméra : ${e.facecam ? "oui" : "non"}.`,
    "Script :",
    e.script,
    "Minutage des mots (indice, texte, début ms, fin ms) :",
    e.mots.map((m, i) => `${i}\t${m.texte}\t${m.debutMs}\t${m.finMs}`).join("\n"),
  ].join("\n");
  const messages: RequeteClaude["messages"] = [{ role: "user", contenu: demande }];
  for (const p of precedents) {
    messages.push({ role: "assistant", contenu: p.reponse.slice(0, 4000) || "(vide)" });
    messages.push({ role: "user", contenu: `Réponse inutilisable : ${p.motif}. Renvoyez uniquement l'objet JSON complet du plan.` });
  }
  return { modele: MODELE_PLAN_SCENES, maxTokens: MAX_JETONS_PLAN_SCENES, effort: EFFORT_PLAN_SCENES, systeme: [{ texte: consignePlan(), cache: "1h" }], messages, json: true };
}

function lireJson(texte: string): { ok: true; valeur: unknown } | { ok: false; motif: string } {
  try {
    const v: unknown = JSON.parse(extraireJson(texte));
    if (!v || typeof v !== "object" || !Array.isArray((v as { scenes?: unknown }).scenes)) return { ok: false, motif: "objet sans liste « scenes »" };
    return { ok: true, valeur: v };
  } catch {
    return { ok: false, motif: "ce n'est pas du JSON lisible" };
  }
}

/** Compose le plan : au plus deux appels au fournisseur, jamais d'exception pour une sortie ou une panne. */
export async function genererPlan(e: EntreeGenerateurPlan, appeler: AppelClaude): Promise<ResultatGenerateurPlan> {
  const contexte = { mots: e.mots, format: e.format, facecam: e.facecam };
  const precedents: { reponse: string; motif: string }[] = [];
  for (let essai = 0; essai < 2; essai++) {
    let reponse: ReponseClaude;
    try {
      reponse = await appeler(construireRequetePlan(e, precedents));
    } catch (err) {
      const message = err instanceof ErreurClaude ? err.message : "erreur inattendue";
      return repli(contexte, { code: "LLM_INDISPONIBLE", message: `Composition par l'IA indisponible (${message}) : plan simple.` });
    }
    const lu = lireJson(reponse.texte);
    if (lu.ok) {
      const r = validerPlan(lu.valeur, contexte);
      return { plan: r.plan, remarques: r.remarques, source: "llm" };
    }
    precedents.push({ reponse: reponse.texte, motif: reponse.stopReason === "max_tokens" ? "réponse coupée par la limite de sortie" : lu.motif });
  }
  return repli(contexte, { code: "LLM_ILLISIBLE", message: "Réponse de l'IA illisible deux fois : plan simple (légendes et chiffres)." });
}

function repli(contexte: Parameters<typeof planDeRepli>[0], remarque: Remarque): ResultatGenerateurPlan {
  const r = validerPlan(planDeRepli(contexte), contexte);
  return { plan: r.plan, remarques: [remarque, ...r.remarques], source: "repli" };
}

/** Fournisseur réel (serveur seulement, clé du studio) : à n'appeler qu'après le pré-vol des crédits. */
export function appelClaudeReel(cle: string): AppelClaude {
  return async (r) => {
    const { envoyerMessage } = await import("@/fournisseurs/claude/client");
    return envoyerMessage(r, { cle });
  };
}
