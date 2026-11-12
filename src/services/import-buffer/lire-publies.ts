/**
 * L0-04 — ARCHIVE DE L'HISTORIQUE PUBLIÉ (Buffer est résilié). LECTURE SEULE, rien n'est supprimé ni modifié.
 *
 * Source principale : les Publications du Studio (réseau, statut, via, date, texte, idExterne, canalId, média source).
 * Une seule tentative de lecture Buffer est permise ; son échec n'est pas une erreur. Sortie : une archive datée et
 * un rapport des champs absents, avec le contrôle de complétude des 92 posts programmés (LinkedIn 39, Facebook 34,
 * Instagram 19). Les médias sont copiés vers le stockage privé puis vérifiés (taille de l'objet relue).
 * Aucune adresse de lecture de média et aucune clé ne figurent dans l'archive, le rapport ni les erreurs.
 */
import type { IdReseau, Publication } from "../../domaine/types";
import { jourParis } from "./exclusions";
import { contientEcriture, normaliserPost, type ClientLecture } from "./lire-buffer";
import { copierMedia, type StockagePrive } from "./medias-prives";
import { FRAGMENT_POST, REQUETE_COMPTE } from "./requetes-lecture";
import { ErreurLectureBuffer, type MediaBuffer, type PostBuffer } from "./types";

/** Posts déjà envoyés (statut « sent »), les plus récents d'abord. Distincte de REQUETE_POSTS_ENVOYES_STATS. */
export const REQUETE_POSTS_PUBLIES = `query PostsPublies($organizationId: OrganizationId!, $apres: String, $nombre: Int) {
  posts(first: $nombre, after: $apres, input: { organizationId: $organizationId, filter: { status: [sent] }, sort: [{ field: dueAt, direction: desc }] }) {
    edges {
      node {${FRAGMENT_POST}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/** Inventaire du 30/10 : 92 posts programmés. */
export const ATTENDU_PROGRAMMES = { linkedin: 39, facebook: 34, instagram: 19, total: 92 } as const;
const RESEAUX_INVENTAIRE = ["linkedin", "facebook", "instagram"] as const;
type ReseauInventaire = (typeof RESEAUX_INVENTAIRE)[number];
const NOM_RESEAU: Record<ReseauInventaire, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram" };

/** Une publication du Studio et, si elle en a un, son média source (adresse temporaire, jamais archivée). */
export interface LignePublication {
  publication: Publication;
  media?: Pick<MediaBuffer, "type" | "mime"> & {
    /** Adresse de lecture temporaire (média venu d'ailleurs) : jamais archivée. */
    source?: string;
    /** Clé du fichier dans le stockage du Studio (vidéo ou visuel déjà stocké) : rien à télécharger. */
    cleStockage?: string;
  };
}

/** Ce que l'export lit dans les dépôts du Studio (structure minimale, pour pouvoir être doublée dans les tests). */
export interface DepotsLecturePublications {
  publications: { lister(): Promise<Publication[]> };
  sorties: {
    obtenir(id: string): Promise<{ id: string; videoId: string; fichierId: string; reseau?: string } | null>;
    lister(filtre?: (s: { id: string; videoId: string; fichierId: string; reseau?: string }) => boolean): Promise<{ id: string; videoId: string; fichierId: string; reseau?: string }[]>;
  };
  fichiers: { obtenir(id: string): Promise<{ cleStockage: string; mime: string } | null> };
  visuels: { obtenir(id: string): Promise<{ rendu?: { pdfCle?: string; vignetteCle?: string }; renduToile?: { bandeCle?: string } } | null> };
}

/**
 * Lit les Publications du Studio et retrouve le média de chaque publication : fichier de la sortie de la vidéo, ou rendu
 * du visuel. Lecture seule. Une publication dont la source est illisible reste dans l'archive, sans média (champ absent).
 */
export async function lignesDepuisStudio(depots: DepotsLecturePublications): Promise<LignePublication[]> {
  const out: LignePublication[] = [];
  for (const publication of await depots.publications.lister()) {
    out.push({ publication, media: await mediaDeLaPublication(depots, publication) });
  }
  return out.map((l) => (l.media ? l : { publication: l.publication }));
}

async function mediaDeLaPublication(depots: DepotsLecturePublications, p: Publication): Promise<LignePublication["media"]> {
  try {
    if (p.videoId && !p.visuelId) {
      const sortie = p.sortieId
        ? await depots.sorties.obtenir(p.sortieId)
        : ((await depots.sorties.lister((x) => x.videoId === p.videoId && (!x.reseau || x.reseau === p.reseau)))[0] ?? null);
      const fichier = sortie ? await depots.fichiers.obtenir(sortie.fichierId) : null;
      return fichier ? { type: "video", mime: fichier.mime, cleStockage: fichier.cleStockage } : undefined;
    }
    if (p.visuelId && !p.videoId) {
      const v = await depots.visuels.obtenir(p.visuelId);
      const cle = v?.rendu?.pdfCle ?? v?.renduToile?.bandeCle ?? v?.rendu?.vignetteCle;
      if (!cle) return undefined;
      return { type: cle.endsWith(".pdf") ? "document" : "image", mime: cle.endsWith(".pdf") ? "application/pdf" : "image/png", cleStockage: cle };
    }
  } catch {
    /* source illisible : média absent, signalé dans le rapport */
  }
  return undefined;
}

/* ------------------------------ lecture seule ------------------------------ */

/** Enveloppe qui refuse toute mutation avant d'atteindre le client enveloppé. */
export function clientLectureSeule(client: ClientLecture): ClientLecture {
  return {
    async lire(requete, variables) {
      if (contientEcriture(requete)) throw new ErreurLectureBuffer("ecriture-refusee", "Requête refusée : ce client ne fait que lire.");
      return client.lire(requete, variables);
    },
  };
}

export type ResultatLectureBuffer = { etat: "lu"; posts: PostBuffer[]; tronque: boolean } | { etat: "indisponible"; raison: string };

const PAGES_MAX = 50;
const nettoyer = (m: string, secrets: string[]): string => {
  let t = m.replace(/https?:\/\/\S+/g, "[adresse]");
  for (const s of secrets) if (s) t = t.split(s).join("[clé]");
  return t.slice(0, 200);
};

/** UNE tentative de lecture des posts publiés. Ne lève jamais : un échec rend « indisponible ». */
export async function tenterLectureBuffer(
  client: ClientLecture | undefined,
  options: { secrets?: string[]; pagesMax?: number; taillePage?: number } = {},
): Promise<ResultatLectureBuffer> {
  const secrets = options.secrets ?? [];
  if (!client) return { etat: "indisponible", raison: "Aucun accès Buffer (clé absente)." };
  const sur = clientLectureSeule(client);
  try {
    const compte = (await sur.lire(REQUETE_COMPTE)).account as { organizations?: { id?: unknown }[] } | undefined;
    const organisationId = compte?.organizations?.[0]?.id;
    if (typeof organisationId !== "string" || !organisationId) return { etat: "indisponible", raison: "Buffer : aucune organisation." };
    const posts: PostBuffer[] = [];
    let apres: string | undefined;
    let tronque = false;
    const max = options.pagesMax ?? PAGES_MAX;
    for (let page = 0; page < max + 1; page++) {
      if (page === max) {
        tronque = true;
        break;
      }
      const r = (await sur.lire(REQUETE_POSTS_PUBLIES, { organizationId: organisationId, apres, nombre: options.taillePage ?? 50 })).posts as
        | { edges?: { node?: Record<string, unknown> }[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string } }
        | undefined;
      for (const e of r?.edges ?? []) if (e?.node) posts.push(normaliserPost(e.node));
      if (!r?.pageInfo?.hasNextPage || !r.pageInfo.endCursor) break;
      apres = r.pageInfo.endCursor;
    }
    return { etat: "lu", posts, tronque };
  } catch (e) {
    const m = e instanceof ErreurLectureBuffer ? e.message : "Buffer ne répond pas.";
    return { etat: "indisponible", raison: nettoyer(m, secrets) };
  }
}

/* ------------------------------ archive (PUR) ------------------------------ */

export type ChampArchive = "texte" | "date" | "idExterne" | "canalId" | "media" | "urlPubliee";

export interface EntreeArchive {
  id: string;
  reseau: IdReseau;
  statut: Publication["statut"];
  via: Publication["via"];
  dateUtc?: string;
  /** Date et heure de Paris (jamais UTC) pour l'affichage. */
  dateParis?: string;
  texte: string;
  idExterne?: string;
  canalId?: string;
  canalNom?: string;
  urlPubliee?: string;
  erreur?: string;
  /** Type et format du média source seulement : l'adresse n'est jamais archivée. */
  media?: { type: string; mime: string; cleStockage?: string };
}

/** Un post publié lu dans Buffer (clé encore valide) : sans aucune adresse de média. */
export interface EntreeBuffer {
  id: string;
  canalId: string;
  texte: string;
  statut: string;
  dateUtc?: string;
  dateParis?: string;
  titre?: string;
  medias: { type: string; mime: string }[];
}

export interface Comparaison {
  attendu: typeof ATTENDU_PROGRAMMES;
  trouve: Record<ReseauInventaire | "total", number>;
  ecart: Record<ReseauInventaire | "total", number>;
  conforme: boolean;
  horsInventaire: Record<string, number>;
  simulationsIgnorees: number;
  /** Programmées dont la date est strictement passée. */
  enRetard: number;
  dateIllisible: number;
}

export interface ArchiveBuffer {
  nom: string;
  creeLe: string;
  source: "studio";
  bufferLu: "lu" | "indisponible";
  bufferRaison?: string;
  /** Nombre de posts publiés lus dans Buffer quand la tentative a réussi. */
  bufferPublies?: number;
  /** Posts publiés lus dans Buffer, rangés tels quels (texte, date, canal, identifiant). */
  entreesBuffer?: EntreeBuffer[];
  /** Identifiants Buffer sans jumeau dans les Publications du Studio (même idExterne). */
  bufferSansJumeau?: string[];
  entrees: EntreeArchive[];
  champsAbsents: { champ: ChampArchive; ids: string[] }[];
  doublonsIgnores: number;
  comparaison: Comparaison;
}

const FORMAT_PARIS = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const tempsValide = (iso: string | undefined): number | undefined => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
};
const dateParisLisible = (iso: string | undefined): string | undefined => {
  const t = tempsValide(iso);
  return t === undefined ? undefined : FORMAT_PARIS.format(new Date(t)).replace(",", "");
};
const plein = (s: string | undefined): string | undefined => (s && s.trim() ? s : undefined);

/** Nom de l'archive : jour de Paris. */
export const nomArchive = (maintenant: Date): string => `archive-buffer-${jourParis(maintenant.toISOString())}`;

/** Retire les rejeux : même id, ou même réseau + même idExterne. */
function dedoublonner<T>(items: T[], pub: (x: T) => Publication): { gardes: T[]; ignores: number } {
  const ids = new Set<string>();
  const externes = new Set<string>();
  const gardes: T[] = [];
  for (const x of items) {
    const p = pub(x);
    const cleExt = p.idExterne ? `${p.reseau}|${p.idExterne}` : undefined;
    if (ids.has(p.id) || (cleExt && externes.has(cleExt))) continue;
    ids.add(p.id);
    if (cleExt) externes.add(cleExt);
    gardes.push(x);
  }
  return { gardes, ignores: items.length - gardes.length };
}

export function comparerAvecInventaire(publications: Publication[], maintenant: Date): Comparaison {
  const { gardes } = dedoublonner(publications, (p) => p);
  const trouve: Comparaison["trouve"] = { linkedin: 0, facebook: 0, instagram: 0, total: 0 };
  const horsInventaire: Record<string, number> = {};
  let simulationsIgnorees = 0;
  let enRetard = 0;
  let dateIllisible = 0;
  for (const p of gardes) {
    if (p.statut !== "programmee") continue;
    if (p.via === "simulation") {
      simulationsIgnorees++;
      continue;
    }
    const t = tempsValide(p.date);
    if (t === undefined) dateIllisible++;
    else if (t < maintenant.getTime()) enRetard++;
    if ((RESEAUX_INVENTAIRE as readonly string[]).includes(p.reseau)) {
      trouve[p.reseau as ReseauInventaire]++;
      trouve.total++;
    } else horsInventaire[p.reseau] = (horsInventaire[p.reseau] ?? 0) + 1;
  }
  const ecart: Comparaison["ecart"] = {
    linkedin: trouve.linkedin - ATTENDU_PROGRAMMES.linkedin,
    facebook: trouve.facebook - ATTENDU_PROGRAMMES.facebook,
    instagram: trouve.instagram - ATTENDU_PROGRAMMES.instagram,
    total: trouve.total - ATTENDU_PROGRAMMES.total,
  };
  const conforme = ecart.linkedin === 0 && ecart.facebook === 0 && ecart.instagram === 0 && ecart.total === 0;
  return { attendu: ATTENDU_PROGRAMMES, trouve, ecart, conforme, horsInventaire, simulationsIgnorees, enRetard, dateIllisible };
}

export function archiveDepuisPublications(
  lignes: LignePublication[],
  maintenant: Date,
  buffer?: ResultatLectureBuffer,
): ArchiveBuffer {
  const { gardes, ignores } = dedoublonner(lignes, (l) => l.publication);
  const absents = new Map<ChampArchive, string[]>();
  const noter = (champ: ChampArchive, id: string) => absents.set(champ, [...(absents.get(champ) ?? []), id]);
  const entrees: EntreeArchive[] = gardes.map(({ publication: p, media }) => {
    if (!plein(p.texte)) noter("texte", p.id);
    if (tempsValide(p.date) === undefined) noter("date", p.id);
    if (!plein(p.idExterne)) noter("idExterne", p.id);
    if (!plein(p.canalId)) noter("canalId", p.id);
    if (!media) noter("media", p.id);
    if (p.statut === "publiee" && !plein(p.urlPubliee)) noter("urlPubliee", p.id);
    return {
      id: p.id,
      reseau: p.reseau,
      statut: p.statut,
      via: p.via,
      dateUtc: tempsValide(p.date) === undefined ? undefined : p.date,
      dateParis: dateParisLisible(p.date),
      texte: p.texte ?? "",
      idExterne: plein(p.idExterne),
      canalId: plein(p.canalId),
      canalNom: plein(p.canalNom),
      urlPubliee: plein(p.urlPubliee),
      erreur: plein(p.erreur),
      ...(media ? { media: { type: media.type, mime: media.mime, ...(media.cleStockage ? { cleStockage: media.cleStockage } : {}) } } : {}),
    };
  });
  const postsBuffer = buffer?.etat === "lu" ? buffer.posts : [];
  const externes = new Set(gardes.map((l) => l.publication.idExterne).filter((x): x is string => !!x));
  const entreesBuffer: EntreeBuffer[] = postsBuffer.map((b) => {
    const dateUtc = b.envoyeLe ?? b.dateUtc;
    return {
      id: b.id, canalId: b.canalId, texte: b.texte, statut: b.statut,
      ...(tempsValide(dateUtc) === undefined ? {} : { dateUtc, dateParis: dateParisLisible(dateUtc) }),
      ...(b.titre ? { titre: b.titre } : {}),
      medias: b.medias.map((m) => ({ type: m.type, mime: m.mime })),
    };
  });
  const ordre: ChampArchive[] = ["texte", "date", "idExterne", "canalId", "media", "urlPubliee"];
  return {
    nom: nomArchive(maintenant),
    creeLe: maintenant.toISOString(),
    source: "studio",
    bufferLu: buffer?.etat === "lu" ? "lu" : "indisponible",
    ...(buffer?.etat === "indisponible" ? { bufferRaison: buffer.raison } : {}),
    ...(buffer?.etat === "lu" ? { bufferPublies: buffer.posts.length, entreesBuffer, bufferSansJumeau: entreesBuffer.filter((e) => !externes.has(e.id)).map((e) => e.id) } : {}),
    entrees,
    champsAbsents: ordre.filter((c) => absents.has(c)).map((champ) => ({ champ, ids: absents.get(champ)! })),
    doublonsIgnores: ignores,
    comparaison: comparerAvecInventaire(gardes.map((l) => l.publication), maintenant),
  };
}

const signe = (n: number): string => (n > 0 ? `+${n}` : String(n));

export function formaterRapportArchive(a: ArchiveBuffer): string {
  const c = a.comparaison;
  const l: string[] = [];
  l.push(`Archive ${a.nom} — ${a.entrees.length} publications du Studio (source : Studio ; Buffer : ${a.bufferLu === "lu" ? `lu, ${a.bufferPublies ?? 0} posts publiés` : `non lu${a.bufferRaison ? ` (${a.bufferRaison})` : ""}`}).`);
  if (a.entreesBuffer?.length) l.push(`${a.entreesBuffer.length} post(s) publié(s) rangé(s) depuis Buffer, dont ${a.bufferSansJumeau?.length ?? 0} sans jumeau dans les Publications du Studio.`);
  if (a.doublonsIgnores) l.push(`${a.doublonsIgnores} doublon(s) ignoré(s).`);
  l.push("", `Posts programmés trouvés : ${c.trouve.total} sur ${c.attendu.total} attendus (écart ${signe(c.ecart.total)}${c.conforme ? ", conforme" : ""}).`);
  for (const r of RESEAUX_INVENTAIRE) l.push(`  ${NOM_RESEAU[r]} : ${c.trouve[r]} / ${c.attendu[r]} (écart ${signe(c.ecart[r])})`);
  for (const [r, n] of Object.entries(c.horsInventaire)) l.push(`  Hors inventaire — ${r} : ${n}`);
  if (c.enRetard) l.push(`  ${c.enRetard} programmé(s) dont la date est déjà passée : à vérifier.`);
  if (c.dateIllisible) l.push(`  ${c.dateIllisible} programmé(s) à date illisible : à vérifier.`);
  if (c.simulationsIgnorees) l.push(`  ${c.simulationsIgnorees} simulation(s) non comptée(s).`);
  l.push("", "Champs absents :");
  if (!a.champsAbsents.length) l.push("  Aucun champ absent.");
  for (const f of a.champsAbsents) l.push(`  ${f.champ} : ${f.ids.length} publication(s) — ${f.ids.slice(0, 20).join(", ")}${f.ids.length > 20 ? ", …" : ""}`);
  return l.join("\n");
}

/* ------------------------------ médias ------------------------------ */

export type StockageVerifiable = StockagePrive & { tailleObjet?(cle: string): Promise<number | null> };

export interface ResultatMedias {
  copies: number;
  verifies: number;
  echecs: { id: string; raison: string }[];
}

/** Copie le média de chaque publication vers le stockage privé, puis relit la taille de l'objet : égale, sinon échec. */
export async function copierEtVerifierMedias(lignes: LignePublication[], stockage: StockageVerifiable, appeler: typeof fetch = fetch): Promise<ResultatMedias> {
  const res: ResultatMedias = { copies: 0, verifies: 0, echecs: [] };
  const echec = (id: string, m: string) => res.echecs.push({ id, raison: nettoyer(m, []) });
  const { gardes } = dedoublonner(lignes, (l) => l.publication);
  for (const { publication: p, media } of gardes) {
    if (!media) continue;
    if (!media.source && media.cleStockage) {
      // Déjà dans le stockage du Studio : rien à télécharger, on vérifie seulement que l'objet existe.
      try {
        if (!stockage.tailleObjet) echec(p.id, "Média non vérifiable : le stockage ne relit pas la taille.");
        else if ((await stockage.tailleObjet(media.cleStockage)) === null) echec(p.id, "Vérification : objet absent du stockage du Studio.");
        else res.verifies++;
      } catch (e) {
        echec(p.id, e instanceof Error ? e.message : "erreur");
      }
      continue;
    }
    try {
      const copie = await copierMedia(p.id, 0, { type: media.type, mime: media.mime, source: media.source ?? "" }, stockage, appeler);
      res.copies++;
      if (!stockage.tailleObjet) {
        echec(p.id, "Copie non vérifiable : le stockage ne relit pas la taille.");
        continue;
      }
      const taille = await stockage.tailleObjet(copie.cleStockage);
      if (taille === copie.taille) res.verifies++;
      else echec(p.id, taille === null ? "Vérification : objet absent après dépôt." : `Vérification : taille différente (${taille} au lieu de ${copie.taille}).`);
    } catch (e) {
      echec(p.id, e instanceof Error ? e.message : "erreur");
    }
  }
  return res;
}

/* ------------------------------ orchestration ------------------------------ */

/** Une tentative Buffer (si un client existe), puis l'archive depuis les Publications du Studio. N'écrit rien. */
export async function produireArchive(options: {
  lignes: LignePublication[];
  maintenant: Date;
  client: ClientLecture | undefined;
  secrets?: string[];
}): Promise<{ archive: ArchiveBuffer; buffer: ResultatLectureBuffer }> {
  const buffer = await tenterLectureBuffer(options.client, { secrets: options.secrets });
  return { archive: archiveDepuisPublications(options.lignes, options.maintenant, buffer), buffer };
}
