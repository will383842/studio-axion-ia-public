/**
 * IMAGE → VIDÉO : référence de la voix. 20/10/2026 : hauteur 158,4 Hz (la v4 entière). 23/10/2026 (Will : « cette voix me
 * convient ») : recalibrée sur la nouvelle voix HeyGen (188,2 Hz, voir reference-nouvelle-voix.test.ts). Tolérance (8 %)
 * inchangée. Avocat, tableau et cas concret gardent 152,4 Hz (`REFERENCE_V4`). Doubles seulement : aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "@/briques/voix-maitre";
import { avancerVoixMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { choisirMeilleurePrise, comparerAReference, REFERENCE_V4, TOLERANCES_VOIX, VERSION_MESURE_VOIX, type MesureVoix } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import type { MotHorodate } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import { outilsVoixCasConcretIV, type OutilsVoixIV } from "@/moteurs/montage-image-video/voix";
import { ecartFinHorsReference } from "@/moteurs/montage-image-video/secours";
import type { PriseVoix } from "@/moteurs/montage-image-video/emprunts";

const MOTS: MotHorodate[] = [{ mot: "Bonjour", debutSec: 0.1, finSec: 0.6 }];
const aPlat = (m: MesureVoix) => Object.fromEntries(Object.entries(m).map(([k, v]) => [`voix.${k}`, v]));
/** Mesure dont seule la hauteur diffère de la v4 : `rel` = écart relatif CONTRE 152,4 Hz. */
const aHauteur = (rel: number): MesureVoix => ({ ...REFERENCE_V4, hauteurHz: REFERENCE_V4.hauteurHz * (1 + rel) });
/** Mesure dont seule la hauteur diffère de la référence Image → vidéo : `rel` = écart relatif CONTRE REFERENCE_V4_IV. */
const aHauteurIV = (rel: number): MesureVoix => ({ ...REFERENCE_V4_IV, hauteurHz: REFERENCE_V4_IV.hauteurHz * (1 + rel) });

function doubles(mesure: MesureVoix, reference?: Readonly<MesureVoix>): OutilsVoixMaitre {
  const soumises = new Map<string, DemandeRendu>();
  const voix = {
    id: "voix-double",
    mode: "reel",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire() {
      return { fichierCle: "https://fournisseur.test/l1.mp3", dureeSec: 3, cout: { centimes: 40, devise: "EUR" }, mots: MOTS, copieEnAttente: { adresse: "https://fournisseur.test/l1.mp3", idDemande: "dem-1" } };
    },
    async copierSon() {
      return "studio/test/brut-dem-1.mp3";
    },
  } as unknown as FournisseurVoix;
  const stockage = { urlLecture: async (c: string) => `https://stockage.test/${c}`, urlLectureDuree: async (c: string) => `https://stockage.test/${c}`, urlDepotDuree: async (c: string) => `https://depot.test/${c}` } as unknown as StockageFichiers;
  const rendu: ServiceRendu = {
    async soumettre(d) {
      soumises.set(d.idRendu, d);
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const d = soumises.get(id);
      if (!d) return { statut: "inconnu" };
      if (d.parametres.mode === "mesure-voix") return { statut: "termine", sortieCle: d.sortie.cle, mesures: { dureeSec: 3, "voix.versionMesure": VERSION_MESURE_VOIX, ...aPlat(mesure) } };
      return { statut: "termine", sortieCle: d.sortie.cle, mesures: d.parametres.mode === "appliquer" ? { dureeSec: 2 } : {} };
    },
  };
  return {
    voix: () => voix,
    stockage: () => stockage,
    aligneur: () => ({ mode: "simulation" }) as unknown as FournisseurAlignement,
    rendu: () => rendu,
    renduEstSimule: () => false,
    cle: (nom) => `studio/test/am/${nom}`,
    idBase: "base",
    texte: () => "Bonjour",
    empreinte: () => "am-empreinte",
    idVoix: "voix-77ea2dbe",
    caler: () => false,
    regles: REGLES_NETTOYAGE_PAR_DEFAUT,
    avantLecture: () => undefined,
    ressemblance: { actif: true, relancesMax: 0 },
    ...(reference ? { reference } : {}),
  };
}

async function verdict(mesure: MesureVoix, reference?: Readonly<MesureVoix>) {
  const o = doubles(mesure, reference);
  let etat: EtatVoixMaitre = { phase: "a-lire" };
  for (let tour = 0; tour < 40 && etat.phase !== "faite"; tour++) etat = JSON.parse(JSON.stringify(await avancerVoixMaitre(etat, o))) as EtatVoixMaitre;
  if (etat.phase !== "faite") throw new Error("inachevé");
  const r = etat.audio.ressemblance!;
  return { ressemblante: r.ressemblante, ecarts: r.prises[0].ecarts };
}

describe("référence Image → vidéo : nouvelle voix (188,2 Hz)", () => {
  it("la constante : la v4 par défaut reste à 152,4, Image → vidéo est recalibrée", () => {
    expect(REFERENCE_V4.hauteurHz).toBe(152.4);
    expect(REFERENCE_V4_IV.hauteurHz).toBe(188.2);
    expect(TOLERANCES_VOIX.hauteurHz).toBe(0.08);
  });

  it("(a) par défaut (avocat, tableau, cas concret) : jugé contre 152,4 comme avant", async () => {
    const a = await verdict(aHauteur(0.082));
    expect(a.ressemblante).toBe(false);
    expect(a.ecarts[0]).toMatch(/^hauteur \+8 %/);
    expect((await verdict(aHauteur(0.094))).ressemblante).toBe(false);
    expect((await verdict(aHauteur(0.07))).ressemblante).toBe(true);
    expect((await verdict({ ...REFERENCE_V4 })).ressemblante).toBe(true);
    expect(comparerAReference(aHauteur(0.082)).ressemblante).toBe(false);
  });

  it("(b) Image → vidéo : +4 % et −5 % contre 188,2 Hz sont ACCEPTÉES", async () => {
    for (const rel of [0.04, -0.05]) {
      const v = await verdict(aHauteurIV(rel), REFERENCE_V4_IV);
      expect(v).toEqual({ ressemblante: true, ecarts: [] });
    }
  });

  it("(b) une prise trop aiguë (+13 % contre 188,2 Hz) reste REFUSÉE, avec l'écart contre la référence IV", async () => {
    const v = await verdict(aHauteurIV(0.13), REFERENCE_V4_IV);
    expect(v.ressemblante).toBe(false);
    expect(v.ecarts[0]).toMatch(/^hauteur \+13 % \(toléré 8 %\)/);
  });

  it("(b) les autres mesures restent jugées avec la même tolérance (variation +30 % : refusée aussi en Image → vidéo)", async () => {
    const m = { ...aHauteurIV(0.02), variationHz: REFERENCE_V4_IV.variationHz * 1.3 };
    const v = await verdict(m, REFERENCE_V4_IV);
    expect(v.ressemblante).toBe(false);
    expect(v.ecarts).toHaveLength(1);
    expect(v.ecarts[0]).toMatch(/^variation de hauteur/);
  });

  it("choisirMeilleurePrise : la référence est un paramètre facultatif, défaut inchangé", () => {
    const prises = [{ mesure: aHauteur(0.0) }, { mesure: { ...REFERENCE_V4_IV } }];
    expect(choisirMeilleurePrise(prises)).toBe(0);
    expect(choisirMeilleurePrise(prises, REFERENCE_V4_IV)).toBe(1);
  });

  it("outilsVoixCasConcretIV passe la référence Image → vidéo ; la voix du cas concret n'en passe pas", () => {
    const outils = { avantLecture: async () => undefined, tarifCentimesParCaractere: 0.05 } as unknown as OutilsVoixIV;
    expect(outilsVoixCasConcretIV(outils).reference).toBe(REFERENCE_V4_IV);
  });

  it("(b) la hauteur d'une fin garde la comparaison au corps comme avant", () => {
    const prise = (h: number, ok: boolean): PriseVoix =>
      ({
        texte: "t",
        empreinte: "e",
        etat: { phase: "faite", audio: { ressemblance: { prises: [{ mesure: { ...REFERENCE_V4_IV, hauteurHz: h }, versionMesure: VERSION_MESURE_VOIX, ressemblante: ok, ecarts: [] }], retenue: 0, ressemblante: ok } } },
      }) as unknown as PriseVoix;
    const corps = prise(188.2, true);
    expect(ecartFinHorsReference(prise(198, false), corps)).toBeNull();
    expect(ecartFinHorsReference(prise(205, false), corps)).toContain("par rapport au corps");
  });

  it("(c) aucune version ne bouge (les empreintes sont figées par mesure-v3.test.ts)", () => {
    expect(VERSION_MESURE_VOIX).toBe(3);
    expect(TOLERANCES_VOIX).toEqual({ hauteurHz: 0.08, variationHz: 0.25, energie: 0.2, dynamique: 0.2, rythmePicsParSec: 0.12, partieParole: 0.12 });
  });
});
