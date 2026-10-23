/**
 * CHOISIR MON DOUBLE HEYGEN (lot R7, décision de Will du 03/10). Will crée et essaie son double DANS L'APPLICATION
 * HEYGEN ; la console lit les doubles de son compte (lecture gratuite) et il en choisit un par angle. Le double choisi
 * devient un visage « prêt » du personnage. Le studio ne le fait PAS parler (décision du 03/10) : Will fait ses vidéos
 * dans HeyGen et les rattache à leur version (`services/videos-heygen.ts`).
 *
 * Rien n'est créé chez HeyGen ici, rien n'est payé. Un double pas encore terminé, en attente d'accord ou sans le
 * moteur le plus réaliste est montré mais ne peut pas être choisi. Rien n'est effacé : « Ne plus utiliser » range la
 * liaison (date de remplacement), le visage reste.
 */
import "server-only";
import type { AngleVisage, Id, Visage } from "@/domaine/types";
import { normaliserTenue } from "@/domaine/distribution";
import { etatConnexion, resoudreFournisseur } from "@/fournisseurs";
import type { DoubleExistant } from "@/fournisseurs/types";
import { nouvelId } from "@/lib/ids";
import { depots, enregistrerRessource, ErreurStudio, horodatage, journaliser, ressourceActive } from "./_commun";
import { exigerSession } from "./auth";
import { accordComplet } from "./personnages";

export interface DoubleHeygenAffiche extends DoubleExistant {
  /** Visage du personnage qui utilise déjà ce double. */
  utiliseParVisageId?: Id;
}

const ANGLES_DOUBLE: AngleVisage[] = ["trois-quarts", "face"];

function fournisseurHeygen() {
  const f = resoudreFournisseur("visage", "heygen");
  const branche = f.id === "heygen" && f.mode === "reel" && !!f.listerDoubles && etatConnexion("visage", "heygen") === "relie";
  return { f, branche };
}

/** Les doubles du compte HeyGen (lecture gratuite). `branche: false` : le double HeyGen n'est pas relié au serveur. */
export async function listerDoublesHeygen(personnageId: Id): Promise<{ branche: boolean; doubles: DoubleHeygenAffiche[] }> {
  await exigerSession();
  const { f, branche } = fournisseurHeygen();
  if (!branche) return { branche: false, doubles: [] };
  const liste = await f.listerDoubles!();
  const visages = await depots().visages.lister((v) => v.personnageId === personnageId);
  const sortie: DoubleHeygenAffiche[] = [];
  for (const d of liste) {
    let utiliseParVisageId: Id | undefined;
    for (const v of visages) {
      const r = await ressourceActive(v.id);
      if (r?.fournisseur === "heygen" && r.idExterne === d.idExterne) utiliseParVisageId = v.id;
    }
    sortie.push({ ...d, ...(utiliseParVisageId ? { utiliseParVisageId } : {}) });
  }
  return { branche: true, doubles: sortie };
}

/**
 * « Utiliser ce double » : le double choisi devient un visage PRÊT du personnage (angle, tenue), relié chez HeyGen.
 * Choisi deux fois : le même visage (rien n'est créé de plus).
 */
export async function choisirDoubleHeygen(personnageId: Id, choix: { idExterne: string; angle: AngleVisage; tenue?: string }): Promise<Id> {
  await exigerSession();
  const d = depots();
  const p = await d.personnages.obtenir(personnageId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Ce personnage n'existe plus.");
  if (!accordComplet(p)) throw new ErreurStudio("ACCORD_MANQUANT", `Enregistrez d'abord l'accord de ${p.nom}.`);
  if (!ANGLES_DOUBLE.includes(choix.angle)) throw new ErreurStudio("ANGLE", "Choisissez « Trois quarts » ou « Presque de face ».");
  const { f, branche } = fournisseurHeygen();
  if (!branche) throw new ErreurStudio("DOUBLE_NON_RELIE", "Le double HeyGen n'est pas encore relié au serveur.");
  const double = (await f.listerDoubles!()).find((x) => x.idExterne === choix.idExterne);
  if (!double) throw new ErreurStudio("INTROUVABLE", "Ce double n'existe plus dans votre compte HeyGen.");
  if (!double.utilisable) throw new ErreurStudio("DOUBLE_PAS_PRET", double.raison ?? "Ce double n'est pas encore prêt chez HeyGen.");
  const visages = await d.visages.lister((v) => v.personnageId === personnageId);
  for (const v of visages) {
    const r = await ressourceActive(v.id);
    if (r?.fournisseur === "heygen" && r.idExterne === choix.idExterne) {
      await d.visages.modifier(v.id, { angle: choix.angle, statut: "pret" });
      return v.id;
    }
  }
  // Lot R7e : un ou deux avatars par personnage. Sans tenue indiquée, le second reprend celle de l'avatar déjà relié
  // (les deux angles d'une vidéo ont la même tenue : sinon le second angle n'est jamais utilisé).
  const autreHeygen = visages.find((x) => x.fournisseur === "heygen" && x.statut === "pret" && x.angle !== choix.angle);
  const tenue = (choix.tenue ?? "").trim().slice(0, 60) || (autreHeygen?.tenue ?? "");
  const v: Visage = {
    id: nouvelId("vis"),
    personnageId,
    nom: double.nom.slice(0, 80),
    angle: choix.angle,
    tenue,
    tenueId: normaliserTenue(tenue) || undefined,
    fondTournage: "Créé dans HeyGen",
    posture: "assis",
    origine: "filme",
    // Will l'a créé et essayé dans HeyGen : le choisir, c'est le valider.
    statut: "pret",
    fichierIds: [],
    fournisseur: "heygen",
    versionFournisseur: "avatar_v",
    ...horodatage(),
  };
  await d.visages.enregistrer(v);
  await enregistrerRessource({ id: nouvelId("rf"), entite: "visage", entiteId: v.id, fournisseur: "heygen", idExterne: choix.idExterne, versionModele: "avatar_v", statut: "pret", accordId: p.accord?.documentFichierId, ...horodatage() });
  await journaliser("personnage", `Double HeyGen choisi : « ${double.nom} » (${choix.angle === "face" ? "presque de face" : "trois quarts"})`, { type: "personnage", id: personnageId });
  // Lot R7e : le nouvel avatar devient le visage par défaut SEULEMENT si le défaut actuel manque ou n'est pas un avatar
  // HeyGen prêt (un choix existant de Will n'est jamais écrasé sans le dire — relecture R7e n° 5).
  const defaut = p.visageParDefautId ? visages.find((x) => x.id === p.visageParDefautId) : undefined;
  if (!defaut || defaut.fournisseur !== "heygen" || defaut.statut !== "pret") await d.personnages.modifier(personnageId, { visageParDefautId: v.id });
  else await journaliser("personnage", `Le visage par défaut est gardé : « ${defaut.nom} ». Pour le changer, choisissez-le dans Personnages.`, { type: "personnage", id: personnageId });
  return v.id;
}

/** « Ne plus utiliser » : la liaison est rangée (jamais effacée), le visage n'est plus prêt pour les vidéos. */
export async function retirerDoubleHeygen(visageId: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const r = await ressourceActive(visageId);
  if (!r || r.fournisseur !== "heygen") throw new ErreurStudio("INTROUVABLE", "Ce visage n'utilise pas de double HeyGen.");
  await d.ressourcesFournisseurs.modifier(r.id, { remplaceeLe: new Date().toISOString() });
  await d.visages.modifier(visageId, { statut: "brouillon" });
}
