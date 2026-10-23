/**
 * SOURCE AXION-IA.COM (03/10) — lecture quotidienne du site, SANS réseau ni dépense : le site est rejoué par une
 * fausse fonction `fetch` (textes réels du site, pages réduites à l'essentiel), le rendu et le stockage sont faux.
 * Pages nouvelles ou modifiées seulement, aucun doublon, rien d'effacé, robots.txt respecté, rythme poli, site muet =
 * message clair et nouvel essai demain, captures rangées dans Mes images et prises EN PREMIER par la cascade.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs";
import type { Plan } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const site = await import("@/services/source-axion");
const { ecarterMatiere, confirmerMatiere } = await import("@/services/matieres");
const { appliquerCascade } = await import("@/services/illustrations");
const { etape21SourceAxion } = await import("@/services/migrations/etape-21-source-axion");
const { migrerDonnees } = await import("@/services/migrations");
const { normaliserAdresse, rubriqueDe, idPage, PAGES_DEPART } = await import("@/source-axion/adresses");
const { lireRobots, autorise, pauseEntreLectures } = await import("@/source-axion/robots");
const { lirePageSite, morceauxPossibles, extrait, morceauxNouveaux, raconteUnCas } = await import("@/source-axion/extraction");
const { lireIndexPlan, lirePlan } = await import("@/source-axion/plan-du-site");
const { captureDue, pagesALire } = await import("@/source-axion/regles");
const { utilisableParLeMoteur } = await import("@/domaine/illustrations");

const MDP = "essai-source-axion";
const S = "https://axion-ia.com";

/* ------------------------------------------------------------------ */
/* Le site rejoué (textes réels, pages réduites)                         */
/* ------------------------------------------------------------------ */

const ROBOTS = `User-Agent: *
Allow: /
Allow: /api/og
Disallow: /api/
Disallow: /_next/
Disallow: /*/telecharger
Disallow: /fr/admin/

User-Agent: Bingbot
Allow: /
Crawl-delay: 1
`;

interface FauxPage {
  titre: string;
  h1: string;
  description?: string;
  paragraphes: string[];
  questions?: [string, string][];
}

function html(p: FauxPage): string {
  const ld = p.questions?.length ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.questions.map(([q, r]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: r } })) })}</script>` : "";
  return `<!DOCTYPE html><html lang="fr"><head><title>${p.titre} · Axion-IA</title>${p.description ? `<meta name="description" content="${p.description}"/>` : ""}${ld}</head><body>
<nav><p>Formations · Audit · Implémentation · Tarifs · Contact — le menu du site, présent sur toutes les pages, jamais une matière.</p></nav>
<main><h1>${p.h1}</h1>${p.paragraphes.map((x) => `<p class="texte">${x.replace(/'/g, "&#x27;")}</p>`).join("")}</main>
<footer><p>© 2026 Axion-IA · Mentions légales · Politique de confidentialité · Plausible (anonyme, UE, sans cookie) est toujours actif.</p></footer>
<script>self.__next_f.push([1,"${"x".repeat(200)}"])</script></body></html>`;
}

const Q_FRANCE: [string, string] = ["Couvrez-vous toute la France et l'international ?", "Oui, toute la France. Nous intervenons sur site dans les 13 régions de France métropolitaine."];
const Q_COMMENCER: [string, string] = ["Par où commencer avec l'IA dans mon entreprise ?", "Par un cas réel, pas par un plan stratégique."];
const Q_PRIX: [string, string] = ["Combien coûte une formation IA en entreprise ?", "Nos prix sont publics et tarifés par groupe (2 à 15 participants)."];

const P_ACCUEIL = "Vous traitez directement avec les formateurs, auditeurs, développeurs et implémenteurs qui interviennent chez vous. Tous seniors.";
const P_FORMATIONS = "La découverte en une demi-journée : dense et démonstrative, elle lève les blocages sans désorganiser votre activité. Chacun repart avec des usages applicables dès le lendemain.";
const P_FORMATIONS_NOUVEAU = "La différence avec le condensé : une journée entière avec autant de pratique que de théorie — chaque participant teste plusieurs usages sur son propre travail, en atelier guidé.";
const P_ACTU = "Malgré l'engouement politique et économique pour l'IA, son adoption par les consommateurs reste limitée, mettant en lumière la nécessité d'une meilleure communication et de mesures éthiques robustes.";
const P_BLOG_1 = "Réaliser un audit IA à Vénissieux permet d'identifier les non-conformités et d'optimiser les systèmes d'intelligence artificielle pour une meilleure performance et sécurité.";
const P_BLOG_2 = "Les entreprises de Vénissieux, comme ailleurs en France, adoptent de plus en plus l'IA pour améliorer leurs processus.";

interface EtatSite {
  pages: Record<string, FauxPage>;
  /** Entrées des sous-plans : chemin → date. */
  plan: Record<string, string>;
  actualites: Record<string, { date: string; titre: string }>;
  panne?: RegExp;
  robots?: string | number;
}

function siteDeDepart(): EtatSite {
  return {
    pages: {
      "/fr": { titre: "Cabinet IA France · Formations · Audits", h1: "On vous parle d'IA partout. Vous ne savez plus par où commencer. Nous, si.", description: "Formations IA finançables OPCO, certifié Certifexemple.", paragraphes: [P_ACCUEIL], questions: [Q_FRANCE, Q_COMMENCER] },
      "/fr/formations": { titre: "Formation IA en entreprise sur site", h1: "Explosez la productivité de vos équipes par des formations performantes", description: "Formations IA présentiel ou distanciel, certifié Certifexemple, finançables OPCO.", paragraphes: [P_FORMATIONS], questions: [Q_PRIX, Q_FRANCE] },
      "/fr/audit": { titre: "Audit IA", h1: "Audit IA", paragraphes: ["Cartographie complète de vos gains potentiels, chiffrés action par action, pour décider en connaissance de cause et sans jargon."] },
      "/fr/implementation": { titre: "Implémentation IA", h1: "Implémentation IA", paragraphes: ["On intègre l'IA dans vos process existants — déployé, testé, opérationnel, avec un seul interlocuteur du début à la fin."] },
      "/fr/tarifs": { titre: "Tarifs", h1: "Tarifs", paragraphes: ["Nos prix sont publics : la page tarifs affiche les prix d'entrée de chaque format, sans formulaire à remplir."] },
      "/fr/faq": { titre: "FAQ IA entreprise", h1: "Questions fréquentes", paragraphes: ["Nos questions sont organisées par famille : interventions et formations, audit, implémentation, tarifs, process & RGPD, sites web, coaching 1-to-1."], questions: [Q_FRANCE, Q_COMMENCER] },
      "/fr/a-propos": { titre: "À propos · cabinet IA opérationnel", h1: "À propos", paragraphes: ["Axion-IA, cabinet IA opérationnel dont le siège est à Villeexemple et qui intervient dans toute la France, sur site ou à distance."] },
      "/fr/mentions-legales": { titre: "Mentions légales", h1: "Mentions légales", paragraphes: ["Éditeur du site : texte légal qui ne doit jamais devenir une matière, quelle que soit sa longueur dans la page."] },
      "/fr/blog/audit-ia-venissieux-comprendre-optimiser": { titre: "Audit IA Vénissieux", h1: "Audit IA à Vénissieux", paragraphes: [P_BLOG_1, P_BLOG_2], questions: [["Qu'est-ce qu'un audit IA ?", "Un audit IA est une évaluation systématique."]] },
      "/fr/actualites/adoption-limitee-ia-consommateurs-investissements": { titre: "Consommateurs et IA", h1: "Adoption limitée de l'IA par les consommateurs malgré les investissements massifs", paragraphes: [P_ACTU] },
    },
    plan: {
      "/fr": "2026-10-02T17:43:39.000Z",
      "/fr/formations": "2026-10-02T17:43:39.000Z",
      "/fr/audit": "2026-10-02T17:43:39.000Z",
      "/fr/implementation": "2026-10-02T17:43:39.000Z",
      "/fr/tarifs": "2026-10-02T17:43:39.000Z",
      "/fr/faq": "2026-10-02T17:43:39.000Z",
      "/fr/a-propos": "2026-10-02T17:43:39.000Z",
      "/fr/mentions-legales": "2026-10-02T17:43:39.000Z",
      "/fr/admin/secret": "2026-10-02T17:43:39.000Z",
      "/fr/blog/audit-ia-venissieux-comprendre-optimiser": "2026-07-05",
    },
    actualites: { "/fr/actualites/adoption-limitee-ia-consommateurs-investissements": { date: "2026-10-03T06:00:40.339Z", titre: "Adoption limitée de l&apos;IA par les consommateurs" } },
  };
}

function fauxWeb(etat: EtatSite) {
  const appels: string[] = [];
  const f = (async (u: string | URL | Request) => {
    const url = String(u);
    appels.push(url);
    if (etat.panne?.test(url)) throw new DOMException("délai", "TimeoutError");
    const chemin = url.replace(S, "");
    if (chemin === "/robots.txt") return typeof etat.robots === "number" ? new Response("", { status: etat.robots }) : new Response(etat.robots ?? ROBOTS);
    if (chemin === "/sitemap-index.xml")
      return new Response(`<?xml version="1.0"?><sitemapindex>${["/sitemap/pages.xml", "/sitemap/villes-ile-de-france.xml", "/sitemap-news.xml", "/sitemap-blog.xml"].map((p) => `<sitemap><loc>${S}${p}</loc></sitemap>`).join("")}</sitemapindex>`);
    if (chemin === "/sitemap/pages.xml" || chemin === "/sitemap-blog.xml") {
      const garder = Object.entries(etat.plan).filter(([p]) => (chemin === "/sitemap-blog.xml") === p.startsWith("/fr/blog/"));
      return new Response(`<urlset>${garder.map(([p, d]) => `<url><loc>${S}${p}</loc><lastmod>${d}</lastmod></url>`).join("")}</urlset>`);
    }
    if (chemin === "/sitemap-news.xml") return new Response(`<urlset>${Object.entries(etat.actualites).map(([p, a]) => `<url><loc>${S}${p}</loc><news:news><news:publication_date>${a.date}</news:publication_date><news:title>${a.titre}</news:title></news:news></url>`).join("")}</urlset>`);
    if (chemin.startsWith("/sitemap/villes")) return new Response(`<urlset><url><loc>${S}/fr/ville/villeexemple</loc></url></urlset>`);
    const page = etat.pages[chemin];
    return page ? new Response(html(page), { status: 200, headers: { "content-type": "text/html" } }) : new Response("introuvable", { status: 404 });
  }) as typeof fetch;
  return { f, appels, pagesLues: () => appels.filter((a) => !/robots|sitemap/.test(a)).map((a) => a.replace(S, "")) };
}

const LE_03_10 = new Date("2026-10-03T08:00:00Z");
const jour = (n: number) => new Date(LE_03_10.getTime() + n * 86_400_000);
const pauses: number[] = [];
const dep = (f: typeof fetch, quand = LE_03_10, extra: Partial<Parameters<typeof site.lireLeSite>[0]> = {}) => ({ appeler: f, maintenant: () => quand, pause: async (ms: number) => void pauses.push(ms), rendu: null, stockage: null, ...extra });
const matieresSite = () => depots().matieres.lister((m) => m.source.origine === "site");

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  pauses.length = 0;
  await auth.seConnecter(MDP, false);
  await etape21SourceAxion(depots(), LE_03_10.toISOString());
});

/* ------------------------------------------------------------------ */
/* Règles pures                                                         */
/* ------------------------------------------------------------------ */

describe("adresses, robots.txt, plan du site", () => {
  it("seul axion-ia.com, sous une forme unique ; rubriques", () => {
    expect(normaliserAdresse("https://www.axion-ia.com/fr/faq/?x=1#a")).toBe(`${S}/fr/faq`);
    expect(normaliserAdresse("/fr/formations/")).toBe(`${S}/fr/formations`);
    expect(normaliserAdresse("axion-ia.com/fr")).toBe(`${S}/fr`);
    for (const a of ["https://studio.axion-ia.com/", "https://exemple.fr/fr", "https://axion-ia.com.pirate.fr/", "javascript:alert(1)", ""]) expect(normaliserAdresse(a), a).toBeNull();
    expect(rubriqueDe(`${S}/fr`)).toBe("accueil");
    expect(rubriqueDe(`${S}/fr/actualites/x`)).toBe("actualite");
    expect(rubriqueDe(`${S}/fr/blog/x`)).toBe("article");
    expect(rubriqueDe(`${S}/fr/blog/categorie/x`)).toBe("autre");
    expect(rubriqueDe(`${S}/fr/audit/tpe-1-jour`)).toBe("offre");
    expect(rubriqueDe(`${S}/fr/formations/entreprise`)).toBe("formation");
    expect(rubriqueDe(`${S}/fr/mentions-legales`)).toBe("autre");
  });

  it("robots.txt : règles du groupe *, la plus longue l'emporte, motifs * ; pause d'au moins 1,5 s", () => {
    const r = lireRobots(ROBOTS);
    expect(autorise(`${S}/fr/formations`, r)).toBe(true);
    expect(autorise(`${S}/api/og`, r)).toBe(true);
    expect(autorise(`${S}/api/autre`, r)).toBe(false);
    expect(autorise(`${S}/fr/guide/telecharger`, r)).toBe(false);
    expect(autorise(`${S}/fr/admin/secret`, r)).toBe(false);
    expect(pauseEntreLectures(r)).toBe(1500);
    expect(pauseEntreLectures(lireRobots("User-agent: *\nCrawl-delay: 4\nDisallow: /x"))).toBe(4000);
    expect(autorise(`${S}/tout`, lireRobots("User-agent: veille-studio-axion-ia\nDisallow: /\n\nUser-agent: *\nAllow: /"))).toBe(false);
  });

  it("plan du site : sous-plans, dates, titres d'actualité décodés", () => {
    expect(lireIndexPlan("<sitemapindex><sitemap><loc>https://axion-ia.com/a.xml</loc></sitemap></sitemapindex>")).toEqual(["https://axion-ia.com/a.xml"]);
    expect(lirePlan("<urlset><url><loc>https://axion-ia.com/fr/actualites/a</loc><news:news><news:publication_date>2026-10-03T06:00:40Z</news:publication_date><news:title>L&apos;IA</news:title></news:news></url></urlset>")).toEqual([{ url: "https://axion-ia.com/fr/actualites/a", date: "2026-10-03T06:00:40Z", titre: "L'IA" }]);
  });
});

describe("extraction : fidèle au site, jamais inventée", () => {
  const p = siteDeDepart().pages["/fr/formations"];
  const lue = lirePageSite(html(p));

  it("titre, grand titre, paragraphes du contenu principal (ni menu ni pied de page), questions", () => {
    expect(lue.titre).toBe("Formation IA en entreprise sur site");
    expect(lue.h1).toMatch(/^Explosez/);
    expect(lue.paragraphes).toEqual([P_FORMATIONS]);
    expect(lue.questions.map((q) => q.question)).toEqual([Q_PRIX[0], Q_FRANCE[0]]);
  });

  it("chaque morceau est un texte du site mot pour mot ; jamais un cas client ni une parole de dirigeant", () => {
    const page = siteDeDepart().pages["/fr"];
    const texteSite = [...page.paragraphes, ...(page.questions ?? []).map((q) => q[0])].join("\n");
    for (const m of morceauxPossibles(lirePageSite(html(page)), "accueil")) {
      expect(texteSite).toContain(m.texte);
      expect(["cas-client", "parole-dirigeant", "etude"]).not.toContain(m.type);
    }
  });

  it("un long paragraphe donne ses premières phrases ENTIÈRES ; une phrase de service n'est jamais un morceau", () => {
    const long = `${P_FORMATIONS} ${P_FORMATIONS_NOUVEAU} ${P_BLOG_1}`;
    const e = extrait(long)!;
    expect(long.startsWith(e)).toBe(true);
    expect(e.endsWith(".")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(420);
    expect(extrait("La certification qualité a été délivrée au titre de la ou des catégories d'actions suivantes : Actions de formation.")).toBeNull();
    expect(extrait("Trop court.")).toBeNull();
  });

  it("PAS DE FAUX CAS CLIENT : un paragraphe qui raconte l'histoire d'une entreprise n'est jamais proposé ; une page d'étude de cas ne donne aucun paragraphe", () => {
    const recit = "À Vaulx-en-Velin, une PME du secteur industriel a récemment cherché à renforcer ses compétences en IA pour se démarquer sur le marché national.";
    expect(raconteUnCas(recit)).toBe(true);
    expect(raconteUnCas("Notre client a gagné 6 heures par semaine grâce à l'automatisation de ses relances.")).toBe(true);
    expect(raconteUnCas(P_FORMATIONS)).toBe(false);
    expect(raconteUnCas(P_ACCUEIL)).toBe(false);
    const page = lirePageSite(html({ titre: "Étude de cas Comparatif des meilleures certifications IA", h1: "Étude de cas", paragraphes: [P_FORMATIONS, recit], questions: [["Quels sont les avantages des certifications IA ?", "…"]] }));
    expect(morceauxPossibles(page, "article").map((m) => m.sorte)).toEqual(["question"]);
    const article = lirePageSite(html({ titre: "Article", h1: "Article", paragraphes: [recit, P_BLOG_1] }));
    expect(morceauxPossibles(article, "article").map((m) => m.texte)).toEqual([P_BLOG_1]);
  });

  it("limites par rubrique : une actualité donne une seule matière, de type actualité", () => {
    const actu = lirePageSite(html(siteDeDepart().pages["/fr/actualites/adoption-limitee-ia-consommateurs-investissements"]));
    const m = morceauxNouveaux(morceauxPossibles(actu, "actualite"), "actualite", new Set());
    expect(m).toEqual([{ texte: P_ACTU, type: "actualite", sorte: "paragraphe" }]);
  });
});

/* ------------------------------------------------------------------ */
/* Lecture du site                                                      */
/* ------------------------------------------------------------------ */

describe("lecture quotidienne : pages nouvelles ou modifiées seulement", () => {
  it("première lecture = point de départ : seule l'actualité du jour est proposée ; les pages déjà en ligne sont notées", async () => {
    const web = fauxWeb(siteDeDepart());
    const b = await site.lireLeSite(dep(web.f));
    expect(b.ok).toBe(true);
    const ms = await matieresSite();
    expect(ms.map((m) => m.texte)).toEqual([P_ACTU]);
    expect(ms[0]).toMatchObject({ type: "actualite", saisiePar: "proposee-machine", statut: "a-confirmer", source: { origine: "site", url: `${S}/fr/actualites/adoption-limitee-ia-consommateurs-investissements` } });
    expect(ms[0].source.date.slice(0, 10)).toBe("2026-10-03");
    // Pages lues : les 7 pages suivies + l'actualité récente. L'article de juillet, les mentions légales, l'admin, les villes : non.
    expect(web.pagesLues().sort()).toEqual(["/fr", "/fr/a-propos", "/fr/actualites/adoption-limitee-ia-consommateurs-investissements", "/fr/audit", "/fr/faq", "/fr/formations", "/fr/implementation", "/fr/tarifs"]);
    expect(await depots().pagesSite.obtenir(idPage(`${S}/fr/blog/audit-ia-venissieux-comprendre-optimiser`))).toMatchObject({ connueAuDepart: true });
    expect(await depots().pagesSite.obtenir(idPage(`${S}/fr/admin/secret`))).toBeNull();
    // Cloche : « 1 nouvelle matière depuis votre site ».
    expect((await depots().notifications.lister()).some((n) => n.titre === "1 nouvelle matière depuis votre site" && n.lien === "/ecrire/matieres")).toBe(true);
  });

  it("le lendemain : un NOUVEL article et une page suivie MODIFIÉE ; rien d'autre n'est relu ni proposé", async () => {
    const etat = siteDeDepart();
    await site.lireLeSite(dep(fauxWeb(etat).f));
    etat.plan["/fr/blog/nouvel-article"] = "2026-10-04";
    etat.pages["/fr/blog/nouvel-article"] = { titre: "Nouvel article", h1: "Nouvel article", paragraphes: [P_BLOG_2, "Un deuxième paragraphe assez long pour être retenu comme matière par la lecture du studio, mot pour mot."], questions: [["Comment financer un audit IA ?", "Via les OPCO."]] };
    etat.pages["/fr/formations"].paragraphes.push(P_FORMATIONS_NOUVEAU);
    const web = fauxWeb(etat);
    const b = await site.lireLeSite(dep(web.f, jour(1)));
    const textes = (await matieresSite()).map((m) => m.texte);
    expect(textes).toContain(P_FORMATIONS_NOUVEAU); // seul le morceau nouveau de la page modifiée
    expect(textes).not.toContain(P_FORMATIONS); // déjà là au départ
    expect(textes).toContain(P_BLOG_2);
    expect(textes).toContain("Comment financer un audit IA ?");
    expect(textes).not.toContain(P_BLOG_1); // article de juillet, jamais modifié : jamais lu
    expect(web.pagesLues()).not.toContain("/fr/blog/audit-ia-venissieux-comprendre-optimiser");
    expect(b).toMatchObject({ nouvelles: 1, changees: 1 });
    expect((await depots().pagesSite.obtenir(idPage(`${S}/fr/formations`)))!.changeeLe).toBe(jour(1).toISOString());
  });

  it("une page connue dont la date change est relue (au plus une fois par semaine) : seuls ses morceaux nouveaux comptent", async () => {
    const etat = siteDeDepart();
    await site.lireLeSite(dep(fauxWeb(etat).f));
    etat.plan["/fr/blog/audit-ia-venissieux-comprendre-optimiser"] = "2026-10-04";
    let web = fauxWeb(etat);
    await site.lireLeSite(dep(web.f, jour(1)));
    // Première lecture d'une page connue au départ : point de départ, rien proposé.
    expect(web.pagesLues()).toContain("/fr/blog/audit-ia-venissieux-comprendre-optimiser");
    expect((await matieresSite()).map((m) => m.texte)).not.toContain(P_BLOG_1);
    etat.plan["/fr/blog/audit-ia-venissieux-comprendre-optimiser"] = "2026-10-05";
    etat.pages["/fr/blog/audit-ia-venissieux-comprendre-optimiser"].paragraphes.unshift("Paragraphe ajouté à l'article : il apparaît après la première lecture, il devient donc une matière à relire.");
    web = fauxWeb(etat);
    await site.lireLeSite(dep(web.f, jour(2)));
    expect(web.pagesLues()).not.toContain("/fr/blog/audit-ia-venissieux-comprendre-optimiser"); // relu il y a un jour : attendra
    web = fauxWeb(etat);
    await site.lireLeSite(dep(web.f, jour(8)));
    expect(web.pagesLues()).toContain("/fr/blog/audit-ia-venissieux-comprendre-optimiser");
    expect((await matieresSite()).map((m) => m.texte)).toContain("Paragraphe ajouté à l'article : il apparaît après la première lecture, il devient donc une matière à relire.");
  });

  it("pas plus de 12 matières par jour : le reste est proposé le lendemain, rien n'est perdu ni proposé deux fois", async () => {
    const etat = siteDeDepart();
    await site.lireLeSite(dep(fauxWeb(etat).f));
    for (let i = 0; i < 20; i++) {
      etat.actualites[`/fr/actualites/essai-${i}`] = { date: `2026-10-04T0${i % 10}:00:00Z`, titre: `Essai ${i}` };
      etat.pages[`/fr/actualites/essai-${i}`] = { titre: `Essai ${i}`, h1: `Essai ${i}`, paragraphes: [`Actualité numéro ${i} : un paragraphe assez long pour devenir une matière, tiré mot pour mot de la page du site.`] };
    }
    const b1 = await site.lireLeSite(dep(fauxWeb(etat).f, jour(1)));
    expect(b1.matieres).toBe(12);
    expect(b1.enAttente).toBe(8);
    const b2 = await site.lireLeSite(dep(fauxWeb(etat).f, jour(2)));
    expect(b2.matieres).toBe(8);
    const textes = (await matieresSite()).map((m) => m.texte).filter((t) => t.startsWith("Actualité numéro"));
    expect(new Set(textes).size).toBe(20);
    expect(textes).toHaveLength(20);
  });

  it("pas plus de 60 pages par jour : le reste attend le lendemain (rien n'est perdu)", () => {
    const entrees = Array.from({ length: 80 }, (_, i) => ({ url: `${S}/fr/actualites/a${i}`, date: "2026-10-03T06:00:00Z", rubrique: "actualite" as const }));
    const r = pagesALire(entrees, new Map(), LE_03_10, false);
    expect(r).toHaveLength(60);
  });
});

describe("aucun doublon, rien d'effacé", () => {
  it("la même question sur plusieurs pages n'est proposée qu'une fois ; une deuxième lecture ne propose rien de plus", async () => {
    const etat = siteDeDepart();
    await site.lireLeSite(dep(fauxWeb(etat).f));
    // Will ajoute deux pages : leurs morceaux sont proposés dès la première lecture ; Q_FRANCE est sur les deux.
    etat.pages["/fr/interventions/individuel"] = { titre: "Coaching", h1: "Coaching 1-to-1", paragraphes: ["Un seul interlocuteur senior, du premier atelier à la mise en production. Vous entrez par le besoin du moment."], questions: [Q_FRANCE] };
    etat.pages["/fr/podcast"] = { titre: "Podcast", h1: "Podcast", paragraphes: [], questions: [Q_FRANCE, Q_PRIX] };
    await site.ajouterPageSuivie("https://axion-ia.com/fr/interventions/individuel/");
    await site.ajouterPageSuivie("/fr/podcast");
    await site.lireLeSite(dep(fauxWeb(etat).f, jour(1)));
    const avant = await matieresSite();
    expect(avant.filter((m) => m.texte === Q_FRANCE[0])).toHaveLength(1);
    expect(avant.filter((m) => m.texte === Q_PRIX[0])).toHaveLength(1);
    await site.lireLeSite(dep(fauxWeb(etat).f, jour(2)));
    expect(await matieresSite()).toHaveLength(avant.length);
  });

  it("« Écarter » range la matière (jamais effacée) et elle n'est plus jamais proposée ; « Garder » la valide", async () => {
    const etat = siteDeDepart();
    await site.lireLeSite(dep(fauxWeb(etat).f));
    const [m] = await matieresSite();
    await ecarterMatiere(m.id);
    expect(await depots().matieres.obtenir(m.id)).toMatchObject({ archiveLe: expect.any(String), texte: P_ACTU });
    // La même actualité republiée ailleurs : jamais reproposée.
    etat.actualites["/fr/actualites/copie"] = { date: "2026-10-04T06:00:00Z", titre: "Copie" };
    etat.pages["/fr/actualites/copie"] = { ...etat.pages["/fr/actualites/adoption-limitee-ia-consommateurs-investissements"] };
    await site.lireLeSite(dep(fauxWeb(etat).f, jour(1)));
    expect((await matieresSite()).filter((x) => x.texte === P_ACTU)).toHaveLength(1);
    const nouvelle = await depots().matieres.trouver((x) => x.source.origine === "site" && x.texte === P_FORMATIONS);
    expect(nouvelle).toBeNull();
    const compte = await depots().matieres.compter();
    await confirmerMatiere(m.id);
    expect(await depots().matieres.compter()).toBe(compte);
  });

  it("retirer une page de la liste la garde (avec ses images) ; la rajouter la reprend", async () => {
    const id = idPage(`${S}/fr/tarifs`);
    await site.retirerPageSuivie(id);
    expect(await depots().pagesSite.obtenir(id)).toMatchObject({ suivie: { retireeLe: expect.any(String) } });
    expect((await site.lireVueSite()).pages.map((p) => p.chemin)).not.toContain("/fr/tarifs");
    await site.ajouterPageSuivie("/fr/tarifs");
    expect((await site.lireVueSite()).pages.map((p) => p.chemin)).toContain("/fr/tarifs");
    await expect(site.ajouterPageSuivie("/fr/tarifs")).rejects.toThrow(/déjà suivie/);
    await expect(site.ajouterPageSuivie("https://exemple.fr/page")).rejects.toThrow(/axion-ia\.com/);
  });
});

describe("robots.txt et rythme poli", () => {
  it("une page interdite par robots.txt n'est jamais lue, même suivie ; une pause d'au moins 1,5 s sépare chaque lecture", async () => {
    const etat = siteDeDepart();
    etat.robots = `${ROBOTS}\nUser-agent: veille-studio-axion-ia\nDisallow: /fr/faq\nDisallow: /fr/actualites/\n`;
    const web = fauxWeb(etat);
    await site.lireLeSite(dep(web.f));
    expect(web.pagesLues()).not.toContain("/fr/faq");
    expect(web.pagesLues().some((p) => p.startsWith("/fr/actualites/"))).toBe(false);
    expect(pauses.length).toBeGreaterThanOrEqual(web.appels.length - 2);
    expect(Math.min(...pauses)).toBeGreaterThanOrEqual(1500);
  });

  it("robots.txt illisible (panne, pas « absent ») : le site n'est pas lu du tout aujourd'hui", async () => {
    const etat = siteDeDepart();
    etat.robots = 503;
    const web = fauxWeb(etat);
    const b = await site.lireLeSite(dep(web.f));
    expect(b.ok).toBe(false);
    expect(web.appels).toEqual([`${S}/robots.txt`]);
  });
});

describe("le site ne répond pas : message clair, nouvel essai demain", () => {
  it("plan du site muet : bilan « Votre site ne répond pas », rien d'écrit d'autre, pas de nouvel essai avant demain", async () => {
    const etat = siteDeDepart();
    etat.panne = /sitemap-index/;
    let web = fauxWeb(etat);
    const f = vi.fn(web.f);
    await site.tourSite(dep(f as unknown as typeof fetch));
    const vue = await site.lireVueSite();
    expect(vue.bilan).toMatchObject({ ok: false, erreur: expect.stringMatching(/^Votre site ne répond pas .*Nouvel essai demain\.$/) });
    expect(await matieresSite()).toHaveLength(0);
    // 30 min plus tard : pas de nouvel essai.
    const appels = f.mock.calls.length;
    await site.tourSite(dep(f as unknown as typeof fetch, new Date(LE_03_10.getTime() + 30 * 60_000)));
    expect(f.mock.calls.length).toBe(appels);
    // Le lendemain : le site répond, la lecture reprend comme une première fois.
    etat.panne = undefined;
    web = fauxWeb(etat);
    await site.tourSite(dep(web.f, jour(1)));
    expect((await site.lireVueSite()).bilan).toMatchObject({ ok: true });
    expect(await matieresSite()).toHaveLength(1);
  });

  it("une page en panne n'empêche pas les autres ; elle est relue le lendemain", async () => {
    const etat = siteDeDepart();
    etat.panne = /\/fr\/audit$/;
    const b = await site.lireLeSite(dep(fauxWeb(etat).f));
    expect(b.ok).toBe(true);
    expect(b.enAttente).toBe(1);
    expect(await depots().pagesSite.obtenir(idPage(`${S}/fr/audit`))).toMatchObject({ erreur: "La source ne répond pas." });
    etat.panne = undefined;
    const web = fauxWeb(etat);
    await site.lireLeSite(dep(web.f, jour(1)));
    expect(web.pagesLues()).toContain("/fr/audit");
  });

  it("interrupteur coupé : la tâche quotidienne ne lit rien", async () => {
    await site.reglerSite(false);
    const web = fauxWeb(siteDeDepart());
    await site.tourSite(dep(web.f));
    expect(web.appels).toHaveLength(0);
  });
});

describe("aucune dépense", () => {
  it("la lecture n'appelle que axion-ia.com : ni Claude, ni banque, ni fabrication ; aucune dépense enregistrée", async () => {
    const depenses = await depots().depenses.compter();
    const web = fauxWeb(siteDeDepart());
    await site.lireLeSite(dep(web.f));
    expect(web.appels.every((a) => a.startsWith(`${S}/`))).toBe(true);
    expect(await depots().depenses.compter()).toBe(depenses);
  });
});

/* ------------------------------------------------------------------ */
/* Captures                                                             */
/* ------------------------------------------------------------------ */

function fauxRendu() {
  const demandes: DemandeRendu[] = [];
  const service: ServiceRendu = {
    async soumettre(d) {
      demandes.push(d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = demandes.find((x) => x.idRendu === id)!;
      const f = d.parametres.format as string;
      const [largeur, hauteur] = f === "9:16" ? [1080, 1920] : f === "16:9" ? [1920, 1080] : [1080, 1080];
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: { largeur, hauteur, ...(d.parametres.type === "video" ? { dureeSec: 6 } : {}) } };
    },
  };
  return { service, demandes };
}

const fauxStockage = { id: "r2", type: "stockage", nom: "R2", reelPrevu: "R2", mode: "reel", urlDepotDuree: async (cle: string) => `https://r2.exemple/${cle}?signe=1` } as unknown as StockageFichiers;

describe("captures et courtes vidéos → Mes images", () => {
  it("sans rendu relié (simulation) : aucune capture, aucune fausse image, un message simple", async () => {
    const b = await site.lireLeSite(dep(fauxWeb(siteDeDepart()).f));
    expect(b.captures).toBe(0);
    expect(b.capturesImpossibles).toMatch(/rendu relié/);
    expect(await depots().elements.compter((e) => !!e.sourceSite)).toBe(0);
  });

  it("chaque page suivie : 3 images et 2 défilements (+ un survol sur l'accueil, les offres, les formations), prêtes, mots-clés de la page", async () => {
    const r = fauxRendu();
    const b = await site.lireLeSite(dep(fauxWeb(siteDeDepart()).f, LE_03_10, { rendu: r.service, stockage: fauxStockage, suiviMs: 1 }));
    expect(r.demandes.every((d) => d.operation === "capture-site" && d.file === "longue" && d.entrees.page.startsWith(`${S}/fr`))).toBe(true);
    expect(r.demandes).toHaveLength(7 * 5 + 5); // accueil, formations, audit, implémentation, tarifs : un survol en plus
    expect(b.captures).toBe(40);
    const formations = await depots().elements.lister((e) => e.sourceSite?.url === `${S}/fr/formations`);
    expect(formations).toHaveLength(6);
    for (const e of formations) {
      expect(e).toMatchObject({ origine: "personnelle", importeDepuis: "site", confidentialite: { statut: "prete" }, categorieImage: "marque" });
      expect(e.motsCles).toEqual(expect.arrayContaining(["formation", "certifexemple", "opco"]));
    }
    expect(formations.filter((e) => e.type === "illustration-video").map((e) => e.sourceSite!.mouvement).sort()).toEqual(["defilement", "defilement", "survol"]);
    const video = formations.find((e) => e.type === "illustration-video" && e.sourceSite!.format === "9:16")!;
    const image = formations.find((e) => e.type === "illustration-image" && e.sourceSite!.format === "9:16")!;
    expect(video.vignetteFichierId).toBe(image.fichierId);
    expect(await depots().fichiers.obtenir(video.fichierId!)).toMatchObject({ mime: "video/mp4", largeur: 1080, hauteur: 1920, dureeSec: 6 });
    expect((await depots().notifications.lister()).some((n) => /depuis votre site/.test(n.titre) && /images? de votre site/.test(n.message ?? ""))).toBe(true);
  });

  it("la cascade prend la capture verticale EN PREMIER quand le plan parle du sujet (jamais le 16:9)", async () => {
    const r = fauxRendu();
    await site.lireLeSite(dep(fauxWeb(siteDeDepart()).f, LE_03_10, { rendu: r.service, stockage: fauxStockage, suiviMs: 1 }));
    // Une photo personnelle de Will, prête, qui parle aussi de formation : à score égal, la capture du site passe devant.
    await depots().elements.enregistrer({ id: "el-photo-will", type: "illustration-image", nom: "Formation en atelier", motsCles: ["formation", "certifexemple", "financable", "opco"], valeur: { type: "illustration-image" }, licence: { type: "propriete", usageCommercial: true, reseaux: [] }, formatsParDefaut: [], marqueId: "marque-axion", origine: "personnelle", confidentialite: { statut: "prete", zones: [] }, valideLe: LE_03_10.toISOString(), creeLe: LE_03_10.toISOString(), modifieLe: LE_03_10.toISOString() });
    const plan = (id: string, texte: string) => ({ id, ordre: 0, debutSec: 0, finSec: 4, texte, sourceImage: "illustration", illustration: { source: "aucune", verrouille: false, candidats: [] } }) as unknown as Plan;
    const [general, precis] = await appliquerCascade("video-essai", [plan("p1", "Nos formations Certifexemple sont finançables par votre OPCO."), plan("p2", "Explosez la productivité de vos équipes.")], { economique: false, banques: true, fabrication: true });
    for (const decision of [general, precis]) {
      expect(decision.origine).toBe("mes-images");
      expect((await depots().elements.obtenir(decision.elementId!))!.sourceSite).toMatchObject({ format: "9:16" });
    }
    // Le plan qui reprend le grand titre de la page Formations prend la capture de cette page.
    expect((await depots().elements.obtenir(precis.elementId!))!.sourceSite).toMatchObject({ url: `${S}/fr/formations`, format: "9:16" });
    const horizontale = (await depots().elements.lister((e) => e.sourceSite?.format === "16:9"))[0];
    expect(utilisableParLeMoteur(horizontale)).toBe(false);
  });

  it("page modifiée : nouvelles captures au plus une fois par semaine ; les anciennes sont archivées, jamais effacées", async () => {
    const etat = siteDeDepart();
    const r = fauxRendu();
    const avec = (quand: Date) => dep(fauxWeb(etat).f, quand, { rendu: r.service, stockage: fauxStockage, suiviMs: 1 });
    await site.lireLeSite(avec(LE_03_10));
    const id = idPage(`${S}/fr/formations`);
    const premieres = (await depots().pagesSite.obtenir(id))!.captures!.elementIds;
    etat.pages["/fr/formations"].paragraphes.push(P_FORMATIONS_NOUVEAU);
    await site.lireLeSite(avec(jour(1)));
    expect((await depots().pagesSite.obtenir(id))!.captures!.elementIds).toEqual(premieres); // trop tôt
    await site.lireLeSite(avec(jour(8)));
    const nouvelles = (await depots().pagesSite.obtenir(id))!.captures!.elementIds;
    expect(nouvelles).toHaveLength(6);
    expect(nouvelles.some((x) => premieres.includes(x))).toBe(false);
    for (const ancien of premieres) expect(await depots().elements.obtenir(ancien)).toMatchObject({ archiveLe: jour(8).toISOString() });
    // Une page inchangée n'est jamais reprise en photo.
    const accueil = (await depots().pagesSite.obtenir(idPage(`${S}/fr`)))!;
    expect(captureDue(accueil, jour(30))).toBe(false);
  });

  it("une capture en échec : rien n'est rangé pour cette page, nouvel essai le lendemain", async () => {
    const r = fauxRendu();
    r.service.etat = async () => ({ statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "La page ne s'ouvre pas." } });
    const b = await site.lireLeSite(dep(fauxWeb(siteDeDepart()).f, LE_03_10, { rendu: r.service, stockage: fauxStockage, suiviMs: 1 }));
    expect(b.captures).toBe(0);
    expect(await depots().elements.compter((e) => !!e.sourceSite)).toBe(0);
    expect(await depots().pagesSite.obtenir(idPage(`${S}/fr`))).toMatchObject({ erreur: "Images non faites : nouvel essai demain." });
  });
});

describe("migration 21 et écran", () => {
  it("pages clés suivies au départ ; rejouable sans effet ; rien supprimé", async () => {
    reinitialiserDepots();
    const quand = LE_03_10.toISOString();
    expect(await etape21SourceAxion(depots(), quand)).toEqual({ pagesSuivies: PAGES_DEPART.map((p) => p.url.replace(S, "")) });
    expect(await etape21SourceAxion(depots(), quand)).toBeNull();
    expect(await depots().pagesSite.compter()).toBe(PAGES_DEPART.length);
    const r = await migrerDonnees(depots());
    expect(r.lots?.["source-axion"]).toBeUndefined(); // déjà fait
  });

  it("vue « Votre site » : interrupteur allumé par défaut, pages suivies dans l'ordre, totaux", async () => {
    await site.lireLeSite(dep(fauxWeb(siteDeDepart()).f));
    const v = await site.lireVueSite();
    expect(v.actif).toBe(true);
    expect(v.pages.map((p) => p.chemin)).toEqual(["/fr", "/fr/formations", "/fr/audit", "/fr/implementation", "/fr/tarifs", "/fr/faq", "/fr/a-propos"]);
    expect(v.totaux).toMatchObject({ matieres: 1, aRelire: 1, images: 0 });
    expect(v.derniereLecture).toBe(LE_03_10.toISOString());
  });
});
