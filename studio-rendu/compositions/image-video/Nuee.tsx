import React from "react";
/**
 * K07 · Nuée : 2 à 30 objets identiques (enveloppes) en grille, petites cartes blanches comme les nœuds de la maquette
 * validée ; cascade de coches vertes au rythme de la voix ; compteur « 16/20 » qui claque à chaque coche. Les objets
 * non cochés restent blancs (ceux « pour vous »), puis se distinguent un par un (contour orange) quand la voix en parle. Pixels de l'écran de référence (1080 × 1920).
 */
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import type { Fond } from "../../../src/briques/ecrans-motion";
import { couleursDuFond, famille, graisse, planEntreeObjet, rebond, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { planNuee, type ProprietesNuee } from "./plan-objets";

export function Nuee({ t, fond, ...p }: ProprietesNuee & { t: number; fond: Fond }) {
  const plan = planNuee(p, t);
  const c = couleursDuFond(fond);
  return (
    <>
      {plan.objets.map((o) => {
        if (o.entree <= 0) return null;
        const e = planEntreeObjet(o.entree, 40);
        const coche = o.coche > 0;
        // Objet « pour vous » qui se distingue : contour orange, petit saut le temps de son entrée.
        const distingue = o.distinction > 0;
        const orange = fond === "sombre" ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange;
        return (
          <div
            key={o.i}
            style={{
              position: "absolute",
              left: o.x,
              top: o.y,
              width: o.largeur,
              height: o.hauteur,
              opacity: e.opacite,
              transform: `translateY(${e.decalageY - 12 * Math.sin(Math.PI * o.distinction)}px) scale(${e.echelle * (1 + 0.1 * Math.sin(Math.PI * o.distinction))})`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxSizing: "border-box",
                borderRadius: 20,
                background: COULEURS_DUO.blanc,
                border: coche ? `5px solid ${teinte(COULEURS_DUO.vert, 0.25 + 0.75 * Math.min(1, o.coche * 2))}` : distingue ? `6px solid ${teinte(orange, 0.3 + 0.7 * Math.min(1, o.distinction * 2))}` : `5px solid transparent`,
                boxShadow: `0 12px 28px ${teinte(COULEURS_DUO.encre, 0.12)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icone nom={p.icone} taille={o.hauteur * 0.62} couleur={coche ? COULEURS_DUO.gris : distingue ? orange : COULEURS_DUO.encre} epaisseur={2.4} />
            </div>
            {coche ? <CocheNuee x={o.coche} rayon={o.hauteur * 0.3} /> : null}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: plan.compteur.x,
          top: plan.compteur.y,
          width: plan.compteur.largeur,
          textAlign: "center",
          fontFamily: famille("anton"),
          fontWeight: graisse("anton"),
          fontSize: plan.compteur.taille,
          lineHeight: 1,
          color: c.texte,
          fontVariantNumeric: "tabular-nums",
          transform: `scale(${plan.compteur.impulsion})`,
          opacity: plan.objets[0] ? Math.min(1, plan.objets[0].entree * 2) : 0,
        }}
      >
        <span style={{ color: fond === "sombre" ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange }}>{plan.compteur.faits}</span>/{plan.compteur.total}
      </div>
    </>
  );
}

/** Coche verte à cheval sur le coin haut droit de l'objet, qui surgit avec rebond et se trace. */
function CocheNuee({ x, rayon }: { x: number; rayon: number }) {
  return (
    <div
      style={{
        position: "absolute",
        right: -rayon * 0.6,
        top: -rayon * 0.6,
        width: 2 * rayon,
        height: 2 * rayon,
        borderRadius: "50%",
        background: COULEURS_DUO.vert,
        transform: `scale(${0.4 + 0.6 * rebond(x)})`,
        opacity: Math.min(1, x * 3),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 6px 16px ${teinte(COULEURS_DUO.vert, 0.4)}`,
      }}
    >
      <svg width={rayon * 1.3} height={rayon * 1.3} viewBox="0 0 24 24" fill="none" stroke={COULEURS_DUO.blanc} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} strokeDashoffset={24 * (1 - Math.min(1, x * 1.4))} />
      </svg>
    </div>
  );
}
