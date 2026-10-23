import React from "react";
/**
 * CARTE CALENDRIER — « Agenda de la semaine » (redessinée le 15/10/2026, standard premium, designer n° 2).
 *
 * Un vrai agenda : colonnes de jours (« LUN 12 »), créneaux horaires en sable-profond, et des BLOCS D'ÉVÉNEMENT posés
 * sur leur créneau (barre orange à gauche, fond orange-voile, icône nue et libellé court). Le bloc « accent » est le
 * seul héros (orange plein, texte ivoire, relief). Le jour courant porte une ligne « maintenant » orange avec un point.
 * La rangée du bas est une barre d'outils fine, icônes nues, sans case.
 *
 * Mouvement :
 *  - N1 : la carte entre (Carte.tsx) ; les jours arrivent en cascade de 50 ms (translation 0,02 L, fondu) ;
 *  - N2 : sur son mot (`a`), chaque bloc S'ÉTIRE depuis le haut de son créneau (« glisse », 0,18 s) pendant que sa
 *    rangée et sa colonne flashent en orange (≥ 5 % de l'image) ; la colonne s'écrase de 2 % (suivi). Chaque icône de la
 *    barre d'outils monte de 0,02 L sur son mot, en cascade, avec un flash de la barre ;
 *  - N3 : la ligne « maintenant » descend en continu.
 * Props et exports inchangés (plans, `VideoAnimee.tsx`, `cadrage.ts`). Pur : tout dérive de `t`.
 */
import { Icone } from "../elements";
import { alpha, bosse, degradeOrange, eclat, filetPx, fonduEntree, glisse, Grain, largeurCorps, largeurCorpsCarte, largeurTitre, microOmbre, NUANCES, pose, reflet, styleCorps, styleHeros, styleTitre, tailleQuiTient, TYPO } from "../variantes/premium-2";

/** Une pastille qui tombe dans une case : colonne `jour` (0 = 1ʳᵉ colonne), rangée `rangee` (0 = 1ʳᵉ), sur le mot `a` (s). */
export type PastilleCalendrier = { jour: number; rangee: number; /** Nom d'icône d'`elements.tsx` (`NOMS_ICONES`). */ icone: string; a: number; /** Pastille pleine orange (mise en avant). */ accent?: boolean };

export type CalendrierProps = {
  /** Temps courant (secondes, même horloge que la carte). */
  t: number;
  largeurImage: number;
  /** Hauteur d'une rangée de cases, en pixels (≈ 0,05 × hauteur de l'image). */
  hauteurLigne: number;
  /** Libellés des colonnes (5 ou 7 jours : « Lun », « Mar »…). Le nombre de colonnes en découle. */
  jours: string[];
  /** Nombre de rangées de cases. */
  rangees: number;
  /** Instant où les libellés des jours arrivent en cascade ; absent = posés avec la carte. */
  joursA?: number;
  /** Pastilles qui tombent, chacune sur son mot. */
  pastilles: PastilleCalendrier[];
  /** Rangée d'icônes sous la grille, chacune sur son mot. */
  rangee?: { icone: string; a: number }[];
};

/** Hauteur du contenu (pixels) pour dimensionner la `<Carte>` : en-tête des jours + rangées + rangée d'icônes. */
export function hauteurCalendrier(hauteurLigne: number, rangees: number, avecRangee: boolean): number {
  return hauteurLigne * 0.5 + rangees * hauteurLigne + (avecRangee ? hauteurLigne * 1.15 : 0);
}

/** Libellé court d'un événement selon son icône (il doit tenir dans une colonne de jour, sinon seule l'icône reste). */
const LIBELLES: Record<string, string> = {
  message: "Posts",
  image: "Visuel",
  mail: "Mails",
  document: "Devis",
  partage: "Partage",
  video: "Vidéo",
  telephone: "Appels",
  calendrier: "RDV",
  euro: "Compta",
  utilisateur: "Client",
  utilisateurs: "Équipe",
  loupe: "Audit",
  graphique: "Bilan",
  tendance: "Ventes",
  former: "Cours",
  robot: "IA",
  eclair: "Auto",
  horloge: "Réunion",
  cloche: "Rappel",
  envoyer: "Envoi",
  dossier: "Dossiers",
  tableur: "Suivi",
  crayon: "Notes",
  globe: "Site",
  lien: "Liens",
  coeur: "Avis",
  etoile: "Avis",
  ecran: "Visio",
  cadenas: "Accès",
  batiment: "Visite",
  reseau: "Réseau",
  etincelles: "Idées",
  boussole: "Cap",
  coche: "Fait",
};
const libelleDe = (icone: string) => LIBELLES[icone] ?? "Tâche";
/** Heures des créneaux (graduation d'agenda, pas une donnée). */
const HEURES = ["9h", "11h", "14h", "16h", "18h", "20h"];

const ETIRE = 0.18;

export function Calendrier(p: CalendrierProps) {
  const { t, hauteurLigne: h, largeurImage: W } = p;
  const n = Math.max(1, p.jours.length);
  const total = hauteurCalendrier(h, p.rangees, !!p.rangee?.length);
  const largeur = largeurCorpsCarte(W);
  const fil = filetPx(W);

  // Grille : gouttière des heures à gauche, en-tête des jours, rangées ; la barre d'outils prend sa part du bas.
  const hOutils = p.rangee?.length ? Math.max(W * 0.075, h * 0.7) : 0;
  const ecartOutils = hOutils ? W * 0.012 : 0;
  const hEntete = Math.max(W * 0.05, h * 0.55);
  const hRangee = (total - hOutils - ecartOutils - hEntete) / Math.max(1, p.rangees);
  const hGrille = hRangee * p.rangees;
  const gouttiere = W * 0.062;
  const colonne = (largeur - gouttiere) / n;

  // Typographie : jour en titre, date en corps (si la colonne le permet), heures en corps sable-profond.
  const tailleJour = tailleQuiTient(W * 0.04, W * TYPO.minimum, colonne - W * 0.012, (x) => largeurTitre("MER", x));
  const tCorps = W * TYPO.corpsMin;
  const avecDate = largeurTitre("MER", tailleJour) + W * 0.008 + largeurCorps("18", tCorps) <= colonne - W * 0.016;

  // Jour « courant » : celui du bloc héros, sinon le milieu de la semaine.
  const accent = p.pastilles.find((x) => x.accent);
  const aujourdhui = accent ? accent.jour : Math.min(n - 1, 2);

  // Flash N2 : la rangée et la colonne du dernier bloc arrivé (croix de sélection, comme un tableur).
  const flash = eclat(t, p.pastilles.map((x) => x.a));
  const dernier = p.pastilles.filter((x) => t >= x.a).sort((x, y) => x.a - y.a).pop();

  // Ligne « maintenant » (N3) : descend en continu dans la colonne du jour courant.
  const yMaintenant = hGrille * (0.1 + 0.8 * ((t * 0.07) % 1));

  const rayon = W * 0.012;
  const flashOutils = eclat(t, (p.rangee ?? []).map((x) => x.a));

  return (
    <div style={{ position: "relative", height: total, width: "100%" }}>
      {/* Agenda : surface ivoire, filet fin, grain. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: hEntete + hGrille, borderRadius: rayon, background: NUANCES.ivoire, boxShadow: `inset 0 0 0 ${fil}px ${NUANCES.filet}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: gouttiere + aujourdhui * colonne, width: colonne, top: 0, bottom: 0, background: NUANCES.ivoireCreux }} />
        {dernier && flash > 0 ? (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: hEntete + dernier.rangee * hRangee, height: hRangee, background: NUANCES.orange, opacity: flash }} />
            <div style={{ position: "absolute", left: gouttiere + dernier.jour * colonne, width: colonne, top: 0, bottom: 0, background: NUANCES.orange, opacity: flash }} />
          </>
        ) : null}
        {Array.from({ length: p.rangees }, (_, r) => (
          <div key={`h${r}`} style={{ position: "absolute", left: 0, right: 0, top: hEntete + r * hRangee - fil / 2, height: fil, background: NUANCES.filet }} />
        ))}
        {Array.from({ length: n }, (_, c) => (
          <div key={`v${c}`} style={{ position: "absolute", top: 0, bottom: 0, left: gouttiere + c * colonne - fil / 2, width: fil, background: NUANCES.filet }} />
        ))}
        <Grain rayon={rayon} />
      </div>

      {/* En-tête des jours : « LUN 12 », cascade de 50 ms. */}
      {p.jours.map((j, i) => {
        const a = p.joursA === undefined ? -1e9 : p.joursA + i * 0.05;
        const e = glisse(t, a, 0.16);
        const courant = i === aujourdhui;
        const allume = dernier && flash > 0.5 && dernier.jour === i;
        return (
          <div
            key={j + i}
            style={{
              position: "absolute",
              left: gouttiere + i * colonne,
              width: colonne,
              top: 0,
              height: hEntete,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: W * 0.008,
              opacity: fonduEntree(t, a),
              transform: `translateY(${(1 - e) * -W * 0.02}px)`,
            }}
          >
            <span style={styleTitre(tailleJour, allume ? NUANCES.ivoire : courant ? NUANCES.orange : NUANCES.encre)}>{j}</span>
            {avecDate ? <span style={{ ...styleCorps(tCorps, allume ? NUANCES.ivoire : courant ? NUANCES.orange : NUANCES.sableProfond), fontVariantNumeric: "tabular-nums" }}>{12 + i}</span> : null}
          </div>
        );
      })}

      {/* Heures des créneaux, calées en haut de chaque rangée. */}
      {Array.from({ length: p.rangees }, (_, r) => (
        <div key={`hr${r}`} style={{ position: "absolute", left: 0, width: gouttiere - W * 0.01, top: hEntete + r * hRangee + W * 0.008, textAlign: "right", ...styleCorps(tCorps, dernier && flash > 0.5 && dernier.rangee === r ? NUANCES.ivoire : NUANCES.sableProfond), fontVariantNumeric: "tabular-nums" }}>
          {HEURES[r % HEURES.length]}
        </div>
      ))}

      {/* Colonnes de blocs : chaque colonne s'écrase de 2 % quand un bloc s'y pose (suivi). */}
      {Array.from({ length: n }, (_, c) => {
        const siens = p.pastilles.filter((x) => x.jour === c);
        const ecrase = siens.reduce((m, x) => Math.max(m, bosse(t, x.a + ETIRE * 0.6, 0.12)), 0);
        return (
          <div key={`c${c}`} style={{ position: "absolute", left: gouttiere + c * colonne, width: colonne, top: hEntete, height: hGrille, transformOrigin: "50% 0%", transform: `scaleY(${1 - 0.02 * ecrase})` }}>
            {siens.map((x, k) => {
              const memes = siens.filter((y) => y.rangee === x.rangee);
              const rang = memes.indexOf(x);
              return <Bloc key={k} t={t} bloc={x} W={W} x={(colonne / memes.length) * rang} largeur={colonne / memes.length} y={x.rangee * hRangee} hauteur={hRangee} />;
            })}
          </div>
        );
      })}

      {/* Ligne « maintenant » : point et trait orange dans la colonne du jour courant. */}
      <div style={{ position: "absolute", left: gouttiere + aujourdhui * colonne - W * 0.007, width: colonne + W * 0.007, top: hEntete + yMaintenant, height: 0 }}>
        <div style={{ position: "absolute", left: W * 0.007, right: 0, top: -Math.max(2, W * 0.0015), height: Math.max(3, W * 0.003), background: NUANCES.orange, borderRadius: 2 }} />
        <div style={{ position: "absolute", left: 0, top: -W * 0.007, width: W * 0.014, height: W * 0.014, borderRadius: "50%", background: NUANCES.orange, boxShadow: `0 0 0 ${Math.max(2, W * 0.002)}px ${NUANCES.ivoire}` }} />
      </div>

      {/* Barre d'outils fine : filet au-dessus, icônes nues qui montent une à une. */}
      {p.rangee && p.rangee.length ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: hOutils, display: "flex", alignItems: "center", justifyContent: "center", gap: W * 0.065 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: fil, background: NUANCES.filet }} />
          {flashOutils > 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: NUANCES.orange, opacity: flashOutils, borderRadius: rayon }} /> : null}
          {p.rangee.map((ic, i) => {
            const vu = t >= ic.a;
            const e = vu ? pose(t, ic.a, 0.2) : 0;
            const derniere = vu && !p.rangee!.some((x) => x.a > ic.a && t >= x.a);
            return (
              <div key={ic.icone + i} style={{ position: "relative", opacity: vu ? fonduEntree(t, ic.a) : 0, transform: `translateY(${(1 - e) * W * 0.02}px)`, display: "flex" }}>
                <Icone nom={ic.icone} taille={W * 0.055} couleur={flashOutils > 0.5 ? NUANCES.ivoire : derniere ? NUANCES.orange : NUANCES.encreDouce} epaisseur={2.2} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Bloc d'événement : s'étire depuis le haut de son créneau. L'accent est le héros (orange plein, relief). */
function Bloc({ t, bloc: x, W, x: gauche, largeur, y, hauteur }: { t: number; bloc: PastilleCalendrier; W: number; x: number; largeur: number; y: number; hauteur: number }) {
  if (t < x.a) return null;
  const marge = W * 0.006;
  const e = glisse(t, x.a, ETIRE);
  const l = largeur - 2 * marge;
  const hBloc = hauteur - 2 * marge;
  const libelle = libelleDe(x.icone);
  const tCorps = W * TYPO.corpsMin;
  const barre = Math.max(4, Math.round(W * 0.006));
  const accent = !!x.accent;
  const contour = accent ? 2 * Math.max(2, Math.round(W * 0.003)) : 0;
  // Icône 0,055 L si la place le permet, sinon 0,04 L ; libellé dessous s'il tient (jamais coupé, jamais sous 26 px).
  const place = Math.min(l - barre, hBloc - contour);
  const icone = place >= W * 0.075 + tCorps * 1.3 ? W * 0.055 : W * 0.04;
  const avecLibelle = largeurCorps(libelle, tCorps) * 0.92 <= l - (accent ? 0 : barre) - contour - W * 0.01 && hBloc - contour >= icone + tCorps * 1.2 + W * 0.01;
  return (
    <div
      style={{
        position: "absolute",
        left: gauche + marge,
        top: y + marge,
        width: l,
        height: hBloc * Math.max(0.02, e),
        opacity: fonduEntree(t, x.a),
        borderRadius: W * 0.008,
        overflow: "hidden",
        background: accent ? degradeOrange : NUANCES.orangeVoile,
        ...(accent ? styleHeros(W) : { boxShadow: microOmbre(W) }),
      }}
    >
      {accent ? null : <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: barre, background: NUANCES.orange }} />}
      <div style={{ position: "absolute", left: accent ? 0 : barre, right: 0, top: 0, height: hBloc - contour, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: W * 0.004 }}>
        <Icone nom={x.icone} taille={icone} couleur={accent ? NUANCES.ivoire : NUANCES.orangeProfond} epaisseur={2.4} />
        {avecLibelle ? <span style={styleCorps(tCorps, accent ? NUANCES.ivoire : NUANCES.encre)}>{libelle}</span> : null}
      </div>
      {accent ? <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.1)} 0%, ${alpha(NUANCES.ivoire, 0)} 35%)`, boxShadow: reflet(W) }} /> : null}
    </div>
  );
}

/** Exemple pour la galerie : la semaine d'une PME (réseaux + tâches). Aucun chiffre. */
export const EXEMPLE_CALENDRIER = {
  titre: "Planning de la semaine",
  iconeTitre: "calendrier",
  jours: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
  rangees: 3,
  joursA: 0.2,
  pastilles: [
    { jour: 0, rangee: 0, icone: "message", a: 0.6 },
    { jour: 2, rangee: 0, icone: "image", a: 0.85 },
    { jour: 1, rangee: 1, icone: "mail", a: 1.1 },
    { jour: 3, rangee: 1, icone: "document", a: 1.3, accent: true },
    { jour: 4, rangee: 0, icone: "partage", a: 1.5 },
    { jour: 2, rangee: 2, icone: "video", a: 1.7 },
    { jour: 3, rangee: 2, icone: "telephone", a: 1.9 },
  ],
  rangee: [
    { icone: "message", a: 2.3 },
    { icone: "image", a: 2.36 },
    { icone: "video", a: 2.42 },
    { icone: "partage", a: 2.48 },
    { icone: "mail", a: 2.54 },
  ],
} satisfies Omit<CalendrierProps, "t" | "largeurImage" | "hauteurLigne"> & { titre: string; iconeTitre: string };
