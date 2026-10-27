/**
 * MODE « SCRIPT COMPLET » · le dépôt d'un script par les VRAIS services (`deposerScriptImageVideo` → `lancerAvecAccord` →
 * boucle avec le VRAI moteur), concepteur SIMULÉ : rien n'est payé, aucun fichier image, AUCUN appel d'écriture.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { appelerConceptionEnSimulation } from "@/moteurs/montage-image-video/texte/simulation";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { carteFixe, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { PREFIXE_DECISIONS } = await import("@/services/image-video");
const ecran = await import("@/services/image-video-ecran");
const texte = await import("@/services/image-video-texte");
const { tourDeBoucle } = await import("@/services/boucle");
const { brancherServicesImageVideo } = await import("@/moteurs/montage-image-video");
const { RESEAUX_IV } = await import("@/domaine/image-video/plafonds");
const { ID_FORMAT_IMAGE_VIDEO } = await import("@/formats/image-video");
const { Depot } = await import("@/components/formats/image-video/Depot");
const { DepotScript } = await import("@/components/formats/image-video/DepotScript");

const MDP = "image-video-depot-script";
const SCRIPT =
  "Vingt-trois heures quatorze. Un client vous écrit. Vous dormez, lui attend. Sauf si quelqu'un lui répond tout de suite. Le chatbot lit la demande, puis la réponse part en quatre secondes. Le ticket se ferme tout seul. Un e-mail propre part à la bonne équipe. Une alerte tombe sur Telegram. Le client est prévenu : réponse sous deux heures. Votre client a toujours une réponse.";
const lectures: string[] = [];
const ecritures: string[] = [];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  lectures.length = 0;
  ecritures.length = 0;
  await auth.seConnecter(MDP, false);
  brancherServicesImageVideo({
    outils: async (commande) => {
      const gardees = async () => lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${commande.videoId}`, null);
      const base = outilsSimules(carteFixe("C"), monde());
      return {
        ...base,
        ecriture: {
          ...base.ecriture,
          appeler: async (role, entree) => {
            ecritures.push(role.id);
            return base.ecriture.appeler(role, entree);
          },
        },
        lireImageSource: async (cle) => {
          lectures.push(cle);
          return null;
        },
        lecture: { convertir: base.lecture.convertir, appeler: appelerConceptionEnSimulation(lectureDeCarte(carteFixe("C"))) },
        decisions: { carte: async () => ((await gardees())?.carte ?? null) as never, script: async () => ((await gardees())?.script ?? null) as never },
      };
    },
  });
});

const videosIV = () => depots().videos.lister((v) => v.formatId === ID_FORMAT_IMAGE_VIDEO);

describe("Image → vidéo · script complet · le dépôt", () => {
  it("refuse en phrases (vide, trop court, plus de 300 mots, plus de 4000 caractères) avant tout prix, brouillon ou dépense", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const trois_cent_un = Array.from({ length: 301 }, () => "mot").join(" ");
    for (const t of ["", "   ", "Facture client", trois_cent_un, "x".repeat(4001)]) {
      const issue = await texte.deposerScriptImageVideo({ script: t, reseaux: [...RESEAUX_IV], accordCentimes: 100000 });
      expect(issue.statut, t.slice(0, 20)).toBe("refusee");
      expect((issue as { phrase: string }).phrase).toMatch(/[a-zé]/);
    }
    // 300 mots pile : accepté (le refus ne vient pas de la longueur).
    const pile = await texte.deposerScriptImageVideo({ script: Array.from({ length: 300 }, () => "mot").join(" "), reseaux: [...RESEAUX_IV] });
    expect(pile.statut).not.toBe("refusee");
    expect(await videosIV()).toEqual([]);
    expect(ecritures).toEqual([]);
  });

  it("sans accord du prix : le prix « au plus » est redemandé, rien n'est créé", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const issue = await texte.deposerScriptImageVideo({ script: SCRIPT, reseaux: [...RESEAUX_IV] });
    expect(issue).toMatchObject({ statut: "accord-requis", centimes: ecran.prixDuDepot(RESEAUX_IV, (await ecran.etatDepotImageVideo()).tauxUsdEur) });
    expect(await videosIV()).toEqual([]);
  });

  it("script → carte à valider : mots gardés, même prix, aucun fichier lu, AUCUN appel d'écriture", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const montant = (await ecran.etatDepotImageVideo()).montantCentimes;
    const issue = await texte.deposerScriptImageVideo({ script: SCRIPT, reseaux: [...RESEAUX_IV], accordCentimes: montant });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    if (issue.statut !== "lancee") return;
    const travail = await depots().travaux.trouver((t) => t.cibleId === issue.videoId);
    const version = (await depots().versions.obtenir(travail!.versionId!))!;
    expect(version.commande.entrees.imageVideo).toMatchObject({ texte: SCRIPT, scriptColle: true, reseaux: [...RESEAUX_IV], plafondCentimes: montant });
    expect((version.commande.entrees.imageVideo as { imageCle: string }).imageCle).toMatch(/^texte:[0-9a-f]{16}$/);
    expect((await depots().videos.obtenir(issue.videoId))?.coutEstime?.centimes).toBe(montant);

    // Le moteur valide la carte (réglage « automatique ») ou la propose ; le script collé passe ensuite à la voix SANS écriture.
    const faite = async () => {
      const v = (await ecran.vueImageVideo(issue.videoId)) as { ecran: string; fabrication?: { pas: { cle: string; etat: string }[] } } | null;
      if (v?.ecran === "carte") expect(await ecran.validerCarteEtReprendre(issue.videoId, undefined)).toEqual({ statut: "reprise" });
      return v?.fabrication?.pas.find((p) => p.cle === "script-a-valider")?.etat === "fait" || v?.ecran === "script";
    };
    for (let i = 0; i < 14 && !(await faite()); i++) await tourDeBoucle();
    expect(await faite(), JSON.stringify((await depots().travaux.obtenir(travail!.id))?.erreur)).toBe(true);
    expect(lectures).toEqual([]);
    expect(ecritures).toEqual([]);
  });
});

describe("Image → vidéo · script complet · l'écran de dépôt", () => {
  it("les TROIS entrées sont visibles : « Déposer une image », « Décrire avec mes mots », « Coller mon script complet »", () => {
    const html = renderToStaticMarkup(createElement(Depot, { montants: { 4: 250 } }));
    expect(html).toContain("Déposer une image");
    expect(html).toContain("Décrire avec mes mots");
    expect(html).toContain("Coller mon script complet");
  });

  it("l'écran du script : même bouton « au plus » que le mode texte, compteur de mots, bouton inactif tant que le script est vide", () => {
    const html = renderToStaticMarkup(createElement(DepotScript, { script: "", onScript: () => undefined, reseaux: [...RESEAUX_IV], montant: 250, onRefus: () => undefined }));
    expect(html).toContain("Concevoir le schéma et fabriquer la vidéo (au plus");
    expect(html).toContain("0 mot sur 300 au plus");
    expect(html).toContain("disabled");
  });
});
