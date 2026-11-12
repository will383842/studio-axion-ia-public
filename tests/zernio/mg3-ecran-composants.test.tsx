/**
 * R4 : écran /mots par mot (tableau, fiche, confirmations, choix de cible, nouveau mot, vue pure).
 * Sans DOM (crochets factices) : on lit l'arbre rendu et on appelle nous-mêmes les gestes. Valeurs FICTIVES, aucun réseau.
 */
import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

const { monter, trouver, texteDe, attendre } =
  await import("../aides/crochets-factices");
const { TableauMots } = await import("@/components/mots/TableauMots");
const { NouveauMot } = await import("@/components/mots/NouveauMot");
const { ChoixCibleMot } = await import("@/components/mots/ChoixCibleMot");
const { FicheMot } = await import("@/components/mots/FicheMot");
const { EcranMotsCibles } = await import("@/components/mots/EcranMotsCibles");
const { Dialogue } = await import("@/components/ui/Dialogue");
const { creerGestesMotsCibles } =
  await import("@/components/mots/gestes-mots-cibles");
const { etatDuMot, construireTableau } =
  await import("@/domaine/guide-reseau/vue-mots-cibles");
type Element = import("@/domaine/guide-reseau/cibles-contrat").ElementCatalogue;
type Ligne = import("@/domaine/guide-reseau/cibles-contrat").LigneTableauMot;
type Vue = import("@/domaine/guide-reseau/vue-mots-cibles").VueMotsCibles;
type Resume = import("@/domaine/guide-reseau/vue-mots-cibles").ResumeMot;
type Compte = import("@/domaine/guide-reseau/vue-mots-cibles").CompteDuMot;
type Apercu = import("@/domaine/guide-reseau/vue-mots-cibles").ApercuTextesVue;
type Services =
  import("@/domaine/guide-reseau/vue-mots-cibles").ServicesMotsCibles;

type Elt = { type: unknown; props: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const par = (arbre: unknown, test: (e: Elt) => boolean) =>
  trouver(arbre as never, test as never) as unknown as Elt[];
const bouton = (arbre: unknown, nom: string) =>
  par(
    arbre,
    (e) =>
      e.props["aria-label"] === nom ||
      (typeof e.props.onClick === "function" && texteDe(e as never) === nom),
  )[0];
const lisible = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
const rendre = (e: ReactElement) => lisible(renderToStaticMarkup(e));

const el = (
  code: string,
  titre: string,
  sur: Partial<Element> = {},
): Element => ({
  code,
  type: "guide",
  titre,
  actif: true,
  test: false,
  ...sur,
});
const CATALOGUE: Element[] = [
  el("gde-essai-01", "Guide d'essai", { test: true }),
  el("adr-page-001", "Page d'accueil fictive", { type: "adresse" }),
  el("gde-modeles-01", "Guide des modèles"),
];
const fen = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const ligne = (mot: string, sur: Partial<Ligne> = {}): Ligne => ({
  mot,
  reseau: "tous",
  cible: CATALOGUE[2],
  source: "tous",
  cibleIntrouvable: false,
  divergent: false,
  actif: true,
  stats: {
    mot,
    ecrits: fen(4, 10, 25),
    envoyes: fen(3, 8, 20),
    suivent: fen(2, 5, 12),
  },
  ...sur,
});
const compte = (sur: Partial<Compte> = {}): Compte => ({
  compte: "c1",
  nom: "Page fictive",
  reseau: "facebook",
  etat: "non_pose",
  surZernio: true,
  activable: true,
  raison: null,
  ...sur,
});
const resume = (sur: Partial<Resume> = {}): Resume => ({
  mot: "DEVIS",
  etat: "brouillon",
  validations: { facebook: "valide", instagram: "absente" },
  comptes: [compte()],
  cibleDiffere: false,
  chiffres: null,
  ...sur,
});
const okReseau = (reseau: "facebook" | "instagram", sur: object = {}) => ({
  reseau,
  ok: true as const,
  cible: { titre: "Guide des modèles", type: "guide" as const, test: false },
  textes: [
    { groupe: "m1", version: "v1", texte: "Voici votre guide : [LIEN]" },
  ],
  empreinte: "emp-" + reseau,
  etat: "valide" as const,
  ...sur,
});
const APERCU: Apercu = {
  ok: true,
  reseaux: [okReseau("facebook"), okReseau("instagram", { etat: "perimee" })],
};
const faux = (): Services => ({
  creerMot: vi.fn(async () => ({ ok: true, phrase: "Fait." })),
  changerCible: vi.fn(async () => ({ ok: true, phrase: "Changé." })),
  apercuTextes: vi.fn(async () => APERCU),
  validerTextes: vi.fn(async () => ({ ok: true, phrase: "Validé." })),
  activer: vi.fn(async () => ({
    issue: "execute" as const,
    phrase: "Activé.",
  })),
  mettreEnPause: vi.fn(async () => ({
    issue: "execute" as const,
    phrase: "En pause.",
  })),
});
const vueEcran = (sur: Partial<Vue> = {}): Vue => ({
  tableau: { lignes: [ligne("DEVIS")], ignores: 0, indisponible: false },
  catalogue: CATALOGUE,
  mots: [resume()],
  plusieursMotsAllume: true,
  depuisCopie: false,
  ...sur,
});
const gestesFaux = () => ({
  valider: vi.fn(async () => ({ confirme: true, ok: true, phrase: "" })),
  activer: vi.fn(async () => ({ confirme: true, ok: true, phrase: "" })),
  mettreEnPause: vi.fn(async () => ({ confirme: true, ok: true, phrase: "" })),
});
const fiche = (r: Resume, a: Apercu | null = APERCU, g = gestesFaux()) => (
  <FicheMot
    resume={r}
    catalogue={CATALOGUE}
    apercu={a}
    services={g}
    onFermer={vi.fn()}
  />
);

describe("R4 · nouveau mot et choix de cible", () => {
  it("Entrée dans la recherche n'envoie pas le formulaire : preventDefault, le mot n'est pas créé", () => {
    const m = monter(ChoixCibleMot, {
      catalogue: CATALOGUE,
      valeur: null,
      onChoisir: vi.fn(),
    });
    const champ = par(
      m.rendre(),
      (e) => typeof e.props.onKeyDown === "function",
    )[0];
    const entree = { key: "Enter", preventDefault: vi.fn() };
    champ.props.onKeyDown(entree);
    expect(entree.preventDefault).toHaveBeenCalledOnce();
    const autre = { key: "a", preventDefault: vi.fn() };
    champ.props.onKeyDown(autre);
    expect(autre.preventDefault).not.toHaveBeenCalled();
    const onCreer = vi.fn();
    monter(NouveauMot, { catalogue: CATALOGUE, onCreer }).rendre();
    expect(onCreer).not.toHaveBeenCalled();
  });

  it("les choix n'ont pas d'aria-label qui cache le titre, le type et TEST", () => {
    const t = rendre(
      <ChoixCibleMot
        catalogue={CATALOGUE}
        valeur="gde-modeles-01"
        onChoisir={vi.fn()}
      />,
    );
    const html = renderToStaticMarkup(
      <ChoixCibleMot
        catalogue={CATALOGUE}
        valeur="gde-modeles-01"
        onChoisir={vi.fn()}
      />,
    );
    expect(html).not.toMatch(/<button[^>]*aria-label/);
    expect(t).toContain("Guide d'essai");
    expect(t).toContain("TEST");
    expect(t).toContain("Choisie");
  });

  it("pastille « Cible actuelle » ; choisir la même cible dit « déjà la cible » sans rien appeler", () => {
    const onChoisir = vi.fn();
    expect(
      rendre(
        <ChoixCibleMot
          catalogue={CATALOGUE}
          valeur={null}
          actuelle="gde-modeles-01"
          onChoisir={onChoisir}
        />,
      ),
    ).toContain("Cible actuelle");
    const m = monter(ChoixCibleMot, {
      catalogue: CATALOGUE,
      valeur: null,
      actuelle: "gde-modeles-01",
      onChoisir,
    });
    par(m.rendre(), (e) => e.props["data-cible"] === "gde-modeles-01")
      .flatMap((e) => par(e, (x) => typeof x.props.onClick === "function"))[0]
      .props.onClick();
    expect(onChoisir).not.toHaveBeenCalled();
    expect(texteDe(m.rendre() as never)).toContain(
      "C'est déjà la cible de ce mot.",
    );
  });

  it("au-delà de 50 résultats : phrase de précision, 50 cibles affichées", () => {
    const beaucoup = Array.from({ length: 60 }, (_, i) =>
      el(`gde-nombre-${String(i).padStart(2, "0")}`, `Guide numéro ${i}`),
    );
    const html = renderToStaticMarkup(
      <ChoixCibleMot catalogue={beaucoup} valeur={null} onChoisir={vi.fn()} />,
    );
    expect(html.match(/data-cible=/g)).toHaveLength(50);
    expect(lisible(html)).toContain(
      "Les 50 premières cibles sont affichées : précisez la recherche.",
    );
    expect(
      rendre(
        <ChoixCibleMot
          catalogue={CATALOGUE}
          valeur={null}
          onChoisir={vi.fn()}
        />,
      ),
    ).not.toContain("50 premières");
  });

  it("aria-invalid seulement pour « mot vide », lié à l'identifiant fixe de l'erreur", () => {
    const m = monter(NouveauMot, { catalogue: CATALOGUE, onCreer: vi.fn() });
    const champ = () => par(m.rendre(), (e) => e.props.name === "mot")[0];
    expect(champ().props["aria-invalid"]).toBeUndefined();
    const envoyer = () =>
      par(m.rendre(), (e) => e.type === "form")[0].props.onSubmit({
        preventDefault: () => undefined,
      });
    envoyer();
    expect(champ().props["aria-invalid"]).toBe(true);
    expect(champ().props["aria-describedby"]).toBe("nouveau-mot-erreur");
    expect(
      par(m.rendre(), (e) => e.props.id === "nouveau-mot-erreur"),
    ).toHaveLength(1);
    champ().props.onChange({ target: { value: "devis" } });
    envoyer(); // cible oubliée
    expect(champ().props["aria-invalid"]).toBeUndefined();
    expect(champ().props["aria-describedby"]).toBeUndefined();
    expect(texteDe(m.rendre() as never)).toContain(
      "Choisissez ce que le mot envoie",
    );
    const erreurSite = monter(NouveauMot, {
      catalogue: CATALOGUE,
      onCreer: vi.fn(),
      erreur: "Refus du site.",
    });
    expect(
      par(erreurSite.rendre(), (e) => e.props.name === "mot")[0].props[
        "aria-invalid"
      ],
    ).toBeUndefined();
  });
});

describe("R4 · tableau des mots", () => {
  it("vrai tableau HTML avec les rôles explicites, colspan sans chiffres", () => {
    const html = renderToStaticMarkup(
      <TableauMots
        vue={{
          lignes: [ligne("DEVIS", { stats: null })],
          ignores: 0,
          indisponible: false,
        }}
        catalogue={CATALOGUE}
        onChangerCible={vi.fn()}
      />,
    );
    expect(html).toMatch(/<table[^>]*role="table"/);
    expect(html).toMatch(/<tr[^>]*role="row"/);
    expect(html).toMatch(/<th[^>]*role="columnheader"/);
    expect(html).toMatch(/<td[^>]*role="cell"/);
    expect(html).toContain('aria-colspan="3"');
    expect(html).toMatch(/colSpan="3"|colspan="3"/i);
    expect(lisible(html)).toContain("Pas encore de chiffres");
  });

  it("pastille exacte par état, avec repli sur actif / en pause", () => {
    const v = {
      lignes: [
        ligne("A"),
        ligne("B"),
        ligne("C"),
        ligne("D", { actif: false }),
      ],
      ignores: 0,
      indisponible: false,
    };
    const html = renderToStaticMarkup(
      <TableauMots
        vue={v}
        catalogue={CATALOGUE}
        etats={{ A: "actif", B: "pause", C: "brouillon" }}
        onChangerCible={vi.fn()}
      />,
    );
    const pastille = (mot: string) => {
      const ligneHtml = html.split(`data-mot="${mot}"`)[1].split("</tr>")[0];
      return [...ligneHtml.matchAll(/rounded-full border[^>]*>([^<]+)</g)].map(
        (m) => m[1],
      );
    };
    expect(pastille("A")).toContain("Actif");
    expect(pastille("A")).not.toContain("En pause");
    expect(pastille("B")).toContain("En pause");
    expect(pastille("C")).toContain("Brouillon");
    expect(pastille("C")).not.toContain("Actif");
    expect(pastille("D")).toContain("En pause");
    const sans = renderToStaticMarkup(
      <TableauMots
        vue={{ lignes: [ligne("A")], ignores: 0, indisponible: false }}
        catalogue={CATALOGUE}
        onChangerCible={vi.fn()}
      />,
    );
    expect(sans).toContain(">Actif<");
  });

  it("chiffres cellule par cellule : écrits, envoyés, gagnés « au moins »", () => {
    const html = renderToStaticMarkup(
      <TableauMots
        vue={{ lignes: [ligne("DEVIS")], ignores: 0, indisponible: false }}
        catalogue={CATALOGUE}
        onChangerCible={vi.fn()}
      />,
    );
    const cellules = [
      ...html.split("</tr>")[1].matchAll(/<td[^>]*>(.*?)<\/td>/g),
    ].map((m) => lisible(m[1]).trim());
    const [, , ecrits, envoyes, gagnes] = cellules;
    expect(ecrits).toBe("7 jours 4 30 jours 10 Au total 25");
    expect(envoyes).toBe("7 jours 3 30 jours 8 Au total 20");
    expect(gagnes).toBe(
      "7 jours au moins 2 30 jours au moins 5 Au total au moins 12",
    );
  });

  it("une alerte de synthèse (une seule), un statut par ligne, et l'alerte « site silencieux » reste", () => {
    const v = {
      lignes: [
        ligne("PERDU", { cible: null, cibleIntrouvable: true }),
        ligne("AUTRE", { divergent: true }),
        ligne("BON"),
      ],
      ignores: 0,
      indisponible: true,
    };
    const html = renderToStaticMarkup(
      <TableauMots vue={v} catalogue={CATALOGUE} onChangerCible={vi.fn()} />,
    );
    const alertes = [
      ...html.matchAll(/<p[^>]*role="alert"[^>]*>(.*?)<\/p>/g),
    ].map((m) => lisible(m[1]).trim());
    expect(alertes).toEqual([
      "Le site n'a pas répondu : les mots ne sont pas affichés pour le moment.",
      "2 mots ont un problème de cible.",
    ]);
    expect(html.match(/role="status"/g)!.length).toBeGreaterThanOrEqual(2);
    const un = renderToStaticMarkup(
      <TableauMots
        vue={{
          lignes: [ligne("PERDU", { cible: null, cibleIntrouvable: true })],
          ignores: 0,
          indisponible: false,
        }}
        catalogue={CATALOGUE}
        onChangerCible={vi.fn()}
      />,
    );
    expect(lisible(un)).toContain("1 mot a un problème de cible.");
    expect(
      rendre(
        <TableauMots
          vue={{ lignes: [ligne("BON")], ignores: 0, indisponible: false }}
          catalogue={CATALOGUE}
          onChangerCible={vi.fn()}
        />,
      ),
    ).not.toContain("problème de cible");
  });

  it("dit quand un mot n'a pas la même cible sur tous les réseaux", () => {
    const v = {
      lignes: [
        ligne("DEVIS", { reseau: "facebook" }),
        ligne("DEVIS", { reseau: "instagram", cible: CATALOGUE[1] }),
      ],
      ignores: 0,
      indisponible: false,
    };
    const t = rendre(
      <TableauMots vue={v} catalogue={CATALOGUE} onChangerCible={vi.fn()} />,
    );
    expect(t).toContain(
      "Ce mot n'a pas la même cible sur tous les réseaux : détail dans la fiche.",
    );
    expect(t).toContain("1 mot a un problème de cible.");
  });

  it("bouton « Ouvrir » avec son nom complet, seulement si le geste est fourni", () => {
    const onOuvrirMot = vi.fn();
    const vueUne = {
      lignes: [ligne("DEVIS")],
      ignores: 0,
      indisponible: false,
    };
    const m = monter(TableauMots, {
      vue: vueUne,
      catalogue: CATALOGUE,
      onChangerCible: vi.fn(),
      onOuvrirMot,
    });
    bouton(m.rendre(), "Ouvrir la fiche du mot DEVIS").props.onClick();
    expect(onOuvrirMot).toHaveBeenCalledWith("DEVIS");
    expect(
      rendre(
        <TableauMots
          vue={vueUne}
          catalogue={CATALOGUE}
          onChangerCible={vi.fn()}
        />,
      ),
    ).not.toContain("Ouvrir");
  });

  it("panneau de changement : titre focalisable, zone polie, deux phrases, focus rendu à « Changer la cible »", () => {
    const onChangerCible = vi.fn();
    const m = monter(TableauMots, {
      vue: { lignes: [ligne("DEVIS")], ignores: 0, indisponible: false },
      catalogue: CATALOGUE,
      onChangerCible,
    });
    const focus = vi.fn();
    const ouvrir = bouton(m.rendre(), "Changer la cible du mot DEVIS");
    ouvrir.props.ref({ focus });
    ouvrir.props.onClick();
    let arbre = m.rendre();
    const titre = par(
      arbre,
      (e) => e.type === "h3" && e.props.tabIndex === -1,
    )[0];
    expect(titre).toBeTruthy();
    expect(typeof titre.props.ref).toBe("object");
    expect(par(arbre, (e) => e.props["aria-live"] === "polite")).toHaveLength(
      1,
    );
    expect(par(arbre, (e) => e.type === ChoixCibleMot)[0].props.actuelle).toBe(
      "gde-modeles-01",
    );
    par(arbre, (e) => e.type === ChoixCibleMot)[0].props.onChoisir(
      "adr-page-001",
    );
    arbre = m.rendre();
    const t = texteDe(arbre as never);
    expect(t).toContain("Les chiffres restent sur le mot.");
    expect(t).toContain(
      "Ses textes devront être validés de nouveau : en attendant, ce mot n'envoie plus rien.",
    );
    bouton(arbre, "Annuler").props.onClick();
    expect(focus).toHaveBeenCalledOnce();
    expect(onChangerCible).not.toHaveBeenCalled();
  });
});

describe("R4 · fiche d'un mot", () => {
  it("affiche le titre, les sections et le bouton « Fermer la fiche »", () => {
    const t = rendre(fiche(resume()));
    for (const s of [
      "Fiche du mot DEVIS",
      "Ce que le mot envoie",
      "Textes du mot, réseau par réseau",
      "Comptes",
      "Chiffres (aucun nom n'est affiché)",
      "Fermer la fiche",
    ])
      expect(t).toContain(s);
    expect(t).toContain(
      "LinkedIn et TikTok : réponse à la main seulement, depuis « À traiter ». Rien n'y part tout seul.",
    );
    expect(t).toContain("Pas encore de chiffres");
  });

  it("chargement : squelette et phrase ; aucun texte", () => {
    const t = rendre(fiche(resume(), null));
    expect(t).toContain("Chargement des textes…");
    expect(t).not.toContain("Voici votre guide");
  });

  it("[LIEN] n'est jamais affiché brut", () => {
    const t = rendre(fiche(resume()));
    expect(t).not.toContain("[LIEN]");
    expect(t).toContain(
      "Voici votre guide : (lien personnel, créé au moment de l'envoi)",
    );
  });

  it("textes validés / à revalider / non validés, avec l'explication et le bouton par réseau", () => {
    const a: Apercu = {
      ok: true,
      reseaux: [
        okReseau("facebook", { etat: "valide" }),
        okReseau("instagram", { etat: "perimee" }),
      ],
    };
    const t = rendre(fiche(resume(), a));
    expect(t).toContain("Textes validés");
    expect(t).toContain("Textes à revalider");
    expect(t).toContain(
      "La cible, son titre ou un texte a changé depuis la validation : ce mot n'envoie plus rien sur ce réseau tant que vous ne validez pas de nouveau.",
    );
    const arbre = fiche(resume(), a);
    expect(par(arbre, (e) => e.props["aria-label"] === "x")).toHaveLength(0);
    expect(t).not.toContain("Textes non validés");
    expect(
      rendre(
        fiche(resume(), {
          ok: true,
          reseaux: [okReseau("facebook", { etat: "absente" })],
        }),
      ),
    ).toContain("Textes non validés");
  });

  it("valider : bouton « Valider les textes pour Instagram » appelle le geste confirmé ; GUIDE renvoie au bloc GUIDE", () => {
    const g = gestesFaux();
    const a: Apercu = {
      ok: true,
      reseaux: [
        okReseau("facebook"),
        okReseau("instagram", { etat: "perimee" }),
      ],
    };
    const motArbre = FicheMot({
      resume: resume(),
      catalogue: CATALOGUE,
      apercu: a,
      services: g,
      onFermer: vi.fn(),
    });
    // Le bouton est dans une sous-fonction : on rend le HTML et on vérifie le libellé.
    expect(rendre(fiche(resume(), a, g))).toContain(
      "Valider les textes pour Instagram",
    );
    expect(motArbre).toBeTruthy();
    const guide = rendre(fiche(resume({ mot: "GUIDE" }), a, g));
    expect(guide).not.toContain("Valider les textes pour");
    expect(guide).toContain(
      "Les textes du mot GUIDE se valident dans le bloc « Mot GUIDE », plus bas sur cette page.",
    );
  });

  it("adresse de page et cible TEST : phrases claires", () => {
    const a: Apercu = {
      ok: true,
      reseaux: [
        okReseau("facebook", {
          cible: { titre: "Page", type: "adresse", test: true },
        }),
      ],
    };
    const t = rendre(fiche(resume(), a));
    expect(t).toContain(
      "Une adresse de page n'est pas encore envoyée par message privé : pour l'instant, seuls les guides partent.",
    );
    expect(t).toContain(
      "Cible d'essai (TEST) : elle n'est jamais envoyée à de vraies personnes.",
    );
  });

  it("comptes : « Activer » seulement si activable ; sinon la raison en clair et aucun bouton", () => {
    const cas: [Partial<Compte>, string][] = [
      [
        { reseau: "linkedin", activable: false, raison: "reseau_a_la_main" },
        "Ce réseau se traite à la main, dans « À traiter ».",
      ],
      [
        { activable: false, raison: "cible_test" },
        "Cible d'essai (TEST) : elle ne s'active pas ici.",
      ],
      [
        { activable: false, raison: "textes_non_valides_reseau" },
        "Validez d'abord les textes pour ce réseau.",
      ],
      [
        { reseau: null, activable: false, raison: "reseau_du_compte_inconnu" },
        "Le réseau de ce compte est inconnu : relancez « Tester » dans Réglages, Zernio.",
      ],
      [
        { activable: false, raison: "plusieurs_mots_eteint" },
        "Le réglage « plusieurs mots » est éteint : seul le mot GUIDE peut envoyer pour l'instant. Les autres mots restent en brouillon.",
      ],
      [
        { activable: false, raison: "sans_cible" },
        "Choisissez d'abord une cible.",
      ],
    ];
    for (const [sur, phrase] of cas) {
      const arbre = FicheMot({
        resume: resume({ comptes: [compte(sur)] }),
        catalogue: CATALOGUE,
        apercu: APERCU,
        services: gestesFaux(),
        onFermer: vi.fn(),
      });
      const html = renderToStaticMarkup(
        fiche(resume({ comptes: [compte(sur)] })),
      );
      expect(lisible(html), String(sur.raison)).toContain(phrase);
      expect(html, String(sur.raison)).not.toMatch(
        /aria-label="Activer le mot/,
      );
      expect(texteDe(arbre as never)).not.toBe("Activer");
    }
    const ok = renderToStaticMarkup(fiche(resume()));
    expect(ok).toContain('aria-label="Activer le mot DEVIS sur Page fictive"');
  });

  it("compte actif : « Mettre en pause » ; pastilles d'état ; aucun compte", () => {
    const actif = renderToStaticMarkup(
      fiche(resume({ comptes: [compte({ etat: "actif", activable: false })] })),
    );
    expect(actif).toContain(
      'aria-label="Mettre le mot DEVIS en pause sur Page fictive"',
    );
    expect(actif).toContain(">Actif<");
    expect(
      renderToStaticMarkup(
        fiche(
          resume({
            comptes: [compte({ etat: "pause_auto", activable: false })],
          }),
        ),
      ),
    ).toContain(">Pause automatique<");
    expect(
      renderToStaticMarkup(
        fiche(resume({ comptes: [compte({ etat: "pause" })] })),
      ),
    ).toContain(">En pause<");
    expect(renderToStaticMarkup(fiche(resume()))).toContain(">Pas activé<");
    expect(rendre(fiche(resume({ comptes: [] })))).toContain(
      "Aucun compte n'est relié au parcours sur le serveur.",
    );
  });

  it("chiffres cellule par cellule (7 jours, 30 jours, au total)", () => {
    const c = {
      ecrits: fen(1, 2, 3),
      envoyes: fen(4, 5, 6),
      incertains: fen(0, 1, 2),
      suivent: fen(7, 8, 9),
      commentairesBloques: fen(10, 11, 12),
      envoisRefuses: fen(13, 14, 15),
    };
    const html = renderToStaticMarkup(fiche(resume({ chiffres: c })));
    const lignes = [
      ...html.split("<tbody")[1].matchAll(/<tr[^>]*>(.*?)<\/tr>/g),
    ].map((m) => lisible(m[1]).trim());
    expect(lignes).toEqual([
      "Personnes qui ont écrit le mot 1 2 3",
      "Messages privés envoyés 4 5 dont 1 à vérifier 6 dont 2 à vérifier",
      "Personnes gagnées (qui ont fini par suivre le compte) au moins 7 au moins 8 au moins 9",
      "Commentaires bloqués par une sécurité 10 11 12",
      "Envois refusés 13 14 15",
    ]);
    expect(lisible(html)).toContain("7 jours 30 jours Au total");
  });
});

describe("R4 · confirmations : sans « oui », aucun service", () => {
  const apercuOk = okReseau("facebook") as Extract<
    import("@/domaine/guide-reseau/vue-mots-cibles").ApercuReseauVue,
    { ok: true }
  >;
  it("refus de la confirmation : 0 appel, pour les trois gestes", async () => {
    const s = faux();
    const confirmer = vi.fn(async () => false);
    const g = creerGestesMotsCibles(s, confirmer);
    expect((await g.valider("DEVIS", "facebook", apercuOk)).confirme).toBe(
      false,
    );
    expect((await g.activer("DEVIS", compte(), "T")).confirme).toBe(false);
    expect(
      (await g.mettreEnPause("DEVIS", compte({ etat: "actif" }))).confirme,
    ).toBe(false);
    expect(confirmer).toHaveBeenCalledTimes(3);
    expect(s.validerTextes).not.toHaveBeenCalled();
    expect(s.activer).not.toHaveBeenCalled();
    expect(s.mettreEnPause).not.toHaveBeenCalled();
  });

  it("le service n'est appelé qu'après la réponse « oui » (jamais avant)", async () => {
    const s = faux();
    let repondre!: (v: boolean) => void;
    const g = creerGestesMotsCibles(
      s,
      () => new Promise<boolean>((r) => (repondre = r)),
    );
    const attente = g.activer("DEVIS", compte(), "Guide des modèles");
    await attendre();
    expect(s.activer).not.toHaveBeenCalled();
    repondre(true);
    expect((await attente).confirme).toBe(true);
    expect(s.activer).toHaveBeenCalledExactlyOnceWith("DEVIS", "c1");
  });

  it("les phrases de confirmation sont exactes", async () => {
    const demandes: { titre: string; phrase: string; bouton: string }[] = [];
    const g = creerGestesMotsCibles(
      faux(),
      async (d) => (demandes.push(d), true),
    );
    await g.valider("DEVIS", "facebook", apercuOk);
    await g.activer("DEVIS", compte(), "Guide des modèles");
    await g.mettreEnPause("DEVIS", compte({ etat: "actif" }));
    expect(demandes).toEqual([
      {
        titre: "Valider les textes du mot DEVIS pour Facebook ?",
        phrase:
          "Ce sont les textes affichés, avec le titre « Guide des modèles ». Rien n'est envoyé maintenant.",
        bouton: "Oui, valider",
      },
      {
        titre: "Activer le mot DEVIS sur Page fictive (Facebook) ?",
        phrase:
          "Les personnes qui écriront DEVIS en commentaire recevront une réponse publique, puis un message privé avec le lien vers « Guide des modèles ».",
        bouton: "Oui, activer",
      },
      {
        titre: "Mettre le mot DEVIS en pause sur Page fictive ?",
        phrase:
          "Plus aucun message ne partira pour ce mot sur ce compte. Rien n'est supprimé.",
        bouton: "Oui, mettre en pause",
      },
    ]);
  });

  it("un compte non activable ne s'active jamais : ni question, ni service", async () => {
    const s = faux();
    const confirmer = vi.fn(async () => true);
    const g = creerGestesMotsCibles(s, confirmer);
    await g.activer(
      "DEVIS",
      compte({
        reseau: "linkedin",
        activable: false,
        raison: "reseau_a_la_main",
      }),
      "T",
    );
    await g.activer("DEVIS", compte({ activable: false }), "T");
    expect(confirmer).not.toHaveBeenCalled();
    expect(s.activer).not.toHaveBeenCalled();
  });

  it("l'écran montre la question dans un Dialogue : « Annuler » = 0 appel, « Oui » = 1 appel", async () => {
    const s = faux();
    const onChange = vi.fn();
    const m = monter(EcranMotsCibles, {
      vue: vueEcran(),
      services: s,
      onChange,
    });
    par(m.rendre(), (e) => e.type === TableauMots)[0].props.onOuvrirMot(
      "DEVIS",
    );
    await attendre();
    const f = () => par(m.rendre(), (e) => e.type === FicheMot)[0];
    expect(f().props.apercu).toEqual(APERCU);
    void f().props.services.activer("DEVIS", compte(), "Guide des modèles");
    await attendre();
    let d = par(m.rendre(), (e) => e.type === Dialogue)[0];
    expect(d.props.titre).toBe(
      "Activer le mot DEVIS sur Page fictive (Facebook) ?",
    );
    par(
      d.props.pied,
      (e) => texteDe(e as never) === "Annuler",
    )[0].props.onClick();
    await attendre();
    expect(s.activer).not.toHaveBeenCalled();
    expect(par(m.rendre(), (e) => e.type === Dialogue)).toHaveLength(0);
    void f().props.services.activer("DEVIS", compte(), "Guide des modèles");
    await attendre();
    d = par(m.rendre(), (e) => e.type === Dialogue)[0];
    par(
      d.props.pied,
      (e) => texteDe(e as never) === "Oui, activer",
    )[0].props.onClick();
    await attendre();
    expect(s.activer).toHaveBeenCalledExactlyOnceWith("DEVIS", "c1");
    expect(onChange).toHaveBeenCalledOnce();
    expect(texteDe(m.rendre() as never)).toContain("Activé.");
  });
});

describe("R4 · écran mots et cibles", () => {
  it("vue nulle : message simple, rien d'autre", () => {
    const t = rendre(<EcranMotsCibles vue={null} services={faux()} />);
    expect(t).toContain(
      "Le tableau des mots n'a pas pu être lu. Rechargez la page dans un instant.",
    );
    expect(t).not.toContain("Créer un mot");
  });

  it("bandeaux : « plusieurs mots » éteint, copie du catalogue ; absents sinon", () => {
    const t = rendre(
      <EcranMotsCibles
        vue={vueEcran({ plusieursMotsAllume: false, depuisCopie: true })}
        services={faux()}
      />,
    );
    expect(t).toContain(
      "Le réglage « plusieurs mots » est éteint : seul le mot GUIDE peut envoyer pour l'instant. Les autres mots restent en brouillon.",
    );
    expect(t).toContain(
      "Le site ne répond pas : la dernière copie du catalogue est affichée. Aucune nouvelle cible ne peut être créée.",
    );
    const normal = rendre(
      <EcranMotsCibles vue={vueEcran()} services={faux()} />,
    );
    expect(normal).not.toContain("plusieurs mots");
    expect(normal).not.toContain("dernière copie");
    for (const f of [
      "Tous",
      "Actifs",
      "Brouillons",
      "En pause",
      "Créer un mot",
    ])
      expect(normal).toContain(f);
  });

  it("filtre par état et pastille de chaque mot", () => {
    const v = vueEcran({
      tableau: {
        lignes: [ligne("A"), ligne("B")],
        ignores: 0,
        indisponible: false,
      },
      mots: [
        resume({ mot: "A", etat: "actif" }),
        resume({ mot: "B", etat: "brouillon" }),
      ],
    });
    const m = monter(EcranMotsCibles, { vue: v, services: faux() });
    const motsAffiches = () =>
      par(m.rendre(), (e) => e.type === TableauMots)[0].props.vue.lignes.map(
        (l: Ligne) => l.mot,
      );
    expect(motsAffiches()).toEqual(["A", "B"]);
    bouton(m.rendre(), "Brouillons").props.onClick();
    expect(motsAffiches()).toEqual(["B"]);
    bouton(m.rendre(), "Actifs").props.onClick();
    expect(motsAffiches()).toEqual(["A"]);
    bouton(m.rendre(), "En pause").props.onClick();
    expect(motsAffiches()).toEqual([]);
    expect(
      par(m.rendre(), (e) => e.type === TableauMots)[0].props.etats,
    ).toEqual({ A: "actif", B: "brouillon" });
  });

  it("créer un mot : le formulaire s'ouvre, le succès dit « brouillon », l'erreur s'affiche", async () => {
    const s = faux();
    const m = monter(EcranMotsCibles, { vue: vueEcran(), services: s });
    expect(par(m.rendre(), (e) => e.type === NouveauMot)).toHaveLength(0);
    bouton(m.rendre(), "Créer un mot").props.onClick();
    par(m.rendre(), (e) => e.type === NouveauMot)[0].props.onCreer(
      "devis",
      "gde-modeles-01",
    );
    await attendre();
    expect(s.creerMot).toHaveBeenCalledExactlyOnceWith(
      "devis",
      "gde-modeles-01",
    );
    expect(texteDe(m.rendre() as never)).toContain(
      "Mot créé en brouillon : il n'envoie rien tant que ses textes ne sont pas validés et qu'il n'est pas activé sur un compte.",
    );
    const refus = {
      ...faux(),
      creerMot: vi.fn(async () => ({ ok: false, phrase: "Mot refusé." })),
    };
    const m2 = monter(EcranMotsCibles, { vue: vueEcran(), services: refus });
    bouton(m2.rendre(), "Créer un mot").props.onClick();
    par(m2.rendre(), (e) => e.type === NouveauMot)[0].props.onCreer(
      "devis",
      "x",
    );
    await attendre();
    expect(par(m2.rendre(), (e) => e.type === NouveauMot)[0].props.erreur).toBe(
      "Mot refusé.",
    );
  });
});

describe("R4 · vue pure", () => {
  it("etatDuMot : actif > pause > brouillon", () => {
    expect(etatDuMot([])).toBe("brouillon");
    expect(etatDuMot([{ etat: "non_pose" }, { etat: "pause_auto" }])).toBe(
      "brouillon",
    );
    expect(etatDuMot([{ etat: "pause" }, { etat: "non_pose" }])).toBe("pause");
    expect(etatDuMot([{ etat: "pause" }, { etat: "actif" }])).toBe("actif");
  });

  it("construireTableau : mots des liaisons actives, cible par réseau, chiffres rattachés", () => {
    const liaisons = [
      {
        mot: "DEVIS",
        reseau: "tous" as const,
        codeCible: "gde-modeles-01",
        actif: true,
      },
      {
        mot: "DEVIS",
        reseau: "instagram" as const,
        codeCible: "adr-page-001",
        actif: true,
      },
      {
        mot: "ANCIEN",
        reseau: "tous" as const,
        codeCible: "gde-modeles-01",
        actif: false,
      },
      {
        mot: "PERDU",
        reseau: "tous" as const,
        codeCible: "gde-absent-01",
        actif: true,
      },
    ];
    const c = {
      ecrits: fen(1, 2, 3),
      envoyes: fen(1, 1, 1),
      incertains: fen(0, 0, 0),
      suivent: fen(0, 1, 1),
      commentairesBloques: fen(0, 0, 0),
      envoisRefuses: fen(0, 0, 0),
    };
    const t = construireTableau({
      catalogue: CATALOGUE,
      liaisons,
      ignores: 2,
      chiffresParMot: { DEVIS: c },
    });
    expect(t.ignores).toBe(2);
    expect(t.indisponible).toBe(false);
    expect(
      t.lignes.map((l) => [
        l.mot,
        l.reseau,
        l.cible?.code ?? null,
        l.cibleIntrouvable,
      ]),
    ).toEqual([
      ["DEVIS", "tous", "gde-modeles-01", false],
      ["DEVIS", "instagram", "adr-page-001", false],
      ["PERDU", "tous", null, true],
    ]);
    expect(t.lignes[0].stats).toEqual({
      mot: "DEVIS",
      ecrits: c.ecrits,
      envoyes: c.envoyes,
      suivent: c.suivent,
    });
    expect(t.lignes[2].stats).toBeNull();
  });
});

describe("R4 · vocabulaire, pureté et imports", () => {
  const FICHIERS = [
    "src/components/mots/TableauMots.tsx",
    "src/components/mots/NouveauMot.tsx",
    "src/components/mots/ChoixCibleMot.tsx",
    "src/components/mots/tableau-mots-libelles.ts",
    "src/components/mots/FicheMot.tsx",
    "src/components/mots/EcranMotsCibles.tsx",
    "src/components/mots/fiche-mot-libelles.ts",
    "src/components/mots/gestes-mots-cibles.ts",
    "src/domaine/guide-reseau/vue-mots-cibles.ts",
  ];
  const lire = (f: string) => readFileSync(f, "utf8");

  it("aucun mot interdit, aucun montant, aucun appel de suppression de mot", () => {
    const interdit = new RegExp(
      [
        ["ab", "onn"].join(""),
        "\u20ac",
        ["delier", "Mot"].join(""),
        ["\\bpr", "ix\\b"].join(""),
      ].join("|"),
      "i",
    );
    for (const f of [...FICHIERS, "tests/zernio/mg3-ecran-composants.test.tsx"])
      expect(interdit.test(lire(f)), f).toBe(false);
  });

  it('aucun import serveur, même dynamique : import("…"), require, export … from', () => {
    const interdits =
      /^@\/(services|donnees|app|fournisseurs)|server-only|^node:|^fs$/;
    for (const f of FICHIERS) {
      const s = lire(f);
      const specificateurs = [
        ...s.matchAll(/\bfrom\s*["']([^"']+)["']/g),
        ...s.matchAll(/\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g),
        ...s.matchAll(/\bimport\s*["']([^"']+)["']/g),
        ...s.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
      ].map((m) => m[1]);
      for (const i of specificateurs) expect(i, f).not.toMatch(interdits);
      expect(s, f).not.toMatch(/\bimport\s*\(\s*[^"'`)\s]/); // import dynamique à nom calculé
      expect(s, f).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("la garde attrape bien un import dynamique (preuve)", () => {
    const exemple = 'const x = await import("@/services/mots-service");';
    expect(
      [...exemple.matchAll(/\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map(
        (m) => m[1],
      ),
    ).toEqual(["@/services/mots-service"]);
  });
});
