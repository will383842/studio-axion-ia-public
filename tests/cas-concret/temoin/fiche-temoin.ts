/**
 * FICHE TÉMOIN DE LA VIDÉO 1 (tâche T1, plan cas concret § 6) : la vidéo validée par Will, écrite à la main en fiche d'écrans.
 *
 * Les textes dits sont ceux de `reference/texte.txt`, MOT POUR MOT (167 mots). Les écrans sont ceux de `reference/plans.json`
 * (mêmes débuts, mêmes fonds), à une différence voulue par Will : aucun écran de plus de 5 s, donc le plan « avant » (9,2 s)
 * est coupé en deux écrans. La fin est la fin Facebook d'aujourd'hui (X6 : le diagnostic, puis le lien en commentaire), tirée
 * de la table des fins : jamais écrite ici.
 *
 * Aucune taille en pixels n'est écrite ici : la géométrie vient de la brique `ecrans-motion`. Les vrais écrans
 * (publicité, formulaire, rendez-vous) sont les fichiers de `reference/rushes/` (T1b).
 */
import { proprietesEcrans, type CaptureEcran, type ContenuEcran, type EcranCale, type ProprietesEcran, type VisuelCale, type ZoneProtegeePct } from "@/briques/ecrans-motion";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { BANDE_SOUS_TITRES_CAS_CONCRET } from "@/formats/cas-concret";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import type { EvenementCale } from "@/moteurs/montage-cas-concret/calage";
import { avecPointFinal, departDePage, texteBarre, type CaptureVraiEcran } from "@/moteurs/montage-cas-concret/etapes";
import { VERSION_FICHE_ECRANS, idEcranAttendu, texteDuCorps, type Ecran, type EcranCorps, type FicheEcrans, type FinPlanifiee } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";

/**
 * Les noms des événements (`cible`) sont ceux que lisent les compositions : `titre-<n>` (lignes d'affiche), `tache-<n>`,
 * `total`, `pastille-<n>`, `puce-<n>`, `notification`, `chrono`, `barre-maintenant`, `question`.
 * Avance de chaque écran sur son premier mot (plans.json / v8-a.html, ligne `PLANS`), en millisecondes. */
type SansCommun<T> = T extends unknown ? Omit<T, "id" | "marque" | "evenements"> & { evenements?: EcranCorps["evenements"] } : never;

const e = (suite: SansCommun<EcranCorps>[]): SansCommun<EcranCorps>[] => suite;

/** Les 17 écrans du corps : 16 plans de la référence (s1 à s18), dont le plan « avant » coupé en deux. */
const CORPS = e([
  // s1 · accroche
  {
    type: "accroche",
    fond: "sombre",
    texteDit: "On recrute nos collaborateurs en",
    avanceMs: 0,
    etiquette: "Recrutement · cas réel",
    lignes: ["On recrute", "nos collaborateurs", "*en…*"],
    motOrange: "en…",
    evenements: [{ cible: "titre-3", surMot: 4, avanceMs: 0 }],
  },
  // s2 · le chiffre
  {
    type: "chiffre",
    fond: "sombre",
    texteDit: "quinze minutes. Oui, quinze minutes.",
    avanceMs: 80,
    valeur: 15,
    unite: "minutes",
    faitId: "visio-quinze-minutes",
    pastilles: ["0 CV à trier", "0 relance", "0 papier"],
    variante: "simple",
    evenements: [
      { cible: "pastille-1", surMot: 2, avanceMs: 0 },
      { cible: "pastille-2", surMot: 3, avanceMs: 0 },
      { cible: "pastille-3", surMot: 4, avanceMs: 0 },
    ],
  },
  // s4 · le problème, première moitié
  {
    type: "liste-avant",
    fond: "ivoire",
    texteDit: "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous,",
    avanceMs: 100,
    taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"],
    evenements: [
      { cible: "tache-1", surMot: 3, avanceMs: 0 },
      { cible: "tache-2", surMot: 6, avanceMs: 0 },
      { cible: "tache-3", surMot: 9, avanceMs: 0 },
      { cible: "tache-4", surMot: 10, avanceMs: 0 },
    ],
  },
  // s4 · le problème, seconde moitié (la coupe voulue par Will)
  {
    type: "liste-avant",
    fond: "ivoire",
    texteDit: "envoyer le contrat, courir après la signature. Plus d'une heure, pour chaque personne.",
    avanceMs: 350,
    taches: ["Envoyer le contrat", "Courir après la signature"],
    total: "Plus d'une heure par personne",
    evenements: [
      { cible: "tache-1", surMot: 0, avanceMs: 0 },
      { cible: "tache-2", surMot: 3, avanceMs: 0 },
      { cible: "total", surMot: 7, avanceMs: 0 },
    ],
  },
  // s6 · la bascule
  {
    type: "titre",
    fond: "sombre",
    texteDit: "Alors on a tout automatisé. La personne",
    avanceMs: 100,
    lignes: ["Alors on a", "tout *automatisé.*"],
    orange: ["automatisé."],
    evenements: [{ cible: "titre-2", surMot: 3, avanceMs: 0 }],
  },
  // s7 · étape 1
  {
    type: "etape",
    fond: "ivoire",
    texteDit: "voit notre annonce. Elle",
    avanceMs: 450,
    numero: 1,
    total: 6,
    titre: "*L'annonce*",
    ligne: "Elle la voit sur Facebook.",
    visuel: { sorte: "objet", objet: "telephone-capture" },
    puces: [],
  },
  // s8 · étape 2 (vrai écran de l'inscription)
  {
    type: "etape",
    fond: "ivoire",
    texteDit: "s'inscrit toute seule, en vingt secondes. Elle",
    avanceMs: 250,
    numero: 2,
    total: 6,
    titre: "*L'inscription*",
    ligne: "Toute seule. En vingt secondes.",
    visuel: { sorte: "ecran", etapeCas: 2, repli: "telephone-notification" },
    puces: ["Inscrite"],
    evenements: [{ cible: "puce-1", surMot: 5, avanceMs: 0 }],
  },
  // s9 · étape 3
  {
    type: "etape",
    fond: "sombre",
    texteDit: "reçoit ses e-mails toute seule. Elle",
    avanceMs: 250,
    numero: 3,
    total: 6,
    titre: "Les *e-mails*",
    ligne: "Ils partent tout seuls.",
    visuel: { sorte: "objet", objet: "pile-notifications" },
    puces: [],
  },
  // s10 · étape 4 (vrai écran du rendez-vous)
  {
    type: "etape",
    fond: "ivoire",
    texteDit: "choisit elle-même son rendez-vous. Et si elle",
    avanceMs: 250,
    numero: 4,
    total: 6,
    titre: "Le *rendez-vous*",
    ligne: "Elle le choisit elle-même.",
    // La page est longue : elle part du calendrier (« Choisissez un jour », vers 1 500 px sur 3 276), comme la référence.
    visuel: { sorte: "ecran", etapeCas: 4, repli: "calendrier", departPage: 0.46 },
    puces: ["Réservé sans nous"],
    evenements: [{ cible: "puce-1", surMot: 3, avanceMs: 0 }],
  },
  // s11 · le rappel
  {
    type: "objet",
    fond: "sombre",
    texteDit: "oublie, le rappel part tout seul.",
    avanceMs: 480,
    titre: "Elle *oublie ?*",
    ligne: "Le rappel part tout seul.",
    visuel: { sorte: "objet", objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] },
    // La notification tombe sur « rappel » (référence, `s11`).
    evenements: [{ cible: "notification", surMot: 2, avanceMs: 0 }],
  },
  // s12 · étape 5
  {
    type: "etape",
    fond: "sombre",
    texteDit: "Nous, on arrive pour la visio. Quinze minutes.",
    avanceMs: 100,
    numero: 5,
    total: 6,
    titre: "La *visio*",
    ligne: "Là, c'est nous.",
    // Le compteur monte jusqu'à la durée de la visio (fait `visio-quinze-minutes` du cas), sur « Quinze ».
    visuel: { sorte: "objet", objet: "chrono", textes: ["15"] },
    puces: [],
    evenements: [{ cible: "chrono", surMot: 6, avanceMs: 0 }],
  },
  // s13 · notre seul travail
  {
    type: "titre",
    fond: "sombre",
    texteDit: "C'est notre seul travail.",
    avanceMs: 80,
    lignes: ["Notre seul", "*travail.*"],
    orange: ["travail."],
    evenements: [{ cible: "titre-2", surMot: 3, avanceMs: 0 }],
  },
  // s14 · étape 6
  {
    type: "etape",
    fond: "ivoire",
    texteDit: "Derrière, le contrat part tout seul. Elle signe sur son téléphone. Et le",
    avanceMs: 100,
    numero: 6,
    total: 6,
    titre: "Le *contrat*",
    ligne: "Il part tout seul.",
    visuel: { sorte: "objet", objet: "contrat-signature" },
    puces: ["Envoyé tout seul", "Signé"],
    // « Envoyé tout seul » sur « part », la signature tracée sur « signe », « Signé » sur « téléphone » (référence, `s14`).
    evenements: [
      { cible: "puce-1", surMot: 3, avanceMs: 0 },
      { cible: "signature", surMot: 7, avanceMs: 0 },
      { cible: "puce-2", surMot: 10, avanceMs: 0 },
    ],
  },
  // s16 · classé
  {
    type: "objet",
    fond: "sombre",
    texteDit: "dossier est classé. Et tout est",
    avanceMs: 280,
    titre: "Dossier *classé.*",
    visuel: { sorte: "objet", objet: "dossier-classe" },
  },
  // s16b · les données
  {
    type: "preuve",
    fond: "ivoire",
    texteDit: "conforme au R.G.P.D. : cent pour cent automatique, sans aucune intervention manuelle.",
    avanceMs: 420,
    titre: "Conforme *RGPD.*",
    puces: ["100 % automatique", "0 intervention manuelle"],
    evenements: [
      { cible: "puce-1", surMot: 3, avanceMs: 0 },
      { cible: "puce-2", surMot: 7, avanceMs: 0 },
    ],
  },
  // s17 · le résultat
  {
    type: "resultat",
    fond: "ivoire",
    texteDit: "Résultat : des heures gagnées, à chaque recrutement. Et",
    avanceMs: 100,
    titre: "Des heures *gagnées.*",
    // Faits du cas : « plus d'une heure » et la visio de 15 minutes. Textes affichés tirés des faits par la chaîne (`texteBarre`).
    avant: { libelle: "Avant", valeur: 1, faitId: "plus-d-une-heure" },
    maintenant: { libelle: "Maintenant", valeur: 15, faitId: "visio-quinze-minutes" },
    ligne: "À chaque recrutement.",
    // La barre « maintenant » sur « heures » (référence, `s17`) : rang 2, le « : » isolé n'est pas un mot.
    evenements: [{ cible: "barre-maintenant", surMot: 2, avanceMs: 0 }],
  },
  // s18 · et vous ?
  {
    type: "question",
    fond: "sombre",
    texteDit: "dans votre entreprise, quelle tâche pourrait tourner toute seule ?",
    avanceMs: 180,
    lignes: ["Et dans votre", "*entreprise ?*"],
    question: "Quelle tâche pourrait tourner toute seule ?",
    evenements: [
      { cible: "titre-2", surMot: 2, avanceMs: 0 },
      { cible: "question", surMot: 3, avanceMs: 0 },
    ],
  },
]);

/** Fiche témoin : le corps de la vidéo 1, non calé. */
export function ficheTemoin(): FicheEcrans {
  return {
    version: VERSION_FICHE_ECRANS,
    formatId: "cas-concret",
    videoId: "video-temoin",
    versionId: "version-temoin",
    habillage: "charte-duo/1",
    ratio: "9:16",
    offre: "integration",
    origine: "porte-a",
    posture: "chez-nous",
    casId: recrutementApporteurs.id,
    empreinteCas: "cas-temoin-0001",
    ecrans: CORPS.map((x, i) => ({ evenements: [], ...x, id: idEcranAttendu(i), marque: "axion-ia.com" }) as EcranCorps),
  };
}

/**
 * Fin du témoin : la fin Facebook d'aujourd'hui (X6, rien n'est branché) — « Faites votre diagnostic gratuit en quelques
 * minutes. » puis « Le lien est en commentaire. ». Le corps reste celui de la vidéo de référence.
 */
export function finTemoin(): FinPlanifiee {
  const plan = planDesFins({
    reseaux: ["facebook"],
    offre: "integration",
    nature: "automatisation",
    mot: recrutementApporteurs.mot,
    ...(recrutementApporteurs.motDit ? { motDit: recrutementApporteurs.motDit } : {}),
    avecMot: false,
    table: TABLE_FINS_DIAGNOSTIC,
  });
  const fin = plan.fins[0];
  if (!fin) throw new Error("La fin du témoin est introuvable dans la table des fins.");
  // Comme la référence, chaque écran de la fin avance sur son premier mot (0,1 s).
  const avances = [100, 100];
  // Le diagnostic en accent sur « diagnostic » ; la bulle du lien sur « lien ». La table des fins ne pose aucun événement.
  const evenements: Record<string, Ecran["evenements"]> = {
    f01: [{ cible: "cadeau", surMot: 2, avanceMs: 0 }],
    f02: [{ cible: "lien", surMot: 1, avanceMs: 0 }],
  };
  return { ...fin, ecrans: fin.ecrans.map((x, i) => ({ ...x, avanceMs: avances[i] ?? x.avanceMs, evenements: evenements[x.id] ?? x.evenements })) };
}

/**
 * Mots dits du témoin, au tempo final : ceux de la référence (`mots.json`) pour le corps, puis ceux de la fin d'aujourd'hui,
 * posés à la suite au débit moyen de la fin de la référence (la voix de la référence ne dit pas cette fin).
 */
export function motsDitsTemoin(reference: readonly { word: string; start: number; end: number }[], tempo: number): { mot: string; debutSec: number; finSec: number }[] {
  const tous = reference.map((m) => ({ mot: m.word, debutSec: m.start / tempo, finSec: m.end / tempo }));
  const nCorps = texteDuCorps(ficheTemoin()).split(/\s+/).length;
  const finRef = tous.slice(nCorps);
  const pas = (finRef[finRef.length - 1].finSec - finRef[0].debutSec) / finRef.length;
  const fin = finTemoin()
    .ecrans.flatMap((e) => e.texteDit.split(/\s+/))
    .map((mot, i) => ({ mot, debutSec: finRef[0].debutSec + i * pas, finSec: finRef[0].debutSec + (i + 0.85) * pas }));
  return [...tous.slice(0, nCorps), ...fin];
}

/**
 * Dérogations de la fiche témoin : règles que la vidéo validée par Will ne passe pas et que cette tâche ne corrige pas
 * (`regles.ts` n'est pas dans ses fichiers autorisés). Le test pin les écrans exacts concernés par chacune.
 * V4-3 : R03, R07, R08 et R12 acceptent désormais ce que la référence montre (règles ajustées sur la v4 validée par
 * Will ; faits « zero-tri-manuel » et « rappel-montre » du cas) ; seule R17 reste dérogée. Historique :
 *  - R03 : la référence coupe l'accroche avant « quinze minutes » (plan s1 de 1,6 s) ; la règle veut la promesse entière.
 *  - R07 : la référence a trois écrans sombres de suite (s11, s12, s13).
 *  - R08 : « 0 CV à trier » (4 mots) et la notification « Rappel : notre échange demain à 14:00 » (6 mots), vus dans la référence.
 *  - R12 : « 0 » (pastilles, « 0 intervention manuelle ») et « 14:00 » ne sont la valeur d'aucun fait du cas.
 *  - R17 : « Conforme *RGPD.* » et « 0 intervention manuelle » : la règle compare le balisage d'accent à la phrase validée.
 */
export const DEROGATIONS_TEMOIN: readonly string[] = ["R17"];

/* ------------------------------------------------------------------ */
/* Fiche calée → écrans calés de la brique                               */
/* ------------------------------------------------------------------ */

/**
 * Vrais écrans de la vidéo 1, tirés de `reference/rushes/` : la publicité (étape 1), le formulaire rempli au fil de la
 * frappe (étape 2 : six images `form-000…028.jpg`, assemblées en un court film par la planche) et la page du rendez-vous
 * entière (étape 4), qui défile. Clé de la capture de chaque écran qui en montre une.
 */
export const CAPTURE_DE_L_ECRAN: Readonly<Record<string, string>> = Object.freeze({ e06: "pub", e07: "formulaire", e09: "rendez-vous" });
/** Images du film du formulaire, dans l'ordre, et sa cadence (une image par sixième de seconde). */
export const FILM_FORMULAIRE = Object.freeze({ images: ["form-000.jpg", "form-006.jpg", "form-012.jpg", "form-018.jpg", "form-024.jpg", "form-028.jpg"], ips: 6, fichier: "formulaire.mp4" });

/** Captures de la fiche témoin ; `src` donne l'adresse servie au rendu pour un fichier (`pub.png`, `formulaire.mp4`…). */
export function capturesTemoin(src: (fichier: string) => string): Record<string, CaptureEcran> {
  return {
    pub: { src: src("pub.png"), cle: "pub", sorte: "image", largeur: 1080, hauteur: 1920 },
    formulaire: { src: src(FILM_FORMULAIRE.fichier), cle: "formulaire", sorte: "video", largeur: 1080, hauteur: 1920, dureeSec: FILM_FORMULAIRE.images.length / FILM_FORMULAIRE.ips },
    "rendez-vous": { src: src("rdv-entier.jpg"), cle: "rendez-vous", sorte: "page-entiere", largeur: 1080, hauteur: 3276, departY: departDePage(ficheTemoin(), "e09") } as CaptureVraiEcran,
  };
}

/** Visuel d'un écran : le vrai écran (capture des rushes) quand l'écran en montre un, sinon l'objet dessiné. */
function visuel(id: string, v: Extract<Ecran, { type: "etape" | "objet" }>["visuel"]): VisuelCale {
  const cle = CAPTURE_DE_L_ECRAN[id];
  if (cle) return { capture: { cle } };
  if (v.sorte === "ecran") return { objet: v.repli };
  return v.textes ? { objet: v.objet, textes: [...v.textes] } : { objet: v.objet };
}

/** Contenu d'un écran de la fiche, sous la forme que la brique `ecrans-motion` rend. */
function contenu(e: Ecran): ContenuEcran<VisuelCale> {
  switch (e.type) {
    case "accroche":
      return { type: "accroche", etiquette: e.etiquette, lignes: [...e.lignes] };
    case "chiffre":
      return { type: "chiffre", nombre: e.valeur, unite: avecPointFinal(e.texteDit, e.unite), pastilles: [...e.pastilles], compteur: e.variante === "compteur" };
    case "liste-avant":
      return { type: "liste-avant", etiquette: "Avant", titre: "C'était *ça.*", taches: [...e.taches], ...(e.total ? { total: { valeur: e.total } } : {}) };
    case "titre":
      return { type: "titre", lignes: e.lignes.map((l, i) => (i === e.lignes.length - 1 ? avecPointFinal(e.texteDit, l) : l)) };
    case "etape":
      return { type: "etape", numero: e.numero, nombreEtapes: e.total, titre: e.titre, ligne: e.ligne, visuel: visuel(e.id, e.visuel), puces: [...e.puces] };
    case "objet":
      return { type: "objet", titre: e.titre, ...(e.ligne ? { ligne: e.ligne } : {}), visuel: visuel(e.id, e.visuel) };
    case "preuve":
      return { type: "preuve", etiquette: "Et les données ?", titre: e.titre, puces: [...e.puces] };
    case "resultat":
      return { type: "resultat", etiquette: "Résultat", titre: e.titre, avant: texteBarre(e.avant, recrutementApporteurs.faits), maintenant: texteBarre(e.maintenant, recrutementApporteurs.faits), ligne: e.ligne };
    case "question":
      return { type: "question", lignes: [...e.lignes], question: e.question };
    case "appel-mot":
      return { type: "appel-mot", etiquette: "Pour la recevoir", invite: "Écrivez", mot: e.mot, suite: "en *commentaire.*" };
    case "promesse":
      return { type: "promesse", invite: "On vous envoie", cadeau: e.cadeau, ligne: e.ligne ?? "" };
    case "diagnostic":
      return { type: "promesse", invite: "Faites votre", cadeau: "*diagnostic gratuit*", ligne: e.ligne ?? "" };
    case "lien":
      return { type: "lien", titre: e.titre, lien: e.bulle, signature: "Axion-*IA*" };
  }
}

/** Écrans calés (corps puis fin), prêts pour `proprietesEcrans`, à partir du résultat du calage. */
export function ecransCales(corps: readonly Ecran[], fin: readonly Ecran[], evenements: readonly EvenementCale[]): EcranCale[] {
  return [...corps, ...fin].map(
    (e) =>
      ({
        id: e.id,
        fond: e.fond,
        debutMs: e.debutMs!,
        finMs: e.finMs!,
        evenements: evenements.filter((v) => v.ecranId === e.id).map((v) => ({ cible: v.cible, ms: v.debutMs })),
        ...contenu(e),
      }) as EcranCale,
  );
}

/** Propriétés des écrans calés de la fiche témoin, dans la zone sûre commune et la bande des sous-titres du format. */
export function proprietesTemoin(ecrans: EcranCale[], zone: ZoneProtegeePct, src: (fichier: string) => string): ProprietesEcran[] {
  return proprietesEcrans({ ecrans, captures: capturesTemoin(src), zoneProtegee: zone, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET });
}
