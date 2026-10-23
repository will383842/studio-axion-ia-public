/**
 * ARCHIVE ZIP minimale, SANS compression (méthode « stockée ») : les vidéos et les images sont déjà compressées, les
 * recompresser ne gagne rien. Aucune dépendance (lot G1b : aucune bibliothèque zip n'était présente, `pnpm install`
 * n'est pas permis dans cette copie de travail). Noms en UTF-8 (drapeau 11). Moins de 4 Go et 65 535 fichiers.
 *
 * Deux façons de la produire :
 *  - `creerZip` : tout en mémoire (petits contenus, tests) ;
 *  - `fluxZip` (vérification E2E-1 n° 2, 03/10) : AU FIL DE L'EAU, un morceau à la fois, tiré par le lecteur
 *    (contre-pression) : la mémoire reste bornée à un morceau quel que soit le total (un sujet pèse 300 à 600 Mo, le
 *    conteneur du studio a 1 Go). Le CRC et la taille ne sont connus qu'après le fichier : ils suivent les données
 *    (« descripteur », drapeau 3) et sont répétés dans le répertoire central, que lisent les décompresseurs courants
 *    (Windows, macOS, unzip, 7-Zip).
 */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC en cours (valeur brute, départ 0xffffffff) prolongé par un morceau ; `crc32Fin` donne la valeur finale. */
function crc32Suite(c: number, donnees: Uint8Array): number {
  for (let i = 0; i < donnees.length; i++) c = TABLE_CRC[(c ^ donnees[i]) & 0xff] ^ (c >>> 8);
  return c;
}

function crc32Fin(c: number): number {
  return (c ^ 0xffffffff) >>> 0;
}

export function crc32(donnees: Uint8Array): number {
  return crc32Fin(crc32Suite(0xffffffff, donnees));
}

export interface FichierZip {
  nom: string;
  donnees: Uint8Array;
  date?: Date;
}

function dateDos(d: Date): { heure: number; jour: number } {
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    jour: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Deux fichiers de même nom : le second reçoit « (2) » avant l'extension. */
function nommeur(): (nom: string) => string {
  const vus = new Map<string, number>();
  return (nom) => {
    const n = (vus.get(nom) ?? 0) + 1;
    vus.set(nom, n);
    return n > 1 ? nom.replace(/(\.[^.]*)?$/, (ext) => ` (${n})${ext}`) : nom;
  };
}

/** Construit l'archive en mémoire. Deux fichiers de même nom : le second reçoit « (2) » avant l'extension. */
export function creerZip(fichiers: FichierZip[]): Uint8Array {
  const enc = new TextEncoder();
  const nommer = nommeur();
  const locaux: Uint8Array[] = [];
  const centraux: Uint8Array[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = nommer(f.nom);
    const nomOctets = enc.encode(nom);
    const crc = crc32(f.donnees);
    const { heure, jour } = dateDos(f.date ?? new Date());
    const local = new Uint8Array(30 + nomOctets.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true);
    vl.setUint16(8, 0, true);
    vl.setUint16(10, heure, true);
    vl.setUint16(12, jour, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, f.donnees.length, true);
    vl.setUint32(22, f.donnees.length, true);
    vl.setUint16(26, nomOctets.length, true);
    vl.setUint16(28, 0, true);
    local.set(nomOctets, 30);
    const central = new Uint8Array(46 + nomOctets.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, heure, true);
    vc.setUint16(14, jour, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, f.donnees.length, true);
    vc.setUint32(24, f.donnees.length, true);
    vc.setUint16(28, nomOctets.length, true);
    vc.setUint32(42, decalage, true);
    central.set(nomOctets, 46);
    locaux.push(local, f.donnees);
    centraux.push(central);
    decalage += local.length + f.donnees.length;
  }
  const tailleCentral = centraux.reduce((t, c) => t + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, fichiers.length, true);
  vf.setUint16(10, fichiers.length, true);
  vf.setUint32(12, tailleCentral, true);
  vf.setUint32(16, decalage, true);
  const total = new Uint8Array(decalage + tailleCentral + 22);
  let p = 0;
  for (const b of [...locaux, ...centraux, fin]) {
    total.set(b, p);
    p += b.length;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* Archive AU FIL DE L'EAU                                             */
/* ------------------------------------------------------------------ */

/** Contenu d'un fichier : tout prêt (sous-titres) ou en morceaux (corps d'une réponse `fetch`). */
export type SourceZip = Uint8Array | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

export interface EntreeFluxZip {
  nom: string;
  date?: Date;
  /** Ouvre le fichier au moment de l'écrire (jamais avant) ; une erreur ici = fichier sauté et signalé. */
  ouvrir: () => Promise<SourceZip>;
}

/** Fichier ajouté à la fin de l'archive quand des fichiers n'ont pas pu être lus. */
export const NOM_FICHIERS_ILLISIBLES = "FICHIERS-ILLISIBLES.txt";
const LIMITE_ZIP_OCTETS = 0xffffffff;
const MESSAGE_TROP_LOURDE = "Archive trop lourde (4 Go au plus) : téléchargez par réseau.";

async function* morceaux(source: SourceZip): AsyncGenerator<Uint8Array> {
  if (source instanceof Uint8Array) {
    yield source;
    return;
  }
  if (typeof (source as ReadableStream<Uint8Array>).getReader === "function") {
    const lecteur = (source as ReadableStream<Uint8Array>).getReader();
    try {
      for (;;) {
        const { value, done } = await lecteur.read();
        if (done) return;
        if (value?.length) yield value;
      }
    } finally {
      // Abandon en route (téléchargement annulé) : la lecture du fichier source s'arrête aussi.
      await lecteur.cancel().catch(() => undefined);
    }
  }
  for await (const m of source as AsyncIterable<Uint8Array>) if (m.length) yield m;
}

function enteteLocal(nomOctets: Uint8Array, heure: number, jour: number): Uint8Array {
  const local = new Uint8Array(30 + nomOctets.length);
  const v = new DataView(local.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 0x0808, true); // UTF-8 (bit 11) + CRC et tailles APRÈS les données (bit 3)
  v.setUint16(8, 0, true);
  v.setUint16(10, heure, true);
  v.setUint16(12, jour, true);
  // CRC et tailles : 0 ici, donnés par le descripteur et par le répertoire central.
  v.setUint16(26, nomOctets.length, true);
  local.set(nomOctets, 30);
  return local;
}

function descripteur(crc: number, taille: number): Uint8Array {
  const d = new Uint8Array(16);
  const v = new DataView(d.buffer);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, taille, true);
  v.setUint32(12, taille, true);
  return d;
}

function enteteCentral(nomOctets: Uint8Array, heure: number, jour: number, crc: number, taille: number, decalage: number): Uint8Array {
  const c = new Uint8Array(46 + nomOctets.length);
  const v = new DataView(c.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0x0808, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, heure, true);
  v.setUint16(14, jour, true);
  v.setUint32(16, crc, true);
  v.setUint32(20, taille, true);
  v.setUint32(24, taille, true);
  v.setUint16(28, nomOctets.length, true);
  v.setUint32(42, decalage, true);
  c.set(nomOctets, 46);
  return c;
}

/**
 * Octets de l'archive, produits À LA DEMANDE : un fichier n'est ouvert que lorsque le précédent est écrit, et chaque
 * morceau lu est rendu tel quel (jamais copié ni accumulé). Seuls les en-têtes centraux (≈ 100 octets par fichier)
 * restent en mémoire jusqu'à la fin. Un fichier illisible à l'ouverture est sauté ; une lecture coupée en route laisse
 * le fichier tronqué. Les deux sont nommés dans `FICHIERS-ILLISIBLES.txt`, ajouté à la fin : l'archive reste valide.
 */
export async function* octetsZip(entrees: Iterable<EntreeFluxZip> | AsyncIterable<EntreeFluxZip>): AsyncGenerator<Uint8Array> {
  const enc = new TextEncoder();
  const nommer = nommeur();
  const centraux: Uint8Array[] = [];
  const illisibles: string[] = [];
  let decalage = 0;
  let nombre = 0;

  async function* fichier(nom: string, date: Date | undefined, source: SourceZip): AsyncGenerator<Uint8Array> {
    const nomOctets = enc.encode(nom);
    const { heure, jour } = dateDos(date ?? new Date());
    const debut = decalage;
    const local = enteteLocal(nomOctets, heure, jour);
    yield local;
    decalage += local.length;
    let crc = 0xffffffff;
    let taille = 0;
    try {
      for await (const m of morceaux(source)) {
        if (decalage + m.length > LIMITE_ZIP_OCTETS) throw new Error(MESSAGE_TROP_LOURDE);
        crc = crc32Suite(crc, m);
        taille += m.length;
        yield m;
        decalage += m.length;
      }
    } catch (e) {
      if (e instanceof Error && e.message === MESSAGE_TROP_LOURDE) throw e;
      illisibles.push(`${nom} (lecture interrompue : fichier incomplet)`);
    }
    const fin = descripteur(crc32Fin(crc), taille);
    yield fin;
    decalage += fin.length;
    centraux.push(enteteCentral(nomOctets, heure, jour, crc32Fin(crc), taille, debut));
    nombre++;
  }

  for await (const e of entrees) {
    let source: SourceZip;
    try {
      source = await e.ouvrir();
    } catch (erreur) {
      console.warn(`[studio] archive : ${e.nom} illisible`, erreur);
      illisibles.push(e.nom);
      continue;
    }
    yield* fichier(nommer(e.nom), e.date, source);
  }
  if (illisibles.length) {
    const note = `Ces fichiers n'ont pas pu être lus. Relancez le téléchargement ; s'ils manquent encore, ouvrez la vidéo dans le studio.\r\n\r\n${illisibles.join("\r\n")}\r\n`;
    yield* fichier(nommer(NOM_FICHIERS_ILLISIBLES), undefined, enc.encode(note));
  }
  const debutCentral = decalage;
  for (const c of centraux) {
    yield c;
    decalage += c.length;
  }
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, nombre, true);
  vf.setUint16(10, nombre, true);
  vf.setUint32(12, decalage - debutCentral, true);
  vf.setUint32(16, debutCentral, true);
  yield fin;
}

/**
 * Flux web de l'archive, TIRÉ par le lecteur (`highWaterMark` 0) : rien n'est lu d'avance, la mémoire reste bornée à
 * un morceau. Si le téléchargement est abandonné, la lecture en cours s'arrête (`cancel`).
 */
export function fluxZip(entrees: Iterable<EntreeFluxZip> | AsyncIterable<EntreeFluxZip>): ReadableStream<Uint8Array> {
  const it = octetsZip(entrees);
  return new ReadableStream<Uint8Array>(
    {
      async pull(controleur) {
        try {
          const { value, done } = await it.next();
          if (done) controleur.close();
          else controleur.enqueue(value);
        } catch (e) {
          controleur.error(e);
        }
      },
      async cancel() {
        await it.return(undefined);
      },
    },
    { highWaterMark: 0 },
  );
}

/**
 * Relit les noms et contenus d'une archive produite par `creerZip` ou `fluxZip` (tests, vérification), par le
 * répertoire central (les tailles d'un fichier écrit au fil de l'eau ne sont pas dans son en-tête local).
 */
export function lireZip(zip: Uint8Array): { nom: string; donnees: Uint8Array }[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();
  let fin = zip.length - 22;
  while (fin >= 0 && v.getUint32(fin, true) !== 0x06054b50) fin--;
  if (fin < 0) return [];
  const nombre = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const sortie: { nom: string; donnees: Uint8Array }[] = [];
  for (let i = 0; i < nombre && v.getUint32(p, true) === 0x02014b50; i++) {
    const taille = v.getUint32(p + 20, true);
    const lnom = v.getUint16(p + 28, true);
    const lext = v.getUint16(p + 30, true);
    const lcom = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nom = dec.decode(zip.subarray(p + 46, p + 46 + lnom));
    const debut = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    sortie.push({ nom, donnees: zip.subarray(debut, debut + taille) });
    p += 46 + lnom + lext + lcom;
  }
  return sortie;
}
