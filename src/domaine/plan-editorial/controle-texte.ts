/**
 * Contrôle d'un texte saisi (CAL-27). Fonctions pures, sans dépendance serveur : utilisables par un composant client.
 * `services/texte-post.ts` les ré-exporte.
 */
import type { IdReseau } from "@/domaine/types";
import { evaluerPublicationVisuel, type SortiePublicationVisuel } from "@/generateur/roles/publication-visuel";

/** La seule source des faits d'un contenu importé : la phrase du fondateur, puis le texte des pages s'il existe. */
export function sourceDuTexteImporte(description?: string, texteDesPages?: string): { source: string; titre: string } {
  const phrase = description?.trim() ?? "";
  const pages = texteDesPages?.trim() ?? "";
  return { source: [phrase, pages].filter(Boolean).join("\n"), titre: (phrase || pages.split("\n")[0] || "").trim() };
}

export interface TexteSaisi {
  reseau: IdReseau;
  texte: string;
  /** Mots-dièse et titre de la proposition ; absents (texte écrit à la main sans proposition), leurs contrôles ne s'appliquent pas. */
  motsDiese?: string[];
  titreDocument?: string;
  description?: string;
  texteDesPages?: string;
}

/** Contrôle d'un texte tel qu'il est AU MOMENT PRÉSENT (après chaque modification), avec les mêmes contrôles que la proposition. */
export function controlerTexteSaisi(t: TexteSaisi): string[] {
  const { source, titre } = sourceDuTexteImporte(t.description, t.texteDesPages);
  const sortie: SortiePublicationVisuel = { texte: t.texte, motsDiese: t.motsDiese ?? [], ...(t.titreDocument ? { titreDocument: t.titreDocument } : {}) };
  const echecs = evaluerPublicationVisuel(sortie, { reseau: t.reseau, titre, texteDesPages: source });
  return t.motsDiese ? echecs : echecs.filter((e) => !/^PV-0[25] /.test(e));
}
