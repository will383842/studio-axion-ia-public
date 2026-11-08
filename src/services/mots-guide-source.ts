/**
 * Source OFFICIELLE des textes du mot GUIDE, construite côté SERVEUR (le client n'envoie jamais de texte) :
 *  1. `mots/GUIDE.md` s'il existe ;
 *  2. sinon le dictionnaire mp-* v2 : réponse publique (mp-pub-igfb-v1), message privé M1 (mp-m1-v2), fin (mp-recu-v2) ;
 *     le dictionnaire ne prévoit pas de relance (facultative : aucune). Le titre du guide vient de PARCOURS_CONVERSATION_TITRE_GUIDE ;
 *     absent, rien n'est construit (jamais de texte à trous).
 * Aucun texte n'est écrit ici : tout vient du fichier ou du dictionnaire.
 */
import "server-only";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import type { SaisieMot } from "./mots-textes";
import { chargerTextesFichier } from "./mots-service";

type Env = Record<string, string | undefined>;
export type SourceGuide = { ok: true; saisie: SaisieMot } | { ok: false; raison: string };

export function saisieGuideDepuisDictionnaire(env: Env): SourceGuide {
  const titre = env.PARCOURS_CONVERSATION_TITRE_GUIDE?.trim();
  if (!titre) return { ok: false, raison: "titre_guide_absent" };
  const reponsePublique = rendreTexteMp("mp-pub-igfb-v1", {});
  const messagePrive = rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre });
  const fin = rendreTexteMp("mp-recu-v2", { titre });
  if (!reponsePublique || !messagePrive || !fin) return { ok: false, raison: "texte_dictionnaire_incomplet" };
  return { ok: true, saisie: { mot: "GUIDE", reponsePublique, messagePrive, relance: null, fin } };
}

export async function saisieGuideOfficielle(env: Env = process.env): Promise<SourceGuide> {
  const lu = await chargerTextesFichier("GUIDE");
  if (lu === null) return saisieGuideDepuisDictionnaire(env);
  if (!lu.ok) return { ok: false, raison: lu.raison };
  const t = lu.textes;
  return { ok: true, saisie: { mot: t.mot, reponsePublique: t.reponsePublique, messagePrive: t.messagePrive, relance: t.relance, fin: t.fin } };
}

/** Comptes du parcours (identifiants seulement, jamais un secret). */
export const comptesParcours = (env: Env = process.env): string[] => (env.PARCOURS_CONVERSATION_COMPTES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
