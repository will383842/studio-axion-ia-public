/**
 * COMPRENDRE (lot R1) — la phrase de Williams + le plan de scènes courant → opérations typées (`briques/operations.ts`).
 * Port LLM INJECTÉ (`AppelClaude`) : Opus 5.5 en production (branché plus tard par `executerRole`, comme le générateur
 * du plan), un double dans tous les tests. Sortie JSON relue par Zod (`lireOperations`) ; jamais de code libre.
 * Le texte lu est celui de Williams : une opération `modifier-script` n'est gardée que si la phrase le demande
 * explicitement. Jamais d'exception : LLM en panne ou illisible → lecture simple de la phrase, avec une remarque.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { POSITIONS, TRANSITIONS } from "@/briques/plan-scenes/zones";
import { extraireJson, type RequeteClaude } from "@/fournisseurs/claude/client";
import { lireOperations } from "./schema";

export const MODELE_RETOUCHE_CHAT = "claude-opus-5-5";
export const MAX_JETONS_RETOUCHE_CHAT = 4000;

export interface ResultatComprendre {
  operations: OperationRetouche[];
  remarques: string[];
  /** `llm` : lu par le LLM ; `simple` : LLM indisponible ou illisible, lecture par mots-clés. */
  source: "llm" | "simple";
}

/** Williams demande-t-il EXPLICITEMENT de modifier le texte lu ? */
export function demandeExpliciteScript(phrase: string): boolean {
  return /\b(script|texte lu|voix off|ce que je dis|ce que (je|j') ?lis|dans la voix|la phrase dite)\b/i.test(phrase);
}

export function consigneRetouche(): string {
  const pieces = Object.values(CATALOGUE_BRIQUES)
    .map((d) => `- ${d.id} (${d.nom}) : ${d.description}`)
    .join("\n");
  return [
    "Vous traduisez une demande de retouche de Williams, à propos d'une vidéo Axion IA déjà livrée, en OPÉRATIONS sur son plan de scènes.",
    "Ne refaites pas la vidéo : touchez le moins de scènes possible. Le texte lu (script) ne change JAMAIS, sauf si Williams demande explicitement de modifier le script (opération modifier-script).",
    "Opérations possibles (JSON, champs exacts, aucun autre champ, jamais de code) :",
    '- { "type": "changer-mot", "sceneId", "ancien", "nouveau", "champ"? } : texte À L\'ÉCRAN seulement ;',
    '- { "type": "ajouter-chiffre", "sceneId", "valeur", "libelle", "prefixe"?, "suffixe"?, "zone"? } ;',
    '- { "type": "changer-brique", "sceneId", "piece", "parametres"? } ;',
    '- { "type": "decaler-scene", "sceneId", "mots"?: { "premier", "dernier" }, "decalageMs"? } ;',
    '- { "type": "changer-habillage", "habillage"?: { "fond"?, "accent"? }, "position"?: { "sceneId", "position" } } ;',
    '- { "type": "ajouter-piece", "sceneId", "piece", "parametres"?, "zone"?, "debutMs"? } (« rajoute du motion design ») ;',
    '- { "type": "retirer-piece", "sceneId", "piece" } ; { "type": "remplacer-piece", "sceneId", "ancienne", "nouvelle", "parametres"? } ;',
    '- { "type": "changer-transition", "sceneId"?, "entree"?, "sortie"?, "dureeMs"? } (sans sceneId : toutes les scènes) ;',
    '- { "type": "ajouter-dynamisme", "sceneIds"?, "intensite": "leger"|"fort" } (zooms et accents sur des scènes existantes) ;',
    '- { "type": "ajuster-zoom", "sceneId", "facteur"? (1 à 2,5), "cible"?: { "x", "y" }, "moment"? (0 à 0,8) } (« zoom plus doux » : facteur plus petit) ;',
    '- { "type": "modifier-script", "ancien", "nouveau" } : SEULEMENT sur demande explicite de modifier le script.',
    `Positions : ${POSITIONS.join(", ")}. Transitions : ${TRANSITIONS.join(", ")} (200 à 800 ms).`,
    "Pièces :",
    pieces,
    'Répondez par UN objet JSON seul : { "operations": [ … ] }. Demande impossible ou floue : { "operations": [] }.',
  ].join("\n");
}

/** Résumé du plan pour le LLM : identifiants, mots lus, texte à l'écran, pièces. */
export function resumePlan(plan: PlanValide): string {
  return plan.scenes
    .map((s) => {
      const lus = plan.mots.slice(s.mots.premier, s.mots.dernier + 1).map((m) => m.texte).join(" ");
      const calques = s.calques?.length ? ` · calques : ${s.calques.map((c) => c.piece).join(", ")}` : "";
      return `${s.id} · niveau ${s.niveau} · pièce ${s.piece} · paramètres ${JSON.stringify(s.parametres)}${calques}${s.texte ? ` · écran « ${s.texte} »` : ""} · lu « ${lus} »`;
    })
    .join("\n");
}

export function construireRequeteRetouche(phrase: string, plan: PlanValide): RequeteClaude {
  const demande = [`Habillage : fond ${plan.habillage.fond}, accent ${plan.habillage.accent}. Face caméra : ${plan.facecam ? "oui" : "non"}.`, "Scènes :", resumePlan(plan), "", `Demande de Williams : ${phrase}`].join("\n");
  return { modele: MODELE_RETOUCHE_CHAT, maxTokens: MAX_JETONS_RETOUCHE_CHAT, effort: "high", systeme: [{ texte: consigneRetouche(), cache: "1h" }], messages: [{ role: "user", contenu: demande }], json: true };
}

/** Lecture simple (sans LLM) des demandes les plus courantes. */
export function lectureSimple(phrase: string): OperationRetouche[] {
  const p = phrase.toLowerCase();
  if (/dynami|motion|plus vivant|rythme|punch/.test(p)) return [{ type: "ajouter-dynamisme", intensite: /beaucoup|fort|très|tres/.test(p) ? "fort" : "leger" }];
  return [];
}

function filtrerScript(operations: OperationRetouche[], phrase: string, remarques: string[]): OperationRetouche[] {
  if (demandeExpliciteScript(phrase)) return operations;
  const gardees = operations.filter((o) => o.type !== "modifier-script");
  if (gardees.length !== operations.length) remarques.push("Le texte lu reste le vôtre : pour le changer, demandez « modifie le script ».");
  return gardees;
}

export async function comprendreDemande(e: { phrase: string; plan: PlanValide }, appeler: AppelClaude): Promise<ResultatComprendre> {
  const phrase = e.phrase.trim();
  const remarques: string[] = [];
  if (!phrase) return { operations: [], remarques: ["Écrivez ce que vous voulez changer."], source: "simple" };
  try {
    const r = await appeler(construireRequeteRetouche(phrase, e.plan));
    const valeur: unknown = JSON.parse(extraireJson(r.texte));
    const brut = valeur && typeof valeur === "object" ? (valeur as { operations?: unknown }).operations : undefined;
    if (!Array.isArray(brut)) throw new Error("sans opérations");
    const lu = lireOperations(brut);
    remarques.push(...lu.remarques);
    const operations = filtrerScript(lu.operations, phrase, remarques);
    if (!operations.length && !remarques.length) remarques.push("Je n'ai trouvé aucune retouche dans cette demande : précisez la scène ou l'élément à changer.");
    return { operations, remarques, source: "llm" };
  } catch {
    const operations = lectureSimple(phrase);
    remarques.push(operations.length ? "Lecture simple de votre demande (l'IA n'a pas répondu)." : "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène.");
    return { operations, remarques, source: "simple" };
  }
}
