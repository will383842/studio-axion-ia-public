/** V3-E : tranche bout en bout EN MÉMOIRE, avec un faux serveur de rendu. Aucun appel payant, aucun crédit réservé. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const demandes: DemandeRendu[] = [];
const fauxRendu: ServiceRendu = {
  async soumettre(d) {
    demandes.push(d);
    return { idRendu: d.idRendu };
  },
  async etat(id): Promise<EtatRendu> {
    const d = demandes.find((x) => x.idRendu === id);
    return { statut: "termine", sortieCle: d?.sortie.cle ?? "", mesures: { debordements: 0, taillePoliceMin: 28 } };
  },
};
vi.mock("@/fournisseurs/rendu/client", async (original) => ({ ...(await original<typeof import("@/fournisseurs/rendu/client")>()), obtenirServiceRendu: () => fauxRendu }));
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<typeof import("@/services/_commun")>()),
  fournisseur: async () => ({
    urlDepotDuree: async (cle: string) => `https://r2.exemple/depot/${cle}?sig=secret`,
    urlLectureDuree: async (cle: string) => `https://r2.exemple/lecture/${cle}?sig=secret`,
    urlLecture: async (cle: string) => `/lecture/${cle}`,
  }),
}));

import { reinitialiserDepots, depots } from "@/donnees/memoire";
import { definirGenerateur } from "@/visuels/interrupteur";
import { ecrireParametre } from "@/services/_commun";
import { listerVideos } from "@/services/videos";
import * as credits from "@/services/credits";
import { creerDepuisSujet, deposerSession, ErreurVisuel, lancerRendu, refaire, valider } from "@/visuels/services/carrousels";
import { mettreALaCorbeille, restaurer } from "@/visuels/services/corbeille";
import { ficheCarrousel, listerCarrousels } from "@/visuels/services/vues";
import { dependancesCarrousels } from "@/visuels/services/production";
import { relancerRenduAction } from "../../src/app/(studio)/carrousels/[id]/actions";
import { restaurerDepuisListeAction } from "../../src/app/(studio)/carrousels/actions";

vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
const apres: Array<() => Promise<void>> = [];
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ after: (f: () => Promise<void>) => void apres.push(f) }));

describe("tranche bout en bout des carrousels", () => {
  const fetchEspion = vi.fn(async () => new Response("{}"));
  beforeEach(() => {
    reinitialiserDepots();
    demandes.length = 0;
    apres.length = 0;
    vi.stubGlobal("fetch", fetchEspion);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchEspion.mockClear();
  });

  it("éteint : refus ; allumé : sujet → à valider → PDF → validé → corbeille → restauré", async () => {
    const reserver = vi.spyOn(credits, "reserverCredits");
    const reservationsAvant = (await depots().reservations.lister(() => true)).length;
    const videosAvant = (await listerVideos({ inclureArchivees: true })).length;
    const deps = dependancesCarrousels();

    await ecrireParametre("carrousels.actif", false);
    await expect(creerDepuisSujet("Cinq erreurs inventées au lancement", deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    expect(await depots().visuels.lister(() => true)).toHaveLength(0);

    await definirGenerateur("carrousels", true);
    const { id } = await creerDepuisSujet("Cinq erreurs inventées au lancement", deps);
    expect((await depots().visuels.obtenir(id))?.statut).toBe("ecrit");

    await lancerRendu(id, deps);
    const rendu = await depots().visuels.obtenir(id);
    expect(rendu?.statut).toBe("a_valider");
    expect(rendu?.rendu?.pdfCle).toMatch(/\.pdf$/);
    expect(rendu?.rendu?.pages.length).toBeGreaterThan(0);
    for (const p of rendu!.rendu!.pages) {
      expect(p.x1Cle).toMatch(/\.jpg$/);
      expect(p.x2Cle).toMatch(/\.jpg$/);
    }

    const fiche = await ficheCarrousel(id, deps);
    expect(fiche.pdfUrl).toContain("carrousel.pdf");
    expect(fiche.actionsPermises).toContain("valider");

    await valider(id, deps);
    expect((await depots().visuels.obtenir(id))?.statut).toBe("valide");

    expect(await mettreALaCorbeille([id], deps)).toEqual({ mises: 1 });
    expect(await listerCarrousels("tous", deps)).toHaveLength(0);
    expect(await listerCarrousels("corbeille", deps)).toHaveLength(1);
    expect(await restaurer([id], deps)).toEqual({ restaurees: 1 });
    expect(await listerCarrousels("valides", deps)).toHaveLength(1);

    // Aucun appel payant, aucun crédit, aucun carrousel dans les vidéos.
    expect(fetchEspion).not.toHaveBeenCalled();
    expect(reserver).not.toHaveBeenCalled();
    expect(await depots().reservations.lister(() => true)).toHaveLength(reservationsAvant);
    const videos = await listerVideos({ inclureArchivees: true });
    expect(videos).toHaveLength(videosAvant);
    expect(videos.some((v) => v.id === id)).toBe(false);
  });

  it("le texte n'est jamais écrit par l'API payante", async () => {
    const deps = dependancesCarrousels();
    expect(deps.texte({ type: "sujet", sujet: "Sujet inventé" }).mode).not.toBe("api");
    expect(deps.texte({ type: "paquet-session", contenu: "{}" }).mode).not.toBe("api");
    expect(ErreurVisuel).toBeDefined();
  });

  it("la porte ignore la casse et les accents des expressions interdites, sans fait disponible", async () => {
    const ctx = await dependancesCarrousels().contextePorte();
    expect(ctx.faitsDisponibles).toBe(false);
    expect(ctx.interditsDans("Un texte tout à fait neutre sans rien d'interdit.")).toEqual([]);
    for (const t of ["Nous intervenons à VILLEEXEMPLE", "Un résultat garanti", "Vous allez gagner du temps", "Aucun gain GARANTI", "Finançable par le CPF"]) {
      expect(ctx.interditsDans(t), t).not.toHaveLength(0);
    }
  });

  it("un carrousel dont une page contient « garanti » est bloqué par la porte (rouge)", async () => {
    await definirGenerateur("carrousels", true);
    const spec = {
      version: "carrousel/1",
      alt: "Carrousel d'exemple sur le rangement d'un bureau",
      pages: [
        { type: "T01", titre: "Ranger son bureau", sousTitre: "Un geste après l'autre" },
        { type: "T06", titre: "Un résultat garanti", points: [{ texte: "Vider le plateau" }, { texte: "Trier les papiers" }, { texte: "Essuyer la surface" }] },
        { type: "T21" },
      ],
    };
    const paquet = { version: "paquet-session-carrousel/1", sujet: "Ranger son bureau", titre: "Ranger son bureau", pourquoi: ["Couverture.", "Réflexes.", "Invitation."], spec };
    const { id } = await deposerSession(JSON.stringify(paquet), dependancesCarrousels());
    const v = await depots().visuels.obtenir(id);
    expect(v?.rapport?.verdict).toBe("rouge");
    expect(v?.statut).toBe("bloque");
  });

  it("générateur éteint : on peut trier l'existant (valider, corbeille, restaurer), pas fabriquer (créer, rendre, refaire)", async () => {
    const deps = dependancesCarrousels();
    await definirGenerateur("carrousels", true);
    const a = (await creerDepuisSujet("Cinq erreurs inventées au lancement", deps)).id;
    await lancerRendu(a, deps);
    const b = (await creerDepuisSujet("Trois gestes inventés pour demain", deps)).id;
    await lancerRendu(b, deps);
    await definirGenerateur("carrousels", false);

    await valider(a, deps);
    expect((await depots().visuels.obtenir(a))?.statut).toBe("valide");
    expect(await mettreALaCorbeille([b], deps)).toEqual({ mises: 1 });
    expect(await restaurer([b], deps)).toEqual({ restaurees: 1 });

    await expect(creerDepuisSujet("Un autre sujet inventé ici", deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    await expect(lancerRendu(b, deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
    await expect(refaire(b, deps)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT" });
  });

  it("« Relancer le rendu » générateur éteint : erreur claire GENERATEUR_ETEINT, rien n'est planifié", async () => {
    const deps = dependancesCarrousels();
    await definirGenerateur("carrousels", true);
    const { id } = await creerDepuisSujet("Cinq erreurs inventées au lancement", deps);
    await definirGenerateur("carrousels", false);
    const donnees = new FormData();
    donnees.set("id", id);
    await expect(relancerRenduAction(donnees)).rejects.toThrow(`REDIRECT:/carrousels/${id}?erreur=GENERATEUR_ETEINT`);
    expect(apres).toHaveLength(0);
  });

  it("restaurer depuis la liste un carrousel absent de la corbeille : message INTROUVABLE", async () => {
    const donnees = new FormData();
    donnees.set("id", "vis_00000000-0000-4000-8000-000000000000");
    await expect(restaurerDepuisListeAction(donnees)).rejects.toThrow("REDIRECT:/carrousels?vue=corbeille&erreur=INTROUVABLE");
  });
});
