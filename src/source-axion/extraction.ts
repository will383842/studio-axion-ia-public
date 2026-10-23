/**
 * SOURCE AXION-IA.COM — ce qu'on tire d'une page du site (PUR, testé sur des pages enregistrées).
 * - Le texte n'est JAMAIS réécrit : chaque morceau est un paragraphe du site, ou ses premières phrases entières,
 *   ou une question de la foire aux questions de la page, mot pour mot.
 * - Titre, description et mots-clés servent aux captures (cascade des illustrations).
 * - L'empreinte du contenu utile ignore ce qui bouge à chaque affichage (scripts, menus, pied de page).
 */
import { createHash } from "node:crypto";
import { proposerTypeMatiere } from "@/domaine/derivations-generateur";
import { motsSignificatifs } from "@/domaine/illustrations";
import type { RubriqueSite, TypeMatiere } from "@/domaine/types";

const NOMMEES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", laquo: "«", raquo: "»",
  hellip: "…", mdash: "—", ndash: "–", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", icirc: "î", euro: "€", deg: "°", middot: "·",
};

/** Entités HTML → caractères (nommées courantes et numériques). */
export function decoderEntites(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : tout;
    }
    return NOMMEES[e.toLowerCase()] ?? tout;
  });
}

/** Texte d'un bout de HTML : balises retirées, entités décodées, espaces resserrés. */
export function texteDe(html: string): string {
  return decoderEntites(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

export interface QuestionSite {
  question: string;
  reponse?: string;
}

export interface PageLue {
  titre: string;
  h1?: string;
  description?: string;
  paragraphes: string[];
  questions: QuestionSite[];
}

/** Questions-réponses décrites par la page (données structurées `FAQPage` / `Question`). */
export function questionsDe(html: string): QuestionSite[] {
  const vues = new Set<string>();
  const sortie: QuestionSite[] = [];
  const parcourir = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(parcourir);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (o["@type"] === "Question" && typeof o.name === "string") {
      const question = texteDe(o.name);
      const r = o.acceptedAnswer as Record<string, unknown> | undefined;
      const reponse = r && typeof r.text === "string" ? texteDe(r.text) : undefined;
      if (question && !vues.has(question)) {
        vues.add(question);
        sortie.push({ question, ...(reponse ? { reponse } : {}) });
      }
      return;
    }
    Object.values(o).forEach(parcourir);
  };
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      parcourir(JSON.parse(m[1]));
    } catch {
      /* bloc illisible : ignoré */
    }
  }
  return sortie;
}

/** Lecture d'une page du site : titre, description, paragraphes du contenu principal, questions. */
export function lirePageSite(html: string): PageLue {
  const titre = texteDe(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s*[·|–-]\s*Axion-IA\s*$/i, "");
  const h1 = texteDe(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "") || undefined;
  const description = decoderEntites(/<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1] ?? "").trim() || undefined;
  const principal = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? html;
  const nettoye = principal
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|footer|aside|form|noscript)\b[\s\S]*?<\/\1>/gi, " ");
  const paragraphes = [...nettoye.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => texteDe(m[1])).filter(Boolean);
  return { titre, h1, description, paragraphes, questions: questionsDe(html) };
}

/* ------------------------------------------------------------------ */
/* Morceaux proposés comme matières                                    */
/* ------------------------------------------------------------------ */

export interface Morceau {
  texte: string;
  type: TypeMatiere;
  sorte: "paragraphe" | "question";
}

/** Phrases de service, jamais des matières (certification, bandeau, mentions). */
const SANS_INTERET = /(certification qualit[ée] a [ée]t[ée] d[ée]livr[ée]e|visibilit[ée] offerte|cookie|plausible|clarity|tous droits r[ée]serv[ée]s|javascript|nos questions sont organis[ée]es|r[ée]ponses courtes, sourc[ée]es)/i;

export const LONGUEUR_MIN = 80;
export const LONGUEUR_MAX = 420;

/**
 * Un paragraphe devient un morceau tel quel s'il est court ; sinon ses PREMIÈRES PHRASES ENTIÈRES (jamais coupé au
 * milieu d'une phrase, jamais un mot ajouté). Trop court, trop long d'une seule phrase, ou phrase de service : rien.
 */
export function extrait(paragraphe: string): string | null {
  const t = paragraphe.trim();
  if (t.length < LONGUEUR_MIN || SANS_INTERET.test(t)) return null;
  if (t.length <= LONGUEUR_MAX) return t;
  const phrases = t.match(/[^.!?…]+[.!?…]+(?:["»”)]+)?(?:\s+|$)/g) ?? [];
  let sortie = "";
  for (const p of phrases) {
    if ((sortie + p).trim().length > LONGUEUR_MAX) break;
    sortie += p;
  }
  sortie = sortie.trim();
  return sortie.length >= LONGUEUR_MIN && t.startsWith(sortie) ? sortie : null;
}

/** Combien de morceaux au plus par page, selon la rubrique (rien de plus : Will relit tout). */
export const LIMITES: Record<RubriqueSite, { paragraphes: number; questions: number }> = {
  actualite: { paragraphes: 1, questions: 0 },
  article: { paragraphes: 1, questions: 1 },
  faq: { paragraphes: 0, questions: 4 },
  accueil: { paragraphes: 2, questions: 2 },
  offre: { paragraphes: 2, questions: 2 },
  formation: { paragraphes: 2, questions: 2 },
  "a-propos": { paragraphes: 1, questions: 1 },
  autre: { paragraphes: 0, questions: 0 },
};

/**
 * PAS DE FAUX CAS CLIENT : un paragraphe qui RACONTE l'histoire d'une entreprise (« À Vaulx-en-Velin, une PME du
 * secteur industriel a récemment cherché… ») n'est jamais proposé, même s'il est sur le site : un cas client demande
 * une preuve et l'accord du client, que seul Will peut donner.
 */
export function raconteUnCas(texte: string): boolean {
  const t = texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\b(etude de cas|cas client|cas concret|temoign|retour d'experience|chez (notre|un|une) client)/.test(t)) return true;
  const acteur = /\b(une?|cette|notre|nos|leur) (pme|tpe|eti|entreprise|societe|start-?up|cabinet|clients?|clientes?|industriel|artisan|commerce|boutique|agence|usine|dirigeante?|directrice|directeur|responsable|equipe)\b/.test(t);
  const recit = /\b(a|ont|avait|avaient)\s+(recemment\s+|deja\s+|alors\s+)?[a-z]+(e|ee|es|ees|i|is|it|u|us|ert)\b/.test(t) || /^(a|en|chez) [a-z-]+,/.test(t);
  return acteur && recit;
}

/** Page d'étude de cas ou de témoignage : aucun paragraphe n'en est tiré (les questions restent possibles). */
export function pageDeCas(titre: string): boolean {
  return /(etude de cas|cas client|cas concret|temoignage|retour d'experience)/.test(titre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
}

/** Types jamais proposés depuis le site : un cas client, la parole d'un dirigeant ou une étude demandent Will. */
const TYPES_INTERDITS = new Set<TypeMatiere>(["cas-client", "parole-dirigeant", "etude", "anecdote-will"]);

function typeDuParagraphe(texte: string, rubrique: RubriqueSite): TypeMatiere {
  if (rubrique === "actualite") return "actualite";
  const t = proposerTypeMatiere(texte);
  return TYPES_INTERDITS.has(t) ? "avis-will" : t;
}

/** Tous les morceaux possibles d'une page (avant les limites), dans l'ordre de la page. */
export function morceauxPossibles(page: PageLue, rubrique: RubriqueSite): Morceau[] {
  const vus = new Set<string>();
  const sortie: Morceau[] = [];
  const cas = pageDeCas(`${page.titre} ${page.h1 ?? ""}`);
  for (const p of cas ? [] : page.paragraphes) {
    const t = extrait(p);
    if (!t || vus.has(cleMorceau(t)) || raconteUnCas(t)) continue;
    vus.add(cleMorceau(t));
    sortie.push({ texte: t, type: typeDuParagraphe(t, rubrique), sorte: "paragraphe" });
  }
  for (const q of page.questions) {
    const t = q.question.trim();
    if (t.length < 12 || t.length > LONGUEUR_MAX || vus.has(cleMorceau(t))) continue;
    vus.add(cleMorceau(t));
    sortie.push({ texte: t, type: "question-recue", sorte: "question" });
  }
  return sortie;
}

/** Les morceaux NOUVEAUX d'une page (jamais vus), dans les limites de sa rubrique. */
export function morceauxNouveaux(possibles: Morceau[], rubrique: RubriqueSite, dejaVus: ReadonlySet<string>): Morceau[] {
  const lim = LIMITES[rubrique];
  const nouveaux = possibles.filter((m) => !dejaVus.has(empreinteMorceau(m.texte)));
  return [...nouveaux.filter((m) => m.sorte === "paragraphe").slice(0, lim.paragraphes), ...nouveaux.filter((m) => m.sorte === "question").slice(0, lim.questions)];
}

/** Forme comparable d'un texte (accents, casse, espaces, apostrophes). */
export function cleMorceau(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hache(t: string): string {
  return createHash("sha256").update(t).digest("hex").slice(0, 16);
}

export function empreinteMorceau(t: string): string {
  return hache(cleMorceau(t));
}

/** Empreinte du contenu utile : titre + morceaux possibles. Ne change pas avec les menus, scripts ou publicités. */
export function empreintePage(page: PageLue, possibles: Morceau[]): string {
  return hache([cleMorceau(page.titre), ...possibles.map((m) => cleMorceau(m.texte))].join("\n"));
}

/* ------------------------------------------------------------------ */
/* Mots-clés des captures                                              */
/* ------------------------------------------------------------------ */

const MOTS_SITE = new Set(["axion", "axion-ia", "cabinet", "france", "vous", "votre", "vos", "nos", "notre", "page", "decouvrez", "explorez"]);

const MOTS_RUBRIQUE: Record<RubriqueSite, string[]> = {
  accueil: ["site", "accueil"],
  offre: ["site", "offre"],
  formation: ["site", "formation"],
  faq: ["site", "questions"],
  "a-propos": ["site", "equipe"],
  article: ["site", "article"],
  actualite: ["site", "actualite"],
  autre: ["site"],
};

/** Mots-clés d'une capture : tirés du titre, du grand titre et de la description de la page (20 au plus). */
export function motsClesPage(page: Pick<PageLue, "titre" | "h1" | "description">, rubrique: RubriqueSite): string[] {
  const mots = motsSignificatifs([page.titre, page.h1, page.description].filter(Boolean).join(" ")).filter((m) => !MOTS_SITE.has(m) && !/^\d+$/.test(m));
  return Array.from(new Set([...MOTS_RUBRIQUE[rubrique], ...mots])).slice(0, 20);
}
