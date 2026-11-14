/**
 * IMP-3 (b) — PROMOTION DES BROUILLONS ZERNIO (brouillon → programmé), UN SEUL À LA FOIS.
 * Uniquement par `client.promouvoir()` (forme D5 : GET avant, PUT { isDraft:false, scheduledFor }, GET après, date ≥ 30 min).
 * Jamais de suppression, jamais publishNow. ORDRE : un brouillon n'est promu que si son jumeau Buffer est un vrai
 * brouillon (garde POSITIVE : tout autre statut — scheduled, needs_approval, error — bloque), pour qu'aucun post ne parte deux fois. À blanc par défaut.
 */
import type { ClientZernio, PostZernio } from "../../fournisseurs/publication/zernio-client";
import { estErreurZernio } from "../../fournisseurs/publication/zernio-erreurs";
import { listerTousLesPosts, ORIGINE_IMPORT } from "./creer-brouillons";
import { ATTENDUS_PAR_DEFAUT } from "./rapprochement";
import { controlerGrille, dateUtilisable, SuiviDebitImport, type ViolationGrille } from "./plafonds";
import { ecartsJumeau } from "./retrait-jumeau";
import type { PostBuffer } from "./types";

export type EtatPromotion = "programme" | "a-blanc" | "deja-fait" | "buffer-actif" | "sans-buffer" | "jumeau-different" | "a-reprogrammer" | "refuse" | "a-verifier" | "arret";

export interface LignePromotion {
  bufferId: string;
  zernioId: string;
  compte?: string;
  reseau?: string;
  dateIso?: string;
  etat: EtatPromotion;
  raison?: string;
}

export interface ResultatPromotion {
  aBlanc: boolean;
  lignes: LignePromotion[];
  violations: ViolationGrille[];
  /** Raison du refus du lot entier (plafond de promotions par lot dépassé). */
  refusLot?: string;
}

export interface OptionsPromotion {
  client: ClientZernio;
  /** Lecture Buffer FRAÎCHE (lecture IMP-1) : sert à vérifier que le jumeau est un brouillon. */
  postsBuffer: PostBuffer[];
  /** Défaut : vrai. Faux = vraies promotions. */
  aBlanc?: boolean;
  maintenant: () => number;
  attendre?: (ms: number) => Promise<void>;
  suivi?: SuiviDebitImport;
  /** Reprise : identifiants Zernio déjà programmés (journal). */
  dejaPromus?: ReadonlySet<string>;
  journaliser?: (l: LignePromotion) => void | Promise<void>;
  /** Plafond de promotions par lot (défaut : ATTENDUS_PAR_DEFAUT). Au-delà, rien n'est promu. */
  plafondLot?: number;
}

const secondes = (iso: string): string => new Date(Date.parse(iso)).toISOString().replace(/\.\d{3}Z$/, "Z");
const idCompte = (z: PostZernio): string => {
  const a = z.platforms?.[0]?.accountId;
  return a && typeof a === "object" ? String(a._id ?? "") : String(a ?? "");
};

export async function promouvoirBrouillons(o: OptionsPromotion): Promise<ResultatPromotion> {
  const aBlanc = o.aBlanc ?? true;
  const suivi = o.suivi ?? new SuiviDebitImport();
  const attendre = o.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const res: ResultatPromotion = { aBlanc, lignes: [], violations: [] };
  // L7-08 : de vraies promotions exigent les TROIS réglages ouverts, publication éditoriale comprise (refus avant tout appel).
  if (!aBlanc && !(await (await import("../zernio")).publicationEditorialeAutorisee())) {
    res.refusLot = "publication du calendrier fermée (réglages zernio.envoi_autorise, zernio.envoi_calendrier_autorise et publication éditoriale) : rien n'a été promu";
    return res;
  }
  const buffer = new Map(o.postsBuffer.map((p) => [p.id, p]));
  const brouillons = (await listerTousLesPosts(o.client, "draft"))
    .filter((z) => z.metadata?.origine === ORIGINE_IMPORT && typeof z.metadata.bufferId === "string")
    .sort((a, b) => (Date.parse(a.scheduledFor ?? "") || 0) - (Date.parse(b.scheduledFor ?? "") || 0) || a._id.localeCompare(b._id));

  // 1. Décision pure de chaque brouillon (ordre : jumeau Buffer retiré, jumeau conforme, date utilisable).
  const candidats: { z: PostZernio; b: PostBuffer; ligne: LignePromotion }[] = [];
  for (const z of brouillons) {
    const bufferId = z.metadata!.bufferId as string;
    const b = buffer.get(bufferId);
    const ligne: LignePromotion = { bufferId, zernioId: z._id, compte: idCompte(z), reseau: z.platforms?.[0]?.platform, dateIso: z.scheduledFor, etat: "arret" };
    res.lignes.push(ligne);
    if (o.dejaPromus?.has(z._id)) ligne.etat = "deja-fait";
    else if (!b) {
      ligne.etat = "sans-buffer";
      ligne.raison = "jumeau Buffer introuvable dans la lecture : non promu";
    } else if (b.statut !== "draft" || b.envoyeLe) {
      ligne.etat = "buffer-actif";
      ligne.raison = `le jumeau Buffer n'est pas un brouillon (statut ${b.statut}${b.envoyeLe ? ", déjà envoyé" : ""}) : le repasser en brouillon d'abord`;
    } else {
      const e = ecartsJumeau(b, z);
      const d = dateUtilisable(z.scheduledFor, o.maintenant(), "promotion");
      if (e.length) {
        ligne.etat = "jumeau-different";
        ligne.raison = `écart avec Buffer (${e.join(", ")})`;
      } else if (!d.ok) {
        ligne.etat = "a-reprogrammer";
        ligne.raison = d.raison;
      } else {
        candidats.push({ z, b, ligne });
        continue;
      }
    }
  }

  // 2. Grille contrôlée avant le lot (heure, jour) : hors plafond, rien n'est promu.
  // Les posts DÉJÀ programmés chez Zernio (passages précédents, Studio) comptent dans la grille (lecture seule, route existante).
  const plafondLot = o.plafondLot ?? ATTENDUS_PAR_DEFAUT;
  let refusLot: string | undefined;
  if (candidats.length > plafondLot) refusLot = `${candidats.length} promotions demandées, plafond du lot ${plafondLot} : lot non lancé`;
  const idsCandidats = new Set(candidats.map((c) => c.b.id));
  if (candidats.length && !refusLot) {
    const dejaProgrammes = (await listerTousLesPosts(o.client, "scheduled")).filter((z) => z.scheduledFor && !candidats.some((c) => c.z._id === z._id));
    const grille = [
      ...candidats.map((c) => ({ id: c.b.id, compte: c.ligne.compte ?? "", reseau: c.ligne.reseau ?? "", dateIso: c.z.scheduledFor! })),
      ...dejaProgrammes.map((z) => ({ id: z._id, compte: idCompte(z), reseau: z.platforms?.[0]?.platform ?? "", dateIso: z.scheduledFor! })),
    ];
    // Seules comptent les violations qui touchent le lot (un excès sans rapport avec lui ne le bloque pas).
    res.violations = controlerGrille(grille).filter((v) => v.ids.some((i) => idsCandidats.has(i)));
  }
  if (res.violations.length || refusLot) {
    for (const c of candidats) {
      c.ligne.etat = "arret";
      c.ligne.raison = refusLot ?? "grille hors plafond : lot non lancé";
    }
  }
  if (refusLot) res.refusLot = refusLot;
  const aTraiter = res.violations.length || refusLot ? [] : candidats;

  // 3. Promotion, un seul à la fois, journal après chacun, arrêt au premier doute.
  let arret = false;
  for (const { z, b, ligne } of aTraiter) {
    if (arret) {
      ligne.raison = "lot arrêté avant ce post";
    } else if (aBlanc) {
      ligne.etat = "a-blanc";
    } else {
      try {
        const permis = suivi.peutOperer(ligne.compte ?? "", ligne.reseau ?? "", o.maintenant());
        if (!permis.ok) {
          ligne.raison = permis.raison;
          arret = true;
        } else {
          const attente = suivi.delaiAvant(o.maintenant());
          if (attente > 0) await attendre(attente);
          // GET avant + PUT + GET après : 3 requêtes.
          for (let i = 0; i < 3; i++) suivi.noterRequete(o.maintenant());
          const r = await o.client.promouvoir({ postId: z._id, cleJournal: String(z.metadata?.studioCle ?? ""), dateJournal: secondes(b.dateUtc ?? "") });
          suivi.noterOperation(ligne.compte ?? "", o.maintenant());
          ligne.etat = r.etat;
          if (r.etat !== "programme") ligne.raison = r.raison;
          if (r.etat === "a-verifier") arret = true; // aucun nouvel essai automatique
        }
      } catch (e) {
        ligne.etat = "refuse";
        ligne.raison = e instanceof Error ? e.message : "erreur";
        if (!estErreurZernio(e) || ["debit", "indisponible", "acces", "envoi-coupe", "a-verifier"].includes(e.code)) arret = true;
      }
    }
    await o.journaliser?.(ligne);
  }
  return res;
}
