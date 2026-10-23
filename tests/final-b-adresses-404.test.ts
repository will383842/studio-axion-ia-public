/**
 * Correcteur final B — VERIF-E2E-2, gêne 3 : /nouvelle/<inconnu>, /ecrire/tournage/<inconnu> et
 * /ecrire/sujets/<inconnu>/lire/<inconnu> affichaient « Cette page n'existe pas » avec le statut 200. Le proxy les
 * vérifie maintenant auprès de /api/fiches, comme les autres fiches.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const recherche = await import("@/services/recherche");
const { ficheDeChemin } = await import("@/proxy");

beforeEach(() => reinitialiserDepots());

describe("proxy : quelles adresses sont vérifiées", () => {
  it("les trois pages oubliées sont reconnues", () => {
    expect(ficheDeChemin("/nouvelle/inconnu")).toEqual({ type: "nouvelle", id: "inconnu" });
    expect(ficheDeChemin("/ecrire/tournage/s-inconnue")).toEqual({ type: "seances", id: "s-inconnue" });
    expect(ficheDeChemin("/ecrire/sujets/sm-1/lire/var-2")).toEqual({ type: "lectures", id: "sm-1|var-2" });
  });

  it("les fiches déjà couvertes restent couvertes ; les pages fixes et les listes ne le sont pas", () => {
    expect(ficheDeChemin("/videos/v-1")).toEqual({ type: "videos", id: "v-1" });
    expect(ficheDeChemin("/ecrire/sujets/sm-1")).toEqual({ type: "sujets", id: "sm-1" });
    expect(ficheDeChemin("/videos/a-ranger")).toBeNull();
    // Vérif V3 : « Mes animations » est une vraie page de la Bibliothèque, pas une rubrique « animations » inconnue.
    expect(ficheDeChemin("/bibliotheque/animations")).toBeNull();
    expect(ficheDeChemin("/nouvelle")).toBeNull();
    expect(ficheDeChemin("/ecrire/tournage")).toBeNull();
    expect(ficheDeChemin("/ecrire/sujets/%E0%A4%/lire/x")).toBeNull();
  });
});

describe("/api/fiches : existence des nouvelles pages", () => {
  it("nouvelle vidéo : un format connu existe, un inconnu non", async () => {
    expect(await recherche.ficheExiste("nouvelle", "avocat")).toBe(true);
    expect(await recherche.ficheExiste("nouvelle", "inconnu")).toBe(false);
  });

  it("séance de tournage : inconnue ou rangée → n'existe pas", async () => {
    expect(await recherche.ficheExiste("seances", "s-inconnue")).toBe(false);
    await depots().sessionsTournage.enregistrer({ id: "s-essai", varianteIds: [], prises: {}, etat: "a-filmer", creeLe: new Date().toISOString() } as never);
    expect(await recherche.ficheExiste("seances", "s-essai")).toBe(true);
    await depots().sessionsTournage.modifier("s-essai", { archiveLe: new Date().toISOString() } as never);
    expect(await recherche.ficheExiste("seances", "s-essai")).toBe(false);
  });

  it("« Je lis » : la version doit appartenir au sujet et avoir un texte à lire", async () => {
    const v = { id: "var-essai", scriptMaitreId: "sm-essai", prompteur: "1. Bonjour" };
    await depots().variantes.enregistrer(v as never);
    expect(await recherche.ficheExiste("lectures", `${v.scriptMaitreId}|${v.id}`)).toBe(true);
    expect(await recherche.ficheExiste("lectures", `autre-sujet|${v.id}`)).toBe(false);
    expect(await recherche.ficheExiste("lectures", `${v.scriptMaitreId}|inconnue`)).toBe(false);
    expect(await recherche.ficheExiste("lectures", "sans-separateur")).toBe(false);
  });

  it("la route accepte les nouveaux types (session exigée)", async () => {
    const { GET } = await import("@/app/api/fiches/[type]/[id]/route");
    const r = await GET(new Request("http://local/api/fiches/nouvelle/inconnu"), { params: Promise.resolve({ type: "nouvelle", id: "inconnu" }) });
    expect(r.status === 401 || (await r.json()).existe === false).toBe(true);
  });
});
