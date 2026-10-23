/**
 * CONTRÔLES FINAUX DU CAS CONCRET (tâche M7, plan cas concret § 6.4) : UN rapport qui assemble, sans rien recopier, les
 * contrôles existants.
 *
 *  - durées (R05) et accroche (R03) lues sur les heures CALÉES de la fiche et de chaque fin (durées : trop court bloquant,
 *    trop long indicatif, la voix étant déjà payée ; accroche au-delà de 3,0 s après la voix : indicatif aussi, un
 *    premier écran qui n'est pas l'accroche reste bloquant) ;
 *  - propriétés des écrans : `controlerProprietes` (marque, texte sous le plancher, texte ou objet hors de sa boîte) ;
 *  - mise en page : `controlerMiseEnPage` de `src/briques/controle-image`, avec les seuils du format ;
 *  - mesures du fichier de chaque fin : `controlerMesures`, puis la taille de l'image et la fin de la voix ;
 *  - indicatifs : écran réel remplacé, fin réduite, fin dont la prise a été gardée malgré un rejet, vidéo sans bruitages.
 *
 * Tout vient de l'extérieur (aucun appel, aucune lecture de fichier). Aucune taille en pixels n'est figée ici : les boîtes
 * viennent de la brique `ecrans-motion` (`disposer`). Les phrases sont en français, sans sigle ni identifiant interne.
 * N'importe AUCUN autre moteur.
 */
import { controleFinDesMesures } from "@/briques/composition/fin-propre";
import { controlerMesures, controlerMiseEnPage, SEUILS_CONTROLE_IMAGE, type Boite, type MesuresExport, type MiseEnPage, type ResultatControle, type SeuilsControleImage, type ZoneSure } from "@/briques/controle-image";
import { CONTRASTE_TEXTE_DUO_MIN, FONDS, TAILLE_PLANCHER_DUO } from "@/briques/habillage/charte-duo";
import { controlerProprietes, disposer, sansBalises, type ProprietesEcran } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET, type ReseauCas } from "@/formats/cas-concret";
import type { FicheEcrans, FinPlanifiee, PlanDesFins } from "./fiche";
import { ACCROCHE_FIN_MAX_MS, DEBIT_RECETTE, manquementsDurees } from "./regles";

/** Image du fichier rendu. */
export const FICHIER_LARGEUR = 1080;
export const FICHIER_HAUTEUR = 1920;
export const FICHIER_IMAGES_PAR_SECONDE = 25;
/** La voix finit à 2,0 s au moins de la fin du fichier. */
export const VOIX_AVANT_FIN_MIN_SEC = 2;

/**
 * Seuils du format : ceux de la brique commune, plancher et contraste de la charte, bande des sous-titres du format (celle
 * dont la chaîne tire la zone utile des écrans). Les textes sont contrôlés dans la zone de texte (zone sûre) ; les objets
 * sans texte, dans la zone de dessin, par `controlerProprietes`.
 */
export const SEUILS_CAS_CONCRET: Readonly<SeuilsControleImage> = Object.freeze({
  ...SEUILS_CONTROLE_IMAGE,
  tailleTexteMin: TAILLE_PLANCHER_DUO,
  contrasteTexteMin: CONTRASTE_TEXTE_DUO_MIN,
  bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET,
});

export type FamilleControleCasConcret = "duree" | "ecran" | "mise-en-page" | "fichier" | "voix" | "capture" | "fin" | "bruitage";
export type EtatLigneCasConcret = "reussi" | "echoue" | "non-fait";

/** Une ligne du rapport. */
export interface LigneControleCasConcret {
  famille: FamilleControleCasConcret;
  libelle: string;
  bloquant: boolean;
  etat: EtatLigneCasConcret;
  /** Phrase en français, sans sigle ni identifiant interne. */
  raison: string;
}

/**
 * Mesures d'une fin : celles de la composition `complet` (`lufs`, `creteVraieDbtp`, `imageNoireTete`, `dureeSec`…), plus
 * `largeur`, `hauteur`, `fps` du fichier et `voixFinSec` (heure du dernier mot dit, sur l'horloge du fichier).
 */
export type MesuresFin = MesuresExport;

export interface EntreeControleCasConcret {
  /** Fiche calée : le corps de la vidéo. */
  fiche: FicheEcrans;
  /** Propriétés de chaque écran : le corps, puis celles de chaque fin (clé = identifiant de la fin du plan). */
  proprietes: { corps: readonly ProprietesEcran[]; fins?: Readonly<Record<string, readonly ProprietesEcran[]>> };
  /** Mesures du fichier de chaque fin, par identifiant de la fin ; absentes : « non fait ». */
  mesuresParFin: Readonly<Record<string, MesuresFin | undefined>>;
  /** Une ligne par écran réel remplacé (`appliquerCaptures().journal`). */
  journalCaptures: readonly string[];
  planDesFins: PlanDesFins;
  /** Bruitages posés dans la vidéo (aucun : vidéo sans bruitages). */
  bruitagesPoses: readonly string[];
  /** Zone sûre commune aux réseaux visés, en fractions (`zoneSureDe`) ; null : mise en page « non faite ». */
  zone: ZoneSure | null;
  /** Fins dont la prise de voix a été gardée malgré un rejet (`rapportVoix().finsGardeesMalgreRejet`). */
  finsGardeesMalgreRejet?: readonly { id: string; phrase: string }[];
  seuils?: SeuilsControleImage;
}

export interface RapportControleCasConcret {
  lignes: LigneControleCasConcret[];
  bloquants: LigneControleCasConcret[];
  indicatifs: LigneControleCasConcret[];
  nonFaits: LigneControleCasConcret[];
  verdict: "ok" | "bloque";
  /** Phrase courte : « Vérifications passées », « Bloqué : 2 contrôles échoués ». */
  resume: string;
  /** Une phrase par bloquant, indicatif et non-fait. */
  phrases: string[];
}

/* ------------------------------------------------------------------ */
/* Mots lisibles                                                         */
/* ------------------------------------------------------------------ */

const NOM_RESEAU: Record<ReseauCas, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" };

function nomsReseaux(reseaux: readonly ReseauCas[]): string {
  const n = reseaux.map((r) => NOM_RESEAU[r] ?? r);
  return n.length <= 1 ? (n[0] ?? "ce réseau") : `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`;
}

const NOM_TYPE: Record<string, string> = {
  accroche: "accroche",
  chiffre: "chiffre",
  "liste-avant": "liste d'avant",
  titre: "titre",
  etape: "étape",
  objet: "objet",
  preuve: "preuve",
  resultat: "résultat",
  question: "question",
  "appel-mot": "appel au mot",
  promesse: "promesse",
  diagnostic: "diagnostic",
  lien: "lien",
};

const NOM_BOITE: Record<string, string> = {
  marque: "la marque",
  etiquette: "l'étiquette",
  nombre: "le nombre",
  unite: "l'unité",
  pastilles: "les pastilles",
  titre: "le titre",
  total: "le total",
  ligne: "la ligne",
  question: "la question",
  invite: "l'invitation",
  mot: "le mot",
  suite: "la suite",
  cadeau: "le cadeau",
  lien: "le lien",
  signature: "la signature",
  avant: "la valeur d'avant",
  maintenant: "la valeur d'après",
  "etiquette-avant": "l'étiquette d'avant",
  "etiquette-maintenant": "l'étiquette d'après",
  visuel: "le dessin",
  objet: "l'objet",
};

function nomBoiteLisible(nom: string): string {
  const numerote = /^(titre|puce|tache|pastille)-(\d+)$/.exec(nom);
  if (numerote) {
    const base = { titre: "la ligne", puce: "la puce", tache: "la tâche", pastille: "la pastille" }[numerote[1] as "titre" | "puce" | "tache" | "pastille"];
    return `${base} n° ${numerote[2]}`;
  }
  return NOM_BOITE[nom] ?? "un élément";
}

/** Le refus de `controlerProprietes`, sans identifiant d'écran ni nom interne de boîte. */
function phraseRefus(refus: string, p: ProprietesEcran, lieu: string): string {
  const corps = refus
    .replace(`Écran ${p.id} · `, "")
    .replace(/\(([a-z][a-z0-9-]*)( : «[^»]*»)?\)/g, (_m, nom: string, texte?: string) => `(${nomBoiteLisible(nom)}${texte ?? ""})`);
  return `${lieu} · ${corps}`;
}

function lieuEcran(rang: number, p: ProprietesEcran, fin?: readonly ReseauCas[]): string {
  const type = NOM_TYPE[p.type] ?? p.type;
  return `${fin ? `Fin pour ${nomsReseaux(fin)} · ` : ""}Écran n° ${rang + 1} (${type})`;
}

/* ------------------------------------------------------------------ */
/* Lignes                                                                */
/* ------------------------------------------------------------------ */

const ligne = (famille: FamilleControleCasConcret, libelle: string, bloquant: boolean, etat: EtatLigneCasConcret, raison: string): LigneControleCasConcret => ({ famille, libelle, bloquant, etat, raison });

const FAMILLE_BRIQUE: Record<string, FamilleControleCasConcret> = { volume: "fichier", crete: "fichier", "image-noire": "fichier", "image-figee": "fichier", duree: "fichier", "note-qualite": "fichier" };

function depuisBrique(c: ResultatControle, famille: FamilleControleCasConcret, prefixe = ""): LigneControleCasConcret {
  return ligne(famille, c.libelle, c.bloquant, c.etat, `${prefixe}${c.raison}`);
}

const secondes = (s: number) => `${(Math.round(s * 10) / 10).toFixed(1).replace(".", ",")} s`;

/* ------------------------------------------------------------------ */
/* Durées et accroche, sur les heures calées                             */
/* ------------------------------------------------------------------ */

/** Après la voix payée, un écran trop long est signalé sans bloquer : la vidéo est livrée. */
const APRES_LA_VOIX = " (après la voix : signalé, la vidéo est livrée)";

function controlerDurees(fiche: FicheEcrans, plan: PlanDesFins): LigneControleCasConcret[] {
  const libelle = "Durée des écrans";
  const calee = fiche.ecrans.length > 0 && fiche.ecrans.every((e) => e.debutMs !== undefined && e.finMs !== undefined);
  if (!calee) return [ligne("duree", libelle, true, "non-fait", "Les écrans ne sont pas calés sur la voix : durées non vérifiées.")];
  const lieu = (id: string | undefined, ou: string) => {
    const rang = fiche.ecrans.findIndex((e) => e.id === id);
    return rang >= 0 ? `Écran n° ${rang + 1}` : ou;
  };
  const res: LigneControleCasConcret[] = [];
  const courts = manquementsDurees(fiche.ecrans, DEBIT_RECETTE, { seulement: "trop-court" });
  const longs = manquementsDurees(fiche.ecrans, DEBIT_RECETTE, { seulement: "trop-long" });
  res.push(...courts.map((m) => ligne("duree", libelle, true, "echoue", `${lieu(m.ecranId, "Corps")} · ${m.detail}`)));
  res.push(...longs.map((m) => ligne("duree", libelle, false, "echoue", `${lieu(m.ecranId, "Corps")} · ${m.detail}${APRES_LA_VOIX}`)));
  if (!courts.length && !longs.length) res.push(ligne("duree", libelle, true, "reussi", "Chaque écran du corps dure entre 1 et 5 secondes."));

  const premier = fiche.ecrans[0];
  const libelleAccroche = "Accroche";
  if (premier.type === "accroche" && premier.finMs! <= ACCROCHE_FIN_MAX_MS) res.push(ligne("duree", libelleAccroche, true, "reussi", `L'accroche finit à ${secondes(premier.finMs! / 1000)}.`));
  else if (premier.type !== "accroche") res.push(ligne("duree", libelleAccroche, true, "echoue", "Le premier écran n'est pas l'accroche."));
  else res.push(ligne("duree", libelleAccroche, false, "echoue", `L'accroche finit à ${secondes(premier.finMs! / 1000)} ; elle doit finir avant ${secondes(ACCROCHE_FIN_MAX_MS / 1000)}.${APRES_LA_VOIX}`));

  for (const fin of plan.fins) {
    const nom = nomsReseaux(fin.reseaux);
    const sansHeures = fin.ecrans.some((e) => e.debutMs === undefined || e.finMs === undefined);
    if (sansHeures) {
      res.push(ligne("duree", libelle, true, "non-fait", `Fin pour ${nom} : écrans non calés sur la voix, durées non vérifiées.`));
      continue;
    }
    const courtsFin = manquementsDurees(fin.ecrans, DEBIT_RECETTE, { finale: true, seulement: "trop-court" });
    const longsFin = manquementsDurees(fin.ecrans, DEBIT_RECETTE, { finale: true, seulement: "trop-long" });
    const lieuFin = (m: { ecranId?: string; detail: string }) => {
      const rang = fin.ecrans.findIndex((e) => e.id === m.ecranId);
      return `Fin pour ${nom} · ${rang >= 0 ? `Écran n° ${rang + 1}` : "Fin"} · ${m.detail}`;
    };
    res.push(...courtsFin.map((m) => ligne("duree", libelle, true, "echoue", lieuFin(m))));
    res.push(...longsFin.map((m) => ligne("duree", libelle, false, "echoue", `${lieuFin(m)}${APRES_LA_VOIX}`)));
    if (!courtsFin.length && !longsFin.length) res.push(ligne("duree", libelle, true, "reussi", `Fin pour ${nom} : chaque écran dure entre 1 et 5 secondes.`));
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Propriétés et mise en page                                            */
/* ------------------------------------------------------------------ */

function controlerEcrans(ecrans: readonly ProprietesEcran[], fin: readonly ReseauCas[] | undefined): LigneControleCasConcret[] {
  const qui = fin ? `Fin pour ${nomsReseaux(fin)}` : "Corps de la vidéo";
  const libelle = "Écrans";
  const res: LigneControleCasConcret[] = [];
  ecrans.forEach((p, i) => {
    const refus = controlerProprietes(p);
    for (const r of refus) res.push(ligne("ecran", libelle, true, "echoue", phraseRefus(r, p, lieuEcran(i, p, fin))));
  });
  if (!res.length) res.push(ligne("ecran", libelle, true, "reussi", `${qui} : marque présente, textes dans leur boîte et au-dessus du plancher.`));
  return res;
}

/** Les textes posés d'un écran, en boîtes de la brique (fractions de l'image). Les textes d'appoint (marque, étiquette…) sont des « marques » : ni plancher ni contraste de texte courant. */
function boitesDe(p: ProprietesEcran, premiere: boolean): Boite[] {
  const { textes } = disposer(p);
  const { largeur: L, hauteur: H } = p;
  const couleurs = FONDS[p.fond];
  const base = (t: (typeof textes)[number]) => ({ x: t.boite.x / L, y: t.boite.y / H, largeur: t.boite.largeur / L, hauteur: t.boite.hauteur / H, couleur: couleurs.texte, fond: couleurs.fond, debutSec: p.debutMs / 1000 });
  const res: Boite[] = [];
  const lignesAccroche = premiere && p.type === "accroche" ? textes.filter((t) => /^titre-\d+$/.test(t.nom)) : [];
  for (const t of textes) {
    if (lignesAccroche.includes(t)) continue;
    if (!t.soumisAuPlancher) res.push({ role: "marque", ...base(t) });
    else res.push({ role: "texte", texte: sansBalises(t.texte), taille: t.tailleRendue / H, ...base(t) });
  }
  if (lignesAccroche.length) {
    const x0 = Math.min(...lignesAccroche.map((t) => t.boite.x));
    const y0 = Math.min(...lignesAccroche.map((t) => t.boite.y));
    const x1 = Math.max(...lignesAccroche.map((t) => t.boite.x + t.boite.largeur));
    const y1 = Math.max(...lignesAccroche.map((t) => t.boite.y + t.boite.hauteur));
    res.push({
      role: "accroche",
      texte: lignesAccroche.map((t) => sansBalises(t.texte)).join(" "),
      taille: Math.min(...lignesAccroche.map((t) => t.tailleRendue)) / H,
      x: x0 / L,
      y: y0 / H,
      largeur: (x1 - x0) / L,
      hauteur: (y1 - y0) / H,
      couleur: couleurs.texte,
      fond: couleurs.fond,
      debutSec: 0,
    });
  }
  return res;
}

/** Mise en page d'une suite d'écrans. `accroche` : la suite ouvre la vidéo (le corps) ; une fin n'a pas de première image. */
function controlerPage(corps: readonly ProprietesEcran[], zone: ZoneSure | null, seuils: SeuilsControleImage, accroche: boolean): LigneControleCasConcret[] {
  if (!corps.length) return [ligne("mise-en-page", "Mise en page", true, "non-fait", "Aucun écran à contrôler.")];
  const aVerifier: { rang: number; page: MiseEnPage }[] = [];
  try {
    corps.forEach((p, rang) => aVerifier.push({ rang, page: { boites: boitesDe(p, accroche && rang === 0) } }));
  } catch (e) {
    const detail = e instanceof Error && e.message ? ` (${e.message})` : "";
    return [ligne("mise-en-page", "Mise en page", true, "non-fait", `Mise en page non faite : erreur pendant la mise en place des textes${detail}.`)];
  }
  const res: LigneControleCasConcret[] = [];
  const vus = new Set<string>();
  for (const { rang, page } of aVerifier) {
    // La première image est contrôlée sur le premier écran du corps seulement ; les autres écrans n'ont pas d'accroche.
    const controles = controlerMiseEnPage(page, zone, seuils).filter((c) => (accroche && rang === 0) || c.id !== "premiere-image");
    for (const c of controles) {
      if (c.etat === "reussi") continue;
      if (c.etat === "non-fait") {
        if (vus.has(c.id)) continue;
        vus.add(c.id);
      }
      res.push(depuisBrique(c, "mise-en-page", c.etat === "non-fait" ? "" : `Écran n° ${rang + 1} · `));
    }
  }
  if (!res.length) res.push(ligne("mise-en-page", "Mise en page", true, "reussi", `Textes dans la zone sûre, lisibles, contrastés${accroche ? " ; accroche lisible dès la première image" : ""}.`));
  return res;
}

/* ------------------------------------------------------------------ */
/* Fichier de chaque fin                                                 */
/* ------------------------------------------------------------------ */

const lire = (m: MesuresFin, cle: string): number | null => {
  const v = m[cle];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

function controlerFichier(fin: FinPlanifiee, m: MesuresFin | undefined, seuils: SeuilsControleImage): LigneControleCasConcret[] {
  const nom = nomsReseaux(fin.reseaux);
  if (!m) return [ligne("fichier", "Fichier exporté", true, "non-fait", `Fichier pour ${nom} : mesures absentes, rien n'a été vérifié sur le fichier.`)];
  const res = controlerMesures(m, seuils).map((c) => depuisBrique(c, FAMILLE_BRIQUE[c.id] ?? "fichier", `Fichier pour ${nom} · `));

  const libelleImage = "Taille de l'image";
  const attendu = `largeur ${FICHIER_LARGEUR}, hauteur ${FICHIER_HAUTEUR}, ${FICHIER_IMAGES_PAR_SECONDE} images par seconde`;
  const l = lire(m, "largeur");
  const h = lire(m, "hauteur");
  const f = lire(m, "fps");
  if (l === null || h === null || f === null) res.push(ligne("fichier", libelleImage, true, "non-fait", `Fichier pour ${nom} · taille de l'image ou cadence non lue.`));
  else if (l !== FICHIER_LARGEUR || h !== FICHIER_HAUTEUR || f !== FICHIER_IMAGES_PAR_SECONDE) {
    res.push(ligne("fichier", libelleImage, true, "echoue", `Fichier pour ${nom} · ${l} sur ${h} à ${f} images par seconde ; il faut ${attendu}.`));
  } else res.push(ligne("fichier", libelleImage, true, "reussi", `Fichier pour ${nom} · ${attendu}.`));

  const libelleVoix = "Fin de la voix";
  const duree = lire(m, "dureeSec");
  const voix = lire(m, "voixFinSec");
  if (duree === null || voix === null) res.push(ligne("voix", libelleVoix, true, "non-fait", `Fichier pour ${nom} · fin de la voix non mesurée.`));
  else if (duree - voix < VOIX_AVANT_FIN_MIN_SEC - 1e-6) {
    res.push(ligne("voix", libelleVoix, true, "echoue", `Fichier pour ${nom} · la voix finit à ${secondes(duree - voix)} de la fin ; il faut ${secondes(VOIX_AVANT_FIN_MIN_SEC)} au moins.`));
  } else res.push(ligne("voix", libelleVoix, true, "reussi", `Fichier pour ${nom} · la voix finit à ${secondes(duree - voix)} de la fin.`));

  // 14/10 : fin propre (son éteint, dernières images identiques) ; indicatif, jamais bloquant. Mesure absente (export
  // d'avant) : aucune ligne.
  const finFichier = controleFinDesMesures(m as Readonly<Record<string, number | undefined>>);
  if (finFichier.mesuree) res.push(finFichier.defauts.length ? ligne("fin", "Fin propre", false, "echoue", `Fichier pour ${nom} · ${finFichier.defauts.join(" ; ")}.`) : ligne("fin", "Fin propre", false, "reussi", `Fichier pour ${nom} · image tenue puis fondu, son éteint.`));
  return res;
}

/* ------------------------------------------------------------------ */
/* Indicatifs                                                            */
/* ------------------------------------------------------------------ */

function indicatifs(e: EntreeControleCasConcret): LigneControleCasConcret[] {
  const res: LigneControleCasConcret[] = [];
  for (const j of e.journalCaptures) res.push(ligne("capture", "Écran réel", false, "echoue", j));
  for (const r of e.planDesFins.reduites) res.push(ligne("fin", "Fin réduite", false, "echoue", `Fin pour ${nomsReseaux(r.reseaux)} : ${r.raison}`));
  for (const g of e.finsGardeesMalgreRejet ?? []) {
    const fin = e.planDesFins.fins.find((f) => f.id === g.id);
    res.push(ligne("voix", "Voix de la fin", false, "echoue", `Fin${fin ? ` pour ${nomsReseaux(fin.reseaux)}` : ""} : la voix a été gardée malgré un rejet (${g.phrase}).`));
  }
  if (e.bruitagesPoses.length === 0) res.push(ligne("bruitage", "Bruitages", false, "echoue", "Aucun bruitage validé : la vidéo est sans bruitages."));
  return res;
}

/* ------------------------------------------------------------------ */
/* Rapport                                                               */
/* ------------------------------------------------------------------ */

function assembler(lignes: LigneControleCasConcret[]): RapportControleCasConcret {
  const bloquants = lignes.filter((l) => l.etat === "echoue" && l.bloquant);
  const indicatifsEchoues = lignes.filter((l) => l.etat === "echoue" && !l.bloquant);
  const nonFaits = lignes.filter((l) => l.etat === "non-fait");
  const s = (n: number) => (n > 1 ? "s" : "");
  const suffixe = nonFaits.length ? ` — ${nonFaits.length} élément${s(nonFaits.length)} non fait${s(nonFaits.length)}` : "";
  const verdict = bloquants.length ? "bloque" : "ok";
  const resume = bloquants.length ? `Bloqué : ${bloquants.length} contrôle${s(bloquants.length)} échoué${s(bloquants.length)}${suffixe}` : `Vérifications passées${suffixe}`;
  // Une raison qui commence par son libellé (« Écran réel remplacé par un dessin… ») ne le répète pas.
  const texte = (l: LigneControleCasConcret) => (l.raison.startsWith(l.libelle) ? l.raison : `${l.libelle} : ${l.raison}`);
  const phrases = [...bloquants.map((l) => `Bloquant · ${texte(l)}`), ...indicatifsEchoues.map((l) => `À noter · ${texte(l)}`), ...nonFaits.map((l) => `Non fait · ${texte(l)}`)];
  return { lignes, bloquants, indicatifs: indicatifsEchoues, nonFaits, verdict, resume, phrases };
}

/** Un contrôle qui lève une erreur devient « non fait » ; le rapport n'est jamais interrompu. */
function proteger(libelle: string, famille: FamilleControleCasConcret, f: () => LigneControleCasConcret[]): LigneControleCasConcret[] {
  try {
    return f();
  } catch (e) {
    const detail = e instanceof Error && e.message ? ` (${e.message})` : "";
    return [ligne(famille, libelle, true, "non-fait", `Contrôle non fait : erreur pendant la vérification${detail}.`)];
  }
}

/**
 * Contrôle final d'une vidéo « Cas concret MD ». Bloquants : durée d'un écran et accroche, marque absente, texte hors de sa
 * boîte ou sous le plancher, mise en page, mesures du fichier de chaque fin, taille de l'image, fin de la voix.
 * Indicatifs : écran réel remplacé, fin réduite, prise de fin gardée malgré un rejet, vidéo sans bruitages.
 * Ne lève jamais : une pièce qui ne peut pas tourner devient « non faite ».
 */
export function controlerVideoCasConcret(entree: EntreeControleCasConcret): RapportControleCasConcret {
  const seuils = entree.seuils ?? SEUILS_CAS_CONCRET;
  const lignes: LigneControleCasConcret[] = [];
  lignes.push(...proteger("Durée des écrans", "duree", () => controlerDurees(entree.fiche, entree.planDesFins)));
  lignes.push(...proteger("Écrans", "ecran", () => controlerEcrans(entree.proprietes.corps, undefined)));
  lignes.push(...proteger("Mise en page", "mise-en-page", () => controlerPage(entree.proprietes.corps, entree.zone, seuils, true)));
  for (const fin of entree.planDesFins.fins) {
    const props = entree.proprietes.fins?.[fin.id];
    if (props) {
      lignes.push(...proteger("Écrans", "ecran", () => controlerEcrans(props, fin.reseaux)));
      lignes.push(...proteger("Mise en page", "mise-en-page", () => controlerPage(props, entree.zone, seuils, false)));
    } else lignes.push(ligne("ecran", "Écrans", true, "non-fait", `Fin pour ${nomsReseaux(fin.reseaux)} : propriétés des écrans absentes, rien n'a été vérifié.`));
    lignes.push(...proteger("Fichier exporté", "fichier", () => controlerFichier(fin, entree.mesuresParFin[fin.id], seuils)));
  }
  if (!entree.planDesFins.fins.length) lignes.push(ligne("fin", "Fin de la vidéo", true, "echoue", "Aucune fin n'est prévue : la vidéo ne dit ni le diagnostic ni le lien."));
  lignes.push(...indicatifs(entree));
  return assembler(lignes);
}
