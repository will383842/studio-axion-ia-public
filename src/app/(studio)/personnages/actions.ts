"use server";

/**
 * Actions serveur des PERSONNAGES (développeur B). Chacune commence par exigerSession().
 * Les dépôts de fichiers sont SIMULÉS en V1 : seules les informations du fichier (nom, type, taille) partent.
 */
import { revalidatePath } from "next/cache";
import type { AngleVisage, NaturePersonnage, ReglagesVoix, Voix } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, ErreurStudio, type Resultat } from "@/services/_commun";
import { choisirDoubleHeygen, listerDoublesHeygen, retirerDoubleHeygen, type DoubleHeygenAffiche } from "@/services/doubles-heygen";
import { changerLangueVoix, completerVignetteVisage } from "@/services/B-personnages-bibliotheque";
import { fichiersEnvoyes } from "@/services/fichiers";
import type { Montant } from "@/domaine/types";
import {
  ajouterVisage,
  choisirVisageParDefaut,
  choisirVisagePourFormat,
  choisirVoixParDefaut,
  choisirVoixPourFormat,
  creerPersonnage,
  ecouterEssaiVoix,
  listerVoixHeygen,
  relierVoixExistante,
  type VoixHeygenAffichee,
  enregistrerAccord,
  enregistrerVoix,
  modifierReglagesVoix,
  preparerVisage,
  testerVisage,
} from "@/services/personnages";

/** Un fichier déjà envoyé par le navigateur (`envoyerFichier` → `/api/depots`) : seul son identifiant part ici. */
export interface FichierEnvoye {
  fichierId: string;
}

/**
 * B5 (audit A) : les octets sont VRAIMENT arrivés dans le stockage, pour ce personnage et cette destination (visage,
 * voix, accord) ; jamais une simple fiche (nom, type, taille).
 */
async function deposer(fichiers: FichierEnvoye[], typeEntite: string, entiteId: string): Promise<string[]> {
  return (await fichiersEnvoyes(fichiers.map((f) => f?.fichierId), typeEntite, entiteId)).map((f) => f.id);
}

function rafraichir(id?: string) {
  revalidatePath("/personnages");
  if (id) revalidatePath(`/personnages/${id}`);
}

export async function creerPersonnageAction(donnees: { nom: string; nature: NaturePersonnage; role?: string }): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    const nom = donnees.nom?.trim() ?? "";
    if (nom.length < 2) throw new ErreurStudio("NOM", "Indiquez un nom.");
    if (!["moi", "reel", "invente"].includes(donnees.nature)) throw new ErreurStudio("NATURE", "Choisissez qui c'est.");
    const id = await creerPersonnage({ nom: nom.slice(0, 80), nature: donnees.nature, role: donnees.role?.trim().slice(0, 80) || undefined });
    rafraichir(id);
    return { id };
  });
}

export async function ajouterVisageAction(
  personnageId: string,
  donnees: { nom: string; angle: AngleVisage; tenue: string; decor: string; fichiers: FichierEnvoye[] },
): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!donnees.fichiers.length) throw new ErreurStudio("FICHIERS", "Déposez au moins une vidéo de vous.");
    if (!["face", "trois-quarts", "profil"].includes(donnees.angle)) throw new ErreurStudio("ANGLE", "Choisissez un angle.");
    const fichierIds = await deposer(donnees.fichiers, "visage", personnageId);
    const nom = donnees.nom.trim() || [donnees.tenue, donnees.decor].filter(Boolean).join(", ") || "Nouveau visage";
    const id = await ajouterVisage(personnageId, { nom: nom.slice(0, 80), angle: donnees.angle, tenue: donnees.tenue.trim().slice(0, 60), fondTournage: donnees.decor.trim().slice(0, 60), fichierIds });
    await completerVignetteVisage(id);
    await preparerVisage(id);
    rafraichir(personnageId);
    return { id };
  });
}

export async function preparerVisageAction(personnageId: string, visageId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await completerVignetteVisage(visageId);
    await preparerVisage(visageId);
    rafraichir(personnageId);
    return undefined;
  });
}

/* --- Lot R7 : « Choisir mon double HeyGen » (créé dans l'application HeyGen) --- */

export async function listerDoublesHeygenAction(personnageId: string): Promise<Resultat<{ branche: boolean; doubles: DoubleHeygenAffiche[] }>> {
  await exigerSession();
  return essayer(() => listerDoublesHeygen(String(personnageId)));
}

export async function choisirDoubleHeygenAction(personnageId: string, choix: { idExterne: string; angle: AngleVisage; tenue?: string }): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!choix?.idExterne || typeof choix.idExterne !== "string") throw new ErreurStudio("DOUBLE", "Choisissez un double.");
    const id = await choisirDoubleHeygen(String(personnageId), { idExterne: choix.idExterne.slice(0, 120), angle: choix.angle, tenue: typeof choix.tenue === "string" ? choix.tenue : undefined });
    rafraichir(personnageId);
    return { id };
  });
}

export async function retirerDoubleHeygenAction(personnageId: string, visageId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await retirerDoubleHeygen(String(visageId));
    rafraichir(personnageId);
    return undefined;
  });
}

export async function testerVisageAction(visageId: string, texte: string): Promise<Resultat<{ url: string }>> {
  await exigerSession();
  return essayer(async () => ({ url: await testerVisage(visageId, texte.slice(0, 400)) }));
}

export async function enregistrerVoixAction(personnageId: string, donnees: { fichiers: FichierEnvoye[]; minutes: number; langue?: Voix["langue"] }): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!donnees.fichiers.length) throw new ErreurStudio("FICHIERS", "Aucun enregistrement à garder.");
    const minutes = Math.round(Math.max(0.1, Math.min(120, Number(donnees.minutes) || 0)) * 10) / 10;
    const fichierIds = await deposer(donnees.fichiers, "voix", personnageId);
    const id = await enregistrerVoix(personnageId, { fichierIds, minutes, langue: donnees.langue });
    rafraichir(personnageId);
    return { id };
  });
}

export async function reglerVoixAction(personnageId: string, voixId: string, reglages: ReglagesVoix): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const r: ReglagesVoix = {
      vitesse: Math.min(1.5, Math.max(0.5, Number(reglages.vitesse) || 1)),
      stabilite: Math.min(100, Math.max(0, Math.round(Number(reglages.stabilite) || 0))),
      emotion: Math.min(100, Math.max(0, Math.round(Number(reglages.emotion) || 0))),
    };
    await modifierReglagesVoix(voixId, r);
    rafraichir(personnageId);
    return undefined;
  });
}

export async function changerLangueVoixAction(personnageId: string, voixId: string, langue: Voix["langue"]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await changerLangueVoix(voixId, langue);
    rafraichir(personnageId);
    return undefined;
  });
}

export async function ecouterEssaiVoixAction(voixId: string, texte: string): Promise<Resultat<{ url: string; dureeSec: number; cout: Montant; simulee: boolean }>> {
  await exigerSession();
  return essayer(() => ecouterEssaiVoix(voixId, texte.slice(0, 400)));
}

/* --- Lot M0b : « Relier ma voix HeyGen » --- */

export async function listerVoixHeygenAction(personnageId: string): Promise<Resultat<{ voix: VoixHeygenAffichee[]; simulee: boolean }>> {
  await exigerSession();
  return essayer(() => listerVoixHeygen(String(personnageId)));
}

export async function relierVoixHeygenAction(personnageId: string, idExterne: string): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!idExterne || typeof idExterne !== "string") throw new ErreurStudio("VOIX", "Choisissez une voix.");
    const id = await relierVoixExistante(String(personnageId), idExterne.slice(0, 120));
    rafraichir(personnageId);
    return { id };
  });
}

export async function choisirVoixParDefautAction(personnageId: string, voixId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirVoixParDefaut(String(personnageId), String(voixId));
    rafraichir(personnageId);
    return undefined;
  });
}

/** Voix par défaut d'un format (« Vidéo type avocat → Voix avocat rapide ») ; `voixId` null : la voix habituelle. */
export async function choisirVoixPourFormatAction(personnageId: string, formatId: string, voixId: string | null): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirVoixPourFormat(String(personnageId), String(formatId), voixId ? String(voixId) : null);
    rafraichir(personnageId);
    return undefined;
  });
}

/** Correcteur 4 : « Visage par défaut » sur la fiche d'un visage. */
export async function choisirVisageParDefautAction(personnageId: string, visageId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirVisageParDefaut(String(personnageId), String(visageId));
    rafraichir(personnageId);
    return undefined;
  });
}

/** Correcteur 4 : avatar par défaut d'un format (« Vidéo type avocat → avatar en costume ») ; `visageId` null : l'habituel. */
export async function choisirVisagePourFormatAction(personnageId: string, formatId: string, visageId: string | null): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirVisagePourFormat(String(personnageId), String(formatId), visageId ? String(visageId) : null);
    rafraichir(personnageId);
    return undefined;
  });
}

export async function enregistrerAccordAction(personnageId: string, donnees: { case: boolean; document: FichierEnvoye | null; date: string; perimetre?: string }): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (!donnees.case || !donnees.document || !donnees.date) throw new ErreurStudio("ACCORD_INCOMPLET", "Cochez la case, déposez le document et indiquez la date.");
    if (Number.isNaN(new Date(donnees.date).getTime())) throw new ErreurStudio("DATE", "Cette date n'est pas valide.");
    if (new Date(donnees.date).getTime() > Date.now() + 86_400_000) throw new ErreurStudio("DATE", "La date de l'accord ne peut pas être dans le futur.");
    const [documentFichierId] = await deposer([donnees.document], "accord", personnageId);
    await enregistrerAccord(personnageId, { case: true, documentFichierId, date: donnees.date, perimetre: donnees.perimetre?.trim().slice(0, 200) || undefined });
    rafraichir(personnageId);
    return undefined;
  });
}
