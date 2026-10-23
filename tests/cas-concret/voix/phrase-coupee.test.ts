/**
 * 17/10 (test réel, v-99d2f6353f41, cas « recrutement-apporteurs ») : la voix s'arrêtait à « La voix » sur l'accroche
 * « On recrute nos collaborateurs en quinze minutes. », refusée 3 fois « hésitation ou souffle après « recrute » », et
 * chaque lecture refusée était payée (1,05 € pour une vidéo sans voix ; même échec sur 3 vidéos le 14/10).
 *
 * Cause : HeyGen horodate la fin de « recrute » trop tôt (essai réel du 14/10 : fini à 0,72 s, entendu jusqu'à 0,92 s).
 * Le « blanc » mesuré partait de cette heure : il contenait la fin du mot, mesurée à −17 dB, prise pour un « euh ».
 * Chaque lecture neuve est horodatée de la même façon : le même refus, payé trois fois. Doubles seulement.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { FaitCas } from "@/formats/cas-concret/cas";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";
import { scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
import type { PauseAMesurer } from "@/moteurs/montage-cas-concret/outils";
import {
  avancerVoixCasConcret,
  etatInitialVoixCasConcret,
  pausesAMesurer,
  REGLES_BLANCS_CAS_CONCRET,
  rouvrirApresArret,
  type EtatVoixCasConcret,
  type OutilsAvancerVoix,
} from "@/moteurs/montage-cas-concret/voix";

const ACCROCHE = "On recrute nos collaborateurs en quinze minutes.";
const CORPS = `${ACCROCHE} Oui, quinze minutes.`;

/** Horodatage HeyGen de la lecture : « recrute » donné fini à 0,72 s (entendu jusqu'à 0,92 s), « nos » à 1,10 s. */
const MOTS_HEYGEN: MotHorodate[] = [
  { mot: "On", debutSec: 0.1, finSec: 0.3 },
  { mot: "recrute", debutSec: 0.34, finSec: 0.72 },
  { mot: "nos", debutSec: 1.1, finSec: 1.25 },
  { mot: "collaborateurs", debutSec: 1.29, finSec: 2.0 },
  { mot: "en", debutSec: 2.04, finSec: 2.2 },
  { mot: "quinze", debutSec: 2.24, finSec: 2.5 },
  { mot: "minutes.", debutSec: 2.54, finSec: 2.95 },
  { mot: "Oui,", debutSec: 3.3, finSec: 3.45 },
  { mot: "quinze", debutSec: 3.55, finSec: 3.8 },
  { mot: "minutes.", debutSec: 3.84, finSec: 4.25 },
];
/** Ce que le son contient vraiment dans ce blanc : la fin de « recrute », jusqu'à 0,92 s ; puis le silence. */
const PAROLE_REELLE = { deSec: 0.72, aSec: 0.92 };

interface Journal {
  lus: string[];
  mesures: PauseAMesurer[];
  lecturesAPayer: number;
}

/** `niveau` : le niveau rendu par la mesure d'une fenêtre (défaut : −17 dB si elle touche la parole réelle, sinon −50). */
function doubles(j: Journal, niveau?: (p: PauseAMesurer) => number): OutilsAvancerVoix {
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "heygen",
    mode: "simulation",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string }) {
      j.lus.push(d.texte);
      const mots = d.texte === CORPS ? structuredClone(MOTS_HEYGEN) : d.texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: 0.1 + i * 0.4, finSec: 0.4 + i * 0.4 }));
      return { fichierCle: `studio/test/brut-${j.lus.length}.mp3`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, cout: { centimes: 35, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    urlLecture: async (cle: string) => `https://stockage.test/${cle}`,
    urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`,
    urlDepotDuree: async (cle: string) => `https://depot.test/${cle}`,
  } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 5 } : {} };
    },
  };
  const touche = (p: PauseAMesurer) => p.deSec < PAROLE_REELLE.aSec && p.aSec > PAROLE_REELLE.deSec;
  return {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `studio/test/voix/${nom}`,
    idVoix: "voix-will",
    fournisseurVoix: "heygen",
    caler: () => false,
    regles: REGLES_BLANCS_CAS_CONCRET,
    assembler: async () => {
      throw new Error("non utilisé");
    },
    mesurerPauses: async (_cle, pauses) => {
      j.mesures.push(...pauses);
      return pauses.map((p) => (niveau ? niveau(p) : touche(p) ? -17 : -50));
    },
    reformuler: async () => {
      throw new Error("un script validé n'est jamais reformulé");
    },
    faits: [] as FaitCas[],
    texteFige: true,
    arretSiRefusIdentique: true,
    avantLecture: () => {
      j.lecturesAPayer++;
    },
  };
}

async function jusquAuBout(o: OutilsAvancerVoix, depart: EtatVoixCasConcret): Promise<EtatVoixCasConcret> {
  let etat = depart;
  for (let i = 0; i < 80 && !etat.issue; i++) etat = JSON.parse(JSON.stringify(await avancerVoixCasConcret(etat, o))) as EtatVoixCasConcret;
  return etat;
}

const neuf = (): Journal => ({ lus: [], mesures: [], lecturesAPayer: 0 });

describe("voix du cas concret · l'accroche « On recrute nos collaborateurs en quinze minutes. » (v-99d2f6353f41)", () => {
  it("la phrase n'est jamais coupée : le script v4 la répartit sur deux écrans, la voix la lit d'un seul tenant", () => {
    const script = scriptValideDuCatalogue("recrutement-apporteurs")!;
    // 18/10 : le catalogue porte l'accroche validée par Will (« Nos collaborateurs, on les recrute en… »), plus récente
    // que celle de la v4 d'origine que les autres tests de ce fichier (ACCROCHE) gardent pour le comportement de la voix.
    expect(script.ecrans.slice(0, 2).map((e) => e.texteDit)).toEqual(["Nos collaborateurs, on les recrute en", "quinze minutes. Oui, quinze minutes."]);
    expect(texteDuCorps({ ecrans: script.ecrans.map((e) => ({ texteDit: e.texteDit })) } as Parameters<typeof texteDuCorps>[0])).toMatch(/^Nos collaborateurs, on les recrute en quinze minutes\. Oui, quinze minutes\. /);
  });

  it("la fin de « recrute » horodatée trop tôt par HeyGen n'est pas prise pour un « euh » : une seule lecture, voix faite", async () => {
    const j = neuf();
    const fin = await jusquAuBout(doubles(j), etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus).toEqual([CORPS]);
    expect(fin.payees).toHaveLength(1);
    // La mesure porte sur le CŒUR du blanc, hors de la marge d'erreur de l'horodatage.
    expect(j.mesures).toHaveLength(1);
    expect(j.mesures[0].deSec).toBeGreaterThanOrEqual(PAROLE_REELLE.aSec);
    expect(j.mesures[0].aSec).toBeLessThanOrEqual(1.1);
    expect(Math.round((j.mesures[0].aSec - j.mesures[0].deSec) * 1000)).toBeGreaterThanOrEqual(80);
  });

  it("un vrai « euh » au milieu du blanc reste refusé", async () => {
    const j = neuf();
    const fin = await jusquAuBout(doubles(j, () => -17), etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    expect(fin.issue).toMatchObject({ statut: "arret", phrase: ACCROCHE });
  });

  it("deux refus identiques sur la même phrase : arrêt SANS payer de 3e lecture, avec une explication et une proposition", async () => {
    const j = neuf();
    const fin = await jusquAuBout(doubles(j, () => -17), etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    expect(j.lus).toEqual([CORPS, CORPS]);
    expect(j.lecturesAPayer).toBe(2);
    expect(fin.payees).toHaveLength(2);
    if (fin.issue?.statut !== "arret") throw new Error("pas d'arrêt");
    expect(fin.issue.phrase).toBe(ACCROCHE);
    // 17/10 : script validé qui hésite, relu sans succès (sans 3e lecture payée) : le conseil renvoie vers « Relire le script » et R03.
    expect(fin.issue.message).toMatch(/^La voix hésite sur « recrute » \(-17 dB\)\. Reformulez la phrase dans « Relire le script »/);
    expect(fin.issue.message).toMatch(/mot exact de la promesse/);
    expect(fin.issue.message).toMatch(/R03/);
    expect(fin.issue.conseil).toBeTruthy();
    // Un état arrêté ne bouge plus, et « Réessayer » sur ce même refus ne paie rien de plus.
    const repris = await jusquAuBout(doubles(j, () => -17), rouvrirApresArret(fin));
    expect(repris.issue?.statut).toBe("arret");
    expect(j.lus).toHaveLength(2);
  });

  it("deux refus DIFFÉRENTS ne déclenchent pas l'arrêt anticipé (la 3e lecture reste permise)", async () => {
    const j = neuf();
    let n = 0;
    // 1re lecture : « euh » après « recrute » ; 2e : le blanc après « recrute » est propre mais c'est un autre refus.
    const o = doubles(j, () => (++n === 1 ? -17 : -50));
    const voix = o.voix();
    const lire = voix.lire.bind(voix);
    voix.lire = async (d) => {
      const r = await lire(d);
      if (j.lus.length === 2) r.mots = r.mots.map((m) => (m.mot === "nos" ? { ...m, mot: "vos" } : m));
      return r;
    };
    const fin = await jusquAuBout(o, etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    expect(j.lus).toEqual([CORPS, CORPS, CORPS]);
    expect(fin.issue).toEqual({ statut: "faite" });
  });

  it("« Reprendre cette étape » après l'arrêt d'avant le correctif : contrôle refait sur la lecture gardée, AUCUNE lecture payée", async () => {
    // L'arrêt gardé de la vidéo : 3 lectures payées, la dernière refusée (fenêtre mesurée collée au mot, −17 dB).
    const j = neuf();
    const avant = await jusquAuBout(doubles(j, () => -17), etatInitialVoixCasConcret({ corps: CORPS, fins: [] }));
    const arrete: EtatVoixCasConcret = { ...avant, corps: { ...avant.corps, lectures: 3 } };
    expect(arrete.issue?.statut).toBe("arret");
    const lus = j.lus.length;
    const fin = await jusquAuBout(doubles(j), rouvrirApresArret(arrete));
    expect(fin.issue).toEqual({ statut: "faite" });
    expect(j.lus).toHaveLength(lus);
    expect(fin.payees).toHaveLength(avant.payees.length);
  });

  it("le blanc lui-même reste celui de l'horodatage (règles des blancs inchangées)", () => {
    expect(pausesAMesurer(MOTS_HEYGEN, CORPS)).toMatchObject([{ deSec: 0.72, aSec: 1.1, apresMot: 1 }]);
  });
});
