/**
 * LECTURE PAR RÈGLES (D4-F1) — les phrases courantes de Williams → opérations typées, SANS Claude, sans réseau, sans argent.
 * Pur. Même idée que `traduireDemandeTableau`. Insensible à la casse et aux accents. Chaque résultat repasse par
 * `lireOperations` : ce qui ne passe pas le schéma est jeté. Phrase non comprise → `[]`.
 * Jamais `modifier-script` : « remplace X par Y » vise le mot AFFICHÉ (`changer-mot`), jamais le texte lu (R-6).
 * Éteint par défaut : le branchement du réglage `retoucheChat.lectureRegles` est fait ailleurs (N-26).
 */
import type { OperationRetouche } from "@/briques/operations";
import type { IdPiece } from "@/briques/plan-scenes/catalogue";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { TRANSITIONS } from "@/briques/plan-scenes/zones";
import { lireOperations } from "./schema";

export const CLE_REGLAGE_LECTURE_REGLES = "retoucheChat.lectureRegles";

type Scene = PlanValide["scenes"][number];

/** Minuscules sans accents, longueur identique à l'original (pour recouper les valeurs dans la phrase d'origine). */
function normaliser(s: string): string {
  return Array.from(s.replace(/[’‘]/g, "'"))
    .map((c) => (c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() || c)[0])
    .join("");
}

const NOMS_PIECES: [RegExp, IdPiece][] = [
  [/\bcartes?\b|\bkpi\b/, "carte-kpi"],
  [/\bcurseur\b/, "curseur"],
  [/\bzoom\b/, "zoom-camera"],
  [/\bgraphiques?\b|\bcourbe\b/, "graphique"],
  [/\btableau de bord\b/, "tableau-de-bord"],
  [/\bcrm\b/, "liste-crm"],
  [/\bfenetre\b/, "fenetre-app"],
  [/\bbulle\b/, "bulle-chat"],
  [/\blegende\b/, "legende"],
  [/\bcompteur\b/, "compteur"],
  [/\bjauge\b/, "jauge"],
  [/\bcitation\b/, "citation"],
  [/\brepere\b/, "repere"],
  [/\bbarres\b/, "barres"],
  [/\betapes\b/, "etapes"],
];

function sceneNumero(p: string, plan: PlanValide): { vue: boolean; scene?: Scene } {
  const n = /\bscene\s*(?:n°|no|numero)?\s*(\d+)/.exec(p);
  if (n) return { vue: true, scene: plan.scenes[Number(n[1]) - 1] };
  const t = /\b(\d{1,2}):(\d{2})\b/.exec(p) ?? /\b(\d+)\s*()(?:s|sec|secondes?)\b/.exec(p);
  if (t) {
    const ms = (Number(t[1]) * 60 + (t[2] ? Number(t[2]) : 0)) * (t[2] === "" ? 1000 / 60 : 1000);
    return { vue: true, scene: plan.scenes.find((s) => s.debutMs <= ms && ms < s.finMs) };
  }
  return { vue: false };
}

function sansGuillemets(s: string): string {
  return s.trim().replace(/^[«"“'\s]+|[»"”'\s.!?]+$/g, "").replace(/^(?:le |du )?mot\s+/i, "").replace(/^[«"“\s]+|[»"”\s]+$/g, "").trim();
}

function changerMot(phrase: string, p: string, plan: PlanValide): OperationRetouche[] {
  const m = /\b(?:remplace|remplacer|corrige|corriger)\s+(.+?)\s+(?:par|en)\s+(.+?)(?:\s+(?:a|sur|dans)\s+l'ecran)?(?:\s+(?:de|dans|sur)\s+la\s+scene\s*\d+)?\s*[.!]?\s*$/.exec(p);
  if (!m) return [];
  const [ancien, nouveau] = [sansGuillemets(phrase.slice(m.index + m[0].indexOf(m[1]), m.index + m[0].indexOf(m[1]) + m[1].length)), sansGuillemets(phrase.slice(m.index + m[0].lastIndexOf(m[2]), m.index + m[0].lastIndexOf(m[2]) + m[2].length))];
  if (!ancien || !nouveau) return [];
  const a = normaliser(ancien);
  const voulue = sceneNumero(p, plan);
  const candidates = voulue.vue ? (voulue.scene ? [voulue.scene] : []) : plan.scenes;
  const scene = candidates.find((s) => normaliser(s.texte ?? "").includes(a)) ?? candidates.find((s) => normaliser(JSON.stringify(s.parametres ?? {})).includes(a));
  return scene ? [{ type: "changer-mot", sceneId: scene.id, ancien, nouveau }] : [];
}

function retirerPiece(p: string, plan: PlanValide): OperationRetouche[] {
  if (!/\b(enleve|enlever|retire|retirer|supprime|supprimer|vire)\b/.test(p) || !/\b(piece|carte|curseur|zoom|graphique|courbe|bulle|legende|compteur|jauge|citation|repere|barres|etapes|fenetre|tableau de bord|crm|kpi)\b/.test(p)) return [];
  const voulue = sceneNumero(p, plan);
  if (voulue.vue && !voulue.scene) return [];
  const nommee = NOMS_PIECES.find(([re]) => re.test(p))?.[1];
  const scene = voulue.scene ?? plan.scenes.find((s) => s.calques?.length);
  if (!scene) return [];
  const piece = nommee ?? scene.calques?.[scene.calques.length - 1]?.piece;
  return piece ? [{ type: "retirer-piece", sceneId: scene.id, piece }] : [];
}

function ajusterZoom(p: string, plan: PlanValide): OperationRetouche[] {
  if (!/\bzoom\b/.test(p) || /\btransition\b/.test(p) || /\b(enleve|enlever|retire|retirer|supprime|supprimer)\b/.test(p)) return [];
  const voulue = sceneNumero(p, plan);
  if (voulue.vue && !voulue.scene) return [];
  const scene = voulue.scene ?? plan.scenes.find((s) => s.piece === "zoom-camera" || s.calques?.some((c) => c.piece === "zoom-camera"));
  if (!scene) return [];
  return [{ type: "ajuster-zoom", sceneId: scene.id, facteur: /\b(doux|douce|moins|leger|discret)\b/.test(p) ? 1.15 : 1.5 }];
}

function habillage(p: string): OperationRetouche[] {
  if (/\bfond\s+(noir|sombre)\b/.test(p)) return [{ type: "changer-habillage", habillage: { fond: "noir" } }];
  if (/\bfond\s+(clair|ivoire|blanc)\b/.test(p)) return [{ type: "changer-habillage", habillage: { fond: "ivoire" } }];
  return [];
}

function dynamisme(p: string): OperationRetouche[] {
  if (!/dynami|motion|plus vivant|rythme|punch/.test(p)) return [];
  return [{ type: "ajouter-dynamisme", intensite: /beaucoup|fort|tres/.test(p) ? "fort" : "leger" }];
}

function transition(p: string, plan: PlanValide): OperationRetouche[] {
  if (!/\btransitions?\b/.test(p)) return [];
  const valeur = TRANSITIONS.find((t) => p.replace(/[-_]/g, " ").includes(t.replace(/-/g, " ")));
  if (!valeur) return [];
  const voulue = sceneNumero(p, plan);
  if (voulue.vue && !voulue.scene) return [];
  return [{ type: "changer-transition", ...(voulue.scene ? { sceneId: voulue.scene.id } : {}), entree: valeur, sortie: valeur }];
}

export function lireParRegles(phrase: string, plan: PlanValide): OperationRetouche[] {
  const texte = (phrase ?? "").trim();
  if (!texte) return [];
  const p = normaliser(texte);
  // Demande de modifier le texte lu : hors lecture par règles (voix payante), on ne devine pas.
  if (/\b(script|texte lu|voix off|ce que je dis)\b/.test(p)) return [];
  const brut = [...changerMot(texte, p, plan), ...retirerPiece(p, plan), ...ajusterZoom(p, plan), ...habillage(p), ...transition(p, plan), ...dynamisme(p)];
  return lireOperations(brut).operations.filter((o) => o.type !== "modifier-script");
}
