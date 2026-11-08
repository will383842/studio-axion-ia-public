/**
 * Empreinte des 4 textes RÉELLEMENT envoyés par le parcours du mot GUIDE (réponse publique, M1, M2, reçu). Module PUR : il
 * n'importe que le dictionnaire et node:crypto (jamais mots-service : boucle d'imports). Les rendus sont identiques, appel
 * pour appel, à ceux de `parcours-conversation` ; la validation de l'opérateur et la garde du parcours calculent la même chose.
 */
import { createHash } from "node:crypto";
import { rendreTexteMp, TEXTES_MP, type IdTexteMp } from "./textes-mp";

type Env = Record<string, string | undefined>;
export interface TextesGuideEnvoyes {
  pub: string;
  m1: string;
  m2: string;
  recu: string;
}
export type ResultatTextesGuide = { ok: true; textes: TextesGuideEnvoyes } | { ok: false; raison: "titre_guide_absent" | "texte_dictionnaire_incomplet" };

const IDS: readonly IdTexteMp[] = ["mp-pub-igfb-v1", "mp-m1-v2", "mp-m2-v1", "mp-recu-v2"];

/** Titre du guide tel que le parcours le calcule. */
export const titreGuideParcours = (env: Env): string => (env.PARCOURS_CONVERSATION_TITRE_GUIDE ?? "").trim();

/** Comptes du parcours (identifiants seulement, jamais un secret). */
export const comptesParcours = (env: Env = process.env): string[] => (env.PARCOURS_CONVERSATION_COMPTES ?? "").split(",").map((c) => c.trim()).filter(Boolean);

export function textesGuideEnvoyes(titre: string): ResultatTextesGuide {
  const t = (titre ?? "").trim();
  if (!t) return { ok: false, raison: "titre_guide_absent" };
  const pub = rendreTexteMp("mp-pub-igfb-v1", {});
  const m1 = rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: t });
  const m2 = rendreTexteMp("mp-m2-v1", {});
  const recu = rendreTexteMp("mp-recu-v2", { titre: t });
  if (pub === null || m1 === null || m2 === null || recu === null) return { ok: false, raison: "texte_dictionnaire_incomplet" };
  return { ok: true, textes: { pub, m1, m2, recu } };
}

export function empreinteGuideParcours(titre: string): { ok: true; empreinte: string } | { ok: false; raison: "titre_guide_absent" | "texte_dictionnaire_incomplet" } {
  const r = textesGuideEnvoyes(titre);
  if (!r.ok) return r;
  const rendus = [r.textes.pub, r.textes.m1, r.textes.m2, r.textes.recu];
  const lignes = IDS.map((id, n) => [id, TEXTES_MP[id].version, rendus[n]]);
  return { ok: true, empreinte: createHash("sha256").update(JSON.stringify(["guide-parcours-v1", lignes])).digest("hex") };
}
