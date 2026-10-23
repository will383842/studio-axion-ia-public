/**
 * Lot R6 — chef correcteur après la relecture EXACTITUDE (REFUSÉ, tête 3ab20bf,
 * `docs/controles/RELECTURE-R6-EXACTITUDE-3ab20bf.md`). Deux vrais défauts, deux fausses informations à Will :
 *
 *  n° 1 — l'aligneur réel retiré (adresse retirée, plus inscrit) PENDANT le calage de la voix : la simulation prenait le
 *         relais et renvoyait l'estimation telle quelle, comptée comme un calage réussi (aucune alerte). Désormais la
 *         cause est « non relié » : seul un aligneur réel compte comme calage (règle unique `causeApproximation`).
 *  n° 2 — maquette approximative, puis fabrication qui RÉUTILISE son audio maître (sans repayer la voix) : la cause
 *         était perdue en route, la vidéo finale sortait sans alerte. Elle suit désormais la piste `audio-maitre`.
 *
 * Voix, aligneur et rendu injectés ou simulés : aucun appel réseau, aucune dépense. Les deux tests échouent sur 3ab20bf
 * (preuve dans docs/OUTILS-REELS-R6.md).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat, moteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerAlignementSimule } = await import("@/fournisseurs/simulation/alignement");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeAlignement, DemandeRendu, EtatAlignement, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP = "essai-r6-correcteur";
const T0 = Date.UTC(2026, 9, 3, 16, 0, 0);
const APPROXIMATIFS = /Sous-titres approximatifs/;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

afterEach(() => vi.restoreAllMocks());

const stockage = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}`,
  urlLectureDuree: async (cle, sec) => `https://r2.exemple/${cle}?valable=${sec}`,
  urlDepotDuree: async (cle) => `https://r2.exemple/${cle}?depot`,
});

function fauxRendu(): ServiceRendu {
  const etats = new Map<string, EtatRendu>();
  return {
    async soumettre(d: DemandeRendu) {
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 11, lufs: -14 } : { dureeSec: 11 } });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
}

/** Une voix réelle (imitée) qui ne donne PAS l'horodatage de ses mots : on n'a qu'une estimation. */
const VOIX_SANS_HORODATAGE: FournisseurVoix = {
  ...fournisseurVoixSimulation,
  id: "heygen",
  mode: "reel",
  capacites: { ...fournisseurVoixSimulation.capacites, horodatageMots: false },
  async lire(d) {
    const r = await fournisseurVoixSimulation.lire(d);
    return { ...r, fichierCle: "studio/prod/voix/heygen-essai.mp3", mots: [] };
  },
};
const voixSansHorodatage = () => VOIX_SANS_HORODATAGE;

const horloge = { t: T0 };

async function voixJusquAuBout(m: MoteurVideo, c: CommandeFabrication): Promise<Travail> {
  horloge.t = T0;
  let t = await m.lancer(c, { travailId: "t-r6c", versionId: "ver-r6c", titre: "R6", maintenant: T0 });
  for (; horloge.t < T0 + 30 * 60_000 && t.etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; horloge.t += 5_000) {
    t = (await m.avancer(t, c, horloge.t)).travail;
    if (t.statut === "echec") throw new Error(JSON.stringify(t.erreur));
  }
  return t;
}

async function jusquAuBout(m: MoteurVideo, c: CommandeFabrication): Promise<ResultatFabrication> {
  let travail = await m.lancer(c, { travailId: "t-r6c-fab", versionId: "ver-r6c-fab", titre: "Fabrication", maintenant: T0 });
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await m.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine") return resultat!;
    if (travail.statut === "echec") throw new Error(JSON.stringify(travail.erreur));
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

/* ------------------------------------------------------------------ */
describe("R6 correcteur n° 1 · ROUGE — aligneur réel devenu simulation pendant le calage", () => {
  it("le « calage » fait par la simulation n'est pas un vrai calage : sous-titres approximatifs, cause « non relié »", async () => {
    let retire = false;
    const demandes: DemandeAlignement[] = [];
    // Aligneur réel : accepte la demande, répond « en cours »… puis Will retire son adresse.
    const reel = {
      id: "studio-aligneur",
      type: "alignement",
      nom: "Calage des sous-titres",
      reelPrevu: "studio-aligneur",
      mode: "reel",
      capacites: { asynchrone: true, accordExige: false },
      soumettre: async (d: DemandeAlignement) => void demandes.push(d),
      suivre: async (): Promise<EtatAlignement> => {
        retire = true;
        return { statut: "en_cours", progression: 0.1 };
      },
    } as unknown as FournisseurAlignement;
    const simule = creerAlignementSimule();
    const m = creerMoteurMontageAvocat({ rendu: creerServiceRenduSimule(() => horloge.t), stockage, alignement: () => (retire ? simule : reel), voix: voixSansHorodatage });
    const t = await voixJusquAuBout(m, await fabrication.construireCommande("v-03"));
    expect(demandes).toHaveLength(1);
    expect(retire).toBe(true);
    const audio = (t.parametres?.voix as { audio: { sousTitresApproximatifs?: string } }).audio;
    expect(audio.sousTitresApproximatifs).toBe("non-relie");
  });
});

/* ------------------------------------------------------------------ */
describe("R6 correcteur n° 2 · ROUGE — maquette approximative, puis fabrication qui réutilise son audio maître", () => {
  it("la cause suit l'audio maître : la vidéo fabriquée garde l'alerte, et la voix n'est pas repayée", async () => {
    // Voix sans horodatage, calage non relié : la maquette est approximative (« non relié »).
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, voix: voixSansHorodatage, pauseMs: 0 });
    vi.spyOn(moteurMontageAvocat, "maquette").mockImplementation((c, o) => m.maquette!(c, o));
    await fabrication.maquetteRapide("v-03");

    // Fabrication : le service transmet l'audio maître de la maquette (même texte, même voix).
    const { versionId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const commande = (await depots().versions.obtenir(versionId))!.commande;
    expect(commande.audioMaitre?.fichierCle).toBeTruthy();

    const lire = vi.spyOn(VOIX_SANS_HORODATAGE, "lire");
    const r = await jusquAuBout(m, commande);
    expect(lire).not.toHaveBeenCalled(); // réutilisée : pas relue, pas repayée
    expect((r.projetMontage.audioMaitre as { reutilise: boolean }).reutilise).toBe(true);
    const alertes = r.noteQualite!.alertes.map((a) => a.message);
    expect(alertes.find((x) => APPROXIMATIFS.test(x))).toMatch(/Réglages > Connexions/);
  });
});
