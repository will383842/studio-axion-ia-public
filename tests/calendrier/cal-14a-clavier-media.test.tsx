/**
 * CAL-14A (corrections) : comportement du média du tiroir. Sans DOM (le dépôt n'a ni jsdom ni testing-library) :
 * on pilote les composants avec le mini-moteur de crochets, et on fait « remonter » l'événement du média au tiroir à la main.
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

const { monter, trouver, texteDe } = await import("../aides/crochets-factices");
const { ApercuMedia } = await import("@/components/calendrier/ApercuMedia");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");
const { entreeDepuisPublication } = await import("@/components/calendrier/apercu-reseau");

type El = ReactElement<Record<string, unknown>>;
type Gestionnaire = (e: unknown) => void;

const PAGES = ["https://s.test/1.png", "https://s.test/2.png", "https://s.test/3.png"];

/** Événement clavier de doublure : `preventDefault` le marque comme déjà traité, comme dans le navigateur. */
function touche(key: string) {
  const e = {
    key,
    target: { tagName: "BUTTON" },
    defaultPrevented: false,
    preventDefault: vi.fn(() => {
      e.defaultPrevented = true;
    }),
    stopPropagation: vi.fn(),
  };
  return e;
}
const gestionnaire = (n: ReactNode, test: (e: El) => boolean): Gestionnaire => trouver(n, test)[0].props.onKeyDown as Gestionnaire;

const pub = (extra: Record<string, unknown> = {}) => ({ id: "p1", reseau: "linkedin", statut: "programmee", via: "manuel", date: "2030-01-02T09:00:00.000Z", texte: "Un texte", ...extra });
const entree = (extra: Record<string, unknown> = {}) => ({ ...entreeDepuisPublication(pub() as never), ...extra }) as ReturnType<typeof entreeDepuisPublication>;
function tiroir(e: ReturnType<typeof entreeDepuisPublication>) {
  const onSuivante = vi.fn();
  const onPrecedente = vi.fn();
  const onFermer = vi.fn();
  const props = { entree: e, aujourdhui: "2030-01-01", onPrecedente, onSuivante, onFermer, onChangerDate: () => {} };
  return { onSuivante, onPrecedente, onFermer, props, arbre: () => ApercuPublication(props) as ReactNode };
}

describe("CAL-14A — corrections de la relecture", () => {
  it("une entrée « video » dont le média est une image ne rend aucun lecteur vidéo", () => {
    const t = tiroir(entree({ type: "video", media: { genre: "image", url: "https://s.test/a.png", poster: null, ratio: "1:1" } }));
    const html = renderToStaticMarkup(<ApercuPublication {...t.props} />);
    expect(html).not.toContain("<video");
    expect(html).toContain("s.test/a.png");
  });

  it("une flèche sur le carrousel tourne la page et NE change PAS de publication", () => {
    const t = tiroir(entree({ type: "carrousel", media: { genre: "image", url: null, pages: PAGES } }));
    const arbre = t.arbre();
    const media = monter(ApercuMedia, { type: "carrousel", pages: PAGES });
    const surCarrousel = gestionnaire(media.rendre(), (e) => e.type === "section");
    const surTiroir = gestionnaire(arbre, (e) => e.type === "aside");

    const fleche = touche("ArrowRight");
    surCarrousel(fleche);
    expect(fleche.stopPropagation).toHaveBeenCalled();
    expect(texteDe(media.rendre())).toContain("Page 2 sur 3");
    // Même si l'événement remontait quand même, le tiroir le voit déjà traité.
    surTiroir(fleche);
    expect(t.onSuivante).not.toHaveBeenCalled();

    // Une flèche hors du carrousel change bien de publication.
    surTiroir(touche("ArrowRight"));
    expect(t.onSuivante).toHaveBeenCalledTimes(1);
  });

  it("Échap ferme seulement la vue agrandie ; le second Échap ferme le tiroir", () => {
    const t = tiroir(entree({ type: "infographie", media: { genre: "image", url: "https://s.test/info.png", pages: ["https://s.test/info.png"] } }));
    const surTiroir = gestionnaire(t.arbre(), (e) => e.type === "aside");
    const media = monter(ApercuMedia, { type: "infographie", url: "https://s.test/info.png", pages: [] });

    const agrandir = trouver(media.rendre(), (e) => e.type === "button" && texteDe(e).startsWith("Agrandir"))[0];
    (agrandir.props.onClick as () => void)();
    const dialogue = trouver(media.rendre(), (e) => e.props.role === "dialog")[0];
    expect(dialogue).toBeDefined();

    const premier = touche("Escape");
    (dialogue.props.onKeyDown as Gestionnaire)(premier);
    expect(premier.stopPropagation).toHaveBeenCalled();
    expect(trouver(media.rendre(), (e) => e.props.role === "dialog")).toHaveLength(0);
    surTiroir(premier);
    expect(t.onFermer).not.toHaveBeenCalled();

    surTiroir(touche("Escape"));
    expect(t.onFermer).toHaveBeenCalledTimes(1);
  });

  it("changer de publication repart de zéro : ApercuMedia est clé par l'entrée", () => {
    const t = tiroir(entree({ type: "carrousel", cle: "publication:p9|linkedin", media: { genre: "image", url: null, pages: PAGES } }));
    const media = trouver(t.arbre(), (e) => e.type === ApercuMedia)[0];
    expect(media.key).toBe("publication:p9|linkedin");
  });

  it("TikTok : la légende d'un carrousel ne recouvre pas les boutons de pages", () => {
    const html = renderToStaticMarkup(<ApercuPublication {...tiroir(entree({ reseau: "tiktok", type: "carrousel", texte: "Ma légende", media: { genre: "image", url: null, pages: PAGES } })).props} />);
    expect(html).toContain("Ma légende");
    expect(html).not.toMatch(/<p[^>]*absolute[^>]*>Ma légende/);
  });

  it("lien expiré : l'erreur du lecteur, de l'image du carrousel et de l'infographie dit « Le lien a expiré »", () => {
    const cas: { type: "video" | "carrousel" | "infographie"; balise: string }[] = [
      { type: "video", balise: "video" },
      { type: "carrousel", balise: "img" },
      { type: "infographie", balise: "img" },
    ];
    for (const { type, balise } of cas) {
      const m = monter(ApercuMedia, { type, url: "https://s.test/x", pages: PAGES });
      expect(trouver(m.rendre(), (e) => e.props.role === "status" && texteDe(e).includes("expiré"))).toHaveLength(0);
      (trouver(m.rendre(), (e) => e.type === balise)[0].props.onError as () => void)();
      const phrase = trouver(m.rendre(), (e) => e.props.role === "status");
      expect(phrase.map((p) => texteDe(p))).toContain("Le lien a expiré : rechargez la page.");
      expect(trouver(m.rendre(), (e) => e.type === balise)).toHaveLength(0);
    }
  });
});
