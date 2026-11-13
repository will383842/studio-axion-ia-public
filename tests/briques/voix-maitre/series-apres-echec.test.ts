/**
 * GV2-08 — voix maître : après `ESSAIS_RENDU` échecs d'une phase, la machine RENDE l'état de départ avec un numéro de
 * série (jamais levé : l'appelant le garde) ; la demande suivante porte `-s<série>`. Au-delà de 3 séries : erreur non
 * réessayable. Mots estimés : aucune coupe « queue ». Doubles seulement ; la lecture payée n'est jamais appelée.
 */
import { describe, expect, it } from "vitest";
import { avancerVoixMaitre, SERIES_RENDU_MAX, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { AudioBrut } from "@/briques/voix-maitre/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";

const BRUT: AudioBrut = {
  fichierCle: "studio/test/brut.mp3",
  dureeSec: 6,
  mots: [
    { mot: "Bonjour", debutSec: 0.1, finSec: 0.6 },
    { mot: "maître", debutSec: 0.7, finSec: 1.2 },
    { mot: "Will", debutSec: 1.3, finSec: 2 },
  ],
  coutCentimes: 42,
  fournisseur: "voix-double",
  caracteres: 19,
};

/** `echoue(id)` : cette demande rend un échec réessayable. */
function doubles(echoue: (id: string) => boolean) {
  const appels: string[] = [];
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "voix-double",
    capacites: { horodatageMots: true },
    async lire() {
      appels.push("voix.lire");
      throw new Error("la lecture payée ne doit jamais être appelée");
    },
  } as unknown as FournisseurVoix;
  const stockage = { urlLecture: async (c: string) => `https://stockage.test/${c}`, urlLectureDuree: async (c: string) => `https://stockage.test/${c}`, urlDepotDuree: async (c: string) => `https://depot.test/${c}` } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      appels.push(`soumettre:${d.idRendu}`);
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (echoue(id)) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne passagère." } };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 5 } : {} };
    },
  };
  const o: OutilsVoixMaitre = {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `studio/test/base-${nom}`,
    idBase: "base",
    texte: () => "Bonjour maître Will",
    empreinte: () => "am-test",
    idVoix: "voix-42",
    caler: () => false,
    regles: REGLES_NETTOYAGE_PAR_DEFAUT,
  };
  return { o, appels, soumises };
}

/** Tours jusqu'à « faite » (états sérialisés comme dans le travail) ; une erreur levée est rendue à part. */
async function boucle(o: OutilsVoixMaitre, depart: EtatVoixMaitre, max = 80) {
  let etat = depart;
  const etats: EtatVoixMaitre[] = [];
  for (let t = 0; t < max && etat.phase !== "faite"; t++) {
    try {
      etat = JSON.parse(JSON.stringify(await avancerVoixMaitre(etat, o))) as EtatVoixMaitre;
    } catch (erreur) {
      return { etats, erreur };
    }
    etats.push(etat);
  }
  return { etats, erreur: undefined };
}

describe("GV2-08 — voix maître : séries de demandes neuves après échec", () => {
  it("nettoyage qui échoue 4 fois puis réussit : rendu de l'état de départ + demande -s1, voix terminée, aucune lecture payée", async () => {
    const { o, appels } = doubles((id) => /-nettoyage(-e[123])?$/.test(id));
    const { etats, erreur } = await boucle(o, { phase: "a-analyser", brut: BRUT });
    expect(erreur).toBeUndefined();
    expect(etats.at(-1)?.phase).toBe("faite");
    expect(etats.some((e) => e.phase === "a-analyser" && e.serie === 1)).toBe(true);
    expect(appels).toContain("soumettre:base-analyse-s1");
    expect(appels).toContain("soumettre:base-nettoyage-s1");
    expect(appels.filter((a) => a === "voix.lire")).toEqual([]);
  });

  it("l'échec de la 4e demande ne lève pas : l'état rendu est gardé par l'appelant", async () => {
    const { o } = doubles((id) => /-nettoyage(-e[123])?$/.test(id));
    let etat: EtatVoixMaitre = { phase: "a-analyser", brut: BRUT };
    // analyse, nettoyage, puis 3 relances : la lecture du 4e échec rend l'état neuf (6 tours).
    for (let t = 0; t < 6; t++) etat = await avancerVoixMaitre(etat, o);
    expect(etat).toEqual({ phase: "a-analyser", brut: BRUT, serie: 1 });
  });

  it("4 séries ratées : erreur non réessayable avec un message clair", async () => {
    const { o } = doubles((id) => id.includes("-nettoyage"));
    const { erreur } = await boucle(o, { phase: "a-analyser", brut: BRUT });
    expect(SERIES_RENDU_MAX).toBe(3);
    expect(erreur).toBeInstanceOf(ErreurRendu);
    expect((erreur as ErreurRendu).reessayable).toBe(false);
    expect((erreur as ErreurRendu).message).toBe("Le traitement de la voix a échoué plusieurs fois.");
  });

  it("mesure qui échoue 4 fois : retour à « a-mesurer » avec série, demande -s1", async () => {
    const { o, appels } = doubles((id) => /-mesure-l1(-e[123])?$/.test(id));
    let etat: EtatVoixMaitre = { phase: "a-mesurer", brut: BRUT, texte: "Bonjour maître Will", prises: [] };
    for (let t = 0; t < 5; t++) etat = await avancerVoixMaitre(etat, o); // mesure, 3 relances, puis série neuve
    expect(etat).toMatchObject({ phase: "a-mesurer", serie: 1 });
    etat = await avancerVoixMaitre(etat, o);
    expect(appels).toContain("soumettre:base-mesure-l1-s1");
  });

  it("mots estimés : aucune coupe « queue » (tout le son après le dernier mot est gardé)", async () => {
    const { o, soumises } = doubles(() => false);
    const { etats } = await boucle(o, { phase: "a-analyser", brut: { ...BRUT, approximatif: "non-relie" } });
    expect(etats.at(-1)?.phase).toBe("faite");
    const demande = soumises.get("base-nettoyage")!;
    const coupures = demande.parametres.coupures as { debutSec: number; finSec: number }[];
    expect(coupures.some((c) => c.finSec >= BRUT.dureeSec - 0.001)).toBe(false);
  });

  it("mots réels : la queue est toujours coupée (comportement d'avant)", async () => {
    const { o, soumises } = doubles(() => false);
    await boucle(o, { phase: "a-analyser", brut: BRUT });
    const coupures = soumises.get("base-nettoyage")!.parametres.coupures as { debutSec: number; finSec: number }[];
    expect(coupures.some((c) => c.finSec >= BRUT.dureeSec - 0.001)).toBe(true);
  });
});
