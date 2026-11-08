/**
 * LISTE FERMÉE DES OPÉRATIONS DU CHAT DE RETOUCHE (lot R1) — schémas Zod STRICTS des opérations de
 * `briques/operations.ts`. Tout ce que renvoie le LLM (ou le navigateur) est relu ici : un type inconnu, un champ en trop
 * (« code », « script »…) ou une valeur hors bornes écarte l'opération, avec une remarque. Aucun code libre n'est
 * jamais exécuté : il n'existe aucune opération qui en porte.
 */
import { z } from "zod";
import type { OperationRetouche } from "@/briques/operations";
import { IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import { POSITIONS, TRANSITIONS, TRANSITION_MAX_MS, TRANSITION_MIN_MS } from "@/briques/plan-scenes/zones";

const id = z.string().min(1).max(40);
const piece = z.enum(IDS_PIECES);
const position = z.enum(POSITIONS);
const transition = z.enum(TRANSITIONS);
const texte = z.string().trim().min(1).max(120);
const parametres = z.record(z.string(), z.unknown()).optional();
const point = z.strictObject({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

export const schemaOperation = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("changer-mot"), sceneId: id, ancien: texte, nouveau: z.string().trim().max(120), champ: z.string().max(80).optional() }),
  z.strictObject({ type: z.literal("ajouter-chiffre"), sceneId: id, valeur: z.number().finite(), libelle: z.string().trim().min(1).max(40), prefixe: z.string().max(4).optional(), suffixe: z.string().max(6).optional(), zone: position.optional() }),
  z.strictObject({ type: z.literal("changer-brique"), sceneId: id, piece, parametres }),
  z.strictObject({ type: z.literal("decaler-scene"), sceneId: id, mots: z.strictObject({ premier: z.number().int().min(0), dernier: z.number().int().min(0) }).optional(), decalageMs: z.number().finite().optional() }),
  z.strictObject({
    type: z.literal("changer-habillage"),
    habillage: z.strictObject({ fond: z.enum(["ivoire", "noir"]).optional(), accent: z.enum(["terracotta", "orange"]).optional() }).optional(),
    transition: z.strictObject({ sceneId: id, entree: transition.optional(), sortie: transition.optional(), dureeMs: z.number().min(TRANSITION_MIN_MS).max(TRANSITION_MAX_MS).optional() }).optional(),
    position: z.strictObject({ sceneId: id, position }).optional(),
  }),
  z.strictObject({ type: z.literal("ajouter-piece"), sceneId: id, piece, parametres, zone: position.optional(), debutMs: z.number().min(0).optional() }),
  z.strictObject({ type: z.literal("retirer-piece"), sceneId: id, piece }),
  z.strictObject({ type: z.literal("remplacer-piece"), sceneId: id, ancienne: piece, nouvelle: piece, parametres }),
  z.strictObject({ type: z.literal("changer-transition"), sceneId: id.optional(), entree: transition.optional(), sortie: transition.optional(), dureeMs: z.number().min(TRANSITION_MIN_MS).max(TRANSITION_MAX_MS).optional() }),
  z.strictObject({ type: z.literal("ajouter-dynamisme"), sceneIds: z.array(id).max(40).optional(), intensite: z.enum(["leger", "fort"]) }),
  z.strictObject({ type: z.literal("ajuster-zoom"), sceneId: id, facteur: z.number().min(1).max(2.5).optional(), cible: point.optional(), moment: z.number().min(0).max(0.8).optional() }),
  z.strictObject({ type: z.literal("modifier-script"), ancien: texte, nouveau: z.string().trim().max(120) }),
]);

/** Au plus 20 opérations par demande. */
export const MAX_OPERATIONS = 20;

/** Relit une liste d'opérations : chaque opération invalide est écartée avec une remarque (jamais d'exception). */
export function lireOperations(brut: unknown): { operations: OperationRetouche[]; remarques: string[] } {
  if (!Array.isArray(brut)) return { operations: [], remarques: ["Aucune opération lisible."] };
  const operations: OperationRetouche[] = [];
  const remarques: string[] = [];
  brut.slice(0, MAX_OPERATIONS).forEach((o, i) => {
    const r = schemaOperation.safeParse(o);
    if (r.success) operations.push(r.data as OperationRetouche);
    else {
      const type = o && typeof o === "object" && typeof (o as { type?: unknown }).type === "string" ? (o as { type: string }).type : "inconnue";
      remarques.push(`Opération ${i + 1} (« ${type.slice(0, 30)} ») écartée : hors de la liste des retouches possibles.`);
    }
  });
  if (brut.length > MAX_OPERATIONS) remarques.push(`Au plus ${MAX_OPERATIONS} retouches à la fois : les suivantes sont écartées.`);
  return { operations, remarques };
}
