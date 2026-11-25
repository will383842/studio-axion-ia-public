/**
 * PHRASE-2 · rendu : la page maquette sans pièce montre la cause et les boutons (au lieu d'être vide), le suivi des rôles aussi,
 * et la barre dit « En pause » au lieu d'« encore … min ». Rendu serveur seulement, dépôts en mémoire, 0 €.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/hooks/useTravaux", () => ({ useTravaux: ({ initial }: { initial: unknown[] }) => ({ travail: initial[0] }) }));
vi.mock("@/components/tutoriel-outil/PieceCreee", () => ({ PieceCreee: () => <div data-testid="piece" /> }));

import type { Travail } from "@/domaine/types";
import { CarteArret } from "@/components/tutoriel-outil/CarteArret";
import { ListeRoles, SuiviRoles } from "@/components/tutoriel-outil/SuiviRoles";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { arretLisible, MESSAGE_EQUIPE_BLOQUEE, vueRoles } from "@/moteurs/montage-tutoriel-outil/vue-roles";

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const PageMaquette = (await import("@/app/(studio)/tutoriel-outil/maquette/[videoId]/page")).default;

const T = "2026-11-25T09:00:00.000Z";
const VIDEO = "vid_phrase2";
const REMARQUES = ["Écran 1, zone 1 : champ inconnu « titre »", "Écran 1, zone 2 : champ inconnu « sous »", "Écran 2, zone 1 : champ inconnu « x »", "quatrième"];
const travailPilote = (): Travail =>
  ({
    id: "trv_phrase2",
    type: "fabrication",
    cibleId: VIDEO,
    titre: "Tutoriel",
    etapes: [{ cle: "script", nom: "Le script", icone: "film", dependDe: [], statut: "en_cours", progression: 50, sortieFichierIds: [] }],
    statut: "en_cours",
    progression: 0,
    tentatives: 1,
    cleIdempotence: "k",
    fournisseurUtilise: "studio",
    creeLe: T,
    modifieLe: T,
    parametres: {
      pause: { code: "TO_EQUIPE_BLOQUEE", message: "Une étape de préparation n'a pas abouti : réessayez ou collez votre script." },
      tutoriel: { roles: [{ role: "maquettiste", etat: "a-revoir", le: T }], equipe: { remarques: { maquettiste: REMARQUES } } },
    },
  }) as unknown as Travail;

beforeEach(async () => {
  reinitialiserDepots();
  await depots().videos.enregistrer({ id: VIDEO, titre: "Mon tutoriel", statut: "en_fabrication", creeLe: T, modifieLe: T } as never);
  await depots().travaux.enregistrer(travailPilote());
});

describe("page maquette sans pièce", () => {
  it("montre la cause, le détail replié et « Coller mon script » ; ni vide, ni « Voir la maquette », ni « Réessayer »", async () => {
    const html = renderToStaticMarkup(await PageMaquette({ params: Promise.resolve({ videoId: VIDEO }) }));
    expect(html).toContain("La maquette proposée n&#x27;avait pas la forme attendue");
    expect(html).toContain("Ce qui a été relevé");
    expect(html).toContain("champ inconnu « titre »");
    expect(html).not.toContain("quatrième");
    expect(html).toMatch(/<a[^>]*href="\/tutoriel-outil"[^>]*>Coller mon script<\/a>/);
    expect(html).not.toContain("Voir la maquette");
    expect(html).not.toMatch(/réessay/i);
    expect(html).not.toContain("Rien à voir pour l");
  });
});

describe("composants", () => {
  it("CarteArret : « Voir la maquette » quand il y a une pièce", () => {
    const t = { ...travailPilote(), parametres: { ...travailPilote().parametres, tutoriel: { equipe: { pieceCreee: { proposition: 1 } } }, pause: { code: "TO_PIECE_A_VALIDER" } } } as never;
    const html = renderToStaticMarkup(<CarteArret arret={arretLisible(t, VIDEO)!} />);
    expect(html).toMatch(new RegExp(`<a[^>]*href="/tutoriel-outil/maquette/${VIDEO}"[^>]*>Voir la maquette</a>`));
  });

  it("ListeRoles : la ligne du maquettiste porte la cause (sans carte)", () => {
    const html = renderToStaticMarkup(<ListeRoles lignes={vueRoles(travailPilote())} />);
    expect(html).toContain("La maquette proposée n&#x27;avait pas la forme attendue");
  });

  it("barre : « En pause » remplace « encore … min » ; sans l'option, l'affichage d'avant", () => {
    const vue = { etat: "en-cours" as const, etapes: [], progression: 0, resteSec: 120, suivi: { resteMin: 2 } };
    const pause = renderToStaticMarkup(<SuiviFabrication vue={{ ...vue, enPause: true } as never} />);
    expect(pause).toContain("En pause");
    expect(pause).not.toContain("encore");
    expect(renderToStaticMarkup(<SuiviFabrication vue={vue as never} />)).toContain("encore 2 min");
  });
});

describe("la cause ne s'affiche qu'une fois", () => {
  const compter = (html: string, texte: string) => html.split(texte).length - 1;
  it.each([
    ["TO_EQUIPE_BLOQUEE", "La maquette proposée n&#x27;avait pas la forme attendue"],
    ["TO_PIECE_A_REVOIR", "La pièce de la vidéo a un point à revoir"],
    ["TO_DEVIS_A_ACCEPTER", "Le devis attend votre accord."],
    ["TO_CAS_V2", "Une décision message unique"],
    ["TO_CODE_INCONNU", "Un message unique du moteur"],
    ["TO_SCRIPT_NON_ECRIT", "Le script attend votre texte"],
  ])("%s : une seule occurrence (carte ou ligne)", (code, texte) => {
    const t = travailPilote();
    (t.parametres as Record<string, unknown>).pause = { code, message: code === "TO_CAS_V2" ? "Une décision message unique" : code === "TO_CODE_INCONNU" ? "Un message unique du moteur" : undefined };
    if (code === "TO_EQUIPE_BLOQUEE") (t.parametres as Record<string, unknown>).pause = { code, message: "Une étape de préparation n'a pas abouti : réessayez ou collez votre script." };
    const html = renderToStaticMarkup(<SuiviRoles initial={t as never} videoId={VIDEO} />);
    expect(compter(html, texte)).toBe(1);
  });
});

describe("raison du réalisateur venue de Claude : aucun montant affiché", () => {
  it("zoneId = « kpi-12,50€ » : ni sur la carte du suivi, ni sur la page maquette", async () => {
    const t = travailPilote();
    (t.parametres as Record<string, unknown>).pause = { code: "TO_EQUIPE_BLOQUEE", message: `${MESSAGE_EQUIPE_BLOQUEE} (Phrase 2 : la zone kpi-12,50€ n'existe pas dans la carte.)` };
    (t.parametres as Record<string, unknown>).tutoriel = { roles: [{ role: "chef-de-projet", etat: "fait", le: T }, { role: "scenariste", etat: "fait", le: T }] };
    await depots().travaux.enregistrer(t);
    const suivi = renderToStaticMarkup(<SuiviRoles initial={t as never} videoId={VIDEO} />);
    const maquette = renderToStaticMarkup(await PageMaquette({ params: Promise.resolve({ videoId: VIDEO }) }));
    for (const html of [suivi, maquette]) {
      expect(html).toContain("Le découpage de la vidéo en scènes n&#x27;a pas pu se faire.");
      expect(html).not.toMatch(/12,50|€|Raison/);
    }
  });
});
