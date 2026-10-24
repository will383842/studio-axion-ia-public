/**
 * BoutonRetirerCas et BoutonRemettreCas : l'interaction (premier clic = aucune action ; « Oui » = une seule action ; « Annuler » =
 * aucune action). Pas d'environnement DOM dans le dépôt : les crochets de React sont remplacés par un mini banc d'essai qui
 * garde l'état entre deux rendus, et les clics appellent directement le `onClick` des boutons de l'arbre rendu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const banc = vi.hoisted(() => ({ cases: [] as unknown[], i: 0, transitions: [] as Promise<unknown>[], effets: [] as (() => void)[], refs: [] as { current: unknown }[], r: 0 }));
vi.mock("react", async (importOriginal) => {
  const reel = await importOriginal<typeof import("react")>();
  const crochets = {
    useState: (init: unknown) => {
      const k = banc.i++;
      if (!(k in banc.cases)) banc.cases[k] = typeof init === "function" ? (init as () => unknown)() : init;
      return [banc.cases[k], (v: unknown) => void (banc.cases[k] = typeof v === "function" ? (v as (x: unknown) => unknown)(banc.cases[k]) : v)];
    },
    useTransition: () => [false, (f: () => Promise<unknown>) => void banc.transitions.push(Promise.resolve(f()))],
    useRef: () => {
      const k = banc.r++;
      return (banc.refs[k] ??= { current: null });
    },
    useEffect: (f: () => void) => void banc.effets.push(f),
  };
  return { ...reel, ...crochets, default: { ...reel, ...crochets } };
});

const actions = vi.hoisted(() => ({ retirer: vi.fn(async () => ({ ok: true as const, valeur: {} })), remettre: vi.fn(async () => ({ ok: true as const, valeur: {} })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ retirerCasAction: actions.retirer, remettreCasAction: actions.remettre }));
vi.mock("@/components/ui/Toast", () => ({ notifier: { succes: vi.fn(), erreur: vi.fn() } }));

import { BoutonRetirerCas } from "@/components/formats/cas-concret/entree/BoutonRetirerCas";
import { BoutonRemettreCas } from "@/components/formats/cas-concret/stock/BoutonRemettreCas";

type Noeud = { type?: unknown; props?: { children?: unknown; onClick?: () => void; [k: string]: unknown } } | string | null | undefined | false | Noeud[];

function texteDe(n: Noeud): string {
  if (Array.isArray(n)) return n.map(texteDe).join("");
  if (typeof n === "string") return n;
  if (n && typeof n === "object") return texteDe(n.props?.children as Noeud);
  return "";
}
function chercher(n: Noeud, libelle: string): { props: { onClick?: () => void } } | undefined {
  if (Array.isArray(n)) {
    for (const x of n) {
      const r = chercher(x, libelle);
      if (r) return r;
    }
    return undefined;
  }
  if (n && typeof n === "object") {
    if (typeof n.props?.onClick === "function" && texteDe(n) === libelle) return n as never;
    return chercher(n.props?.children as Noeud, libelle);
  }
  return undefined;
}
function rendre<P extends object>(composant: (p: P) => Noeud, props: P): Noeud {
  banc.i = 0;
  banc.r = 0;
  banc.effets = [];
  return composant(props);
}
async function cliquer<P extends object>(composant: (p: P) => Noeud, props: P, libelle: string): Promise<Noeud> {
  const bouton = chercher(rendre(composant, props), libelle);
  expect(bouton, `bouton « ${libelle} »`).toBeTruthy();
  bouton!.props.onClick!();
  await Promise.all(banc.transitions.splice(0));
  return rendre(composant, props);
}

beforeEach(() => {
  banc.cases = [];
  banc.transitions = [];
  banc.refs = [];
  actions.retirer.mockClear();
  actions.remettre.mockClear();
});

const props = { casId: "cas-test", titre: "Cas de test" };

describe("« Retirer ce cas » : l'interaction", () => {
  it("le premier clic ne retire rien : il demande la confirmation, avec ce qui arrive aux vidéos", async () => {
    const apres = await cliquer(BoutonRetirerCas as never, props as never, "Retirer ce cas");
    expect(actions.retirer).not.toHaveBeenCalled();
    const t = texteDe(apres);
    expect(t).toContain("Ce cas ne sera plus proposé.");
    expect(t).toContain("Oui, retirer");
    expect(t).toContain("Annuler");
    expect(t).toContain("Une vidéo de ce cas en pause ne pourra pas être relancée tant qu'il n'est pas remis ; une vidéo en cours va au bout.");
  });

  it("« Oui, retirer » appelle l'action une seule fois, avec le bon cas, et ferme la feuille", async () => {
    const onRetire = vi.fn();
    const p = { ...props, onRetire };
    await cliquer(BoutonRetirerCas as never, p as never, "Retirer ce cas");
    await cliquer(BoutonRetirerCas as never, p as never, "Oui, retirer");
    expect(actions.retirer).toHaveBeenCalledTimes(1);
    expect(actions.retirer).toHaveBeenCalledWith("cas-test");
    expect(onRetire).toHaveBeenCalledTimes(1);
  });

  it("« Annuler » ne retire rien et revient au bouton de départ", async () => {
    await cliquer(BoutonRetirerCas as never, props as never, "Retirer ce cas");
    const apres = await cliquer(BoutonRetirerCas as never, props as never, "Annuler");
    expect(actions.retirer).not.toHaveBeenCalled();
    expect(texteDe(apres)).toContain("Retirer ce cas");
    expect(texteDe(apres)).not.toContain("Oui, retirer");
  });

  it("un refus du serveur est dit en phrase, sans fermer la feuille", async () => {
    actions.retirer.mockResolvedValueOnce({ ok: false, message: "Ce cas n'existe plus." } as never);
    const onRetire = vi.fn();
    const p = { ...props, onRetire };
    await cliquer(BoutonRetirerCas as never, p as never, "Retirer ce cas");
    const apres = await cliquer(BoutonRetirerCas as never, p as never, "Oui, retirer");
    expect(texteDe(apres)).toContain("Ce cas n'existe plus.");
    expect(onRetire).not.toHaveBeenCalled();
  });
});

describe("« Remettre ce cas » : l'interaction", () => {
  it("premier clic = aucune action ; « Oui, le remettre » = une seule action ; « Annuler » = aucune", async () => {
    await cliquer(BoutonRemettreCas as never, props as never, "Remettre ce cas");
    expect(actions.remettre).not.toHaveBeenCalled();
    await cliquer(BoutonRemettreCas as never, props as never, "Annuler");
    expect(actions.remettre).not.toHaveBeenCalled();
    await cliquer(BoutonRemettreCas as never, props as never, "Remettre ce cas");
    await cliquer(BoutonRemettreCas as never, props as never, "Oui, le remettre");
    expect(actions.remettre).toHaveBeenCalledTimes(1);
    expect(actions.remettre).toHaveBeenCalledWith("cas-test");
  });
});
