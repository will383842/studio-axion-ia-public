/**
 * Composants d'écran des carrousels (lot D) : présentation pure, rendue en HTML statique.
 * Fichier en .test.ts (createElement) car la configuration de vitest ne collecte que `*.test.ts`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { BarreValidation } from "@/components/visuels/BarreValidation";
import { CarteCarrousel } from "@/components/visuels/CarteCarrousel";
import { FormulaireNouveauCarrousel } from "@/components/visuels/FormulaireNouveauCarrousel";
import { ListeCarrousels } from "@/components/visuels/ListeCarrousels";
import { OngletsCarrousels } from "@/components/visuels/OngletsCarrousels";
import { RangeePages } from "@/components/visuels/RangeePages";
import { Voyants } from "@/components/visuels/Voyants";
import { TAILLE_MAX_DEPOT_OCTETS, urlSure, verifierDepotTexte } from "@/domaine/visuels/depot";
import type { ActionCarrousel, RapportPorte, VueCarrouselCarte } from "@/domaine/visuels/contrats";
import { LIBELLES_STATUT } from "@/domaine/visuels/statuts";

const carte = (p: Partial<VueCarrouselCarte> = {}): VueCarrouselCarte => ({
  id: "vis_1",
  titre: "Cinq erreurs de lancement",
  statut: "a_valider",
  libelleStatut: LIBELLES_STATUT.a_valider,
  nbPages: 5,
  modifieLe: "2026-10-01T10:00:00.000Z",
  ...p,
});
const action = async () => {};
const toutes: ActionCarrousel[] = ["valider", "refuser", "refaire", "relancer_rendu", "corbeille", "restaurer"];
const actions = Object.fromEntries(toutes.map((a) => [a, action])) as Record<ActionCarrousel, typeof action>;

describe("CarteCarrousel / ListeCarrousels", () => {
  it("affiche le titre et le libellé du statut", () => {
    const html = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte() }));
    expect(html).toContain("Cinq erreurs de lancement");
    expect(html).toContain("À valider");
  });
  it("en corbeille : « Supprimée dans N jours »", () => {
    const html = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte({ joursRestantsCorbeille: 12 }) }));
    expect(html).toContain("Supprimé dans 12 jours");
    expect(renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte({ joursRestantsCorbeille: 1 }) }))).toContain("Supprimé dans 1 jour");
    expect(renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte() }))).not.toContain("Supprimé");
  });
  it("à zéro jour ou moins : « Supprimé aujourd'hui »", () => {
    for (const j of [0, -1]) {
      const html = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte({ joursRestantsCorbeille: j }) }));
      expect(html).toContain("Supprimé aujourd&#x27;hui");
      expect(html).not.toContain("dans");
    }
  });
  it("le lien encode l'identifiant ; la vignette est décorative et l'adresse douteuse écartée", () => {
    const html = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte({ id: "a/b c", vignetteUrl: "/v.png" }) }));
    expect(html).toContain('href="/carrousels/a%2Fb%20c"');
    expect(html).toContain('alt=""');
    const mauvais = renderToStaticMarkup(createElement(CarteCarrousel, { carrousel: carte({ vignetteUrl: "javascript:alert(1)" }) }));
    expect(mauvais).not.toContain("<img");
  });
  it("la liste montre chaque carte, ou un état vide", () => {
    const html = renderToStaticMarkup(createElement(ListeCarrousels, { carrousels: [carte(), carte({ id: "vis_2", titre: "Autre sujet" })] }));
    expect(html).toContain("Cinq erreurs de lancement");
    expect(html).toContain("Autre sujet");
    expect(renderToStaticMarkup(createElement(ListeCarrousels, { carrousels: [] }))).toContain("Aucun carrousel");
  });
});

describe("BarreValidation", () => {
  it("n'affiche QUE les actions permises", () => {
    const html = renderToStaticMarkup(createElement(BarreValidation, { id: "vis_1", actionsPermises: ["valider", "corbeille"], actions }));
    expect(html).toContain("Valider");
    expect(html).toContain("Corbeille");
    for (const absent of ["Refuser", "Refaire", "Relancer le rendu", "Restaurer"]) expect(html).not.toContain(absent);
  });
  it("Refuser propose un motif et un commentaire", () => {
    const html = renderToStaticMarkup(createElement(BarreValidation, { id: "vis_1", actionsPermises: ["refuser"], actions }));
    expect(html).toContain('name="motif"');
    expect(html).toContain('name="commentaire"');
    expect(html).toContain('name="id"');
  });
  it("aucune action permise : rien d'affiché", () => {
    expect(renderToStaticMarkup(createElement(BarreValidation, { id: "vis_1", actionsPermises: [], actions }))).toBe("");
  });
  it("sans pdfUrl : pas de lien de téléchargement ; avec : un lien", () => {
    const sans = renderToStaticMarkup(createElement(BarreValidation, { id: "vis_1", actionsPermises: ["valider"], actions }));
    expect(sans).not.toContain("download");
    expect(sans).not.toContain("Télécharger");
    const avec = renderToStaticMarkup(createElement(BarreValidation, { id: "vis_1", actionsPermises: ["valider"], actions, pdfUrl: "/f/x.pdf" }));
    expect(avec).toContain('href="/f/x.pdf"');
    expect(avec).toContain("Télécharger le PDF");
  });
  it("un pdfUrl dangereux ne donne aucun lien", () => {
    for (const pdfUrl of ["javascript:alert(1)", "//evil.example/x.pdf", "http://x/y.pdf", "data:text/html,x"]) {
      const html = renderToStaticMarkup(createElement(BarreValidation, { id: "vis_1", actionsPermises: ["valider"], actions, pdfUrl }));
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("Télécharger");
    }
  });
});

describe("Voyants", () => {
  const rapport: RapportPorte = {
    version: "porte-carrousel/1",
    verdict: "rouge",
    controles: [
      { code: "CHIFFRE", niveau: "rouge", phrase: "Un chiffre n'a pas de source.", page: 3 },
      { code: "LONG", niveau: "orange", phrase: "Le titre est un peu long." },
    ],
    corrections: [],
  };
  it("affiche les phrases et la page concernée", () => {
    const html = renderToStaticMarkup(createElement(Voyants, { rapport }));
    expect(html).toContain("Un chiffre n&#x27;a pas de source.");
    expect(html).toContain("Le titre est un peu long.");
    expect(html).toContain("page 3");
  });
  it("n'ajoute pas « (page N) » quand la phrase commence déjà par « Page N »", () => {
    const r: RapportPorte = { ...rapport, controles: [{ code: "CHIFFRE", niveau: "rouge", phrase: "Page 3 : un chiffre n'a pas de source.", page: 3 }] };
    const html = renderToStaticMarkup(createElement(Voyants, { rapport: r }));
    expect(html).toContain("Page 3 : un chiffre");
    expect(html).not.toContain("(page 3)");
  });
  it("vert : une phrase rassurante", () => {
    const html = renderToStaticMarkup(createElement(Voyants, { rapport: { version: "porte-carrousel/1", verdict: "vert", controles: [], corrections: [] } }));
    expect(html).toContain("Tout est en ordre");
  });
});

describe("RangeePages", () => {
  // Base d'affichage : le service de rendu numérote à partir de 0 (index), on montre index + 1 ;
  // la porte (ControlePorte.page) est déjà en base 1 (« Page 3 ») et s'affiche telle quelle.
  it("affiche N images avec alt, à taille de téléphone (index 0 → « Page 1 »)", () => {
    const html = renderToStaticMarkup(
      createElement(RangeePages, { titre: "Mon carrousel", pages: [0, 1, 2].map((i) => ({ index: i, type: "contenu", urlX1: `/p/${i}.png` })) }),
    );
    expect(html).toContain('alt="Page 1 : Mon carrousel"');
    expect(html).not.toContain("Page 0");
    expect(html.match(/<img /g)).toHaveLength(3);
    expect(html).toContain('alt="Page 2 : Mon carrousel"');
    expect(html).toContain("w-[270px]");
    expect(html).toContain("aspect-[4/5]");
    expect(html).toContain("overflow-x-auto");
  });
  it("la légende « Page N » est masquée aux lecteurs d'écran", () => {
    const html = renderToStaticMarkup(createElement(RangeePages, { titre: "T", pages: [{ index: 0, type: "couverture", urlX1: "/p/0.png" }] }));
    expect(html).toMatch(/<p aria-hidden="true"[^>]*>Page 1<\/p>/);
  });
  it("une adresse de page douteuse n'est pas affichée", () => {
    const html = renderToStaticMarkup(createElement(RangeePages, { titre: "T", pages: [{ index: 0, type: "couverture", urlX1: "javascript:alert(1)" }] }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript");
    expect(html).toContain("Page 1");
  });
  it("une page sans image affiche un emplacement, pas d'<img>", () => {
    const html = renderToStaticMarkup(createElement(RangeePages, { titre: "T", pages: [{ index: 0, type: "couverture" }] }));
    expect(html).not.toContain("<img");
    expect(html).toContain("Page 1 : T (pas encore rendue)");
  });
});

describe("FormulaireNouveauCarrousel", () => {
  const html = renderToStaticMarkup(createElement(FormulaireNouveauCarrousel, { creer: action }));
  it("deux onglets actifs et trois entrées « bientôt »", () => {
    expect(html).toContain("Un sujet");
    expect(html).toContain("Déposer un texte écrit en session");
    expect((html.match(/bientôt/gi) ?? []).length).toBe(3);
  });
  it("motif d'onglets ARIA retiré : deux boutons aria-pressed dans un fieldset « Comment démarrer »", () => {
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain("Comment démarrer");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('role="tab');
  });
  it("le sélecteur de fichier accepte .json et application/json", () => {
    expect(html).toContain('accept=".json,application/json"');
  });
  it("la lecture d'un texte déposé : JSON valide accepté, vide refusé, trop long refusé", () => {
    expect(verifierDepotTexte('{"pages":[]}').ok).toBe(true);
    expect(verifierDepotTexte("").ok).toBe(false);
  });
  it("le dépôt refuse plus de 64 Ko", () => {
    expect(TAILLE_MAX_DEPOT_OCTETS).toBe(65536);
    expect(verifierDepotTexte("a".repeat(65536)).ok).toBe(true);
    const r = verifierDepotTexte("a".repeat(65537));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain("64 Ko");
    // 32 769 caractères de 2 octets = 65 538 octets : l'octet compte, pas le caractère.
    expect(verifierDepotTexte("é".repeat(32769)).ok).toBe(false);
    expect(verifierDepotTexte("   ").ok).toBe(false);
  });
});

describe("BandeauGenerateurEteint / OngletsCarrousels", () => {
  it("le bandeau donne une phrase et le lien vers les réglages", () => {
    const html = renderToStaticMarkup(createElement(BandeauGenerateurEteint));
    expect(html).toContain('href="/reglages/carrousels"');
    expect(html).toContain("éteint");
  });
  it("quatre onglets", () => {
    const html = renderToStaticMarkup(createElement(OngletsCarrousels, { actif: "a_valider" }));
    for (const l of ["Tous", "À valider", "Validés", "Corbeille"]) expect(html).toContain(l);
    expect(html).toContain('aria-current="page"');
  });
});

describe("urlSure", () => {
  it("accepte un chemin du site ou https, refuse le reste", () => {
    expect(urlSure("/f/x.pdf")).toBe("/f/x.pdf");
    expect(urlSure("https://cdn.example/x.png")).toBe("https://cdn.example/x.png");
    for (const u of ["javascript:alert(1)", "//evil.example/x", "/\\evil.example/x.pdf", "/\t/evil.example", "/\n/evil.example", "/\u007f/x", "https://a\tb.example/x", "http://x/y", "data:text/html,x", "", "x.png", undefined]) expect(urlSure(u)).toBeUndefined();
  });
});
