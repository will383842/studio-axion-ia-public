/**
 * FOURNISSEUR D'ILLUSTRATIONS RÉEL « reel » (lot A2, M5) : banques Pexels puis Pixabay, fabrication fal.ai.
 * Même contrat que la simulation (`FournisseurIllustration`) + deux extensions facultatives (`types.ts`).
 * Ce qui demande Claude (choix fin, classement des images de Will) reste SIMULÉ par règles tant qu'aucune clé
 * n'existe : `choisir` par le score de correspondance, `analyserImage` par la simulation.
 * Une source sans clé est simplement sautée ; une source en panne n'empêche pas l'autre.
 */
import { requeteDuPlan, scoreCorrespondance } from "@/domaine/illustrations";
import type { Ratio } from "@/domaine/types";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { fournisseurIllustrationSimulation } from "../simulation/autres";
import type { ResultatBanque } from "../types";
import { cleIllustration, depotParDefaut, ErreurIllustration, stockageEnvironnement, telecharger, type Deposer } from "./depot";
import { attendreFabrication, coutClipUsd, creerFabricationFal, type OptionsFal } from "./fal";
import { chercherPexels, type CandidatBanque } from "./pexels";
import { chercherPixabay } from "./pixabay";
import type { FournisseurIllustrationEtendu } from "./types";
import { TARIFS_FABRICATION_USD, CONSIGNE_CLIP } from "@/domaine/illustrations";

export interface ClesIllustration {
  pexels?: string;
  pixabay?: string;
  fal?: string;
}

export function clesDepuisEnv(env: Record<string, string | undefined> = process.env): ClesIllustration {
  // Une clé n'a jamais d'espace : un copier-coller coupé en deux est recollé.
  const cle = (v: string | undefined) => v?.replace(/\s+/g, "") || undefined;
  return { pexels: cle(env.PEXELS_API_KEY), pixabay: cle(env.PIXABAY_API_KEY), fal: cle(env.FAL_KEY) };
}

/** Un candidat de banque, avant recopie : ses adresses sont celles de la banque (jamais affichées). */
function versResultat(c: CandidatBanque): ResultatBanque {
  return {
    idExterne: c.idExterne,
    source: c.source,
    fichierCle: c.urlVideo,
    vignetteCle: c.urlVignette,
    dureeSec: c.dureeSec,
    largeur: c.largeur,
    hauteur: c.hauteur,
    licence: { ...c.licence, preuveFichierId: undefined, source: `${c.licence.source} — ${c.page}` },
    description: c.description,
  };
}

export function creerFournisseurIllustrationReel(cles: ClesIllustration, options: { deposer?: Deposer; tauxUsdEur?: number; plafondUsdCentimes?: number; depenseDeja?: OptionsFal["depenseDeja"]; journal?: OptionsFal["journal"] } = {}): FournisseurIllustrationEtendu {
  const deposer = options.deposer ?? depotParDefaut(stockageEnvironnement);
  const taux = options.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT;
  const fabrication = cles.fal ? creerFabricationFal({ cle: cles.fal, deposer, tauxUsdEur: taux, plafondUsdCentimes: options.plafondUsdCentimes, depenseDeja: options.depenseDeja, journal: options.journal }) : undefined;
  const sources = [cles.pexels && "Pexels", cles.pixabay && "Pixabay", cles.fal && "fal.ai"].filter(Boolean).join(", ");

  return {
    id: "reel",
    type: "illustration",
    nom: "Images d'illustration",
    reelPrevu: sources || "Pexels, Pixabay, fal.ai",
    mode: "reel",
    capacites: {
      asynchrone: true,
      accordExige: false,
      tarifUsd: { unite: "image", centimesUsd: TARIFS_FABRICATION_USD.image + coutClipUsd(5) },
    },

    async choisir({ requete, candidats, nombre }) {
      const req = requeteDuPlan({ id: "", ordre: 0, texte: requete, requete });
      return candidats
        .map((c) => ({ id: c.id, s: scoreCorrespondance(req, { nom: "", motsCles: c.motsCles }) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, nombre)
        .map((x) => x.id);
    },

    async chercher({ requete, ratio, dureeMinSec, sources: demandees }) {
      if (ratio !== "9:16" && ratio !== "4:5") return [];
      const resultats: ResultatBanque[] = [];
      for (const source of demandees) {
        try {
          if (source === "pexels" && cles.pexels) resultats.push(...(await chercherPexels(cles.pexels, requete)).map(versResultat));
          if (source === "pixabay" && cles.pixabay) resultats.push(...(await chercherPixabay(cles.pixabay, requete)).map(versResultat));
        } catch (e) {
          // Une banque en panne n'empêche pas l'autre ; un refus de clé remonte (Réglages > Connexions).
          if (e instanceof ErreurIllustration && e.erreur.code === "refuse") throw e;
        }
      }
      return resultats.filter((r) => r.dureeSec >= dureeMinSec);
    },

    async recopierResultat(r) {
      if (!/^https?:\/\//.test(r.fichierCle)) return r;
      const video = await telecharger(r.fichierCle);
      const fichierCle = await deposer(video.contenu, cleIllustration(r.source, r.idExterne, "mp4"), "video/mp4");
      let vignetteCle = r.vignetteCle;
      if (/^https?:\/\//.test(r.vignetteCle)) {
        const v = await telecharger(r.vignetteCle);
        vignetteCle = await deposer(v.contenu, cleIllustration(r.source, `${r.idExterne}-vignette`, "jpg"), v.mime.startsWith("image/") ? v.mime : "image/jpeg");
      }
      return { ...r, fichierCle, vignetteCle };
    },

    // Chemin bloquant du contrat (outils, essais) ; le moteur passe par `fabrication` (par étapes).
    async generer({ requete, ratio }) {
      if (!fabrication) throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "La fabrication d'images n'est pas reliée (clé fal.ai absente)." });
      const { idDemande } = await fabrication.soumettre({ genre: "image", requete, ratio: (ratio as Ratio) ?? "9:16", cleIdempotence: `generer-${Date.now()}` });
      const fait = await attendreFabrication(fabrication, idDemande);
      return { fichierCle: fait.fichierCle, cout: fait.cout };
    },

    async animer({ imageCle, dureeSec }) {
      if (!fabrication) throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "La fabrication de clips n'est pas reliée (clé fal.ai absente)." });
      const s = await stockageEnvironnement();
      const imageUrl = /^https?:\/\//.test(imageCle) ? imageCle : s.urlLectureDuree ? await s.urlLectureDuree(imageCle, 3600) : "";
      if (!/^https?:\/\//.test(imageUrl)) throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "L'image à animer n'a pas d'adresse lisible par fal.ai." });
      const { idDemande } = await fabrication.soumettre({ genre: "clip", imageUrl, requete: CONSIGNE_CLIP, dureeSec, ratio: "9:16", cleIdempotence: `animer-${Date.now()}` });
      const fait = await attendreFabrication(fabrication, idDemande);
      return { fichierCle: fait.fichierCle, cout: fait.cout ?? centimes(0) };
    },

    analyserImage: fournisseurIllustrationSimulation.analyserImage,
    fabrication,
  };
}
