"use server";

/**
 * Actions serveur du calendrier (L7-11) : ajout manuel à une date précise.
 * - Le créneau naît « propose » ; rien ne part avant validerEntree(), qui ne programme ni ne publie : aucun appel au diffuseur ici.
 * - Un ajout manuel n'est jamais bloqué : seule une erreur de format refuse. Le passé, une proximité ou un quota atteint avertissent et se confirment d'un clic.
 * - Idempotent : la clé du formulaire donne l'identifiant, un double clic ne crée qu'un créneau.
 */
import type { IdReseau } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { depots, essayer, maintenant, type Resultat } from "@/services/_commun";
import { changerStatut, creerCreneau, decaler, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";
import { heureAffichageParis, validerProposition } from "@/domaine/plan-editorial/statuts";
import { ajouterJoursParis, instantParis, resoudreHeureParis } from "@/lib/horloge-paris";
import { reglesDuReseau, verifierEspacement, type PostPlanifie } from "@/domaine/cadence/verifier";

export interface SaisieEntree {
  /** AAAA-MM-JJ (jour de Paris). */
  jour: string;
  /** HH:MM à Paris ; 09:00 par défaut. */
  heure?: string;
  compteCible: string;
  reseau: IdReseau;
  /** Une vidéo OU un visuel. */
  videoId?: string;
  visuelId?: string;
  /** Clé stable du formulaire ouvert (idempotence). */
  cle: string;
  /** Vrai après le clic de confirmation d'un ajout dans le passé. */
  confirmerPasse?: boolean;
  /** Vrai après le clic de confirmation d'une proximité ou d'un quota atteint. */
  confirmerProximite?: boolean;
}

export type ResultatAjout =
  | { ok: true; donnees: CreneauPlan; avertissement?: string }
  | { ok: false; message: string; aConfirmer?: "passe" | "proximite" | "quota"; avertissement?: string };

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
function jourExiste(j: string): boolean {
  const [a, m, d] = j.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const CLE = /^[A-Za-z0-9_-]{1,64}$/;

const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Instant ISO → jour et heure de Paris (jamais UTC). */
function enParis(instant: string): { jour: string; heure: string } {
  const p = Object.fromEntries(FORMAT_PARIS.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

/** Avertissement de proximité ou de quota pour le nouveau créneau (jour, veille et lendemain du réseau). Ne bloque jamais. */
async function verifierVoisinage(saisie: SaisieEntree, instant: string): Promise<{ type: "proximite" | "quota"; message: string } | null> {
  const nouveau = enParis(instant);
  const fenetre = new Set([ajouterJoursParis(saisie.jour, -1), saisie.jour, ajouterJoursParis(saisie.jour, 1)]);
  const posts: PostPlanifie[] = [{ id: "nouveau", reseau: saisie.reseau, ...nouveau, pilier: "nouveau", cible: "nouveau" }];
  for (const c of await depotsPlan().creneaux.lister()) {
    const inst = c.heuresParReseau[saisie.reseau];
    if (!inst) continue;
    // Un créneau archivé ou en échec n'occupe plus la place : pas d'avertissement.
    if (c.statut === "archive" || c.statut === "echec") continue;
    const p = enParis(inst);
    // Pilier et cible distincts : seules l'écart et le quota nous intéressent ici.
    if (fenetre.has(p.jour)) posts.push({ id: c.id, reseau: saisie.reseau, ...p, pilier: c.id, cible: c.id });
  }
  const constats = verifierEspacement(posts, reglesDuReseau(saisie.reseau)).filter((x) => x.posts.includes("nouveau"));
  const ecart = constats.find((x) => x.code === "ecart");
  if (ecart) return { type: "proximite", message: `${ecart.message} Confirmer pour l'ajouter quand même.` };
  const quota = constats.find((x) => x.code === "quota");
  if (quota) return { type: "quota", message: `${quota.message} Confirmer pour l'ajouter quand même.` };
  return null;
}

function depotsPlan(): DepotsPlan {
  const d = depots();
  return { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] };
}

export async function ajouterEntree(saisie: SaisieEntree): Promise<ResultatAjout> {
  await exigerSession();
  const heure = saisie.heure ?? "09:00";
  if (!JOUR.test(saisie.jour) || !jourExiste(saisie.jour)) return { ok: false, message: "Jour invalide (AAAA-MM-JJ attendu)." };
  if (!HEURE.test(heure)) return { ok: false, message: "Heure invalide (HH:MM attendu)." };
  if (!CLE.test(saisie.cle ?? "")) return { ok: false, message: "Clé de formulaire invalide." };
  const { instant, avertissement } = resoudreHeureParis(saisie.jour, heure);
  try {
    const id = `manuel-${saisie.cle}`;
    const existant = await depotsPlan().creneaux.obtenir(id);
    if (existant) {
      const memeContenu =
        existant.jourVise === saisie.jour &&
        existant.compteCible === saisie.compteCible &&
        existant.heuresParReseau[saisie.reseau] === instant &&
        Object.keys(existant.heuresParReseau).length === 1 &&
        (existant.videoId ?? undefined) === (saisie.videoId || undefined) &&
        (existant.visuelId ?? undefined) === (saisie.visuelId || undefined);
      if (!memeContenu) return { ok: false, message: "Ce formulaire a déjà créé une entrée différente : rouvrez-le pour en ajouter une autre." };
      return { ok: true, donnees: existant, ...(avertissement ? { avertissement } : {}) };
    }
    if (Date.parse(instant) < Date.now() && !saisie.confirmerPasse) {
      return { ok: false, aConfirmer: "passe", avertissement: "Cette date est passée : confirmer pour l'ajouter quand même.", message: "Date dans le passé : à confirmer." };
    }
    if (!saisie.confirmerProximite) {
      const v = await verifierVoisinage(saisie, instant);
      if (v) return { ok: false, aConfirmer: v.type, avertissement: v.message, message: "Proximité ou quota : à confirmer." };
    }
    const c = await creerCreneau(depotsPlan(), {
      id,
      jourVise: saisie.jour,
      heuresParReseau: { [saisie.reseau]: instant },
      compteCible: saisie.compteCible,
      ...(saisie.videoId ? { videoId: saisie.videoId } : {}),
      ...(saisie.visuelId ? { visuelId: saisie.visuelId } : {}),
    }, maintenant());
    return { ok: true, donnees: c, ...(avertissement ? { avertissement } : {}) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Ajout impossible." };
  }
}

/** Geste du fondateur : « propose » → « valide ». Ne programme ni ne publie : la reprise par le diffuseur se fait ailleurs. */
export async function validerEntree(id: string): Promise<Resultat<CreneauPlan>> {
  const session = await exigerSession();
  return essayer(async () => {
    const d = depotsPlan();
    const c = await d.creneaux.obtenir(id);
    if (!c) throw new Error(`Créneau introuvable : ${id}`);
    if (c.statut === "valide") return c;
    if (c.statut === "propose") await changerStatut(d, id, "a_valider", "studio", maintenant());
    // Validation tracée (date et auteur) : seule voie permise depuis « a_valider » (règle du domaine).
    const a = (await d.creneaux.obtenir(id))!;
    const r = validerProposition(a, "studio", maintenant(), session.id);
    if (!r.ok) throw new Error(r.raison);
    return d.creneaux.enregistrer(r.creneau);
  });
}

export interface SaisieDecalage {
  id: string;
  /** AAAA-MM-JJ (jour de Paris) ; l'heure de Paris de chaque réseau est conservée. */
  nouveauJour: string;
  raison: string;
  /** Clé stable du formulaire ouvert (idempotence). */
  cle: string;
}

export type ResultatDecalage = { ok: true; donnees: CreneauPlan } | { ok: false; message: string };

/**
 * L4-06 : décaler une entrée FUTURE (le passé et le publié sont refusés). Aucun appel au fournisseur.
 * - Entrée confiée à l'usine (repérée ou signée) : décalée et marquée « aRenvoyer » (le service le pose) ; la reprogrammation relève de la session Zernio.
 * - Entrée déjà confiée au diffuseur (programmée ou en échec) : REFUSÉE tant que CAL-23 n'est pas livrée (« Retirez-la d'abord »), sans aucun changement de date.
 */
export async function decalerEntree(saisie: SaisieDecalage): Promise<ResultatDecalage> {
  await exigerSession();
  if (!JOUR.test(saisie.nouveauJour ?? "") || !jourExiste(saisie.nouveauJour)) return { ok: false, message: "Jour invalide (AAAA-MM-JJ attendu)." };
  if (!CLE.test(saisie.cle ?? "")) return { ok: false, message: "Clé de formulaire invalide." };
  try {
    const d = depotsPlan();
    const c = await d.creneaux.obtenir(saisie.id);
    if (!c) return { ok: false, message: `Entrée introuvable : ${saisie.id}` };
    // Un rejeu de clé déjà journalisée est rendu par le service, avant tout contrôle de date (le créneau a déjà bougé).
    const rejeu = await depots().journalDecalages.obtenir(`decalage:${saisie.id}:${saisie.cle}`);
    if (rejeu) return { ok: true, donnees: await decaler(d, saisie.id, { nouveauJour: saisie.nouveauJour, raison: saisie.raison, cle: saisie.cle }, maintenant()) };
    if (c.statut === "publie") return { ok: false, message: "Cette entrée est publiée : elle ne se décale pas." };
    if (c.statut === "archive") return { ok: false, message: "Cette entrée est archivée : elle ne se décale pas." };
    if (c.statut === "programme" || c.statut === "echec") return { ok: false, message: "Cette entrée est déjà confiée au diffuseur. Retirez-la d'abord, puis décalez-la." };
    const maintenantMs = Date.now();
    const heures = Object.values(c.heuresParReseau).filter((h): h is string => Boolean(h));
    const dejaPassee = heures.length
      ? heures.some((h) => Date.parse(h) <= maintenantMs)
      : Date.parse(instantParis(c.jourVise, "23:59")) <= maintenantMs;
    if (dejaPassee) return { ok: false, message: "Cette entrée est passée : elle ne se décale pas." };
    const nouvelles = heures.length ? heures.map((h) => instantParis(saisie.nouveauJour, heureAffichageParis(h))) : [instantParis(saisie.nouveauJour, "23:59")];
    if (nouvelles.some((h) => Date.parse(h) <= maintenantMs)) return { ok: false, message: "Ce jour est passé : choisissez une date à venir." };
    return { ok: true, donnees: await decaler(d, saisie.id, { nouveauJour: saisie.nouveauJour, raison: saisie.raison, cle: saisie.cle }, maintenant()) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Décalage impossible." };
  }
}
