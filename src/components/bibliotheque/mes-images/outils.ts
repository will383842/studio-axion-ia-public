/** Outils côté NAVIGATEUR de « Mes images » (lot A2) : empreinte, dimensions, position des zones. */
import type { ZoneSensible } from "@/domaine/types";

/** SHA-256 du contenu (doublons : jamais réimportés). Au-delà de 200 Mo, l'empreinte porte sur le début et la taille. */
export async function empreinteFichier(f: File): Promise<string | undefined> {
  try {
    const morceau = f.size > 200 * 1024 * 1024 ? f.slice(0, 32 * 1024 * 1024) : f;
    const contenu = await morceau.arrayBuffer();
    const h = await crypto.subtle.digest("SHA-256", contenu);
    return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

/** Largeur et hauteur d'une image (ou d'une vidéo), lues dans le navigateur. */
export function dimensionsMedia(f: File): Promise<{ largeur?: number; hauteur?: number }> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(f);
    const fin = (largeur?: number, hauteur?: number) => {
      URL.revokeObjectURL(url);
      ok({ largeur, hauteur });
    };
    if (f.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => fin(v.videoWidth, v.videoHeight);
      v.onerror = () => fin();
      v.src = url;
    } else {
      const i = new Image();
      i.onload = () => fin(i.naturalWidth, i.naturalHeight);
      i.onerror = () => fin();
      i.src = url;
    }
    setTimeout(() => fin(), 5000);
  });
}

/** Position d'une zone en % de l'image (pour la poser par-dessus). */
export function zoneEnPourcent(z: Pick<ZoneSensible, "x" | "y" | "largeur" | "hauteur">, largeur: number, hauteur: number) {
  return { left: `${(z.x / largeur) * 100}%`, top: `${(z.y / hauteur) * 100}%`, width: `${(z.largeur / largeur) * 100}%`, height: `${(z.hauteur / hauteur) * 100}%` };
}

/** Fichiers acceptés dans « Mes images » (images et vidéos, jamais un document). */
export const estMediaAccepte = (f: File) => /^(image|video)\//.test(f.type);
