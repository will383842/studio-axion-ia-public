/** Adaptateurs purs de l'image → vidéo vers le gabarit de création (étapes, récents). Aucun état, aucun montant. */
import type { EtapeBarre } from "@/components/ui/BarreEtapes";
import type { RecentGenerateur } from "@/components/creation/RecentsGenerateur";
import type { EtatSuivi, VueSuiviFabrication } from "@/components/creation/SuiviFabrication";
import type { VueLotIV } from "@/services/image-video-lot";
import { ETAPES_ECRANS, type EcranIV, type VueFabrication } from "./vue";

/** Les 5 écrans de l'onglet, l'écran courant allumé (même liste que `EtapesImageVideo`). */
export function etapesImageVideo(ecran: EcranIV | "depot"): { etapes: EtapeBarre[]; courante: number } {
  return { etapes: ETAPES_ECRANS.map((e) => ({ cle: e.ecran, libelle: e.nom })), courante: Math.max(0, ETAPES_ECRANS.findIndex((e) => e.ecran === ecran)) };
}

/** « Vos lots » puis « Vos vidéos » ; un groupe vide est ignoré par `RecentsGenerateur`. */
export function versRecentsImageVideo(lots: { lotId: string; ligne: string }[], videos: { videoId: string; titre: string; le: string }[]): { titre: string; elements: RecentGenerateur[] }[] {
  const groupes = [
    { titre: "Vos lots", elements: lots.map((l): RecentGenerateur => ({ id: l.lotId, href: `/image-video/lot/${encodeURIComponent(l.lotId)}`, titre: l.ligne, etat: "Lot", icone: "images" })) },
    { titre: "Vos vidéos", elements: videos.map((v): RecentGenerateur => ({ id: v.videoId, href: `/image-video/${encodeURIComponent(v.videoId)}`, titre: v.titre, etat: "Vidéo", date: v.le || undefined, icone: "images" })) },
  ];
  return groupes.filter((g) => g.elements.length);
}

/** La fabrication d'une vidéo, en vue normalisée du suivi : étapes seulement (les montants restent dans `Fabrication`). */
export function versSuiviFabricationIV(vue: Pick<VueFabrication, "pas">): VueSuiviFabrication {
  const etapes = vue.pas.map((p) => ({ cle: p.cle, libelle: p.nom, etat: (p.etat === "fait" ? "faite" : p.etat === "arrete" ? "arretee" : p.etat) as VueSuiviFabrication["etapes"][number]["etat"] }));
  const arretee = etapes.some((e) => e.etat === "arretee");
  const prete = etapes.length > 0 && etapes.every((e) => e.etat === "faite");
  return { etat: arretee ? "arretee" : prete ? "prete" : "en-cours", etapes };
}

/** L'état du titre d'une vidéo : en cours > arrêtée par Will > refus du moteur (« coincée ») > ce que disent les étapes. */
export function etatSuiviIV({ enCours, arretee, vue }: { enCours: boolean; arretee?: boolean; vue: Pick<VueFabrication, "pas" | "refus"> }): EtatSuivi {
  if (enCours) return "en-cours";
  if (arretee) return "arretee";
  if (vue.refus) return "coincee";
  return versSuiviFabricationIV(vue).etat;
}

const ETAPES_LOT: EtapeBarre[] = [
  { cle: "images", libelle: "Les images" },
  { cle: "fabrication", libelle: "Fabrication" },
  { cle: "a-relire", libelle: "À relire" },
];

/** Les 3 étapes d'un lot d'images (les images déposées, la fabrication, ce qu'il reste à relire). */
export function etapesLot(courante: 0 | 1 | 2): {
  etapes: EtapeBarre[];
  courante: number;
} {
  return { etapes: ETAPES_LOT, courante };
}

/** Le lot en vue normalisée du suivi : les trois étapes, sans montant ni message (« Relecture » : « À relire » reste le titre de la liste des vidéos mises de côté). */
export function versSuiviLot(
  vue: Pick<VueLotIV, "etape" | "statut" | "aRelire" | "action">,
): VueSuiviFabrication {
  const aRelire = vue.etape === 2 && vue.aRelire.length > 0;
  // Arrêté par Will sans rien à relire : le lot n'est pas « prêt », les vidéos pas commencées ne seront pas faites.
  const arreteParWill = vue.statut === "arrete" && !aRelire;
  const arrete = vue.action === "reprendre" || arreteParWill;
  const etats: VueSuiviFabrication["etapes"][number]["etat"][] =
    vue.etape === 0
      ? ["en-cours", "a-venir", "a-venir"]
      : vue.etape === 1 || arreteParWill
        ? ["faite", arrete ? "arretee" : "en-cours", "a-venir"]
        : ["faite", "faite", aRelire ? "arretee" : "faite"];
  return {
    ...(arreteParWill ? { message: "Vous avez arrêté le lot : les vidéos pas encore commencées ne seront pas fabriquées." } : {}),
    etat: arrete
      ? "arretee"
      : aRelire
        ? "a-relire"
        : vue.etape === 2
          ? "prete"
          : "en-cours",
    etapes: ETAPES_LOT.map((e, i) => ({
      cle: e.cle,
      libelle: e.cle === "a-relire" ? "Relecture" : e.libelle,
      etat: etats[i],
    })),
  };
}

/**
 * Titre du suivi d'un lot : une pause (crédit, prix, format) est « coincée » et dit sa phrase ; l'arrêt de Will garde son message.
 * Un lot fini avec des vidéos mises de côté n'a pas de titre commun (« Votre script attend votre relecture » serait faux) :
 * la liste « À relire » le dit, comme avant. « En cours » et « prête » n'ont pas non plus de titre commun (singulier).
 */
export function enteteSuiviLot(vue: Pick<VueLotIV, "etape" | "statut" | "aRelire" | "action" | "pause">): { etat: EtatSuivi | null; message?: string } {
  if (vue.action === "reprendre") return { etat: "coincee", ...(vue.pause ? { message: vue.pause } : {}) };
  const { etat, message } = versSuiviLot(vue);
  // « Votre vidéo se fabrique / est prête » (singulier) serait faux pour plusieurs images : le titre de la page et la liste disent déjà l'état.
  if (etat === "a-relire" || etat === "en-cours" || etat === "prete") return { etat: null };
  return { etat, ...(message ? { message } : {}) };
}
