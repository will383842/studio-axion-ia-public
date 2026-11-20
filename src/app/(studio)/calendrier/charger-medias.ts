import "server-only";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { entreeDepuisPublication, type EntreeApercu, type PublicationApercu } from "@/components/calendrier/apercu-reseau";
import { LIMITE_PAGES } from "@/services/pdf-pages";
import { DUREE_LECTURE_SEC } from "@/services/medias-deposes";
import { depots, fournisseur } from "@/services/_commun";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";

/** Seules les adresses https ou les chemins du Studio (jamais « // », jamais « javascript: ») sont gardées. */
const ADRESSE_SURE = /^(?:https:\/\/|\/(?!\/))/;

interface MediaVisuel {
  type: "carrousel" | "infographie";
  pages: string[];
}

/** Pages signées d'un visuel (20 au plus). Lève si le dépôt ou le stockage échoue : l'appelant rend l'entrée sans média. */
async function pagesDuVisuel(visuelId: string): Promise<MediaVisuel> {
  const visuel = await depots().visuels.obtenir(visuelId);
  const type = visuel?.famille === "infographie" ? "infographie" : "carrousel";
  const cles = (visuel?.rendu?.pages ?? []).slice(0, LIMITE_PAGES).map((p) => p.x1Cle);
  if (cles.length === 0) return { type, pages: [] };
  const stockage = await fournisseur("stockage");
  const signer = (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : stockage.urlLecture(cle));
  // Une page illisible n'empêche pas les autres.
  const signees = await Promise.all(cles.map((cle) => signer(cle).catch(() => "")));
  return { type, pages: signees.filter((a) => typeof a === "string" && ADRESSE_SURE.test(a)) };
}

const dateParis = (iso: string): string => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const f = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).formatToParts(d);
  const v = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `le ${v("day")}/${v("month")} à ${v("hour")}:${v("minute")}`;
};

interface MessageEnvoi {
  message?: string;
  aCompleter?: boolean;
}

/** Message d'envoi du créneau vivant d'un visuel sur un réseau : « à compléter » d'abord, sinon le dernier refus. Ne lève jamais. */
async function messageDuCreneau(lirePlan: () => Promise<CreneauEditorial[]>, visuelId: string, reseau: string): Promise<MessageEnvoi> {
  try {
    const plan = await lirePlan();
    const c = plan.find((x) => x.visuelId === visuelId && (x.statut === "valide" || x.statut === "programme") && !x.retireLe && !x.refuseLe && !!(x.heuresParReseau as Record<string, string | undefined>)[reseau]);
    if (!c) return {};
    const { etatEnvoiDuCreneau } = await import("@/services/branchement-envoi-calendrier");
    const e = await etatEnvoiDuCreneau(c, reseau as never);
    if (e.aCompleter) return { message: e.aCompleter, aCompleter: true };
    if (e.dernierRefus) {
      const quand = dateParis(e.dernierRefus.le);
      return { message: `Dernier envoi refusé${quand ? ` ${quand}` : ""} : ${e.dernierRefus.raison}` };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Durée visée de la vidéo de l'entrée (celle de sa commande), pour l'alerte de durée du réseau. Inconnue ou dépôt en échec :
 * l'entrée est rendue telle quelle, sans alerte.
 */
async function avecDuree(base: EntreeApercu, videoId: string): Promise<EntreeApercu> {
  try {
    const dureeSec = (await depots().videos.obtenir(videoId))?.dureeCibleSec;
    if (!base.media || typeof dureeSec !== "number" || !(dureeSec > 0)) return base;
    return { ...base, media: { ...base.media, dureeSec } };
  } catch {
    return base;
  }
}

/**
 * Entrées de la semaine avec leur média. Une publication de visuel devient un carrousel ou une infographie avec ses pages
 * signées (infographie : la page 1 est l'image). Ne lève jamais : une entrée dont le média échoue est rendue sans média,
 * calculée seule, et les autres gardent le leur. Aucun lien signé n'est journalisé.
 */
export async function entreesAvecMedias(semaine: PublicationApercu[]): Promise<EntreeApercu[]> {
  const memo = new Map<string, Promise<MediaVisuel>>();
  let planLu: Promise<CreneauEditorial[]> | undefined;
  const lirePlan = () => (planLu ??= depots().creneauxEditoriaux.lister());
  const messages = new Map<string, Promise<MessageEnvoi>>();
  // Pastille « Essai » : la seule entrée du créneau couvert par l'essai borné (lecture seule, ne lève jamais).
  // Import différé et protégé : lecture seule, jamais bloquant pour l'affichage.
  const essaiLu = await import("@/services/essai-zernio").then((m) => m.lireEssai()).then((e) => (e ? { id: e.creneauId, expire: Date.now() >= Date.parse(e.expireLe) } : undefined), () => undefined);
  const essaiId = essaiLu?.id;
  const entree = async (p: PublicationApercu): Promise<EntreeApercu> => {
    const sansPastille = entreeDepuisPublication(p);
    const cleFiche = essaiId ? lireCleFiche(sansPastille.cle) : null;
    const base: EntreeApercu = cleFiche?.origine === "creneau" && cleFiche.id === essaiId ? { ...sansPastille, essai: true, ...(essaiLu?.expire ? { essaiExpire: true } : {}) } : sansPastille;
    if (p.videoId) return avecDuree(base, p.videoId);
    if (!p.visuelId) return base;
    try {
      let attente = memo.get(p.visuelId);
      if (!attente) {
        attente = pagesDuVisuel(p.visuelId);
        memo.set(p.visuelId, attente);
      }
      const cleMsg = `${p.visuelId}|${p.reseau}`;
      let msg = messages.get(cleMsg);
      if (!msg) {
        msg = messageDuCreneau(lirePlan, p.visuelId, p.reseau);
        messages.set(cleMsg, msg);
      }
      const [{ type, pages }, envoi] = await Promise.all([attente, msg]);
      const premiere = pages[0] ?? null;
      return {
        ...base,
        ...(envoi.message ? { message: envoi.message } : {}),
        ...(envoi.aCompleter ? { texte: "" } : {}),
        type,
        media: type === "infographie" ? { genre: "image", url: premiere, pages } : { genre: "image", url: null, pages },
      };
    } catch {
      return base;
    }
  };
  // En parallèle, mais l'ordre de sortie reste celui de la semaine (les index sont alignés pour filtrerParTexte).
  return Promise.all(
    semaine.map(async (p) => {
      try {
        return await entree(p);
      } catch {
        return entreeDepuisPublication(p);
      }
    }),
  );
}
