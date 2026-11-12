"use server";

/**
 * Actions serveur du calendrier (L7-11) : ajout manuel à une date précise.
 * - Le créneau naît « propose » ; rien ne part avant validerEntree(), qui ne programme ni ne publie : aucun appel au diffuseur ici.
 * - Un ajout manuel n'est jamais bloqué : seule une erreur de format refuse. Le passé avertit et se confirme d'un clic.
 * - Idempotent : la clé du formulaire donne l'identifiant, un double clic ne crée qu'un créneau.
 */
import type { IdReseau } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { depots, essayer, maintenant, type Resultat } from "@/services/_commun";
import { changerStatut, creerCreneau, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";
import { resoudreHeureParis } from "@/lib/horloge-paris";

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
}

export type ResultatAjout =
  | { ok: true; donnees: CreneauPlan; avertissement?: string }
  | { ok: false; message: string; aConfirmer?: "passe"; avertissement?: string };

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
function jourExiste(j: string): boolean {
  const [a, m, d] = j.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const CLE = /^[A-Za-z0-9_-]{1,64}$/;

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
  if (Date.parse(instant) < Date.now() && !saisie.confirmerPasse) {
    return { ok: false, aConfirmer: "passe", avertissement: "Cette date est passée : confirmer pour l'ajouter quand même.", message: "Date dans le passé : à confirmer." };
  }
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
  await exigerSession();
  return essayer(async () => {
    const d = depotsPlan();
    const c = await d.creneaux.obtenir(id);
    if (!c) throw new Error(`Créneau introuvable : ${id}`);
    if (c.statut === "valide") return c;
    if (c.statut === "propose") await changerStatut(d, id, "a_valider", "studio", maintenant());
    return changerStatut(d, id, "valide", "studio", maintenant());
  });
}
