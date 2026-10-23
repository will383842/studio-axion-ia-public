import React from "react";
/**
 * K10 · CarteBénéfice : une grande carte par bénéfice (pastille d'icône, titre Anton, phrase concrète Inter Bold), entrée
 * en cascade sur son mot, la précédente qui s'efface vers le haut ; une place réservée au micro-objet (L9b) sous la carte.
 * Puis le récapitulatif : les N cartes en ligne, l'image reconstituée. Et le paperboard de l'image A, REDESSINÉ (la
 * photo montre des personnes : jamais reprise, M3) — ce composant ne reçoit aucune image, seulement des mots.
 * Pixels de l'écran de référence 1080 × 1920.
 */
import type { ReactNode } from "react";
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse, planEntreeObjet, planSurgir, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { MicroObjet } from "./MicroObjet";
import { etatBenefices, INTERLIGNE_IV, planCarteBenefice, planPaperboard, planRecap, type BeneficeIV, type TexteAjuste } from "./plan-objets";

/** Lignes d'un texte ajusté. */
export function Lignes({ texte, couleur, police }: { texte: TexteAjuste; couleur: string; police: "anton" | "inter-gras" }) {
  return (
    <div style={{ fontFamily: famille(police), fontWeight: graisse(police), fontSize: texte.taille, lineHeight: INTERLIGNE_IV, color: couleur }}>
      {texte.lignes.map((l, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>
          {l.join(" ")}
        </div>
      ))}
    </div>
  );
}

/** Pastille ronde d'icône (orange par défaut). */
export function PastilleIcone({ icone, diametre, fond = COULEURS_DUO.orangeVif, couleur = COULEURS_DUO.blanc }: { icone?: string; diametre: number; fond?: string; couleur?: string }) {
  return (
    <div style={{ width: diametre, height: diametre, borderRadius: "50%", background: fond, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 28px ${teinte(fond, 0.35)}`, flex: "none" }}>
      {icone ? <Icone nom={icone} taille={diametre * 0.56} couleur={couleur} epaisseur={2.6} /> : null}
    </div>
  );
}

export function CarteBenefice({ benefice, entree, sortie = 0, fond, microObjet }: { benefice: BeneficeIV; entree: number; sortie?: number; fond: Fond; microObjet?: ReactNode }) {
  const p = planCarteBenefice(benefice);
  if (entree <= 0) return null;
  const e = planEntreeObjet(entree);
  const c = couleursDuFond(fond);
  const sombre = fond === "sombre";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: p.boite.x,
          top: p.boite.y,
          width: p.boite.largeur,
          height: p.boite.hauteur,
          boxSizing: "border-box",
          padding: 52,
          borderRadius: 40,
          background: sombre ? COULEURS_DUO.nuitHaut : COULEURS_DUO.blanc,
          boxShadow: `0 26px 60px ${teinte(COULEURS_DUO.encre, sombre ? 0.5 : 0.12)}`,
          opacity: e.opacite * (1 - sortie),
          transform: `translateY(${e.decalageY - 160 * sortie}px) scale(${e.echelle})`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ transform: `scale(${planSurgir(entree).echelle})`, flex: "none" }}>
            <PastilleIcone icone={benefice.icone} diametre={p.icone} />
          </div>
          <Lignes texte={p.titre} couleur={c.texte} police="anton" />
        </div>
        {p.ligne ? (
          <div style={{ marginTop: 30 }}>
            <Lignes texte={p.ligne} couleur={sombre ? COULEURS_DUO.grisClair : COULEURS_DUO.gris} police="inter-gras" />
          </div>
        ) : null}
      </div>
      {microObjet && p.microObjet ? (
        <div style={{ position: "absolute", left: p.microObjet.x, top: p.microObjet.y, width: p.microObjet.largeur, height: p.microObjet.hauteur, opacity: e.opacite * (1 - sortie), transform: `translateY(${-160 * sortie}px)` }}>{microObjet}</div>
      ) : null}
    </>
  );
}

/**
 * La séquence : une carte par bénéfice, sur son heure (`heures[i]`), avec le micro-objet qui JOUE le bénéfice sous la
 * carte (banque L9b) ; un rang de pastilles en haut montre où on en est.
 */
export function Benefices({ benefices, heures, t, fond }: { benefices: BeneficeIV[]; heures: number[]; t: number; fond: Fond }) {
  const e = etatBenefices(heures, t);
  if (e.courante < 0) return null;
  const micro = (i: number) => {
    const b = benefices[i];
    const place = planCarteBenefice(b).microObjet;
    return b.micro && place ? <MicroObjet nom={b.micro} t={t - heures[i]} taille={place.largeur} fond={fond} /> : undefined;
  };
  return (
    <>
      {e.courante > 0 && e.sortie < 1 ? <CarteBenefice benefice={benefices[e.courante - 1]} entree={1} sortie={e.sortie} fond={fond} microObjet={micro(e.courante - 1)} /> : null}
      <CarteBenefice key={benefices[e.courante].id} benefice={benefices[e.courante]} entree={e.entree} fond={fond} microObjet={micro(e.courante)} />
    </>
  );
}

/** Récapitulatif : les N cartes en ligne (une rangée chacune), en cascade depuis `debut`, centrées dans la zone utile. */
export function RecapBenefices({ benefices, t, debut, fond }: { benefices: BeneficeIV[]; t: number; debut: number; fond: Fond }) {
  const r = planRecap(benefices, t, debut);
  const c = couleursDuFond(fond);
  const sombre = fond === "sombre";
  return (
    <>
      {r.lignes.map((l, i) => {
        if (l.entree <= 0) return null;
        const e = planEntreeObjet(l.entree, 60);
        return (
          <div
            key={l.id}
            style={{
              position: "absolute",
              left: r.x,
              top: l.y,
              width: r.largeur,
              height: l.hauteur,
              boxSizing: "border-box",
              padding: "0 32px",
              display: "flex",
              alignItems: "center",
              gap: 32,
              borderRadius: Math.min(l.hauteur / 2.4, 56),
              background: sombre ? COULEURS_DUO.nuitHaut : COULEURS_DUO.blanc,
              boxShadow: `0 16px 40px ${teinte(COULEURS_DUO.encre, sombre ? 0.45 : 0.1)}`,
              opacity: e.opacite,
              transform: `translateY(${e.decalageY}px) scale(${e.echelle})`,
            }}
          >
            <PastilleIcone icone={benefices[i].icone} diametre={l.icone} />
            <Lignes texte={l.titre} couleur={c.texte} police="anton" />
          </div>
        );
      })}
    </>
  );
}

/** Le paperboard de l'image A redessiné (sans personne) : un chevalet, les étapes reliées par des flèches. */
export function Paperboard({ etapes, t, debut, fond }: { etapes: string[]; t: number; debut: number; fond: Fond }) {
  const p = planPaperboard(etapes, t, debut);
  const c = couleursDuFond(fond);
  const H = p.hauteurTableau;
  const entree = planEntreeObjet(Math.min(1, (t - debut) / 0.5));
  if (t < debut) return null;
  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, width: p.largeur, height: H + p.pieds, opacity: entree.opacite, transform: `translateY(${entree.decalageY}px)` }}>
      {/* Pieds du chevalet. */}
      <svg width={p.largeur} height={H + p.pieds} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={`M ${p.largeur * 0.25} ${H - 10} L ${p.largeur * 0.14} ${H + p.pieds - 6} M ${p.largeur * 0.75} ${H - 10} L ${p.largeur * 0.86} ${H + p.pieds - 6} M ${p.largeur / 2} ${H - 10} L ${p.largeur / 2} ${H + p.pieds - 20}`} stroke={COULEURS_DUO.gris} strokeWidth={12} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: H, borderRadius: 18, background: COULEURS_DUO.blanc, border: `10px solid ${COULEURS_DUO.grisClair}`, boxSizing: "border-box", boxShadow: `0 26px 60px ${teinte(COULEURS_DUO.encre, 0.14)}` }} />
      {p.etapes.map((e, i) => {
        const top = p.marge + i * (p.hauteurEtape + p.ecart);
        const s = planSurgir(e.entree);
        return (
          <React.Fragment key={i}>
            {i > 0 ? <div style={{ position: "absolute", left: p.largeur / 2 - 6, top: top - p.ecart + 10, width: 12, height: (p.ecart - 20) * e.fleche, background: COULEURS_DUO.orangeVif, borderRadius: 6 }} /> : null}
            <div
              style={{
                position: "absolute",
                left: 80,
                top,
                width: p.largeur - 160,
                height: p.hauteurEtape,
                borderRadius: p.hauteurEtape / 2,
                border: `7px solid ${i === etapes.length - 1 ? COULEURS_DUO.orangeVif : c.texte}`,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: famille("anton"),
                fontWeight: graisse("anton"),
                fontSize: p.taille,
                textTransform: "uppercase",
                color: i === etapes.length - 1 ? COULEURS_DUO.orange : COULEURS_DUO.encre,
                opacity: s.opacite,
                transform: `scale(${s.echelle})`,
                whiteSpace: "nowrap",
              }}
            >
              {e.texte}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
