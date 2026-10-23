/**
 * Carte d'interface (en-tête orange, corps ivoire, contour + ombre dure) qui TOMBE du haut avec un léger rebond et
 * REMONTE pour sortir. Son contenu se construit au fil des mots (frise, liste…).
 */
import React from "react";
import type { ReactNode } from "react";
import type { ContenuCarte, PlanFacecamAnimee } from "../../../src/domaine/facecam-animee/plan";
import { COULEURS, GEOMETRIE, POLICES, TEMPS } from "./charte";
import { encreFlash, FondFlash, Icone, instantSuivant, phaseFlash, styleBoite } from "./elements";
import type { PhaseFlash } from "./elements";
import { animationCarte, DESCENTE } from "./cadrage";
import { progression, rebond } from "./mouvement";

/* ------------------------------------------------------------------ Cartes pleines (revue passe 2, 15/10) ------------------------------------------------------------------ */

/** Premier contenu d'une carte visible 0,2 s au plus après son entrée (revue passe 2 du 15/10 : « Vos priorités » vide 0,75 s). */
export const PREMIER_CONTENU_MAX_SEC = 0.2;
/** Champs « instant d'apparition » d'un contenu de carte (un sous-élément qui SE MONTRE ; les instants d'animation interne — coche, bascule, saisie — n'en sont pas). */
const CLES_APPARITION = new Set(["a", "baseA"]);

/**
 * Contenu dont le PREMIER élément visible apparaît au plus `delai` après `debut` : s'il est daté plus tard (ancien plan,
 * ou plan dont le premier mot tombe tard), cet instant — et lui seul — est avancé à `debut + delai`. Les autres éléments
 * restent sur leur mot. Fonction pure (rend le même objet quand rien ne change).
 */
export function contenuAvance<T extends ContenuCarte>(contenu: T, debut: number, delai = PREMIER_CONTENU_MAX_SEC): T {
  let premier = Infinity;
  const parcourir = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(parcourir);
    else if (x && typeof x === "object")
      for (const [k, v] of Object.entries(x)) {
        if (CLES_APPARITION.has(k) && typeof v === "number") premier = Math.min(premier, v);
        else parcourir(v);
      }
  };
  parcourir(contenu);
  const limite = Math.round((debut + delai) * 1000) / 1000;
  if (!Number.isFinite(premier) || premier <= limite + 1e-9) return contenu;
  const avancer = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(avancer);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, CLES_APPARITION.has(k) && v === premier ? limite : avancer(v)]));
    return x;
  };
  return avancer(contenu) as T;
}

/**
 * Plan RENDU sans bande vide (revue passe 2 du 15/10, 71,25 s et 77,5 s de la vidéo 3) : quand deux objets s'enchaînent
 * à 0,3 s ou moins (`DESCENTE.enchainement`), la prise ne remonte pas entre eux — la bande ivoire restait donc visible
 * SANS objet. L'objet qui sort reste désormais jusqu'à l'entrée du suivant : la bande n'est jamais vide. Seules les fins
 * sont prolongées (≤ 0,3 s) ; aucun instant de contenu, aucune entrée, aucune descente ne change.
 */
export function sansBandeVide(planBrut: PlanFacecamAnimee): PlanFacecamAnimee {
  const plan = sansEtiquettesSuperposees(planBrut);
  type Ref = { liste: "cartes" | "fenetres" | "calques"; i: number; debut: number; fin: number };
  const refs: Ref[] = [
    ...plan.cartes.map((o, i) => ({ liste: "cartes" as const, i, debut: o.debut, fin: o.fin })),
    ...plan.fenetres.map((o, i) => ({ liste: "fenetres" as const, i, debut: o.debut, fin: o.fin })),
    ...plan.calques.map((o, i) => ({ liste: "calques" as const, i, debut: o.debut, fin: o.fin })),
  ];
  const debuts = [...refs.map((r) => r.debut), ...(plan.fin.debut < plan.duree ? [plan.fin.debut] : [])];
  const nouvellesFins = new Map<Ref, number>();
  for (const r of refs) {
    const suivant = Math.min(...debuts.filter((d) => d >= r.fin - 1e-9));
    const ecart = suivant - r.fin;
    if (!(ecart > 1e-9 && ecart <= DESCENTE.enchainement + 1e-9)) continue;
    // Un autre objet occupe déjà l'écart : la bande n'y est pas vide.
    if (refs.some((x) => x !== r && x.debut < suivant - 1e-9 && x.fin > r.fin + 1e-9)) continue;
    nouvellesFins.set(r, suivant);
  }
  if (!nouvellesFins.size) return plan;
  const fin = (liste: Ref["liste"], i: number, f: number) => {
    for (const [r, v] of nouvellesFins) if (r.liste === liste && r.i === i) return v;
    return f;
  };
  return {
    ...plan,
    cartes: plan.cartes.map((o, i) => ({ ...o, fin: fin("cartes", i, o.fin) })),
    fenetres: plan.fenetres.map((o, i) => ({ ...o, fin: fin("fenetres", i, o.fin) })),
    calques: plan.calques.map((o, i) => ({ ...o, fin: fin("calques", i, o.fin) }) as typeof o),
  };
}

/**
 * Jamais deux étiquettes (calques) à l'écran en même temps (revue passe 3 : « Du temps » et « Qui vous échappe » se
 * superposaient de 83,85 à 84,3 s, posées au même endroit au-dessus de la tête). Une étiquette encore affichée quand la
 * suivante arrive est COUPÉE à l'entrée de celle-ci : la suivante la remplace d'un coup. Seules des fins de calques
 * avancent ; une étiquette qui durerait moins de 0,2 s n'est pas raccourcie (la suivante la remplace aussi, plus tard,
 * et le contrôle du plan reste juge). Fonction pure : rend le même objet quand rien ne change.
 */
export function sansEtiquettesSuperposees(plan: PlanFacecamAnimee): PlanFacecamAnimee {
  const ordre = plan.calques.map((c, i) => ({ i, debut: c.debut })).sort((a, b) => a.debut - b.debut || a.i - b.i);
  const fins = new Map<number, number>();
  for (let k = 0; k + 1 < ordre.length; k++) {
    const c = plan.calques[ordre[k].i];
    const suivant = ordre[k + 1].debut;
    if (c.fin > suivant + 1e-9 && suivant - c.debut >= 0.2 - 1e-9) fins.set(ordre[k].i, suivant);
  }
  if (!fins.size) return plan;
  return { ...plan, calques: plan.calques.map((c, i) => (fins.has(i) ? ({ ...c, fin: fins.get(i)! } as typeof c) : c)) };
}

export type CarteProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  titre: string;
  numero: string;
  iconeTitre?: string;
  hauteur: number;
  enfants: ReactNode;
  /** Lot B : manière d'entrer (variété d'une vidéo à l'autre, même marque). Par défaut « chute » (référence). */
  entree?: "chute" | "glisse" | "surgit";
  /** Hauteur naturelle du contenu (px) : s'il dépasse la place, il est RÉDUIT pour tenir (jamais coupé). */
  hauteurContenu?: number;
};

export function Carte(p: CarteProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const x = GEOMETRIE.carteX * p.largeurImage;
  const y = GEOMETRIE.carteY * p.hauteurImage;
  const l = GEOMETRIE.carteL * p.largeurImage;
  // Animation partagée avec la mise en page (cadrage.ts) : les tests « tout ou rien » vérifient exactement ce mouvement.
  const rect = { x0: GEOMETRIE.carteX, x1: GEOMETRIE.carteX + GEOMETRIE.carteL, y0: GEOMETRIE.carteY, y1: GEOMETRIE.carteY + p.hauteur / p.hauteurImage };
  const a = animationCarte(p.t, p.debut, p.fin, rect, p.entree ?? "chute");
  const hEntete = GEOMETRIE.enteteH * p.hauteurImage;
  const taille = hEntete * 0.5;
  const place = p.hauteur - hEntete - hEntete * 0.9 - 2 * Math.max(3, Math.round(p.largeurImage * 0.0045));
  const reduction = p.hauteurContenu && p.hauteurContenu > place ? Math.max(0.5, place / p.hauteurContenu) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: p.hauteur, transform: `translate(${a.dx * p.largeurImage}px, ${a.dy * p.hauteurImage}px) rotate(${a.rotation}deg) scale(${a.echelle})`, transformOrigin: "50% 0%", ...styleBoite(p.largeurImage, COULEURS.ivoire), overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: hEntete, flexShrink: 0, background: COULEURS.orange, borderBottom: `${Math.max(3, Math.round(p.largeurImage * 0.0045))}px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", padding: `0 ${hEntete * 0.35}px`, gap: hEntete * 0.22 }}>
        {p.iconeTitre ? <Icone nom={p.iconeTitre} taille={taille * 1.25} couleur={COULEURS.ivoire} /> : null}
        <span style={{ fontFamily: POLICES.titre, fontSize: taille, color: COULEURS.ivoire, textTransform: "uppercase", letterSpacing: 0.6, flex: 1, whiteSpace: "nowrap", overflow: "hidden" }}>{p.titre}</span>
        <span style={{ fontFamily: POLICES.titre, fontSize: taille * 0.9, color: COULEURS.ivoire, background: COULEURS.encre, borderRadius: 8, padding: `2px ${taille * 0.4}px` }}>{p.numero}</span>
      </div>
      {/* Contenu CENTRÉ dans le corps (la carte a une hauteur minimale de 0,335 H, même quand son contenu est court). */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `${hEntete * 0.45}px ${hEntete * 0.5}px` }}>
        {reduction < 1 ? (
          <div style={{ position: "relative", height: (p.hauteurContenu ?? 0) * reduction }}>
            <div style={{ position: "absolute", top: 0, left: `${-(100 / reduction - 100) / 2}%`, width: `${100 / reduction}%`, transform: `scale(${reduction})`, transformOrigin: "50% 0%" }}>{p.enfants}</div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>{p.enfants}</div>
        )}
      </div>
    </div>
  );
}

export type Etape = { texte: string; icone: string; a: number };

/**
 * Frise verticale : toutes les étapes sont d'abord GRISÉES ; chacune S'ALLUME au mot qui la nomme (cercle orange,
 * icône ivoire, texte encre, petit rebond) ; le fil se remplit jusqu'à la dernière étape allumée.
 */
export type Puce = { etape: number; texte: string; a: number };

/** Part de la hauteur d'une ligne réservée SOUS les étapes pour le badge de la frise (il ne recouvre plus aucune étape). */
export const FRISE_BANDE_BADGE = 0.8;
/** Durée du flash commun « tout est coché » (s) : 4 images. */
export const FLASH_COCHE = 0.16;

/**
 * Hauteur d'une ligne de frise (px) dans la hauteur `n × hauteurLigne` que la mise en page lui donne : avec un badge, les
 * lignes se resserrent pour lui laisser une bande à elle, en bas (revue passe 3 : « Réflexe » recouvrait « Embauche »).
 */
export function ligneFrise(hauteurLigne: number, nbEtapes: number, avecBadge: boolean): number {
  return avecBadge ? (hauteurLigne * nbEtapes) / (nbEtapes + FRISE_BANDE_BADGE) : hauteurLigne;
}

/**
 * Boîtes (px, repère du contenu) des étapes et du badge de la frise, à l'échelle 1 : sert au test de collision
 * (aucun chevauchement entre le badge et une étape, quel que soit le nombre d'étapes).
 */
export function boitesFrise(hauteurLigne: number, nbEtapes: number, avecBadge: boolean): { etapes: { y0: number; y1: number }[]; badge?: { y0: number; y1: number } } {
  const u = ligneFrise(hauteurLigne, nbEtapes, avecBadge);
  const etapes = Array.from({ length: nbEtapes }, (_, i) => ({ y0: i * u, y1: (i + 1) * u }));
  if (!avecBadge) return { etapes };
  // Badge centré dans sa bande : icône (0,32 u, plus haute que le texte 0,26 u × 1,2) + marges (2 × 0,08 u) + contours.
  const hBadge = u * (0.32 + 0.16) + 2 * 4;
  const y0 = nbEtapes * u + (u * FRISE_BANDE_BADGE - hBadge) / 2;
  return { etapes, badge: { y0, y1: y0 + hBadge } };
}

export function Frise({ t, etapes, largeurImage, hauteurLigne: hDonnee, badge, puces = [], cocheA }: { t: number; etapes: Etape[]; largeurImage: number; hauteurLigne: number; badge?: { texte: string; a: number }; puces?: Puce[]; cocheA?: number }) {
  // Même hauteur totale que celle prévue par la mise en page (n × hauteurLigne) ; le badge a sa propre bande en bas.
  const hauteurLigne = ligneFrise(hDonnee, etapes.length, !!badge);
  const rond = hauteurLigne * 0.78;
  const allumees = etapes.filter((e) => t >= e.a).length;
  const contour = Math.max(3, Math.round(largeurImage * 0.0045));
  const active = allumees - 1;
  const depuis = active > 0 ? etapes[active].a : 0;
  const fil = (n: number) => hauteurLigne * Math.max(0, n - 1);
  // Texte ajusté à la place disponible (largeur de carte − rond − marges − place d'une puce) : jamais coupé, jamais
  // plus grand que la taille de la charte (vu au premier essai du réalisateur : « Ce qui change en premier » débordait).
  const dispo = largeurImage * (GEOMETRIE.carteL - 0.1) - rond * 1.4 - (puces.length ? largeurImage * 0.14 : 0);
  const tailleTexte = (texte: string) => Math.min(hauteurLigne * 0.46, dispo / (texte.length * 0.68));
  // Revue passe 3 (priorité 2) : chaque étape s'allume par un FLASH ORANGE PLEIN sur toute la largeur, puis devient la
  // ligne active (sable plein), puis se pose quand la suivante flashe — trois changements francs (voir `FLASH`).
  // Une puce qui arrive sur une étape la fait REFLASHER (elle aussi est un mot dit) : un gros mouvement de plus entre
  // deux étapes, au lieu d'une petite boîte qui ne change que 1 % de l'image.
  const instants = [...etapes.map((e) => e.a), ...puces.map((p) => p.a), ...(cocheA !== undefined ? [cocheA] : [])];
  const evenementsEtape = (i: number) => [etapes[i].a, ...puces.filter((p) => p.etape === i && p.a >= etapes[i].a).map((p) => p.a)];
  const tousCoches = cocheA !== undefined && t >= cocheA;
  const flashCoche = cocheA !== undefined && t >= cocheA && t < cocheA + FLASH_COCHE;
  return (
    <div style={{ position: "relative", height: hDonnee * etapes.length }}>
      {/* Fil vertical : sable, rempli d'orange jusqu'à la dernière étape allumée. */}
      <div style={{ position: "absolute", left: rond / 2 - 3, top: rond / 2, width: 6, height: fil(etapes.length), background: COULEURS.sable, borderRadius: 3 }} />
      <div style={{ position: "absolute", left: rond / 2 - 3, top: rond / 2, width: 6, height: active > 0 ? fil(active) + hauteurLigne * progression(t, depuis, 0.08) : 0, background: COULEURS.orange, borderRadius: 3 }} />
      {etapes.map((e, i) => {
        const on = t >= e.a;
        const dernier = Math.max(e.a, ...evenementsEtape(i).filter((x) => t >= x));
        const phase: PhaseFlash = flashCoche && on ? "flash" : tousCoches ? "pose" : phaseFlash(t, dernier, instantSuivant(dernier, instants));
        const surFond = phase === "flash";
        const coche = tousCoches;
        return (
          <div key={e.texte} style={{ height: hauteurLigne, display: "flex", alignItems: "center", gap: hauteurLigne * 0.32, position: "relative" }}>
            <FondFlash phase={phase} largeurImage={largeurImage} rayon={hauteurLigne * 0.22} deborde={hauteurLigne * 0.18} debordeV={surFond ? hauteurLigne * 0.1 : -hauteurLigne * 0.02} />
            <div
              style={{
                width: rond,
                height: rond,
                borderRadius: "50%",
                background: on ? (surFond ? COULEURS.encre : COULEURS.orange) : COULEURS.ivoire,
                border: `${contour}px solid ${on ? COULEURS.encre : COULEURS.sable}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <Icone nom={coche ? "coche" : e.icone} taille={rond * 0.55} couleur={on ? COULEURS.ivoire : COULEURS.sable} epaisseur={coche ? 3.2 : 2.4} />
            </div>
            <span style={{ position: "relative", fontFamily: POLICES.titre, fontSize: tailleTexte(e.texte), color: on ? encreFlash(phase) : COULEURS.sable, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{e.texte}</span>
            {puces
              .filter((p) => p.etape === i && t >= p.a)
              .map((p) => (
                <span
                  key={p.texte}
                  style={{
                    marginLeft: "auto",
                    position: "relative",
                    ...styleBoite(largeurImage, surFond ? COULEURS.encre : COULEURS.orange, 10),
                    padding: `0 ${hauteurLigne * 0.16}px`,
                    fontFamily: POLICES.titre,
                    fontSize: hauteurLigne * 0.3,
                    lineHeight: 1.4,
                    color: COULEURS.ivoire,
                    // Entrée ample : la puce apparaît d'emblée à 60 % (changement franc dès la 1ʳᵉ image).
                    transform: `scale(${0.6 + 0.4 * rebond(t, p.a, TEMPS.pop, 2.4)}) rotate(-4deg)`,
                  }}
                >
                  {p.texte}
                </span>
              ))}
          </div>
        );
      })}
      {badge && t >= badge.a ? (
        // Bande à lui, SOUS les étapes, alignée à droite : il ne recouvre plus jamais une étape (« Embauche », 33 s).
        <div style={{ position: "absolute", left: 0, right: 0, top: etapes.length * hauteurLigne, height: hauteurLigne * FRISE_BANDE_BADGE, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              transform: `scale(${0.5 + 0.5 * rebond(t, badge.a, TEMPS.pop, 2)}) rotate(-3deg)`,
              transformOrigin: "100% 50%",
              ...styleBoite(largeurImage, COULEURS.encre, 12),
              padding: `${hauteurLigne * 0.08}px ${hauteurLigne * 0.22}px`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icone nom="horloge" taille={hauteurLigne * 0.32} couleur={COULEURS.ivoire} />
            <span style={{ fontFamily: POLICES.titre, fontSize: hauteurLigne * 0.26, color: COULEURS.ivoire, textTransform: "uppercase", whiteSpace: "nowrap" }}>{badge.texte}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
