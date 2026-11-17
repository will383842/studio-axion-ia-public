/**
 * X4-12b : gestes de la note sur l'archive des extraits (service seul) : « Garder quand même », « Changer le sujet »,
 * « Chiffres réels ». Chacun exige une session AVANT toute lecture, écrit sous verrou, journalise une ligne, ne supprime rien.
 * Les transformations sont les fonctions pures de `briques/archive-extraits/gestes-note`. Aucun réglage lu ni écrit.
 * Tout éteint : rien n'appelle ces gestes avant X4-12d (l'écran).
 */
import "server-only";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque } from "@/domaine/types";
import { changerSujet, garderQuandMeme, marquerChiffresReels } from "@/briques/archive-extraits/gestes-note";
import { idElementArchive, type PortsGestes, type ResultatGeste } from "./archive-extraits";
import { depots, journaliser, sousVerrou } from "./_commun";

const SANS_EXTRAITS: ResultatGeste = { ok: false, message: "Cette vidéo n'a pas d'extraits archivés." };
const PLAGE_ABSENTE: ResultatGeste = { ok: false, message: "Cet extrait n'existe plus." };

const lesDepots = (p?: PortsGestes) => (p?.depots ?? depots)();
const horloge = (p?: PortsGestes) => (p?.maintenant ?? (() => new Date().toISOString()))();

async function exigerLaSession(ports?: PortsGestes): Promise<void> {
  if (ports?.session) {
    await ports.session();
    return;
  }
  const { exigerSession } = await import("./auth");
  await exigerSession();
}

async function lireFiche(videoId: string, ports?: PortsGestes): Promise<{ element: ElementBibliotheque; fiche: FicheSourceExtraits } | null> {
  const element = await lesDepots(ports).elements.obtenir(idElementArchive(videoId));
  return element && element.valeur.type === "source-extraits" ? { element, fiche: element.valeur.fiche } : null;
}

async function ecrireFiche(element: ElementBibliotheque, fiche: FicheSourceExtraits, maintenant: string, libelle: string, videoId: string, ports?: PortsGestes) {
  await sousVerrou(() =>
    lesDepots(ports).elements.enregistrer({ ...element, valeur: { type: "source-extraits", fiche }, modifieLe: maintenant }),
  );
  await journaliser("archive-extraits", libelle, { type: "video", id: videoId });
}

/** Modifie une plage de la fiche. `changer` rend la nouvelle plage, ou un refus en français. */
async function gestePlage(
  videoId: string,
  plageId: string,
  changer: (p: PlageExtrait, maintenant: string) => PlageExtrait | string,
  libelle: string,
  ports?: PortsGestes,
): Promise<ResultatGeste> {
  await exigerLaSession(ports);
  const lue = await lireFiche(videoId, ports);
  if (!lue) return SANS_EXTRAITS;
  const plage = lue.fiche.plages.find((p) => p.id === plageId);
  if (!plage) return PLAGE_ABSENTE;
  const maintenant = horloge(ports);
  const suivante = changer(plage, maintenant);
  if (typeof suivante === "string") return { ok: false, message: suivante };
  const fiche = { ...lue.fiche, plages: lue.fiche.plages.map((p) => (p.id === plageId ? suivante : p)) };
  await ecrireFiche(lue.element, fiche, maintenant, libelle, videoId, ports);
  return { ok: true };
}

/** « Garder quand même » : la plage est validée ; une plage « à vérifier » devient « utilisable ». Une plage écartée se rétablit d'abord. */
export function garderQuandMemeExtrait(videoId: string, plageId: string, ports?: PortsGestes): Promise<ResultatGeste> {
  return gestePlage(
    videoId,
    plageId,
    (p, maintenant) => {
      if (p.etat === "ecartee") return "Rétablissez d'abord cet extrait.";
      const r = garderQuandMeme(p, maintenant);
      if (typeof r === "string") return r;
      if (r.etat !== "a_verifier") return r;
      const { raisonExclusion: _r, ...reste } = r;
      void _r;
      return { ...reste, etat: "utilisable" };
    },
    "Extrait gardé quand même",
    ports,
  );
}

/** « Changer le sujet » : un des sujets connus, sinon refus. */
export function changerSujetExtrait(videoId: string, plageId: string, sujet: string, ports?: PortsGestes): Promise<ResultatGeste> {
  return gestePlage(videoId, plageId, (p, maintenant) => changerSujet(p, sujet, maintenant), "Sujet d'un extrait corrigé", ports);
}

/** « Chiffres réels » : coche ou décoche pour toute la vidéo. */
export async function marquerChiffresReelsVideo(videoId: string, oui: boolean, ports?: PortsGestes): Promise<ResultatGeste> {
  await exigerLaSession(ports);
  const lue = await lireFiche(videoId, ports);
  if (!lue) return SANS_EXTRAITS;
  const maintenant = horloge(ports);
  await ecrireFiche(lue.element, marquerChiffresReels(lue.fiche, oui), maintenant, oui ? "Chiffres réels cochés" : "Chiffres réels décochés", videoId, ports);
  return { ok: true };
}
