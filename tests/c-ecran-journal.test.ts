/**
 * AUDIT C · ÉCRAN — le Journal des Réglages ne montre jamais un nom de service interne.
 *
 * Défaut constaté : choisir un service écrivait « Service « son » : studio-rendu choisi » (nom interne du type et
 * identifiant du registre). Attendu : le titre lisible du service (Réglages > Connexions) et le nom simple du
 * catalogue, ex. « Son et mixage : Serveur du studio choisi ». Les ANCIENNES lignes déjà en base ne sont pas effacées :
 * elles sont traduites à l'affichage par la même règle.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { phraseChoixService, traduireLigneJournal } from "@/fournisseurs/journal-lisible";
import { TITRES_SERVICES } from "@/fournisseurs/titres";
import { TITRES_SERVICES as TITRES_ECRAN } from "@/components/reglages/Connexions";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/reglages" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.setConfig({ testTimeout: 60_000 });

const MDP = "essai-c-ecran-journal";
const environnementDepart = { ...process.env };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

afterAll(() => {
  process.env = { ...environnementDepart };
  vi.resetModules();
});

/** Rien d'interne dans une ligne du Journal. */
const INTERNE = /studio-rendu|studio-aligneur|texte-reseaux|web-push-email|remotion-lambda|« [a-z0-9-]+ »|\bclaude choisi|[Ss]imulation/;

describe("Audit C · Journal lisible", () => {
  it("la liste des titres est partagée et toujours exportée par l'écran Connexions", () => {
    expect(TITRES_ECRAN).toBe(TITRES_SERVICES);
    expect(TITRES_SERVICES.son).toBe("Son et mixage");
  });

  it("phrase d'un choix : titre du service + nom simple du catalogue", () => {
    expect(phraseChoixService("son", "studio-rendu")).toBe("Son et mixage : Serveur du studio choisi");
    expect(phraseChoixService("texte-reseaux", "claude")).toBe("Textes de publication : Claude choisi");
    expect(phraseChoixService("son", "simulation")).toBe("Son et mixage remis en mode essai");
    expect(phraseChoixService("montage", "inconnu-x")).toBe("Montage : nouveau service choisi");
  });

  it("les anciennes lignes déjà en base sont traduites à l'affichage", () => {
    expect(traduireLigneJournal("Service « son » : studio-rendu choisi")).toBe("Son et mixage : Serveur du studio choisi");
    expect(traduireLigneJournal("Service « texte-reseaux » : claude choisi")).toBe("Textes de publication : Claude choisi");
    expect(traduireLigneJournal("Service « publication » remis en simulation")).toBe("Publication remis en mode essai");
    expect(traduireLigneJournal("Service « voix » remis en mode essai")).toBe("Voix remis en mode essai");
    expect(traduireLigneJournal("Vidéo prête")).toBe("Vidéo prête");
  });

  it("ROUGE — choisir un service écrit une phrase simple, et le Journal traduit les anciennes lignes", async () => {
    vi.resetModules();
    process.env.STUDIO_RENDU_URL = "http://studio-rendu:4100";
    const complements = await import("@/services/C-videos-publication-complements");
    const reglages = await import("@/services/reglages");
    const auth = await import("@/services/auth");
    const { depots } = await import("@/services/_commun");
    (await import("@/donnees/memoire")).reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);

    const ancienne = "2020-01-01T00:00:00.000Z";
    await depots().evenements.enregistrer({ id: "ev-ancien", type: "connexion", message: "Service « texte-reseaux » : claude choisi", date: ancienne, creeLe: ancienne, modifieLe: ancienne });

    await complements.definirFournisseur("son", "studio-rendu");
    await complements.definirFournisseur("etalonnage", "simulation");

    const brut = (await depots().evenements.lister()).map((e) => e.message);
    expect(brut).toContain("Son et mixage : Serveur du studio choisi");
    expect(brut).toContain("Étalonnage des couleurs remis en mode essai");
    expect(brut).toContain("Service « texte-reseaux » : claude choisi"); // l'ancienne ligne n'est pas effacée

    const affiche = (await reglages.listerJournal(500)).map((e) => e.message);
    expect(affiche).toContain("Textes de publication : Claude choisi");
    for (const m of affiche) expect(m).not.toMatch(INTERNE);
    delete process.env.STUDIO_RENDU_URL;
  });
});
