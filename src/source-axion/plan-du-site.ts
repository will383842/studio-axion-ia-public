/**
 * SOURCE AXION-IA.COM — plan du site (PUR) : index des sous-plans, puis les pages (adresse, date, titre d'actualité).
 * Lecture par expressions simples : le plan du site est un XML régulier, produit par le site lui-même.
 */

export interface EntreePlan {
  url: string;
  /** `lastmod`, ou date de publication d'une actualité. */
  date?: string;
  titre?: string;
}

function decoder(t: string): string {
  return t
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&apos;|&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function valeur(bloc: string, balise: string): string | undefined {
  const m = new RegExp(`<${balise}>([\\s\\S]*?)</${balise}>`).exec(bloc);
  return m ? decoder(m[1]) : undefined;
}

/** Sous-plans d'un index (`<sitemapindex>`). */
export function lireIndexPlan(xml: string): string[] {
  return [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)].map((m) => valeur(m[1], "loc")).filter((x): x is string => !!x);
}

/** Pages d'un sous-plan (`<urlset>`), avec leur date et, pour une actualité, leur titre. */
export function lirePlan(xml: string): EntreePlan[] {
  const sortie: EntreePlan[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const url = valeur(m[1], "loc");
    if (!url) continue;
    const date = valeur(m[1], "news:publication_date") ?? valeur(m[1], "lastmod");
    const titre = valeur(m[1], "news:title");
    sortie.push({ url, ...(date ? { date } : {}), ...(titre ? { titre } : {}) });
  }
  return sortie;
}
