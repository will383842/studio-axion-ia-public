/**
 * SOURCE AXION-IA.COM — adresses du site (PUR, une règle = un test).
 * - Seul axion-ia.com est lu (ou photographié) : toute autre adresse est refusée.
 * - Une adresse est rangée sous une forme unique (https, sans « www », sans paramètres ni ancre, sans « / » final) :
 *   jamais deux fois la même page.
 * - La rubrique dit ce qu'on en tire (matières, captures) ; les pages « autre » (mentions légales, villes…) sont ignorées.
 */
import { createHash } from "node:crypto";
import type { RubriqueSite } from "@/domaine/types";

export const SITE = "https://axion-ia.com";
const HOTES = new Set(["axion-ia.com", "www.axion-ia.com"]);

/** Plan du site lu chaque jour (sa liste de sous-plans), et ceux que l'on garde. */
export const INDEX_PLAN = `${SITE}/sitemap-index.xml`;
export const SOUS_PLANS_SUIVIS = /\/(sitemap\/(pages|formations|faq)|sitemap-news|sitemap-blog)\.xml$/;

/**
 * Forme unique d'une adresse du site, ou `null` si ce n'est pas une page de axion-ia.com. Accepte « /fr/faq »,
 * « axion-ia.com/fr/faq », « https://www.axion-ia.com/fr/faq/?x=1#y ».
 */
export function normaliserAdresse(brute: string): string | null {
  const t = brute.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t.startsWith("/") ? `${SITE}${t}` : /^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOTES.has(u.hostname.toLowerCase()) || u.port || u.username || u.password) return null;
  const chemin = u.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return `${SITE}${chemin}`;
}

/** Adresse de la page du site ? (forme déjà unique) */
export function estAdresseDuSite(adresse: string): boolean {
  return normaliserAdresse(adresse) === adresse;
}

/** Identifiant stable d'une page, tiré de son adresse. */
export function idPage(url: string): string {
  return `site-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

const OFFRES = /^\/fr\/(audit|interventions|implementation|sites-web-augmentes|tarifs|un-a-un|visibilite-entreprise|demande-devis|roi|methodologie|financement-opco-france-travail|certification-certifexemple)(\/|$)/;

/** Rubrique d'une page (d'après son chemin). */
export function rubriqueDe(url: string): RubriqueSite {
  const chemin = (normaliserAdresse(url) ?? url).replace(SITE, "") || "/";
  if (chemin === "/" || chemin === "/fr") return "accueil";
  if (/^\/fr\/actualites\/[^/]+/.test(chemin)) return "actualite";
  if (/^\/fr\/blog\/(?!categorie(\/|$))[^/]+/.test(chemin)) return "article";
  if (/^\/fr\/faq(\/|$)/.test(chemin)) return "faq";
  if (/^\/fr\/formations(\/|$)/.test(chemin)) return "formation";
  if (OFFRES.test(chemin)) return "offre";
  if (/^\/fr\/(a-propos|equipe\/[^/]+)$/.test(chemin)) return "a-propos";
  return "autre";
}

/** Pages clés suivies au départ (relues chaque jour, photographiées). Will en ajoute ou en retire. */
export const PAGES_DEPART: readonly { url: string; nom: string }[] = [
  { url: `${SITE}/fr`, nom: "Accueil" },
  { url: `${SITE}/fr/formations`, nom: "Formations" },
  { url: `${SITE}/fr/audit`, nom: "Audit" },
  { url: `${SITE}/fr/implementation`, nom: "Implémentation" },
  { url: `${SITE}/fr/tarifs`, nom: "Tarifs" },
  { url: `${SITE}/fr/faq`, nom: "Questions fréquentes" },
  { url: `${SITE}/fr/a-propos`, nom: "À propos" },
];

/** Nom court d'une page pour l'écran : son titre, sinon la fin de son adresse. */
export function nomCourt(p: { url: string; titre?: string }): string {
  const depart = PAGES_DEPART.find((x) => x.url === p.url);
  if (depart) return depart.nom;
  const titre = p.titre?.replace(/\s*[·|–-]\s*Axion-IA\s*$/i, "").trim();
  if (titre) return titre.length > 60 ? `${titre.slice(0, 59)}…` : titre;
  const fin = p.url.replace(SITE, "").split("/").filter(Boolean).pop() ?? "accueil";
  return fin.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
