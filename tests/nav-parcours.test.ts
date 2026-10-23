/**
 * Vérification de la navigation (03/10/2026) : ce que montrent les écrans corrigés (rendu serveur, sans clic).
 *  - fiche sujet : la vidéo d'une version se voit et s'ouvre sans déplier la ligne (« Voir la vidéo » / « en fabrication ») ;
 *  - fiche vidéo : « Publier · n/N » n'est plus un bouton muet (il mène aux vérifications) ;
 *  - menu : « Mesures » est joignable depuis la barre latérale et la feuille « Plus ».
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/ecrire/sujets/s1",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => undefined,
  notFound: () => undefined,
}));
vi.mock("@/app/(studio)/ecrire/sujets/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: null })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: null })) }));
vi.mock("@/components/publication/ContexteVideo", () => ({
  useVideo: () => ({ ouvrir: () => undefined, publiable: false, nbCochees: 1, kit: { envoiSimule: true }, casesRequises: ["image", "son", "sousTitres", "droits"] }),
}));
vi.mock("@/components/partage/FeuillePartager", () => ({ FeuillePartager: () => null }));
vi.mock("@/components/publication/FeuilleEnvoyerBuffer", () => ({ FeuilleEnvoyerBuffer: () => null }));
vi.mock("@/components/publication/FeuilleTelecharger", () => ({ FeuilleTelecharger: () => null }));

const { FicheSujet, enFabrication } = await import("@/components/generateur/FicheSujet");
const { BarreActionsVideo } = await import("@/components/publication/BarreActionsVideo");
const { NAV_LATERALE, TUILES_PLUS } = await import("@/components/coquille/navigation");

type Props = Parameters<typeof FicheSujet>[0];
type Version = Props["versions"][number];

const version = (x: Partial<Version>): Version => ({
  id: "v1",
  code: "0002-AV-TT",
  reseau: "tiktok",
  ligne: "Avocat",
  accroche: "Votre équipe recopie encore",
  texte: "Texte",
  dureeSec: 30,
  etatCase: "validee",
  etat: "validee",
  souci: null,
  note: 0,
  version: 1,
  aUneVersionAvant: false,
  gardeFous: [],
  ...x,
});

const base = (x: Partial<Props> = {}): Props => ({
  id: "s1",
  numero: 2,
  idee: "Idée",
  etat: "à relire",
  archive: false,
  manque: null,
  limite: null,
  lignes: [],
  versions: [version({})],
  reseauActif: null,
  reseauxSujet: ["tiktok"],
  ajouts: { formatId: "avocat", jeLis: false, tu: false, autresFormats: [] },
  ordre: ["tiktok"],
  heures: {},
  aDesVideos: false,
  ...x,
});

const fab = (x: Partial<NonNullable<Version["fabrication"]>> = {}): NonNullable<Version["fabrication"]> => ({ videoId: "vid-1", attendMere: false, attendConfirmation: false, points: [], enCours: false, ...x });

describe("navigation · fiche sujet", () => {
  it("une version fabriquée montre « Voir la vidéo » sans être dépliée", () => {
    const html = renderToStaticMarkup(createElement(FicheSujet, base({ versions: [version({ videoId: "vid-1", fabrication: fab() })] })));
    expect(html).toContain("Voir la vidéo");
    expect(html).toContain('href="/videos/vid-1"');
  });

  it("une version en route montre « Vidéo en fabrication » (et ouvre la vidéo)", () => {
    const html = renderToStaticMarkup(createElement(FicheSujet, base({ versions: [version({ videoId: "vid-2", fabrication: fab({ videoId: "vid-2", enCours: true }) })] })));
    expect(html).toContain("Vidéo en fabrication");
    expect(html).toContain('href="/videos/vid-2"');
  });

  it("une version sans vidéo ne montre aucun lien de vidéo", () => {
    const html = renderToStaticMarkup(createElement(FicheSujet, base()));
    expect(html).not.toContain("Voir la vidéo");
    expect(html).not.toContain("Vidéo en fabrication");
  });

  it("« en route » couvre la file, la fabrication et les attentes (mère, crédit) : la fiche se rafraîchit alors seule", () => {
    expect(enFabrication(undefined)).toBe(false);
    expect(enFabrication(fab())).toBe(false);
    expect(enFabrication(fab({ enCours: true }))).toBe(true);
    expect(enFabrication(fab({ attendMere: true }))).toBe(true);
    expect(enFabrication(fab({ attendCredit: true }))).toBe(true);
  });
});

describe("navigation · fiche vidéo", () => {
  it("« Publier · 1/4 » reste touchable (il mène aux vérifications au lieu de ne rien faire)", () => {
    const html = renderToStaticMarkup(createElement(BarreActionsVideo));
    expect(html).toContain("Publier · 1/4");
    const bouton = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Publier · 1\/4/)?.[0] ?? "";
    expect(bouton).not.toMatch(/\sdisabled(=|\s|>)/);
  });
});

describe("navigation · menu", () => {
  it("« Mesures » est dans la barre latérale et dans la feuille « Plus »", () => {
    expect(NAV_LATERALE.some((e) => e.href === "/mesures" && e.libelle === "Mesures")).toBe(true);
    expect(TUILES_PLUS.some((e) => e.href === "/mesures" && e.libelle === "Mesures")).toBe(true);
  });
});
