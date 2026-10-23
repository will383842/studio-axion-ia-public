/**
 * PROPRIÉTÉS DES ÉCRANS (brique `ecrans-motion`) : des écrans calés (horloge de la vidéo) et des captures, aux
 * propriétés de chaque écran rendu seul ; textes de chaque boîte ; mise en page ajustée ; contrôle avant rendu.
 * PUR, sans alias « @/ ». N'importe rien d'un moteur : les entrées ont les types de `types.ts`.
 */
import { BANDE_SOUS_TITRES, boites, boiteDans, charteDuoPour, zonesEcran, type BoitesEcran, type BoiteTexteEcran, type OptionsBoites, type ZoneProtegeePct } from "./geometrie";
import { ajuster, enCapitales, largeurTexte, sansBalises } from "./mesure";
import { FPS_ECRANS, MARQUE_ECRANS, type CaptureEcran, type ContenuEcran, type EcranCale, type ProprietesEcran, type VisuelCale, type VisuelEcran } from "./types";

export type EntreeEcrans = {
  /** Écrans calés, dans l'ordre. */
  ecrans: readonly EcranCale[];
  /** Captures disponibles, par clé. */
  captures: Readonly<Record<string, CaptureEcran>>;
  /** Zone protégée (union des réseaux visés), en pourcentages. */
  zoneProtegee: ZoneProtegeePct;
  /** Bande des sous-titres, en fraction de la hauteur (`BANDE_SOUS_TITRES`, 14 %, par défaut). */
  bandeSousTitres?: number;
  largeur?: number;
  hauteur?: number;
};

function resoudre(v: VisuelCale, captures: EntreeEcrans["captures"], id: string): VisuelEcran {
  if ("objet" in v) return v.textes ? { objet: v.objet, textes: [...v.textes] } : { objet: v.objet };
  const c = captures[v.capture.cle];
  if (!c) throw new Error(`Écran ${id} · la capture « ${v.capture.cle} » est introuvable.`);
  return { capture: { ...c } };
}

function contenuResolu(e: EcranCale, captures: EntreeEcrans["captures"]): ContenuEcran<VisuelEcran> {
  // Recopie sans les champs propres à l'écran calé.
  const { id, fond, debutMs, finMs, evenements, jeu, ...contenu } = e;
  void jeu;
  void fond;
  void debutMs;
  void finMs;
  void evenements;
  if (contenu.type === "etape" || contenu.type === "objet") return { ...contenu, visuel: resoudre(contenu.visuel, captures, id) };
  return structuredClone(contenu) as ContenuEcran<VisuelEcran>;
}

/** Propriétés de tous les écrans, dans l'ordre (1080 × 1920 par défaut). Lève une erreur claire si une capture manque. */
export function proprietesEcrans(entree: EntreeEcrans): ProprietesEcran[] {
  const largeur = entree.largeur ?? 1080;
  const hauteur = entree.hauteur ?? 1920;
  const { utile: zone, dessin } = zonesEcran(entree.zoneProtegee, largeur, hauteur, entree.bandeSousTitres ?? BANDE_SOUS_TITRES);
  return entree.ecrans.map(
    (e) =>
      ({
        id: e.id,
        largeur,
        hauteur,
        fps: FPS_ECRANS,
        debutMs: e.debutMs,
        finMs: e.finMs,
        fond: e.fond,
        marque: MARQUE_ECRANS,
        zone: { ...zone },
        dessin: { ...dessin },
        evenements: e.evenements.map((ev) => ({ cible: ev.cible, ms: Math.max(0, ev.ms - e.debutMs) })),
        // L2 : le jeu tiré, seulement s'il est donné (absent : propriétés et empreinte de rendu inchangées).
        ...(e.jeu ? { jeu: { ...e.jeu } } : {}),
        ...contenuResolu(e, entree.captures),
      }) as ProprietesEcran,
  );
}

/** Nombre d'images d'un écran (25 i/s), au moins une. */
export function imagesEcran(p: Pick<ProprietesEcran, "debutMs" | "finMs" | "fps">): number {
  return Math.max(1, Math.round(((p.finMs - p.debutMs) / 1000) * (p.fps || FPS_ECRANS)));
}

/** Les textes écrits dans chaque boîte de l'écran (nom de boîte → texte balisé). */
export function textesEcran(p: ProprietesEcran): Record<string, string> {
  const t: Record<string, string> = { marque: p.marque };
  const etiquette = "etiquette" in p && p.etiquette ? p.etiquette : undefined;
  if (etiquette) t.etiquette = etiquette;
  const lignes = (l: readonly string[]) => l.forEach((x, i) => (t[`titre-${i + 1}`] = x));
  const puces = (l: readonly string[]) => l.forEach((x, i) => (t[`puce-${i + 1}`] = x));
  switch (p.type) {
    case "accroche":
    case "titre":
      lignes(p.lignes);
      break;
    case "chiffre":
      t.nombre = String(p.nombre);
      t.unite = p.unite;
      if (p.pastilles.length) t.pastilles = p.pastilles.join(" · ");
      break;
    case "liste-avant":
      t.titre = p.titre;
      p.taches.forEach((x, i) => (t[`tache-${i + 1}`] = x));
      if (p.total) t.total = p.total.valeur;
      break;
    case "etape":
      t.etiquette = `Étape ${String(p.numero).padStart(2, "0")}`;
      t.titre = p.titre;
      t.ligne = p.ligne;
      puces(p.puces);
      break;
    case "objet":
      t.titre = p.titre;
      if (p.ligne) t.ligne = p.ligne;
      break;
    case "preuve":
      t.titre = p.titre;
      puces(p.puces);
      break;
    case "resultat":
      t.titre = p.titre;
      t["etiquette-avant"] = "Avant";
      t.avant = p.avant;
      t["etiquette-maintenant"] = "Maintenant";
      t.maintenant = p.maintenant;
      t.ligne = p.ligne;
      break;
    case "question":
      lignes(p.lignes);
      t.question = p.question;
      break;
    case "appel-mot":
      t.invite = p.invite;
      t.mot = p.mot;
      t.suite = p.suite;
      break;
    case "promesse": {
      const c = couperCadeau(p);
      t.invite = p.invite;
      t.cadeau = c.tete;
      if (c.suite) t["cadeau-suite"] = c.suite;
      t.ligne = p.ligne;
      break;
    }
    case "lien":
      t.titre = p.titre;
      t.lien = p.lien;
      t.signature = p.signature;
      break;
  }
  return t;
}

/** Options de gabarit tirées du contenu (nombre de lignes, de puces, de tâches, de pastilles ; accroche centrée). */
export function optionsDe(p: ContenuEcran<unknown>): OptionsBoites {
  switch (p.type) {
    case "accroche":
      return { lignes: p.lignes.length, centrer: true };
    case "titre":
    case "question":
      return { lignes: p.lignes.length };
    case "etape":
    case "preuve":
      return { puces: p.puces.length };
    case "liste-avant":
      return { taches: p.taches.length };
    case "chiffre":
      return { pastilles: p.pastilles.length, compteur: p.compteur };
    default:
      return {};
  }
}

/** Lignes d'un texte coupé à la largeur (mot entier, jamais coupé au milieu). */
export function couperTexte(texte: string, b: Pick<BoiteTexteEcran, "police" | "approche" | "capitales">, taille: number, largeurMax: number): string[] {
  const mots = sansBalises(b.capitales ? enCapitales(texte) : texte).split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let courante = "";
  for (const m of mots) {
    const essai = courante ? `${courante} ${m}` : m;
    if (courante && largeurTexte(essai, b.police, taille, b.approche) > largeurMax) {
      lignes.push(courante);
      courante = m;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** Texte posé : sa boîte, la taille rendue (ajustée à la largeur), ses lignes, et s'il tient. */
export type TextePose = BoiteTexteEcran & { texte: string; tailleRendue: number; lignes: string[]; tient: boolean };

/** Ajuste un texte à sa boîte : une ligne (affiche) par pas de 4 px, ou plusieurs lignes coupées à la largeur. */
export function poserTexte(b: BoiteTexteEcran, texte: string): TextePose {
  const mesure = b.capitales ? enCapitales(texte) : texte;
  if (b.lignesMax <= 1) {
    const r = ajuster(mesure, b.police, b.taille, b.boite.largeur, Math.min(b.plancher, b.taille), b.approche);
    return { ...b, texte, tailleRendue: r.taille, lignes: [sansBalises(mesure)], tient: r.tient };
  }
  let taille = b.taille;
  const plancher = Math.min(b.plancher, b.taille);
  const tient = (t: number) => {
    const l = couperTexte(texte, b, t, b.boite.largeur);
    return l.length <= b.lignesMax && l.every((x) => largeurTexte(x, b.police, t, b.approche) <= b.boite.largeur);
  };
  while (taille > plancher && !tient(taille)) taille = Math.max(plancher, taille - 4);
  return { ...b, texte, tailleRendue: taille, lignes: couperTexte(texte, b, taille, b.boite.largeur), tient: tient(taille) };
}

/** Boîtes de l'écran dans sa zone, selon son type et son contenu. */
export function boitesEcran(p: ProprietesEcran): BoitesEcran {
  const options = p.type === "promesse" && couperCadeau(p).suite ? { ...optionsDe(p), suiteCadeau: true } : optionsDe(p);
  return boites(p.type, p.zone, charteDuoPour(p.hauteur), options, { ...(p.dessin ? { dessin: p.dessin } : {}), ...(p.basFil !== undefined ? { basFil: p.basFil } : {}) });
}

/**
 * Mots après lesquels une affiche ne s'arrête pas (articles, déterminants, prépositions, conjonctions) : « TOUTE LA
 * STRUCTURE DE » ou « … DE CETTE » laisseraient la phrase en suspens.
 */
const MOTS_OUTILS = new Set(
  "à au aux ce ces cet cette chez d' dans de des du en et l' la le les leur leurs ma mes mon nos notre ou par pour sa sans ses son sur ta tes ton un une vos votre avec que qui".split(" "),
);
/** Une affiche coupée garde au moins une fois et demie le plancher de la charte : lisible de loin. */
const TETE_PLANCHER = 1.5;

/**
 * Cadeau d'une promesse : entier s'il tient sur une ligne d'affiche ; sinon coupé en une tête (le plus long début de la
 * phrase qui tient à au moins 1,5 fois le plancher et ne finit pas sur un mot-outil) écrite en grand, et sa suite, écrite
 * en ligne dessous (référence `s20`). Sans coupe possible, le cadeau reste entier (et le contrôle refuse l'écran).
 */
export function couperCadeau(p: Extract<ProprietesEcran, { type: "promesse" }>): { tete: string; suite: string | null } {
  const boite = boites("promesse", p.zone, charteDuoPour(p.hauteur), {}, p.dessin ? { dessin: p.dessin } : {}).textes.find((b) => b.nom === "cadeau");
  if (!boite || poserTexte(boite, p.cadeau).tient) return { tete: p.cadeau, suite: null };
  const mots = p.cadeau.split(/\s+/).filter(Boolean);
  const seuil = Math.min(boite.taille, TETE_PLANCHER * boite.plancher);
  for (let n = mots.length - 1; n >= 1; n--) {
    const dernier = sansBalises(mots[n - 1]).toLowerCase().replace(/[’]/g, "'");
    if (MOTS_OUTILS.has(dernier) || /^[dl]'$/.test(dernier)) continue;
    // Un accent ouvert dans la tête (« *toute la structure de… »), refermé à la coupe.
    const debut = mots.slice(0, n).join(" ");
    const tete = (debut.match(/\*/g)?.length ?? 0) % 2 ? `${debut}*` : debut;
    const pose = poserTexte(boite, tete);
    if (pose.tient && pose.tailleRendue >= seuil - 0.01) return { tete, suite: sansBalises(mots.slice(n).join(" ")) };
  }
  return { tete: p.cadeau, suite: null };
}

/** Mise en page de l'écran : chaque texte posé dans sa boîte (marque comprise). */
export function disposer(p: ProprietesEcran): { textes: TextePose[]; boites: BoitesEcran } {
  const b = boitesEcran(p);
  const t = textesEcran(p);
  const textes = [b.marque, ...b.textes].filter((x) => t[x.nom] !== undefined).map((x) => poserTexte(x, t[x.nom]));
  return { textes, boites: b };
}

/**
 * Contrôle des propriétés d'un écran avant le rendu : liste des refus, en français (vide = valide). Durée, marque,
 * captures, textes sous le plancher ou qui ne tiennent pas dans leur boîte, textes (et objets qui en portent) hors de la
 * zone utile, objets sans texte hors de la zone de dessin.
 */
export function controlerProprietes(p: ProprietesEcran): string[] {
  const pb: string[] = [];
  const nom = `Écran ${p.id ?? "?"}`;
  if (!(p.finMs > p.debutMs)) pb.push(`${nom} · durée nulle.`);
  if (!p.marque || !p.marque.trim()) pb.push(`${nom} · la marque est absente.`);
  else if (p.marque !== MARQUE_ECRANS) pb.push(`${nom} · la marque doit être « ${MARQUE_ECRANS} ».`);
  if (!(p.largeur > 0) || !(p.hauteur > 0)) pb.push(`${nom} · dimensions de l'image absentes.`);
  if (!(p.zone?.largeur > 0) || !(p.zone?.hauteur > 0)) pb.push(`${nom} · zone utile vide.`);
  if ((p.type === "etape" || p.type === "objet") && "capture" in p.visuel) {
    const c = p.visuel.capture;
    if (!(c.largeur > 0) || !(c.hauteur > 0)) pb.push(`${nom} · capture sans dimensions.`);
    if (c.sorte === "video" && !(c.dureeSec !== undefined && c.dureeSec > 0)) pb.push(`${nom} · film sans durée.`);
  }
  if (pb.length) return pb;
  const { textes, boites: b } = disposer(p);
  for (const t of textes) {
    if (!sansBalises(t.texte).trim()) {
      if (t.nom === "marque") continue;
      pb.push(`${nom} · texte vide (${t.nom}).`);
      continue;
    }
    if (t.soumisAuPlancher && t.tailleRendue < t.plancher - 0.01) pb.push(`${nom} · texte sous le plancher (${t.nom} : « ${sansBalises(t.texte)} »).`);
    else if (!t.tient) pb.push(`${nom} · texte qui ne tient pas dans sa boîte (${t.nom} : « ${sansBalises(t.texte)} »).`);
    if (!boiteDans(t.boite, p.zone)) pb.push(`${nom} · texte hors de la zone utile (${t.nom}).`);
  }
  for (const o of b.objets) {
    if (o.porteTexte && !boiteDans(o.boite, p.zone)) pb.push(`${nom} · objet hors de la zone utile (${o.nom}).`);
    else if (!o.porteTexte && !boiteDans(o.boite, p.dessin ?? p.zone)) pb.push(`${nom} · objet hors de la zone de dessin (${o.nom}).`);
  }
  return pb;
}
