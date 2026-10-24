/**
 * Note sur 100 d'un carrousel (lot L6), CALCULÉE PAR LE CODE : aucune IA, aucun réseau. PUR.
 * Réutilise les contrôles existants (porte, rythme, texte, charte) ; les critères qui exigent le rendu lisent des mesures facultatives.
 * Mesure absente : « non mesuré » → points proportionnels (la moitié), jamais bloquant, mais le verdict ne dépasse pas « retouche ».
 */
import { CHARTE_CARROUSEL, texteLisible } from "../../briques/visuels/charte-carrousel";
import { PAGES, type TypePage } from "../../briques/visuels/registre-pages";
import type { ContextePorte } from "../visuels/contrats";
import { controlerCarrousel } from "./porte";
import { MOTS_ROUGE } from "./rythme";
import { interditsDans as interditsPartages, interditsTousEcrivains } from "../qualite-script/regles/interdits";
import { mots, normaliser, sortantsDans } from "./texte";
import { textesDe } from "./textes-de";

export const SEUIL_PRESENTE = 90;
export const SEUIL_RETOUCHE = 85;
export const TEXTE_MIN_PX = 26;
export const SIGNES_LIGNE_MAX = 45;
export const ZONE_VIDE_MAX_PCT = 30;
export const ACCROCHE_MOTS_MAX = 9;
// Inter Display : titres depuis ART-1 ; Archivo Black reste admise pour noter les rendus faits avant ART-1.
export const POLICES_AUTORISEES: readonly string[] = ["Inter Display", "Inter", "Kalam", "Archivo Black"];
/** Part des points accordée à un critère de rendu qui n'a pas été mesuré. */
const PART_NON_MESURE = 0.5;
/** Couleur écrite dans un texte : exactement 3 ou 6 chiffres hexadécimaux, sans lettre ni chiffre autour (« #2026 », « #face » ou un hashtag ne sont pas des couleurs). */
const COULEUR_LITTERALE = /(?<![A-Za-z0-9&])#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![A-Za-z0-9])/g;

/** Les interdits de la production : la liste partagée, la même que celle des générateurs. */
const interditsParDefaut = (texte: string): string[] => [...new Set([...interditsPartages(texte, "ecrire").map((i) => i.libelle), ...interditsTousEcrivains(texte)])];

export interface MesuresPage {
  /** Plus petit texte rendu, en px. */
  plusPetitTextePx?: number;
  /** Plus longue ligne de corps, en signes. */
  signesParLigneMax?: number;
  /** Part de la page sans contenu, en %. */
  zoneVidePct?: number;
  /** Paires texte/fond réellement rendues, avec la taille du texte. */
  contrastes?: { avantPlan: string; fond: string; px: number }[];
  /** Vrai si un élément entre dans les zones réservées à LinkedIn/Meta. */
  zoneInterdite?: boolean;
  photos?: number;
  logosHorsListe?: string[];
  /** Couleurs réellement utilisées au rendu (#RRGGBB). */
  couleurs?: string[];
  polices?: string[];
}
export interface MesuresRendu {
  pages: MesuresPage[];
}
export interface OptionsNote {
  /** Critère 9 (vision / humain) : noté par une personne, de 0 à 8. Absent = 0, « à noter ». */
  valeurHumaine?: number;
  /** Mots ou formules interdits ; par défaut la liste partagée de la production. */
  interditsDans?: (texte: string) => string[];
  /** Vrai quand une liste de faits est validée : les chiffres sont alors permis. Défaut : faux. */
  faitsDisponibles?: boolean;
}

export type NiveauCritere = "vert" | "orange" | "rouge";
export interface CritereNote {
  id: number;
  nom: string;
  points: number;
  max: number;
  auto: boolean;
  bloquant: boolean;
  niveau: NiveauCritere;
  nonMesure: boolean;
  raison: string;
}
export type VerdictNote = "presente" | "retouche" | "refait" | "bloque";
export interface NoteCarrousel {
  total: number;
  criteres: CritereNote[];
  verdict: VerdictNote;
  bloquants: string[];
}

/** Famille de mise en page (`registre-pages.ts`) : deux pages de même famille à la suite sont refusées. */
const famille = (type: string | undefined): string => (type && type in PAGES ? PAGES[type as TypePage].famille : type) || "?";

interface PageLue {
  type?: string;
  principal?: string;
}
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
const niveauDe = (points: number, max: number, rouge: boolean): NiveauCritere => (rouge ? "rouge" : points >= max ? "vert" : "orange");

function lirePages(spec: unknown): PageLue[] {
  const pages = (spec as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(pages)) return [];
  return pages.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const principal = typeof o.titre === "string" ? o.titre : typeof o.message === "string" ? o.message : undefined;
    return { type: typeof o.type === "string" ? o.type : undefined, ...(principal !== undefined ? { principal } : {}) };
  });
}

/** Les mesures viennent d'un JSON de rendu : le typage ne protège pas. Seules les valeurs VALIDES comptent, le reste est « non mesuré ». */
const nombreMesure = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const booleen = (v: unknown): v is boolean => typeof v === "boolean";
const listeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const listeNonVideDeChaines = (v: unknown): v is string[] => listeDeChaines(v) && v.length > 0;
type Paire = { avantPlan: string; fond: string; px: number };
const pairesValides = (v: unknown): v is Paire[] =>
  Array.isArray(v) && v.length > 0 && v.every((c) => c !== null && typeof c === "object" && typeof c.avantPlan === "string" && typeof c.fond === "string" && typeof c.px === "number" && Number.isFinite(c.px) && c.px > 0);

/** Une valeur valide mesurée sur chaque page, ou `undefined` si une page n'a pas de mesure valide. Ne lève jamais. */
function mesure<T>(m: MesuresRendu | undefined, n: number, lire: (p: MesuresPage) => unknown, valide: (v: unknown) => v is T): T[] | undefined {
  const pages: unknown = m?.pages;
  if (!Array.isArray(pages) || pages.length < n || n === 0) return undefined;
  const valeurs = pages.slice(0, n).map((p) => (p !== null && typeof p === "object" ? lire(p as MesuresPage) : undefined));
  return valeurs.every(valide) ? (valeurs as T[]) : undefined;
}

function critere(c: Omit<CritereNote, "niveau" | "nonMesure"> & { rouge?: boolean; nonMesure?: boolean }): CritereNote {
  const { rouge, nonMesure, ...reste } = c;
  return { ...reste, niveau: niveauDe(c.points, c.max, rouge ?? false), nonMesure: nonMesure ?? false };
}

const LIEN = /(?<![a-z0-9])(?:https?|ftp|mailto)\s*:|www\.|\/\/|[\p{L}\p{N}][\p{L}\p{N}-]*(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}\/\S*/iu;
const DOMAINE_NU = /[\p{L}\p{N}][\p{L}\p{N}-]*(?:\.[\p{L}\p{N}-]+)*\.(?:com|fr|net|org|io|ai|eu)(?![\p{L}\p{N}])/giu;

export function noterCarrousel(spec: unknown, mesures?: MesuresRendu, options: OptionsNote = {}): NoteCarrousel {
  const pages = lirePages(spec);
  const n = pages.length;
  const derniere = n;
  const ctx: ContextePorte = { faitsDisponibles: options.faitsDisponibles ?? false, interditsDans: options.interditsDans ?? interditsParDefaut };
  const { rapport } = controlerCarrousel(spec, ctx);
  const textes = textesDe(spec, { chaines: 500, longueur: 2000, profondeur: 8 });
  const duRapport = (...codes: string[]) => rapport.controles.filter((c) => codes.includes(c.code));

  // 1. Conformité (15, tout ou rien)
  const fautes: string[] = duRapport("SCHEMA", "INTERDIT", "TUTOIEMENT", "J_AIDE", "EXPRESSION_BANNIE", "CHIFFRE", "CLASSEMENT").map((c) => c.phrase);
  fautes.push(...duRapport("SORTANT").filter((c) => c.page !== derniere).map((c) => c.phrase));
  for (let i = 0; i < n; i++) {
    const t = normaliser(textes.filter((x) => x.page === i + 1).map((x) => x.texte).join(" "));
    // Le cas concret T26 porte l'étiquette « Scénario type · exemple illustratif », posée par le code.
    if (t.includes("cas concret") && !t.includes("scenario type") && pages[i]?.type !== "T26") fautes.push(`Page ${i + 1} : un cas concret sans l'étiquette « Scénario type ».`);
  }
  // Toute autre faute rouge de la porte (anglais, mot trop long, rythme…) est reprise ici : la note ne peut pas être plus indulgente que la porte.
  // L'exception du SORTANT de la dernière page (lignes 125 et 132) est redondante avec la porte rouge : un SORTANT rouge ailleurs que sur la dernière page est déjà repris plus haut, et sur la dernière page l'appel à l'action le permet.
  const reprises = new Set(fautes);
  const dernierSortant = (c: { code: string; page?: number }) => c.code === "SORTANT" && c.page === derniere;
  for (const c of rapport.controles) if (c.niveau === "rouge" && !dernierSortant(c) && !reprises.has(c.phrase)) fautes.push(c.phrase);
  const photos = mesure(mesures, n, (p) => p.photos, nombreMesure);
  const logos = mesure(mesures, n, (p) => p.logosHorsListe, listeDeChaines);
  const zones = mesure(mesures, n, (p) => p.zoneInterdite, booleen);
  if (photos?.some((x) => x > 0)) fautes.push("Une photo est présente ; aucune photo n'est permise.");
  if (logos?.some((l) => l.length > 0)) fautes.push(`Logo hors liste blanche : ${logos.flat().join(", ")}.`);
  if (zones?.some(Boolean)) fautes.push("Un élément entre dans les zones réservées à LinkedIn/Meta.");
  const conformiteNonMesuree = !photos || !logos || !zones;
  const c1 = critere({
    id: 1, nom: "Conformité", max: 15, auto: true, points: fautes.length === 0 ? 15 : 0, bloquant: fautes.length > 0, rouge: fautes.length > 0, nonMesure: conformiteNonMesuree,
    raison: fautes.length > 0 ? fautes.join(" ") : conformiteNonMesuree ? "Texte conforme ; photos, logos et zones non mesurés." : "Conforme.",
  });

  // 2. Lisibilité mobile (12, tout ou rien)
  const tailles = mesure(mesures, n, (p) => p.plusPetitTextePx, nombreMesure);
  const lignes = mesure(mesures, n, (p) => p.signesParLigneMax, nombreMesure);
  let c2: CritereNote;
  if (!tailles || !lignes) {
    c2 = critere({ id: 2, nom: "Lisibilité mobile", max: 12, auto: true, bloquant: false, nonMesure: true, points: Math.round(12 * PART_NON_MESURE), raison: "Non mesuré : tailles et longueurs de ligne du rendu absentes." });
  } else {
    const f: string[] = [];
    tailles.forEach((px, i) => px < TEXTE_MIN_PX && f.push(`Page ${i + 1} : texte de ${px} px (minimum ${TEXTE_MIN_PX} px).`));
    lignes.forEach((s, i) => s > SIGNES_LIGNE_MAX && f.push(`Page ${i + 1} : ligne de ${s} signes (maximum ${SIGNES_LIGNE_MAX}).`));
    c2 = critere({ id: 2, nom: "Lisibilité mobile", max: 12, auto: true, points: clamp(12 - 4 * f.length, 12), bloquant: f.length > 0, rouge: f.length > 0, raison: f.length > 0 ? f.join(" ") : "Tout texte ≥ 26 px, lignes ≤ 45 signes." });
  }

  // 3. Contraste (8, tout ou rien)
  const paires = mesure(mesures, n, (p) => p.contrastes, pairesValides);
  let c3: CritereNote;
  if (!paires) {
    c3 = critere({ id: 3, nom: "Contraste", max: 8, auto: true, bloquant: false, nonMesure: true, points: Math.round(8 * PART_NON_MESURE), raison: "Non mesuré : paires de couleurs du rendu absentes." });
  } else {
    const f: string[] = [];
    paires.forEach((liste, i) =>
      liste.forEach((c) => {
        let ok = false;
        try {
          ok = texteLisible(c.avantPlan, c.fond, c.px);
        } catch {
          /* couleur mal formée : refusée */
        }
        if (!ok) f.push(`Page ${i + 1} : ${c.avantPlan} sur ${c.fond} à ${c.px} px ne passe pas le contraste AA.`);
      }),
    );
    c3 = critere({ id: 3, nom: "Contraste", max: 8, auto: true, points: clamp(8 - 4 * f.length, 8), bloquant: f.length > 0, rouge: f.length > 0, raison: f.length > 0 ? f.join(" ") : "AA partout." });
  }

  // 4. Hiérarchie (10 ; < 6 bloque)
  const fHier: string[] = [];
  pages.forEach((p, i) => {
    if (p.type !== "T21" && !p.principal) fHier.push(`Page ${i + 1} : pas de titre ni de message principal.`);
    else if (p.principal && p.principal.length > 70) fHier.push(`Page ${i + 1} : titre de ${p.principal.length} signes (70 au plus pour rester lu en premier).`);
  });
  const doubles = duRapport("TITRE_DOUBLE");
  const pHier = clamp(10 - 2 * fHier.length - 3 * doubles.length, 10);
  const c4 = critere({ id: 4, nom: "Hiérarchie", max: 10, auto: true, points: pHier, bloquant: pHier < 6, rouge: pHier < 6, raison: [...fHier, ...doubles.map((c) => c.phrase)].join(" ") || "Un titre clair par page." });

  // 5. Densité (8)
  const denses = duRapport("DENSITE");
  const rouges = denses.filter((c) => c.niveau === "rouge");
  const vides = mesure(mesures, n, (p) => p.zoneVidePct, nombreMesure);
  const fVide = vides?.flatMap((v, i) => (v > ZONE_VIDE_MAX_PCT ? [`Page ${i + 1} : ${v} % de zone vide (maximum ${ZONE_VIDE_MAX_PCT} %).`] : [])) ?? [];
  const brut = rouges.length > 0 ? 0 : clamp(8 - 3 * (denses.length + fVide.length), 8);
  const c5 = critere({
    id: 5, nom: "Densité", max: 8, auto: true, points: vides ? brut : Math.round(brut * PART_NON_MESURE), bloquant: false, nonMesure: !vides,
    rouge: rouges.length > 0,
    raison: [...denses.map((c) => c.phrase), ...fVide].join(" ") || (vides ? `Pages ≤ ${MOTS_ROUGE} mots, zone vide ≤ ${ZONE_VIDE_MAX_PCT} %.` : "Mots comptés ; zone vide non mesurée."),
  });
  if (!rouges.length && fVide.length) c5.niveau = "orange";

  // 6. Cohérence de marque (12 ; < 9 bloque)
  const permises = new Set(Object.values(CHARTE_CARROUSEL.couleurs).map((c) => c.toUpperCase()));
  const hors = new Set<string>();
  for (const t of textes) for (const m of t.texte.matchAll(COULEUR_LITTERALE)) if (!permises.has(m[0].toUpperCase())) hors.add(m[0].toUpperCase());
  const couleursMesurees = mesure(mesures, n, (p) => p.couleurs, listeNonVideDeChaines);
  couleursMesurees?.flat().forEach((c) => !permises.has(c.toUpperCase()) && hors.add(c.toUpperCase()));
  const policesMesurees = mesure(mesures, n, (p) => p.polices, listeNonVideDeChaines);
  const mauvaisesPolices = [...new Set((policesMesurees ?? []).flat().filter((p) => !POLICES_AUTORISEES.includes(p)))];
  const sombres = pages.filter((p) => p.type === "T21").length;
  const fMarque: string[] = [];
  if (hors.size) fMarque.push(`Couleur hors de la charte : ${[...hors].join(", ")}.`);
  if (mauvaisesPolices.length) fMarque.push(`Police hors charte : ${mauvaisesPolices.join(", ")}.`);
  if (sombres > 1) fMarque.push(`${sombres} pages sombres (une seule permise).`);
  const pMarque = clamp(12 - 6 * hors.size - 4 * mauvaisesPolices.length - 6 * Math.max(0, sombres - 1), 12);
  const marqueNonMesuree = !couleursMesurees || !policesMesurees;
  const c6 = critere({
    id: 6, nom: "Cohérence de marque", max: 12, auto: true, points: pMarque, bloquant: pMarque < 9, rouge: pMarque < 9, nonMesure: marqueNonMesuree,
    raison: fMarque.join(" ") || (marqueNonMesuree ? "Texte sans couleur hors charte ; couleurs et polices du rendu non mesurées." : "Couleurs et polices de la charte."),
  });

  // 7. Diversité (10)
  const types = new Set(pages.map((p) => p.type));
  const requis = n >= 8 ? 5 : 4;
  const suites = pages.flatMap((p, i) => (i > 0 && famille(pages[i - 1].type) === famille(p.type) ? [i + 1] : []));
  const manque = Math.max(0, requis - types.size);
  const fDiv: string[] = [];
  if (suites.length) fDiv.push(`Pages ${suites.map((i) => `${i - 1}-${i}`).join(", ")} : même famille de mise en page à la suite.`);
  if (manque) fDiv.push(`${types.size} types de pages ; ${requis} au moins pour ${n} pages.`);
  const c7 = critere({ id: 7, nom: "Diversité", max: 10, auto: true, points: clamp(10 - 5 * suites.length - 3 * manque, 10), bloquant: false, rouge: suites.length > 0 || manque > 0, raison: fDiv.join(" ") || `${types.size} types, aucune suite de même famille.` });

  // 8. Accroche page 1 (10 ; < 6 bloque)
  const accroche = pages[0]?.principal;
  const nMots = accroche ? mots(accroche).length : 0;
  const pAcc = accroche ? clamp(10 - 2 * Math.max(0, nMots - ACCROCHE_MOTS_MAX), 10) : 0;
  const c8 = critere({ id: 8, nom: "Accroche page 1", max: 10, auto: true, points: pAcc, bloquant: pAcc < 6, rouge: pAcc < 6, raison: !accroche ? "Pas d'accroche en page 1." : nMots > ACCROCHE_MOTS_MAX ? `Accroche de ${nMots} mots (${ACCROCHE_MOTS_MAX} au plus).` : `Accroche de ${nMots} mots.` });

  // 9. Valeur et lien Axion : jugement humain, non calculé
  const vh = options.valeurHumaine;
  // Absente ou invalide (NaN, infinie, hors 0-8, pas un nombre) : non mesurée, 0 point, verdict au plus « retouche ».
  const vhValide = typeof vh === "number" && Number.isFinite(vh) && vh >= 0 && vh <= 8;
  const c9 = critere({
    id: 9, nom: "Valeur et lien Axion", max: 8, auto: false, points: vhValide ? clamp(Math.round(vh), 8) : 0, bloquant: false, nonMesure: !vhValide,
    raison: vh === undefined ? "À noter par une personne (non calculé)." : vhValide ? "Noté par une personne." : "Valeur humaine invalide (0 à 8 attendu) : non mesurée.",
  });

  // 10. Appel à l'action (7)
  const dernier = pages[n - 1];
  const txtFin = textes.filter((t) => t.page === derniere).map((t) => t.texte).join(" ");
  const lien = LIEN.test(txtFin);
  const nus = (txtFin.match(DOMAINE_NU) ?? []).length;
  const actions = new Set(sortantsDans(txtFin).map((s) => s.genre)).size;
  const fCta: string[] = [];
  if (dernier?.type !== "T21") fCta.push("La dernière page n'est pas la page d'invitation à écrire en message privé.");
  if (lien) fCta.push("La dernière page contient un lien.");
  if (nus > 1) fCta.push(`${nus} domaines écrits sur la dernière page (un seul au plus).`);
  if (actions > 1) fCta.push("Plusieurs actions proposées sur la dernière page (une seule).");
  const pCta = dernier?.type !== "T21" ? 0 : clamp(7 - 5 * Number(lien) - 3 * Number(nus > 1) - 3 * Number(actions > 1), 7);
  const c10 = critere({ id: 10, nom: "Appel à l'action", max: 7, auto: true, points: pCta, bloquant: false, rouge: fCta.length > 0, raison: fCta.join(" ") || "Message privé, une seule action." });

  const criteres = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
  const total = criteres.reduce((s, c) => s + c.points, 0);
  const totalInvalide = !Number.isFinite(total);
  const bloquants = criteres.filter((c) => c.bloquant).map((c) => `${c.nom} (${c.points}/${c.max}) : ${c.raison}`);
  const nonMesure = criteres.some((c) => c.nonMesure);
  let verdict: VerdictNote;
  if (totalInvalide || bloquants.length > 0 || rapport.verdict === "rouge") verdict = "bloque";
  else if (total < SEUIL_RETOUCHE) verdict = "refait";
  else if (total < SEUIL_PRESENTE || nonMesure) verdict = "retouche";
  else verdict = "presente";
  return { total, criteres, verdict, bloquants };
}
