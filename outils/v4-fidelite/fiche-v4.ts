/**
 * FICHE ÉQUIVALENTE À LA V4 (banc de fidélité, tâche V4-1) : la vidéo de référence `docs/formats/v4-reference/v4.mp4`
 * écrite en fiche d'écrans du format « Cas concret », pour la rendre avec le MOTEUR du format à partir du MÊME texte
 * (`voix4.json`, mot pour mot) et des MÊMES heures de mots (divisées par le tempo 1,08 de `v4.html`).
 *
 * Chaque écran reprend un plan de `v4.html` (`PLANS`) : même mot de départ, même avance, mêmes textes affichés, mêmes
 * mots-repères des animations. V4-3 : le plan « avant » (s4, 9,2 s, six tâches) est un seul écran `liste-avant`, comme
 * la v4 (V4-1 et V4-2 le coupaient en deux écrans de quatre tâches au plus).
 *
 * La fin (« Écrivez PLAN en commentaire. On vous envoie le plan de cette machine. ») n'est dans aucune table de fins
 * d'aujourd'hui : elle est écrite ici à la main, pour le banc seulement (rien n'est branché).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { proprietesEcrans, type CaptureEcran, type ProprietesEcran, type ZoneProtegeePct } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET, FIN_APRES_DERNIER_MOT_SEC, TEMPO_VOIX } from "@/formats/cas-concret";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { calerFiche } from "@/moteurs/montage-cas-concret/calage";
import { ecransCales } from "@/moteurs/montage-cas-concret/etapes";
import { VERSION_FICHE_ECRANS, idEcranAttendu, type EcranCorps, type EcranFin, type FicheEcrans, type FinPlanifiee } from "@/moteurs/montage-cas-concret/fiche";
import { clesImagesDuCas, imagesDuCas } from "@/moteurs/montage-cas-concret/visuels-du-cas";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { dessinAuDessusDesSousTitres, proprietesPleineImage } from "@/moteurs/montage-cas-concret/zone-objets";

export const DOSSIER_V4 = "docs/formats/v4-reference";

/**
 * Les écrans du corps : le SCRIPT VALIDÉ du cas (V4-3, `scripts-valides/recrutement-apporteurs.ts`), un écran par plan de
 * `v4.html` (ligne `PLANS` et blocs `s1` à `s18`) : le banc mesure exactement ce que la fabrication rejoue.
 */
const PLANS_CORPS = ["s1", "s2", "s4", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14", "s16", "s17", "s18"];
/**
 * 18/10 : le script validé du catalogue a une accroche plus récente que la v4 (« Nos collaborateurs, on les recrute en… »,
 * validée par Will le 18/10). Le banc rejoue l'AUDIO de la v4 (`voix4.json`), qui dit encore « On recrute nos
 * collaborateurs en » : son premier écran garde donc l'accroche d'origine, pour que le calage mesure la v4 elle-même.
 */
export const ACCROCHE_V4_ORIGINE = {
  type: "accroche",
  fond: "sombre",
  texteDit: "On recrute nos collaborateurs en",
  avanceMs: 0,
  etiquette: "Recrutement · cas réel",
  lignes: ["On recrute", "nos collaborateurs", "*en…*"],
  motOrange: "en…",
  evenements: [{ cible: "titre-2", surMot: 3, avanceMs: 0 }, { cible: "titre-3", surMot: 4, avanceMs: 0 }],
} as const satisfies (typeof SCRIPT_V4_RECRUTEMENT.ecrans)[number];
const CORPS = SCRIPT_V4_RECRUTEMENT.ecrans.map((e, i) => ({ ...(i === 0 ? structuredClone(ACCROCHE_V4_ORIGINE) : e), plan: PLANS_CORPS[i] }));

/** La fin de la v4 (plans s19 et s20), écrite à la main pour le banc. */
type FinV4 = EcranFin extends infer E ? (E extends unknown ? Omit<E, "marque"> & { plan: string } : never) : never;
const FIN: FinV4[] = [
  { plan: "s19", id: "f01", type: "appel-mot", fond: "ivoire", fins: ["v4-plan"], texteDit: "Écrivez PLAN en commentaire. On vous", avanceMs: 100, mot: "PLAN", evenements: [{ cible: "mot", surMot: 1, avanceMs: 0 }, { cible: "suite", surMot: 3, avanceMs: 0 }] },
  { plan: "s20", id: "f02", type: "promesse", fond: "sombre", fins: ["v4-plan"], texteDit: "envoie le plan de cette machine.", avanceMs: 320, cadeau: "On vous envoie le plan de cette machine", ligne: "en message privé", evenements: [{ cible: "cadeau", surMot: 2, avanceMs: 0 }, { cible: "ligne", surMot: 5, avanceMs: 300 }] },
];

/** Plan de la v4 reproduit par chaque écran (« e01 » → « s1 »…). */
export function plansDesEcrans(): Record<string, string> {
  return Object.fromEntries([...CORPS.map((e, i) => [idEcranAttendu(i), e.plan]), ...FIN.map((e) => [e.id, e.plan])]);
}

/** L'écran sans le plan de la v4 qu'il reproduit (le schéma de la fiche est exact). */
function sansPlan<T extends { plan: string }>(x: T): Omit<T, "plan"> {
  const copie: Partial<T> = { ...x };
  delete copie.plan;
  return copie as Omit<T, "plan">;
}

export function ficheV4(): FicheEcrans {
  return {
    version: VERSION_FICHE_ECRANS,
    formatId: "cas-concret",
    videoId: "video-v4",
    versionId: "version-v4",
    habillage: "charte-duo/1",
    ratio: "9:16",
    offre: "integration",
    origine: "porte-a",
    posture: "chez-nous",
    casId: recrutementApporteurs.id,
    empreinteCas: "cas-v4-0001",
    ecrans: CORPS.map((x, i) => ({ ...sansPlan(x), id: idEcranAttendu(i), marque: "axion-ia.com" }) as EcranCorps),
  };
}

export function finV4(): FinPlanifiee {
  return { id: "fin-v4", reseaux: ["facebook"], appels: [], ecrans: FIN.map((x) => ({ ...sansPlan(x), marque: "axion-ia.com" }) as EcranFin) };
}

/** Mots de `voix4.json`, au tempo du format (le même que celui de `v4.html` : 1,08). */
export function motsV4(racine: string): { mot: string; debutSec: number; finSec: number }[] {
  const voix = JSON.parse(readFileSync(join(racine, DOSSIER_V4, "voix4.json"), "utf8")) as { mots: { word: string; start: number; end: number }[] };
  return voix.mots.map((m) => ({ mot: m.word, debutSec: m.start / TEMPO_VOIX, finSec: m.end / TEMPO_VOIX }));
}

/** Film du formulaire : les 29 images de `rushes/form/`, tapées en 1,2 s comme dans la v4. */
export const FILM_FORMULAIRE_V4 = Object.freeze({ images: 29, ips: 24, fichier: "formulaire-v4.mp4" });

/** Vrais écrans de la fiche (formulaire, page du rendez-vous) par clé de capture, et la clé de capture de chaque écran. */
export function capturesV4(src: (fichier: string) => string) {
  const captures: Record<string, CaptureEcran & { departY?: number }> = {
    formulaire: { src: src(FILM_FORMULAIRE_V4.fichier), cle: "formulaire", sorte: "video", largeur: 1080, hauteur: 1920, dureeSec: FILM_FORMULAIRE_V4.images / FILM_FORMULAIRE_V4.ips },
    "rendez-vous": { src: src("rdv-entier.jpg"), cle: "rendez-vous", sorte: "page-entiere", largeur: 1080, hauteur: 3276, departY: 0.27 },
  };
  const parEcran: Record<string, { cle: string }> = { e06: { cle: "formulaire" }, e08: { cle: "rendez-vous" } };
  return { captures, parEcran };
}

/** Fichier servi au rendu pour l'image d'annonce du cas (`rushes/pub.png`, la même que la v4). */
export const FICHIER_ANNONCE = "pub.png";

/**
 * Propriétés des écrans de la v4 rendues par la chaîne du format : calage sur les mots de `voix4.json`, images du cas
 * (`imagesDuCas`, étape 3 de la chaîne ; `contenuEcran` pose l'image dans le téléphone), écrans calés (`ecransCales`), propriétés de la brique, objets au-dessus des
 * sous-titres (`dessinAuDessusDesSousTitres`). `imageDeposee` : l'image d'annonce du cas est dans le stockage (après
 * la mission B) ; faux : le téléphone prend son repli. `avantCorrection` : la chaîne d'avant la mission B (aucune image
 * cherchée : le téléphone de l'annonce reste vide). `pleineImage` (V4-2, mission D) : les écrans du format tels que la
 * chaîne les pose désormais (`proprietesPleineImage` : zone pleine image, fil à 92 %) ; `zone` est alors ignorée.
 */
export function proprietesV4(racine: string, zone: ZoneProtegeePct, src: (fichier: string) => string, options: { avantCorrection: boolean; imageDeposee?: boolean; pleineImage?: boolean }): ProprietesEcran[] {
  const calage = calerFiche(ficheV4(), finV4(), motsV4(racine), { finApresDernierMotSec: FIN_APRES_DERNIER_MOT_SEC });
  if (!calage.ok) throw new Error(`Le calage de la fiche v4 échoue :\n${calage.problemes.join("\n")}`);
  const { captures, parEcran } = capturesV4(src);
  let corps = calage.fiche;
  if (!options.avantCorrection) {
    const deposees = new Set(options.imageDeposee === false ? [] : clesImagesDuCas(recrutementApporteurs));
    const images = imagesDuCas(corps, recrutementApporteurs, deposees);
    corps = images.fiche;
    for (const [id, c] of Object.entries(images.captures)) {
      parEcran[id] = { cle: c.cle };
      captures[c.cle] = { ...c, src: src(FICHIER_ANNONCE) };
    }
  }
  const fin = calage.fin!;
  const cales = [...ecransCales(corps.ecrans, calage.evenements, null, parEcran, recrutementApporteurs.faits), ...ecransCales(fin.ecrans, calage.evenements, fin, {})];
  if (options.pleineImage) return proprietesPleineImage({ ecrans: cales, captures });
  return dessinAuDessusDesSousTitres(proprietesEcrans({ ecrans: cales, captures, zoneProtegee: zone, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET }));
}
