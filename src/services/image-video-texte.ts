/**
 * IMAGE → VIDÉO · MODE TEXTE (R6b) · « Décrivez l'automatisation avec vos mots ».
 *
 * `deposerTexteImageVideo` est le pendant de `deposerImageVideo` pour un texte libre : mêmes réseaux, même prix « au
 * plus » (le plafond de la caisse est ce prix confirmé), même lancement commun, même brouillon. Seule différence : aucune
 * image. La commande porte `imageVideo.texte` et la clé d'image `texte:<empreinte>` ; la fabrication saute la lecture
 * d'image (l'étape « lecture » conçoit le workflow depuis le texte, `texte/conception.ts`, avec la MÊME caisse et le MÊME
 * chemin de dépense Claude que la lecture), puis suit la chaîne d'une image lue : réparation automatique, porte « carte »,
 * écriture, voix, rendu.
 *
 * Refus (texte vide, trop court, trop long) : une phrase simple, avant tout prix, tout brouillon et toute dépense.
 * Ne dépense rien tant que le prix n'est pas confirmé. `image-video-ecran.ts` est recouvert sur le serveur : il n'est
 * PAS modifié, on n'en importe que ce qu'il exporte.
 */
import "server-only";
import type { AccordPrix } from "@/domaine/accord";
import { PHRASE_TIKTOK_RETIRE_IV, RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { Distribution, Id } from "@/domaine/types";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { cleDuTexte, PROVENANCE_TEXTE, refusTexte } from "@/moteurs/montage-image-video/texte/conception";
import { creerVerrou, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { BLOCS_SCRIPT_PROVISOIRE_IV, PARAM_ACCORD_ESSAI_IV, PHRASES_IV, prixDuDepot, type DependancesEcranIV } from "./image-video-ecran";

export interface DemandeDepotTexteIV {
  /** Description libre de l'automatisation (comme dans une conversation). */
  texte: string;
  reseaux: string[];
  /** Montant affiché et confirmé (centimes d'euro). */
  accordCentimes?: AccordPrix;
}

export type IssueDepotTexteIV =
  | { statut: "lancee"; videoId: Id }
  | { statut: "accord-requis"; centimes: number; phrase: string }
  | { statut: "refusee"; phrase: string };

/** Ce que le dépôt lit du studio : les mêmes doubles que le dépôt d'une image (tests). */
export type DependancesTexteIV = Pick<DependancesEcranIV, "formatOuvert" | "voix" | "taux" | "accordEssai" | "brouillon" | "lancer" | "abandonner">;

/** Un seul dépôt de texte à la fois (double clic, deux onglets). */
const verrouDepotTexte = creerVerrou();

/** Titre de la vidéo : les premiers mots du texte de Will. PUR. */
export function titreDuTexte(texte: string): string {
  const t = texte.normalize("NFC").replace(/\s+/g, " ").trim();
  if (t.length <= 60) return t || "Image → vidéo";
  return `${t.slice(0, 60).replace(/\s+\S*$/, "")}…`;
}

async function formatOuvertParDefaut() {
  const { trouverFormat } = await import("@/formats");
  return !!trouverFormat(ID_FORMAT_IMAGE_VIDEO);
}
async function voixParDefaut() {
  const { voixDeReference } = await import("./cas-concret");
  return voixDeReference();
}
async function brouillonParDefaut(e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) {
  const { nouveauBrouillonFormat } = await import("./creation-format");
  const video = await nouveauBrouillonFormat({ formatId: ID_FORMAT_IMAGE_VIDEO, ...e });
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  await enregistrerScriptDuBrouillon(video.id, BLOCS_SCRIPT_PROVISOIRE_IV(video.id));
  return video;
}
async function abandonnerParDefaut(videoId: Id) {
  const { abandonnerBrouillon } = await import("./videos");
  await abandonnerBrouillon(videoId);
}
async function lancerParDefaut(videoId: Id, accord: AccordPrix | undefined, montant: number) {
  const { lancerAvecAccord } = await import("./creation-format");
  return lancerAvecAccord(videoId, accord, montant);
}

/** « Fabriquer la vidéo » depuis un texte : voir l'en-tête. Rien n'est créé tant que l'accord manque. */
export async function deposerTexteImageVideo(d: DemandeDepotTexteIV, dep: DependancesTexteIV = {}): Promise<IssueDepotTexteIV> {
  await exigerSession();
  const refus = refusTexte(d.texte);
  if (refus) return { statut: "refusee", phrase: refus.message };
  const texte = d.texte.normalize("NFC").trim();
  const reseaux = RESEAUX_IV.filter((r) => (d.reseaux as readonly string[]).includes(r)) as ReseauIV[];
  if (!reseaux.length) return { statut: "refusee", phrase: (d.reseaux as readonly string[]).includes("tiktok") ? PHRASE_TIKTOK_RETIRE_IV : PHRASES_IV.sansReseau };
  if (!(await (dep.formatOuvert ?? formatOuvertParDefaut)())) return { statut: "refusee", phrase: PHRASES_IV.pasRaccorde };
  const voix = await (dep.voix ?? voixParDefaut)();
  if (!voix) return { statut: "refusee", phrase: PHRASES_IV.sansVoix };
  const montant = prixDuDepot(reseaux, await (dep.taux ?? (() => lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT)))());
  return verrouDepotTexte<IssueDepotTexteIV>(async () => {
    const accord = typeof d.accordCentimes === "number" && Number.isFinite(d.accordCentimes) ? d.accordCentimes : undefined;
    // Accord absent ou plus bas que le prix : rien n'est créé, le prix est redemandé.
    if (accord === undefined || accord < montant) return { statut: "accord-requis", centimes: montant, phrase: `Cette vidéo coûte au plus ${(montant / 100).toFixed(2).replace(".", ",")} €. Confirmez ce prix pour lancer.` };
    const accordEssaiReel = await (dep.accordEssai ?? (() => lireParametre<boolean>(PARAM_ACCORD_ESSAI_IV, false)))();
    const titre = titreDuTexte(texte);
    const entrees = {
      imageVideo: {
        // Aucun fichier : la « clé d'image » ne sert qu'à reconnaître un texte (`estCleTexte`).
        imageCle: `${PROVENANCE_TEXTE}:${cleDuTexte(texte)}`,
        texte,
        reseaux,
        // Le plafond de la caisse est le prix « au plus » affiché et confirmé, comme pour une image.
        plafondCentimes: montant,
        accordEssaiReel: accordEssaiReel === true,
      },
    };
    const distribution: Distribution[] = [{ role: "voix", source: "double", personnageId: voix.personnageId, voixId: voix.voixId }];
    const video = await (dep.brouillon ?? brouillonParDefaut)({ titre, sujet: titre, distribution, entrees });
    const abandonner = () => (dep.abandonner ?? abandonnerParDefaut)(video.id).catch(() => undefined);
    try {
      const issue = await (dep.lancer ?? lancerParDefaut)(video.id, accord, montant);
      if (issue.statut === "accord-requis") {
        await abandonner();
        return issue;
      }
      await journaliser("video", "Texte décrit : « Image → vidéo » lancée (mode texte)", { type: "video", id: video.id }).catch(() => undefined);
      return { statut: "lancee", videoId: video.id };
    } catch (e) {
      if (e instanceof ErreurStudio) await abandonner();
      if (e instanceof ErreurStudio && e.code === "CONFIRMATION_REQUISE" && typeof e.montant === "number") return { statut: "accord-requis", centimes: e.montant, phrase: e.message };
      if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
      throw e;
    }
  });
}
