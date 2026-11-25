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
vi.mock("@/components/tutoriel-outil/PieceCreee", () => ({ PieceCreee: () => <div data-testid="piece" /> }));

import type { Travail } from "@/domaine/types";
import { CarteArret } from "@/components/tutoriel-outil/CarteArret";
import { ListeRoles } from "@/components/tutoriel-outil/SuiviRoles";
import { ProgressionEtapes } from "@/components/ui/ProgressionEtapes";
import { arretLisible, vueRoles } from "@/moteurs/montage-tutoriel-outil/vue-roles";

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

  it("ListeRoles : la ligne du maquettiste porte la cause", () => {
    const html = renderToStaticMarkup(<ListeRoles lignes={vueRoles(travailPilote())} />);
    expect(html).toContain("La maquette proposée n&#x27;avait pas la forme attendue");
  });

  it("barre : « En pause » remplace « encore … min » ; sans l'option, l'affichage d'avant", () => {
    const base = { etapes: [], progression: 0, suivi: { resteMin: 2 } };
    expect(renderToStaticMarkup(<ProgressionEtapes {...base} enPause />)).toContain("En pause");
    expect(renderToStaticMarkup(<ProgressionEtapes {...base} enPause />)).not.toContain("encore");
    expect(renderToStaticMarkup(<ProgressionEtapes {...base} />)).toContain("encore 2 min");
  });
});
