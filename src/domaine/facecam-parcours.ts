/**
 * PARCOURS FACE CAMÉRA — règles d'écran (plan facecam v4, § C et B.13, B.25 à B.27 ; lot D). PUR : client et serveur.
 *
 * Envoi depuis l'iPhone (contrôle du fichier), analyse des 3 premières secondes, attente en 4 étapes parlantes avec
 * « Prête vers 14 h 20 », notifications prête ou échec, phrases de « Votre vidéo ». Vocabulaire simple, aucun prix.
 */
import { ETAPES_MONTAGE_FACECAM, EtatFacecam, LIBELLES_ETAT_FACECAM } from "./facecam";
import { formateurDate } from "@/lib/intl";

/* ------------------------------------------------------------------ */
/* Contrôle du fichier reçu (avant et après l'envoi)                   */
/* ------------------------------------------------------------------ */

export interface MetaVideo {
  largeur: number;
  hauteur: number;
  dureeSec: number;
  taille: number;
  mime?: string;
}

export interface ControleFichier {
  ok: boolean;
  /** Bloquant : le fichier ne doit pas partir (renvoyer depuis Fichiers). */
  bloquant: boolean;
  etat?: EtatFacecam;
  /** Phrase pour Will (absente : rien à dire). */
  message?: string;
  /** Conseil non bloquant (vidéo verticale, très courte…). */
  conseils: string[];
}

/** iPhone 16 Pro Max à l'horizontale, 4K : 3840 × 2160. En deçà de 2560 px de large, iOS a réduit la vidéo. */
export const COTE_LONG_MIN = 2560;
/** Débit minimal d'une vraie 4K HEVC (≈ 8 Mb/s) ; en deçà, la photothèque l'a recompressée. */
export const DEBIT_MIN_BITS = 8_000_000;
export const DUREE_MIN_SEC = 5;

export function controlerFichier(m: MetaVideo): ControleFichier {
  const conseils: string[] = [];
  const coteLong = Math.max(m.largeur, m.hauteur);
  const debit = m.dureeSec > 0 ? (m.taille * 8) / m.dureeSec : Infinity;
  if (m.largeur > 0 && m.hauteur > 0 && m.hauteur > m.largeur) conseils.push("Vidéo filmée à la verticale : la prochaine fois, tenez l'iPhone à l'horizontale.");
  if (m.dureeSec > 0 && m.dureeSec < DUREE_MIN_SEC) return { ok: false, bloquant: true, message: "Cette vidéo dure moins de 5 secondes : choisissez la bonne vidéo.", conseils };
  if ((coteLong > 0 && coteLong < COTE_LONG_MIN) || debit < DEBIT_MIN_BITS) {
    return { ok: false, bloquant: true, etat: EtatFacecam.FichierReduitIos, message: LIBELLES_ETAT_FACECAM[EtatFacecam.FichierReduitIos].libelle, conseils };
  }
  return { ok: true, bloquant: false, conseils };
}

/* ------------------------------------------------------------------ */
/* Analyse automatique des 3 premières secondes (B.27)                 */
/* ------------------------------------------------------------------ */

export interface MesuresDebut {
  /** Part des images du début où un visage est trouvé (0 à 100). */
  visageTrouvePct: number;
  /** Luminance moyenne du visage (0 à 255) ; absente : non mesurée. */
  luminanceVisage?: number;
  hdr?: boolean;
  /** Niveau sonore du début (LUFS) ; absent : non mesuré. */
  niveauLufs?: number;
}

export interface AlerteDebut {
  etat?: EtatFacecam;
  message: string;
  /** Le montage continue quand même (une alerte ne bloque jamais la livraison). */
  bloquant: false;
}

export function analyserDebut(m: MesuresDebut): AlerteDebut[] {
  const a: AlerteDebut[] = [];
  if (m.visageTrouvePct < 60) a.push({ etat: EtatFacecam.VisageIntrouvable, message: "Votre visage est peu visible au début : le studio fait au mieux. La prochaine fois, regardez l'objectif dès le départ.", bloquant: false });
  else if (m.luminanceVisage !== undefined && m.luminanceVisage < 55) a.push({ etat: EtatFacecam.VisageIntrouvable, message: "Image très sombre : le studio l'éclaircit. La prochaine fois, approchez la lampe (à 45°).", bloquant: false });
  if (m.hdr) a.push({ etat: EtatFacecam.HdrOuLog, message: LIBELLES_ETAT_FACECAM[EtatFacecam.HdrOuLog].libelle, bloquant: false });
  if (m.niveauLufs !== undefined && m.niveauLufs < -40) a.push({ message: "Le son est très faible : vérifiez le micro la prochaine fois.", bloquant: false });
  return a;
}

/* ------------------------------------------------------------------ */
/* Attente : 4 étapes parlantes et « Prête vers 14 h 20 » (B.25)       */
/* ------------------------------------------------------------------ */

/** Étape du moteur → étape parlante (0 Le son, 1 Les coupes, 2 L'image, 3 Les sous-titres et cartes). */
const ETAPE_PARLANTE: Record<string, number> = { reception: 0, son: 0, coupes: 1, etalonnage: 2, image: 2, montage: 2, "sous-titres": 3, cartes: 3, export: 3, controle: 3, relecture: 3 };

export interface EtapeMoteurVue {
  cle: string;
  statut: "en_attente" | "en_cours" | "terminee" | "echec" | "ignoree";
}

export interface EtapeParlante {
  nom: (typeof ETAPES_MONTAGE_FACECAM)[number];
  statut: "a-venir" | "en-cours" | "faite" | "echec";
}

/** Les 4 étapes parlantes d'après les étapes du moteur (une étape parlante est faite quand toutes les siennes le sont). */
export function etapesParlantes(etapes: EtapeMoteurVue[]): EtapeParlante[] {
  return ETAPES_MONTAGE_FACECAM.map((nom, i) => {
    const siennes = etapes.filter((e) => (ETAPE_PARLANTE[e.cle] ?? 3) === i);
    const statut: EtapeParlante["statut"] = siennes.some((e) => e.statut === "echec")
      ? "echec"
      : siennes.length && siennes.every((e) => e.statut === "terminee" || e.statut === "ignoree")
        ? "faite"
        : siennes.some((e) => e.statut === "en_cours" || e.statut === "terminee")
          ? "en-cours"
          : "a-venir";
    return { nom, statut };
  });
}

/** « Prête vers 14 h 20 » (heure de Paris, arrondie aux 5 minutes au-dessus). Null si l'heure est passée ou inconnue. */
export function heurePrete(finEstimeeIso: string | undefined, maintenantMs = Date.now()): string | null {
  if (!finEstimeeIso) return null;
  const fin = Date.parse(finEstimeeIso);
  if (!Number.isFinite(fin) || fin <= maintenantMs) return null;
  const arrondi = new Date(Math.ceil(fin / 300_000) * 300_000);
  const parties = formateurDate("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Paris" }).formatToParts(arrondi);
  const h = Number(parties.find((p) => p.type === "hour")?.value ?? 0);
  const m = parties.find((p) => p.type === "minute")?.value ?? "00";
  return `Prête vers ${h} h ${m}`;
}

/* ------------------------------------------------------------------ */
/* Notifications et phrases de « Votre vidéo »                         */
/* ------------------------------------------------------------------ */

export function notificationFacecam(issue: "prete" | "echec", titre: string, videoId: string): { titre: string; message: string; lien: string } {
  return issue === "prete"
    ? { titre: "Votre vidéo est prête", message: `« ${titre} » : regardez-la et validez.`, lien: `/videos/${videoId}` }
    : { titre: "Votre vidéo n'a pas pu être montée", message: `« ${titre} » : touchez pour réessayer.`, lien: `/videos/${videoId}` };
}

/** « J'ai compris 3 consignes » (rien si aucune). */
export function phraseConsignes(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "J'ai compris 1 consigne" : `J'ai compris ${n} consignes`;
}

/** Pictogrammes de l'écran de départ iPad (C.2), dans l'ordre. */
export const CONSEILS_DEPART_IPAD = [
  { cle: "horizontal", titre: "iPhone à l'horizontale", detail: "Caméra arrière, à hauteur des yeux." },
  { cle: "piece-vide", titre: "3 s sans vous", detail: "Filmez la pièce vide avant d'entrer dans le cadre." },
  { cle: "lampe", titre: "Lampe à 45°", detail: "Sur le côté, un peu au-dessus du visage." },
  { cle: "monteur", titre: "« Monteur, … »", detail: "Dites une consigne à voix haute, puis 1 s de pause." },
] as const;
