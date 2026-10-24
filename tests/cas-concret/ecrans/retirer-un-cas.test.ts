/**
 * « Retirer ce cas » (24/10/2026) : le bouton sur la feuille « Votre vidéo » et sur « À valider » (jamais sur la carte, jamais en
 * porte B), les listes sans les cas retirés, la page « Cas retirés », les actions. Rendu statique : aucun appel, rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ retirer: vi.fn(), remettre: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/cas-concret", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/cas-concret-retires", () => ({ retirerCas: etat.retirer, remettreCas: etat.remettre }));
vi.mock("@/services/cas-concret-traites", () => ({ remettreEnStock: vi.fn() }));
vi.mock("@/services/cas-concret", () => ({ confirmerCas: vi.fn(), estimerCas: vi.fn(), preparerEtLancer: vi.fn() }));
vi.mock("@/services/cas-concret-stock-acces", () => ({ trouverCasAutorise: vi.fn() }));
vi.mock("@/services/cas-concret-voix", () => ({ avecConsigneVoix: vi.fn() }));
vi.mock("@/services/cas-concret-porte-b", () => ({ confirmerFaitPorteB: vi.fn(), demarrerPorteB: vi.fn(), suivrePorteB: vi.fn() }));
vi.mock("@/services/cas-concret-scripts", () => ({ controlerScriptAValiderCasConcret: vi.fn(), controlerScriptValideCasConcret: vi.fn(), modifierScriptValideCasConcret: vi.fn(), validerScriptCasConcret: vi.fn() }));

import { retirerCasAction, remettreCasAction } from "@/app/(studio)/cas-concret/actions";
import { casProposables } from "@/components/formats/cas-concret/entree/proposables";
import { CarteCas } from "@/components/formats/cas-concret/entree/CarteCas";
import { CasAValider } from "@/components/formats/cas-concret/entree/CasAValider";
import { ContenuVotreVideo } from "@/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { versVueCas } from "@/components/formats/cas-concret/entree/vue";
import { listerCasRetires } from "@/components/formats/cas-concret/stock/cas-retires";
import { listerDejaFaits } from "@/components/formats/cas-concret/stock/deja-faits";
import { ListeCasRetires } from "@/components/formats/cas-concret/stock/ListeCasRetires";
import { empreinteCas } from "@/formats/cas-concret/cas";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const [A, B] = CATALOGUE_TS as [(typeof CATALOGUE_TS)[number], (typeof CATALOGUE_TS)[number]];
const vue = versVueCas(A, empreinteCas(A), true);
const feuille = (plus: Record<string, unknown> = {}, cas = vue) =>
  renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: true, onAvecMot: () => undefined, onValider: () => undefined, ...plus } as never));

beforeEach(() => {
  etat.retirer.mockReset();
  etat.remettre.mockReset();
});

describe("listes sans les cas retirés", () => {
  it("casProposables écarte les traités et les retirés, garde l'ordre", () => {
    const liste = [{ cas: { id: "a" } }, { cas: { id: "b" } }, { cas: { id: "c" } }, { cas: { id: "d" } }];
    expect(casProposables(liste, new Set(["a"]), new Set(["c"])).map((x) => x.cas.id)).toEqual(["b", "d"]);
    expect(casProposables(liste, new Map(), new Set()).length).toBe(4);
  });

  it("listerDejaFaits n'affiche pas un cas retiré", () => {
    const traites = new Map([[A.id, { titre: A.titre, le: "2026-10-10T10:00:00.000Z" }], [B.id, { titre: B.titre, le: "2026-10-11T10:00:00.000Z" }]]);
    expect(listerDejaFaits(traites as never).map((c) => c.casId)).toEqual([B.id, A.id]);
    expect(listerDejaFaits(traites as never, { catalogueEtendu: false }, new Set([B.id])).map((c) => c.casId)).toEqual([A.id]);
  });

  it("listerCasRetires : seulement les retirés, le plus récent d'abord, titre du catalogue, un cas disparu reste listé sans bouton", () => {
    const lignes = listerCasRetires({
      [A.id]: { retireLe: "2026-10-24T10:00:00.000Z", titre: A.titre },
      [B.id]: { retireLe: "2026-10-24T12:00:00.000Z", titre: B.titre },
      "cas-disparu": { retireLe: "2026-10-23T12:00:00.000Z", titre: "Ancien cas" },
      remis: { retireLe: "2026-10-24T10:00:00.000Z", remisLe: "2026-10-24T11:00:00.000Z", titre: "Remis" },
    });
    expect(lignes.map((l) => l.casId)).toEqual([B.id, A.id, "cas-disparu"]);
    expect(lignes[0]).toMatchObject({ titre: B.titre, auCatalogue: true, date: "24/10/2026" });
    expect(lignes[2]).toMatchObject({ titre: "Ancien cas", auCatalogue: false });
  });
});

describe("page « Cas retirés »", () => {
  it("liste avec « Remettre ce cas », vide propre, cas disparu sans bouton", () => {
    const lignes = listerCasRetires({ [A.id]: { retireLe: "2026-10-24T10:00:00.000Z", titre: A.titre }, "cas-disparu": { retireLe: "2026-10-23T10:00:00.000Z", titre: "Ancien cas" } });
    const t = texte(renderToStaticMarkup(createElement(ListeCasRetires, { cas: lignes })));
    expect(t).toContain("2 cas retirés");
    expect(t).toContain(`Retiré le 24/10/2026`);
    expect(t).toContain("Remettre ce cas");
    expect(t).toContain("Ce cas n'existe plus dans le catalogue.");
    expect(texte(renderToStaticMarkup(createElement(ListeCasRetires, { cas: [] })))).toContain("Aucun cas retiré pour l'instant.");
    expect(renderToStaticMarkup(createElement(ListeCasRetires, { cas: lignes }))).toContain(`aria-label="Remettre ce cas : ${A.titre.replace(/'/g, "&#x27;")}"`);
  });
});

describe("bouton « Retirer ce cas »", () => {
  it("sur la feuille « Votre vidéo » quand elle sait le retirer ; absent sinon ; jamais en porte B", () => {
    expect(texte(feuille({ onRetire: () => undefined }))).toContain("Retirer ce cas");
    expect(texte(feuille())).not.toContain("Retirer ce cas");
    const porteB = { ...vue, porteB: { videoId: "v", aConfirmer: [] } };
    expect(texte(feuille({ onRetire: () => undefined }, porteB as never))).not.toContain("Retirer ce cas");
  });

  it("dans « À valider », dans la rangée des boutons ; jamais dans la carte (un bouton dans un bouton)", () => {
    const aValider = versVueCas(B, empreinteCas(B), false);
    const t = texte(renderToStaticMarkup(createElement(CasAValider, { cas: [aValider], occupe: false, onValider: () => undefined, onEssai: () => undefined })));
    expect(t).toContain("Retirer ce cas");
    expect(t.indexOf("Fabriquer un essai")).toBeLessThan(t.indexOf("Retirer ce cas"));
    expect(texte(renderToStaticMarkup(createElement(CarteCas, { cas: vue, onOuvrir: () => undefined })))).not.toContain("Retirer ce cas");
  });

  it("le bouton est désactivé pendant qu'une action est en cours (occupe)", () => {
    const html = (occupe: boolean) => renderToStaticMarkup(createElement(CasAValider, { cas: [versVueCas(B, empreinteCas(B), false)], occupe, onValider: () => undefined, onEssai: () => undefined }));
    const bouton = (h: string) => h.match(/<button[^>]*aria-label="Retirer ce cas[^"]*"[^>]*>/)![0];
    expect(bouton(html(true))).toContain('disabled=""');
    expect(bouton(html(false))).not.toContain('disabled=""');
  });

  it("le bouton porte un nom accessible qui dit quel cas", () => {
    const html = renderToStaticMarkup(createElement(CasAValider, { cas: [versVueCas(B, empreinteCas(B), false)], occupe: false, onValider: () => undefined, onEssai: () => undefined }));
    expect(html).toContain(`aria-label="Retirer ce cas : ${B.titre.replace(/'/g, "&#x27;")}"`);
  });
});

describe("actions", () => {
  it("retirerCasAction appelle le service UNE fois avec l'identifiant nettoyé ; un identifiant vide est refusé sans appel", async () => {
    etat.retirer.mockResolvedValue({ retireLe: "2026-10-24T10:00:00.000Z" });
    const r = await retirerCasAction(`  ${A.id} `);
    expect(r).toMatchObject({ ok: true });
    expect(etat.retirer).toHaveBeenCalledTimes(1);
    expect(etat.retirer).toHaveBeenCalledWith(A.id);
    const vide = await retirerCasAction("   ");
    expect(vide.ok).toBe(false);
    expect(etat.retirer).toHaveBeenCalledTimes(1);
  });

  it("remettreCasAction : service appelé une fois ; un refus du service est rendu en phrase", async () => {
    etat.remettre.mockRejectedValueOnce(Object.assign(new Error("Ce cas n'est pas retiré."), { code: "CAS_INCONNU" }));
    const r = await remettreCasAction(A.id);
    expect(r.ok).toBe(false);
    expect(etat.remettre).toHaveBeenCalledTimes(1);
  });
});
