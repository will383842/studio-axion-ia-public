/**
 * VOIX DE RÉFÉRENCE (14/10) branchée sur le tableau animé et le cas concret, avec des doubles seulement : la même
 * machine (relances, prise la plus proche, coût de toutes les lectures), chaque lecture payée inscrite et tracée, et
 * le prix annoncé = le MAXIMUM possible (2 lectures par défaut, 3 au plus si le réglage est à 2 relances) pour que « prix confirmé = prix affiché » tienne.
 */
import { describe, expect, it } from "vitest";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre";
import { lecturesVoixMax, lireReglageRessemblance, REFERENCE_V4, ressemblanceDeLaCommande, type MesureVoix, type ReglageRessemblanceVoix } from "@/briques/voix-maitre/reference";
import type { OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import type { MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { FaitCas } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { avancerVoixCasConcret, etatInitialVoixCasConcret, REGLES_BLANCS_CAS_CONCRET, type EtatVoixCasConcret, type OutilsAvancerVoix } from "@/moteurs/montage-cas-concret/voix";
import { estimerFabrication } from "@/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "../tableau/regles/exemples";
import { avancerVoixTableau, type EtatVoixTableau } from "@/moteurs/montage-tableau/voix-tableau";

const ACTIF: ReglageRessemblanceVoix = { actif: true, relancesMax: 2 };
const LOIN: MesureVoix = { ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.2 };
const ESSAI_14_10: MesureVoix = { ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * 1.09, variationHz: REFERENCE_V4.variationHz * 1.22 };
const aPlat = (m: MesureVoix) => Object.fromEntries(Object.entries(m).map(([k, v]) => [`voix.${k}`, v]));

function motsDe(texte: string): MotHorodate[] {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .map((mot, i) => ({ mot, debutSec: +(0.05 + i * 0.4).toFixed(3), finSec: +(0.35 + i * 0.4).toFixed(3) }));
}

/** Outils communs de la voix maître : chaque lecture coûte 10 c ; chaque mesure rend la suivante de `mesures`. */
function outilsCommuns(appels: string[], mesures: MesureVoix[]) {
  const file = [...mesures];
  const soumises = new Map<string, DemandeRendu>();
  let n = 0;
  const voix = {
    id: "voix-double",
    mode: "reel",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string }) {
      n++;
      appels.push(`voix.lire:${n}`);
      const mots = motsDe(d.texte);
      return { fichierCle: `studio/test/brut-${n}.mp3`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, cout: { centimes: 10, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    urlLecture: async (cle: string) => `https://stockage.test/${cle}`,
    urlLectureDuree: async (cle: string) => `https://stockage.test/${cle}`,
    urlDepotDuree: async (cle: string) => `https://depot.test/${cle}`,
  } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      appels.push(`rendu:${String(d.parametres.mode)}:${d.entrees.audio}`);
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (d.parametres.mode === "mesure-voix") return { statut: "termine", sortieCle: d.sortie.cle, mesures: aPlat(file.shift() ?? REFERENCE_V4) };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: { dureeSec: 5 } };
    },
  };
  return { voix: () => voix, stockage: () => stockage, aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement, rendu: () => rendu, renduEstSimule: () => false };
}

describe("voix de référence · tableau animé", () => {
  it("la voix du tableau passe par le contrôle : relances, prise la plus proche, recette sur la prise gardée, coût total", async () => {
    const appels: string[] = [];
    const texte = "On recrute en quinze minutes chrono.";
    const o: OutilsVoixMaitre = {
      ...outilsCommuns(appels, [LOIN, ESSAI_14_10, LOIN]),
      cle: (nom) => `studio/test/tb/${nom}`,
      idBase: "tb-voix",
      texte: () => texte,
      empreinte: () => "tb-empreinte",
      idVoix: "77ea2dbe",
      caler: () => false,
      regles: REGLES_NETTOYAGE_PAR_DEFAUT,
      avantLecture: () => void appels.push("avantLecture"),
      ressemblance: ACTIF,
    };
    let e: EtatVoixTableau = { phase: "a-lire" };
    for (let i = 0; i < 40 && e.phase !== "faite"; i++) e = JSON.parse(JSON.stringify(await avancerVoixTableau(e, o))) as EtatVoixTableau;
    if (e.phase !== "faite") throw new Error("inachevé");
    expect(appels.filter((a) => a.startsWith("voix.lire"))).toHaveLength(3);
    expect(appels.filter((a) => a === "avantLecture")).toHaveLength(3);
    expect(e.audio.coutCentimes).toBe(30);
    expect(e.audio.recette?.appliquee).toBe(true);
    // La 2e lecture (essai du 14/10) est la plus proche : la recette est faite sur elle.
    expect(e.audio.ressemblance).toMatchObject({ retenue: 1, ressemblante: false });
    expect(appels.filter((a) => a.startsWith("rendu:recette"))).toEqual(["rendu:recette:https://stockage.test/studio/test/brut-2.mp3"]);
  });

  it("prix du tableau : le maximum de lectures (3 par défaut), réglage coupé ou commande d'avant : le prix d'avant", () => {
    const une = estimerFabrication(ficheDemonstration, 0.02).centimes;
    const trois = estimerFabrication(ficheDemonstration, 0.02, [], { lecturesVoixMax: 3 }).centimes;
    expect(trois).toBeGreaterThanOrEqual(3 * une - 2);
    expect(trois).toBeLessThanOrEqual(3 * une);
    expect(lecturesVoixMax(ressemblanceDeLaCommande({ ressemblanceVoix: ACTIF }))).toBe(3);
    expect(lecturesVoixMax(ressemblanceDeLaCommande({ ressemblanceVoix: { actif: false, relancesMax: 2 } }))).toBe(1);
    expect(lecturesVoixMax(ressemblanceDeLaCommande({}))).toBe(1);
  });
});

describe("voix de référence · cas concret", () => {
  const CORPS = "On recrute en quinze minutes. Tout part tout seul.";
  const FINS = [{ id: "fin-fb", texte: "Écrivez IA en commentaire." }];

  function outilsCas(appels: string[], mesures: MesureVoix[]): OutilsAvancerVoix {
    return {
      ...outilsCommuns(appels, mesures),
      cle: (nom) => `studio/test/cc/${nom}`,
      idVoix: "77ea2dbe",
      caler: () => false,
      regles: REGLES_BLANCS_CAS_CONCRET,
      ressemblance: ACTIF,
      assembler: async () => {
        throw new Error("non utilisé");
      },
      mesurerPauses: async (_cle, pauses) => pauses.map(() => -50),
      reformuler: async (phrase) => ({ ok: true, phrase }),
      faits: [] as FaitCas[],
      avantLecture: (l) => void appels.push(`avantLecture:${l.prise}`),
    };
  }

  it("chaque relance est une lecture payée inscrite à part (empreinte de demande propre), budget revérifié avant", async () => {
    const appels: string[] = [];
    // Corps : 2 lectures (la 2e ressemble) ; fin : ressemblante du premier coup.
    const o = outilsCas(appels, [LOIN, REFERENCE_V4, REFERENCE_V4]);
    let e: EtatVoixCasConcret = etatInitialVoixCasConcret({ corps: CORPS, fins: FINS });
    for (let i = 0; i < 80 && !e.issue; i++) e = JSON.parse(JSON.stringify(await avancerVoixCasConcret(e, o))) as EtatVoixCasConcret;
    expect(e.issue).toEqual({ statut: "faite" });
    expect(appels.filter((a) => a.startsWith("voix.lire"))).toHaveLength(3);
    expect(appels.filter((a) => a.startsWith("avantLecture"))).toEqual(["avantLecture:corps", "avantLecture:corps", "avantLecture:fin-fb"]);
    expect(e.payees.map((p) => [p.prise, p.coutCentimes])).toEqual([
      ["corps", 10],
      ["corps", 10],
      ["fin-fb", 10],
    ]);
    expect(e.payees[1].empreinte).toBe(`${e.payees[0].empreinte}#lecture-2`);
    // Le corps retenu est la 2e lecture (la ressemblante).
    expect(e.corps.prise?.brut?.fichierCle).toBe("studio/test/brut-2.mp3");
  });

  it("prix par défaut : réglage global absent = 1 relance = 2 lectures au plus", () => {
    const defaut = lireReglageRessemblance(undefined);
    expect(lecturesVoixMax(defaut)).toBe(2);
    expect(lecturesVoixMax(lireReglageRessemblance({ actif: true, relancesMax: 2 }))).toBe(3);
    const cas = trouverCas("recrutement-apporteurs")!;
    const voixDe = (k?: number) => estimerDepuisCas(cas, ["facebook"], false, { voix: {}, ...(k ? { lecturesVoixMax: k } : {}) }).lignes.filter((l) => l.etape === "voix" || /voix/i.test(l.etape));
    expect(voixDe(lecturesVoixMax(defaut)).map((l) => l.total.centimes)).toEqual(voixDe().map((l) => l.total.centimes * 2));
  });

  it("prix du cas concret : la ligne de la voix couvre 3 lectures quand le réglage est à 2 relances", () => {
    const cas = trouverCas("recrutement-apporteurs")!;
    const voixDe = (k?: number) => estimerDepuisCas(cas, ["facebook"], false, { voix: {}, ...(k ? { lecturesVoixMax: k } : {}) }).lignes.filter((l) => l.etape === "voix" || /voix/i.test(l.etape));
    const une = voixDe();
    const trois = voixDe(3);
    expect(une.length).toBeGreaterThan(0);
    expect(trois.map((l) => l.total.centimes)).toEqual(une.map((l) => l.total.centimes * 3));
    expect(trois.map((l) => l.quantite)).toEqual(une.map((l) => l.quantite * 3));
  });
});
