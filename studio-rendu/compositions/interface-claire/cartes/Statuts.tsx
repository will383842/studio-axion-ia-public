import React from "react";
/**
 * CARTE STATUTS — « Tableau de suivi » (redessinée le 15/10/2026, standard premium, designer n° 2).
 *
 * Un tableau d'outil de gestion : en-tête de colonnes (« Élément », « Statut ») en titre sable-profond sur un filet ;
 * lignes alternées ivoire / ivoire-creux ; colonne « Élément » avec le nom en titre et le détail en corps
 * sable-profond ; colonne « Statut » avec une PILULE À POINT : sable = à faire, orange-voile = en cours (la prochaine
 * à basculer), orange = fait, encre barrée = inutile. Plus de pastilles d'initiales. La dernière pilule passée à « fait »
 * est le seul héros (relief), et ce relief passe d'une ligne à l'autre.
 *
 * Mouvement : N2 la ligne entre sur son mot par translation (0,03 L, « glisse ») et fondu ; à la bascule, l'ancienne
 * pilule sort par le bas pendant que la nouvelle descend (tambour, 0,16 s) ; à chaque fois la ligne flashe en orange
 * (≥ 5 % de l'image) puis revient. La liste défile pour garder la ligne en cours visible. N3 le point de la pilule
 * « en cours » respire. Props et exports inchangés. Pur : tout dérive de `t`.
 */
import { degradeOrange, eclat, filetPx, fonduEntree, glisse, Grain, largeurCorps, largeurCorpsCarte, largeurTitre, NUANCES, pose, reflet, styleCorps, styleHeros, styleTitre, tailleQuiTient, TYPO } from "../variantes/premium-2";

/** Un état de bouton : texte et icône facultative (nom d'`elements.tsx`, `NOMS_ICONES`). */
export type EtatStatut = { texte: string; icone?: string };

export type LigneStatut = {
  /** Nom affiché (une personne, un client, un document…). */
  nom: string;
  /** Seconde ligne discrète (entreprise, montant fourni par le script…), facultative. */
  detail?: string;
  /** Lettres de l'avatar ; par défaut les initiales du nom. (Gardé pour la compatibilité des plans, plus affiché.) */
  initiales?: string;
  /** Instant (s) où la ligne arrive ; 0 ou moins = posée avec la carte. */
  a: number;
  /** Instant (s) du mot où le statut bascule ; absent = ne bascule pas. */
  bascule?: number;
  /** États propres à cette ligne (sinon ceux de la liste). */
  avant?: EtatStatut;
  apres?: EtatStatut;
  /** Après la bascule, la ligne est « inutile » (pilule encre barrée). Déduit aussi d'un état « Inutile ». */
  inutile?: boolean;
};

export type StatutsProps = {
  /** Temps courant (secondes, même horloge que la carte). */
  t: number;
  largeurImage: number;
  /** Hauteur d'une ligne (pixels, ≈ 0,055 × hauteur de l'image). */
  hauteurLigne: number;
  /** Nombre de lignes visibles dans la carte : au-delà, la liste défile. */
  lignesVisibles: number;
  /** États par défaut du bouton (ex. « À faire » → « Fait »). */
  avant: EtatStatut;
  apres: EtatStatut;
  lignes: LigneStatut[];
};

/** Hauteur du contenu (pixels) pour dimensionner la `<Carte>`. */
export function hauteurStatuts(hauteurLigne: number, lignesVisibles: number): number {
  return hauteurLigne * lignesVisibles;
}

const TAMBOUR = 0.16;
const DEFILE = 0.24;

/**
 * Défilement (en lignes) à l'instant t : chaque événement (arrivée ou bascule) vise à garder sa ligne visible, avec
 * une ligne d'avance quand c'est possible ; on glisse de la cible précédente à la nouvelle.
 */
function defilement(t: number, lignes: LigneStatut[], visibles: number): number {
  const max = Math.max(0, lignes.length - visibles);
  if (max === 0) return 0;
  const evenements = lignes
    .flatMap((l, i) => [{ a: l.a, i }, ...(l.bascule !== undefined ? [{ a: l.bascule, i: Math.min(lignes.length - 1, i + 1) }] : [])])
    .filter((e) => e.a > 0)
    .sort((x, y) => x.a - y.a);
  let cible = 0;
  let courant = 0;
  for (const e of evenements) {
    if (t < e.a) break;
    const nouvelle = Math.max(cible, Math.min(max, Math.max(0, e.i - (visibles - 1))));
    courant = cible + (nouvelle - cible) * pose(t, e.a, DEFILE, 0.04);
    cible = nouvelle;
  }
  return courant;
}

type Etat = "attente" | "enCours" | "fait" | "inutile";

const estInutile = (l: LigneStatut, apres: EtatStatut) => !!l.inutile || /^inutile/i.test(apres.texte.trim());

export function Statuts(p: StatutsProps) {
  const { t, hauteurLigne: h, largeurImage: W } = p;
  const total = h * p.lignesVisibles;
  const largeur = largeurCorpsCarte(W);
  const fil = filetPx(W);
  const hEntete = Math.max(W * 0.046, h * 0.42);
  const hL = (total - hEntete) / Math.max(1, p.lignesVisibles);
  const decale = defilement(t, p.lignes, p.lignesVisibles);
  const pad = W * 0.024;

  // Colonne « Statut » : largeur commune (la plus longue pilule), alignée à droite.
  const tPilule = W * TYPO.corps;
  const textes = [p.avant.texte, p.apres.texte, ...p.lignes.flatMap((l) => [l.avant?.texte ?? "", l.apres?.texte ?? ""])];
  const lPilule = Math.max(W * 0.22, Math.max(...textes.map((x) => largeurCorps(x, tPilule))) + W * 0.07);
  const dispoNom = largeur - lPilule - 3 * pad;

  // Prochaine ligne à basculer (arrivée, bascule à venir) : « en cours ».
  const prochaine = p.lignes.reduce((k, l, i) => (l.bascule !== undefined && t >= l.a && t < l.bascule && (k < 0 || l.bascule < p.lignes[k].bascule!) ? i : k), -1);
  // Dernière bascule passée : sa pilule est le héros.
  const derniereFaite = p.lignes.reduce((k, l, i) => (l.bascule !== undefined && t >= l.bascule && (k < 0 || l.bascule > p.lignes[k].bascule!) ? i : k), -1);

  const rayon = W * 0.012;
  return (
    <div style={{ position: "relative", width: "100%", height: total, borderRadius: rayon, overflow: "hidden", background: NUANCES.ivoire, boxShadow: `inset 0 0 0 ${fil}px ${NUANCES.filet}` }}>
      {/* Lignes (défilent sous l'en-tête). */}
      <div style={{ position: "absolute", left: 0, right: 0, top: hEntete, bottom: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${-decale * hL}px)` }}>
          {/* Trois couches : fonds des lignes, flashs (qui débordent sur les voisines), puis contenus (jamais masqués). */}
          {(["fond", "eclat", "contenu"] as const).map((couche) =>
            p.lignes.map((l, i) => {
              const avant = l.avant ?? p.avant;
              const apres = l.apres ?? p.apres;
              const bascule = l.bascule !== undefined && t >= l.bascule;
              const etat: Etat = bascule ? (estInutile(l, apres) ? "inutile" : "fait") : i === prochaine ? "enCours" : "attente";
              return <Ligne key={`${couche}${i}`} couche={couche} t={t} i={i} ligne={l} avant={avant} apres={apres} etat={etat} heros={i === derniereFaite} W={W} hL={hL} pad={pad} lPilule={lPilule} dispoNom={dispoNom} />;
            }),
          )}
        </div>
      </div>
      {/* En-tête de colonnes. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: hEntete, display: "flex", alignItems: "center", padding: `0 ${pad}px`, background: NUANCES.ivoire, borderBottom: `${fil}px solid ${NUANCES.filet}`, boxSizing: "border-box" }}>
        <span style={{ ...styleTitre(W * TYPO.titreMin, NUANCES.sableProfond), flex: 1 }}>Élément</span>
        <span style={{ ...styleTitre(W * TYPO.titreMin, NUANCES.sableProfond), width: lPilule, textAlign: "center" }}>Statut</span>
      </div>
      <Grain rayon={rayon} />
    </div>
  );
}

function Ligne({ couche, t, i, ligne: l, avant, apres, etat, heros, W, hL, pad, lPilule, dispoNom }: { couche: "fond" | "eclat" | "contenu"; t: number; i: number; ligne: LigneStatut; avant: EtatStatut; apres: EtatStatut; etat: Etat; heros: boolean; W: number; hL: number; pad: number; lPilule: number; dispoNom: number }) {
  const arrive = l.a <= 0 ? -1e9 : l.a;
  if (t < arrive) return null;
  const e = l.a <= 0 ? 1 : glisse(t, arrive, 0.18);
  const flash = eclat(t, [...(l.a > 0 ? [l.a] : []), ...(l.bascule !== undefined ? [l.bascule] : [])]);
  const tNom = tailleQuiTient(W * TYPO.titre, W * 0.03, dispoNom, (x) => largeurTitre(l.nom, x));
  const tDetail = l.detail ? tailleQuiTient(W * TYPO.corpsMin, W * TYPO.minimum, dispoNom, (x) => largeurCorps(l.detail!, x)) : 0;
  const allume = flash > 0.5;
  const barre = etat === "inutile";
  const opacite = l.a <= 0 ? 1 : fonduEntree(t, arrive);
  if (couche === "fond") return <div style={{ position: "absolute", left: 0, right: 0, top: i * hL, height: hL, background: i % 2 ? NUANCES.ivoireCreux : NUANCES.ivoire, opacity: opacite }} />;
  if (couche === "eclat") return flash > 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: i * hL - hL * 0.18, height: hL * 1.36, background: NUANCES.orange, opacity: flash }} /> : null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: i * hL, height: hL, opacity: opacite }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: pad, padding: `0 ${pad}px`, transform: `translateX(${(1 - e) * W * 0.03}px)` }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: W * 0.003 }}>
          <span style={{ ...styleTitre(tNom, allume ? NUANCES.ivoire : barre ? NUANCES.sableProfond : NUANCES.encre), textDecoration: barre ? "line-through" : "none", textDecorationThickness: Math.max(3, W * 0.003) }}>{l.nom}</span>
          {l.detail ? <span style={styleCorps(tDetail, allume ? NUANCES.ivoire : NUANCES.sableProfond)}>{l.detail}</span> : null}
        </div>
        <Pilule t={t} bascule={l.bascule} avant={avant} apres={apres} etat={etat} heros={heros} W={W} largeur={lPilule} hauteur={Math.min(W * 0.064, hL * 0.64)} />
      </div>
    </div>
  );
}

/** Pilule à point. À la bascule : l'ancienne sort par le bas, la nouvelle descend d'en haut (tambour). */
function Pilule({ t, bascule, avant, apres, etat, heros, W, largeur, hauteur }: { t: number; bascule?: number; avant: EtatStatut; apres: EtatStatut; etat: Etat; heros: boolean; W: number; largeur: number; hauteur: number }) {
  const enRoute = bascule !== undefined && t >= bascule && t < bascule + TAMBOUR;
  const p = enRoute ? glisse(t, bascule!, TAMBOUR) : 1;
  const ancien: Etat = "enCours";
  const marge = Math.max(3, W * 0.006);
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur + 2 * marge, overflow: enRoute ? "hidden" : "visible", flexShrink: 0 }}>
      {enRoute ? <Face etat={ancien} etatTexte={avant} t={t} W={W} hauteur={hauteur} heros={false} dy={p * (hauteur + 2 * marge)} marge={marge} /> : null}
      <Face etat={etat} etatTexte={etat === "fait" || etat === "inutile" ? apres : avant} t={t} W={W} hauteur={hauteur} heros={heros && !enRoute} dy={enRoute ? (p - 1) * (hauteur + 2 * marge) : 0} marge={marge} />
    </div>
  );
}

function Face({ etat, etatTexte, t, W, hauteur, heros, dy, marge }: { etat: Etat; etatTexte: EtatStatut; t: number; W: number; hauteur: number; heros: boolean; dy: number; marge: number }) {
  const fond = etat === "fait" ? degradeOrange : etat === "inutile" ? NUANCES.encre : etat === "enCours" ? NUANCES.orangeVoile : NUANCES.sable;
  const texte = etat === "fait" ? NUANCES.ivoire : etat === "inutile" ? NUANCES.sableClair : NUANCES.encre;
  const point = etat === "fait" ? NUANCES.ivoire : etat === "inutile" ? NUANCES.sableProfond : etat === "enCours" ? NUANCES.orange : NUANCES.encreDouce;
  // N3 : le point « en cours » respire (± 25 %, 1,4 Hz).
  const respire = etat === "enCours" ? 1 + 0.25 * Math.sin(t * 2 * Math.PI * 1.4) : 1;
  const d = W * 0.014;
  const relief = heros ? styleHeros(W) : etat === "fait" || etat === "inutile" ? { boxShadow: reflet(W) } : etat === "enCours" ? { boxShadow: `inset 0 0 0 ${filetPx(W)}px ${NUANCES.orange}` } : {};
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: marge,
        height: hauteur,
        transform: `translateY(${dy}px)`,
        borderRadius: 999,
        background: fond,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: W * 0.012,
        boxSizing: "border-box",
        ...relief,
      }}
    >
      <div style={{ width: d, height: d, borderRadius: "50%", background: point, transform: `scale(${respire})`, flexShrink: 0 }} />
      <span style={{ ...styleCorps(W * TYPO.corps, texte), textDecoration: etat === "inutile" ? "line-through" : "none", textDecorationThickness: Math.max(3, W * 0.003) }}>{etatTexte.texte}</span>
    </div>
  );
}

/** Exemple pour la galerie : les tâches administratives d'une PME qui passent de « À faire » à « Fait ». Aucun chiffre. */
export const EXEMPLE_STATUTS = {
  titre: "Tâches de la semaine",
  iconeTitre: "coche",
  lignesVisibles: 4,
  avant: { texte: "À faire", icone: "horloge" },
  apres: { texte: "Fait", icone: "coche" },
  lignes: [
    { nom: "Factures du mois", detail: "Comptabilité", a: 0, bascule: 0.8 },
    { nom: "Relances clients", detail: "Paiements à suivre", a: 0, bascule: 1.0 },
    { nom: "Devis du lundi", detail: "Envoi par e-mail", a: 0, bascule: 1.2 },
    { nom: "Saisie à la main", detail: "Remplacée par l'outil", a: 0, bascule: 1.4, inutile: true },
    { nom: "Planning des équipes", detail: "Semaine prochaine", a: 1.5, bascule: 1.65 },
    { nom: "Bons de commande", detail: "Fournisseurs", a: 1.7, bascule: 1.85 },
  ],
} satisfies Omit<StatutsProps, "t" | "largeurImage" | "hauteurLigne"> & { titre: string; iconeTitre: string };
