"use server";

/**
 * Importer un fichier de publications (tableau ou collage) dans le calendrier (L4-12).
 * - Une ligne = une publication : jour, heure (facultative, 09:00 de Paris par défaut), réseau, texte.
 * - Chaque publication naît « propose » : rien ne part avant la validation du fondateur, et ces actions n'appellent jamais le diffuseur.
 * - Seule une erreur de format bloque (et alors rien n'est écrit). Le passé, une proximité, un quota atteint ou un week-end
 *   avertissent et se confirment d'un clic : un ajout fait à la main n'est jamais mis de côté.
 * - Contrôle « lus = créés » rendu à l'écran. Idempotent : la clé du formulaire donne les identifiants.
 */
import { revalidatePath } from "next/cache";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { reglesDuReseau, verifierEspacement, type PostPlanifie } from "@/domaine/cadence/verifier";
import type { IdReseau } from "@/domaine/types";
import { ajouterJoursParis, resoudreHeureParis } from "@/lib/horloge-paris";
import { exigerSession } from "@/services/auth";
import { ecrireStockageFiche } from "@/services/calendrier-fiche";
import { creerVerrou, depots, maintenant } from "@/services/_commun";
import { creerCreneau, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";

export interface SaisieImport {
  /** Le contenu du fichier ou le texte collé. */
  texte: string;
}

export interface LigneImport {
  /** Numéro de la ligne dans le fichier (la première ligne est la 1). */
  numero: number;
  jour: string;
  heure: string;
  reseau: IdReseau;
  texte: string;
}

export interface ErreurImport {
  /** 0 = le fichier entier. */
  numero: number;
  message: string;
}

export interface AvertissementImport {
  numero: number;
  type: "passe" | "proximite" | "quota" | "weekend";
  message: string;
}

export interface AnalyseImport {
  /** Faux seulement sur une erreur de format. */
  ok: boolean;
  /** Nombre de lignes de publication lues. */
  lus: number;
  lignes: LigneImport[];
  erreurs: ErreurImport[];
  avertissements: AvertissementImport[];
}

export interface DemandeImport extends SaisieImport {
  compteCible: string;
  /** Clé stable du formulaire ouvert (idempotence). */
  cle: string;
  /** Vrai après le clic « Importer quand même ». */
  confirmer?: boolean;
}

export type ResultatImport =
  | { ok: true; lus: number; crees: number; avertissements: AvertissementImport[] }
  | { ok: false; message: string; erreurs?: ErreurImport[]; aConfirmer?: true; avertissements?: AvertissementImport[] };

const MAX_LIGNES = 200;
const MAX_TEXTE = 3000;
const HEURE_DEFAUT = "09:00";
const RESEAUX: Readonly<Record<string, IdReseau>> = { linkedin: "linkedin", instagram: "instagram", facebook: "facebook", tiktok: "tiktok" };
const CLE = /^[A-Za-z0-9_-]{1,64}$/;
const ENTETE = /^(jour|date)$/i;
const HEURE_LUE = /^(\d{1,2}):(\d{2})$/;
const lirePhrase = (n: number, s: string) => `Ligne ${n} : ${s}`;

function jourExiste(a: number, m: number, j: number): boolean {
  const t = new Date(Date.UTC(a, m - 1, j));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === j;
}

/** « AAAA-MM-JJ » ou « JJ/MM/AAAA » réels → « AAAA-MM-JJ » ; sinon null. */
function lireJour(brut: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(brut);
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(brut);
  const [a, m, j] = iso ? [+iso[1], +iso[2], +iso[3]] : fr ? [+fr[3], +fr[2], +fr[1]] : [0, 0, 0];
  if (!a || !jourExiste(a, m, j)) return null;
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

function lireReseau(brut: string): IdReseau | null {
  const cle = brut.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s-]/g, "");
  return RESEAUX[cle] ?? null;
}

function separateur(ligne: string): string {
  return ["\t", ";", "|"].find((s) => ligne.includes(s)) ?? ";";
}

/** Lecture pure du fichier : lignes valides, erreurs de format (avec numéro de ligne). Aucun accès aux données. */
function lire(brut: unknown): { lus: number; lignes: LigneImport[]; erreurs: ErreurImport[] } {
  if (typeof brut !== "string") return { lus: 0, lignes: [], erreurs: [{ numero: 0, message: "Aucune publication trouvée : le fichier est illisible." }] };
  const sources = brut.split(/\r\n|\r|\n/).map((texte, i) => ({ numero: i + 1, texte: texte.trim() })).filter((l) => l.texte !== "");
  // Le séparateur se devine ligne par ligne ; le texte garde ce qui suit, tel quel, même s'il contient le séparateur.
  const decoupees = sources.map((l) => { const sep = separateur(l.texte); return { numero: l.numero, sep, champs: l.texte.split(sep) }; });
  if (decoupees.length && ENTETE.test(decoupees[0].champs[0].trim())) decoupees.shift();
  if (decoupees.length === 0) return { lus: 0, lignes: [], erreurs: [{ numero: 0, message: "Aucune publication trouvée : collez au moins une ligne (jour, heure, réseau, texte)." }] };
  if (decoupees.length > MAX_LIGNES) {
    return { lus: decoupees.length, lignes: [], erreurs: [{ numero: 0, message: `Fichier trop long : ${MAX_LIGNES} publications au plus (${decoupees.length} lues). Découpez-le en plusieurs fichiers.` }] };
  }

  const lignes: LigneImport[] = [];
  const erreurs: ErreurImport[] = [];
  for (const { numero, sep, champs: bruts } of decoupees) {
    const champs = bruts.map((c, i) => (i < 3 ? c.trim() : c));
    const avecHeure = HEURE_LUE.test(champs[1] ?? "");
    const [jourBrut, heureBrute, reseauBrut, texte] = avecHeure
      ? [champs[0], champs[1], champs[2] ?? "", champs.slice(3).join(sep).trim()]
      : [champs[0], HEURE_DEFAUT, champs[1] ?? "", champs.slice(2).join(sep).trim()];
    const jour = lireJour(jourBrut ?? "");
    if (!jour) { erreurs.push({ numero, message: lirePhrase(numero, `jour illisible ou impossible (« ${jourBrut ?? ""} »). Écrivez AAAA-MM-JJ ou JJ/MM/AAAA.`) }); continue; }
    const h = HEURE_LUE.exec(heureBrute);
    if (!h || +h[1] > 23 || +h[2] > 59) { erreurs.push({ numero, message: lirePhrase(numero, `heure impossible (« ${heureBrute} »). Écrivez HH:MM.`) }); continue; }
    const reseau = lireReseau(reseauBrut);
    if (!reseau) { erreurs.push({ numero, message: lirePhrase(numero, `réseau inconnu (« ${reseauBrut} »). Choisissez LinkedIn, Instagram, Facebook ou TikTok.`) }); continue; }
    if (!texte) { erreurs.push({ numero, message: lirePhrase(numero, "texte vide ou colonnes manquantes (jour, heure, réseau, texte).") }); continue; }
    if (texte.length > MAX_TEXTE) { erreurs.push({ numero, message: lirePhrase(numero, `texte trop long (${texte.length} signes, ${MAX_TEXTE} au plus).`) }); continue; }
    lignes.push({ numero, jour, heure: `${h[1].padStart(2, "0")}:${h[2]}`, reseau, texte });
  }
  return { lus: decoupees.length, lignes, erreurs };
}

function depotsPlan(): DepotsPlan {
  const d = depots();
  return { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] };
}

const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Instant ISO → jour et heure de Paris (jamais UTC). */
function enParis(instant: string): { jour: string; heure: string } {
  const p = Object.fromEntries(FORMAT_PARIS.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

const idLigne = (cle: string, numero: number) => `import-${cle}-${numero}`;

/** Avertissements (jamais bloquants) : passé, proximité, quota, week-end, face au fichier lui-même et au calendrier. */
async function avertir(lignes: readonly LigneImport[], ignorerPrefixe?: string): Promise<AvertissementImport[]> {
  const sortie: AvertissementImport[] = [];
  const maintenantMs = Date.now();
  const posts = new Map<IdReseau, PostPlanifie[]>();
  const jours = new Set<string>();
  for (const l of lignes) {
    if (Date.parse(resoudreHeureParis(l.jour, l.heure).instant) < maintenantMs) {
      sortie.push({ numero: l.numero, type: "passe", message: lirePhrase(l.numero, `le ${l.jour} à ${l.heure} est passé : à confirmer.`) });
    }
    posts.set(l.reseau, [...(posts.get(l.reseau) ?? []), { id: `ligne-${l.numero}`, reseau: l.reseau, jour: l.jour, heure: l.heure, pilier: `ligne-${l.numero}`, cible: `ligne-${l.numero}` }]);
    for (const j of [ajouterJoursParis(l.jour, -1), l.jour, ajouterJoursParis(l.jour, 1)]) jours.add(j);
  }
  for (const c of await depotsPlan().creneaux.lister()) {
    // Un créneau archivé ou en échec n'occupe plus la place ; ceux de ce même import (rejeu) non plus.
    if (c.statut === "archive" || c.statut === "echec" || (ignorerPrefixe && c.id.startsWith(ignorerPrefixe))) continue;
    for (const [reseau, instant] of Object.entries(c.heuresParReseau) as [IdReseau, string][]) {
      if (!posts.has(reseau) || !instant) continue;
      const p = enParis(instant);
      if (jours.has(p.jour)) posts.get(reseau)!.push({ id: c.id, reseau, ...p, pilier: c.id, cible: c.id });
    }
  }
  const type = { ecart: "proximite", quota: "quota", weekend: "weekend" } as const;
  for (const [reseau, liste] of posts) {
    for (const constat of verifierEspacement(liste, reglesDuReseau(reseau))) {
      if (constat.code === "repetition") continue;
      const numeros = constat.posts.filter((id) => id.startsWith("ligne-")).map((id) => Number(id.slice(6)));
      if (!numeros.length) continue;
      const numero = Math.min(...numeros);
      sortie.push({ numero, type: type[constat.code], message: lirePhrase(numero, constat.message) });
    }
  }
  return sortie.sort((a, b) => a.numero - b.numero);
}

/** Lit le fichier collé ou choisi et dit, ligne par ligne, ce qui sera importé. N'écrit rien. */
export async function analyserImport(saisie: SaisieImport): Promise<AnalyseImport> {
  await exigerSession();
  const { lus, lignes, erreurs } = lire(saisie?.texte);
  if (erreurs.length) return { ok: false, lus, lignes: [], erreurs, avertissements: [] };
  return { ok: true, lus, lignes, erreurs: [], avertissements: await avertir(lignes) };
}

const unALaFois = creerVerrou();

/** Crée une publication « propose » par ligne, après confirmation s'il y a des avertissements. Tout ou rien sur le format. */
export async function importerPublications(demande: DemandeImport): Promise<ResultatImport> {
  await exigerSession();
  return unALaFois(async () => {
    const { lus, lignes, erreurs } = lire(demande?.texte);
    if (erreurs.length) return { ok: false, message: "Le fichier n'a pas pu être lu : rien n'est importé.", erreurs };
    const compte = typeof demande.compteCible === "string" ? demande.compteCible.trim() : "";
    if (!compte) return { ok: false, message: "Choisissez le compte de publication." };
    if (typeof demande.cle !== "string" || !CLE.test(demande.cle)) return { ok: false, message: "Clé de formulaire invalide." };
    try {
      const prefixe = `import-${demande.cle}-`;
      const voulus = lignes.map((l) => ({ l, id: idLigne(demande.cle, l.numero), instant: resoudreHeureParis(l.jour, l.heure).instant }));
      // Rejeu : une ligne déjà créée par cette clé doit être identique ; sinon on refuse tout, sans rien écrire.
      const attendus = new Set(voulus.map((v) => v.id));
      if ((await depotsPlan().creneaux.lister()).some((c) => c.id.startsWith(prefixe) && !attendus.has(c.id))) {
        return { ok: false, message: "Ce formulaire a déjà importé un autre fichier : rouvrez-le pour en importer un nouveau." };
      }
      for (const v of voulus) {
        const existant = await depotsPlan().creneaux.obtenir(v.id);
        if (!existant) continue;
        const pareil = existant.jourVise === v.l.jour && existant.compteCible === compte && existant.heuresParReseau[v.l.reseau] === v.instant && Object.keys(existant.heuresParReseau).length === 1;
        if (!pareil) return { ok: false, message: "Ce formulaire a déjà importé un autre fichier : rouvrez-le pour en importer un nouveau." };
      }
      const avertissements = await avertir(lignes, prefixe);
      if (avertissements.length && !demande.confirmer) {
        return { ok: false, aConfirmer: true, avertissements, message: "Des dates demandent votre accord : confirmez pour importer quand même." };
      }
      let crees = 0;
      for (const v of voulus) {
        const c: CreneauPlan = await creerCreneau(depotsPlan(), { id: v.id, jourVise: v.l.jour, heuresParReseau: { [v.l.reseau]: v.instant }, compteCible: compte }, maintenant());
        const cleFiche = lireCleFiche(`creneau:${c.id}|${v.l.reseau}`);
        if (cleFiche) await ecrireStockageFiche(cleFiche, { texte: v.l.texte });
        crees++;
      }
      if (crees !== lus) return { ok: false, message: `Contrôle non tenu : ${lus} lignes lues, ${crees} créées. Relancez l'import avec le même formulaire.` };
      revalidatePath("/calendrier");
      return { ok: true, lus, crees, avertissements };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Import impossible." };
    }
  });
}
