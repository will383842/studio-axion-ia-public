/**
 * T-EXT-41 : extraction EN MÉMOIRE du dossier zip déposé par Williams (serveur). SENSIBLE SÉCURITÉ.
 *
 * ÉTEINT PAR DÉFAUT : seul le réglage `tutoriel.entreeZip` à exactement `true` allume ; absent, `"true"`, `1`, `null` ou
 * une lecture qui lève : refus clair, rien n'est décompressé. Aucun appelant en production dans cette fiche.
 *
 * Tout ou rien : une seule entrée piégée refuse l'archive entière. Rien n'est écrit sur le disque ni en stockage (le
 * rangement est l'affaire d'autres fiches). Ne lève jamais. Le journal ne reçoit que des nombres et des types, jamais
 * une donnée trouvée ni un extrait du script. N'utilise PAS `lireZip` de `src/lib/zip.ts` (fait pour NOS archives).
 */
import "server-only";
import { inflateRawSync } from "node:zlib";
import { crc32 } from "@/lib/zip";
import {
  type EntreeZip,
  detecterDonneesPersonnelles,
  estFichierScript,
  estImage,
  extensionDe,
  lireRepertoireZip,
  masquerDonneesPersonnelles,
  refuserScriptAvecDonnees,
  trierImages,
  verifierEntreesZip,
  verifierMaquette,
} from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { journaliser, lireParametre } from "./_commun";

export const PARAM_ENTREE_ZIP = "tutoriel.entreeZip";
export const MESSAGE_ZIP_FERME = "L'envoi d'un dossier n'est pas ouvert pour le moment.";

export interface RapportEntree {
  refus: string[];
  ignores: string[];
  masques: { chemin: string; type: string; nombre: number }[];
  imagesEcartees: string[];
}

export interface PortsZip {
  lireParametre: (id: string, defaut: unknown) => Promise<unknown>;
  /** Décompression d'un flux « deflate » brut, bornée par `maxOutputLength`. */
  inflate: (donnees: Uint8Array, maxOutputLength: number) => Uint8Array;
  journaliser: (type: string, message: string) => Promise<void>;
}

const PORTS_REELS: PortsZip = {
  lireParametre: (id, defaut) => lireParametre<unknown>(id, defaut),
  inflate: (donnees, maxOutputLength) => inflateRawSync(donnees, { maxOutputLength }),
  journaliser: (type, message) => journaliser(type, message),
};

export type ResultatZip = { ok: true; fichiers: Map<string, Uint8Array>; rapport: RapportEntree } | { ok: false; rapport: RapportEntree };

const MAGIES: Record<string, (o: Uint8Array) => boolean> = {
  png: (o) => o.length > 8 && o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47,
  jpg: (o) => o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff,
  jpeg: (o) => o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff,
  webp: (o) => o.length > 12 && o[0] === 0x52 && o[1] === 0x49 && o[2] === 0x46 && o[3] === 0x46 && o[8] === 0x57 && o[9] === 0x45 && o[10] === 0x42 && o[11] === 0x50,
  woff2: (o) => o.length > 4 && o[0] === 0x77 && o[1] === 0x4f && o[2] === 0x46 && o[3] === 0x32,
};
const EXT_TEXTE = new Set(["html", "htm", "css", "js", "json", "csv", "txt", "md"]);
const EXT_MAQUETTE = new Set(["html", "htm", "css", "js"]);

function court(nom: string): string {
  const p = nom.replace(/[\u0000-\u001f\u007f-\u009f]/g, "?");
  return p.length > 60 ? `${p.slice(0, 60)}…` : p;
}

function memeOctets(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Lit les octets d'une entrée : en-tête local relu et comparé au répertoire central, taille et CRC vérifiés. */
function extraire(octets: Uint8Array, e: EntreeZip, debutRepertoire: number, inflate: PortsZip["inflate"]): { ok: true; donnees: Uint8Array } | { ok: false; motif: string } {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const o = e.decalageLocal;
  if (o + 30 > debutRepertoire || v.getUint32(o, true) !== 0x04034b50) return { ok: false, motif: "archive incohérente (en-tête local absent)" };
  if ((v.getUint16(o + 6, true) & 1) !== 0) return { ok: false, motif: "entrée chiffrée" };
  const methode = v.getUint16(o + 8, true);
  const ln = v.getUint16(o + 26, true);
  const le = v.getUint16(o + 28, true);
  if (methode !== e.methode || !memeOctets(octets.subarray(o + 30, o + 30 + ln), e.nomOctets)) return { ok: false, motif: "archive incohérente (nom ou méthode différents)" };
  const debut = o + 30 + ln + le;
  const fin = debut + e.tailleCompressee;
  if (fin > debutRepertoire) return { ok: false, motif: "archive incohérente (données hors du fichier)" };
  const brut = octets.subarray(debut, fin);
  let donnees: Uint8Array;
  if (e.methode === 0) donnees = brut.slice();
  else {
    try {
      donnees = inflate(brut, Math.max(1, e.tailleDecompressee));
    } catch {
      return { ok: false, motif: "contenu qui dépasse sa taille annoncée ou illisible (archive piégée)" };
    }
  }
  if (donnees.length !== e.tailleDecompressee) return { ok: false, motif: "taille réelle différente de la taille annoncée" };
  if (crc32(donnees) !== e.crc) return { ok: false, motif: "contenu altéré (somme de contrôle fausse)" };
  return { ok: true, donnees };
}

export async function extraireZipSur(
  octets: Uint8Array,
  options: { attestationImages: boolean; nomsNeutres?: ReadonlySet<string> },
  ports: PortsZip = PORTS_REELS,
): Promise<ResultatZip> {
  const rapport: RapportEntree = { refus: [], ignores: [], masques: [], imagesEcartees: [] };
  const fermer = (...refus: string[]): ResultatZip => {
    rapport.refus.push(...refus);
    return { ok: false, rapport };
  };
  const noter = async (message: string): Promise<void> => {
    try {
      await ports.journaliser("tutoriel_entree_zip", message);
    } catch {
      /* le journal ne doit jamais bloquer ni lever */
    }
  };
  try {
    let allume = false;
    try {
      allume = (await ports.lireParametre(PARAM_ENTREE_ZIP, false)) === true;
    } catch {
      allume = false;
    }
    if (!allume) return fermer(MESSAGE_ZIP_FERME);

    const lecture = lireRepertoireZip(octets);
    if (!lecture.ok) {
      await noter("Dossier refusé : archive illisible ou hors limites.");
      return fermer(...lecture.refus);
    }
    const verdict = verifierEntreesZip(lecture.entrees);
    if (!verdict.ok) {
      await noter(`Dossier refusé : ${verdict.refus.length} motif(s) sur les entrées.`);
      return fermer(...verdict.refus);
    }
    // Noms écourtés (60 caractères, sans caractère de contrôle) et poussés seulement après le verdict.
    rapport.ignores.push(...verdict.ignores.map(court));

    const bruts = new Map<string, Uint8Array>();
    const refus: string[] = [];
    for (const e of lecture.entrees) {
      if (e.estDossier || verdict.ignores.includes(e.nom)) continue;
      const r = extraire(octets, e, lecture.debutRepertoire, ports.inflate);
      if (!r.ok) refus.push(`« ${court(e.nom)} » : ${r.motif}.`);
      else bruts.set(e.nom, r.donnees);
    }
    if (refus.length > 0) {
      await noter(`Dossier refusé : ${refus.length} entrée(s) incohérente(s).`);
      return fermer(...refus);
    }

    const decodeur = new TextDecoder("utf-8", { fatal: true });
    const encodeur = new TextEncoder();
    const textes: { chemin: string; texte: string }[] = [];
    const fichiers = new Map<string, Uint8Array>();
    const tri = trierImages([...bruts.keys()], options.attestationImages === true);
    rapport.imagesEcartees.push(...tri.ecartees);
    for (const [chemin, donnees] of bruts) {
      const ext = extensionDe(chemin);
      const magie = MAGIES[ext];
      if (magie && !magie(donnees)) {
        refus.push(`« ${court(chemin)} » : le contenu ne correspond pas à son type.`);
        continue;
      }
      if (estImage(chemin)) {
        if (tri.gardees.includes(chemin)) fichiers.set(chemin, donnees);
        continue;
      }
      if (!EXT_TEXTE.has(ext)) {
        fichiers.set(chemin, donnees);
        continue;
      }
      let texte: string;
      try {
        texte = decodeur.decode(donnees);
      } catch {
        refus.push(`« ${court(chemin)} » : texte illisible (UTF-8 attendu).`);
        continue;
      }
      if (estFichierScript(chemin)) {
        // Le texte de Williams n'est jamais masqué ni réécrit : on refuse et on dit quoi corriger.
        refus.push(...refuserScriptAvecDonnees(chemin, texte));
        fichiers.set(chemin, donnees);
        continue;
      }
      if (EXT_MAQUETTE.has(ext)) textes.push({ chemin, texte });
      const trouvees = detecterDonneesPersonnelles(texte, { chemin, nomsNeutres: options.nomsNeutres });
      if (trouvees.some((d) => d.type === "detection-echouee")) {
        refus.push(`« ${court(chemin)} » : la recherche de données de personnes a échoué, le fichier est refusé.`);
        continue;
      }
      if (trouvees.some((d) => d.type === "guillemet-non-ferme")) {
        refus.push(`« ${court(chemin)} » : guillemet jamais refermé dans le CSV, le fichier est refusé.`);
        continue;
      }
      if (trouvees.length === 0) {
        fichiers.set(chemin, donnees);
        continue;
      }
      const m = masquerDonneesPersonnelles(texte, { chemin, nomsNeutres: options.nomsNeutres });
      for (const r of m.remplacements) rapport.masques.push({ chemin, type: r.type, nombre: r.nombre });
      fichiers.set(chemin, encodeur.encode(m.texte));
      const i = textes.findIndex((t) => t.chemin === chemin);
      if (i >= 0) textes[i] = { chemin, texte: m.texte };
    }
    const maquette = verifierMaquette(textes);
    for (const r of maquette.refus) refus.push(`« ${court(r.chemin)} » ligne ${r.ligne} : ${r.motif}.`);
    if (refus.length > 0) {
      await noter(`Dossier refusé : ${refus.length} motif(s) sur le contenu.`);
      return fermer(...refus);
    }
    const nombres = rapport.masques.reduce((s, x) => s + x.nombre, 0);
    await noter(`Dossier accepté : ${fichiers.size} fichier(s), ${nombres} donnée(s) masquée(s), ${rapport.imagesEcartees.length} image(s) écartée(s).`);
    return { ok: true, fichiers, rapport };
  } catch {
    return fermer("Le dossier n'a pas pu être lu : il est refusé.");
  }
}
