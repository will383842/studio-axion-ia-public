"use server";

/**
 * Actions serveur du tableau de bord (G4-08-b2-v20j) : lire la capture, puis ranger le tableau validé dans les entrées de la
 * vidéo. Monté nulle part : aucune page ne les appelle. Une lecture au plus par appel (les garde-fous de dépense restent
 * ceux de la lecture) ; aucune fabrication lancée.
 */
import { ID_FORMAT_TABLEAU_DE_BORD } from "@/formats/tableau-de-bord";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import { depots, ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { ouvrirRelectureTableau, validerRelectureTableau, type OuvertureRelectureTableau } from "@/services/tableau-de-bord-relecture";

/** Clé des entrées lue par le moteur du montage de données (écrite en littéral : aucun import du moteur ; un test la compare). */
const CLE_ENTREE = "montageDonnees";

type ImageEnvoyee = { base64: string; type: "image/png" | "image/jpeg"; largeur: number; hauteur: number };
type DecisionEnvoyee = { type: "valide" } | { type: "corrige"; valeur: number } | { type: "refuse" };

async function videoDuFormat(videoId: string) {
  await exigerSession();
  const video = await depots().videos.obtenir(videoId);
  if (!video || video.formatId !== ID_FORMAT_TABLEAU_DE_BORD) throw new ErreurStudio("FORMAT_REFUSE", "Cette vidéo n'est pas un tableau de bord.");
  return video;
}

/** Lit la capture (UNE lecture) et rend les chiffres à relire, ou le repli « saisie à la main ». */
export async function ouvrirRelectureTableauAction(videoId: string, image: ImageEnvoyee): Promise<Resultat<OuvertureRelectureTableau>> {
  return essayer(async () => {
    await videoDuFormat(videoId);
    return ouvrirRelectureTableau(videoId, image, "studio");
  });
}

/** Applique les décisions ; si tout est relu, le tableau validé est rangé dans les entrées de la vidéo. Sinon rien n'est écrit. */
export async function validerRelectureTableauAction(videoId: string, brouillon: TableauDeBord, decisions: Record<string, DecisionEnvoyee>): Promise<Resultat<{ ok: true } | { ok: false; raisons: string[] }>> {
  return essayer(async () => {
    const video = await videoDuFormat(videoId);
    const r = validerRelectureTableau(brouillon, decisions);
    if (!r.ok) return { ok: false as const, raisons: r.raisons };
    const actuel = video.entrees[CLE_ENTREE];
    const base = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? (actuel as Record<string, unknown>) : {};
    await depots().videos.modifier(videoId, { entrees: { ...video.entrees, [CLE_ENTREE]: { ...base, donnee: r.donnee } } });
    return { ok: true as const };
  });
}
