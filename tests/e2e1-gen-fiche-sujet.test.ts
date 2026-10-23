/**
 * Vérification E2E n° 1 du générateur : ce que montre la fiche sujet (rendu serveur, sans clic).
 *  - n° 1 : un ajout arrêté APRÈS la numérotation est montré (jamais en silence) ;
 *  - n° 4 : une version « je lis » ne propose jamais « Fabriquer » (double + voix) ;
 *  - n° 15 : « Hors du domaine » ne propose pas d'ajouter une matière ;
 *  - n° 17 : limite à valider → « Valider les N » visible et verrouillé, « Validez la limite ci-dessus » ;
 *  - n° 20 : « Plus court » absent sur une version au voyant « corps court » ; retouches restantes affichées ;
 *  - n° 7 : « Corriger une phrase · 0 € » proposé.
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

const { FicheSujet } = await import("@/components/generateur/FicheSujet");

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
  etatCase: "a-relire",
  etat: "a-relire",
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

const rendre = (p: Props) => renderToStaticMarkup(createElement(FicheSujet, p));

describe("E2E-1 · fiche sujet", () => {
  it("n° 1 : un ajout arrêté après la numérotation est montré, avec ce qu'il faut", () => {
    const html = rendre(base({ manque: { libelle: "Il manque une matière", ceQuIlFaudrait: "Plan refusé · 0 €." } }));
    expect(html).toContain("L&#x27;ajout s&#x27;est arrêté");
    expect(html).toContain("Plan refusé · 0 €.");
    expect(html).toContain("Ajouter et reprendre");
  });

  it("n° 15 : hors du domaine, pas d'ajout de matière ; « Garder en idée » seulement", () => {
    const html = rendre(base({ numero: undefined, manque: { libelle: "Hors du domaine", ceQuIlFaudrait: "Ce sujet s'éloigne des activités d'Axion-IA.", horsDomaine: true } }));
    expect(html).not.toContain("Ajouter et écrire");
    expect(html).not.toContain("Votre matière");
    expect(html).toContain("Garder en idée");
    // Un manque ordinaire garde la saisie d'une matière.
    expect(rendre(base({ numero: undefined, manque: { libelle: "Il manque une matière", ceQuIlFaudrait: "Une scène vécue" } }))).toContain("Ajouter et écrire");
  });

  it("n° 17 : limite à valider → « Valider les N » verrouillé et la raison dite", () => {
    const html = rendre(base({ limite: { texte: "Sauf si…", validee: false }, versions: [version({ etat: "a-completer" }), version({ id: "v2", code: "0002-AV-IG", reseau: "instagram", etat: "a-completer" })] }));
    expect(html).toContain("Valider les 2");
    expect(html).toContain("Validez la limite ci-dessus.");
  });

  it("n° 4, 7, 20 : détail d'une version (je lis sans « Fabriquer », corps court sans « Plus court », correction gratuite)", () => {
    const jeLis = version({ etat: "validee", prompteur: "Texte à lire", code: "0002-AV-TT-L" });
    const court = version({ id: "v3", code: "0002-AV-YT", reseau: "youtube-shorts", corpsCourt: true, retouchesRestantes: 2, phrases: [{ id: "g1", texte: "Une phrase." }] });
    const html = rendreDeplie([jeLis, court]);
    expect(html.jeLis).not.toContain("Fabriquer");
    expect(html.jeLis).toContain("Lire sur un autre appareil");
    expect(html.court).not.toContain("Plus court");
    expect(html.court).toContain("Autre accroche");
    // Relecture du script (grande chaîne) : « Relire et modifier » (0 €) remplace « Corriger une phrase ».
    expect(html.court).toContain("Relire et modifier");
    expect(html.court).not.toContain("Corriger une phrase");
    expect(html.court).toContain("2 retouches payantes possibles");
  });
});

/** Rend chaque version dépliée d'emblée (`versionOuverteInitiale`). */
function rendreDeplie(versions: Version[]): { jeLis: string; court: string } {
  const [jeLis, court] = versions.map((v) => rendre(base({ versions: [v], versionOuverteInitiale: v.id })));
  return { jeLis, court };
}
