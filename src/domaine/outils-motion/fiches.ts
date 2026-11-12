/**
 * FICHES DE DONNÉES des générateurs « Tutoriel d'outil » et « Démo facecam » (lot G). PUR.
 *
 * Validation TOLÉRANTE : jamais de refus. Une donnée absente ou absurde reçoit sa valeur par défaut et donne une
 * REMARQUE (phrase simple, vouvoiement) ; c'est Williams qui décide. Le script de Williams fait foi.
 */
import { z } from "zod";

const texte = z.string().catch("").transform((t) => t.trim());
const identifiant = z.string().catch("").transform((t) => t.trim());

/* ------------------------------ Tutoriel d'outil ------------------------------ */

const schemaTutorielOutil = z.object({
  titre: texte,
  /** Nom de l'outil montré en plein écran. */
  outil: texte,
  idee: texte,
  scriptColle: texte,
});

export interface FicheTutorielOutil {
  /** « script » : Williams a collé son script ; « idee » : un titre ou une idée, le script sera généré. */
  source: "script" | "idee";
  titre: string;
  outil: string;
  idee: string;
  scriptColle: string;
  /** Le script (collé ou généré) est lisible et modifiable avant validation : toujours vrai. */
  scriptAValider: true;
  /** Voix HeyGen épinglée ; aucun visage. */
  voix: { fournisseur: "heygen" };
  visage: false;
  /** Gestes de motion design permis (identifiants du catalogue). */
  gestes: readonly string[];
}

export interface AnalyseFiche<F> {
  fiche: F;
  /** Remarques pour Williams ; vide quand tout est en ordre. Jamais un refus. */
  remarques: string[];
}

export function analyserFicheTutorielOutil(brut: unknown): AnalyseFiche<FicheTutorielOutil> {
  const p = schemaTutorielOutil.catch({ titre: "", outil: "", idee: "", scriptColle: "" }).parse(brut && typeof brut === "object" ? brut : {});
  const source = p.scriptColle ? "script" : "idee";
  const remarques: string[] = [];
  if (!p.scriptColle && !p.titre && !p.idee) remarques.push("Collez votre script, ou donnez un titre ou une idée : le studio écrira un script que vous relirez.");
  if (!p.titre && (p.scriptColle || p.idee)) remarques.push("Un titre aiderait à ranger la vidéo.");
  if (p.scriptColle && p.scriptColle.split(/\s+/).length > 400) remarques.push("Votre script est long : la vidéo risque de dépasser une minute et demie.");
  const fiche: FicheTutorielOutil = {
    source,
    titre: p.titre,
    outil: p.outil,
    idee: p.idee,
    scriptColle: p.scriptColle,
    scriptAValider: true,
    voix: { fournisseur: "heygen" },
    visage: false,
    gestes: ["curseur", "clic", "zoom", "frappe", "legende"],
  };
  return { fiche, remarques };
}

/* ------------------------------ Démo facecam ------------------------------ */

const schemaDemoFacecam = z.object({
  titre: texte,
  videoFacecamId: identifiant,
  videoEcranId: identifiant,
});

export interface FicheDemoFacecam {
  /** « deux-videos » : facecam + enregistrement d'écran ; « une-video » : une seule vidéo déposée. */
  mode: "deux-videos" | "une-video" | "aucune-video";
  titre: string;
  videoFacecamId: string;
  videoEcranId: string;
  /** Écran partagé : facecam d'un côté, écran réel de l'autre. */
  ecranPartage: true;
  /** Le motion design reste autour de l'écran, jamais devant le visage. */
  motionAutourDeLEcranSeulement: true;
  sousTitresCales: true;
}

export function analyserFicheDemoFacecam(brut: unknown): AnalyseFiche<FicheDemoFacecam> {
  const p = schemaDemoFacecam.catch({ titre: "", videoFacecamId: "", videoEcranId: "" }).parse(brut && typeof brut === "object" ? brut : {});
  const mode = p.videoFacecamId && p.videoEcranId ? "deux-videos" : p.videoFacecamId || p.videoEcranId ? "une-video" : "aucune-video";
  const remarques: string[] = [];
  if (mode === "aucune-video") remarques.push("Déposez votre vidéo facecam, et si vous l'avez votre enregistrement d'écran.");
  if (mode === "une-video") remarques.push("Une seule vidéo déposée : l'écran partagé sera tiré de cette vidéo. Avec un enregistrement d'écran, il sera plus net.");
  return {
    fiche: { mode, titre: p.titre, videoFacecamId: p.videoFacecamId, videoEcranId: p.videoEcranId, ecranPartage: true, motionAutourDeLEcranSeulement: true, sousTitresCales: true },
    remarques,
  };
}
