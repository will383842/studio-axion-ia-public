/**
 * ANONYMISATION avant tout envoi à Claude et tout texte public (plan v5 B.3.10, C59). PUR.
 *
 * 1. Les `nomsSensibles` des matières et des preuves sont remplacés par une forme neutre (« un dirigeant »,
 *    « une PME de [secteur si autorisé] »).
 * 2. Les mots à majuscule hors lexique (hors début de phrase, sigles et noms d'outils connus) ne sont PAS devinés :
 *    ils sont PROPOSÉS à Will (« douteux »). Le texte d'origine reste en base.
 */
import { echapper } from "./texte";

export interface ResultatAnonymisation {
  texte: string;
  remplacements: { nom: string; par: string }[];
  /** Noms propres possibles, à faire confirmer par Will (jamais remplacés d'office). */
  douteux: string[];
}

export function anonymiser(
  texte: string,
  options: { nomsSensibles: string[]; formes?: Record<string, string>; formeParDefaut?: string; lexique?: string[] } = { nomsSensibles: [] },
): ResultatAnonymisation {
  let t = texte;
  const remplacements: ResultatAnonymisation["remplacements"] = [];
  const noms = [...new Set(options.nomsSensibles.filter((n) => n.trim()))].sort((a, b) => b.length - a.length);
  for (const nom of noms) {
    const par = options.formes?.[nom] ?? options.formeParDefaut ?? "un client";
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${echapper(nom)}(?![\\p{L}\\p{N}])`, "giu");
    if (re.test(t)) {
      t = t.replace(re, par);
      remplacements.push({ nom, par });
    }
  }
  const lexique = new Set((options.lexique ?? []).map((x) => x.toLowerCase()));
  const douteux = new Set<string>();
  for (const phrase of t.split(/(?<=[.!?…:])\s+/)) {
    const ms = phrase.split(/\s+/);
    ms.forEach((m, i) => {
      const propre = m.replace(/^[«"“(]+|[»"”),.;:!?…]+$/g, "");
      if (i === 0 || !/^[A-ZÀ-Ý][a-zà-ÿ]+(?:-[A-ZÀ-Ý]?[a-zà-ÿ]+)*$/.test(propre)) return;
      if (lexique.has(propre.toLowerCase())) return;
      douteux.add(propre);
    });
  }
  return { texte: t, remplacements, douteux: [...douteux] };
}
