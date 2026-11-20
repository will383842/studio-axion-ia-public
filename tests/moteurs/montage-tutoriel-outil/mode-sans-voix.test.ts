/** T-EXT-SV : mode « sans voix » du tutoriel d'outil (pur, 0 €, aucun appel réel : la voix est un double qui compte ses appels). */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { formatTutorielOutil } from "@/formats/tutoriel-outil";
import { bornesPersonnages, CLE_ENTREE_MODE_VOIX, distributionAdmise, entreeModeVoix, lireModeVoix, MODE_AVEC_VOIX, MODE_SANS_VOIX } from "@/formats/tutoriel-outil/mode-sans-voix";
import { VOIX_MAITRE_HEYGEN_ID, VoixNonEpingleeError } from "@/briques/voix-maitre/voix-epinglee";
import { avancerEtape, ErreurTutoriel, etatInitial, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { controlerLongueurScript } from "@/moteurs/montage-tutoriel-outil/diffusion-tutoriel";
import { ENTREE_TUTORIEL, estSansVoix, lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { moteurMontageTutorielOutil } from "@/moteurs/montage-tutoriel-outil";

const TEXTE = "Ouvrez Calendly. Cliquez sur Nouvel événement. Tapez le titre de la rencontre. Choisissez une durée de trente minutes. Enregistrez, puis copiez le lien.";

function commande(sansVoix: boolean, personnages: number): CommandeFabrication {
  return {
    versionContrat: 2,
    videoId: "v-sv",
    formatId: "tutoriel-outil",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["4:5"],
    script: { blocs: [], texteComplet: TEXTE },
    distribution: Array.from({ length: personnages }, () => ({ role: "voix", personnageId: "p1", source: "double" })),
    entrees: { [ENTREE_TUTORIEL]: { scriptColle: true, ...(sansVoix ? entreeModeVoix(MODE_SANS_VOIX) : {}) } },
    reglages: {},
    plans: [],
    prononciations: [],
    styles: {},
    briques: {},
  } as unknown as CommandeFabrication;
}

/** Outils dont la voix est un piège : le moindre appel fait échouer le test. */
function outilsPieges(idVoix = VOIX_MAITRE_HEYGEN_ID) {
  const appel = vi.fn(() => {
    throw new Error("la voix ne doit pas être appelée");
  });
  const voix = { voix: appel, stockage: appel, aligneur: appel, rendu: appel, renduEstSimule: () => false, idVoix, reglages: {}, tauxUsdEur: 1, fournisseurVoix: "heygen", caler: () => false, regles: [], cle: (n: string) => n, avantLecture: appel } as unknown as OutilsTutoriel["voix"];
  return { appel, outils: { voix, claude: vi.fn() } as unknown as OutilsTutoriel };
}

const etatAvecScript = (c: CommandeFabrication): EtatTutoriel => ({ ...etatInitial(c), script: { texte: TEXTE, source: "colle", remarques: [] } });

describe("mode sans voix : règle du format", () => {
  it("le défaut reste avec voix ; seul « sans-voix » exact allume le mode", () => {
    expect(lireModeVoix(undefined)).toBe(MODE_AVEC_VOIX);
    expect(lireModeVoix({})).toBe(MODE_AVEC_VOIX);
    expect(lireModeVoix({ [CLE_ENTREE_MODE_VOIX]: "Sans-voix" })).toBe(MODE_AVEC_VOIX);
    expect(lireModeVoix({ [CLE_ENTREE_MODE_VOIX]: MODE_SANS_VOIX })).toBe(MODE_SANS_VOIX);
    expect(entreeModeVoix(MODE_AVEC_VOIX)).toEqual({});
  });
  it("0 personnage n'est admis QUE sans voix", () => {
    expect(distributionAdmise(MODE_SANS_VOIX, 0)).toBe(true);
    expect(distributionAdmise(MODE_AVEC_VOIX, 0)).toBe(false);
    expect(distributionAdmise(MODE_AVEC_VOIX, 1)).toBe(true);
    expect(distributionAdmise(MODE_AVEC_VOIX, 2)).toBe(false);
    expect(bornesPersonnages(MODE_AVEC_VOIX).min).toBe(1);
    expect(formatTutorielOutil.personnages.min).toBe(bornesPersonnages(MODE_SANS_VOIX).min);
    expect(formatTutorielOutil.personnages.max).toBe(1);
    expect(formatTutorielOutil.musique).toBe("interdite");
  });
  it("l'entrée est relue par le moteur", () => {
    const c = commande(true, 0);
    expect(estSansVoix(c.entrees)).toBe(true);
    expect(lireEntreesTutoriel(c.entrees).sansVoix).toBe(true);
    expect(estSansVoix(commande(false, 1).entrees)).toBe(false);
  });
});

describe("mode sans voix : la chaîne", () => {
  it("0 appel de voix, 0 €, aucune réserve, rythme = vitesse de lecture", async () => {
    const c = commande(true, 0);
    const { appel, outils } = outilsPieges();
    const pas = await avancerEtape("voix", etatAvecScript(c), c, outils, "t1");
    expect(pas.statut).toBe("faite");
    const audio = pas.etat.audio!;
    expect(audio.fournisseur).toBe("aucune");
    expect(audio.coutCentimes).toBe(0);
    expect(audio.caracteres).toBe(0);
    expect(audio.fichierCle).toBeUndefined();
    expect(audio.mots.length).toBe(TEXTE.split(/\s+/).length);
    expect(audio.dureeSec).toBeGreaterThan(5);
    expect(pas.etat.reserves).toEqual([]);
    expect(appel).not.toHaveBeenCalled();
  });
  it("même si une voix est reliée par erreur, elle n'est jamais appelée", async () => {
    const c = commande(true, 1);
    const { appel, outils } = outilsPieges();
    const pas = await avancerEtape("voix", etatAvecScript(c), c, outils, "t1");
    expect(pas.etat.audio?.fournisseur).toBe("aucune");
    expect(appel).not.toHaveBeenCalled();
  });
  it("les sous-titres sont présents (calage sans étape voix)", async () => {
    const c = commande(true, 0);
    const { appel, outils } = outilsPieges();
    const pas = await avancerEtape("calage", etatAvecScript(c), c, outils, "t1");
    expect(pas.statut).toBe("faite");
    expect(pas.etat.sousTitres!.length).toBeGreaterThan(0);
    expect(pas.etat.motsPlan!.length).toBe(TEXTE.split(/\s+/).length);
    expect(appel).not.toHaveBeenCalled();
  });
  it("durée hors cible : une remarque, jamais un refus", () => {
    const r = controlerLongueurScript(TEXTE, 2500);
    expect(r.length).toBeLessThanOrEqual(1);
    expect(r.every((x) => !x.bloquante)).toBe(true);
  });
});

describe("mode sans voix : coût", () => {
  it("aucune ligne « voix », total 0 €", async () => {
    const e = await moteurMontageTutorielOutil.estimer(commande(true, 0));
    expect(e.lignes.some((l) => l.etape === "Voix" || l.unite === "caractere")).toBe(false);
    expect(e.total.centimes).toBe(0);
  });
  it("mode avec voix inchangé : la ligne « voix » HeyGen reste", async () => {
    const e = await moteurMontageTutorielOutil.estimer(commande(false, 1));
    const voix = e.lignes.find((l) => l.etape === "Voix");
    expect(voix?.fournisseur).toBe("heygen");
    expect(voix?.quantite).toBe(TEXTE.length);
  });
});

describe("mode avec voix : règles inchangées", () => {
  it("0 personnage sans le mode sans voix : refus clair (jamais un muet silencieux)", async () => {
    const c = commande(false, 0);
    const { outils } = outilsPieges();
    await expect(avancerEtape("voix", etatAvecScript(c), c, outils, "t1")).rejects.toBeInstanceOf(ErreurTutoriel);
  });
  it("une voix qui n'est pas la voix HeyGen maître reste refusée avant tout appel (L1-05)", async () => {
    const c = commande(false, 1);
    const { appel, outils } = outilsPieges("une-autre-voix");
    outils.voix!.fournisseurVoix = "elevenlabs";
    await expect(avancerEtape("voix", etatAvecScript(c), c, outils, "t1")).rejects.toBeInstanceOf(VoixNonEpingleeError);
    expect(appel).not.toHaveBeenCalled();
  });
  it("sans voix reliée : la vidéo sort muette avec sa réserve, comme avant", async () => {
    const c = commande(false, 1);
    const pas = await avancerEtape("voix", etatAvecScript(c), c, { claude: vi.fn() } as unknown as OutilsTutoriel, "t1");
    expect(pas.etat.audio?.fournisseur).toBe("aucune");
    expect(pas.etat.reserves.some((r) => r.includes("muette"))).toBe(true);
  });
});
