/**
 * Allègement de DERNIER RECOURS (essai réel du 23/10/2026, série Automatisations) : une page d'une seule scène d'une
 * seule phrase ne tient pas dans le style du tableau et rien ne peut la couper ni la déplacer. La réparation retire
 * alors ce qui est écrit en trop (d'abord le « détail », puis le dessin ou le visuel), un élément à la fois, SANS toucher
 * au texte dit, sans supprimer de scène, et seulement si la page tient ensuite et que les règles de page n'empirent pas.
 *
 * ATTENTION : la mise en page est SIMULÉE (vi.mock remonté) : elle refuse la page 2 en « tableau-blanc » selon un mode
 * choisi par chaque test (tant qu'un détail est écrit, tant qu'un dessin est posé, toujours). Aucune vraie mise en page
 * n'a été prise en défaut ici : ces tests prouvent la logique de l'allègement, pas la mesure réelle des pixels.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import "@/moteurs/montage-tableau/decoupage"; // ordre des imports (dépendance circulaire fiche / gabarit)
import { pageTropChargee, pagesDuStyle, reparerDensiteFiche } from "@/moteurs/montage-tableau/densite";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";

const etat = vi.hoisted(() => ({ mode: "aucun" as "aucun" | "detail" | "detail-ou-dessin" | "dessin" | "toujours" | "deux-scenes" | "horizontal" | "erreur-apres" | "deux-pages" | "p2-16-9-p5" }));

vi.mock("@/moteurs/montage-tableau/mise-en-page", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/moteurs/montage-tableau/mise-en-page")>();
  type S = { id: string; page: number; elements: { type: string; bloc?: string }[] };
  return {
    ...original,
    mettreEnPage: ((fiche: { styleTableau?: string; scenes: S[] }, options?: unknown) => {
      if (fiche.styleTableau === "tableau-blanc" && (etat.mode === "deux-pages" || etat.mode === "p2-16-9-p5")) {
        const avecDetail = (id: string) => {
          const sc = fiche.scenes.find((y) => y.id === id);
          return sc && sc.elements.some((e) => e.bloc === "detail") ? sc : undefined;
        };
        const refuser = (sc: S) => {
          throw new original.ErreurMiseEnPage(`Page ${sc.page} · scène ${sc.id} · la page ne tient pas (simulé)`, sc.page);
        };
        if (etat.mode === "deux-pages") for (const id of ["s02", "s03"]) { const sc = avecDetail(id); if (sc) refuser(sc); }
        if (etat.mode === "p2-16-9-p5") {
          const s2 = avecDetail("s02");
          if (s2 && (options as { format?: string } | undefined)?.format === "horizontal") refuser(s2);
          const s5 = avecDetail("s05");
          if (s5) refuser(s5);
        }
        return (original.mettreEnPage as (f: unknown, o?: unknown) => unknown)(fiche, options);
      }
      if (fiche.styleTableau === "tableau-blanc" && etat.mode !== "aucun") {
        const s2 = fiche.scenes.find((s) => s.id === "s02");
        const detail = !!s2?.elements.some((e) => e.bloc === "detail");
        const dessin = !!s2?.elements.some((e) => e.type === "dessin");
        if (etat.mode === "horizontal") {
          if (s2 && detail && (options as { format?: string } | undefined)?.format === "horizontal") throw new original.ErreurMiseEnPage("Page 2 · scène s02 · ne tient pas en 16:9 (simulé)", s2.page);
          return (original.mettreEnPage as (f: unknown, o?: unknown) => unknown)(fiche, options);
        }
        if (etat.mode === "erreur-apres") {
          if (s2 && detail) throw new original.ErreurMiseEnPage("Page 2 · scène s02 · ne tient pas (simulé)", s2.page);
          if (s2) throw new Error("erreur inattendue (simulée)");
        }
        const refus =
          (etat.mode === "detail" && detail) || (etat.mode === "dessin" && dessin) || (etat.mode === "detail-ou-dessin" && (detail || dessin)) || etat.mode === "toujours";
        if (s2 && refus) throw new original.ErreurMiseEnPage("Page 2 · scène s02 · la page ne tient pas au-dessus de la bande des sous-titres (simulé)", s2.page);
        if (etat.mode === "deux-scenes" && fiche.scenes.filter((s) => s.page === 7).length >= 2) throw new original.ErreurMiseEnPage("Page 7 · scène s08 · la page ne tient pas (simulé)", 7);
      }
      return (original.mettreEnPage as (f: unknown, o?: unknown) => unknown)(fiche, options);
    }) as typeof original.mettreEnPage,
  };
});

const temoin: FicheTableau = JSON.parse(readFileSync(join(__dirname, "..", "temoins", "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8"));

/** La page 2 : une seule scène, UNE phrase dite ; titre-phrase clé + détail (e04), plus un dessin (e90) si demandé. */
function fiche(opts: { dessin?: boolean; detailSeul?: boolean } = {}) {
  const f = structuredClone(temoin) as FicheTableau & { scenes: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  f.styleTableau = "tableau-blanc";
  const s = f.scenes[1];
  s.texteDit = "On leur a donné l'outil, pas ce qu'il faut lui demander.";
  const dessin = { id: "e90", type: "dessin", dessinId: "enveloppe", cote: "droite", ancre: 5 };
  s.elements = opts.detailSeul ? [{ ...s.elements[1], ancre: 0 }, dessin] : [s.elements[0], { ...s.elements[1], ancre: 6 }, ...(opts.dessin ? [dessin] : [])];
  return f;
}
const ids = (f: FicheTableau, scene = 1) => f.scenes[scene].elements.map((e) => e.id);
const dits = (f: FicheTableau) => f.scenes.map((s) => s.texteDit).join("|");

describe("allègement de dernier recours (mise en page SIMULÉE)", () => {
  it("détail seul en trop : il est retiré, rien d'autre ; texte dit et scènes inchangés", () => {
    etat.mode = "detail";
    const f = fiche({ dessin: true });
    expect(pageTropChargee(f)).toBe(2);
    const r = reparerDensiteFiche(f, { alleger: true });
    expect(ids(r)).toEqual(["e03", "e90"]);
    expect(dits(r)).toBe(dits(f));
    expect(r.scenes.length).toBe(f.scenes.length);
    expect(pageTropChargee(r)).toBeNull();
  });

  it("détail puis dessin : les deux sont retirés quand le détail seul ne suffit pas", () => {
    etat.mode = "detail-ou-dessin";
    const r = reparerDensiteFiche(fiche({ dessin: true }), { alleger: true });
    expect(ids(r)).toEqual(["e03"]);
    expect(pageTropChargee(r)).toBeNull();
  });

  it("le dessin seul gêne : on ne retire que lui, le détail reste", () => {
    etat.mode = "dessin";
    const r = reparerDensiteFiche(fiche({ dessin: true }), { alleger: true });
    expect(ids(r)).toEqual(["e03", "e04"]);
  });

  it("rien ne fait tenir la page : la fiche est rendue telle quelle (même objet)", () => {
    etat.mode = "toujours";
    const f = fiche({ dessin: true });
    expect(reparerDensiteFiche(f, { alleger: true })).toBe(f);
  });

  it("le retrait qui ferait écrire moins que rien (règle de page) est refusé", () => {
    etat.mode = "detail";
    const f = fiche({ detailSeul: true }); // la seule ligne écrite est le détail, avec un dessin
    expect(reparerDensiteFiche(f, { alleger: true })).toBe(f);
  });

  it("dernier recours seulement : si la page de plus passe, rien n'est retiré", () => {
    etat.mode = "deux-scenes";
    const f = structuredClone(temoin) as FicheTableau;
    f.styleTableau = "tableau-blanc";
    const r = reparerDensiteFiche(f, { alleger: true });
    const nbElements = (x: FicheTableau) => x.scenes.reduce((n, s) => n + s.elements.length, 0);
    expect(nbElements(r)).toBe(nbElements(f));
    expect(dits(r)).toBe(dits(f));
    expect(Math.max(...r.scenes.map((s) => s.page))).toBeGreaterThan(Math.max(...f.scenes.map((s) => s.page)));
  });

  it("1 · hors découpage (pagesDuStyle : fabrication, relecture) rien n'est jamais retiré", () => {
    etat.mode = "detail";
    const f = fiche({ dessin: true });
    const r = pagesDuStyle(f) as FicheTableau;
    expect(ids(r)).toEqual(["e03", "e04", "e90"]);
    expect(reparerDensiteFiche(f)).toBe(f); // par défaut : pas d'allègement
  });

  it("2 · la page tient en vertical mais pas en 16:9 : rien n'est retiré (la règle de page ne la refuse pas)", () => {
    etat.mode = "horizontal";
    const f = fiche({ dessin: true });
    expect(pageTropChargee(f)).toBe(2); // les quatre sorties : l'horizontal la refuse
    expect(reparerDensiteFiche(f, { alleger: true })).toBe(f);
  });

  it("2 bis · non-régression SANS refus simulé : les témoins ardoise sont rendus tels quels (même objet)", () => {
    etat.mode = "aucun";
    for (const nom of ["fiche-formation-v3-reference-3.json", "fiche-temoin-v-667edcd8e3a8-reference-3.json"]) {
      const f: FicheTableau = JSON.parse(readFileSync(join(__dirname, "..", "temoins", nom), "utf8"));
      expect(reparerDensiteFiche(f, { alleger: true }), nom).toBe(f);
    }
  });

  it("3 · une exception autre qu'un refus de mise en page après le retrait : le retrait est refusé", () => {
    etat.mode = "erreur-apres";
    const f = fiche({ dessin: true });
    expect(reparerDensiteFiche(f, { alleger: true })).toBe(f);
  });

  it("4 · la validation (hors règle de page) empirerait : le retrait est refusé", () => {
    etat.mode = "detail";
    const f = fiche({ dessin: true });
    const verifier = (x: FicheTableau) => (x.scenes[1].elements.length < 3 ? 1 : 0);
    expect(reparerDensiteFiche(f, { alleger: true, verifier })).toBe(f);
  });

  it("5 · les retraits sont notés : page, scène, élément, type", () => {
    etat.mode = "detail-ou-dessin";
    const retraits: { page: number; sceneId: string; elementId: string; type: string }[] = [];
    reparerDensiteFiche(fiche({ dessin: true }), { alleger: true, retraits });
    expect(retraits).toEqual([
      { page: 2, sceneId: "s02", elementId: "e04", type: "détail" },
      { page: 2, sceneId: "s02", elementId: "e90", type: "dessin" },
    ]);
  });

  it("6 · la page ciblée est celle du VERTICAL : la page 2 ne tient qu'en 16:9 (intacte), la page 5 échoue en vertical (allégée)", () => {
    etat.mode = "p2-16-9-p5";
    const f = fiche({ dessin: true }) as FicheTableau & { scenes: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    f.scenes[4].texteDit = "Deux, transformez les notes de réunion en compte rendu.";
    f.scenes[4].elements = [f.scenes[4].elements[0], { ...f.scenes[4].elements[1], bloc: "detail", ancre: 0 }];
    const retraits: { page: number; sceneId: string; elementId: string; type: string }[] = [];
    const r = reparerDensiteFiche(f, { alleger: true, retraits });
    expect(ids(r, 1)).toEqual(["e03", "e04", "e90"]);
    expect(ids(r, 4)).toEqual(["e12"]);
    expect(retraits.map((x) => x.page)).toEqual([5]);
  });

  it("7 · une exception à un tour suivant : aucun retrait n'est noté (liste locale copiée au retour normal seulement)", () => {
    etat.mode = "deux-pages";
    const f = fiche() as FicheTableau & { scenes: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    f.scenes[2].elements = [f.scenes[2].elements[0], { ...f.scenes[2].elements[0], id: "e91", bloc: "detail", ancre: 3 }];
    f.scenes[2].texteDit = "Trois tâches à apprendre en premier.";
    const retraits: { page: number; sceneId: string; elementId: string; type: string }[] = [];
    let appels = 0;
    const verifier = () => {
      if (++appels >= 3) throw new Error("erreur inattendue (simulée)");
      return 0;
    };
    expect(() => reparerDensiteFiche(f, { alleger: true, retraits, verifier })).toThrow();
    expect(retraits).toEqual([]);
    // Sans exception, les deux pages sont allégées et les deux retraits notés.
    appels = -100;
    const ok: typeof retraits = [];
    reparerDensiteFiche(f, { alleger: true, retraits: ok, verifier });
    expect(ok.map((x) => x.page)).toEqual([2, 3]);
  });
});
