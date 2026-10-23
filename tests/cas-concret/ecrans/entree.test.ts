/**
 * U1 : l'écran « Cas concret MD » (rendu statique des composants du dossier `entree`, qui n'importent pas `remotion`).
 * Libellés du plan § 7, classement de la case, feuille « Votre vidéo », vocabulaire de l'écran.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/cas-concret", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ confirmerCasAction: vi.fn(), estimerCasAction: vi.fn(), preparerEtLancerAction: vi.fn() }));

import { CarteCas } from "../../../src/components/formats/cas-concret/entree/CarteCas";
import { CasAValider } from "../../../src/components/formats/cas-concret/entree/CasAValider";
import { CaseDuCas } from "../../../src/components/formats/cas-concret/entree/CaseDuCas";
import { EntreeCasConcret } from "../../../src/components/formats/cas-concret/entree/EntreeCasConcret";
import { ContenuVotreVideo, PiedVotreVideo } from "../../../src/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { PastillesOffres } from "../../../src/components/formats/cas-concret/entree/PastillesOffres";
import { classerCas, versVueCas, type VueCas } from "../../../src/components/formats/cas-concret/entree/vue";
import { empreinteCas } from "../../../src/formats/cas-concret/cas";
import { CATALOGUE } from "../../../src/formats/cas-concret/catalogue";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const vues: VueCas[] = CATALOGUE.map((c, i) => versVueCas(c, empreinteCas(c), i < 3));
const valides = vues.filter((v) => v.valide);
const aValider = vues.filter((v) => !v.valide);
const parId = (id: string) => vues.find((v) => v.id === id)!;

function sansMotTechnique(t: string) {
  expect(t).not.toMatch(/\b[a-z]+(-[a-z]+)+\b.*cas-/); // aucun identifiant de cas
  for (const v of vues) expect(t).not.toContain(v.id);
  expect(t).not.toMatch(/\b(?!IA\b|MD\b|CRM\b)[A-Z]{2,}\b/);
  expect(t).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu);
  expect(t).not.toMatch(/villeexemple|machine|aucun gain garanti/i);
  expect(t).not.toMatch(/undefined|null|NaN/);
}

describe("classement de la case", () => {
  it("« Fais la vidéo sur le compte rendu de rendez-vous » classe compte-rendu-dicte en premier", () => {
    const r = classerCas("Fais la vidéo sur le compte rendu de rendez-vous", vues);
    expect(r[0].id).toBe("compte-rendu-dicte");
  });

  it("« rappel » trouve le cas dont une étape est un rappel, et masque les cas sans rappel", () => {
    const ids = classerCas("rappel", vues).map((v) => v.id);
    expect(ids).toContain("rappels-rendez-vous");
    expect(ids).not.toContain("audit-une-journee");
  });

  it("les cartes sans mot commun sont masquées ; phrase vide : tout, dans l'ordre", () => {
    const r = classerCas("compte rendu", vues);
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThan(vues.length);
    expect(classerCas("   ", vues).map((v) => v.id)).toEqual(vues.map((v) => v.id));
    expect(classerCas("zzzzzz", vues)).toEqual([]);
  });
});

describe("page", () => {
  it("l'en-tête, la case, les pastilles, les cartes et « À valider (n) »", () => {
    const html = renderToStaticMarkup(createElement(EntreeCasConcret, { valides, aValider, montants: {} }));
    const t = texte(html);
    expect(t).toContain("Quel cas voulez-vous montrer ?");
    for (const o of ["Tous", "Formation", "Audit", "Intégration"]) expect(t).toContain(o);
    const pastilles = texte(renderToStaticMarkup(createElement(PastillesOffres, { valeur: "tous", onChange: () => undefined, cas: valides })));
    expect(pastilles).not.toContain("Automatisation");
    expect(pastilles).not.toContain("Coaching");
    for (const v of valides) expect(t).toContain(v.titre);
    expect(t).toContain(`À valider (${aValider.length})`);
    expect(t).toContain("Je valide ce cas");
    expect(t).toContain("Fabriquer un essai");
    sansMotTechnique(t);
  });

  it("aucune carte : la phrase du plan ; aucun cas validé : « Validez un premier cas. »", () => {
    expect(texte(renderToStaticMarkup(createElement(EntreeCasConcret, { valides: [], aValider, montants: {} })))).toContain("Validez un premier cas.");
    expect(texte(renderToStaticMarkup(createElement(EntreeCasConcret, { valides: [], aValider: [], montants: {} })))).toContain("Validez un premier cas.");
  });

  it("une carte : titre, promesse, « Chez nous » ou « Notre offre », « Vrais écrans »", () => {
    const chezNous = vues.find((v) => v.posture === "Chez nous" && v.vraisEcrans)!;
    const t = texte(renderToStaticMarkup(createElement(CarteCas, { cas: chezNous, onOuvrir: () => undefined })));
    expect(t).toContain(chezNous.titre);
    expect(t).toContain(chezNous.promesse);
    expect(t).toContain("Chez nous");
    expect(t).toContain("Vrais écrans");
    expect(texte(renderToStaticMarkup(createElement(CarteCas, { cas: vues.find((v) => v.posture === "Notre offre")!, onOuvrir: () => undefined })))).toContain("Notre offre");
  });

  it("la case et les pastilles", () => {
    expect(texte(renderToStaticMarkup(createElement(CaseDuCas, { valeur: "", onChange: () => undefined, onEntree: () => undefined })))).toContain("Quel cas voulez-vous montrer ?");
    expect(renderToStaticMarkup(createElement(PastillesOffres, { valeur: "tous", onChange: () => undefined }))).toContain('aria-checked="true"');
  });

  it("« À valider » montre la promesse et les faits avec leur source en clair", () => {
    const cas = aValider.find((v) => v.faits.length)!;
    const t = texte(renderToStaticMarkup(createElement(CasAValider, { cas: [cas], occupe: false, onValider: () => undefined, onEssai: () => undefined })));
    expect(t).toContain(cas.promesse);
    expect(t).toContain(cas.faits[0].phrase);
    expect(t).toContain(`(${cas.faits[0].source})`);
  });
});

describe("feuille « Votre vidéo »", () => {
  const rendre = (cas: VueCas, essai = false) =>
    texte(
      renderToStaticMarkup(
        createElement("div", null, createElement(ContenuVotreVideo, { cas, essai, reseaux: ["facebook", "instagram"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: true, onAvecMot: () => undefined, onValider: () => undefined }), createElement(PiedVotreVideo, { montant: 60, refus: null, desactive: false, onFabriquer: async () => undefined })),
      ),
    );

  it("liste les étapes, les faits et leur source, les réseaux, le mot, « Avec le mot » et un montant en euros", () => {
    const cas = parId("recrutement-apporteurs");
    const t = rendre(cas);
    for (const e of cas.etapes) expect(t).toContain(e);
    for (const f of cas.faits) expect(t).toContain(f.phrase);
    for (const r of ["Facebook", "Instagram", "TikTok", "LinkedIn"]) expect(t).toContain(r);
    expect(t).toContain("Le mot à commenter");
    expect(t).toContain("Avec le mot");
    expect(t).toMatch(/Fabriquer la vidéo.*0,60\s*€/);
    sansMotTechnique(t);
  });

  it("un cas non validé propose « Je valide ce cas » ; en essai, la mention d'essai", () => {
    const cas = aValider[0];
    expect(rendre(cas)).toContain("Je valide ce cas");
    expect(rendre(cas, true)).toContain("Essai : cas à confirmer par Will, ne pas publier.");
  });
});

describe("aucun réseau coché", () => {
  it("le bas de la feuille dit pourquoi le bouton est inactif, en une phrase", () => {
    const pied = (desactive: boolean) => texte(renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, desactive, onFabriquer: async () => undefined })));
    expect(pied(true)).toContain("Choisissez au moins un réseau.");
    expect(pied(false)).not.toContain("Choisissez au moins un réseau.");
  });

  it("K3 · sans prix d'avance (cas du stock hors des 20) : jamais « 0,00 € », bouton inactif jusqu'au retour de l'estimation", () => {
    const html = renderToStaticMarkup(createElement(PiedVotreVideo, { montant: null, refus: null, desactive: false, onFabriquer: async () => undefined }));
    const t = texte(html);
    expect(t).toContain("Calcul du prix");
    expect(t).not.toMatch(/0,00/);
    expect(html).toMatch(/<button[^>]*disabled/);
    const avecPrix = texte(renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, desactive: false, onFabriquer: async () => undefined })));
    expect(avecPrix).not.toContain("Calcul du prix");
  });

  it("X1 · voix pas prête : la feuille dit quoi faire, avec un lien, AVANT le clic ; le bouton est inactif", () => {
    const lien = "/personnages/p-will?onglet=voix";
    const html = renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, desactive: false, voix: { prete: false, lien }, onFabriquer: async () => undefined }));
    const t = texte(html);
    expect(t).toContain("Votre voix n'est pas prête : ouvrez Personnages, Voix, et vérifiez que votre voix HeyGen est reliée et prête.");
    expect(html).toContain(`href="${lien}"`);
    expect(html).toMatch(/<button[^>]*disabled/);
    const prete = texte(renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, desactive: false, voix: { prete: true, lien }, onFabriquer: async () => undefined })));
    expect(prete).not.toContain("pas prête");
  });
});

describe("garde du dossier", () => {
  it("aucun lien vers /cas-concret n'est ajouté ailleurs, rien n'importe un autre format", () => {
    const dossier = join(__dirname, "../../../src/components/formats/cas-concret/entree");
    for (const f of readdirSync(dossier)) {
      const source = readFileSync(join(dossier, f), "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*(remotion|tableau-anime|publications|buffer)[^"']*["']/);
    }
  });
});
