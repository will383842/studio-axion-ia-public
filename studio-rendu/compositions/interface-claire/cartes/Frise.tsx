import React from "react";
/**
 * CARTE « FRISE D'ÉTAPES » (redessinée le 15/10, standard premium). Extraite de `Carte.tsx` : mêmes exports, mêmes props
 * (`Frise`, `Etape`, `Puce`, `ligneFrise`, `boitesFrise`, `FRISE_BANDE_BADGE`, `FLASH_COCHE`) ; `Carte.tsx` la
 * réexportera ses noms au branchement.
 *
 * Composition : un rail vertical sable-clair à gauche ; un nœud plat par étape ; numéro « 01 » (titre, sable-profond),
 * libellé (titre, encre). Étapes à venir en sable, sans contour. Étape ACTIVE : fond orange-voile pleine largeur, filet
 * orange de 0,006 L à gauche, nœud orange, et elle MONTE d'une marche (0,012 L). Une puce = un texte orange en corps,
 * aligné à droite. Le badge final est l'UNIQUE héros (pilule encre, reflet, contour 0,003 L + ombre dure 0,005 L).
 *
 * Mouvement : sur son mot, l'étape « claque » sur un fond orange plein 0,16 s (changement franc, ≥ 5 % de l'image),
 * puis se pose en orange-voile ; le rail se remplit d'orange en « glisse » 0,18 s ; le nœud se remplit depuis son
 * centre et l'icône suit à +40 ms. `cocheA` : les nœuds passent en coche en cascade de 50 ms. N3 : un point lumineux
 * descend le rail en continu.
 */
import { COULEURS, POLICES } from "../charte";
import { Icone } from "../elements";
import { bosse, degradeEncre, degradeOrange, fondu, glisse, ivoireA, largeurCorps, largeurTitre, microOmbre, NUANCES, pose, Reflet, styleCorps, styleHeros, styleTitre, tailleQuiTient, TYPO } from "../variantes/premium-1";

export type Etape = { texte: string; icone: string; a: number };
export type Puce = { etape: number; texte: string; a: number };

/** Part de la hauteur d'une ligne réservée SOUS les étapes pour le badge de la frise (il ne recouvre aucune étape). */
export const FRISE_BANDE_BADGE = 0.8;
/** Durée du flash commun « tout est coché » (s) : 4 images. */
export const FLASH_COCHE = 0.16;
/** Durée du flash orange plein d'une étape qui s'allume (s). */
const FLASH_ETAPE = 0.16;
/** Hauteur du badge, en part de sa bande. */
const BADGE_DANS_BANDE = 0.78;

/** Hauteur d'une ligne de frise (px) : avec un badge, les lignes se resserrent pour lui laisser une bande à lui. */
export function ligneFrise(hauteurLigne: number, nbEtapes: number, avecBadge: boolean): number {
  return avecBadge ? (hauteurLigne * nbEtapes) / (nbEtapes + FRISE_BANDE_BADGE) : hauteurLigne;
}

/** Boîtes (px, repère du contenu) des étapes et du badge, à l'échelle 1 : test de collision badge ↔ étapes. */
export function boitesFrise(hauteurLigne: number, nbEtapes: number, avecBadge: boolean): { etapes: { y0: number; y1: number }[]; badge?: { y0: number; y1: number } } {
  const u = ligneFrise(hauteurLigne, nbEtapes, avecBadge);
  const etapes = Array.from({ length: nbEtapes }, (_, i) => ({ y0: i * u, y1: (i + 1) * u }));
  if (!avecBadge) return { etapes };
  const hBadge = u * FRISE_BANDE_BADGE * BADGE_DANS_BANDE;
  const y0 = nbEtapes * u + (u * FRISE_BANDE_BADGE - hBadge) / 2;
  return { etapes, badge: { y0, y1: y0 + hBadge } };
}

export function Frise({ t, etapes, largeurImage: W, hauteurLigne: hDonnee, badge, puces = [], cocheA }: { t: number; etapes: Etape[]; largeurImage: number; hauteurLigne: number; badge?: { texte: string; a: number }; puces?: Puce[]; cocheA?: number }) {
  const u = ligneFrise(hDonnee, etapes.length, !!badge);
  const total = hDonnee * etapes.length;
  const largeur = largeurCorps(W);
  const noeud = Math.min(W * 0.07, u * 0.7);
  const xRail = noeud / 2;
  const rail = Math.max(4, Math.round(W * 0.008));
  const marche = W * 0.012;
  const allumees = etapes.filter((e) => t >= e.a).length;
  const active = allumees - 1;
  const fini = cocheA !== undefined && t >= cocheA;

  // Typographie : numéro et libellé au niveau « titre », puce au niveau « corps ».
  const placeTexte = largeur - noeud - u * 0.3 - (puces.length ? W * 0.2 : 0);
  const titreMax = Math.min(TYPO.titre(W), u * 0.42);
  const tailleNumero = titreMax;
  const placeLibelle = placeTexte - largeurTitre("00", tailleNumero) - u * 0.24;
  const tailleLibelle = (texte: string) => tailleQuiTient(largeurTitre(texte, 1), placeLibelle, TYPO.minimum(W), titreMax);
  const taillePuce = Math.max(TYPO.minimum(W), Math.min(TYPO.corps(W), u * 0.32));

  // Remplissage du rail : du nœud précédent au nœud actif, en « glisse » 0,18 s.
  const centre = (i: number) => i * u + u / 2;
  const remplissage = active < 0 ? 0 : active === 0 ? 0 : centre(active - 1) + (centre(active) - centre(active - 1)) * glisse(t, etapes[active].a, 0.18) - centre(0);
  const railPlein = fini ? centre(etapes.length - 1) - centre(0) : remplissage;

  // Badge (héros) : se pose avec un léger écrasement de toute la frise (suivi).
  const eBadge = badge && t >= badge.a ? pose(t, badge.a, 0.22) : 0;
  const ecrase = badge ? 1 - 0.02 * bosse(t, badge.a + 0.1, 0.1) : 1;

  // N3 : point lumineux qui descend le rail (période 1,4 s) sur la partie remplie (ou tout le rail avant la 1ʳᵉ étape).
  const longueurRail = centre(etapes.length - 1) - centre(0);
  const course = railPlein > u * 0.5 ? railPlein : longueurRail;
  const phaseN3 = ((t % 1.4) + 1.4) % 1.4 / 1.4;
  const yPoint = centre(0) + course * phaseN3;
  const lueur = railPlein > u * 0.5;

  return (
    <div style={{ position: "relative", height: total, transform: `scaleY(${ecrase})`, transformOrigin: "50% 100%" }}>
      {/* Rail : piste sable-clair, remplissage orange (dégradé), point lumineux. */}
      <div style={{ position: "absolute", left: xRail - rail / 2, top: centre(0), width: rail, height: longueurRail, borderRadius: rail, background: NUANCES.sableClair }} />
      <div style={{ position: "absolute", left: xRail - rail / 2, top: centre(0), width: rail, height: Math.max(0, railPlein), borderRadius: rail, background: degradeOrange }} />
      <div style={{ position: "absolute", left: xRail - rail * 0.9, top: yPoint - rail * 0.9, width: rail * 1.8, height: rail * 1.8, borderRadius: "50%", background: lueur ? NUANCES.ivoire : NUANCES.ivoireCreux, boxShadow: `0 0 ${rail * 2}px ${rail}px ${lueur ? ivoireA(0.55) : ivoireA(0.3)}`, opacity: lueur ? 0.95 : 0.7 }} />

      {etapes.map((e, i) => {
        const on = t >= e.a;
        const estActive = i === active && !fini;
        // Instants qui font « claquer » la ligne : son mot, et les mots de ses puces.
        const evenements = [e.a, ...puces.filter((p) => p.etape === i && p.a >= e.a).map((p) => p.a)].filter((x) => t >= x);
        const dernier = evenements.length ? Math.max(...evenements) : Infinity;
        const flash = (on && t < dernier + FLASH_ETAPE && !fini) || (fini && t < (cocheA ?? 0) + FLASH_COCHE);
        const monte = estActive ? pose(t, e.a, 0.2) : 0;
        const descend = !estActive && on && active > i && !fini ? 1 - glisse(t, etapes[active].a, 0.16) : 0;
        const dy = -marche * Math.max(monte, descend);
        // Nœud : se remplit depuis le centre, l'icône suit à +40 ms.
        const remplit = on ? glisse(t, e.a, 0.14) : 0;
        const eIcone = on ? pose(t, e.a + 0.04, 0.2) : 0;
        const debutCoche = cocheA !== undefined ? cocheA + i * 0.05 : Infinity;
        const coche = t >= debutCoche;
        const trait = coche ? glisse(t, debutCoche, 0.14) : 0;
        const fondNoeud = !on ? NUANCES.sableClair : estActive || coche ? degradeOrange : degradeEncre;
        const couleurTexte = flash ? NUANCES.ivoire : on ? NUANCES.encre : NUANCES.sable;
        const couleurNumero = flash ? NUANCES.ivoire : on ? NUANCES.sableProfond : NUANCES.sable;
        const pucesLigne = puces.filter((p) => p.etape === i && t >= p.a);
        return (
          <div key={`${e.texte}-${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * u, height: u, transform: `translateY(${dy}px)` }}>
            {/* Fond : orange plein au flash, puis orange-voile avec filet orange à gauche (étape active). */}
            {flash || estActive ? (
              <div
                style={{
                  position: "absolute",
                  left: -u * 0.14,
                  right: -u * 0.14,
                  top: flash ? -u * 0.12 : u * 0.06,
                  bottom: flash ? -u * 0.12 : u * 0.06,
                  borderRadius: W * 0.012,
                  background: flash ? degradeOrange : NUANCES.orangeVoile,
                  boxShadow: estActive && !flash ? microOmbre(W) : undefined,
                  opacity: flash ? 1 : fondu(t, e.a + FLASH_ETAPE - 0.04),
                  overflow: "hidden",
                }}
              >
                {!flash ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.round(W * 0.006), background: NUANCES.orange }} /> : <Reflet rayon={W * 0.012} />}
              </div>
            ) : null}
            <div style={{ position: "relative", height: u, display: "flex", alignItems: "center", gap: u * 0.3 }}>
              {/* Nœud plat (aucun contour) : piste sable-clair, remplissage qui grandit depuis le centre. */}
              <div style={{ position: "relative", width: noeud, height: noeud, flexShrink: 0, borderRadius: "50%", background: NUANCES.sableClair, boxShadow: on ? microOmbre(W, 0.8) : undefined }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: fondNoeud, transform: `scale(${on ? remplit : 0})`, overflow: "hidden" }}>{on ? <Reflet rayon={noeud * 0.5} inset={noeud * 0.12} /> : null}</div>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {coche ? (
                    <svg width={noeud * 0.56} height={noeud * 0.56} viewBox="0 0 24 24" fill="none" stroke={NUANCES.ivoire} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trait} />
                    </svg>
                  ) : (
                    <div style={{ transform: `scale(${on ? 0.6 + 0.4 * eIcone : 1})`, opacity: on ? Math.min(1, eIcone * 2) : 1 }}>
                      <Icone nom={e.icone} taille={noeud * 0.5} couleur={on ? NUANCES.ivoire : NUANCES.sable} epaisseur={2.4} />
                    </div>
                  )}
                </div>
              </div>
              <span style={{ ...styleTitre(tailleNumero, couleurNumero), flexShrink: 0, width: largeurTitre("00", tailleNumero) }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ ...styleTitre(tailleLibelle(e.texte), couleurTexte), flex: 1, minWidth: 0 }}>{e.texte}</span>
              {pucesLigne.length ? (
                <span style={{ display: "flex", gap: u * 0.2, flexShrink: 0 }}>
                  {pucesLigne.map((p) => {
                    const g = glisse(t, p.a, 0.18);
                    return (
                      <span key={p.texte} style={{ ...styleCorps(taillePuce, flash ? NUANCES.ivoire : NUANCES.orange), fontFamily: POLICES.texte, whiteSpace: "nowrap", transform: `translateX(${(1 - g) * W * 0.03}px)`, opacity: fondu(t, p.a), maxWidth: W * 0.2, overflow: "hidden" }}>
                        {p.texte}
                      </span>
                    );
                  })}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Badge final : l'UNIQUE héros, posé dans sa bande, en bas à droite. */}
      {badge && t >= badge.a ? <BadgeFrise t={t} a={badge.a} texte={badge.texte} W={W} u={u} y={etapes.length * u} e={eBadge} /> : null}
    </div>
  );
}

function BadgeFrise({ t, a, texte, W, u, y, e }: { t: number; a: number; texte: string; W: number; u: number; y: number; e: number }) {
  const bande = u * FRISE_BANDE_BADGE;
  const h = bande * BADGE_DANS_BANDE;
  const taille = Math.max(TYPO.minimum(W), Math.min(W * 0.036, h * 0.5));
  const icone = W * 0.04;
  const largeurMax = largeurCorps(W) * 0.8;
  const tailleTexte = tailleQuiTient(largeurTitre(texte, 1), largeurMax - icone - h * 0.9, TYPO.minimum(W), taille);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, height: bande, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
      <div
        style={{
          height: h,
          ...styleHeros(W, degradeEncre, h / 2),
          display: "flex",
          alignItems: "center",
          gap: h * 0.22,
          padding: `0 ${h * 0.42}px 0 ${h * 0.3}px`,
          transform: `translateY(${(1 - e) * W * 0.03}px)`,
          opacity: fondu(t, a),
        }}
      >
        <Reflet rayon={h / 2} />
        <Icone nom="horloge" taille={icone} couleur={COULEURS.orange} epaisseur={2.4} />
        <span style={styleTitre(tailleTexte, NUANCES.ivoire)}>{texte}</span>
      </div>
    </div>
  );
}

/** Exemple pour la galerie (aucun chiffre réel). Instants relatifs au début de la carte. */
export const EXEMPLE_FRISE = {
  titre: "Votre parcours",
  phrase: "D'abord un diagnostic, ensuite vos priorités, puis la formation et enfin l'automatisation.",
  etapes: [
    { texte: "Diagnostic", icone: "loupe", a: 0.25 },
    { texte: "Priorités", icone: "boussole", a: 1.1 },
    { texte: "Formation", icone: "former", a: 1.9 },
    { texte: "Automatisation", icone: "eclair", a: 2.8 },
  ],
  puces: [{ etape: 0, texte: "45 min", a: 0.7 }],
  cocheA: 3.6,
  badge: { texte: "Exemple de parcours", a: 4.0 },
} satisfies { titre: string; phrase: string; etapes: Etape[]; puces: Puce[]; cocheA: number; badge: { texte: string; a: number } };

