/**
 * BRIQUE MULTICAMÉRA — fabrication et contrôle des deux angles (lot F4).
 *
 * Les deux angles partent en parallèle, sur le son de la prise d'origine. Chacun est suivi, récupéré, puis MESURÉ
 * contre la prise (`coherence.ts`). Toute erreur (look absent, panne, refus, rendu trop long, mesure hors tolérance)
 * écarte l'angle : ses passages restent de face. La fabrication ne lève jamais : au pire, la vidéo garde son montage
 * d'origine à une caméra.
 */
import type { Ratio } from "@/domaine/types";
import type { FondRenduVisage } from "@/fournisseurs/types";
import type { FournisseurMulticamera } from "@/fournisseurs/multicamera";
import { anglesRetenus, verifierAngle, type VerdictAngle } from "./coherence";
import { demandeRenduAngle } from "./consigne";
import { ANGLES_GENERES, type AngleGenere, type AngleMulticamera } from "./types";

export interface EntreeFabricationAngles {
  fournisseur: FournisseurMulticamera;
  travailId: string;
  /** La prise d'origine (de face) : sa vidéo, son son et sa durée. */
  priseCle: string;
  audioCle: string;
  audioUrl?: string;
  dureePriseSec: number;
  ratio: Ratio;
  /** Looks de chaque angle, préparés une fois pour le double. Un angle sans look est écarté. */
  looks: Partial<Record<AngleGenere, string>>;
  referenceLookId?: string;
  /** Défaut : le décor du look (même décor que la prise). */
  fond?: FondRenduVisage;
  essai?: number;
  attendre?: (ms: number) => Promise<void>;
  intervalleMs?: number;
  /** Interrogations avant d'abandonner un rendu (trop long → repli). */
  suivisMax?: number;
}

export interface ResultatFabricationAngles {
  sources: Partial<Record<AngleMulticamera, string>>;
  angles: AngleMulticamera[];
  verdicts: VerdictAngle[];
  replis: { angle: AngleGenere; raison: string }[];
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fabriquerUn(e: EntreeFabricationAngles, angle: AngleGenere): Promise<{ verdict: VerdictAngle; videoCle?: string }> {
  const lookId = e.looks[angle];
  if (!lookId) return { verdict: verifierAngle(angle, e.dureePriseSec, null, "votre double n'a pas encore cet angle.") };
  try {
    const demande = demandeRenduAngle({
      angle,
      lookId,
      audioCle: e.audioCle,
      ...(e.audioUrl ? { audioUrl: e.audioUrl } : {}),
      ...(e.referenceLookId ? { referenceLookId: e.referenceLookId } : {}),
      ratio: e.ratio,
      fond: e.fond ?? "decor-du-look",
      travailId: e.travailId,
      essai: e.essai ?? 1,
    });
    const { idTravailExterne } = await e.fournisseur.rendreAngle(demande);
    const attendre = e.attendre ?? pause;
    const max = e.suivisMax ?? 120;
    for (let n = 0; ; n++) {
      const etat = await e.fournisseur.suivre(idTravailExterne);
      if (etat.statut === "termine") break;
      if (etat.statut === "echec") return { verdict: verifierAngle(angle, e.dureePriseSec, null, etat.erreur.message) };
      if (n + 1 >= max) return { verdict: verifierAngle(angle, e.dureePriseSec, null, "le rendu a pris trop de temps.") };
      await attendre(e.intervalleMs ?? 10_000);
    }
    const { videoCle } = await e.fournisseur.recuperer(idTravailExterne);
    const mesure = await e.fournisseur.mesurer({ videoCle, audioCle: e.audioCle, dureeReferenceSec: e.dureePriseSec });
    return { verdict: verifierAngle(angle, e.dureePriseSec, mesure), videoCle };
  } catch {
    return { verdict: verifierAngle(angle, e.dureePriseSec, null, "le service ne répond pas.") };
  }
}

export async function fabriquerAngles(e: EntreeFabricationAngles): Promise<ResultatFabricationAngles> {
  const faits = await Promise.all(ANGLES_GENERES.map((a) => fabriquerUn(e, a)));
  const verdicts = faits.map((f) => f.verdict);
  const { angles, replis } = anglesRetenus(verdicts);
  const sources: Partial<Record<AngleMulticamera, string>> = { face: e.priseCle };
  faits.forEach((f) => {
    if (f.verdict.ok && f.videoCle) sources[f.verdict.angle] = f.videoCle;
  });
  return { sources, angles, verdicts, replis };
}
