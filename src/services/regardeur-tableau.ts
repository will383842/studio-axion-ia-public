/**
 * TABLEAU — RELECTEUR « Claude regarde la vidéo finie » (S-10-v19b). Fichier neuf, SANS appelant : rien ne le charge,
 * aucune vidéo ne coûte un centime de plus. Le branchement (`fabriquer.ts`) et l'allumage (réglage) viennent dans
 * d'autres fiches ; ici, AUCUNE lecture de réglage.
 *
 * Ordre : 1. instants à regarder ; 2. mémo (jamais repayé) ; 3. extraction des images par l'aligneur (route « image ») ;
 * 4. UN appel à Claude par le chemin de dépense existant (réservé au pire, plafond de la vidéo, pas de plafond propre) ;
 * 5. le CODE juge, la lecture est rangée dans le mémo AVANT de rendre.
 *
 * Une panne (extraction, Claude, stockage) donne une remarque « images non relues », jamais « rien à signaler », et ne
 * lève jamais. Aucune clé de stockage ni nom de fichier ne part vers Claude.
 */
import "server-only";
import { createHash } from "node:crypto";
import { imagesPourClaude, jugerRegard, LARGEUR_IMAGES_REGARD, roleRegard, schemaLectureRegard, variableRegard, type InstantRegard, type LectureRegard } from "@/briques/regardeur";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import type { MiseEnPageTableau } from "@/moteurs/montage-tableau/mise-en-page";
import type { RelectureImagesCles } from "@/moteurs/montage-tableau/controles";
import { instantsTableau, relectureDuVerdict, textesPermisTableau } from "@/moteurs/montage-tableau/regard-tableau";
import type { OrigineLancement } from "./budget-mensuel";

export type RelecteurTableau = (fiche: FicheTableau, miseEnPage: MiseEnPageTableau, video: { cle: string; dureeSec: number; attendre?: () => Promise<void> }) => Promise<RelectureImagesCles>;

export interface DependancesRelecteurTableau {
  videoId: string;
  env: string;
  origine?: OrigineLancement;
  fin?: { ecran: string };
}

export type EntreeRegardTableau = { contexte: Record<string, never>; variable: string; images: ReturnType<typeof imagesPourClaude> };

/** Les trois prises sur le monde extérieur, remplaçables pour les tests. */
export interface PortsRegardTableau {
  lireMemo(cle: string): Promise<string | null>;
  ecrireMemo(cle: string, texte: string): Promise<void>;
  /** `en-cours` : le travail n'est pas fini (reprise au tour suivant). Un échec LÈVE. */
  extraire(d: { idTravail: string; source: string; instants: { nom: string; instantSec: number }[]; largeur: number; cles: Record<string, string> }): Promise<{ statut: "fini"; images: { nom: string; cle: string }[] } | { statut: "en-cours" }>;
  lireImage(cle: string): Promise<{ octets: Uint8Array; type: "image/jpeg" | "image/png" } | null>;
  /** Un seul appel à Claude, par le chemin de dépense de la vidéo. */
  appeler(entree: EntreeRegardTableau, options: { etape: string; origine?: OrigineLancement }): Promise<{ ok: boolean; simule?: boolean; donnees?: unknown }>;
}

const ETAPE = "Tableau · regard de la vidéo finie";
const nonRelue = (instants: InstantRegard[], fiche: FicheTableau, dep: DependancesRelecteurTableau): RelectureImagesCles =>
  relectureDuVerdict(jugerRegard({ instants, lecture: null, textesPermis: textesPermisTableau(fiche, dep.fin) }));
const echecExtraction: RelectureImagesCles = { imagesLues: 0, remarques: [{ image: 1, raison: "Images de la vidéo non relues : l'extraction n'a pas abouti." }] };
const sha = (x: unknown, n: number) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, n);

/** Les vrais modules, chargés seulement au moment de l'appel (rien n'est chargé tant que personne n'appelle). */
async function portsParDefaut(dep: DependancesRelecteurTableau, videoId: string): Promise<PortsRegardTableau> {
  const [{ resoudreFournisseur }, { fournisseurFacecam }, { lireOctets }, { executerRolePourVideo }] = await Promise.all([
    import("@/fournisseurs"),
    import("@/fournisseurs/facecam"),
    import("./image-video"),
    import("./depense-claude-video"),
  ]);
  const stockage = resoudreFournisseur("stockage") as import("@/fournisseurs/types").StockageFichiers;
  const signerLecture = async (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, 3600) : stockage.urlLecture(cle));
  const signerDepot = async (cle: string, mime: string) => {
    if (stockage.urlDepotDuree) return stockage.urlDepotDuree(cle, 3600, mime);
    throw new Error("Stockage non relié.");
  };
  const facecam = fournisseurFacecam({ reel: true });
  return {
    lireMemo: async (cle) => {
      if (stockage.mode === "simulation") return null;
      const o = await lireOctets(await signerLecture(cle), 1024 * 1024);
      return o ? new TextDecoder().decode(o) : null;
    },
    ecrireMemo: async (cle, texte) => {
      if (stockage.mode === "simulation") return;
      const r = await fetch(await signerDepot(cle, "application/json"), { method: "PUT", body: texte, headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`dépôt refusé (${r.status})`);
    },
    extraire: async (d) => {
      // Un seul passage (comme les autres formats) : soumis s'il est inconnu, relu une fois ; pas fini → attente.
      let e = await facecam.suivre("image", d.idTravail);
      if (e.statut === "echec" && e.erreur.travailInconnu) {
        const depots = Object.fromEntries(await Promise.all(Object.entries(d.cles).map(async ([nom, cle]) => [nom, await signerDepot(cle, "image/jpeg")] as const)));
        e = await facecam.soumettre("image", { idTravail: d.idTravail, source: await signerLecture(d.source), depots, parametres: { etape: "images", instants: d.instants, largeur: d.largeur, cles: d.cles } });
      }
      if (e.statut === "en_file" || e.statut === "en_cours") return { statut: "en-cours" };
      if (e.statut === "echec") throw new Error(e.erreur.message);
      // Seules les images réellement listées par l'aligneur, et dont la clé est bien l'une des nôtres.
      const liste = (e.resultat as unknown as { images?: unknown } | null)?.images;
      const images = (Array.isArray(liste) ? liste : []).flatMap((x: { nom?: unknown; cle?: unknown } | null) => (typeof x?.nom === "string" && typeof x.cle === "string" && d.cles[x.nom] === x.cle ? [{ nom: x.nom, cle: x.cle }] : []));
      return { statut: "fini", images };
    },
    lireImage: async (cle) => {
      if (stockage.mode === "simulation") return null;
      const octets = await lireOctets(await signerLecture(cle));
      return octets ? { octets, type: octets[0] === 0x89 ? "image/png" : "image/jpeg" } : null;
    },
    appeler: (entree, options) => executerRolePourVideo(videoId, roleRegard, entree, { etape: options.etape, ...(options.origine ? { origine: options.origine } : {}) }),
  };
}

export function relecteurTableau(dep: DependancesRelecteurTableau, ports?: PortsRegardTableau): RelecteurTableau {
  return async (fiche, _miseEnPage, video) => {
    let instants: InstantRegard[] = [];
    try {
      instants = instantsTableau(fiche, video.dureeSec);
      if (instants.length === 0) return { imagesLues: 0, remarques: [{ image: 1, raison: "Images de la vidéo non relues : aucun instant à regarder." }] };
      const p = ports ?? (await portsParDefaut(dep, dep.videoId));
      const juger = (lecture: LectureRegard | null) => relectureDuVerdict(jugerRegard({ instants, lecture, textesPermis: textesPermisTableau(fiche, dep.fin), ...(dep.fin ? { fin: { texte: dep.fin.ecran } } : {}) }));

      // 2. Mémo : une lecture déjà payée n'est jamais repayée (le contrôle est refait à chaque tour).
      const cleMemo = `studio/${dep.env}/tableau/${dep.videoId}/regard/${sha([video.cle, instants.map((i) => [i.nom, i.instantSec])], 16)}.json`;
      try {
        const memo = await p.lireMemo(cleMemo);
        if (memo) {
          const lue = schemaLectureRegard.safeParse(JSON.parse(memo));
          if (lue.success) return juger(lue.data);
        }
      } catch {
        // mémo illisible : on relit, sans arrêter
      }

      // 3. Extraction des images (aligneur, route « image »).
      const demande = instants.map((i) => ({ nom: i.nom, instantSec: i.instantSec }));
      const dossier = `studio/${dep.env}/tableau/${dep.videoId}/regard/images-${sha([video.cle, demande, LARGEUR_IMAGES_REGARD], 16)}`;
      const cles = Object.fromEntries(demande.map((i) => [i.nom, `${dossier}/${i.nom}.jpg`]));
      let extraites: { nom: string; cle: string }[];
      try {
        const e = await p.extraire({ idTravail: `tableau-regard-${sha([dep.videoId, video.cle, demande, LARGEUR_IMAGES_REGARD], 40)}`, source: video.cle, instants: demande, largeur: LARGEUR_IMAGES_REGARD, cles });
        if (e.statut === "en-cours") {
          await video.attendre?.().catch(() => undefined);
          return nonRelue(instants, fiche, dep);
        }
        extraites = e.images;
      } catch {
        return echecExtraction;
      }
      const lues: { nom: string; type: "image/jpeg" | "image/png"; base64: string }[] = [];
      for (const i of instants) {
        const x = extraites.find((y) => y.nom === i.nom);
        const img = x ? await p.lireImage(x.cle).catch(() => null) : null;
        if (img) lues.push({ nom: i.nom, type: img.type, base64: Buffer.from(img.octets).toString("base64") });
      }
      if (lues.length === 0) return echecExtraction;

      // 4. Un seul appel à Claude : le plafond de la vidéo et la réservation au pire sont ceux du chemin existant.
      let r: Awaited<ReturnType<PortsRegardTableau["appeler"]>>;
      try {
        r = await p.appeler({ contexte: {}, variable: variableRegard(instants.filter((i) => lues.some((l) => l.nom === i.nom))), images: imagesPourClaude(lues) }, { etape: ETAPE, ...(dep.origine ? { origine: dep.origine } : {}) });
      } catch {
        return nonRelue(instants, fiche, dep);
      }
      if (!r.ok || r.simule) return nonRelue(instants, fiche, dep);
      const lecture = schemaLectureRegard.safeParse(r.donnees);
      if (!lecture.success) return nonRelue(instants, fiche, dep);

      // 5. La lecture est rangée AVANT de rendre ; un stockage en panne ne change pas le verdict.
      await p.ecrireMemo(cleMemo, JSON.stringify(lecture.data)).catch(() => undefined);
      return juger(lecture.data);
    } catch {
      return instants.length > 0 ? nonRelue(instants, fiche, dep) : { imagesLues: 0, remarques: [{ image: 1, raison: "Images de la vidéo non relues." }] };
    }
  };
}
