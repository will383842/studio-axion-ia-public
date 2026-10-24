/**
 * Refonte de la page « Cas concret MD » (24/10/2026) : trois onglets (À faire, Déjà faits, Retirés), liens serveur accessibles,
 * une ligne de synthèse, la liste « À faire » complète et paginée, les listes « Déjà faits » et « Retirés ». Rendu statique :
 * les services sont remplacés par des doubles, aucun appel, rien de payé.
 */
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ stock: [] as unknown[], regl: { catalogueEtendu: true, stockMetiers: true } as Record<string, boolean>, traites: new Map<string, unknown>(), retraits: {} as Record<string, unknown>, retires: new Set<string>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ lireSession: async () => ({ ok: true }) }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); }, useRouter: () => ({ push: () => undefined, refresh: () => undefined }), usePathname: () => "/cas-concret", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({
  confirmerCasAction: vi.fn(), confirmerFaitPorteBAction: vi.fn(), controlerScriptValideAction: vi.fn(), demarrerPorteBAction: vi.fn(), estimerCasAction: vi.fn(),
  modifierScriptValideAction: vi.fn(), preparerEtLancerAction: vi.fn(), suivrePorteBAction: vi.fn(), retirerCasAction: vi.fn(), remettreCasAction: vi.fn(), remettreEnStockAction: vi.fn(),
}));
vi.mock("@/services/cas-concret-reglages", () => ({
  REGLAGES_CAS_CONCRET: { catalogueEtendu: "catalogueEtendu", ecranFourni: "ecranFourni", porteB: "porteB", stockMetiers: "stockMetiers" },
  reglageAllume: async (k: string) => etat.regl[k] === true,
}));
vi.mock("@/services/cas-concret-traites", () => ({ lireCasTraites: async () => etat.traites }));
vi.mock("@/services/cas-concret-retires", () => ({ lireCasRetires: async () => etat.retires, lireRetraits: async () => etat.retraits }));
vi.mock("@/services/cas-concret-voix", () => ({ etatVoixCasConcret: async () => ({}), avecConsigneVoix: (x: unknown) => x }));
vi.mock("@/services/cas-concret-mots", () => ({ etatMotsCasConcret: async () => ({}) }));
vi.mock("@/services/cas-concret-scripts-lot", () => ({ CAS_PAR_PAGE: 20, scriptsValidesDe: async () => ({}), preparerPageCas: async () => ({ montants: {}, refus: {} }) }));
vi.mock("@/services/cas-concret-stock-lecture", () => ({ lireStockCas: async () => etat.stock }));
vi.mock("@/services/cas-concret", () => ({
  estimerCas: async () => ({ centimes: 0 }),
  listerCas: async () => {
    const { CATALOGUE_TS } = await import("@/formats/cas-concret/catalogue/base");
    const { empreinteCas } = await import("@/formats/cas-concret/cas");
    const tous = CATALOGUE_TS.map((cas) => ({ cas, empreinte: empreinteCas(cas) }));
    return { valides: tous.slice(0, 3), aValider: tous.slice(3) };
  },
}));

import PageCasConcret from "@/app/(studio)/cas-concret/page";
import { OngletsCasConcret } from "@/components/formats/cas-concret/entree/OngletsCasConcret";
import { lireOnglet, lienOnglet, phraseSyntheseOnglets } from "@/components/formats/cas-concret/entree/onglets";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** Résout les composants serveur ASYNCHRONES de l'arbre (la page en contient un), sans toucher aux composants à crochets. */
async function resoudre(n: ReactNode): Promise<ReactNode> {
  if (Array.isArray(n)) return Promise.all(n.map(resoudre));
  if (!isValidElement(n)) return n;
  const el = n as { type: unknown; props: { children?: ReactNode } & Record<string, unknown>; key: string | null };
  if (typeof el.type === "function" && el.type.constructor.name === "AsyncFunction") return resoudre(await (el.type as (p: unknown) => Promise<ReactNode>)(el.props));
  const enfants = el.props.children === undefined ? undefined : await resoudre(el.props.children);
  return createElement(el.type as never, { ...el.props, key: el.key ?? undefined }, ...(enfants === undefined ? [] : Array.isArray(enfants) ? enfants : [enfants]));
}
const page = async (params: Record<string, string> = {}) => renderToStaticMarkup((await resoudre(await PageCasConcret({ searchParams: Promise.resolve(params) }))) as never);

describe("onglets (pur)", () => {
  it("lit ?onglet= : À faire par défaut, toute valeur inconnue y revient", () => {
    expect(lireOnglet({})).toBe("a-faire");
    expect(lireOnglet(undefined)).toBe("a-faire");
    expect(lireOnglet({ onglet: "deja-faits" })).toBe("deja-faits");
    expect(lireOnglet({ onglet: ["retires", "x"] })).toBe("retires");
    expect(lireOnglet({ onglet: "n-importe-quoi" })).toBe("a-faire");
  });
  it("adresses et phrase de synthèse", () => {
    expect(lienOnglet("a-faire")).toBe("/cas-concret");
    expect(lienOnglet("deja-faits")).toBe("/cas-concret?onglet=deja-faits");
    expect(lienOnglet("retires")).toBe("/cas-concret?onglet=retires");
    expect(phraseSyntheseOnglets({ aFaire: 103, faits: 4, valides: 3 })).toBe("103 cas à faire · 4 déjà faits · 3 validés");
    expect(phraseSyntheseOnglets({ aFaire: 1, faits: 1, valides: 1 })).toBe("1 cas à faire · 1 déjà fait · 1 validé");
  });
});

describe("barre d'onglets", () => {
  const rendre = (actif: "a-faire" | "deja-faits" | "retires") =>
    renderToStaticMarkup(createElement(OngletsCasConcret, { actif, nombres: { "a-faire": 103, "deja-faits": 4, retires: 2 }, synthese: { aFaire: 103, faits: 4, valides: 3 } }));
  it("trois liens dans une navigation nommée, un seul actif (aria-current), aucun faux rôle d'onglet, compteurs et synthèse", () => {
    const h = rendre("deja-faits");
    expect(h).toContain('<nav aria-label="Listes des cas"');
    expect(h).not.toMatch(/role="tab(list|panel)?"/);
    expect(h).not.toContain("aria-selected");
    expect(h).not.toContain("aria-controls");
    expect((h.match(/<a /g) ?? []).length).toBe(3);
    expect((h.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(h).toMatch(/id="onglet-deja-faits"[^>]*aria-current="page"/);
    expect(h).not.toMatch(/id="onglet-a-faire"[^>]*aria-current/);
    expect(h).toContain('href="/cas-concret?onglet=retires"');
    expect(h).toContain('href="/cas-concret"');
    const t = texte(h);
    for (const x of ["À faire (103)", "Déjà faits (4)", "Retirés (2)", "103 cas à faire · 4 déjà faits · 3 validés"]) expect(t).toContain(x);
    expect(h).toContain("min-h-11");
  });
});

describe("la page, onglet par onglet (réglages allumés)", () => {
  it("À faire (par défaut) : la liste complète est visible, plus de zone vide ni de blocs repliés, plus de liens séparés", async () => {
    etat.traites = new Map();
    etat.retraits = {};
    etat.retires = new Set();
    const h = await page();
    const t = texte(h);
    expect(t).toContain(`À faire (${CATALOGUE_TS.length})`);
    expect(t).toContain("Prêts à fabriquer (3)");
    expect(t).toContain(`À valider (${CATALOGUE_TS.length - 3})`);
    expect(t).toContain("Proposez-moi un cas restant");
    expect(t).toContain("Quel cas voulez-vous montrer ?");
    for (const c of CATALOGUE_TS.slice(0, 3)) expect(t).toContain(c.titre);
    expect(t).not.toContain("Validez un premier cas.");
    expect(h).not.toContain("<details");
    expect(t).not.toContain("Stock des cas");
    expect(t).not.toContain("Cas restants à faire");
    expect(h).toMatch(/<section id="panneau-cas" aria-labelledby="onglet-a-faire"/);
    expect(h).not.toContain('role="tabpanel"');
    expect(t).toContain(`${CATALOGUE_TS.length} cas à faire · 0 déjà fait · 3 validés`);
  });

  it("Déjà faits : la liste avec « Voir la vidéo » et « Remettre en stock »", async () => {
    const cas = CATALOGUE_TS[0]!;
    etat.traites = new Map([[cas.id, { videoId: "v-1", titre: cas.titre, le: "2026-10-10T10:00:00.000Z" }]]);
    const t = texte(await page({ onglet: "deja-faits" }));
    expect(t).toContain("Déjà faits (1)");
    expect(t).toContain("1 cas fait");
    expect(t).toContain(cas.titre);
    expect(t).toContain("Voir la vidéo");
    expect(t).toContain("Remettre en stock");
    expect(t).not.toContain("Proposez-moi un cas restant");
    etat.traites = new Map();
  });

  it("Retirés : la liste avec « Remettre ce cas »", async () => {
    const cas = CATALOGUE_TS[1]!;
    etat.retraits = { [cas.id]: { retireLe: "2026-10-24T10:00:00.000Z", titre: cas.titre } };
    etat.retires = new Set([cas.id]);
    const t = texte(await page({ onglet: "retires" }));
    expect(t).toContain("Retirés (1)");
    expect(t).toContain(cas.titre);
    expect(t).toContain("Retiré le 24/10/2026");
    expect(t).toContain("Remettre ce cas");
    // Le cas retiré n'est plus dans « À faire ».
    const aFaire = texte(await page());
    expect(aFaire).toContain(`À faire (${CATALOGUE_TS.length - 1})`);
    etat.retraits = {};
    etat.retires = new Set();
  });

  it("réglages éteints : la page reste correcte (la liste est ce qui est visible aujourd'hui)", async () => {
    etat.regl = { catalogueEtendu: false, stockMetiers: false };
    const t = texte(await page());
    expect(t).toContain("Prêts à fabriquer");
    expect(t).not.toContain("Secteur");
    expect(t).toContain("À faire (");
    etat.regl = { catalogueEtendu: true, stockMetiers: true };
  });
});

describe("pagination et filtres de l'onglet À faire", () => {
  it("plus de 20 cas à valider : exactement 20 cartes par page, « Page 1 sur 3 », le total dans le titre", async () => {
    const { EntreeCasConcret } = await import("@/components/formats/cas-concret/entree/EntreeCasConcret");
    const { versVueCas } = await import("@/components/formats/cas-concret/entree/vue");
    const { empreinteCas } = await import("@/formats/cas-concret/cas");
    const modele = CATALOGUE_TS[5]!;
    const cas = Array.from({ length: 45 }, (_, i) => versVueCas({ ...modele, id: `cas-pagination-${i}`, titre: `Cas numéro ${i}` }, empreinteCas(modele), false));
    const h = renderToStaticMarkup(createElement(EntreeCasConcret, { valides: [], aValider: cas, montants: {} }));
    expect((h.match(/Je valide ce cas/g) ?? []).length).toBe(20);
    const t = texte(h);
    expect(t).toContain("À valider (45)");
    expect(t).toContain("Page 1 sur 3");
    expect(t).toContain("Page suivante");
    expect(t).not.toContain("Page précédente");
    expect(h).toContain("Ouvrir l&#x27;essai : Cas numéro 0");
  });

  const ligne = (cas: (typeof CATALOGUE_TS)[number], plus: Record<string, unknown> = {}) => ({ casId: cas.id, titre: cas.titre, offre: cas.offre, posture: cas.posture, script: { valide: false }, videos: { total: 0, faites: 0, comptees: 0, parEtat: {} }, faits: { total: 0, avecPreuve: 0, aSignaler: [] }, rangement: { fiche: "IN-01", secteur: "IN", taille: "PME" }, ...plus });

  it("réglages allumés et cas rangés : filtres Secteur et Taille et pastilles sur les cartes ; éteints : rien de tout cela", async () => {
    etat.regl = { catalogueEtendu: true, stockMetiers: true };
    etat.stock = CATALOGUE_TS.map((c) => ligne(c));
    const allume = await page();
    expect(texte(allume)).toContain("Secteur");
    expect(texte(allume)).toContain("Taille");
    expect(texte(allume)).toContain("Industrie");
    expect(allume).toContain("Filtres du stock");
    etat.regl = { catalogueEtendu: true, stockMetiers: false };
    const eteintHtml = await page();
    const eteint = texte(eteintHtml);
    expect(eteintHtml).not.toContain("Filtres du stock");
    expect(eteint).not.toContain("Secteur");
    expect(eteint).not.toContain("Industrie");
    etat.regl = { catalogueEtendu: true, stockMetiers: true };
    etat.stock = [];
  });

  it("une ancienne adresse avec ?etat= ou ?offre= ne bloque pas la liste (seuls secteur et taille sont repris)", async () => {
    etat.stock = CATALOGUE_TS.map((c) => ligne(c));
    const t = texte(await page({ etat: "traite", offre: "integration", secteur: "IN" }));
    expect(t).toContain(`À faire (${CATALOGUE_TS.length})`);
    expect(t).toContain("Prêts à fabriquer (3)");
    expect(t).not.toContain("Aucun cas pour ces filtres.");
    etat.stock = [];
  });
});
