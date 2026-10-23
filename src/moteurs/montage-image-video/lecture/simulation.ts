/**
 * IMAGE → VIDÉO · L5 · Doubles de simulation de la lecture d'image : AUCUN appel payant, aucun hasard.
 *
 * - `lectureDeCarte` : la lecture que Claude rendrait d'une image dont on connaît la carte (attendus écrits à la main,
 *   `tests/image-video/fixtures/cartes/`).
 * - `appelerEnSimulation` : double de l'appel Claude, qui rend une lecture par sens (a : image entière d'abord, b : tuiles
 *   d'abord) d'après l'ordre écrit dans la partie variable.
 * - `pngSimule`, `enTeteImage`, `convertirEnSimulation` : vrais fichiers PNG (unis) aux bonnes dimensions, en-têtes de
 *   fichiers d'essai (PNG, JPEG, WebP, GIF), conversion simulée.
 * - `LECTURE_DEMO` : la lecture de l'image C (chatbot), rendue par le rôle en mode simulation du studio.
 */
import { deflateSync } from "node:zlib";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { ReponseAppelLecture } from "./index";
import type { LectureImage, SensLecture } from "./consigne";
import type { ConvertirEnPng, FormatImage } from "./preparation";

// ─── Lecture tirée d'une carte connue ────────────────────────────────────────────────────────────────────────────────

/** La lecture (forme plate de `schemaLectureImage`) qui redonne `carte` une fois complétée par le code. */
export function lectureDeCarte(carte: CarteImage): LectureImage {
  return {
    type: carte.types[0],
    titre: carte.titre,
    sousTitre: carte.sousTitre ?? "",
    phraseChoc: carte.phraseChoc,
    signature: carte.signature ?? "",
    noeuds: carte.noeuds.map((n) => ({
      id: n.id,
      libelle: n.libelle,
      detail: n.detail ?? "",
      role: n.role,
      icone: n.icone ?? "",
      couleur: n.couleur,
      acteur: n.acteur,
      groupe: n.groupe ?? "",
      ordre: n.ordre,
      quantite: n.quantite ?? null,
      sousElements: n.sousElements ?? [],
      exemple: n.exemple ?? false,
      photoPersonnes: n.photoPersonnes ?? false,
    })),
    liens: carte.liens.map((l) => ({ id: l.id, de: l.de, vers: l.vers, etiquette: l.etiquette ?? "", part: l.part ?? null, couleur: l.couleur, style: l.style })),
    groupes: carte.groupes.map((g) => ({ id: g.id, sorte: g.sorte, titre: g.titre ?? "", noeuds: [...g.noeuds], majoritaire: g.majoritaire ?? false })),
    bandeau: [...carte.bandeau],
    pied: [...carte.pied],
  };
}

/** Lecture vide (image sans texte, ou rien de reconnu). */
export const LECTURE_VIDE: LectureImage = { type: "inconnu", titre: "", sousTitre: "", phraseChoc: "", signature: "", noeuds: [], liens: [], groupes: [], bandeau: [], pied: [] };

/** Sens d'une lecture d'après l'ordre des images écrit dans la partie variable. */
export function sensDe(variable: string): SensLecture {
  return /ordre="tuiles-puis-entiere"/.test(variable) ? "b" : "a";
}

/**
 * Double de l'appel Claude : rend `lectures[sens]` (ou une réponse forcée : panne, réponse coupée…). Chaque appel est
 * noté dans `journal` (sens, nombre d'images, partie variable, légendes) pour les vérifications des tests.
 */
export function appelerEnSimulation(
  lectures: Record<SensLecture, LectureImage | ReponseAppelLecture | (ReponseAppelLecture | LectureImage)[]>,
  journal: { sens: SensLecture; variable: string; images: number; legendes: string[]; envoye: string }[] = [],
) {
  const rangs: Record<SensLecture, number> = { a: 0, b: 0 };
  return async (_role: unknown, entree: { variable: string; images?: { legende?: string }[] }): Promise<ReponseAppelLecture> => {
    const sens = sensDe(entree.variable);
    journal.push({ sens, variable: entree.variable, images: entree.images?.length ?? 0, legendes: (entree.images ?? []).map((i) => i.legende ?? ""), envoye: JSON.stringify(entree) });
    const prevue = lectures[sens];
    const r = Array.isArray(prevue) ? prevue[Math.min(rangs[sens]++, prevue.length - 1)] : prevue;
    return "ok" in r ? r : { ok: true, simule: true, donnees: structuredClone(r) };
  };
}

// ─── Fichiers d'essai ────────────────────────────────────────────────────────────────────────────────────────────────

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(o: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of o) c = TABLE_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function morceauPng(type: string, donnees: Uint8Array): Buffer {
  const tete = Buffer.alloc(8);
  tete.writeUInt32BE(donnees.length, 0);
  tete.write(type, 4, "latin1");
  const fin = Buffer.alloc(4);
  fin.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), donnees])), 0);
  return Buffer.concat([tete, donnees, fin]);
}

/** Vrai PNG uni (niveaux de gris, `gris` de 0 à 255) de `largeur` × `hauteur`. */
export function pngSimule(largeur: number, hauteur: number, gris = 240): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  const ligne = Buffer.alloc(largeur + 1, gris);
  ligne[0] = 0;
  const brut = Buffer.alloc((largeur + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) ligne.copy(brut, y * (largeur + 1));
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), morceauPng("IHDR", ihdr), morceauPng("IDAT", deflateSync(brut)), morceauPng("IEND", new Uint8Array(0))]),
  );
}

/** En-tête seul d'un fichier d'image (assez pour reconnaître le format et lire les dimensions). */
export function enTeteImage(format: FormatImage, largeur: number, hauteur: number): Uint8Array {
  const b = Buffer.alloc(64);
  switch (format) {
    case "png":
      return pngSimule(largeur, hauteur);
    case "gif":
      b.write("GIF89a", 0, "latin1");
      b.writeUInt16LE(largeur, 6);
      b.writeUInt16LE(hauteur, 8);
      return new Uint8Array(b);
    case "webp":
      b.write("RIFF", 0, "latin1");
      b.writeUInt32LE(56, 4);
      b.write("WEBPVP8X", 8, "latin1");
      b.writeUInt32LE(10, 16);
      b.writeUIntLE(largeur - 1, 24, 3);
      b.writeUIntLE(hauteur - 1, 27, 3);
      return new Uint8Array(b);
    case "jpeg":
      // SOI, APP0 (JFIF, 16 octets), SOF0 (largeur, hauteur, 3 composantes).
      b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0);
      b.write("JFIF\0", 6, "latin1");
      b.set([0xff, 0xc0, 0x00, 0x11, 0x08], 20);
      b.writeUInt16BE(hauteur, 25);
      b.writeUInt16BE(largeur, 27);
      b.set([0x03], 29);
      return new Uint8Array(b);
  }
}

/** Conversion simulée : un PNG uni par morceau, aux dimensions de sortie demandées. */
export const convertirEnSimulation: ConvertirEnPng = async (d) => d.morceaux.map((m) => pngSimule(m.sortieLargeur, m.sortieHauteur));

// ─── Lecture de démonstration (image C, chatbot) ─────────────────────────────────────────────────────────────────────

export const LECTURE_DEMO: LectureImage = {
  type: "embranchement",
  titre: "Chatbot support client",
  sousTitre: "",
  phraseChoc: "Votre client a toujours une réponse. Même à 3h du matin.",
  signature: "",
  noeuds: [
    { id: "n01", libelle: "Message client entrant", detail: "23h14", role: "declencheur", icone: "message", couleur: "noir", acteur: "humain", groupe: "", ordre: 1, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n02", libelle: "Chatbot IA", detail: "analyse la demande", role: "decision", icone: "chatbot", couleur: "orange", acteur: "auto", groupe: "", ordre: 2, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n03", libelle: "Réponse générée", detail: "", role: "etape", icone: "etincelle", couleur: "orange", acteur: "auto", groupe: "g-branche-a", ordre: 3, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n04", libelle: "Envoyée en 4 sec", detail: "", role: "etape", icone: "eclair", couleur: "orange", acteur: "auto", groupe: "g-branche-a", ordre: 4, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n05", libelle: "Ticket clôturé auto", detail: "", role: "etape", icone: "ticket", couleur: "orange", acteur: "auto", groupe: "g-branche-a", ordre: 5, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n06", libelle: "Résolu sans intervention humaine", detail: "", role: "resultat", icone: "coche", couleur: "vert", acteur: "auto", groupe: "g-branche-a", ordre: 6, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n07", libelle: "Email structuré auto", detail: "", role: "etape", icone: "enveloppe", couleur: "noir", acteur: "auto", groupe: "g-branche-b", ordre: 7, quantite: null, sousElements: ["Objet", "Contexte", "Demande", "Urgence"], exemple: false, photoPersonnes: false },
    { id: "n08", libelle: "Envoyé équipe concernée", detail: "", role: "etape", icone: "equipe", couleur: "noir", acteur: "auto", groupe: "g-branche-b", ordre: 8, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n09", libelle: "Alerte Telegram", detail: "🔔 Intervention requise", role: "etape", icone: "cloche", couleur: "noir", acteur: "auto", groupe: "g-branche-b", ordre: 9, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
    { id: "n10", libelle: "Client informé", detail: "Réponse sous 2h", role: "resultat", icone: "client", couleur: "noir", acteur: "auto", groupe: "g-branche-b", ordre: 10, quantite: null, sousElements: [], exemple: false, photoPersonnes: false },
  ],
  liens: [
    { id: "l01", de: "n01", vers: "n02", etiquette: "", part: null, couleur: "orange", style: "plein" },
    { id: "l02", de: "n02", vers: "n03", etiquette: "80 % — Réponse connue", part: 80, couleur: "orange", style: "plein" },
    { id: "l03", de: "n03", vers: "n04", etiquette: "", part: null, couleur: "orange", style: "plein" },
    { id: "l04", de: "n04", vers: "n05", etiquette: "", part: null, couleur: "orange", style: "plein" },
    { id: "l05", de: "n05", vers: "n06", etiquette: "", part: null, couleur: "orange", style: "plein" },
    { id: "l06", de: "n02", vers: "n07", etiquette: "20 % — Limite atteinte", part: 20, couleur: "noir", style: "plein" },
    { id: "l07", de: "n07", vers: "n08", etiquette: "", part: null, couleur: "noir", style: "plein" },
    { id: "l08", de: "n08", vers: "n09", etiquette: "", part: null, couleur: "noir", style: "plein" },
    { id: "l09", de: "n09", vers: "n10", etiquette: "", part: null, couleur: "noir", style: "plein" },
  ],
  groupes: [
    { id: "g-branche-a", sorte: "branche", titre: "Réponse connue", noeuds: ["n03", "n04", "n05", "n06"], majoritaire: true },
    { id: "g-branche-b", sorte: "branche", titre: "Limite atteinte", noeuds: ["n07", "n08", "n09", "n10"], majoritaire: false },
  ],
  bandeau: ["80 % résolus instantanément", "0 demande perdue", "24h/24"],
  pied: [],
};
