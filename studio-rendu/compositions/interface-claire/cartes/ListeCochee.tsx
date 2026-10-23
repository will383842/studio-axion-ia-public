import React from "react";
/**
 * CARTE « LISTE COCHÉE » (redessinée le 15/10, standard premium ; référence : carte Notion · QG, `planche_04`-`05`).
 * Une vraie liste de tâches : en-tête en titre avec un compteur « 0/5 » tabulaire à droite ; une ligne par mot dit,
 * case arrondie de 0,05 L à GAUCHE (alignée sur le texte), libellé en corps (casse normale), icône nue de la chose
 * à droite, filets entre les lignes. Le badge final est l'UNIQUE héros.
 *
 * Mouvement : la ligne arrive par translation de 0,03 L avec fondu (0,15 s) derrière un volet orange plein qui se
 * retire vers la droite (changement franc ≥ 5 % de l'image). La case se remplit d'orange par un disque qui grandit
 * depuis son centre, puis la coche SE DESSINE (0,14 s) ; le compteur roule en tambour. Au `cocheA` : cases cochées
 * en cascade de 50 ms et balayage orange-voile de haut en bas (0,2 s). Sans `cocheA`, chaque ligne se coche sur son mot.
 * N3 : la prochaine case à cocher respire ; le badge porte un reflet.
 */
import { POLICES } from "../charte";
import { Icone } from "../elements";
import { NUANCES, bosse, ChiffreRoulant, claque, degradeEncre, degradeOrange, fondu, glisse, largeurCorps, largeurInter, largeurTitre, Reflet, RELIEF, styleCorps, styleHeros, styleTitre, tailleQuiTient, TYPO } from "../variantes/premium-1";

export type LigneListe = {
  texte: string;
  /** Nom d'icône (`NOMS_ICONES` d'`elements.tsx`), affichée nue à droite de la ligne. */
  icone: string;
  /** Instant du mot (s). */
  a: number;
};

export type ListeCocheeProps = {
  /** Temps courant (s), même horloge que la `Carte`. */
  t: number;
  /** Largeur de l'image (px). */
  largeurImage: number;
  /** Hauteur d'une ligne (px), ≈ 5 % de la hauteur de l'image (× grossissement). */
  hauteurLigne: number;
  lignes: LigneListe[];
  /** En-tête de la liste (ex. « Le cerveau. »). */
  entete?: { texte: string; icone?: string; a: number };
  /** Instant où les cases se cochent en cascade (50 ms d'écart). Facultatif : sans lui, chaque ligne se coche sur son mot. */
  cocheA?: number;
  /** Badge final en bas à droite (ex. « Tout est ici »). */
  badge?: { texte: string; icone?: string; a: number };
};

/** Écart entre deux coches de la cascade (s). */
const ECART_CASCADE = 0.05;
/** Proportions verticales (en `hauteurLigne`) : INCHANGÉES (la mise en page de `cadrage.ts` en dépend). */
const H_ENTETE = 0.8;
const H_BADGE = 0.9;

/** Hauteur du contenu (px) pour dimensionner la `Carte`. */
export function hauteurListeCochee(hauteurLigne: number, nbLignes: number, avecEntete = true, avecBadge = true) {
  return hauteurLigne * ((avecEntete ? H_ENTETE : 0) + nbLignes + (avecBadge ? H_BADGE : 0));
}

export function ListeCochee(p: ListeCocheeProps) {
  const W = p.largeurImage;
  const u = p.hauteurLigne;
  const L = largeurCorps(W);
  const filet = RELIEF.filet(W);
  const haut = p.entete ? u * H_ENTETE : 0;
  const n = p.lignes.length;
  const hTotal = hauteurListeCochee(u, n, !!p.entete, !!p.badge);

  // Instants de coche de chaque ligne.
  const instantsCoche = p.lignes.map((l, i) => (p.cocheA !== undefined ? p.cocheA + i * ECART_CASCADE : l.a + 0.12));
  const coches = instantsCoche.filter((c, i) => p.t >= c && p.t >= p.lignes[i].a);

  // Typographie.
  const caseCote = Math.min(W * 0.05, u * 0.56);
  const iconeTaille = W * 0.04;
  const placeLibelle = L - caseCote - u * 0.3 - iconeTaille - u * 0.3;
  const C = (texte: string) => tailleQuiTient(largeurInter(texte, 1), placeLibelle, TYPO.minimum(W), Math.min(TYPO.corps(W), u * 0.36));
  const tailleEntete = Math.min(TYPO.titre(W), u * 0.5);
  const tailleCompteur = tailleEntete;

  // Prochaine case à cocher (N3) : la première ligne visible non cochée.
  const prochaine = p.lignes.findIndex((l, i) => p.t >= l.a && p.t < instantsCoche[i]);
  const balayage = p.cocheA !== undefined && p.t >= p.cocheA && p.t < p.cocheA + 0.24 ? glisse(p.t, p.cocheA, 0.2) : -1;
  const eBadge = p.badge && p.t >= p.badge.a ? claque(p.t, p.badge.a, 0.12) : 0;
  const ecrase = p.badge ? 1 - 0.02 * bosse(p.t, p.badge.a + 0.08, 0.1) : 1;

  return (
    <div style={{ position: "relative", height: hTotal, transform: `scaleY(${ecrase})`, transformOrigin: "50% 100%" }}>
      {/* En-tête : icône nue + titre, compteur tabulaire à droite, filet dessous. */}
      {p.entete && p.t >= p.entete.a ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: haut, display: "flex", alignItems: "center", gap: u * 0.2, borderBottom: `${filet}px solid ${NUANCES.filet}`, opacity: fondu(p.t, p.entete.a), transform: `translateX(${(1 - glisse(p.t, p.entete.a, 0.18)) * -W * 0.03}px)` }}>
          {p.entete.icone ? <Icone nom={p.entete.icone} taille={iconeTaille} couleur={NUANCES.orange} epaisseur={2.4} /> : null}
          <span style={{ ...styleTitre(tailleQuiTient(largeurTitre(p.entete.texte, 1), L * 0.68, TYPO.minimum(W), tailleEntete), NUANCES.encre), flex: 1, minWidth: 0 }}>{p.entete.texte}</span>
          <span style={{ display: "flex", alignItems: "flex-end" }}>
            <ChiffreRoulant t={p.t} depart={0} changements={instantsCoche.filter((c, i) => c >= p.lignes[i].a || p.cocheA !== undefined).sort((a, b) => a - b)} taille={tailleCompteur} couleur={coches.length ? NUANCES.orange : NUANCES.sableProfond} />
            <span style={styleTitre(tailleCompteur, NUANCES.sableProfond)}>/{n}</span>
          </span>
        </div>
      ) : null}

      {/* Balayage orange-voile de haut en bas, au `cocheA`. */}
      {balayage >= 0 ? (
        <div style={{ position: "absolute", left: -u * 0.12, right: -u * 0.12, top: haut + balayage * (n * u) - u * 0.6, height: u * 1.2, borderRadius: RELIEF.rayon(W), background: NUANCES.orangeVoile, opacity: 1 - Math.max(0, (p.t - (p.cocheA ?? 0) - 0.16) / 0.08) }} />
      ) : null}

      {p.lignes.map((l, i) => {
        if (p.t < l.a) return null;
        const g = glisse(p.t, l.a, 0.15);
        const coche = p.t >= instantsCoche[i];
        const disque = coche ? glisse(p.t, instantsCoche[i], 0.1) : 0;
        const trait = coche ? glisse(p.t, instantsCoche[i] + 0.04, 0.14) : 0;
        const respire = i === prochaine ? 1 + 0.06 * (0.5 + 0.5 * Math.sin((p.t - l.a) * Math.PI * 2.4)) : 1;
        // Volet orange : plein jusqu'à +0,12 s, puis se retire vers la droite (0,1 s).
        const volet = p.t < l.a + 0.22 ? 1 - glisse(p.t, l.a + 0.12, 0.1) : 0;
        const taille = C(l.texte);
        return (
          <div key={`${l.texte}-${i}`} style={{ position: "absolute", left: 0, right: 0, top: haut + i * u, height: u, borderBottom: i < n - 1 ? `${filet}px solid ${NUANCES.filet}` : undefined }}>
            <div style={{ position: "relative", height: u, display: "flex", alignItems: "center", gap: u * 0.3, transform: `translateX(${(1 - g) * W * 0.03}px)`, opacity: fondu(p.t, l.a) }}>
              {/* Case : creux arrondi, disque orange qui grandit depuis le centre, coche tracée. */}
              <div style={{ position: "relative", width: caseCote, height: caseCote, flexShrink: 0, boxSizing: "border-box", borderRadius: caseCote * 0.26, background: NUANCES.ivoireCreux, border: `${Math.max(2, Math.round(W * 0.0025))}px solid ${coche ? NUANCES.orangeProfond : i === prochaine ? NUANCES.orange : NUANCES.sable}`, overflow: "hidden", transform: `scale(${respire})` }}>
                <div style={{ position: "absolute", left: "50%", top: "50%", width: caseCote * 1.5, height: caseCote * 1.5, marginLeft: -caseCote * 0.75, marginTop: -caseCote * 0.75, borderRadius: "50%", background: degradeOrange, transform: `scale(${disque})` }} />
                {coche ? <Reflet rayon={caseCote * 0.26} inset={1} /> : null}
                {coche ? (
                  <svg style={{ position: "absolute", inset: 0, margin: "auto" }} width={caseCote * 0.66} height={caseCote * 0.66} viewBox="0 0 24 24" fill="none" stroke={NUANCES.ivoire} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trait} />
                  </svg>
                ) : null}
              </div>
              <span style={{ ...styleCorps(taille, coche ? NUANCES.encre : NUANCES.encreDouce), fontFamily: POLICES.texte, lineHeight: 1, flex: 1, minWidth: 0, whiteSpace: "nowrap" }}>{l.texte}</span>
              <Icone nom={l.icone} taille={iconeTaille} couleur={coche ? NUANCES.orange : NUANCES.sableProfond} epaisseur={2.2} />
            </div>
            {volet > 0 ? (
              <div style={{ position: "absolute", left: -u * 0.14, right: -u * 0.14, top: -u * 0.1, bottom: -u * 0.1, borderRadius: RELIEF.rayon(W), background: degradeOrange, transform: `scaleX(${volet})`, transformOrigin: "100% 50%" }}>
                <Reflet rayon={RELIEF.rayon(W)} />
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Badge final : l'UNIQUE héros (pilule encre, reflet, contour fin + ombre dure). */}
      {p.badge && p.t >= p.badge.a ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: u * H_BADGE, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ height: u * H_BADGE * 0.7, ...styleHeros(W, degradeEncre, u), display: "flex", alignItems: "center", gap: u * 0.16, padding: `0 ${u * 0.32}px 0 ${u * 0.24}px`, transform: `translateY(${(1 - eBadge) * W * 0.03}px)`, opacity: fondu(p.t, p.badge.a) }}>
            <Reflet rayon={u * 0.3} />
            <Icone nom={p.badge.icone ?? "coche"} taille={iconeTaille} couleur={NUANCES.orange} epaisseur={2.6} />
            <span style={styleTitre(tailleQuiTient(largeurTitre(p.badge.texte, 1), L * 0.7, TYPO.minimum(W), Math.min(W * 0.036, u * H_BADGE * 0.36)), NUANCES.ivoire)}>{p.badge.texte}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Exemple pour la galerie (contenu Axion-IA plausible, aucun chiffre). Instants relatifs au début de la carte. */
export const EXEMPLE_LISTE_COCHEE = {
  titre: "Notion · QG",
  phrase: "Le cerveau : vos process, vos formations, le CRM, la documentation et le planning de publication. Tout est ici.",
  entete: { texte: "Le cerveau", icone: "etincelles", a: 0.2 },
  lignes: [
    { texte: "Vos process", icone: "reseau", a: 0.5 },
    { texte: "Vos formations", icone: "former", a: 1.0 },
    { texte: "Le CRM", icone: "utilisateurs", a: 1.5 },
    { texte: "La documentation", icone: "document", a: 2.1 },
    { texte: "Le planning de publication", icone: "calendrier", a: 2.7 },
  ],
  cocheA: 3.6,
  badge: { texte: "Tout est ici", icone: "coche", a: 4.1 },
} satisfies Omit<ListeCocheeProps, "t" | "largeurImage" | "hauteurLigne"> & { titre: string; phrase: string };
