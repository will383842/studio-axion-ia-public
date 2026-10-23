import React from "react";
/**
 * FAMILLE DE MOTION « PILE DE NOTIFICATIONS » (hors cartes, designer n° 2 — refonte du 15/10/2026 après la critique).
 *
 * Retour de Will sur la vidéo 5 : « toujours les mêmes animations ». La première version reprenait le vocabulaire des
 * cartes (rectangle ivoire, liseré encre, ombre dure orange) : elle est abandonnée. Ici, c'est le langage d'un ÉCRAN DE
 * TÉLÉPHONE, rien d'autre dans la vidéo ne lui ressemble :
 *  - bandeaux SOMBRES « système » (encre à 90 %, flou du fond derrière eux, coins très ronds, aucun contour, aucune
 *    ombre dure) avec une tuile d'application orange ;
 *  - chaque bandeau JAILLIT DU BAS de l'image (ressort) et pousse toute la pile vers le haut : la pile monte comme une
 *    tour de tâches qui grandit, en ÉVENTAIL (bandeaux anciens inclinés à gauche et à droite en alternance, légèrement
 *    plus petits, plus sombres) ;
 *  - seul le bandeau de devant porte l'en-tête « maintenant » ; les bandeaux du dessous ne montrent que leur titre, en
 *    entier (rien de coupé) ;
 *  - un voile encre monte du bas de l'image à chaque arrivée (la surcharge s'installe), sans jamais atteindre le menton ;
 *  - le dernier bandeau VIBRE (secousse, halo orange qui pulse, traits de vibration de part et d'autre).
 * Sortie : la pile entière glisse vers le bas hors de l'image en 0,14 s.
 *
 *  - Visage : ENTIER, jamais touché (pile entre 0,59 H et 0,94 H ; menton de la prise à 0,51 H).
 *  - SOUS-TITRES : MASQUÉS pendant la pile (les bandeaux portent les mots dits ; `FICHE.sousTitres`).
 *  - Prise : immobile (aucun zoom, aucun déplacement).
 *  - Chaque arrivée change ≥ 5 % de l'image : un bandeau fait 0,84 L × 0,088 H ≈ 7,4 %, plus la poussée de la pile et le
 *    voile (≈ 12 % au total).
 *  - EXCLUSIVE avec le TÉLÉPHONE en mode « notification » (designer 1) : une seule des deux par vidéo.
 *  - Bruitage : un « ding » par bandeau, de plus en plus aigu (fichiers `ding-1` à `ding-5`, déjà accordés : aucune
 *    vitesse de lecture à régler) et de plus en plus rapproché (les mots s'enchaînent) ; « vibreur » sur le dernier.
 *  - Durée conseillée : 1,5 à 3 s.
 */
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { Icone } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export type NotificationPile = {
  /** Nom d'icône de `elements.tsx` (mail, telephone, document, calendrier, cloche…). */
  icone: string;
  /** 2 à 4 mots DITS par Will (titre du bandeau). */
  texte: string;
  /** Ligne secondaire facultative (mots dits aussi), sur le bandeau de devant seulement. */
  detail?: string;
  /** Instant du mot (secondes). */
  a: number;
};

export type DonneesPileNotifications = {
  debut: number;
  fin: number;
  /** 3 à 5 bandeaux, dans l'ordre de la phrase (au-delà de 5, seuls les 5 premiers sont posés). */
  notifications: NotificationPile[];
  /** Mention d'en-tête du bandeau de devant (défaut : « maintenant », jamais de chiffre). */
  mention?: string;
};

export const FICHE_PILE_NOTIFICATIONS = Object.freeze({
  id: "pile-notifications",
  nom: "Pile de notifications",
  visage: "entier" as const,
  dureeMin: 1.5,
  dureeMax: 3,
  /** Les bandeaux portent les mots : le réalisateur masque les sous-titres de `debut` à `fin`. */
  sousTitres: "masques" as const,
  /** Une seule des deux par vidéo (même idée : le téléphone en mode notification du designer 1). */
  exclusifAvec: ["telephone:notification"] as readonly string[],
  quandUtiliser: "Une énumération de tâches ou de sollicitations (devis, relances, appels) pour montrer la surcharge, à la place d'une carte « liste ».",
});

export const EXEMPLE_PHRASE_PILE_NOTIFICATIONS = "Un devis à envoyer, une relance à faire, un appel à rappeler, et encore un mail.";
export const EXEMPLE_PILE_NOTIFICATIONS: DonneesPileNotifications = {
  debut: 0.2,
  fin: 3.2,
  notifications: [
    { icone: "document", texte: "Devis à envoyer", a: 0.25 },
    { icone: "mail", texte: "Relance à faire", a: 0.95 },
    { icone: "telephone", texte: "Appel à rappeler", a: 1.6 },
    { icone: "cloche", texte: "Encore un mail", a: 2.15 },
  ],
};
/** Instants de contrôle : 3ᵉ bandeau qui jaillit (pile poussée), puis pile complète (le dernier vibre). */
export const INSTANT_CONSTRUCTION_PILE_NOTIFICATIONS = 1.64;
export const INSTANT_PILE_NOTIFICATIONS = 2.62;

/** Contenu de la famille dans le plan (`SCHEMAS_CONTENU_MOTION["pile-notifications"]`). */
export type ContenuPlanPileNotifications = { notifications: { titre: string; texte?: string; icone: string; a: number }[] };
/** Passe du plan du réalisateur aux données du composant. */
export function pileNotificationsDepuisPlan(c: ContenuPlanPileNotifications, debut: number, fin: number): DonneesPileNotifications {
  return { debut, fin, notifications: c.notifications.map((n) => ({ icone: n.icone, texte: n.titre, detail: n.texte, a: n.a })) };
}

/** Géométrie (fractions de l'image). */
const PILE = Object.freeze({
  /** Largeur et hauteur d'un bandeau. */
  l: 0.84,
  h: 0.088,
  /** Bas du bandeau de devant. */
  bas: 0.94,
  /** Montée de chaque bandeau ancien au-dessus du suivant (son titre reste lisible en entier). */
  pas: 0.062,
  /** Réduction et inclinaison par rang d'ancienneté. */
  reduction: 0.035,
  inclinaison: 2.4,
  /** Décalage latéral par rang (éventail). */
  decalage: 0.012,
  /** Nombre maximal de bandeaux posés. */
  max: 5,
});
/** Temps (secondes). */
const T = Object.freeze({ jaillit: 0.22, pousse: 0.2, sortie: 0.14, vibreApres: 0.3 });

/** Ancienneté lissée du bandeau `i` : nombre de bandeaux arrivés après lui (la poussée glisse, elle ne saute pas). */
function anciennete(t: number, notes: NotificationPile[], i: number): number {
  let r = 0;
  for (let k = i + 1; k < notes.length; k++) r += rebond(t, notes[k].a, T.pousse, 1.7);
  return r;
}

/** Couleur orange plus claire pour le dégradé de la tuile (dérivé de la charte). */
const ORANGE_CLAIR = "#CF6A3F";

function Bandeau({ n, l, h, devant, mention, recul }: { n: NotificationPile; l: number; h: number; devant: boolean; mention: string; recul: number }) {
  const cote = h * 0.6;
  const marge = h * 0.2;
  const largeurTexteDispo = l - cote - marge * 3.2;
  const tailleTitre = Math.min(h * (devant ? 0.3 : 0.34), largeurTexteDispo / Math.max(1, largeurTexte(n.texte, 1) * 0.86));
  const detail = devant && n.detail ? n.detail : undefined;
  return (
    <div
      style={{
        width: l,
        height: h,
        borderRadius: h * 0.34,
        background: `rgba(17, 10, 5, ${0.9 - 0.04 * Math.min(recul, 3)})`,
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
        // Profondeur douce (pas d'ombre dure : ce n'est PAS la grammaire des cartes) et filet clair très fin en haut.
        boxShadow: `0 ${h * 0.12}px ${h * 0.35}px rgba(17, 10, 5, 0.45), inset 0 1.5px 0 rgba(233, 220, 200, 0.14)`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: devant ? "center" : "flex-start",
        gap: marge,
        padding: devant ? `0 ${marge * 1.2}px 0 ${marge}px` : `${h * 0.09}px ${marge * 1.2}px 0 ${marge}px`,
        overflow: "hidden",
      }}
    >
      {/* Tuile d'application : orange en dégradé, icône ivoire. Sur les bandeaux du dessous, elle est plus petite. */}
      <div
        style={{
          width: devant ? cote : cote * 0.72,
          height: devant ? cote : cote * 0.72,
          flexShrink: 0,
          borderRadius: cote * 0.27,
          background: `linear-gradient(160deg, ${ORANGE_CLAIR}, ${COULEURS.orange})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: devant ? 0 : cote * 0.14,
        }}
      >
        <Icone nom={n.icone} taille={cote * (devant ? 0.58 : 0.44)} couleur={COULEURS.ivoire} epaisseur={2.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: h * 0.045, paddingTop: devant ? 0 : h * 0.02 }}>
        {devant ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: POLICES.texte, fontSize: h * 0.165, lineHeight: 1, color: COULEURS.sable, letterSpacing: h * 0.004 }}>{mention}</span>
          </div>
        ) : null}
        <span style={{ fontFamily: POLICES.titre, fontSize: tailleTitre, lineHeight: 1.08, color: COULEURS.ivoire, whiteSpace: "nowrap", opacity: devant ? 1 : 0.86 }}>{n.texte}</span>
        {detail ? <span style={{ fontFamily: POLICES.texte, fontSize: h * 0.17, lineHeight: 1, color: COULEURS.sable, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</span> : null}
      </div>
    </div>
  );
}

/** Traits de vibration de part et d'autre du bandeau qui vibre (clignotent toutes les 2 images). */
function TraitsVibration({ t, a, l, h }: { t: number; a: number; l: number; h: number }) {
  if (t < a) return null;
  const allume = Math.floor((t - a) * 12.5) % 2 === 0;
  const e = rebond(t, a, 0.12, 2);
  const arc = (k: number, s: 1 | -1) => {
    const r = h * (0.18 + 0.13 * k);
    const x0 = s > 0 ? l + h * 0.06 : -h * 0.06;
    return <path key={`${s}-${k}`} d={`M ${x0 + s * r * 0.25} ${h / 2 - r} Q ${x0 + s * r} ${h / 2} ${x0 + s * r * 0.25} ${h / 2 + r}`} />;
  };
  return (
    <svg
      width={l + h * 1.4}
      height={h * 1.6}
      viewBox={`${-h * 0.7} ${-h * 0.3} ${l + h * 1.4} ${h * 1.6}`}
      style={{ position: "absolute", left: -h * 0.7, top: -h * 0.3, overflow: "visible", opacity: allume ? 1 : 0.3, transform: `scale(${e})` }}
      fill="none"
      stroke={COULEURS.orange}
      strokeWidth={h * 0.075}
      strokeLinecap="round"
    >
      {[0, 1].map((k) => arc(k, 1))}
      {[0, 1].map((k) => arc(k, -1))}
    </svg>
  );
}

export function PileNotifications({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_PILE_NOTIFICATIONS }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesPileNotifications }) {
  const d = donnees;
  const notes = d.notifications.slice(0, PILE.max);
  if (t < d.debut || t >= d.fin || notes.length === 0) return null;
  const mention = d.mention ?? "maintenant";
  const N = notes.length;
  const l = PILE.l * W;
  const h = PILE.h * H;
  const x0 = (W - l) / 2;
  const yBas = PILE.bas * H - h;
  // Sortie : toute la pile glisse vers le bas, hors de l'image.
  const chute = sortie(t, d.fin - T.sortie, T.sortie) * (H - yBas + h * 0.2);
  // Voile de surcharge : monte d'un cran à chaque bandeau (dégradé qui démarre sous le menton).
  const arrives = notes.reduce((s, n) => s + progression(t, n.a, T.jaillit), 0);
  const voile = (0.18 + 0.1 * arrives) * (1 - sortie(t, d.fin - T.sortie, T.sortie));
  const dernier = notes[N - 1];
  const vibreA = dernier.a + T.vibreApres;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0.56 * H, width: W, height: 0.44 * H, background: `linear-gradient(180deg, rgba(17,10,5,0) 0%, rgba(17,10,5,${voile * 0.55}) 45%, rgba(17,10,5,${voile}) 100%)` }} />
      {notes.map((n, i) => {
        if (t < n.a) return null;
        // Jaillit du bas de l'image (ressort), légèrement incliné, puis se pose.
        const e = rebond(t, n.a, T.jaillit, 1.8);
        const montee = (1 - e) * (H - yBas);
        // Ancienneté : le bandeau monte d'un pas, rapetisse, s'incline en éventail et se décale (gauche/droite alternés).
        const r = anciennete(t, notes, i);
        const sens = i % 2 === 0 ? -1 : 1;
        const echelle = 1 - PILE.reduction * r;
        const haut = r * PILE.pas * H;
        const angle = sens * PILE.inclinaison * Math.min(r, 1) * (1 + 0.25 * Math.max(0, r - 1)) + sens * 6 * (1 - e);
        const dx = sens * PILE.decalage * W * Math.min(r, 2);
        // Le dernier vibre : bourdonnements de 0,35 s toutes les 0,5 s, qui s'atténuent.
        const estDernier = i === N - 1;
        const bourdonne = estDernier && t >= vibreA && (t - vibreA) % 0.5 < 0.35;
        const vibre = bourdonne ? Math.sin(2 * Math.PI * 24 * (t - vibreA)) * h * 0.06 * (1 - 0.4 * progression(t, vibreA, 1.5)) : 0;
        // Halo orange qui pulse autour du bandeau qui vibre.
        const halo = estDernier && t >= vibreA ? 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * (t - vibreA)) : 0;
        const assombri = Math.min(0.42, 0.16 * r);
        const devant = r < 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0,
              top: yBas,
              width: l,
              height: h,
              zIndex: i,
              transformOrigin: "50% 100%",
              transform: `translate(${dx + vibre}px, ${montee - haut + chute}px) rotate(${angle + (vibre / h) * 1.6}deg) scale(${echelle})`,
            }}
          >
            {halo > 0 ? <div style={{ position: "absolute", inset: -h * 0.06, borderRadius: h * 0.4, boxShadow: `0 0 0 ${h * (0.035 + 0.035 * halo)}px rgba(180, 79, 41, ${0.55 + 0.4 * halo})` }} /> : null}
            <Bandeau n={n} l={l} h={h} devant={devant} mention={mention} recul={r} />
            {assombri > 0.01 ? <div style={{ position: "absolute", inset: 0, borderRadius: h * 0.34, background: COULEURS.encre, opacity: assombri }} /> : null}
            {estDernier ? <TraitsVibration t={t} a={vibreA} l={l} h={h} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume] — le format que lit `VideoAnimee`. */
export type BruitageMotion = [number, string, number];

/** Un « ding » par bandeau, accordé de plus en plus haut ; bourdonnement du vibreur sur le dernier ; glissé de sortie. */
export function bruitagesPileNotifications(d: DonneesPileNotifications = EXEMPLE_PILE_NOTIFICATIONS): BruitageMotion[] {
  const notes = d.notifications.slice(0, PILE.max);
  const s: BruitageMotion[] = notes.map((n, i) => [n.a, `ding-${Math.min(5, i + 1)}`, 0.1 + 0.015 * i]);
  const vibreA = notes[notes.length - 1].a + T.vibreApres;
  for (let b = vibreA; b < d.fin - T.sortie - 0.1; b += 0.5) s.push([b, "vibreur", 0.12]);
  s.push([d.fin - T.sortie, "whoosh-out", 0.14]);
  return s;
}
