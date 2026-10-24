/**
 * Voir le récit d'un cas (24/10/2026) : gratuitement, la feuille « Votre vidéo » dit de quoi parle la vidéo, la scène et
 * l'exemple suivi ; les cartes montrent le sujet d'une ligne. Un cas sans récit (catalogue d'origine) ne change pas d'un
 * mot. Rendu statique, aucun appel.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/cas-concret", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ confirmerCasAction: vi.fn(), estimerCasAction: vi.fn(), preparerEtLancerAction: vi.fn(), remettreEnStockAction: vi.fn() }));

import { CarteCas } from "@/components/formats/cas-concret/entree/CarteCas";
import { CasAValider } from "@/components/formats/cas-concret/entree/CasAValider";
import { ContenuVotreVideo, PHRASE_TEXTE_ECRIT_AU_LANCEMENT } from "@/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { versVueCas } from "@/components/formats/cas-concret/entree/vue";
import { StockDesCas } from "@/components/formats/cas-concret/stock/StockDesCas";
import { empreinteCas } from "@/formats/cas-concret/cas";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { construireStockCas } from "@/services/cas-concret-stock";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const avecRecit = CATALOGUE.find((c) => c.id === "transporteur-demandes-de-cotation")!;
const sansRecit = CATALOGUE_TS[0]!;
const vueAvec = versVueCas(avecRecit, empreinteCas(avecRecit), true);
const vueSans = versVueCas(sansRecit, empreinteCas(sansRecit), true);

const feuille = (cas: typeof vueAvec) =>
  renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: true, onAvecMot: () => undefined, onValider: () => undefined } as never));

describe("récit visible", () => {
  it("la vue du cas porte le sujet, la scène et l'exemple, et rien d'autre du récit (pas les mots clés)", () => {
    expect(avecRecit.recit).toBeTruthy();
    expect(vueAvec.recit).toEqual({ sujet: avecRecit.recit!.sujet, scene: avecRecit.recit!.scene, exemple: avecRecit.recit!.exemple });
    expect(JSON.stringify(vueAvec)).not.toContain("motsCles");
    expect("recit" in vueSans).toBe(false);
  });

  it("la feuille d'un cas qui a un récit le montre, avant les étapes, avec la phrase honnête sur le texte exact", () => {
    const t = texte(feuille(vueAvec));
    for (const x of ["De quoi parle la vidéo", avecRecit.recit!.sujet, "La scène", avecRecit.recit!.scene, "L'exemple suivi", avecRecit.recit!.exemple, PHRASE_TEXTE_ECRIT_AU_LANCEMENT]) expect(t).toContain(x);
    expect(t.indexOf("De quoi parle la vidéo")).toBeLessThan(t.indexOf("Les étapes"));
    expect(PHRASE_TEXTE_ECRIT_AU_LANCEMENT).toBe("Le texte exact dit dans la vidéo est écrit au lancement (≈ 0,5 €) puis relu par vous avant la voix.");
  });

  it("la feuille d'un cas sans récit ne change pas : aucun bloc, aucune phrase", () => {
    const t = texte(feuille(vueSans));
    expect(t).not.toContain("De quoi parle la vidéo");
    expect(t).not.toContain("La scène");
    expect(t).not.toContain(PHRASE_TEXTE_ECRIT_AU_LANCEMENT);
    expect(t).toContain("Les étapes");
  });

  it("le script validé, quand il existe, est toujours montré comme avant", () => {
    const script = [{ rang: 1, type: "accroche", nom: "Accroche", texteDit: "Vos demandes de prix arrivent sans le poids.", affiches: ["Demandes sans poids"] }] as never;
    expect(texte(feuille({ ...vueAvec, script }))).toContain("Le script validé, dit mot pour mot");
  });

  it("les cartes montrent le sujet sous le titre quand il existe, et rien sinon", () => {
    const carte = (c: typeof vueAvec) => texte(renderToStaticMarkup(createElement(CarteCas, { cas: c, onOuvrir: () => undefined })));
    const t = carte(vueAvec);
    expect(t).toContain(avecRecit.recit!.sujet);
    expect(t.indexOf(avecRecit.titre)).toBeLessThan(t.indexOf(avecRecit.recit!.sujet));
    expect(carte(vueSans)).not.toContain("arrivent sans");
    const aValider = texte(renderToStaticMarkup(createElement(CasAValider, { cas: [vueAvec], occupe: false, onValider: () => undefined, onEssai: () => undefined })));
    expect(aValider).toContain(avecRecit.recit!.sujet);
  });

  it("le tableau du stock montre le sujet d'une ligne sous le titre", () => {
    const lignes = construireStockCas({ scripts: {}, videos: [], catalogue: [avecRecit, sansRecit] });
    const html = texte(renderToStaticMarkup(createElement(StockDesCas, { lignes, idees: [] })));
    expect(html).toContain(avecRecit.recit!.sujet);
    expect(lignes.find((l) => l.casId === sansRecit.id)).not.toHaveProperty("sujet");
  });
});
