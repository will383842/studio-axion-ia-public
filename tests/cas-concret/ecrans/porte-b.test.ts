/**
 * P2S, lot A, point 1 · l'écran de la porte B (rendu statique) : la case propose « Faire la vidéo de ce cas », la feuille
 * d'un cas né de la porte B montre la mention « Exemple, pas un cas réel », l'offre déduite parmi les quatre, ses chiffres
 * avec leur origine et « Ce qui manque » ; un chiffre « à confirmer » se confirme ou se retire, et bloque le bouton avec
 * la phrase de `refusAvantPrix`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/cas-concret", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({}));

import { CaseDuCas } from "../../../src/components/formats/cas-concret/entree/CaseDuCas";
import { ContenuVotreVideo, PiedVotreVideo } from "../../../src/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { LONGUEUR_CASE, MENTION_EXEMPLE, porteBProposee, versVueCasPorteB } from "../../../src/components/formats/cas-concret/entree/vue";
import { empreinteCas, verifierCas } from "../../../src/formats/cas-concret/cas";
import { PHRASES_AVANT_PRIX } from "../../../src/moteurs/montage-cas-concret/avant-prix";
import { brouillonParGabarit, casDuBrouillon } from "../../../src/moteurs/montage-cas-concret/description";
import { DESCRIPTION_CARACTERES_MAX, faitsAConfirmer } from "../../../src/moteurs/montage-cas-concret/honnetete";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const EQUIPE = "Une équipe de dix personnes qui veut apprendre à se servir de l'IA pour répondre à ses e-mails.";

function casDe(description: string) {
  const v = verifierCas(casDuBrouillon(brouillonParGabarit(description), description));
  if (!v.ok) throw new Error(v.raisons.join(" ; "));
  return v.cas;
}

const contenu = (vue: ReturnType<typeof versVueCasPorteB>) =>
  renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: vue, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: vue.mot, onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined, onFait: () => undefined }));

describe("porte B : la case", () => {
  it("« Faire la vidéo de ce cas » dès deux mots utiles ; la case reçoit une description entière", () => {
    expect(porteBProposee("")).toBe(false);
    expect(porteBProposee("devis")).toBe(false);
    expect(porteBProposee("montre comment on relance les devis")).toBe(true);
    expect(LONGUEUR_CASE).toBe(DESCRIPTION_CARACTERES_MAX);
  });

  it("réglage éteint : la case garde la longueur de master (160) ; allumé, une description entière (relecture Opus de #445)", () => {
    const caseDe = (porteB?: boolean) => renderToStaticMarkup(createElement(CaseDuCas, { valeur: "", onChange: () => undefined, onEntree: () => undefined, ...(porteB !== undefined ? { porteB } : {}) }));
    expect(caseDe()).toContain('maxLength="160"');
    expect(caseDe(false)).toContain('maxLength="160"');
    expect(caseDe(true)).toContain(`maxLength="${LONGUEUR_CASE}"`);
  });
});

describe("porte B : la feuille « Votre vidéo »", () => {
  const cas = casDe(EQUIPE);
  const aConfirmer = faitsAConfirmer(cas, EQUIPE).map((f) => ({ id: f.id, enonce: f.enonce }));
  const vue = versVueCasPorteB(cas, empreinteCas(cas), "v-b", aConfirmer);

  it("la mention « Exemple, pas un cas réel » et l'offre déduite parmi les quatre", () => {
    const html = contenu(vue);
    expect(texte(html)).toContain(MENTION_EXEMPLE);
    for (const o of ["Formation", "Audit", "Intégration", "Coaching"]) expect(texte(html)).toContain(o);
    expect(html).toMatch(/<li aria-current="true">[^]*?Formation/);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("les étapes, les chiffres avec leur origine, le chiffre « à confirmer » avec « Confirmer » et « Retirer », et ce qui manque", () => {
    const t = texte(contenu(vue));
    for (const e of vue.etapes) expect(t).toContain(e);
    expect(t).toContain("10 personnes");
    expect(t).toContain("(d'après vous)");
    expect(t).toContain("à confirmer");
    expect(t).toMatch(/Confirmer .*Retirer/);
    expect(t).toContain("Ce qui manque Un chiffre à confirmer : confirmez-le ou retirez-le.");
    expect(t).not.toContain("Je valide ce cas");
  });

  it("rien à confirmer : « Ce qui manque » le dit, aucun bouton « Confirmer »", () => {
    const t = texte(contenu({ ...vue, porteB: { videoId: "v-b", aConfirmer: [] } }));
    expect(t).toContain("Ce qui manque Rien : chaque chiffre vient de votre texte.");
    expect(t).not.toMatch(/Confirmer|Retirer/);
  });

  it("le bas de la feuille dit la phrase de `refusAvantPrix` et le bouton est inactif", () => {
    const html = renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, blocage: PHRASES_AVANT_PRIX.aConfirmer, desactive: false, voix: { prete: true, lien: "/personnages" }, onFabriquer: async () => undefined }));
    expect(texte(html)).toContain(PHRASES_AVANT_PRIX.aConfirmer);
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});
