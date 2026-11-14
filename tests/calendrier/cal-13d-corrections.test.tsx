/**
 * CAL-13d (corrections) : le mot cherché donne le même résultat dans toutes les vues (recherche sur titre + texte), le pont
 * client se remet d'accord avec l'adresse, « Prêt à partir ? » ne ment pas sur l'heure et ne montre pas un « Copier » muet.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const effets: (() => unknown)[] = [];
vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
  useEffect: (f: () => unknown, deps?: unknown[]) => void (deps && deps.length === 0 ? undefined : effets.push(f)),
}));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
const remplacer = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: remplacer }) }));
const listerCalendrier = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/publications", () => ({ listerCalendrier: () => listerCalendrier(), listerAProgrammer: async () => [] }));

const { monter, trouver } = await import("../aides/crochets-factices");
const { cleJour } = await import("@/lib/dates");
const { FiltresCalendrier } = await import("@/components/calendrier/FiltresCalendrier");
const { PretAPartir } = await import("@/components/calendrier/PretAPartir");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");

const VIDEO = { id: "v1", reseau: "linkedin", videoId: "vid1", video: { titre: "Alpha lancement", vignette: null, video: null }, texte: "Un texte sans rapport" };
const IMAGE = { id: "i1", reseau: "facebook", video: null, texte: "Bêta visuel" };

async function pageAvec(params: Record<string, string>, pubs: Record<string, unknown>[] = [VIDEO, IMAGE]): Promise<string> {
  monter(() => null, {}).rendre();
  listerCalendrier.mockResolvedValueOnce([{ jour: cleJour(new Date()), publications: pubs.map((p) => ({ statut: "programmee", via: "manuel", date: new Date().toISOString(), reseauNom: "Réseau", ...p })) }]);
  const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
  return renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as ReactElement);
}
const grille = (h: string) => h.slice(h.lastIndexOf("hidden min-[861px]:block"));
const cartes = (h: string) => [...grille(h).matchAll(/data-carte="publication:([^|"]+)\|/g)].map((m) => m[1]);
const compte = (h: string) => /· (\d+) publication/.exec(h)?.[1];

describe("CAL-13d corr. — le mot cherché porte sur le même texte dans toutes les vues", () => {
  beforeEach(() => listerCalendrier.mockReset());

  it("?q=bêta garde la publication image « Bêta visuel » en semaine", async () => {
    const h = await pageAvec({ q: "bêta" });
    expect(cartes(h)).toEqual(["i1"]);
    expect(compte(h)).toBe("1");
    expect(h).not.toContain('data-etat="filtre-vide"');
  });
  it("?q=bêta garde la publication image en mois", async () => {
    const h = await pageAvec({ vue: "mois", q: "bêta" });
    expect(h).toMatch(/>1 publication</);
  });
  it("?q=alpha garde la vidéo « Alpha lancement » en vue Jour (titre affiché inchangé : début du texte)", async () => {
    const h = await pageAvec({ vue: "jour", q: "alpha" });
    expect(h).toContain("Un texte sans rapport");
    expect(h).not.toContain("Bêta visuel");
  });
  it("?q=alpha donne la même vidéo en semaine, en mois et en vue Jour", async () => {
    expect(cartes(await pageAvec({ q: "alpha" }))).toEqual(["v1"]);
    expect(await pageAvec({ vue: "mois", q: "alpha" })).toMatch(/>1 publication</);
    expect(await pageAvec({ vue: "jour", q: "alpha" })).toContain("Un texte sans rapport");
  });
  it("une semaine d'images seules + ?q= qui correspond : pas de filtre-vide", async () => {
    const h = await pageAvec({ q: "bêta" }, [IMAGE, { id: "i2", reseau: "linkedin", video: null, texte: "Bêta deux" }]);
    expect(h).not.toContain('data-etat="filtre-vide"');
    expect(cartes(h).sort()).toEqual(["i1", "i2"]);
  });
  it("un mot sans correspondance montre toujours filtre-vide", async () => {
    expect(await pageAvec({ q: "zzzz" })).toContain('data-etat="filtre-vide"');
  });
});

describe("CAL-13d corr. — le pont client suit l'adresse", () => {
  const base = "/calendrier?vue=mois&date=2026-11";
  type PropsFiltres = { criteres: { types: string[]; etats: string[]; motCle: string }; onChanger: (c: unknown) => void };
  /** Monte le pont ; `rendre()` rend, puis joue les effets du rendu (le mini-moteur ne le fait pas) et rend encore. */
  function monterPont(motCle: string) {
    const props = { criteres: { types: [] as never[], etats: [] as string[], motCle }, base };
    const m = monter(FiltresCalendrier, props);
    const lire = () => {
      effets.length = 0;
      const arbre = m.rendre() as ReactElement<PropsFiltres>;
      const aJouer = [...effets];
      aJouer.forEach((f) => f());
      return { arbre, rejouer: () => ((effets.length = 0), m.rendre() as ReactElement<PropsFiltres>) };
    };
    return { props, lire };
  }

  beforeEach(() => remplacer.mockReset());

  it("quand q sort de l'adresse sans passer par le champ, le champ se vide et le clic suivant ne remet pas l'ancien mot", () => {
    const { props, lire } = monterPont("alpha");
    const { rejouer } = lire();
    expect(rejouer().props.criteres.motCle).toBe("alpha");
    // « Tout afficher » : l'adresse n'a plus de q.
    props.criteres = { types: [], etats: [], motCle: "" };
    lire();
    const apres = rejouer();
    expect(apres.props.criteres.motCle).toBe("");
    // Cocher une case envoie maintenant un mot vide.
    apres.props.onChanger({ ...apres.props.criteres, types: ["video"] });
    expect(remplacer).toHaveBeenCalledWith(`${base}&types=video`, { scroll: false });
  });

  it("pendant une frappe en attente, l'adresse ne piétine pas le champ", () => {
    vi.useFakeTimers();
    try {
      const { lire, props } = monterPont("");
      const { rejouer } = lire();
      rejouer().props.onChanger({ ...props.criteres, motCle: "gam" });
      lire();
      expect(rejouer().props.criteres.motCle).toBe("gam");
      expect(remplacer).not.toHaveBeenCalled();
      vi.advanceTimersByTime(450);
      expect(remplacer).toHaveBeenCalledWith(`${base}&q=gam`, { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("« Effacer les filtres » : le mot vidé navigue tout de suite, sans pause de 400 ms", () => {
    vi.useFakeTimers();
    try {
      const { lire, props } = monterPont("alpha");
      const { rejouer } = lire();
      rejouer().props.onChanger({ ...props.criteres, types: [], etats: [], motCle: "" });
      expect(remplacer).toHaveBeenCalledWith(base, { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("cases en rafale : deux clics de suite gardent la première case cochée", () => {
    const { lire } = monterPont("");
    const { rejouer } = lire();
    rejouer().props.onChanger({ ...rejouer().props.criteres, types: ["video"] });
    const second = rejouer();
    second.props.onChanger({ ...second.props.criteres, etats: ["a_corriger"] });
    expect(remplacer).toHaveBeenLastCalledWith(`${base}&types=video&etats=a_corriger`, { scroll: false });
  });
});

describe("CAL-13d corr. — Prêt à partir ?", () => {
  it("dans le tiroir, « Copier » est branché au presse-papiers (onCopier fourni)", () => {
    monter(() => null, {}).rendre();
    const entree = { cle: "publication:p1|linkedin", jour: "2026-12-20", reseau: "linkedin" as const, type: "video" as const, etat: "programme", heure: "09:00", texte: "Un texte #astuce" };
    const arbre = ApercuPublication({ entree: entree as never, aujourdhui: "2026-11-11", onPrecedente: () => {}, onSuivante: () => {}, onFermer: () => {}, onChangerDate: () => {} });
    const pret = trouver(arbre, (e) => e.type === PretAPartir);
    expect(pret).toHaveLength(1);
    expect(typeof pret[0].props.onCopier).toBe("function");
    expect(() => (pret[0].props.onCopier as (t: string) => void)("texte")).not.toThrow();
  });
  it("une heure absente laisse « Il manque la date et l'heure » au lieu d'un 00:00 inventé", () => {
    monter(() => null, {}).rendre();
    const entree = { cle: "publication:p1|linkedin", jour: "2026-12-20", reseau: "linkedin" as const, type: "video" as const, etat: "programme", texte: "Un texte #astuce" };
    const h = renderToStaticMarkup(ApercuPublication({ entree: entree as never, aujourdhui: "2026-11-11", onPrecedente: () => {}, onSuivante: () => {}, onFermer: () => {}, onChangerDate: () => {} }) as ReactElement);
    expect(h).toContain("Il manque la date et l&#x27;heure");
    const avec = renderToStaticMarkup(ApercuPublication({ entree: { ...entree, heure: "09:00" } as never, aujourdhui: "2026-11-11", onPrecedente: () => {}, onSuivante: () => {}, onFermer: () => {}, onChangerDate: () => {} }) as ReactElement);
    expect(avec).not.toContain("Il manque la date et l&#x27;heure");
  });
});
