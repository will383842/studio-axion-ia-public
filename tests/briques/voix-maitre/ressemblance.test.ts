/**
 * VOIX DE RÉFÉRENCE (14/10) dans la machine de la voix maître, avec des doubles seulement (aucun appel réel) : chaque
 * lecture payée est mesurée ; hors tolérance, relue AU PLUS 2 fois (budget revérifié avant chaque lecture), la prise
 * la plus proche est gardée, toutes les lectures sont comptées et tracées. Coupé, absent ou rendu simulé : les phases
 * et les demandes d'avant, strictement. Une voix reprise (même empreinte) n'est ni remesurée ni repayée.
 */
import { describe, expect, it } from "vitest";
import { avancerVoixMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre";
import { lireReglageRessemblance, REFERENCE_V4, type MesureVoix, type ReglageRessemblanceVoix } from "@/briques/voix-maitre/reference";
import type { MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";

const MOTS: MotHorodate[] = [
  { mot: "Bonjour", debutSec: 0.1, finSec: 0.6 },
  { mot: "maître", debutSec: 1.6, finSec: 2.1 },
];
const TEXTE = "Bonjour maître";
const aPlat = (m: MesureVoix) => Object.fromEntries(Object.entries(m).map(([k, v]) => [`voix.${k}`, v]));
const PROCHE: MesureVoix = { ...REFERENCE_V4 };
/** Essai réel du 14/10 : hauteur +9 %, variation +22 %. */
const ESSAI_14_10: MesureVoix = { ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.09, variationHz: REFERENCE_V4.variationHz * 1.22 };
const LOIN: MesureVoix = { ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.2 };

interface Journal {
  appels: string[];
  /** Lecture n : `nouvelleLecture` demandée au fournisseur (cache ignoré) ? */
  neuves?: boolean[];
}

function doubles(j: Journal, o: { mesures?: MesureVoix[]; ressemblance?: ReglageRessemblanceVoix; simule?: boolean; existant?: boolean; avantLecture?: () => void } = {}): OutilsVoixMaitre {
  const mesures = [...(o.mesures ?? [])];
  let n = 0;
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "voix-double",
    mode: "reel",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { nouvelleLecture?: boolean }) {
      n++;
      j.appels.push(`voix.lire:${n}`);
      (j.neuves ??= []).push(!!d.nouvelleLecture);
      return { fichierCle: `https://fournisseur.test/l${n}.mp3`, dureeSec: 3, cout: { centimes: 40 + n, devise: "EUR" }, mots: MOTS, copieEnAttente: { adresse: `https://fournisseur.test/l${n}.mp3`, idDemande: `dem-${n}` } };
    },
    async copierSon(_a: string, _id: string, idDemande: string) {
      j.appels.push(`voix.copierSon:${idDemande}`);
      return `studio/test/brut-${idDemande}.mp3`;
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    urlLecture: async (cle: string) => `https://stockage.test/${cle}`,
    urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`,
    urlDepotDuree: async (cle: string) => `https://depot.test/${cle}`,
  } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      j.appels.push(`rendu.soumettre:${d.idRendu}:${String(d.parametres.mode)}:${d.entrees.audio}`);
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (d.parametres.mode === "mesure-voix") return { statut: "termine", sortieCle: d.sortie.cle, mesures: { dureeSec: 3, ...aPlat(mesures.shift() ?? PROCHE) } };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 2 } : {} };
    },
  };
  return {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
    rendu: () => rendu,
    renduEstSimule: () => !!o.simule,
    cle: (nom) => `studio/test/am/${nom}`,
    idBase: "base",
    texte: () => TEXTE,
    empreinte: () => "am-empreinte",
    idVoix: "voix-77ea2dbe",
    caler: () => false,
    regles: REGLES_NETTOYAGE_PAR_DEFAUT,
    avantLecture: () => {
      j.appels.push("avantLecture");
      o.avantLecture?.();
    },
    ...(o.ressemblance ? { ressemblance: o.ressemblance } : {}),
    ...(o.existant ? { existant: { fichierCle: "studio/test/am/ancien.wav", empreinte: "am-empreinte", mots: MOTS, dureeSec: 2 } } : {}),
  };
}

async function jusquAuBout(o: OutilsVoixMaitre, depart: EtatVoixMaitre = { phase: "a-lire" }): Promise<EtatVoixMaitre[]> {
  const etats: EtatVoixMaitre[] = [];
  let etat = depart;
  for (let tour = 0; tour < 40 && etat.phase !== "faite"; tour++) {
    etat = JSON.parse(JSON.stringify(await avancerVoixMaitre(etat, o))) as EtatVoixMaitre;
    etats.push(etat);
  }
  return etats;
}

const lectures = (j: Journal) => j.appels.filter((a) => a.startsWith("voix.lire")).length;
const ACTIF: ReglageRessemblanceVoix = { actif: true, relancesMax: 2 };
const faite = (e: EtatVoixMaitre | undefined) => {
  if (e?.phase !== "faite") throw new Error("inachevé");
  return e.audio;
};

describe("voix de référence : contrôle de ressemblance dans la voix maître", () => {
  it("lecture ressemblante du premier coup : mesurée une fois, aucune relance, une seule lecture payée", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j, { ressemblance: ACTIF, mesures: [PROCHE] }));
    expect(etats.map((e) => e.phase)).toEqual(["a-copier", "a-mesurer", "mesure", "a-analyser", "analyse", "nettoyage", "faite"]);
    const a = faite(etats.at(-1));
    expect(lectures(j)).toBe(1);
    expect(a.coutCentimes).toBe(41);
    expect(a.ressemblance).toMatchObject({ retenue: 0, ressemblante: true, prises: [{ empreinteDemande: "am-empreinte#lecture-1", coutCentimes: 41, ressemblante: true }] });
    // La mesure lit le son RANGÉ (après la copie), jamais l'adresse temporaire du fournisseur.
    expect(j.appels).toContain("rendu.soumettre:base-mesure-l1:mesure-voix:https://stockage.test/studio/test/brut-dem-1.mp3");
  });

  it("15/10 (v-dd3049053f88) : une relance de ressemblance est une lecture NEUVE (cache du fournisseur ignoré), la première non", async () => {
    // Prod : deux lectures payées de la fin Facebook, fichiers différents, mesures identiques au 5e chiffre : sans
    // `force_regenerate`, HeyGen rend le même son pour le même texte ; la relance ne servait à rien.
    const j: Journal = { appels: [] };
    await jusquAuBout(doubles(j, { ressemblance: lireReglageRessemblance(undefined), mesures: [LOIN, LOIN] }));
    expect(j.neuves).toEqual([false, true]);
  });

  it("réglage par défaut (1 relance) : hors tolérance deux fois de suite, 2 lectures au plus", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j, { ressemblance: lireReglageRessemblance(undefined), mesures: [LOIN, ESSAI_14_10, LOIN] }));
    expect(lectures(j)).toBe(2);
    expect(j.appels.filter((a) => a === "avantLecture")).toHaveLength(2);
    expect(etats.filter((e) => e.phase === "a-relire")).toHaveLength(1);
  });

  it("hors tolérance (essai du 14/10, réglé à 2 relances) : relue au plus 2 fois, la plus proche gardée, les 3 lectures comptées et tracées", async () => {
    const j: Journal = { appels: [] };
    // 1 : hauteur +9 % ; 2 : hauteur +20 % ; 3 : hauteur +9 % et variation +22 % (plus loin que 1) → la 1re gardée.
    const etats = await jusquAuBout(doubles(j, { ressemblance: ACTIF, mesures: [{ ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.09 }, LOIN, ESSAI_14_10] }));
    expect(lectures(j)).toBe(3);
    // Budget revérifié avant CHAQUE lecture payée.
    expect(j.appels.filter((a) => a === "avantLecture")).toHaveLength(3);
    expect(etats.filter((e) => e.phase === "a-relire")).toHaveLength(2);
    const a = faite(etats.at(-1));
    expect(a.coutCentimes).toBe(41 + 42 + 43);
    expect(a.caracteres).toBe(3 * TEXTE.length);
    expect(a.ressemblance?.prises.map((p) => [p.empreinteDemande, p.coutCentimes, p.ressemblante])).toEqual([
      ["am-empreinte#lecture-1", 41, false],
      ["am-empreinte#lecture-2", 42, false],
      ["am-empreinte#lecture-3", 43, false],
    ]);
    expect(a.ressemblance?.retenue).toBe(0);
    expect(a.ressemblance?.ressemblante).toBe(false);
    expect(a.ressemblance?.prises[0].ecarts).toEqual(["hauteur +9 % (toléré 8 %)"]);
    // Le son maître est fait à partir de la PRISE GARDÉE (la première), une seule fois.
    expect(j.appels.filter((x) => x.includes(":analyse:") || x.includes(":appliquer:"))).toEqual([
      "rendu.soumettre:base-analyse:analyse:https://stockage.test/studio/test/brut-dem-1.mp3",
      "rendu.soumettre:base-nettoyage:appliquer:https://stockage.test/studio/test/brut-dem-1.mp3",
    ]);
    // Une mesure par lecture, chacune sous sa propre demande.
    expect(j.appels.filter((x) => x.includes(":mesure-voix:")).map((x) => x.split(":")[1])).toEqual(["base-mesure-l1", "base-mesure-l2", "base-mesure-l3"]);
  });

  it("la 2e lecture ressemble : on s'arrête là (2 lectures), elle est gardée", async () => {
    const j: Journal = { appels: [] };
    const a = faite((await jusquAuBout(doubles(j, { ressemblance: ACTIF, mesures: [ESSAI_14_10, PROCHE] }))).at(-1));
    expect(lectures(j)).toBe(2);
    expect(a.ressemblance).toMatchObject({ retenue: 1, ressemblante: true });
    expect(a.coutCentimes).toBe(41 + 42);
  });

  it("plafond de relances modifiable : 0 relance = une lecture, gardée même hors tolérance", async () => {
    const j: Journal = { appels: [] };
    const a = faite((await jusquAuBout(doubles(j, { ressemblance: { actif: true, relancesMax: 0 }, mesures: [LOIN] }))).at(-1));
    expect(lectures(j)).toBe(1);
    expect(a.ressemblance).toMatchObject({ retenue: 0, ressemblante: false });
  });

  it("reprise après panne au milieu des relances : aucune lecture déjà payée n'est refaite", async () => {
    const j: Journal = { appels: [] };
    const o = doubles(j, { ressemblance: ACTIF, mesures: [LOIN, LOIN, PROCHE] });
    const etats = await jusquAuBout(o);
    const relire = etats.find((e) => e.phase === "a-relire")!;
    // Le serveur redémarre sur l'état gardé « a-relire » : une seule lecture de plus (la 2e), pas la 1re.
    const j2: Journal = { appels: [] };
    const suite = await jusquAuBout(doubles(j2, { ressemblance: ACTIF, mesures: [PROCHE] }), relire);
    expect(lectures(j2)).toBe(1);
    expect(faite(suite.at(-1)).ressemblance?.prises).toHaveLength(2);
  });

  it("budget refusé avant une relance : aucune lecture de plus n'est payée", async () => {
    const j: Journal = { appels: [] };
    let n = 0;
    const o = doubles(j, {
      ressemblance: ACTIF,
      mesures: [LOIN],
      avantLecture: () => {
        if (++n > 1) throw new Error("Le budget du mois serait dépassé.");
      },
    });
    await expect(jusquAuBout(o)).rejects.toThrow("budget");
    expect(lectures(j)).toBe(1);
  });

  it("coupé ou absent : les phases et les demandes d'avant, strictement (aucune mesure)", async () => {
    for (const ressemblance of [undefined, { actif: false, relancesMax: 2 }]) {
      const j: Journal = { appels: [] };
      const etats = await jusquAuBout(doubles(j, { ...(ressemblance ? { ressemblance } : {}), mesures: [LOIN] }));
      expect(etats.map((e) => e.phase)).toEqual(["a-copier", "a-analyser", "analyse", "nettoyage", "faite"]);
      expect(j.appels.some((x) => x.includes("mesure"))).toBe(false);
      expect(faite(etats.at(-1)).ressemblance).toBeUndefined();
      expect(lectures(j)).toBe(1);
    }
  });

  it("rendu simulé : pas de mesure, comportement d'avant", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j, { ressemblance: ACTIF, simule: true, mesures: [LOIN] }));
    expect(etats.map((e) => e.phase)).toEqual(["a-copier", "a-analyser", "analyse", "nettoyage", "faite"]);
    expect(j.appels.some((x) => x.includes("mesure"))).toBe(false);
  });

  it("voix reprise (même empreinte) : ni remesurée ni repayée", async () => {
    const j: Journal = { appels: [] };
    const etats = await jusquAuBout(doubles(j, { ressemblance: ACTIF, existant: true, mesures: [LOIN] }));
    expect(etats.map((e) => e.phase)).toEqual(["faite"]);
    expect(j.appels).toEqual([]);
    expect(faite(etats[0])).toMatchObject({ reutilise: true, coutCentimes: 0 });
  });
});
