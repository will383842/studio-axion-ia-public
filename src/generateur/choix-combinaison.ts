/**
 * CHOIX CONJOINT, étape 0, GRATUIT (plan v5 B.3.9 ; C31 a, C43, C49, C52, C53, C61, C67, C76). PUR.
 *
 * Avant toute dépense, le code choisit ce que le sujet racontera : une STRUCTURE réalisable, une MATIÈRE vraie
 * d'ancrage, un POINT DE VUE permis par cette matière et un RESSENTI permis par la recette, en respectant les règles de
 * série sur chaque réseau coché. Il transmet les 2 à 3 meilleures combinaisons au stratège ; la retenue est réservée
 * (par le service, sous `sousVerrou`) pour que deux sujets lancés d'affilée ne tirent pas la même.
 *
 * Règles dures pour la machine : C43 (structure), C49 (type d'ancrage), C52 (part d'anecdote, après 10 sujets validés),
 * C53 (réemploi, exclusion). Si rien ne passe, RELÂCHEMENT dans cet ordre, chaque relâchement noté :
 * ressenti → point de vue → famille d'accroche → structure → type d'ancrage → part d'anecdote.
 * JAMAIS relâchés : une matière vraie, l'accord, la fidélité, le retrait, la péremption.
 * Mode démarrage : les règles dures deviennent des pénalités ; seule l'absence de toute matière vraie arrête.
 * Un choix explicite de Will (matière imposée, structure demandée) n'est jamais refusé : dépassements en information.
 *
 * Ce fichier ne nomme AUCUN format, aucun code de format, aucun réseau : tout arrive en données (`parametresGenerateur`).
 */
import {
  c43Structure,
  c49TypeAncrage,
  c50Rotation,
  c51Rotation,
  c52PartAnecdote,
  c53Reemploi,
  couvrirStructure,
  libelleManque,
  REGLES_VARIETE,
  termesDivergents,
  termesVaguesDe,
  texteSuspect,
  utilisable,
  consignesDiversite,
  type ConsignesDiversite,
  type ElementDiversite,
  type Rupture,
  type Couverture,
  type ElementSerieEtendu,
  type ReglesVariete,
  type StockMatiere,
  type StructureGenerateur,
  type ViolationControle,
} from "@/domaine/controles-script";
import type { ChoixSerie, DateIso, Emotion, Id, Matiere, ObjectifSujet, PointDeVue, Preuve, ReponseBloquante, ScriptMaitre, SujetSensible, TypeMatiere } from "@/domaine/types";

/** Ordre ÉCRIT des relâchements (B.3.9 point 6). */
export const ORDRE_RELACHEMENT = ["emotion", "point-de-vue", "famille-accroche", "structure", "type-ancrage", "part-anecdote"] as const;
export type AxeRelachement = (typeof ORDRE_RELACHEMENT)[number];

export interface EntreeChoix {
  maintenant: DateIso;
  brief: {
    idee: string;
    pilier?: string;
    motsCles?: string[];
    reseaux: string[];
    objectif: ObjectifSujet;
    matiereIdsImposees?: Id[];
    /** Structure demandée par Will (« je choisis »). */
    structureImposee?: string;
    /** Famille d'accroche demandée avec la structure (« Refaire cette structure ») ; ignorée si une limite de série l'exclut. */
    familleAccroche?: string;
    /** Terme pivot déclaré par le stratège (C68), s'il est déjà connu. */
    termePivot?: string;
  };
  /** Will parle (« Je lis », « J'improvise ») : un avis de Will peut porter la vidéo. */
  quiParleWill: boolean;
  /** Débit du mode (mots/s), pour estimer le corps (C67). */
  debit: number;
  matieres: Matiere[];
  preuves: Preuve[];
  structures: StructureGenerateur[];
  pointsDeVueParType: Readonly<Record<TypeMatiere, PointDeVue[]>>;
  pointsDeVuePermis: PointDeVue[];
  emotionsPermises: Emotion[];
  conditionsEmotions?: Partial<Record<Emotion, TypeMatiere[]>>;
  /** Familles d'accroche de la recette, leurs exigences et leurs plafonds (poids de tirage). */
  famillesAccroche: { id: string; exige?: { matiere?: TypeMatiere[]; preuveChiffree?: boolean; accordAvantApres?: boolean; scene?: boolean }; plafond?: { max: number; sur: number } }[];
  famillesFavorisees?: Record<string, { familles: string[]; poids: number }>;
  /** Série de chaque réseau coché (`historiqueSerie`, réservations comprises), du plus ancien au plus récent. */
  series: Record<string, ElementSerieEtendu[]>;
  /** Usages passés de chaque matière comme ancrage (C53). */
  usagesMatieres: Record<Id, { reseau: string; le: DateIso; numero?: number }[]>;
  /** Sujets validés à ce jour (C52 ne s'applique qu'après 10). */
  sujetsValides: number;
  modeRotation: "demarrage" | "normal";
  stadeCompte?: "demarrage" | "etabli";
  termesVagues?: string[];
  /** « Passer » sur la carte « à préciser » : le texte est gardé tel quel (alerte C76). */
  passerTermesVagues?: boolean;
  /** Correction automatique du tableau « variété » : multiplicateur de poids par valeur d'axe (B.7.8). */
  poidsCorrection?: { structure?: Record<string, number>; typeAncrage?: Record<string, number>; famille?: Record<string, number> };
  regles?: ReglesVariete;
  /** Matières notées « plaquées » par le stratège (C61) : refusées. */
  matieresPlaquees?: Id[];
  /** G4 (§2 sexies, ajout) : série des 10 dernières vidéos vue par la diversité (ouvertures, fins, récit, ruptures). */
  diversite?: { serie: ElementDiversite[] };
}

export interface Combinaison {
  structure: StructureGenerateur;
  ancrage: Matiere;
  second?: Matiere;
  pointDeVue: PointDeVue;
  emotion: Emotion;
  couverture: Couverture;
  /** Axes de série violés (sur au moins un réseau coché). */
  axes: AxeRelachement[];
  /** Règles violées, pour l'affichage. */
  regles: ViolationControle[];
  score: number;
  imposee: boolean;
}

export type ManqueChoix = NonNullable<ScriptMaitre["manque"]>;

export type ResultatChoix =
  | {
      ok: true;
      retenue: ChoixSerie;
      combinaisons: ChoixSerie[];
      /** Structures réalisables avec le stock du jour (n° 80 ; sous 3, l'Accueil demande une matière). */
      structuresTirables: number;
      /** Informations : dépassements d'un choix de Will, alertes de rotation, ancrage faible. */
      informations: ViolationControle[];
      sujetSensiblePropose?: SujetSensible;
      details: Combinaison[];
      /** G4 (§2 sexies) : consignes de diversité du sujet (et la rupture due). */
      diversite?: ConsignesDiversite;
    }
  | { ok: false; manque: ManqueChoix; autres: ManqueChoix[]; structuresTirables: number; sujetSensiblePropose?: SujetSensible };

/* ------------------------------------------------------------------ */
/* Compatibilité d'une matière avec le sujet (B.3.9 point 1)           */
/* ------------------------------------------------------------------ */

function normaliserMot(m: string): string {
  return m
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/(aux|eaux|s|x)$/, "");
}

function motsDe(t: string): Set<string> {
  return new Set(
    t
      .split(/[\s'’,.;:!?«»"()-]+/)
      .map(normaliserMot)
      .filter((m) => m.length >= 4),
  );
}

/** Pertinence : 3 = pilier commun, 1-2 = mots-clés communs, 0 = incompatible. */
export function pertinence(m: Pick<Matiere, "pilier" | "motsCles" | "texte">, brief: EntreeChoix["brief"]): number {
  const pilier = !!brief.pilier && m.pilier === brief.pilier ? 3 : 0;
  const sujet = new Set([...(brief.motsCles ?? []).flatMap((k) => [...motsDe(k)]), ...motsDe(brief.idee)]);
  const communs = [...new Set([...m.motsCles.flatMap((k) => [...motsDe(k)]), ...motsDe(m.texte)])].filter((x) => sujet.has(x)).length;
  return pilier + Math.min(2, communs);
}

const ACCORD_REQUIS: TypeMatiere[] = ["cas-client", "parole-dirigeant"];

function accordPresent(m: Matiere): boolean {
  if (!ACCORD_REQUIS.includes(m.type) && !m.accord?.requis) return true;
  return !!m.accord?.obtenu;
}

/* ------------------------------------------------------------------ */
/* Sujet sensible proposé (B.3.9 point 15)                             */
/* ------------------------------------------------------------------ */

const SENSIBLES: { type: SujetSensible; motif: RegExp }[] = [
  { type: "juridique", motif: /\b(loi|juridique|contrat|licenci|prud|tribunal|amende|sanction|rgpd|cnil|responsabilit|avocat|illegal|legal)/ },
  { type: "donnees", motif: /\b(donnees|fichiers? clients?|rgpd|cnil|confidential|mot de passe|fuite)/ },
  { type: "financier", motif: /\b(impot|tva|tresorerie|banque|credit|fiscal|comptab|bilan|investiss)/ },
  { type: "rh", motif: /\b(salarie|embauche|recrut|licenci|conge|salaire|rh|drh|teletravail)/ },
];
export function proposerSujetSensible(texte: string): SujetSensible | undefined {
  const n = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return SENSIBLES.find((s) => s.motif.test(n))?.type;
}

/* ------------------------------------------------------------------ */
/* Le choix                                                            */
/* ------------------------------------------------------------------ */

const LIBELLES_TYPES: Record<TypeMatiere, string> = {
  "anecdote-will": "une scène que vous avez vécue",
  "avis-will": "votre avis, en une phrase",
  "cas-client": "un cas client (avec son accord)",
  "parole-dirigeant": "une phrase entendue chez un dirigeant (avec son accord)",
  "question-recue": "une question client sur ce sujet",
  observation: "ce que vous constatez chez vos clients",
  "idee-recue": "une idée reçue que vous entendez",
  etude: "une étude sourcée",
  actualite: "une actualité datée",
  demonstration: "une démonstration à l'écran",
  limite: "la limite : quand ça ne marche pas",
};

/** Au plus 3 manques affichés d'un coup (lisible sur un téléphone), puis « et N autres ». */
export const MANQUES_AFFICHES = 3;

/**
 * E2E-2 données n° 5 et parcours n° 13 : la liste « Il manque » dit chaque manque UNE fois (dédoublonnée par ce qui
 * le comble, pas par son texte : « le pourquoi » de deux temps différents, deux « règles » formulées autrement), ceux
 * de la structure la plus proche d'abord, 3 au plus.
 */
export function manquesLisibles(c: Couverture): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  const ajouter = (cle: string, libelle: string) => {
    if (!libelle || vus.has(cle) || out.includes(libelle)) return;
    vus.add(cle);
    out.push(libelle);
  };
  for (const t of c.manquants) ajouter(`sources:${JSON.stringify(t.sources)}`, t.libelle);
  for (const reste of libelleManque({ ...c, manquants: [] }).split(" ; ")) ajouter(reste, reste);
  return out;
}

/** « a ; b ; c (et 2 autres) ». */
export function phraseManques(liste: string[]): string {
  const vus = liste.slice(0, MANQUES_AFFICHES);
  const reste = liste.length - vus.length;
  return `${vus.join(" ; ")}${reste > 0 ? ` (et ${reste} autre${reste > 1 ? "s" : ""})` : ""}`;
}

/** Ce qu'il faudra encore, une fois l'ancrage suggéré trouvé : annoncé dès le premier arrêt (parcours n° 13). */
function ensuiteSansAncrage(e: EntreeChoix, suggere: TypeMatiere): string[] {
  try {
    const fictive = { id: "ancrage-suggere", type: suggere, texte: "", motsCles: [], source: { origine: "dictee", date: e.maintenant }, statut: "validee", saisiePar: "will", creeLe: e.maintenant, modifieLe: e.maintenant } as unknown as Matiere;
    const stock: StockMatiere = { matieres: [fictive], preuves: [], quiParleWill: e.quiParleWill, objectif: e.brief.objectif };
    const couvertures = e.structures.filter((s) => s.tirable && (!s.typesAncrage.length || s.typesAncrage.includes(suggere))).map((s) => couvrirStructure(s, fictive, stock, e.debit));
    const proche = couvertures.sort((a, b) => a.manquants.length - b.manquants.length)[0];
    return proche ? manquesLisibles({ ...proche, faible: false, corpsEstimeSec: Number.MAX_SAFE_INTEGER }) : [];
  } catch {
    return [];
  }
}

function cle(c: Pick<Combinaison, "structure" | "ancrage" | "pointDeVue" | "emotion">): string {
  return `${c.structure.id}|${c.ancrage.id}|${c.pointDeVue}|${c.emotion}`;
}

function emotionPossible(e: Emotion, stock: Matiere[], conditions?: Partial<Record<Emotion, TypeMatiere[]>>): boolean {
  const exige = conditions?.[e];
  return !exige || stock.some((m) => exige.includes(m.type));
}

/** Combinaison identique au dernier sujet de la série (réservations comprises) : jamais deux fois d'affilée. */
function identiqueAuDernier(c: Pick<Combinaison, "structure" | "ancrage" | "pointDeVue" | "emotion">, series: EntreeChoix["series"], reseaux: string[]): boolean {
  return reseaux.some((r) => {
    const d = series[r]?.at(-1);
    return !!d && d.structure === c.structure.id && d.matiereIds[0] === c.ancrage.id && d.pointDeVue === c.pointDeVue && d.emotion === c.emotion;
  });
}

export function choisirCombinaison(e: EntreeChoix): ResultatChoix {
  const r = e.regles ?? REGLES_VARIETE;
  const imposees = new Set(e.brief.matiereIdsImposees ?? []);
  const sujetSensiblePropose = proposerSujetSensible(`${e.brief.idee} ${e.brief.pilier ?? ""} ${(e.brief.motsCles ?? []).join(" ")}`);

  // 1. Matières candidates : validées, ni retirées ni périmées, accord présent, texte sûr, compatibles (ou imposées).
  const vraies = e.matieres.filter((m) => utilisable(m, e.maintenant) && accordPresent(m) && !texteSuspect(m.texte) && !(e.matieresPlaquees ?? []).includes(m.id));
  const compatibles = vraies.filter((m) => imposees.has(m.id) || pertinence(m, e.brief) > 0);
  const preuves = e.preuves.filter((p) => utilisable(p, e.maintenant));

  // C53 : réemploi récent sur un réseau coché → mise de côté (« réemploi possible »), sauf matière imposée.
  const reemploi: NonNullable<ManqueChoix["reemploiPossible"]> = [];
  const candidates = compatibles.filter((m) => {
    if (imposees.has(m.id)) return true;
    const u = c53Reemploi(e.usagesMatieres[m.id] ?? [], e.brief.reseaux, e.maintenant, r);
    if (u.exclue) reemploi.push({ matiereId: m.id, numeroSujet: u.dernier?.numero ?? 0, ilYaJours: u.dernier?.ilYaJours ?? 0 });
    return !u.exclue;
  });

  // 3. Aucune candidate : réemploi proposé, sinon ANCRAGE_MANQUANT avec le type le moins présent dans la série.
  if (!candidates.length) {
    const serie = Object.values(e.series).flat();
    const realisables = typesRealisables(e.structures);
    const compte = (t: TypeMatiere) => serie.filter((x) => x.typesAncrage.includes(t)).length;
    const preferes: TypeMatiere[] = e.stadeCompte === "demarrage" ? ["question-recue"] : [];
    const suggere = [...realisables].sort((a, b) => compte(a) - compte(b) || Number(preferes.includes(b)) - Number(preferes.includes(a)) || a.localeCompare(b))[0] ?? "question-recue";
    return {
      ok: false,
      manque: {
        type: "ANCRAGE_MANQUANT",
        etape: 0,
        ceQuIlFaudrait: reemploi.length
          ? "Reprendre une matière déjà utilisée, ou en dicter une autre."
          : (() => {
              const ensuite = ensuiteSansAncrage(e, suggere);
              return `Il faudrait ${LIBELLES_TYPES[suggere]}.${ensuite.length ? ` Puis : ${phraseManques(ensuite)}.` : ""}`;
            })(),
        typeMatiereSuggere: suggere,
        reemploiPossible: reemploi.length ? reemploi : undefined,
      },
      autres: [],
      structuresTirables: 0,
      sujetSensiblePropose,
    };
  }

  // 4. Combinaisons réalisables (temps obligatoires couverts : C67).
  const stock: StockMatiere = { matieres: candidates, preuves, quiParleWill: e.quiParleWill, objectif: e.brief.objectif };
  const structures = e.structures.filter((s) => s.tirable || s.id === e.brief.structureImposee);
  const combinaisons: Combinaison[] = [];
  const couvertures: Couverture[] = [];
  const ancragesPossibles = imposees.size ? candidates.filter((m) => imposees.has(m.id)) : candidates;
  for (const s of structures) {
    if (e.brief.structureImposee && s.id !== e.brief.structureImposee) continue;
    for (const m of ancragesPossibles) {
      if (s.typesAncrage.length && !s.typesAncrage.includes(m.type)) continue;
      if (s.accordRequis && !m.accord?.obtenu) continue;
      let couverture = couvrirStructure(s, m, stock, e.debit);
      let second: Matiere | undefined;
      if (!couverture.realisable && couverture.faible) {
        second = candidates.find((x) => x.id !== m.id && x.type !== m.type);
        if (second) couverture = couvrirStructure(s, m, stock, e.debit, second);
      }
      couvertures.push(couverture);
      if (!couverture.realisable) continue;
      const pdvs = e.pointsDeVueParType[m.type].filter((p) => e.pointsDeVuePermis.includes(p) && (!s.pointsDeVue || s.pointsDeVue.includes(p)));
      for (const pointDeVue of pdvs) {
        for (const emotion of e.emotionsPermises) {
          if (emotion === "neutre" || !emotionPossible(emotion, candidates, e.conditionsEmotions)) continue;
          combinaisons.push({ structure: s, ancrage: m, second, pointDeVue, emotion, couverture, axes: [], regles: [], score: 0, imposee: imposees.has(m.id) || s.id === e.brief.structureImposee });
        }
      }
    }
  }
  const structuresTirables = new Set(combinaisons.filter((c) => c.structure.tirable).map((c) => c.structure.id)).size;

  const autres: ManqueChoix[] = [];
  // C68 : idée reçue et réfutation sur deux termes différents (« informaticien » / « développeur »).
  const idees = candidates.filter((m) => m.type === "idee-recue");
  for (const i of idees) {
    const refutations = [...candidates.filter((m) => m.id !== i.id && ["observation", "avis-will", "etude"].includes(m.type)).map((m) => m.texte), ...preuves.map((p) => p.enonce)];
    const div = refutations.map((t) => termesDivergents(i.texte, t, e.brief.termePivot)).find((d) => d);
    if (div) autres.push({ type: "TERME_A_CONFIRMER", etape: 0, ceQuIlFaudrait: `L'idée reçue parle de « ${div.a} », la réponse de « ${div.b} » : est-ce la même chose ?` });
  }
  // C76 : termes vagues dans une matière candidate.
  const vagues = (m: Matiere) => termesVaguesDe(m.texte, e.termesVagues ?? []);
  const aPreciser = (liste: Matiere[]): ManqueChoix | undefined => {
    const m = liste.find((x) => vagues(x).length);
    return m ? { type: "MATIERE_A_PRECISER", etape: 0, ceQuIlFaudrait: `Que voulez-vous dire par « ${vagues(m)[0]} » ?` } : undefined;
  };

  // 13. Aucune combinaison réalisable : MATIERE_INSUFFISANTE, 0 €, carte précise.
  if (!combinaisons.length) {
    const meilleure = [...couvertures].sort((a, b) => a.manquants.length + Number(a.appuiManquant) - (b.manquants.length + Number(b.appuiManquant)) || b.corpsEstimeSec - a.corpsEstimeSec)[0];
    // E2E-2 données n° 5 : la structure la plus proche seulement, chaque manque une fois, 3 au plus.
    const liste = meilleure ? manquesLisibles(meilleure) : [];
    const ceQuIlFaudrait = liste.length ? `Il manque : ${phraseManques(liste)}.` : "Aucune structure ne s'écrit avec ces matières.";
    const ap = e.passerTermesVagues ? undefined : aPreciser(candidates);
    if (ap) autres.push(ap);
    return { ok: false, manque: { type: "MATIERE_INSUFFISANTE", etape: 0, ceQuIlFaudrait }, autres, structuresTirables: 0, sujetSensiblePropose };
  }

  // 5-6. Règles de série sur chaque réseau coché, puis relâchement dans l'ordre (ou pénalités en démarrage).
  const informations: ViolationControle[] = [];
  for (const c of combinaisons) {
    const axes = new Set<AxeRelachement>();
    for (const reseau of e.brief.reseaux) {
      const serie = e.series[reseau] ?? [];
      const n = Math.max(1, structuresTirables);
      const v51 = c51Rotation(serie, c.emotion, r);
      const v50 = c50Rotation(serie, c.pointDeVue, r);
      const v43 = c43Structure(serie, c.structure.id, n, r);
      const v49 = c49TypeAncrage(serie, c.ancrage.type, r);
      const v52 = c52PartAnecdote(serie, c.ancrage.type === "anecdote-will", e.sujetsValides, r);
      if (v51.length) axes.add("emotion");
      if (v50.length) axes.add("point-de-vue");
      if (v43.length) axes.add("structure");
      if (v49.length) axes.add("type-ancrage");
      if (v52.length) axes.add("part-anecdote");
      c.regles.push(...v51, ...v50, ...v43, ...v49, ...v52);
    }
    c.axes = ORDRE_RELACHEMENT.filter((a) => axes.has(a));
    c.score = scorer(c, e, r);
  }

  // Jamais deux fois de suite la même combinaison (réservation), sauf choix de Will.
  let pool = combinaisons.filter((c) => c.imposee || !identiqueAuDernier(c, e.series, e.brief.reseaux));
  if (!pool.length) pool = combinaisons;

  let retenues: Combinaison[];
  const relaches: AxeRelachement[] = [];
  if (e.modeRotation === "demarrage" || pool.every((c) => c.imposee)) {
    retenues = pool;
  } else {
    let k = 0;
    retenues = pool.filter((c) => c.axes.length === 0);
    while (!retenues.length && k < ORDRE_RELACHEMENT.length) {
      relaches.push(ORDRE_RELACHEMENT[k]);
      k++;
      retenues = pool.filter((c) => c.axes.every((a) => relaches.includes(a)));
    }
    if (!retenues.length) retenues = pool;
  }
  retenues.sort((a, b) => b.score - a.score || cle(a).localeCompare(cle(b)));

  // 12. Les 2 à 3 meilleures, variées : d'abord des structures différentes, puis des matières différentes.
  const choisies: Combinaison[] = [];
  for (const c of retenues) {
    if (choisies.length >= 3) break;
    if (choisies.some((x) => x.structure.id === c.structure.id)) continue;
    choisies.push(c);
  }
  for (const c of retenues) {
    if (choisies.length >= 3) break;
    if (choisies.some((x) => x.structure.id === c.structure.id && x.ancrage.id === c.ancrage.id)) continue;
    choisies.push(c);
  }
  for (const c of retenues) {
    if (choisies.length >= 2) break;
    if (!choisies.includes(c)) choisies.push(c);
  }

  const versChoix = (c: Combinaison): ChoixSerie => ({
    structure: c.structure.id,
    ancrages: [
      { matiereId: c.ancrage.id, type: c.ancrage.type, role: "principal", faible: c.couverture.faible || (["observation", "idee-recue"].includes(c.ancrage.type) && !!c.second) },
      ...(c.second ? [{ matiereId: c.second.id, type: c.second.type, role: "second" as const, faible: false }] : []),
    ],
    pointDeVue: c.pointDeVue,
    emotion: c.emotion,
    pilier: e.brief.pilier ?? c.ancrage.pilier,
    poidsFamilles: poidsFamilles(c, e, candidates, preuves) as ChoixSerie["poidsFamilles"],
    relachements: c.imposee ? [] : c.axes.filter((a) => relaches.includes(a)).map((a) => ({ axe: a, regle: c.regles.find((v) => axeDe(v.controle) === a)?.message ?? a })),
    imposePar: c.imposee ? "will" : undefined,
    modeRotation: e.modeRotation === "demarrage" ? "demarrage" : "normal",
  });

  for (const c of choisies) {
    if (c.imposee) for (const v of c.regles) informations.push({ ...v, bloquant: false, niveau: "info", message: `${v.message} (choix de Will)` });
    else if (e.modeRotation === "demarrage") for (const v of c.regles) informations.push({ ...v, bloquant: false, niveau: "alerte" });
  }

  // 14. Termes vagues dans la matière retenue : « à préciser » (sauf « passer », gardé tel quel avec une alerte).
  const retenue = choisies[0];
  const ap = aPreciser([retenue.ancrage, ...(retenue.second ? [retenue.second] : [])]);
  if (ap && !e.passerTermesVagues) return { ok: false, manque: ap, autres, structuresTirables, sujetSensiblePropose };
  if (ap) informations.push({ controle: "C76", message: `Matière vague gardée telle quelle (${ap.ceQuIlFaudrait})`, bloquant: false, niveau: "alerte" });
  if (retenue.couverture.faible) informations.push({ controle: "C31", message: "Ancrage faible : un second ancrage ou une preuve concrète est demandé.", bloquant: false, niveau: "alerte" });

  return { ok: true, retenue: versChoix(retenue), combinaisons: choisies.map(versChoix), structuresTirables, informations, sujetSensiblePropose, details: choisies, diversite: diversiteDe(e, candidates) };
}

function axeDe(controle: string): AxeRelachement | undefined {
  return ({ C51: "emotion", C50: "point-de-vue", C43: "structure", C49: "type-ancrage", C52: "part-anecdote" } as Record<string, AxeRelachement>)[controle];
}

function typesRealisables(structures: StructureGenerateur[]): TypeMatiere[] {
  const tous: TypeMatiere[] = ["anecdote-will", "avis-will", "cas-client", "parole-dirigeant", "question-recue", "observation", "idee-recue", "etude", "actualite", "demonstration", "limite"];
  const tirables = structures.filter((s) => s.tirable);
  return tous.filter((t) => tirables.some((s) => !s.typesAncrage.length || s.typesAncrage.includes(t)));
}

/** Score (plus haut = meilleur) : pertinence, écarts aux règles de série, préférences de stade, correction « variété ». */
function scorer(c: Combinaison, e: EntreeChoix, r: ReglesVariete): number {
  // Une structure faite pour ce type d'ancrage (cas client → S3) passe devant une structure générique.
  let s = pertinence(c.ancrage, e.brief) + (c.imposee ? 10 : 0) + (c.structure.typesAncrage.includes(c.ancrage.type) ? 1 : 0);
  for (const reseau of e.brief.reseaux) {
    const dix = (e.series[reseau] ?? []).slice(-r.fenetre);
    if (!dix.length) continue;
    const part = (f: (x: ElementSerieEtendu) => boolean) => dix.filter(f).length / dix.length;
    s -= 2 * part((x) => x.structure === c.structure.id);
    s -= 2 * part((x) => x.typesAncrage[0] === c.ancrage.type);
    s -= part((x) => x.pointDeVue === c.pointDeVue);
    s -= part((x) => x.emotion === c.emotion);
    if (c.ancrage.type === "anecdote-will") s -= 2 * part((x) => x.anecdote);
    if (dix.at(-1)?.pilier && dix.at(-1)?.pilier === (e.brief.pilier ?? c.ancrage.pilier)) s -= 0.25;
    if (dix.some((x) => x.matiereIds.includes(c.ancrage.id))) s -= 1;
  }
  if (e.modeRotation === "demarrage") s -= 3 * c.axes.length;
  if (e.stadeCompte === "demarrage" && c.ancrage.type === "question-recue") s += 0.5;
  s += Math.log(e.poidsCorrection?.structure?.[c.structure.id] ?? 1) + Math.log(e.poidsCorrection?.typeAncrage?.[c.ancrage.type] ?? 1);
  if (c.couverture.faible) s -= 1;
  // G4 (§2 sexies) : le récit de cas client au plus 1 vidéo sur 3, même quand les preuves abondent.
  if (e.diversite && c.ancrage.type === "cas-client" && consignesDiversite(e.diversite.serie).recitInterdit) s -= 3;
  return +s.toFixed(4);
}

/** Poids de tirage des familles d'accroche pour cette combinaison (exigences, plafonds, faveurs des réseaux). */
function poidsFamilles(c: Combinaison, e: EntreeChoix, stock: Matiere[], preuves: Preuve[]): Record<string, number> {
  const poids: Record<string, number> = {};
  const types = new Set([c.ancrage.type, ...(c.second ? [c.second.type] : []), ...stock.map((m) => m.type)]);
  for (const f of e.famillesAccroche) {
    const x = f.exige;
    if (x?.matiere && !x.matiere.some((t) => types.has(t))) continue;
    if (x?.preuveChiffree && !preuves.some((p) => p.nature === "chiffree")) continue;
    if (x?.accordAvantApres && !preuves.some((p) => p.client?.accordAvantApres)) continue;
    if (x?.scene && !stock.some((m) => m.type === "anecdote-will" && m.scene)) continue;
    let p = 1;
    let exclue = false;
    for (const reseau of e.brief.reseaux) {
      const serie = e.series[reseau] ?? [];
      const derniers = serie.slice(-2).map((s) => s.familleAccroche);
      if (derniers.length === 2 && derniers.every((d) => d === f.id)) exclue = true;
      if (f.plafond && serie.slice(-f.plafond.sur).filter((s) => s.familleAccroche === f.id).length >= f.plafond.max) exclue = true;
      const fav = e.famillesFavorisees?.[reseau];
      if (fav?.familles.includes(f.id)) p *= fav.poids;
    }
    p *= e.poidsCorrection?.famille?.[f.id] ?? 1;
    if (!exclue) poids[f.id] = +p.toFixed(3);
  }
  // La famille demandée passe seule, SAUF si les limites de série (C43) l'ont exclue : le garde-fou prime.
  const voulue = e.brief.familleAccroche;
  if (voulue && poids[voulue] !== undefined) return { [voulue]: poids[voulue] };
  return poids;
}

export type { ReponseBloquante };

/** G4 (§2 sexies) : consignes de diversité, ruptures possibles avec le stock du jour (mêmes garde-fous). */
function diversiteDe(e: EntreeChoix, stock: Matiere[]): ConsignesDiversite | undefined {
  if (!e.diversite) return undefined;
  const types = new Set(stock.map((m) => m.type));
  const possibles: Rupture[] = ["liste-rapide", "pour-contre"];
  if (types.has("anecdote-will")) possibles.push("erreur-de-will", "coulisses");
  if (types.has("demonstration")) possibles.push("demonstration-ecran", "defi-chronometre");
  if (stock.some((m) => m.type === "question-recue" && m.source.origine === "commentaire")) possibles.push("reponse-commentaire");
  return consignesDiversite(e.diversite.serie, { ruptures: possibles });
}
