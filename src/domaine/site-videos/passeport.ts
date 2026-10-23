// Vidéos sur le site, lot S1 — passeport d'essai (PUR, gratuit : rien n'est écrit par Claude ici).
import { texteScript } from "@/domaine/derivations";
import { dureeDeLaVideo } from "@/domaine/duree-video";
import { titreSansCodeInterne } from "@/domaine/miniatures";
import type { BlocScript, SegmentSousTitres, Sortie, Video } from "@/domaine/types";
import { resoudreRecette } from "@/formats/familles";
import type { DefinitionFormat } from "@/formats/types";
import { chapitresWeb } from "./chapitres";
import { VERSION_PASSEPORT_INITIALE } from "./constantes";
import type { PasseportWeb } from "./types";

export const TITRE_WEB_MAX = 60;
export const RESUME_WEB_MAX = 300;
const SLUG_MAX = 60;

/** Coupe sur le dernier mot entier tenant dans `max` caractères (un seul mot trop long : coupé net). */
function coupeSurMot(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  if (texte[max] === " ") return coupe.trim();
  const dernier = coupe.lastIndexOf(" ");
  return (dernier > 0 ? coupe.slice(0, dernier) : coupe).trim();
}

/** Titre d'essai : sans code interne, sans « | Axion IA », espaces normalisées, 60 caractères au plus, sans point final. */
export function titreWebDEssai(video: Pick<Video, "titre">): string {
  const net = titreSansCodeInterne(video.titre).replace(/\s*\|\s*Axion IA\s*$/i, "").replace(/\s+/g, " ").trim();
  return coupeSurMot(net, TITRE_WEB_MAX).replace(/[\s.]+$/, "");
}

/** Adresse proposée au site (qui reste maître de l'adresse finale) : minuscules, sans accent, sans date. */
export function slugWeb(titre: string): string {
  const slug = titre
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= SLUG_MAX) return slug;
  const coupe = slug.slice(0, SLUG_MAX);
  if (slug[SLUG_MAX] === "-") return coupe;
  const dernier = coupe.lastIndexOf("-");
  return dernier > 0 ? coupe.slice(0, dernier) : coupe;
}

/** Deux premières phrases du texte, coupées à 300 caractères. */
function resumeDEssai(transcription: string): string {
  const phrases = transcription.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  return coupeSurMot(phrases.slice(0, 2).join(" "), RESUME_WEB_MAX);
}

export interface EntreePasseportEssai {
  video: Pick<Video, "titre" | "ratios" | "dureeCibleSec">;
  blocs: BlocScript[];
  segments: SegmentSousTitres[];
  format: Pick<DefinitionFormat, "famille" | "recetteScript" | "declinaison" | "chapitresWeb">;
  sortie: Pick<Sortie, "id" | "ratio" | "dureeSec"> | undefined;
  credits: string[];
  contenuGenere: boolean;
  maintenant: string;
}

export function passeportDEssai({ video, blocs, segments, format, sortie, credits, contenuGenere, maintenant }: EntreePasseportEssai): PasseportWeb {
  const transcription = texteScript(blocs);
  const dureeSec = dureeDeLaVideo(video.dureeCibleSec, sortie).sec;
  return {
    version: VERSION_PASSEPORT_INITIALE,
    titreWeb: titreWebDEssai(video),
    resume: resumeDEssai(transcription),
    transcription,
    chapitres: chapitresWeb({ blocs, recette: resoudreRecette(format), regle: format.chapitresWeb ?? {}, mots: segments.flatMap((s) => s.mots), dureeSec }),
    aRetenir: [],
    questions: [],
    rubrique: "",
    motsCles: [],
    credits,
    sortieId: sortie?.id,
    ratio: sortie?.ratio ?? video.ratios[0],
    contenuGenere,
    origines: { titreWeb: "essai", resume: "essai", aRetenir: "essai", questions: "essai", rubrique: "essai", motsCles: "essai", chapitres: "essai" },
    modifieLe: maintenant,
  };
}
