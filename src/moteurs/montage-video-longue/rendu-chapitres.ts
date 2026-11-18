/**
 * RENDU PAR CHAPITRE (fiche VL-05, générateur « Vidéo longue », ÉTEINT). PUR + PORT INJECTÉ : n'importe rien du moteur
 * (index, chaîne, entrées) ; aucun réseau ici, aucun rendu réel dans les tests.
 *
 * Le serveur de rendu n'a qu'une file longue, un montage à la fois, arrêté au bout de 20 min (`studio-rendu/src/files.ts`).
 * Le moteur n'envoie donc QU'UNE plage à la fois, et n'envoie la suivante qu'une fois la précédente finie : un court arrivé
 * entre-temps passe avant la plage suivante. La plage est celle du mode « plage » existant de l'opération `composition`
 * (`operations/plage-images.ts`) : muette, sur la composition ENTIÈRE, de l'image `debut` à l'image `fin` comprises.
 * Un chapitre trop long pour tenir sous le délai est coupé en plusieurs plages, toujours envoyées une par une.
 * Les morceaux muets sont ensuite collés sans réencodage, la voix posée à la fin (`collage-chapitres.ts` côté studio-rendu).
 */

/** Délai maximal d'un montage côté serveur (`DELAI_LONGUE_MS`, 20 min). */
export const DELAI_MAX_PLAGE_MS = 20 * 60_000;
/**
 * Coût de rendu estimé par seconde de vidéo (ms). ESTIMATION SANS MESURE (rapport GEO § 6.2 : 20 à 80 min pour 5 min de
 * vidéo, soit jusqu'à 16 s par seconde) : VL-00 la remplacera par la mesure. Volontairement pessimiste.
 */
export const MS_RENDU_PAR_SECONDE_VIDEO = 16_000;
/** Part du délai qu'une plage a le droit d'occuper (marge pour le chargement du paquet et le dépôt). */
export const PART_DELAI_UTILISABLE = 0.8;

export interface ChapitreARendre {
  id: string;
  debutMs: number;
  finMs: number;
}

export interface PlageARendre {
  chapitreId: string;
  /** Rang de la plage dans le chapitre, à partir de 0. */
  rang: number;
  /** Images de la composition entière, bornes comprises. */
  debut: number;
  fin: number;
  /** Durée de la plage en secondes (sert au délai proportionné du serveur). */
  dureeSec: number;
}

/** Image de la composition à l'instant `ms` (arrondi unique : deux plages voisines partagent exactement la même frontière). PUR. */
export const imageDe = (ms: number, fps: number): number => Math.round((ms * fps) / 1000);

/** Durée maximale d'une plage (s) pour tenir sous le délai, d'après le coût estimé. PUR. */
export function dureeMaxPlageSec(msParSeconde = MS_RENDU_PAR_SECONDE_VIDEO, delaiMs = DELAI_MAX_PLAGE_MS): number {
  return Math.max(1, Math.floor((delaiMs * PART_DELAI_UTILISABLE) / msParSeconde));
}

/** Temps de rendu estimé d'une plage (ms). PUR. */
export const rendreEstimeMs = (p: PlageARendre, msParSeconde = MS_RENDU_PAR_SECONDE_VIDEO): number => Math.ceil(p.dureeSec * msParSeconde);

/**
 * Plages de tous les chapitres, dans l'ordre : sans trou ni chevauchement d'images, chacune sous le délai. PUR.
 * Une erreur (chapitre vide, chapitres qui se chevauchent) est une exception : rien ne doit partir au rendu.
 */
export function plagesDesChapitres(chapitres: ChapitreARendre[], fps = 25, maxPlageSec = dureeMaxPlageSec()): PlageARendre[] {
  const sortie: PlageARendre[] = [];
  let finPrecedente = -1;
  const maxImages = Math.max(1, Math.floor(maxPlageSec * fps));
  for (const c of chapitres) {
    const a = imageDe(c.debutMs, fps);
    const b = imageDe(c.finMs, fps); // exclue
    if (!(b > a)) throw new Error(`Chapitre « ${c.id} » : aucune image à rendre.`);
    if (a < finPrecedente) throw new Error(`Chapitre « ${c.id} » : chevauche le précédent.`);
    finPrecedente = b;
    for (let rang = 0, debut = a; debut < b; rang++) {
      const finExclue = Math.min(b, debut + maxImages);
      sortie.push({ chapitreId: c.id, rang, debut, fin: finExclue - 1, dureeSec: (finExclue - debut) / fps });
      debut = finExclue;
    }
  }
  return sortie;
}

/** Demande de rendu en mode « plage » (forme de `DemandeRendu.parametres`, `composition` + `mode: "plage"`). PUR. */
export function parametresPlage(p: PlageARendre, o: { composition: string; proprietes: Record<string, unknown>; crf?: number }): Record<string, unknown> {
  return { mode: "plage", composition: o.composition, proprietes: o.proprietes, debut: p.debut, fin: p.fin, dureeSec: p.dureeSec, ...(o.crf === undefined ? {} : { crf: o.crf }) };
}

export interface DemandePlage {
  /** Identifiant stable (même plage = même identifiant : le serveur ne relance pas une demande connue). */
  idRendu: string;
  file: "longue";
  plage: PlageARendre;
  parametres: Record<string, unknown>;
  /** Arrêt demandé au port si le délai est dépassé. */
  signal: AbortSignal;
}

/** Port : rend UNE plage et rend la clé de stockage du morceau muet. Fourni par l'appelant (réel, ou factice dans les tests). */
export interface PortRenduPlage {
  rendre(demande: DemandePlage): Promise<{ sortieCle: string }>;
}

export interface MorceauRendu {
  plage: PlageARendre;
  idRendu: string;
  sortieCle: string;
}

export class ErreurRenduChapitres extends Error {
  constructor(
    message: string,
    /** Morceaux déjà rendus avant l'arrêt (une reprise ne les refait pas). */
    readonly rendus: MorceauRendu[],
    readonly plage: PlageARendre,
  ) {
    super(message);
    this.name = "ErreurRenduChapitres";
  }
}

export interface OptionsRenduChapitres {
  idVideo: string;
  composition: string;
  proprietes: Record<string, unknown>;
  chapitres: ChapitreARendre[];
  fps?: number;
  crf?: number;
  /** Délai d'une plage (ms), défaut 20 min. */
  delaiMs?: number;
  /** Morceaux déjà rendus lors d'un essai précédent, par `idRendu` : ils ne repartent pas. */
  dejaRendus?: Record<string, string>;
  /** Appelé après chaque plage terminée (journal, progression). */
  apresPlage?: (m: MorceauRendu) => void | Promise<void>;
}

/** Identifiant d'une plage (PUR, stable). */
export const idRenduPlage = (idVideo: string, p: PlageARendre): string => `${idVideo}-${p.chapitreId}-p${p.rang}`;

/**
 * Rend toutes les plages, UNE SEULE À LA FOIS : la suivante n'est envoyée qu'une fois la précédente terminée. Une plage
 * qui dépasse le délai ou échoue arrête tout (rien d'autre n'est envoyé) : `ErreurRenduChapitres` porte ce qui est fait.
 */
export async function rendreChapitres(o: OptionsRenduChapitres, port: PortRenduPlage): Promise<MorceauRendu[]> {
  const fps = o.fps ?? 25;
  const delaiMs = o.delaiMs ?? DELAI_MAX_PLAGE_MS;
  const plages = plagesDesChapitres(o.chapitres, fps, dureeMaxPlageSec(MS_RENDU_PAR_SECONDE_VIDEO, delaiMs));
  const rendus: MorceauRendu[] = [];
  for (const plage of plages) {
    const idRendu = idRenduPlage(o.idVideo, plage);
    const garde = o.dejaRendus?.[idRendu];
    if (garde) {
      rendus.push({ plage, idRendu, sortieCle: garde });
      continue;
    }
    const controleur = new AbortController();
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const delai = new Promise<never>((_, rejeter) => {
      minuterie = setTimeout(() => {
        controleur.abort();
        rejeter(new Error(`délai de ${Math.round(delaiMs / 60_000)} min dépassé`));
      }, delaiMs);
    });
    try {
      const r = await Promise.race([port.rendre({ idRendu, file: "longue", plage, parametres: parametresPlage(plage, o), signal: controleur.signal }), delai]);
      const m = { plage, idRendu, sortieCle: r.sortieCle };
      rendus.push(m);
      await o.apresPlage?.(m);
    } catch (e) {
      throw new ErreurRenduChapitres(`Plage ${idRendu} (images ${plage.debut}-${plage.fin}) : ${e instanceof Error ? e.message : String(e)}`, [...rendus], plage);
    } finally {
      clearTimeout(minuterie);
    }
  }
  return rendus;
}
