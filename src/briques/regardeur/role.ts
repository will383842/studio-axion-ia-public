import { z } from "zod";
import type { ImageClaude } from "@/fournisseurs/claude/client";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { InstantRegard, LectureRegard } from "./types";

const schemaTexte = z.object({ texte: z.string().max(300), coupe: z.boolean(), horsCadre: z.boolean() }).strict();
const schemaImage = z
  .object({
    nom: z.string(),
    textes: z.array(schemaTexte).max(12),
    sousTitre: z.string().nullable(),
    pageVide: z.boolean(),
    noire: z.boolean(),
    illisible: z.boolean(),
  })
  .strict();
export const schemaLectureRegard = z.object({ images: z.array(schemaImage) }).strict();

/** Aucun texte de vidéo ici : Claude recopie, il ne juge jamais. */
export const CONSIGNE_REGARD = `Tu reçois des images tirées d'une vidéo finie, chacune annoncée par son nom. Tu RECOPIES exactement les textes visibles sur chaque image, ligne par ligne, sans corriger l'orthographe ni compléter un mot coupé.
Pour chaque image, tu rends :
- textes : chaque texte écrit (hors sous-titres), avec « coupe » = vrai si des lettres ou des mots sont tranchés par le bord de l'image ou d'un cadre, et « horsCadre » = vrai si le texte dépasse de son cadre ou du bord ;
- sousTitre : le texte de la bande des sous-titres, ou null ;
- pageVide : vrai si aucune écriture hors sous-titre ;
- noire : vrai si l'image est entièrement noire ;
- illisible : vrai si tu ne peux pas lire l'image.
Tu ne juges jamais si un texte est juste. Tu ne rends aucune remarque, seulement la recopie.`;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Les noms d'images avec leur instant, et RIEN d'autre (ni script, ni légende qui citerait un texte attendu). */
export function variableRegard(instants: readonly Pick<InstantRegard, "nom" | "instantSec">[]): string {
  return instants.map((i) => `<image nom="${i.nom}" instant="${fmt(i.instantSec)}"/>`).join("\n");
}

function simulerRegard(entree: EntreeRole): LectureRegard {
  const noms = [...entree.variable.matchAll(/<image nom="([^"]+)"/g)].map((m) => m[1]!);
  return { images: noms.map((nom) => ({ nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: true })) };
}

export const roleRegard = {
  id: "regard-video",
  version: 1,
  consigne: CONSIGNE_REGARD,
  schema: schemaLectureRegard,
  modele: MODELE_ECRITURE,
  effort: "low",
  maxTokens: 4000,
  simuler: simulerRegard,
} satisfies DefinitionRole<typeof schemaLectureRegard>;

/** Images jointes à Claude : la légende est le nom seul. */
export function imagesPourClaude(images: { nom: string; type: "image/jpeg" | "image/png"; base64: string }[]): ImageClaude[] {
  return images.map((i) => ({ type: i.type, base64: i.base64, legende: i.nom }));
}
