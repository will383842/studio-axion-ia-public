/** Petits outils côté navigateur partagés par Personnages et Bibliothèque (groupe B). */

export interface InfosFichierClient {
  nom: string;
  mime: string;
  taille: number;
}

/**
 * Nom, type et taille d'un fichier (contrôle d'une LUT). Les AJOUTS de fichiers passent par le vrai envoi
 * (`envoyerFichiers`, `lib/envoi-multipart.ts`) : jamais une simple fiche à la place des octets (B5, audit A).
 */
export function infosFichier(f: File): InfosFichierClient {
  return { nom: f.name, mime: f.type || "application/octet-stream", taille: f.size };
}

/** Durée d'un fichier audio ou vidéo, lue dans le navigateur (0 si illisible). */
export function dureeMedia(f: File): Promise<number> {
  return new Promise((resoudre) => {
    if (!/^(audio|video)\//.test(f.type)) return resoudre(0);
    const url = URL.createObjectURL(f);
    const el = document.createElement(f.type.startsWith("video") ? "video" : "audio");
    const fin = (d: number) => {
      URL.revokeObjectURL(url);
      resoudre(Number.isFinite(d) ? d : 0);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => fin(el.duration);
    el.onerror = () => fin(0);
    el.src = url;
    setTimeout(() => fin(0), 4000);
  });
}

/** « 2,5 Mo » */
export function tailleLisible(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** « 1,5 min » / « 45 s » */
export function minutesLisibles(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  return `${minutes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} min`;
}

/** Nom de fichier sans extension, lisible (« mon-image_2.jpg » → « Mon image 2 »). */
export function nomDepuisFichier(nom: string): string {
  const base = nom.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Sans nom";
}
