/**
 * MG-4 : composants d'affichage de l'écran /mots (tableau, nouveau mot, choix de cible).
 * Sans DOM (crochets factices, le dépôt n'a pas jsdom) : on lit l'arbre rendu et on appelle nous-mêmes les gestes.
 * Valeurs FICTIVES, aucun appel réseau : les composants reçoivent tout par propriétés.
 */
import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

const { monter, trouver, texteDe } = await import("../aides/crochets-factices");
const { TableauMots } = await import("@/components/mots/TableauMots");
const { NouveauMot } = await import("@/components/mots/NouveauMot");
const { ChoixCibleMot } = await import("@/components/mots/ChoixCibleMot");
type Ligne = import("@/domaine/guide-reseau/cibles-contrat").LigneTableauMot;
type Element = import("@/domaine/guide-reseau/cibles-contrat").ElementCatalogue;
type Vue = import("@/domaine/guide-reseau/cibles-contrat").VueTableauMots;

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
  el("gde-elephant1", "Éléphant rose"),
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
const vue = (lignes: Ligne[], sur: Partial<Vue> = {}): Vue => ({
  lignes,
  ignores: 0,
  indisponible: false,
  ...sur,
});
const lisible = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
const rendre = (e: ReactElement) => lisible(renderToStaticMarkup(e));

// Propriétés d'un élément lu dans l'arbre : gestes appelables (typage large, test seulement).
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

describe("MG-4 · tableau des mots", () => {
  it("affiche une ligne par mot avec la cible et son type", () => {
    const v = vue([
      ligne("DEVIS"),
      ligne("MODELES", { cible: CATALOGUE[1], reseau: "linkedin" }),
    ]);
    const html = renderToStaticMarkup(
      <TableauMots vue={v} catalogue={CATALOGUE} onChangerCible={vi.fn()} />,
    );
    expect([...html.matchAll(/data-mot="([A-Z]+)"/g)].map((m) => m[1])).toEqual(
      ["DEVIS", "MODELES"],
    );
    const t = lisible(html);
    expect(t).toContain("Guide des modèles");
    expect(t).toContain("Page d'accueil fictive");
    expect(t).toContain("Guide");
    expect(t).toContain("Adresse de page");
    expect(t).toContain("LinkedIn");
    expect(html).toContain('role="table"');
    expect(html).toContain('role="columnheader"');
  });

  it("regroupe les réseaux d'un même mot en une seule ligne", () => {
    const v = vue([
      ligne("DEVIS", { reseau: "facebook" }),
      ligne("DEVIS", { reseau: "instagram" }),
    ]);
    const html = renderToStaticMarkup(
      <TableauMots vue={v} catalogue={CATALOGUE} onChangerCible={vi.fn()} />,
    );
    expect(html.match(/data-mot="DEVIS"/g)).toHaveLength(1);
    const t = lisible(html);
    expect(t).toContain("Facebook");
    expect(t).toContain("Instagram");
  });

  it("écrit « au moins N » pour les personnes gagnées, et donne j7, j30 et total", () => {
    const t = rendre(
      <TableauMots
        vue={vue([ligne("DEVIS")])}
        catalogue={CATALOGUE}
        onChangerCible={vi.fn()}
      />,
    );
    expect(t).toContain("au moins 2");
    expect(t).toContain("au moins 5");
    expect(t).toContain("au moins 12");
    expect(t).toContain("25");
    expect(t).toContain("20");
  });

  it("signale une cible introuvable et une cible divergente", () => {
    const v = vue([
      ligne("PERDU", { cible: null, cibleIntrouvable: true }),
      ligne("AUTRE", { divergent: true }),
    ]);
    const html = renderToStaticMarkup(
      <TableauMots vue={v} catalogue={CATALOGUE} onChangerCible={vi.fn()} />,
    );
    const t = lisible(html);
    expect(t).toContain("Cible introuvable");
    expect(t).toContain("autre cible");
    expect(html).toContain('role="alert"');
  });

  it("dit quand le site n'a pas répondu et quand il n'y a aucun mot", () => {
    expect(
      rendre(
        <TableauMots
          vue={vue([], { indisponible: true })}
          catalogue={[]}
          onChangerCible={vi.fn()}
        />,
      ),
    ).toContain("n'a pas répondu");
    expect(
      rendre(
        <TableauMots vue={vue([])} catalogue={[]} onChangerCible={vi.fn()} />,
      ),
    ).toContain("Aucun mot");
  });

  it("demande une confirmation avant de changer la cible : rien ne part sans accord", () => {
    const onChangerCible = vi.fn();
    const m = monter(TableauMots, {
      vue: vue([ligne("DEVIS")]),
      catalogue: CATALOGUE,
      onChangerCible,
    });
    let arbre = m.rendre();
    bouton(arbre, "Changer la cible du mot DEVIS")!.props.onClick!();
    arbre = m.rendre();
    const choix = par(arbre, (e) => e.type === ChoixCibleMot)[0];
    expect(choix).toBeTruthy();
    (choix.props.onChoisir as (c: string) => void)("adr-page-001");
    arbre = m.rendre();
    expect(onChangerCible).not.toHaveBeenCalled();
    expect(texteDe(arbre as never)).toContain(
      "Les chiffres restent sur le mot",
    );
    bouton(arbre, "Annuler")!.props.onClick!();
    m.rendre();
    expect(onChangerCible).not.toHaveBeenCalled();
    // deuxième essai : on confirme
    bouton(m.rendre(), "Changer la cible du mot DEVIS")!.props.onClick!();
    (
      par(m.rendre(), (e) => e.type === ChoixCibleMot)[0].props.onChoisir as (
        c: string,
      ) => void
    )("adr-page-001");
    bouton(m.rendre(), "Confirmer le changement")!.props.onClick!();
    expect(onChangerCible).toHaveBeenCalledExactlyOnceWith(
      "DEVIS",
      "adr-page-001",
    );
  });
});

describe("MG-4 · choix de la cible", () => {
  it("affiche les cibles TEST en dernier avec un badge TEST", () => {
    const html = renderToStaticMarkup(
      <ChoixCibleMot catalogue={CATALOGUE} valeur={null} onChoisir={vi.fn()} />,
    );
    const ordre = [...html.matchAll(/data-cible="([a-z0-9-]+)"/g)].map(
      (m) => m[1],
    );
    expect(ordre[ordre.length - 1]).toBe("gde-essai-01");
    expect(ordre).toHaveLength(4);
    expect(html.match(/>TEST</g)).toHaveLength(1);
  });

  it("n'affiche pas les cibles désactivées", () => {
    const t = rendre(
      <ChoixCibleMot
        catalogue={[
          ...CATALOGUE,
          el("gde-eteint-01", "Guide éteint", { actif: false }),
        ]}
        valeur={null}
        onChoisir={vi.fn()}
      />,
    );
    expect(t).not.toContain("Guide éteint");
  });

  it("cherche sans tenir compte des accents ni de la casse", () => {
    const m = monter(ChoixCibleMot, {
      catalogue: CATALOGUE,
      valeur: null,
      onChoisir: vi.fn(),
    });
    const champ = par(
      m.rendre(),
      (e) => typeof e.props.onChange === "function",
    )[0];
    (champ.props.onChange as (e: unknown) => void)({
      target: { value: "ELEPHANT" },
    });
    const arbre = m.rendre();
    const codes = par(
      arbre,
      (e) => typeof e.props["data-cible"] === "string",
    ).map((e) => e.props["data-cible"]);
    expect(codes).toEqual(["gde-elephant1"]);
  });

  it("renvoie le code choisi", () => {
    const onChoisir = vi.fn();
    const m = monter(ChoixCibleMot, {
      catalogue: CATALOGUE,
      valeur: null,
      onChoisir,
    });
    const b = par(
      m.rendre(),
      (e) => e.props["data-cible"] === "gde-modeles-01",
    ).flatMap((e) => par(e, (x) => typeof x.props.onClick === "function"))[0];
    b.props.onClick!();
    expect(onChoisir).toHaveBeenCalledWith("gde-modeles-01");
  });

  it("dit quand rien ne correspond", () => {
    const m = monter(ChoixCibleMot, {
      catalogue: CATALOGUE,
      valeur: null,
      onChoisir: vi.fn(),
    });
    (
      par(m.rendre(), (e) => typeof e.props.onChange === "function")[0].props
        .onChange as (e: unknown) => void
    )({ target: { value: "zzzz" } });
    expect(texteDe(m.rendre() as never)).toContain(
      "Aucune cible ne correspond",
    );
  });
});

describe("MG-4 · nouveau mot", () => {
  it("affiche le champ mot avec son libellé et le choix de la cible", () => {
    const html = renderToStaticMarkup(
      <NouveauMot catalogue={CATALOGUE} onCreer={vi.fn()} />,
    );
    expect(html).toContain("<label");
    expect(lisible(html)).toContain("Le mot à écrire");
  });

  it("refuse en phrase simple un mot vide, puis une cible oubliée, sans appeler le service", () => {
    const onCreer = vi.fn();
    const m = monter(NouveauMot, { catalogue: CATALOGUE, onCreer });
    const envoyer = () =>
      par(m.rendre(), (e) => e.type === "form")[0].props.onSubmit as (
        e: unknown,
      ) => void;
    envoyer()({ preventDefault: () => undefined });
    expect(texteDe(m.rendre() as never)).toContain("Écrivez un mot");
    (
      par(m.rendre(), (e) => e.props.name === "mot")[0].props.onChange as (
        e: unknown,
      ) => void
    )({ target: { value: "devis" } });
    envoyer()({ preventDefault: () => undefined });
    expect(texteDe(m.rendre() as never)).toContain(
      "Choisissez ce que le mot envoie",
    );
    expect(onCreer).not.toHaveBeenCalled();
  });

  it("transmet le mot et la cible choisie, et affiche l'erreur reçue", () => {
    const onCreer = vi.fn();
    const m = monter(NouveauMot, {
      catalogue: CATALOGUE,
      onCreer,
      erreur: "Ce mot existe déjà.",
    });
    (
      par(m.rendre(), (e) => e.props.name === "mot")[0].props.onChange as (
        e: unknown,
      ) => void
    )({ target: { value: "devis" } });
    (
      par(m.rendre(), (e) => e.type === ChoixCibleMot)[0].props.onChoisir as (
        c: string,
      ) => void
    )("gde-modeles-01");
    (
      par(m.rendre(), (e) => e.type === "form")[0].props.onSubmit as (
        e: unknown,
      ) => void
    )({ preventDefault: () => undefined });
    expect(onCreer).toHaveBeenCalledWith("devis", "gde-modeles-01");
    expect(texteDe(m.rendre() as never)).toContain("Ce mot existe déjà.");
  });
});

describe("MG-4 · vocabulaire et pureté", () => {
  const FICHIERS = [
    "TableauMots.tsx",
    "NouveauMot.tsx",
    "ChoixCibleMot.tsx",
    "tableau-mots-libelles.ts",
  ].map((n) => `src/components/mots/${n}`);
  const MOTIF = new RegExp(["ab", "onn"].join(""), "i");

  it("aucun fichier ni ce test ne contient le mot interdit", () => {
    for (const f of [...FICHIERS, "tests/zernio/mg-tableau-mots.test.tsx"])
      expect(MOTIF.test(readFileSync(f, "utf8")), f).toBe(false);
  });

  it("aucun import serveur ni appel réseau dans les composants", () => {
    for (const f of FICHIERS) {
      const s = readFileSync(f, "utf8");
      const imports = [...s.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const i of imports)
        expect(i, f).not.toMatch(
          /^@\/(services|donnees|app)|server-only|^node:|^fs$/,
        );
      expect(s, f).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("le tableau dit « suivre le compte »", () => {
    const t = rendre(
      <TableauMots
        vue={vue([ligne("DEVIS")])}
        catalogue={CATALOGUE}
        onChangerCible={vi.fn()}
      />,
    );
    expect(t).toContain("suivre le compte");
  });
});
