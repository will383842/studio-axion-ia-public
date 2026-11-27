/**
 * CAL-21 · UNE SEULE FONCTION DE VALIDATION d'une entrée du calendrier.
 * `validerEntree` (actions/ajouter.ts) et `accepterEntree` (actions/statuts.ts) l'appellent toutes deux.
 *
 * Elle écrit seulement le statut `valide` + `valideeLe` / `valideePar` (jamais `programme` : seule la promotion de L5-02a l'écrit,
 * après confirmation du diffuseur), puis demande UNE fois l'envoi du créneau (`envoyerDepuisCreneau` de L5-02a, injecté).
 * Aucun réglage n'est écrit ici ; sans envoi injecté ou avec un réglage fermé, rien ne part. Aucune donnée supprimée.
 * Tout est injecté : aucun service serveur importé.
 */
import { estReseauVisuelEnvoi } from "@/domaine/reseaux-visuel-envoi";
import { validerProposition } from "@/domaine/plan-editorial/statuts";
import type { CreneauPlan } from "@/services/plan-editorial";
import type { LigneCreneau } from "@/services/envoi-depuis-creneau";

/** Phrase existante (actions/statuts.ts) : recopiée ici pour que le service ne dépende pas d'une action serveur. */
export const PHRASE_HEURE_PASSEE_VALIDATION = "L'heure est passée : déplacez la publication avant de la valider";

/** Marge avant l'heure prévue (30 min, `PROMOTION_MARGE_MIN_MS` de L0-08) : en deçà, le diffuseur ne peut plus programmer. */
const MARGE_MS = 30 * 60 * 1000;

export interface DepsValiderEntree {
  obtenir(id: string): Promise<CreneauPlan | null>;
  enregistrer(c: CreneauPlan): Promise<CreneauPlan>;
  /** Passage `propose` → `a_valider` (même geste que changerStatut du plan éditorial). */
  versAValider?(id: string): Promise<void>;
  /** Les trois réglages d'envoi sont-ils ouverts ? Erreur ou valeur autre que `true` = fermé. */
  reglagesOuverts(): Promise<boolean>;
  /** `envoyerDepuisCreneau(depsL502a, id)` de L5-02a. Absent = rien n'est envoyé (envoi éteint). */
  envoyer?(creneauId: string): Promise<LigneCreneau | undefined>;
}

export type ResultatValidation =
  | { ok: true; creneau: CreneauPlan; envoi?: LigneCreneau; libelle: string }
  | { ok: false; message: string };

const heureParis = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export async function validerEntree(deps: DepsValiderEntree, id: string, par: string, maintenant: Date): Promise<ResultatValidation> {
  const c = typeof id === "string" && id ? await deps.obtenir(id) : null;
  if (!c) return { ok: false, message: "Cette entrée est introuvable." };
  const instants = Object.values(c.heuresParReseau ?? {}).filter((h): h is string => typeof h === "string").map((h) => Date.parse(h));
  const premier = instants.length ? Math.min(...instants) : NaN;
  const dejaValide = c.statut === "valide";

  if (!dejaValide && instants.length && (instants.some(Number.isNaN) || premier < maintenant.getTime())) {
    return { ok: false, message: PHRASE_HEURE_PASSEE_VALIDATION };
  }

  let valide = c;
  if (!dejaValide) {
    if (c.statut !== "propose" && c.statut !== "a_valider") return { ok: false, message: "Seule une idée ou une entrée à valider peut être validée." };
    if (c.statut === "propose") {
      if (!deps.versAValider) return { ok: false, message: "Validation impossible : passage à « à valider » non branché." };
      await deps.versAValider(id);
    }
    const a = (await deps.obtenir(id)) ?? c;
    const r = validerProposition(a, "studio", maintenant.toISOString(), par);
    if (!r.ok) return { ok: false, message: r.raison };
    valide = await deps.enregistrer(r.creneau);
  }

  // Double clic ou rejeu : déjà validée = aucun nouvel appel (le brouillon est déjà demandé ; L5-02a est de toute façon idempotent).
  if (dejaValide) return { ok: true, creneau: valide, libelle: "Déjà validée." };

  // Trop tard pour le diffuseur (moins de 30 min) : on n'appelle rien et on propose une autre heure (vouvoiement).
  if (Number.isFinite(premier) && premier - maintenant.getTime() < MARGE_MS) {
    return { ok: true, creneau: valide, libelle: "Validée, mais trop proche pour partir seule. Choisissez une autre heure, au moins 30 minutes plus tard." };
  }

  let ouverts = false;
  try { ouverts = (await deps.reglagesOuverts()) === true; } catch { ouverts = false; }
  if (!ouverts) return { ok: true, creneau: valide, libelle: "Programmé, envoi éteint : rien ne partira tant que l'envoi n'est pas allumé." };
  // L5-02c : ouvert, la validation n'appelle jamais le diffuseur ; c'est le tour de la boucle du Studio qui prépare le brouillon, puis le programme.
  // Seul un visuel part seul en V1 (LinkedIn, Instagram, Facebook) : ni vidéo (« vid-… » comprises), ni validation relayée par l'usine, ni heure illisible.
  const premierVisuel = Math.min(...Object.entries(valide.heuresParReseau ?? {}).filter(([r, h]) => estReseauVisuelEnvoi(r) && typeof h === "string").map(([, h]) => Date.parse(h as string)));
  const partSeule = !!valide.visuelId && !valide.videoId && !id.startsWith("vid-") && !par.startsWith("usine:") && Number.isFinite(premierVisuel);
  if (!deps.envoyer && !partSeule) return { ok: true, creneau: valide, libelle: "Validée. Elle ne part pas seule depuis le calendrier pour l'instant." };
  if (!deps.envoyer) return { ok: true, creneau: valide, libelle: `Validée. Elle partira seule à ${heureParis(new Date(premierVisuel).toISOString())} (heure de Paris) : le brouillon est préparé au plus tôt 6 jours avant.` };

  let envoi: LigneCreneau | undefined;
  try {
    envoi = await deps.envoyer(id);
  } catch {
    // La validation reste acquise ; l'erreur d'envoi ne fait pas passer la validation pour ratée.
    return { ok: true, creneau: valide, libelle: "Validée. L'envoi n'a pas pu être préparé : il sera revu au prochain passage." };
  }
  if (envoi && (envoi.etat === "brouillon-cree" || envoi.etat === "deja-cree")) {
    return { ok: true, creneau: valide, envoi, libelle: `Partira seule à ${heureParis(premier ? new Date(premier).toISOString() : maintenant.toISOString())} (heure de Paris).` };
  }
  if (envoi?.etat === "refuse" && valide.heuresParReseau && "tiktok" in valide.heuresParReseau) {
    return { ok: true, creneau: valide, envoi, libelle: "Validée. À compléter : consentement et niveau de confidentialité TikTok." };
  }
  return { ok: true, creneau: valide, ...(envoi ? { envoi } : {}), libelle: "Programmé, envoi éteint : rien ne partira tant que l'envoi n'est pas allumé." };
}

/**
 * Câblage serveur (CAL-21 suite) : construit les dépendances réelles et appelle `validerEntree`, comme l'action `validerEntree` d'ajouter.ts.
 * Réglages fermés par défaut et aucun envoi injecté : rien ne part d'ici (le tour de la boucle s'en charge), jamais de statut `programme`.
 * Les services serveur sont chargés à l'appel pour que le service ci-dessus reste pur (tout injecté).
 */
export async function validerEntreeServeur(id: string, par: string): Promise<{ ok: true; donnees: CreneauPlan } | { ok: false; message: string; code?: string; montant?: number }> {
  const { depots, essayer, maintenant, ErreurStudio } = await import("@/services/_commun");
  const { changerStatut } = await import("@/services/plan-editorial");
  const { publicationEditorialeAutorisee } = await import("@/services/zernio");
  type Depots = import("@/services/plan-editorial").DepotsPlan;
  return essayer(async () => {
    const d = depots();
    const dp: Depots = { creneaux: d.creneauxEditoriaux as Depots["creneaux"], journal: d.journalDecalages as unknown as Depots["journal"] };
    const r = await validerEntree(
      {
        obtenir: (x) => dp.creneaux.obtenir(x),
        enregistrer: (c) => dp.creneaux.enregistrer(c),
        versAValider: async (x) => { await changerStatut(dp, x, "a_valider", "studio", maintenant()); },
        reglagesOuverts: () => publicationEditorialeAutorisee(),
      },
      id,
      par,
      new Date(maintenant()),
    );
    // Le refus de CAL-21 (vouvoiement) doit arriver tel quel à l'écran : ErreurStudio, pas une erreur inconnue.
    if (!r.ok) throw new ErreurStudio("validation_refusee", r.message);
    return r.creneau;
  });
}
