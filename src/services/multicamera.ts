/**
 * SERVICE MULTICAMÉRA COMMUN (mission H) — la fabrication des angles pour TOUS les formats.
 *
 * Une seule façon de fabriquer les deux angles (de côté, contre-plongée) sur le son d'une vidéo de face, quel que soit
 * le format : réglage caché du format (`avocat.multicamera`, `facecam.multicamera`, coupés par défaut, `reel` faux par
 * défaut), double de SIMULATION tant que le réel n'est pas demandé, aucun look créé à la volée en réel (ce serait une
 * dépense : l'angle sans look est écarté), contrôle de chaque angle et repli sur la face. Le format met ensuite la
 * piste en plans (`pisteMulticameraAvocat`, `pisteMulticameraFacecam`). Aucun prix ici : un rendu réel passe par le
 * mécanisme existant de confirmation et de crédits.
 */
import "server-only";
import { fabriquerAngles, type ResultatFabricationAngles } from "@/briques/multicamera";
import { lireReglageMulticamera, paramMulticamera, type ReglageMulticameraAvocat } from "@/briques/multicamera/reglage";
import type { AngleGenere } from "@/briques/multicamera/types";
import type { Ratio } from "@/domaine/types";
import { choisirFournisseurMulticamera, type AnalyseurAngle, type OptionsSimulation } from "@/fournisseurs/multicamera";
import type { FournisseurVisage } from "@/fournisseurs/types";
import { CENTIMES_USD_PAR_SECONDE_AVATAR_V } from "@/fournisseurs/heygen/rendus";
import type { LigneCout } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { usdVersEur } from "@/lib/montants";
import { depots, horodatage, lireParametre, maintenant } from "./_commun";
import { gardeMulticamera } from "./options-payantes-multicamera";

export type FormatMulticamera = "avocat" | "facecam";

export async function lireReglageMulticameraFormat(format: FormatMulticamera): Promise<ReglageMulticameraAvocat> {
  return lireReglageMulticamera(await lireParametre<unknown>(paramMulticamera(format), null));
}

export interface DemandeSourcesMulticamera {
  travailId: string;
  /** Double HeyGen de la personne (ses looks par angle sont lus dans le réglage). */
  visageId: string;
  referenceLookId?: string;
  /** La vidéo de face (prise avocat assemblée, piste montée du face caméra). */
  priseCle: string;
  /** Son sur lequel les angles parlent (le même que la vidéo de face). */
  audioCle: string;
  audioUrl?: string;
  dureePriseSec: number;
  ratio: Ratio;
  visage?: FournisseurVisage;
  analyseur?: AnalyseurAngle;
  simulation?: OptionsSimulation;
  attendre?: (ms: number) => Promise<void>;
}

/** Fabrique et contrôle les angles ; `simulation` dit si les clés sont fictives (jamais lues par un rendu réel). */
export async function fabriquerSourcesMulticamera(d: DemandeSourcesMulticamera, reglage: ReglageMulticameraAvocat, format: FormatMulticamera = "avocat"): Promise<ResultatFabricationAngles & { simulation: boolean }> {
  // Lot J : en réel, aucun look ni rendu HeyGen sans « Confirmer » (carte sur « Votre vidéo ») : sans accord, la garde
  // refuse chaque appel et la vidéo reste sur la face (version gratuite).
  const garde = await gardeMulticamera(format === "facecam" ? "multicamera-facecam" : "multicamera-avocat", reglage.reel, d.travailId, d.dureePriseSec);
  const fournisseur = choisirFournisseurMulticamera({ reel: reglage.reel, visage: d.visage, analyseur: d.analyseur, simulation: { dureeSec: d.dureePriseSec, ...d.simulation }, ...(garde ? { garde } : {}) });
  // Looks : ceux du réglage ; en simulation, préparés à la volée (gratuit). En réel, jamais créés ici (dépense).
  const looks: Partial<Record<AngleGenere, string>> = { ...(reglage.looks[d.visageId] ?? {}) };
  if (fournisseur.mode === "simulation") {
    for (const a of ["cote", "contre-plongee"] as const) looks[a] ??= (await fournisseur.preparerLook({ visageId: d.visageId, angle: a })).idExterne;
  }
  // Vérif V4 : chaque rendu HeyGen ACCEPTÉ (réel) est compté en dépense, réussi ou non (HeyGen facture le rendu).
  let rendusAcceptes = 0;
  const compte = fournisseur.mode === "reel"
    ? { ...fournisseur, rendreAngle: async (dm: Parameters<typeof fournisseur.rendreAngle>[0]) => { const r = await fournisseur.rendreAngle(dm); rendusAcceptes++; return r; } }
    : fournisseur;
  const fab = await fabriquerAngles({
    fournisseur: compte,
    travailId: d.travailId,
    priseCle: d.priseCle,
    audioCle: d.audioCle,
    ...(d.audioUrl ? { audioUrl: d.audioUrl } : {}),
    dureePriseSec: d.dureePriseSec,
    ratio: d.ratio,
    looks,
    ...(d.referenceLookId ? { referenceLookId: d.referenceLookId } : {}),
    ...(d.attendre ? { attendre: d.attendre } : {}),
  });
  if (rendusAcceptes > 0) await enregistrerDepenseMulticamera(d.travailId, rendusAcceptes, d.dureePriseSec);
  return { ...fab, simulation: fournisseur.mode === "simulation" };
}

/** Vérif V4 : ligne « Multicaméra · angles HeyGen » (estimée au tarif du double, à la seconde, par angle rendu). */
export function ligneMulticamera(angles: number, dureeSec: number, tauxUsdEur?: number): LigneCout {
  const secondes = angles * Math.ceil(Math.max(0, dureeSec));
  const prixUnitaire = usdVersEur(CENTIMES_USD_PAR_SECONDE_AVATAR_V, tauxUsdEur);
  return { etape: "Multicaméra · angles", fournisseur: "heygen", unite: "seconde", quantite: secondes, prixUnitaire, total: usdVersEur(secondes * CENTIMES_USD_PAR_SECONDE_AVATAR_V, tauxUsdEur), nature: "estime" };
}

async function enregistrerDepenseMulticamera(travailId: string, angles: number, dureeSec: number): Promise<void> {
  try {
    const travail = await depots().travaux.obtenir(travailId);
    const video = travail ? await depots().videos.obtenir(travail.cibleId) : null;
    const taux = await lireParametre<number>("taux.usdEur", NaN);
    const l = ligneMulticamera(angles, dureeSec, Number.isFinite(taux) && taux > 0 ? taux : undefined);
    await depots().depenses.enregistrer({ id: nouvelId("dep"), ...(video ? { videoId: video.id } : {}), travailId, lignes: [l], total: l.total, date: maintenant(), ...horodatage(), estDemo: video?.estDemo });
  } catch (e) {
    console.warn(`[multicamera] dépense non enregistrée pour ${travailId} : ${(e as Error).message}`);
  }
}
