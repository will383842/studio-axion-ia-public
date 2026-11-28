/**
 * L8-04a : BILAN DE LA SEMAINE affiché à l'accueil. PUR : aucune lecture, aucun réseau, aucune écriture.
 *
 * - La semaine montrée est la semaine ÉCOULÉE : du lundi au dimanche précédents, heure de Paris.
 * - Meilleur et moins bon contenu : d'après le RANG (mesures-rangs), jamais d'après une valeur brute.
 *   Vidéos et carrousels ont chacun leur classement ; ils ne sont jamais comparés entre eux.
 * - Une donnée absente est « non disponible », jamais un zéro. Un vrai zéro (aucune publication) reste un zéro.
 */
import { nomDuReseau } from "@/reseaux/hors-video";
import { ajouterJoursParis, instantParis } from "@/lib/horloge-paris";
import { lundiDeLaSemaine } from "@/lib/calendrier-plages";
import { formateurDate } from "@/lib/intl";
import { classerCreneaux, libelleCase, type ContenuPlace, type TypeContenu } from "./mesures-creneaux";
import { MINIMUM_GROUPE, ordinal, tousLesRangs, type RangVideo, type VideoMesuree } from "./mesures-rangs";
import type { EtatEnvoiBuffer, StatutPublication, ViaPublication } from "./types";

export interface LigneContenu {
  titre: string;
  reseau: string;
  type: TypeContenu;
  rang: string;
}

export interface BilanSemaine {
  du: string;
  au: string;
  parties: { reseau: string; nombre: number }[];
  meilleur: LigneContenu | null;
  moinsBon: LigneContenu | null;
  creneau: { libelle: string } | "trop-tot" | null;
  visites: number | null;
  rendezVous: number | null;
  echecs: number;
  aVerifier: number;
}

/** Ce que le bilan retient d'une publication : jamais son texte, ni son compte. */
export interface PublicationBilan {
  reseau: string;
  date: string;
  statut: StatutPublication;
  via: ViaPublication;
  etatEnvoi?: EtatEnvoiBuffer;
}

/** Un contenu mesuré (vidéo ou carrousel), avec ses derniers chiffres. */
export interface ContenuMesure {
  type: TypeContenu;
  video: VideoMesuree;
}

export interface EntreeBilan {
  publications: readonly PublicationBilan[];
  contenus: readonly ContenuMesure[];
}

const nomReseau = (r: string) => nomDuReseau(r);

const ND = "non disponible";

/** Jour de Paris (« AAAA-MM-JJ ») d'un instant. */
function jourParis(instant: Date): string {
  return formateurDate("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

interface Classe {
  type: TypeContenu;
  rang: RangVideo;
}

function classer(contenus: readonly ContenuMesure[], type: TypeContenu): Classe[] {
  const liste = contenus.filter((c) => c.type === type).map((c) => c.video);
  return tousLesRangs(liste)
    .filter((r) => r.sur >= MINIMUM_GROUPE)
    .map((rang) => ({ type, rang }));
}

const ligneDe = (c: Classe): LigneContenu => ({ titre: c.rang.video.titre, reseau: c.rang.video.reseau, type: c.type, rang: `${ordinal(c.rang.rang)} sur ${c.rang.sur}` });

export function calculerBilanSemaine(entree: EntreeBilan, maintenant: Date): BilanSemaine {
  const lundi = lundiDeLaSemaine(jourParis(maintenant));
  const du = ajouterJoursParis(lundi, -7);
  const au = ajouterJoursParis(lundi, -1);
  const debut = new Date(instantParis(du, "00:00")).getTime();
  const fin = new Date(instantParis(lundi, "00:00")).getTime();
  const dansLaSemaine = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= debut && t < fin;
  };

  const reelles = entree.publications.filter((p) => p.via !== "simulation" && dansLaSemaine(p.date));
  const parReseau = new Map<string, number>();
  for (const p of reelles) if (p.statut === "publiee") parReseau.set(p.reseau, (parReseau.get(p.reseau) ?? 0) + 1);
  const parties = [...parReseau].map(([reseau, nombre]) => ({ reseau, nombre })).sort((a, b) => b.nombre - a.nombre || a.reseau.localeCompare(b.reseau));

  const semaine = entree.contenus.filter((c) => dansLaSemaine(c.video.date));
  const sommer = (lire: (c: ContenuMesure) => number | undefined): number | null => {
    const v = semaine.map(lire).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    return v.length ? v.reduce((s, x) => s + x, 0) : null;
  };

  // Chaque type a son classement ; on lit celui qui a le plus de contenus classés DANS la semaine (vidéo à égalité).
  const classes: Record<TypeContenu, Classe[]> = { video: classer(entree.contenus, "video"), carrousel: classer(entree.contenus, "carrousel") };
  const classesSemaine: Record<TypeContenu, Classe[]> = {
    video: classes.video.filter((c) => dansLaSemaine(c.rang.video.date)),
    carrousel: classes.carrousel.filter((c) => dansLaSemaine(c.rang.video.date)),
  };
  const type: TypeContenu | null =
    classesSemaine.video.length === 0 && classesSemaine.carrousel.length === 0 ? null : classesSemaine.carrousel.length > classesSemaine.video.length ? "carrousel" : "video";
  const duType = type ? classes[type] : [];
  const deLaSemaine = type ? classesSemaine[type] : [];
  const meilleurs = [...deLaSemaine].sort((a, b) => b.rang.position - a.rang.position || a.rang.rang - b.rang.rang || b.rang.video.date.localeCompare(a.rang.video.date) || a.rang.video.code.localeCompare(b.rang.video.code));
  const meilleur = meilleurs[0] ?? null;
  const moins = meilleurs.length > 1 ? meilleurs[meilleurs.length - 1] : null;

  let creneau: BilanSemaine["creneau"] = null;
  if (type && duType.length) {
    const places: ContenuPlace[] = duType.map((c) => ({ reseau: c.rang.video.reseau, type, date: c.rang.video.date, position: c.rang.position }));
    let meilleureCase: { texte: string; mediane: number } | null = null;
    for (const g of classerCreneaux(places)) {
      const lue = g.cases.find((c) => c.etat === "lu" && c.mediane !== null);
      if (lue && (!meilleureCase || lue.mediane! > meilleureCase.mediane)) meilleureCase = { texte: `${libelleCase(lue.jour, lue.tranche)}, sur ${nomReseau(g.reseau)}`, mediane: lue.mediane! };
    }
    creneau = meilleureCase ? { libelle: meilleureCase.texte } : "trop-tot";
  }

  return {
    du,
    au,
    parties,
    meilleur: meilleur ? ligneDe(meilleur) : null,
    moinsBon: moins ? ligneDe(moins) : null,
    creneau,
    visites: sommer((c) => c.video.resultats.visites),
    rendezVous: sommer((c) => c.video.resultats.rendezVous),
    echecs: reelles.filter((p) => p.statut === "echec").length,
    aVerifier: reelles.filter((p) => p.etatEnvoi === "a-verifier").length,
  };
}

const jourFr = (j: string) => j.split("-").reverse().join("/");
const nomType = (t: TypeContenu) => (t === "video" ? "vidéo" : "carrousel");

function ligneContenu(intitule: string, c: LigneContenu | null): string {
  if (!c) return `${intitule} : ${ND}.`;
  const titre = c.titre.trim() || "sans titre";
  return `${intitule} : « ${titre} » (${nomType(c.type)}, ${nomReseau(c.reseau)}), rang ${c.rang}.`;
}

function ligneNombre(intitule: string, n: number | null): string {
  return `${intitule} : ${n === null ? ND : n}.`;
}

/** Phrases vouvoyées de la carte. Aucun chiffre n'est inventé : chaque nombre vient du bilan. */
export function lignesBilan(b: BilanSemaine): string[] {
  const lignes = [`Semaine du ${jourFr(b.du)} au ${jourFr(b.au)}.`];
  lignes.push(b.parties.length === 0 ? "Aucune publication n'est partie cette semaine-là." : `Publications parties : ${b.parties.map((p) => `${p.nombre} sur ${nomReseau(p.reseau)}`).join(", ")}.`);
  lignes.push(ligneContenu("Votre meilleur contenu", b.meilleur), ligneContenu("Votre contenu le moins bon", b.moinsBon));
  lignes.push(b.creneau === null ? `Meilleur créneau : ${ND}.` : b.creneau === "trop-tot" ? "Meilleur créneau : trop tôt pour le dire." : `Meilleur créneau : ${b.creneau.libelle}.`);
  lignes.push(ligneNombre("Visites venues de vos contenus de la semaine", b.visites), ligneNombre("Rendez-vous venus de vos contenus de la semaine", b.rendezVous));
  lignes.push(b.echecs === 0 ? "Envois en échec : aucun." : `Envois en échec : ${b.echecs}.`);
  lignes.push(b.aVerifier === 0 ? "Publications à vérifier : aucune." : `Publications à vérifier : ${b.aVerifier}.`);
  return lignes;
}
