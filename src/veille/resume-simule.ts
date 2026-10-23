/**
 * Résumé SIMULÉ d'une nouveauté (règles fixes, tant que Claude n'est pas relié) — même forme que
 * `FournisseurScript.resumerNouveaute`. Règles :
 * - licence, prix, fonction retirée ou arrêtée → ROUGE, avec le risque en clair ;
 * - intérêt « fort » : la nouveauté touche ce qui se voit ou s'entend dans nos vidéos (voix, lèvres, images, clips,
 *   sous-titres, français) ; « moyen » : nouvelle version majeure ou mineure ; « faible » : simple correctif.
 * Textes : français simple, vouvoiement, 2-3 lignes, sans jargon.
 */
import type { VeilleNouveaute } from "@/domaine/types";
import { ecartVersions } from "./versions";

export interface DemandeResume {
  outil: string;
  role: string;
  versionUtilisee?: string;
  versionVue: string;
  notes: string;
}

/** `simule` (CORRECTEUR 1 — B7) : résumé fait par les règles fixes, pas par Claude. */
export type ResumeNouveaute = VeilleNouveaute["resume"] & { rouge: boolean; simule?: boolean };

const RISQUES: { motif: RegExp; risque: string }[] = [
  { motif: /LICENSE\.md|\blicen[cs]e (?:change|changes|changed|update|updated|terms)\b|\bnew licen[cs]e\b|\brelicens\w*|\bla licence change\b/i, risque: "La licence change : à relire avant toute mise à jour." },
  { motif: /\b(pricing|price|prices|prix|tarif|billing|credits? cost)\b/i, risque: "Le prix peut changer." },
  { motif: /\b(deprecat\w*|sunset|end[- ]of[- ]life|discontinu\w*|no longer (?:supported|available)|breaking changes?)\b/i, risque: "Une fonction pourrait disparaître." },
];

const THEMES: { motif: RegExp; phrase: string }[] = [
  { motif: /\b(voice|voices|voix|speech|tts|text[- ]to[- ]speech|clone)\b/i, phrase: "Peut améliorer la voix de vos vidéos." },
  { motif: /\b(lip[- ]?sync|lèvres|lipsync)\b/i, phrase: "Peut rendre le mouvement des lèvres plus naturel." },
  { motif: /\b(text[- ]to[- ]image|image[- ]to[- ]video|image generation|video generation|clip)\b/i, phrase: "De nouveaux modèles pour vos illustrations et vos clips." },
  { motif: /\b(subtitles?|captions?|sous-titres?|transcri\w*|alignment)\b/i, phrase: "Peut rendre les sous-titres plus précis." },
  { motif: /\b(french|français|multilingual)\b/i, phrase: "Concerne aussi le français." },
];

export function resumerNouveauteSimule(d: DemandeResume): ResumeNouveaute {
  const risques = RISQUES.filter((r) => r.motif.test(d.notes)).map((r) => r.risque);
  const themes = THEMES.filter((t) => t.motif.test(d.notes)).map((t) => t.phrase);
  const ecart = ecartVersions(d.versionUtilisee, d.versionVue);

  const lignes: string[] = [];
  if (d.versionUtilisee && ecart !== "inconnu" && ecart !== "aucun") lignes.push(`Une nouvelle version existe (${d.versionVue}) ; le studio garde la sienne (${d.versionUtilisee}) tant que vous ne décidez rien.`);
  else lignes.push(`Nouveauté chez ${d.outil} (${d.versionVue}).`);
  if (themes.length) lignes.push(...themes.slice(0, 2));
  else lignes.push(ecart === "correctif" ? "Corrections, rien de visible attendu sur vos vidéos." : "Rien de visible attendu sur vos vidéos tant que ce n'est pas essayé à part.");

  const rouge = risques.length > 0;
  const interet: ResumeNouveaute["interet"] = themes.length && ecart !== "correctif" ? "fort" : ecart === "majeur" || ecart === "mineur" || themes.length ? "moyen" : "faible";
  return { ceQueCaChange: lignes.join(" "), interet, ...(rouge ? { risque: risques.join(" ") } : {}), rouge };
}
