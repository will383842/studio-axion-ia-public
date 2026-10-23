/**
 * BRIQUE 3 · ÉCRANS DU CAS CONCRET SUR L'ÉCRAN COMMUN « RELIRE LE SCRIPT » (rendu statique, aucun réseau).
 *
 * - Fiche vidéo : le script à valider s'affiche dans `RelireScript` (même comportement : valider, modifier, faire
 *   réécrire ; le chiffre tiré d'un fait reste verrouillé) ; l'arrêt pour validation est une ÉTAPE « À relire », pas un
 *   échec (ni rouge, ni « Reprendre cette étape »).
 * - Feuille « Votre vidéo » : un cas qui a un script validé passe par la relecture avant le lancement.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/videos/v", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({
  confirmerCasAction: vi.fn(),
  estimerCasAction: vi.fn(),
  preparerEtLancerAction: vi.fn(),
  validerScriptAction: vi.fn(),
  controlerScriptAValiderAction: vi.fn(),
  controlerScriptValideAction: vi.fn(),
  modifierScriptValideAction: vi.fn(),
}));

import { RelireScript } from "../../../src/components/script/RelireScript";
import { ProgressionEtapes } from "../../../src/components/ui/ProgressionEtapes";
import { ContenuVotreVideo, PiedVotreVideo } from "../../../src/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { RelireAvantLancement } from "../../../src/components/formats/cas-concret/entree/RelireAvantLancement";
import { versVueCas } from "../../../src/components/formats/cas-concret/entree/vue";
import { CODE_A_RELIRE, etapeARelire } from "../../../src/components/formats/cas-concret/fiche-video/a-relire";
import { ValidationScript } from "../../../src/components/formats/cas-concret/fiche-video/ValidationScript";
import type { EtapeTravail } from "../../../src/domaine/types";
import { empreinteCas } from "../../../src/formats/cas-concret/cas";
import { trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { lignesDesEcrans } from "../../../src/moteurs/montage-cas-concret/relecture";
import { apercuDesEcrans, CODE_SCRIPT_A_VALIDER, PHRASE_SCRIPT_A_VALIDER, scriptValideDuCatalogue } from "../../../src/moteurs/montage-cas-concret/script-valide";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const cas = trouverCas("recrutement-apporteurs")!;
const apercu = apercuDesEcrans(scriptValideDuCatalogue(cas.id)!.ecrans);
const rien = async () => [];
const ok = async () => ({ ok: true as const });

describe("fiche vidéo : le script à valider sur l'écran commun", () => {
  const html = renderToStaticMarkup(createElement(ValidationScript, { videoId: "v", travailId: "t", ecrans: apercu }));
  const t = texte(html);

  it("une carte par écran (toucher pour modifier), groupée par type, bouton « Valider ce script » sans prix", () => {
    expect(html).toContain('aria-label="Relire le script"');
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)).toHaveLength(apercu.length);
    expect(t).toContain("Accroche");
    expect(t).toContain("Valider ce script");
    expect(t).not.toContain("Lancer la vidéo");
    expect(t).not.toMatch(/≈ \d+,\d+ €/);
  });

  it("à comportement égal : aucune voix avant validation, « Faire réécrire » reste", () => {
    expect(t).toContain("Aucune voix n'est payée tant que vous n'avez pas validé ce script.");
    expect(t).toContain("Faire réécrire");
  });

  it("le chiffre tiré d'un fait (« 15 minutes ») est verrouillé dans les lignes", () => {
    const l = lignesDesEcrans(apercu)[1];
    expect(l.ecrits?.[0]).toEqual({ texte: "15 minutes", modifiable: false });
  });
});

describe("l'arrêt pour validation est une étape « À relire », pas un échec", () => {
  const erreur = { code: CODE_SCRIPT_A_VALIDER, reessayable: true, messagePourWill: PHRASE_SCRIPT_A_VALIDER };
  const etapes = [
    { cle: "ecriture", nom: "L'écriture", icone: "ecrire", statut: "terminee", progression: 100 },
    { cle: "fiche", nom: "La relecture", icone: "oeil", statut: "echec", progression: 0, erreur },
    { cle: "voix", nom: "La voix", icone: "micro", statut: "en_attente", progression: 0 },
  ] as unknown as EtapeTravail[];

  it("le code recopié côté écran est celui du moteur", () => expect(CODE_A_RELIRE).toBe(CODE_SCRIPT_A_VALIDER));

  it("etapeARelire : la clé de l'étape arrêtée pour validation ; rien pour un vrai échec", () => {
    expect(etapeARelire({ statut: "echec", erreur, etapes })).toBe("fiche");
    expect(etapeARelire({ statut: "echec", erreur: { ...erreur, code: "CAS_CONCRET_ECHEC" }, etapes: etapes.map((e) => (e.erreur ? { ...e, erreur: { ...erreur, code: "CAS_CONCRET_ECHEC" } } : e)) })).toBeNull();
    expect(etapeARelire({ statut: "en_cours", etapes })).toBeNull();
  });

  it("rendu : « À relire », ni fond rouge, ni « Reprendre cette étape », ni message d'échec", () => {
    const html = renderToStaticMarkup(createElement(ProgressionEtapes, { etapes, progression: 30, aRelire: "fiche", suivi: { resteMin: 0 }, onReessayer: () => undefined }));
    expect(texte(html)).not.toContain("encore");
    expect(texte(html)).toContain("À relire");
    expect(html).not.toContain("bg-brique");
    expect(html).not.toContain("text-brique");
    expect(texte(html)).not.toContain("Reprendre cette étape");
    expect(texte(html)).not.toContain("à reprendre");
  });

  it("sans `aRelire`, un échec reste un échec", () => {
    const html = renderToStaticMarkup(createElement(ProgressionEtapes, { etapes, progression: 30, onReessayer: () => undefined }));
    expect(html).toContain("bg-brique");
    expect(texte(html)).toContain("Reprendre cette étape");
  });
});

describe("feuille « Votre vidéo » : un script validé se relit avant le lancement", () => {
  const vue = versVueCas(cas, empreinteCas(cas), true, apercu);

  it("le pied propose « Relire le script » au lieu de lancer directement", () => {
    const t = texte(renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, desactive: false, onFabriquer: async () => undefined, onRelire: () => undefined })));
    expect(t).toContain("Relire le script");
    expect(t).not.toContain("Fabriquer la vidéo");
  });

  it("sans script validé : le bouton « Fabriquer la vidéo » reste", () => {
    const t = texte(renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, desactive: false, onFabriquer: async () => undefined })));
    expect(t).toContain("Fabriquer la vidéo");
  });

  it("le contenu annonce la relecture du script validé", () => {
    const t = texte(renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: vue, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: "IA", onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined })));
    expect(t).toContain("Le script validé, dit mot pour mot");
    expect(t).toContain("Vous le relirez, et pourrez le modifier, avant le lancement.");
  });

  it("l'écran de relecture : le script du cas sur l'écran commun, avec le prix et un retour", () => {
    const html = renderToStaticMarkup(createElement(RelireAvantLancement, { cas: vue, montant: 94, controler: rien, lancer: ok, onRetour: () => undefined }));
    const t = texte(html);
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)).toHaveLength(apercu.length);
    expect(t).toContain("Lancer la vidéo (≈ 0,94 €)");
    expect(t).toContain("Retour");
    expect(t).toContain("Nos collaborateurs, on les recrute en");
  });
});

describe("écran commun : sans prix, un libellé propre au geste", () => {
  it("prix absent : aucun montant sur le bouton ; libellé selon le nombre de phrases modifiées", () => {
    const lignes = lignesDesEcrans(apercu);
    const t = texte(renderToStaticMarkup(createElement(RelireScript, { lignes, controler: rien, lancer: ok, libelleLancer: (n: number) => (n ? "Valider le script modifié" : "Valider ce script") })));
    expect(t).toContain("Valider ce script");
    expect(t).not.toContain("€");
  });
});
