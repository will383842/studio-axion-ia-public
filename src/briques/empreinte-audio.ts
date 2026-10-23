/**
 * EMPREINTE DE L'AUDIO MAÎTRE (plan B.0 §19, B.1 « Maquette »). PUR, sans dépendance serveur. Brique commune
 * (E2E-1 n° 10, 03/10) : lue par le service de fabrication et par tout moteur qui fabrique un audio maître.
 * La piste `audio-maitre` fabriquée par la maquette est RÉUTILISÉE par la fabrication (pas repayée) tant que le
 * texte, la voix et les prononciations n'ont pas changé : l'empreinte résume exactement ces trois choses.
 */
import type { CommandeFabrication } from "@/domaine/types";

/** Hachage 53 bits (cyrb53), stable et suffisant pour comparer deux entrées. */
function hacher(texte: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** Ce qui fait la voix d'une commande : le texte, la voix (fournisseur, identifiant, vitesse) et les prononciations. */
export function empreinteAudioMaitre(c: Pick<CommandeFabrication, "script" | "distribution" | "prononciations" | "texteDitParSegment">): string {
  const d = c.distribution[0];
  const entree = {
    // G6 : le texte DIT transmis (prononciations déjà appliquées, liste vide) : c'est lui que la voix lit.
    texte: (c.texteDitParSegment ? c.texteDitParSegment.join(" ") : c.script.texteComplet).replace(/\s+/g, " ").trim(),
    fournisseur: d?.fournisseurVoix ?? "simulation",
    voix: d?.idVoixFournisseur ?? d?.voixId ?? "",
    vitesse: d?.reglagesVoix?.vitesse ?? 1,
    prononciations: [...c.prononciations].map((p) => `${p.mot}=${p.prononciation}`).sort(),
  };
  return `am-${hacher(JSON.stringify(entree))}`;
}
