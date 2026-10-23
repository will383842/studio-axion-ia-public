/**
 * SERVICE « EFFET RÉALISTE PAR IA » (lot K, décision de Will du 09/10). Serveur seulement.
 *
 * Will dit au monteur, APRÈS la génération, une action libre et réaliste (« rajoute au bon endroit un téléphone dans
 * ma main et jette-le sur l'écran »). Le monteur (UN appel Claude, ou la version simple) prépare l'effet : moment,
 * consigne vidéo en anglais, durée. Puis, AVANT toute dépense :
 *  - `carteEffet` : la carte de confirmation (brique J) dans le fil, avec l'APERÇU du moment choisi (image fixe de la
 *    prise à cet instant, phrase dite, « Changer de moment ») ; « Effet réaliste par IA — option payante, environ X €
 *    pris sur vos crédits Higgsfield. [Confirmer] [Annuler] » ;
 *  - `changerMomentEffet` : « plutôt à 0:42 » remplace la demande ouverte (rien n'a été dépensé) ;
 *  - `entreesAvecEffet` : à « Confirmer », l'effet et ses passages liés entrent dans la nouvelle version (l'ancienne
 *    reste visible pendant la fabrication ; « Prête vers 14 h 35 ») ;
 *  - `passeEffetsRealistesFacecam` : la fabrication dans la chaîne — jamais sans confirmation valide portée par la
 *    version (garde côté serveur du lot J au lancement Higgsfield) ; échec ou refus → repli gratuit (objet 3D si
 *    applicable, sinon rien) et « Effet non réussi — Réessayer ».
 * Le réel reste COUPÉ par défaut (`facecam.effetRealiste.reel` faux) : le double de simulation Higgsfield sert.
 */
import "server-only";
import {
  fabriquerEffetRealiste,
  formatInstant,
  momentImpose,
  REGLES_PRESERVATION,
  type EffetRealistePrepare,
  type MesuresEffet,
  type ResultatEffetRealiste,
} from "@/briques/effet-realiste";
import { instantDans, motCite } from "@/briques/monteur/ancrage";
import type { ApercuCarte, VueCarteConfirmation } from "@/briques/options-payantes/carte";
import { REPONSE_MONTEUR_PLAFOND } from "@/briques/options-payantes/monteur";
import { heurePrete } from "@/domaine/facecam-parcours";
import type { Id } from "@/domaine/types";
import { fournisseurFacecam } from "@/fournisseurs/facecam";
import type { FournisseurFacecam } from "@/fournisseurs/facecam/client";
import type { FournisseurHiggsfield, MediaAEnvoyer } from "@/fournisseurs/higgsfield";
import { nouvelId } from "@/lib/ids";
import { additionner } from "@/lib/montants";
import { preparerEffetRealiste, passageEffetRealiste, type EffetAConfirmer, type MotMonteur, type PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import type { FenetreDecor } from "@/moteurs/montage-facecam/chaine";
import { depots, ecrireParametre, fournisseur, horodatage, journaliser, lireParametre, maintenant } from "./_commun";

export const OPTION_EFFET = "effet-realiste-ia" as const;
/** Réglage caché : `{ reel: false }` par défaut (double de simulation, aucune dépense). */
export const PARAM_REGLAGE_EFFET = "facecam.effetRealiste";
/** Effets déjà fabriqués (et payés) d'une vidéo : repris tels quels par les versions suivantes, jamais repayés. */
export const PARAM_RESULTATS = (videoId: Id) => `facecam.effetsRealistes.${videoId}`;

export async function reglageEffetRealiste(): Promise<{ reel: boolean }> {
  const r = await lireParametre<{ reel?: unknown }>(PARAM_REGLAGE_EFFET, {});
  return { reel: r?.reel === true };
}

/* ------------------------------------------------------------------ */
/* Aperçu : image fixe du moment choisi (prise d'origine)              */
/* ------------------------------------------------------------------ */

/**
 * Image fixe de la PRISE à l'instant choisi (route `/image` du studio-aligneur, étape `images` existante). Le
 * studio-aligneur n'est pris que s'il est réel ; sinon (simulation, panne, délai) : pas d'image, la carte montre
 * l'instant et la phrase. Courte attente (25 s au plus) : la carte ne doit pas faire patienter Will.
 */
export async function imageDuMoment(
  o: { videoId: Id; priseCle?: string; priseSec: number },
  injecte: { facecam?: FournisseurFacecam; attendre?: (ms: number) => Promise<void>; delaiMs?: number } = {},
): Promise<string | undefined> {
  const facecam = injecte.facecam ?? fournisseurFacecam({ reel: true });
  if (facecam.mode !== "reel" || !o.priseCle) return undefined;
  try {
    const s = await fournisseur("stockage");
    if (!s.urlDepotDuree) return undefined;
    const lire = (cle: string) => (s.urlLectureDuree ? s.urlLectureDuree(cle, 3600) : s.urlLecture(cle));
    const cle = `facecam/${o.videoId}/apercus/effet-${Math.round(o.priseSec * 1000)}.jpg`;
    const idTravail = `${o.videoId}-apercu-${Math.round(o.priseSec * 1000)}`.replace(/[^A-Za-z0-9_-]/g, "-");
    const r = await facecam.soumettre("image", { idTravail, source: await lire(o.priseCle), depots: { apercu: await s.urlDepotDuree(cle, 600, "image/jpeg") }, parametres: { etape: "images", instants: [{ nom: "apercu", instantSec: o.priseSec }], largeur: 540, cles: { apercu: cle } } });
    if (r.statut === "echec") return undefined;
    const attendre = injecte.attendre ?? ((ms: number) => new Promise<void>((x) => setTimeout(x, ms)));
    const fin = Date.now() + (injecte.delaiMs ?? 25_000);
    while (Date.now() < fin) {
      const e = await facecam.suivre("image", idTravail);
      if (e.statut === "termine") return await lire(cle);
      if (e.statut === "echec") return undefined;
      await attendre(1500);
    }
  } catch {
    // L'aperçu est un confort : sans image, la carte montre l'instant et la phrase.
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Carte de confirmation (fil du monteur)                              */
/* ------------------------------------------------------------------ */

function apercuDe(e: EffetRealistePrepare, imageUrl?: string): ApercuCarte {
  return { instant: formatInstant(e.debutSec), instantSec: e.debutSec, phrase: e.phrase, description: e.description, ...(imageUrl ? { imageUrl } : {}) };
}

export function texteProposition(e: EffetRealistePrepare): string {
  return `Je propose de le faire à ${formatInstant(e.debutSec)} (${e.raisonMoment.charAt(0).toLowerCase()}${e.raisonMoment.slice(1)}). C'est une option payante : je la fais seulement si vous confirmez. Sinon, la vidéo reste dans sa version gratuite.`;
}

/**
 * Le monteur répond avec la carte (et l'aperçu). Rien n'est dépensé, aucune version ne part. Une demande d'effet
 * encore ouverte pour cette vidéo est remplacée (une seule carte d'effet à la fois).
 */
export async function carteEffet(o: { videoId: Id; versionId: Id; aConfirmer: EffetAConfirmer; message: string; priseCle?: string }): Promise<{ texte: string; confirmation?: VueCarteConfirmation }> {
  const { demanderOptionPayante } = await import("./options-payantes");
  const e = o.aConfirmer.effet;
  const details = { effet: e, passagesLies: o.aConfirmer.passagesLies, ...(o.aConfirmer.consigneId ? { consigneId: o.aConfirmer.consigneId } : {}) };
  const r = await demanderOptionPayante(OPTION_EFFET, { videoId: o.videoId, versionId: o.versionId, dureeSec: e.dureeSec, passagesSec: [e.dureeSec], modele: e.modele }, "monteur", o.message, { details, remplacerOuverte: true });
  if (r.statut !== "a-confirmer") return { texte: r.statut === "plafond" ? REPONSE_MONTEUR_PLAFOND : r.message };
  const imageUrl = await imageDuMoment({ videoId: o.videoId, ...(o.priseCle ? { priseCle: o.priseCle } : {}), priseSec: e.debutPriseSec + Math.min(1, e.dureeSec / 3) });
  return { texte: texteProposition(e), confirmation: { ...r.carte, apercu: apercuDe(e, imageUrl) } };
}

/* ------------------------------------------------------------------ */
/* « Changer de moment »                                               */
/* ------------------------------------------------------------------ */

/** « plutôt à 0:42 », « change de moment : quand je dis Certifexemple », « un peu plus tard, à 1:05 ». */
export function estChangementDeMoment(message: string): boolean {
  const t = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const demande = /\b(plutot|change[rz]? (de |le )?moment|autre moment|deplace|decale|un peu (plus tot|plus tard))\b/.test(t);
  // Vérif V1 : « déplace la carte des étapes à 0:45 » parle d'un AUTRE élément : c'est au monteur, pas à l'effet.
  const autreElement = /\b(carte|cartes|animation|animations|titre|zoom|zooms|liste|texte|sous ?titres?|ecran partage|generique|graphique|chiffre|coupe|passage)\b/.test(t) && !/\b(effet|telephone|objet|tasse|logo)\b/.test(t);
  return demande && !autreElement && (instantDans(message) !== null || !!motCite(message));
}

/**
 * Recale l'effet en attente sur le moment demandé par Will et remplace la carte (l'ancienne demande est annulée, rien
 * n'a été dépensé). Null : aucun effet en attente pour cette vidéo.
 */
export async function changerMomentEffet(o: {
  videoId: Id;
  versionId: Id;
  message: string;
  mots: MotMonteur[];
  dureePriseSec: number;
  passages: PassageMonteur[];
  versMontee: (s: number) => number;
  priseCle?: string;
}): Promise<{ texte: string; confirmation?: VueCarteConfirmation } | null> {
  const { demandeOuverte } = await import("./options-payantes");
  const ouverte = await demandeOuverte(OPTION_EFFET, o.videoId);
  const avant = (ouverte?.details as { effet?: EffetRealistePrepare } | undefined)?.effet;
  if (!ouverte || !avant) return null;
  const instant = instantDans(o.message);
  const cite = motCite(o.message);
  const motCiteIndex = cite ? o.mots.find((m) => m.monteeSec !== null && m.mot.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === cite.toLowerCase().split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, ""))?.index : undefined;
  const moment = momentImpose(o.mots, instant !== null ? { instantSec: instant } : { mot: motCiteIndex ?? avant.debutMot }, { dureeSec: avant.dureeSec, objet: avant.objet });
  if (!moment) return { texte: "Je ne trouve pas 3 s sans coupe à ce moment : dites-moi un autre instant." };
  const r = preparerEffetRealiste(
    {
      type: "effetRealisteIA",
      consigne: avant.consigne,
      ancre: instant !== null ? "instant" : "mot",
      debutMot: moment.debutMot,
      instantSec: instant,
      dureeSec: avant.dureeSec,
      consigneVideo: avant.consigneVideo.replace(REGLES_PRESERVATION, "").trim(),
      objet: avant.objet,
      imageReference: null,
      finitSurEcran: avant.finitSurEcran,
      sonSuggere: avant.sonSuggere ?? null,
      raisonMoment: "",
    },
    { mots: o.mots, dureePriseSec: o.dureePriseSec, origine: "demande", passages: o.passages, versMontee: o.versMontee, nouvelId },
  );
  if (!r.ok) return { texte: r.alertes[0] ?? "Je ne peux pas placer l'effet à ce moment : dites-moi un autre instant." };
  // L'image de référence choisie au départ est gardée (le modèle et le devis ne changent pas).
  const effet: EffetRealistePrepare = { ...r.aConfirmer.effet, modele: avant.modele, ...(avant.imageReferenceCle ? { imageReferenceCle: avant.imageReferenceCle } : {}) };
  return carteEffet({ videoId: o.videoId, versionId: o.versionId, aConfirmer: { ...r.aConfirmer, effet }, message: ouverte.message ?? avant.consigne, ...(o.priseCle ? { priseCle: o.priseCle } : {}) });
}

/* ------------------------------------------------------------------ */
/* « Confirmer » : l'effet entre dans la nouvelle version              */
/* ------------------------------------------------------------------ */

/** Entrées de la nouvelle version : le passage de l'effet et ses passages liés (vitre brisée si réussi, 3D si raté). */
export function entreesAvecEffet(entrees: Record<string, unknown>, details: Record<string, unknown> | undefined): Record<string, unknown> {
  const d = (details ?? {}) as { effet?: EffetRealistePrepare; passagesLies?: PassageMonteur[]; consigneId?: string };
  if (!d.effet || typeof d.effet.id !== "string") return entrees;
  const facecam = { ...((entrees.facecam ?? {}) as Record<string, unknown>) };
  const passages = (Array.isArray(facecam.passages) ? (facecam.passages as PassageMonteur[]) : []).filter((p) => p.id !== d.effet!.id && !(d.passagesLies ?? []).some((x) => x.id === p.id));
  facecam.passages = [...passages, passageEffetRealiste(d.effet, d.consigneId ? { consigneId: d.consigneId } : {}), ...(Array.isArray(d.passagesLies) ? d.passagesLies : [])];
  return { ...entrees, facecam };
}

export function reponseEffetConfirme(finEstimee: string | undefined): string {
  const pret = heurePrete(finEstimee);
  return `Merci, c'est confirmé : l'effet est en fabrication. La version actuelle reste visible en attendant${pret ? ` ; la nouvelle sera ${pret.charAt(0).toLowerCase()}${pret.slice(1)}` : ""}.`;
}

/* ------------------------------------------------------------------ */
/* Fabrication (chaîne face caméra)                                    */
/* ------------------------------------------------------------------ */

interface ResultatGarde {
  id: string;
  empreinte: string;
  resultat: ResultatEffetRealiste;
}

/** Ce qui identifie un effet déjà payé : même passage, même consigne, même cadre. */
export function empreinteEffet(e: EffetRealistePrepare, fenetre?: FenetreDecor): string {
  void fenetre; // la fenêtre est gardée avec le morceau (le cadrage la relit) : elle ne fait pas refaire l'effet
  return JSON.stringify([e.id, e.debutPriseSec, e.finPriseSec, e.consigneVideo, e.modele, e.imageReferenceCle ?? null]);
}

export interface DemandePasseEffets {
  videoId: Id;
  travailId: Id;
  effets: EffetRealistePrepare[];
  imageCle?: string;
  priseCle?: string;
  fenetre?: FenetreDecor;
  bandeX?: number;
  /** Décor IA appliqué sur cette version : l'effet n'est pas lancé (il ramènerait le vrai décor sur son passage). */
  decorApplique?: boolean;
  /** Injections pour les essais. */
  higgsfield?: FournisseurHiggsfield;
  passages?: {
    extrairePassage(p: { index: number; debutSec: number; finSec: number }): Promise<Uint8Array | null>;
    deposerPassage(p: { index: number; debutSec: number; finSec: number }, octets: Uint8Array, reglages: { conversion: unknown; fonduSec: number; accorderCouleurs: true }): Promise<string | null>;
    mesurer(p: { index: number; debutSec: number; finSec: number }, cle: string): Promise<MesuresEffet | null>;
  };
  lireImage?: (cle: string) => Promise<MediaAEnvoyer | null>;
}

const echec = (id: string, statut: "rate" | "non-lance", raison: Extract<ResultatEffetRealiste, { statut: "rate" | "non-lance" }>["raison"], message = "Effet non réussi — Réessayer"): ResultatEffetRealiste => ({ id, statut, raison, creditsDebites: 0, message });

/**
 * Fabrique les effets réalistes d'une version. Pour chacun : effet déjà payé (même empreinte) → repris ; version sans
 * accord → rien (repli, AUCUNE nouvelle demande : on ne relance pas de carte depuis la fabrication) ; sinon le
 * fournisseur Higgsfield GARDÉ (point d'entrée du lot J) et la brique. Ne lève jamais.
 */
export async function passeEffetsRealistesFacecam(d: DemandePasseEffets): Promise<ResultatEffetRealiste[]> {
  const { optionDemandeePourTravail } = await import("./options-payantes");
  const { higgsfieldPourOption } = await import("./options-payantes-higgsfield");
  const gardes = await lireParametre<ResultatGarde[]>(PARAM_RESULTATS(d.videoId), []);
  const reglage = await reglageEffetRealiste();
  const sortie: ResultatEffetRealiste[] = [];
  for (const e of d.effets) {
    const empreinte = empreinteEffet(e, d.fenetre);
    const deja = gardes.find((g) => g.id === e.id && g.empreinte === empreinte && g.resultat.statut === "reussi");
    if (deja) {
      sortie.push({ ...deja.resultat, creditsDebites: 0 });
      continue;
    }
    if (d.decorApplique) {
      sortie.push(echec(e.id, "non-lance", "decor-ia", "Effet non réussi — Réessayer (pas encore possible avec le Décor IA)"));
      continue;
    }
    if (!(await optionDemandeePourTravail(OPTION_EFFET, d.travailId).catch(() => false))) {
      sortie.push(echec(e.id, "non-lance", "non-confirme"));
      continue;
    }
    let higgsfield = d.higgsfield;
    if (!higgsfield) {
      const h = await higgsfieldPourOption(OPTION_EFFET, { travailId: d.travailId, reel: reglage.reel, dureeSec: e.dureeSec, passagesSec: [e.dureeSec], modele: e.modele });
      if (h.statut !== "pret") {
        sortie.push(echec(e.id, "non-lance", h.statut === "plafond" ? "plafond" : "non-confirme"));
        continue;
      }
      higgsfield = h.higgsfield;
    }
    const passages = d.passages ?? (await passagesAligneur(d));
    if (!passages) {
      sortie.push(echec(e.id, "non-lance", "extraction"));
      continue;
    }
    const fab = await fabriquerEffetRealiste(e, {
      higgsfield,
      extrairePassage: passages.extrairePassage,
      deposerPassage: passages.deposerPassage,
      mesurer: passages.mesurer,
      ...(e.imageReferenceCle ? { imageReference: async () => (d.lireImage ? d.lireImage(e.imageReferenceCle!) : lireImageR2(e.imageReferenceCle!)) } : {}),
    });
    if (fab.lignes.length) {
      const video = await depots().videos.obtenir(d.videoId);
      await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId: d.videoId, travailId: d.travailId, lignes: fab.lignes, total: additionner(...fab.lignes.map((l) => l.total)), date: maintenant(), ...horodatage(), estDemo: video?.estDemo });
    }
    // Vidéo supprimée définitivement pendant l'appel : la dépense est gardée (ci-dessus), rien d'autre n'est écrit.
    if (!(await depots().videos.obtenir(d.videoId))) return sortie;
    if (fab.resultat.statut !== "reussi") console.warn(`[effet-realiste] ${d.videoId} : ${fab.resultat.statut} (${fab.resultat.raison})`);
    await journaliser("fabrication", fab.resultat.statut === "reussi" ? "Effet réaliste par IA ajouté." : "Effet réaliste non réussi : la version gratuite est livrée.", { type: "video", id: d.videoId });
    const resultat: ResultatEffetRealiste = fab.resultat.statut === "reussi" && d.fenetre ? { ...fab.resultat, morceau: { ...fab.resultat.morceau, fenetre: d.fenetre } } : fab.resultat;
    sortie.push(resultat);
    // Réussi : repris par les versions suivantes. Raté : gardé pour « Effet non réussi — Réessayer » sur Votre vidéo.
    gardes.push({ id: e.id, empreinte, resultat });
  }
  await ecrireParametre(PARAM_RESULTATS(d.videoId), gardes.slice(-20));
  return sortie;
}

/** Effets réalistes dont le dernier essai a raté (« Effet non réussi — Réessayer » sur Votre vidéo). */
export async function effetsRealistesRates(videoId: Id): Promise<Set<string>> {
  const gardes = await lireParametre<ResultatGarde[]>(PARAM_RESULTATS(videoId), []);
  const dernier = new Map<string, ResultatEffetRealiste["statut"]>();
  for (const g of gardes) dernier.set(g.id, g.resultat.statut);
  return new Set([...dernier].filter(([, statut]) => statut === "rate").map(([id]) => id));
}

/**
 * « Réessayer » un effet réaliste raté : une NOUVELLE confirmation est demandée (l'essai précédent a peut-être été
 * débité) ; la carte part dans le fil, rien n'est relancé sans « Confirmer ».
 */
export async function reessayerEffetRealiste(o: { videoId: Id; versionId: Id; passages: PassageMonteur[]; passageId: string; priseCle?: string }): Promise<{ texte: string; confirmation?: VueCarteConfirmation } | null> {
  const p = o.passages.find((x) => x.id === o.passageId);
  const { effetDuPassage } = await import("@/moteurs/montage-facecam/monteur");
  const effet = p ? effetDuPassage(p) : null;
  if (!effet) return null;
  const passagesLies = o.passages.filter((x) => (x as { conditionEffetRealiste?: { effetId?: string } }).conditionEffetRealiste?.effetId === effet.id);
  return carteEffet({ videoId: o.videoId, versionId: o.versionId, aConfirmer: { effet, passagesLies }, message: effet.consigne, ...(o.priseCle ? { priseCle: o.priseCle } : {}) });
}

/** Extraire / reposer (25 i/s, couleurs accordées, fondu) / mesurer, par le studio-aligneur (routes du lot G). */
async function passagesAligneur(d: DemandePasseEffets): Promise<NonNullable<DemandePasseEffets["passages"]> | null> {
  if (!d.imageCle || !d.priseCle || !d.fenetre) return null;
  const { passagesDecorAligneur } = await import("./decor-passages");
  const p = passagesDecorAligneur({ videoId: d.videoId, travailId: `${d.travailId}-effet`, imageCle: d.imageCle, priseCle: d.priseCle, fenetre: d.fenetre, bandeX: d.bandeX ?? 0 });
  const decor = (x: { index: number; debutSec: number; finSec: number }) => ({ ...x, dureeSec: +(x.finSec - x.debutSec).toFixed(3), coupeForcee: false });
  return {
    extrairePassage: (x) => p.extrairePassage(decor(x)),
    deposerPassage: (x, octets, r) => p.deposerPassage(decor(x), octets, r.conversion as Parameters<typeof p.deposerPassage>[2], { fonduSec: r.fonduSec, accorderCouleurs: r.accorderCouleurs }),
    mesurer: (x, cle) => p.mesurer(decor(x), cle),
  };
}

async function lireImageR2(cle: string): Promise<MediaAEnvoyer | null> {
  try {
    const s = await fournisseur("stockage");
    const url = s.urlLectureDuree ? await s.urlLectureDuree(cle, 600) : await s.urlLecture(cle);
    if (!/^https?:\/\//.test(url)) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    return { nom: cle.split("/").pop() ?? "reference.png", type: cle.endsWith(".png") ? "image/png" : cle.endsWith(".webp") ? "image/webp" : "image/jpeg", octets: new Uint8Array(await r.arrayBuffer()) };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Image de référence (Mes images)                                     */
/* ------------------------------------------------------------------ */

/**
 * « logo-axion » ou identifiant d'une image de « Mes images » → clé R2. Seules les images VÉRIFIÉES (« prête ») partent,
 * et leur copie floutée quand elle existe (l'image quitte le studio). Rien trouvé : pas d'image (FLUX 3 Video Edit).
 */
export async function resolveurImagesReference(): Promise<(ref: string) => string | undefined> {
  try {
    const d = depots();
    const elements = await d.elements.lister((e) => e.type === "illustration-image" && !e.archiveLe && e.confidentialite?.statut === "prete");
    const cles = new Map<string, string>();
    for (const e of elements) {
      const id = e.confidentialite?.fichierFlouteId ?? e.fichierId;
      const f = id ? await d.fichiers.obtenir(id) : null;
      if (f?.cleStockage) cles.set(e.id, f.cleStockage);
    }
    return (ref) => {
      if (ref === "logo-axion") {
        const logo = elements.find((e) => /logo/i.test(e.nom ?? "") && /axion/i.test(`${e.nom ?? ""} ${(e.motsCles ?? []).join(" ")}`));
        return logo ? cles.get(logo.id) : undefined;
      }
      return cles.get(ref);
    };
  } catch {
    return () => undefined;
  }
}
