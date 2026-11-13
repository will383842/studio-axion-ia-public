// SUI-A — suivi chiffré par mot : assemblage PUR (aucune base, aucun réseau, aucune horloge cachée : `maintenantMs` est passé).
// Entrée : événements de commentaire et conversations déjà réduits, plus les compteurs du site (ou null).
// Sortie : des mots et des nombres. JAMAIS de clé de conversation, d'empreinte, d'identifiant de personne ni de texte.
// Une personne et un mot comptent UNE fois, par (racine de la clé, mot normalisé, GUIDE par défaut).
// Fenêtres glissantes en UTC (bornes incluses) ; une date illisible ou future ne compte que dans `total`.
// Les champs `suiviIg`, `lienIgLe`, `okRecus` peuvent ne pas exister encore : lecture tolérante, absents = 0.
import { racineDe } from "./cles-parcours";
import {
  clePublicationSite,
  cleVersionSite,
  type CompteursSite,
} from "./compteurs-site-contrat";
import { normaliserMot } from "./mot-normalise";

const JOUR_MS = 86_400_000;
export const MOT_PAR_DEFAUT_SUIVI = "GUIDE";
export const SANS_PUBLICATION = "sans-publication";

export type Fen = { j7: number; j30: number; total: number };

export interface LigneSuiviMot {
  mot: string;
  commentaires: Fen;
  reponsesPubliques: Fen;
  premiersMessages: Fen;
  renvois: Fen;
  formulaires: Fen | null;
  envoisEmail: Fen | null;
  clics: Fen | null;
  instagram: {
    reponsesOk: Fen;
    dejaSuivi: Fen;
    gagnees: Fen;
    sansSuivre: Fen;
    inconnu: Fen;
  };
  /** « Au moins N » : jamais un chiffre exact. */
  auMoinsGagnees: number;
  parPublication: {
    post: string;
    reseau: string;
    commentaires: number;
    premiersMessages: number;
    formulaires: number | null;
    clics: number | null;
    auMoinsGagnees: number;
  }[];
  formulations: { version: string; envois: number; clics: number | null }[];
}

export interface TableauSuivi {
  genereLe: string;
  siteDisponible: boolean;
  lignes: LigneSuiviMot[];
}

/** Un commentaire reçu, réduit : l'identifiant de l'auteur n'entre jamais ici. */
export interface EvenementSuivi {
  readonly recuLe: string;
  readonly motSeul?: string | null;
  readonly etat?: string | null;
  readonly idPostPlateforme?: string | null;
  readonly reseau?: string | null;
  /** Identifiant d'événement : un même identifiant ne compte qu'une fois. */
  readonly idEvenement?: string | null;
}

/** Une conversation, réduite. `cle` ne sert qu'à reconnaître une personne : elle ne ressort jamais. */
export interface ConversationSuivi {
  readonly cle: string;
  readonly mot?: string | null;
  readonly nature?: string | null;
  readonly etat: string;
  readonly creeLe: string;
  readonly m1Le: string | null;
  readonly idPostPlateforme?: string | null;
  readonly reseau?: string | null;
  readonly versionTexteM1?: string | null;
  /** Versions figées par groupe (noms seulement). */
  readonly formulations?: Readonly<Record<string, string>> | null;
  /** « gagne » | « deja_suivi » | « sans_suivre » | « inconnu » ; absent = rien à compter. */
  readonly suiviIg?: string | null;
  readonly lienIgLe?: string | null;
  readonly okRecus?: number | null;
}

const SANS_REPONSE_PUBLIQUE: readonly string[] = ["nouveau", "oppose"];
const RANG_SUIVI: Readonly<Record<string, number>> = {
  gagne: 4,
  deja_suivi: 3,
  sans_suivre: 2,
  inconnu: 1,
};

const vide = (): Fen => ({ j7: 0, j30: 0, total: 0 });
function compter(c: Fen, date: string | null | undefined, now: number): void {
  c.total++;
  const t = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(t) || t > now) return;
  if (now - t <= 30 * JOUR_MS) c.j30++;
  if (now - t <= 7 * JOUR_MS) c.j7++;
}
/** Date la plus ancienne ; illisible = la plus tardive. */
function plusAncienne(a: string | null, b: string | null): string | null {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta)) return b ?? a;
  if (!Number.isFinite(tb)) return a;
  return tb < ta ? b : a;
}
const texteOuNull = (v: unknown): string | null =>
  typeof v === "string" && v !== "" ? v : null;

interface Personne {
  mot: string;
  creeLe: string;
  reponse: boolean;
  m1Le: string | null;
  premier: boolean;
  renvoiLe: string | null;
  renvoi: boolean;
  suivi: string | null;
  lienIgLe: string | null;
  okRecus: number;
  post: string;
  reseau: string;
  versions: Set<string>;
  envoye: boolean;
}

interface Acc {
  commentaires: Fen;
  reponsesPubliques: Fen;
  premiersMessages: Fen;
  renvois: Fen;
  reponsesOk: Fen;
  dejaSuivi: Fen;
  gagnees: Fen;
  sansSuivre: Fen;
  inconnu: Fen;
  publications: Map<
    string,
    {
      post: string;
      reseau: string;
      commentaires: number;
      premiersMessages: number;
      gagnees: number;
    }
  >;
  versions: Map<string, Set<string>>;
}

export function assemblerSuivi(
  evenements: readonly EvenementSuivi[],
  conversations: readonly ConversationSuivi[],
  compteursSite: CompteursSite | null,
  maintenantMs: number,
): TableauSuivi {
  const mots = new Map<string, Acc>();
  const acc = (mot: string): Acc => {
    let a = mots.get(mot);
    if (!a)
      mots.set(
        mot,
        (a = {
          commentaires: vide(),
          reponsesPubliques: vide(),
          premiersMessages: vide(),
          renvois: vide(),
          reponsesOk: vide(),
          dejaSuivi: vide(),
          gagnees: vide(),
          sansSuivre: vide(),
          inconnu: vide(),
          publications: new Map(),
          versions: new Map(),
        }),
      );
    return a;
  };
  const publication = (a: Acc, post: string, reseau: string) => {
    const cle = JSON.stringify([post, reseau]);
    let p = a.publications.get(cle);
    if (!p)
      a.publications.set(
        cle,
        (p = { post, reseau, commentaires: 0, premiersMessages: 0, gagnees: 0 }),
      );
    return p;
  };

  const vus = new Set<string>();
  for (const ev of evenements) {
    const mot = normaliserMot(ev.motSeul);
    if (mot === null) continue;
    if (typeof ev.idEvenement === "string" && ev.idEvenement !== "") {
      if (vus.has(ev.idEvenement)) continue;
      vus.add(ev.idEvenement);
    }
    const a = acc(mot);
    compter(a.commentaires, ev.recuLe, maintenantMs);
    publication(
      a,
      texteOuNull(ev.idPostPlateforme) ?? SANS_PUBLICATION,
      texteOuNull(ev.reseau) ?? "inconnu",
    ).commentaires++;
  }

  // Une personne et un mot : un seul enregistrement, fusionné sur la RACINE de la clé (jamais la clé entière).
  const personnes = new Map<string, Personne & { racine: string }>();
  for (const c of conversations) {
    const mot = normaliserMot(c.mot) ?? MOT_PAR_DEFAUT_SUIVI;
    const racine = racineDe(c.cle);
    const cle = JSON.stringify([racine, mot]);
    const estRenvoi = c.nature === "renvoi";
    const m1Le = texteOuNull(c.m1Le);
    const suivi =
      typeof c.suiviIg === "string" && c.suiviIg !== ""
        ? c.suiviIg in RANG_SUIVI
          ? c.suiviIg
          : "inconnu"
        : null;
    const ok = typeof c.okRecus === "number" && c.okRecus > 0 ? c.okRecus : 0;
    const versions = new Set<string>();
    for (const v of [c.versionTexteM1, ...Object.values(c.formulations ?? {})])
      if (typeof v === "string" && v !== "") versions.add(v);
    const p =
      personnes.get(cle) ??
      ({
        racine,
        mot,
        creeLe: c.creeLe,
        reponse: false,
        m1Le: null,
        premier: false,
        renvoiLe: null,
        renvoi: false,
        suivi: null,
        lienIgLe: null,
        okRecus: 0,
        post: texteOuNull(c.idPostPlateforme) ?? SANS_PUBLICATION,
        reseau: texteOuNull(c.reseau) ?? "inconnu",
        versions: new Set<string>(),
        envoye: false,
      } satisfies Personne & { racine: string });
    // La publication d'une personne est celle de sa conversation la plus ancienne.
    if (plusAncienne(p.creeLe, c.creeLe) === c.creeLe && c.creeLe !== p.creeLe) {
      p.post = texteOuNull(c.idPostPlateforme) ?? SANS_PUBLICATION;
      p.reseau = texteOuNull(c.reseau) ?? "inconnu";
    }
    p.creeLe = plusAncienne(p.creeLe, c.creeLe) ?? p.creeLe;
    // Sans état (vide ou absent) : pas une réponse publique.
    p.reponse ||=
      typeof c.etat === "string" &&
      c.etat !== "" &&
      !SANS_REPONSE_PUBLIQUE.includes(c.etat);
    if (!estRenvoi && m1Le !== null) {
      p.premier = true;
      p.m1Le = plusAncienne(p.m1Le, m1Le);
    }
    if (estRenvoi) {
      p.renvoi = true;
      p.renvoiLe = plusAncienne(p.renvoiLe, m1Le ?? c.creeLe);
    }
    if (suivi !== null && (p.suivi === null || RANG_SUIVI[suivi] > RANG_SUIVI[p.suivi]))
      p.suivi = suivi;
    if (suivi !== null || ok > 0)
      p.lienIgLe = plusAncienne(p.lienIgLe, texteOuNull(c.lienIgLe));
    p.okRecus += ok;
    if (m1Le !== null) {
      p.envoye = true;
      for (const v of versions) p.versions.add(v);
    }
    personnes.set(cle, p);
  }

  for (const p of personnes.values()) {
    const a = acc(p.mot);
    if (p.reponse) compter(a.reponsesPubliques, p.creeLe, maintenantMs);
    if (p.premier) compter(a.premiersMessages, p.m1Le, maintenantMs);
    if (p.renvoi) compter(a.renvois, p.renvoiLe, maintenantMs);
    if (p.okRecus > 0) compter(a.reponsesOk, p.lienIgLe, maintenantMs);
    const pub = publication(a, p.post, p.reseau);
    if (p.premier) pub.premiersMessages++;
    if (p.suivi === "gagne") {
      compter(a.gagnees, p.lienIgLe, maintenantMs);
      pub.gagnees++;
    } else if (p.suivi === "deja_suivi")
      compter(a.dejaSuivi, p.lienIgLe, maintenantMs);
    else if (p.suivi === "sans_suivre")
      compter(a.sansSuivre, p.lienIgLe, maintenantMs);
    else if (p.suivi === "inconnu") compter(a.inconnu, p.lienIgLe, maintenantMs);
    if (p.envoye)
      for (const v of p.versions) {
        const s = a.versions.get(v) ?? new Set<string>();
        s.add(p.racine);
        a.versions.set(v, s);
      }
  }

  const copie = (f: Fen): Fen => ({ ...f });
  const lignes: LigneSuiviMot[] = [...mots.entries()]
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([mot, a]) => {
      const site = compteursSite?.mots.get(mot);
      const zero = (): Fen => vide();
      const parPublication = [...a.publications.values()]
        .sort((x, y) =>
          x.post !== y.post
            ? x.post < y.post ? -1 : 1
            : x.reseau < y.reseau ? -1 : x.reseau > y.reseau ? 1 : 0,
        )
        .map((p) => {
          const s = compteursSite?.publications.get(
            clePublicationSite(mot, p.post),
          );
          return {
            post: p.post,
            reseau: p.reseau,
            commentaires: p.commentaires,
            premiersMessages: p.premiersMessages,
            formulaires: compteursSite ? (s?.formulaires ?? 0) : null,
            clics: compteursSite ? (s?.clics ?? 0) : null,
            auMoinsGagnees: p.gagnees,
          };
        });
      const formulations = [...a.versions.entries()]
        .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
        .map(([version, s]) => ({
          version,
          envois: s.size,
          clics: compteursSite
            ? (compteursSite.versions.get(cleVersionSite(mot, version)) ?? 0)
            : null,
        }));
      return {
        mot,
        commentaires: copie(a.commentaires),
        reponsesPubliques: copie(a.reponsesPubliques),
        premiersMessages: copie(a.premiersMessages),
        renvois: copie(a.renvois),
        formulaires: compteursSite ? copie(site?.formulaires ?? zero()) : null,
        envoisEmail: compteursSite ? copie(site?.envoisEmail ?? zero()) : null,
        clics: compteursSite ? copie(site?.clics ?? zero()) : null,
        instagram: {
          reponsesOk: copie(a.reponsesOk),
          dejaSuivi: copie(a.dejaSuivi),
          gagnees: copie(a.gagnees),
          sansSuivre: copie(a.sansSuivre),
          inconnu: copie(a.inconnu),
        },
        auMoinsGagnees: a.gagnees.total,
        parPublication,
        formulations,
      };
    });
  return {
    genereLe: new Date(maintenantMs).toISOString(),
    siteDisponible: compteursSite !== null,
    lignes,
  };
}
