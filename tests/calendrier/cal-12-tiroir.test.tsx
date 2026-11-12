/**
 * CAL-12 : tiroir en dialogue modal accessible, navigation dans la liste filtrée, feuille du bas sur téléphone.
 * Sans DOM (le dépôt n'a pas jsdom) : on lit le rendu serveur et on pilote des doublures d'éléments. Données fictives.
 */
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({
  decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })),
}));

const { monter, trouver } = await import("../aides/crochets-factices");
const tiroir = await import("@/components/calendrier/TiroirAccessible");
const { ApercuPublication, SemaineAvecApercu } =
  await import("@/components/calendrier/ApercuPublication");
const { GrilleSemaine } = await import("@/components/calendrier/GrilleSemaine");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;

const AUJOURDHUI = "2026-11-11";
const rendre = (el: ReactElement) => renderToStaticMarkup(el);

/** Doublure d'élément du document : garde le focus reçu, dit s'il est encore dans la page. */
function faux(nom: string, extra: Record<string, unknown> = {}) {
  const e = {
    nom,
    isConnected: true,
    focus: vi.fn(),
    getAttribute: (k: string) =>
      k === "data-carte" ? ((extra.carte as string | undefined) ?? null) : null,
    ...extra,
  };
  return e as typeof e & HTMLElement;
}
function fauxDialogue(focalisables: HTMLElement[] = []) {
  const d = {
    open: false,
    showModal: vi.fn(() => void (d.open = true)),
    close: vi.fn(() => void (d.open = false)),
    querySelectorAll: vi.fn(() => focalisables),
  };
  return d as typeof d & HTMLDialogElement;
}
function fauxDocument(
  actif: HTMLElement | null,
  parNom: Record<string, HTMLElement> = {},
) {
  return {
    activeElement: actif,
    querySelector: vi.fn((s: string) => parNom[s] ?? null),
  } as unknown as Document;
}

const entree = (sur: Partial<Entree> = {}): Entree => ({
  cle: "creneau:c1|linkedin",
  jour: "2026-11-12",
  reseau: "linkedin",
  type: "video",
  etat: "a_valider",
  heure: "09:00",
  titre: "Le devis qui part tout seul",
  texte: "Trois e-mails sur quatre se trient sans vous.",
  ...sur,
});
const quatre = (): Entree[] => [
  entree({ cle: "creneau:c1|linkedin", heure: "09:00" }),
  entree({
    cle: "creneau:c2|instagram",
    reseau: "instagram",
    heure: "10:00",
    type: "image",
    etat: "brouillon",
    titre: "Image",
  }),
  entree({
    cle: "creneau:c3|tiktok",
    reseau: "tiktok",
    heure: "11:00",
    etat: "brouillon",
    titre: "Court",
  }),
  entree({ cle: "creneau:c4|linkedin", heure: "12:00", titre: "Quatre" }),
];

describe("TiroirAccessible : un élément <dialog> natif, ouvert par showModal()", () => {
  it("rend un <dialog> natif, aria-modal, sans le rendre ouvert d'office", () => {
    const h = rendre(
      <tiroir.TiroirAccessible onFermer={() => {}} aria-label="Aperçu">
        <p>Contenu</p>
      </tiroir.TiroirAccessible>,
    );
    expect(h).toMatch(/<dialog[ >]/);
    expect(h).toContain('aria-modal="true"');
    expect(h).toContain('aria-label="Aperçu"');
    expect(h).toContain("<p>Contenu</p>");
    expect(h).not.toMatch(/<dialog[^>]*\sopen/);
  });
  it("l'ouverture appelle showModal() (une seule fois, pas de double ouverture) et garde la carte d'origine", () => {
    const carte = faux("carte", { carte: "creneau:c1|linkedin" });
    const d = fauxDialogue();
    const retour = tiroir.ouvrirTiroir(d, fauxDocument(carte));
    expect(d.showModal).toHaveBeenCalledTimes(1);
    expect(retour).toBe(carte);
    tiroir.ouvrirTiroir(d, fauxDocument(carte)); // déjà ouvert : rien de plus
    expect(d.showModal).toHaveBeenCalledTimes(1);
  });
  it("la fermeture ferme le dialogue et rend le focus à la carte d'origine", () => {
    const carte = faux("carte");
    const d = fauxDialogue();
    tiroir.ouvrirTiroir(d, fauxDocument(carte));
    tiroir.fermerTiroir(d, carte, fauxDocument(null));
    expect(d.close).toHaveBeenCalledTimes(1);
    expect(carte.focus).toHaveBeenCalledTimes(1);
  });
  it("carte disparue de la page (grille redessinée) : le focus va à la carte de même clé ; sinon nulle part, sans plantage", () => {
    const ancienne = faux("ancienne", {
      carte: "creneau:c1|linkedin",
      isConnected: false,
    });
    const nouvelle = faux("nouvelle");
    const d = fauxDialogue();
    tiroir.fermerTiroir(
      d,
      ancienne,
      fauxDocument(null, { '[data-carte="creneau:c1|linkedin"]': nouvelle }),
    );
    expect(nouvelle.focus).toHaveBeenCalledTimes(1);
    expect(ancienne.focus).not.toHaveBeenCalled();
    expect(() =>
      tiroir.fermerTiroir(fauxDialogue(), ancienne, fauxDocument(null)),
    ).not.toThrow();
    expect(() =>
      tiroir.fermerTiroir(fauxDialogue(), null, fauxDocument(null)),
    ).not.toThrow();
  });
  it("fermer un dialogue déjà fermé n'appelle pas close() deux fois", () => {
    const d = fauxDialogue();
    tiroir.fermerTiroir(d, null, fauxDocument(null));
    expect(d.close).not.toHaveBeenCalled();
  });
});

describe("TiroirAccessible : Échap et clic sur le voile ferment ; le focus reste dedans", () => {
  const arbre = (onFermer = vi.fn()) => ({
    onFermer,
    el: tiroir.TiroirAccessible({
      onFermer,
      "aria-label": "x",
      children: <button type="button">A</button>,
    }) as ReactNode,
  });
  const dialogue = (el: ReactNode) =>
    trouver(el, (e) => e.type === "dialog")[0];

  it("Échap (événement « cancel » natif) ne laisse pas le navigateur fermer seul : il passe par onFermer", () => {
    const { onFermer, el } = arbre();
    const evt = { preventDefault: vi.fn() };
    (dialogue(el).props.onCancel as (e: unknown) => void)(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
  it("un clic sur le voile (le dialogue lui-même) ferme ; un clic dedans ne ferme pas", () => {
    const { onFermer, el } = arbre();
    const d = dialogue(el);
    const sur = d.props.onClick as (e: unknown) => void;
    const racine = {};
    sur({ target: {}, currentTarget: racine });
    expect(onFermer).not.toHaveBeenCalled();
    sur({ target: racine, currentTarget: racine });
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
  it("piège du focus : Tab sur le dernier élément revient au premier, Maj+Tab sur le premier va au dernier", () => {
    const a = faux("a"),
      b = faux("b"),
      c = faux("c");
    const d = fauxDialogue([a, b, c]);
    const evt = (shiftKey: boolean) => ({
      key: "Tab",
      shiftKey,
      preventDefault: vi.fn(),
    });
    let e = evt(false);
    tiroir.bouclerFocus(e, d, fauxDocument(c));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(a.focus).toHaveBeenCalledTimes(1);
    e = evt(true);
    tiroir.bouclerFocus(e, d, fauxDocument(a));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(c.focus).toHaveBeenCalledTimes(1);
    e = evt(false);
    tiroir.bouclerFocus(e, d, fauxDocument(b)); // au milieu : le navigateur avance seul
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it("piège du focus : focus hors du dialogue ou dialogue sans élément focalisable, il est ramené dedans ; autre touche : rien", () => {
    const a = faux("a"),
      b = faux("b");
    const e1 = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    tiroir.bouclerFocus(e1, fauxDialogue([a, b]), fauxDocument(faux("dehors")));
    expect(e1.preventDefault).toHaveBeenCalled();
    expect(a.focus).toHaveBeenCalledTimes(1);
    const d = Object.assign(fauxDialogue([]), { focus: vi.fn() });
    const e2 = { key: "Tab", shiftKey: true, preventDefault: vi.fn() };
    tiroir.bouclerFocus(e2, d, fauxDocument(null));
    expect(e2.preventDefault).toHaveBeenCalled();
    expect(d.focus).toHaveBeenCalledTimes(1);
    const e3 = { key: "a", shiftKey: false, preventDefault: vi.fn() };
    tiroir.bouclerFocus(e3, d, fauxDocument(a));
    expect(e3.preventDefault).not.toHaveBeenCalled();
  });
  it("le clavier du dialogue branche bien le piège (onKeyDown) et garde le geste de l'appelant", () => {
    vi.stubGlobal("document", fauxDocument(null));
    const appelant = vi.fn();
    const el = tiroir.TiroirAccessible({
      onFermer: () => {},
      onKeyDown: appelant,
      children: null,
    }) as ReactNode;
    const d = dialogue(el);
    expect(typeof d.props.onKeyDown).toBe("function");
    (d.props.onKeyDown as (e: unknown) => void)({
      key: "ArrowRight",
      target: { tagName: "DIALOG" },
      currentTarget: fauxDialogue(),
      preventDefault: () => undefined,
    });
    expect(appelant).toHaveBeenCalledTimes(1);
    const tab = { key: "Tab", shiftKey: false, preventDefault: vi.fn(), currentTarget: fauxDialogue([]) as unknown as HTMLDialogElement & { focus: () => void } };
    tab.currentTarget.focus = vi.fn();
    (d.props.onKeyDown as (e: unknown) => void)({ ...tab, target: {} });
    expect(tab.preventDefault).toHaveBeenCalled(); // dialogue sans élément focalisable : le piège a joué
    vi.unstubAllGlobals();
  });
});

describe("TiroirAccessible : feuille du bas sur téléphone (375 px), moins d'animation si le système le demande", () => {
  const h = rendre(
    <tiroir.TiroirAccessible onFermer={() => {}}>x</tiroir.TiroirAccessible>,
  );
  it("à droite sur ordinateur (largeur 440 px au plus), feuille en bas à 860 px et moins (maquette)", () => {
    expect(h).toMatch(/class="[^"]*\bfixed\b[^"]*\bright-0\b/);
    expect(h).toContain("min(440px,100%)");
    expect(h).toContain("max-[860px]:inset-x-0");
    expect(h).toContain("max-[860px]:bottom-0");
    expect(h).toContain("max-[860px]:rounded-t-[18px]");
    expect(h).toContain("max-[860px]:max-h-[90vh]");
    expect(h).toContain("max-[860px]:w-full");
    expect(h).toContain("env(safe-area-inset-bottom");
  });
  it("le glissement : de la droite sur ordinateur, du bas sur téléphone", () => {
    expect(tiroir.CSS_TIROIR).toMatch(
      /@keyframes tiroir-droite[^}]*translateX\(105%\)/,
    );
    expect(tiroir.CSS_TIROIR).toMatch(
      /@keyframes tiroir-bas[^}]*translateY\(105%\)/,
    );
    expect(tiroir.CSS_TIROIR).toMatch(
      /@media \(max-width:\s*860px\)[^@]*tiroir-bas/,
    );
    expect(h).toContain("<style>");
  });
  it("moins d'animations demandé : le tiroir s'ouvre sans glissement", () => {
    expect(tiroir.CSS_TIROIR).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none/,
    );
  });
});

describe("ApercuPublication : le panneau est ce dialogue", () => {
  const props = (sur = {}) => ({
    entree: entree(),
    aujourdhui: AUJOURDHUI,
    onPrecedente: vi.fn(),
    onSuivante: vi.fn(),
    onFermer: vi.fn(),
    onChangerDate: vi.fn(),
    ...sur,
  });
  it("passe par TiroirAccessible (un <dialog>), nommé, avec Précédente / Suivante / Fermer", () => {
    const h = rendre(<ApercuPublication {...props()} />);
    expect(h).toMatch(/<dialog[ >]/);
    expect(h).toContain('aria-modal="true"');
    expect(h).toMatch(/aria-label="Aperçu de la publication LinkedIn/);
    for (const mot of ["Précédente", "Suivante", "Fermer"])
      expect(h).toContain(mot);
    expect(h).toContain('data-apercu="creneau:c1|linkedin"');
  });
  it("aucune entrée : rien (pas de dialogue vide)", () => {
    expect(ApercuPublication(props({ entree: undefined }) as never)).toBeNull();
  });
});

describe("Suivante / Précédente parcourent la liste FILTRÉE", () => {
  type CriteresFiltre =
    import("@/domaine/calendrier/regroupement").CriteresFiltre;
  function ecran(criteres?: CriteresFiltre) {
    const m = monter(SemaineAvecApercu as (p: unknown) => ReactNode, {
      entrees: quatre(),
      semaineDu: "2026-11-09",
      aujourdhui: AUJOURDHUI,
      criteres,
    });
    const grille = () =>
      trouver(m.rendre(), (e) => e.type === GrilleSemaine)[0];
    const panneau = () =>
      trouver(m.rendre(), (e) => e.type === ApercuPublication)[0];
    const ouvrir = (cle: string) =>
      (grille().props.onOuvrirEntree as (e: Entree) => void)(
        quatre().find((x) => x.cle === cle)!,
      );
    const cle = () => (panneau().props.entree as Entree).cle;
    return {
      grille,
      panneau,
      ouvrir,
      cle,
      suivante: () => (panneau().props.onSuivante as () => void)(),
      precedente: () => (panneau().props.onPrecedente as () => void)(),
    };
  }
  it("sans filtre : toutes les entrées, retour au début au bout", () => {
    const e = ecran();
    e.ouvrir("creneau:c4|linkedin");
    e.suivante();
    expect(e.cle()).toBe("creneau:c1|linkedin");
  });
  it("filtre LinkedIn : Suivante saute les entrées masquées, Précédente aussi", () => {
    const e = ecran({ reseaux: ["linkedin"], types: [], etats: [] });
    e.ouvrir("creneau:c1|linkedin");
    e.suivante();
    expect(e.cle()).toBe("creneau:c4|linkedin");
    e.suivante();
    expect(e.cle()).toBe("creneau:c1|linkedin");
    e.precedente();
    expect(e.cle()).toBe("creneau:c4|linkedin");
  });
  it("filtre par état : la grille ne reçoit que les entrées gardées", () => {
    const e = ecran({ types: [], etats: ["brouillon"] });
    expect((e.grille().props.entrees as Entree[]).map((x) => x.cle)).toEqual([
      "creneau:c2|instagram",
      "creneau:c3|tiktok",
    ]);
    e.ouvrir("creneau:c2|instagram");
    e.suivante();
    expect(e.cle()).toBe("creneau:c3|tiktok");
  });
  it("une seule entrée gardée : Suivante reste dessus ; filtre qui ne garde rien : rien ne bouge, sans plantage", () => {
    const seule = ecran({ types: ["image"], etats: [] });
    seule.ouvrir("creneau:c2|instagram");
    seule.suivante();
    expect(seule.cle()).toBe("creneau:c2|instagram");
    const vide = ecran({ reseaux: [], types: [], etats: [] });
    expect(vide.grille().props.entrees).toEqual([]);
  });
});
