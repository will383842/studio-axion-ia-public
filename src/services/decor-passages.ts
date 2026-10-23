/**
 * DÉCOR IA — PASSAGES DANS LE STUDIO-ALIGNEUR (lot E1, routes du lot G). Serveur seulement.
 *
 * Les trois fonctions que la passe « Décor IA » (`passeDecorFacecam`) attend, branchées sur la route `/image` du
 * `studio-aligneur` (étapes `extraire`, `reposer`, `mesurer`) :
 *   - extraire : l'image seule d'un passage de la passe image (10 bits, temps de la prise), dans la fenêtre 9:16 ;
 *   - reposer : la sortie de Higgsfield (déposée sur R2) remise à 25 i/s sans changer la vitesse, à la taille de la
 *     fenêtre, en 10 bits ; sa clé part dans le plan du décor, lu par le cadrage ;
 *   - mesurer : écart bouche / voix d'origine, ressemblance du visage, visage trouvé.
 * Aucun appel à Higgsfield ici. Le fournisseur `studio-aligneur` n'est pris que s'il est réel (sinon : `null` partout,
 * donc « Décor non réussi », aucun crédit dépensé). Chaque travail est suivi jusqu'au bout (la passe décor est
 * séquentielle) avec un délai maximal ; une panne rend `null` (repli, jamais d'exception).
 */
import "server-only";
import type { Id } from "@/domaine/types";
import type { MesuresRaccord } from "@/briques/decor/raccord";
import type { DependancesDecor } from "@/briques/decor/passe";
import type { PassageDecor } from "@/briques/decor/decoupage";
import { fournisseurFacecam } from "@/fournisseurs/facecam";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam/client";
import type { FenetreDecor } from "@/moteurs/montage-facecam/chaine";
import { fournisseur } from "./_commun";

const DUREE_SIGNATURE_SEC = 6 * 3600;
/** Un passage de 15 s : extraction et remise en cadence en moins d'une minute ; la mesure ≈ 1 min (MediaPipe). */
const DELAI_TRAVAIL_MS = 10 * 60_000;
const INTERVALLE_SUIVI_MS = 3_000;

export interface ContextePassages {
  videoId: Id;
  travailId: Id;
  /** Passe image (10 bits, bande de la source) : le passage en est extrait. */
  imageCle: string;
  /** Prise d'origine : sa voix sert à mesurer les lèvres. */
  priseCle: string;
  /** Fenêtre 9:16 du décor dans la source ; `bandeX` : début de la bande de la passe image dans la source. */
  fenetre: FenetreDecor;
  bandeX: number;
  /** Injections pour les essais. */
  facecam?: FournisseurFacecam;
  stockage?: { lire(cle: string): Promise<string>; deposer(cle: string, mime: string): Promise<string> } | null;
  fetch?: typeof fetch;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => number;
}

const attendreParDefaut = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function stockage() {
  const s = await fournisseur("stockage");
  if (!s.urlDepotDuree) return null;
  return {
    lire: async (cle: string) => (s.urlLectureDuree ? s.urlLectureDuree(cle, DUREE_SIGNATURE_SEC) : s.urlLecture(cle)),
    deposer: (cle: string, mime: string) => s.urlDepotDuree!(cle, DUREE_SIGNATURE_SEC, mime),
  };
}

/** Les trois fonctions de la passe décor, reliées au studio-aligneur. Aligneur non réel : toutes rendent `null`. */
export function passagesDecorAligneur(ctx: ContextePassages): Pick<DependancesDecor, "extrairePassage" | "deposerPassage" | "mesurer"> {
  const facecam = ctx.facecam ?? fournisseurFacecam({ reel: true });
  const attendre = ctx.attendre ?? attendreParDefaut;
  const maintenant = ctx.maintenant ?? Date.now;
  const lireStockage = async () => (ctx.stockage !== undefined ? ctx.stockage : stockage());
  const reseau = ctx.fetch ?? fetch;
  const base = `facecam/${ctx.videoId}/decor/${ctx.travailId}`.replace(/[^A-Za-z0-9/_-]/g, "-");
  const extraits = new Map<number, string>();

  /** Soumet un travail `/image` et le suit jusqu'au bout ; rend son résultat, ou `null` (panne, délai). */
  async function travail(nom: string, demande: Omit<DemandeFacecam, "idTravail">): Promise<Record<string, unknown> | null> {
    if (facecam.mode !== "reel") return null;
    const idTravail = `${ctx.travailId}-decor-${nom}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 200);
    try {
      const r = await facecam.soumettre("image", { ...demande, idTravail });
      if (r.statut === "echec") return null;
      const fin = maintenant() + DELAI_TRAVAIL_MS;
      while (maintenant() < fin) {
        const e = await facecam.suivre("image", idTravail);
        if (e.statut === "termine") return e.resultat as unknown as Record<string, unknown>;
        if (e.statut === "echec") return null;
        await attendre(INTERVALLE_SUIVI_MS);
      }
    } catch (e) {
      console.warn(`[decor-ia] ${ctx.videoId} : travail « ${nom} » en panne (${e instanceof Error ? e.message : "erreur"})`);
    }
    return null;
  }

  return {
    async extrairePassage(p: PassageDecor) {
      const s = await lireStockage();
      if (!s) return null;
      const cle = `${base}/passage-${p.index}.mp4`;
      const fenetre = { ...ctx.fenetre, x: Math.max(0, ctx.fenetre.x - ctx.bandeX) };
      const r = await travail(`extraire-${p.index}`, {
        source: await s.lire(ctx.imageCle),
        depots: { passage: await s.deposer(cle, "video/mp4") },
        parametres: { etape: "extraire", debutSec: p.debutSec, finSec: p.finSec, fenetre, cles: { passage: cle } },
      });
      if (!r) return null;
      extraits.set(p.index, cle);
      try {
        const lu = await reseau(await s.lire(cle), { signal: AbortSignal.timeout(120_000) });
        return lu.ok ? new Uint8Array(await lu.arrayBuffer()) : null;
      } catch {
        return null;
      }
    },

    /** Lot K (facultatif) : `effet` = fondu de raccord et couleurs accordées sur le passage d'origine (Look Will). */
    async deposerPassage(p, octets, conversion, effet?: { fonduSec: number; accorderCouleurs: boolean }) {
      const s = await lireStockage();
      if (!s) return null;
      const brut = `${base}/retouche-${p.index}.mp4`;
      try {
        const envoi = await reseau(await s.deposer(brut, "video/mp4"), { method: "PUT", body: new Uint8Array(octets), headers: { "content-type": "video/mp4" }, signal: AbortSignal.timeout(120_000) });
        if (!envoi.ok) return null;
      } catch {
        return null;
      }
      const cle = `${base}/decor-${p.index}.mp4`;
      const r = await travail(`reposer-${p.index}`, {
        source: await s.lire(brut),
        depots: { decor: await s.deposer(cle, "video/mp4") },
        parametres: {
          etape: "reposer",
          conversion,
          taille: { largeur: ctx.fenetre.largeur, hauteur: ctx.fenetre.hauteur },
          ...(effet && extraits.has(p.index) ? { original: await s.lire(extraits.get(p.index)!), fonduSec: effet.fonduSec, accorderCouleurs: effet.accorderCouleurs } : {}),
          cles: { decor: cle },
        },
      });
      return r ? cle : null;
    },

    async mesurer(p, fichierCle): Promise<MesuresRaccord | null> {
      const s = await lireStockage();
      const original = extraits.get(p.index);
      if (!s || !original) return null;
      const r = await travail(`mesurer-${p.index}`, {
        source: await s.lire(fichierCle),
        depots: {},
        parametres: { etape: "mesurer", debutSec: p.debutSec, finSec: p.finSec, original: await s.lire(original), voix: await s.lire(ctx.priseCle) },
      });
      const m = r as Partial<MesuresRaccord> | null;
      if (!m || ![m.ecartBoucheMs, m.ressemblanceVisage, m.visageTrouvePct].every((x) => typeof x === "number" && Number.isFinite(x))) return null;
      return { ecartBoucheMs: m.ecartBoucheMs!, ressemblanceVisage: m.ressemblanceVisage!, visageTrouvePct: m.visageTrouvePct! };
    },
  };
}
