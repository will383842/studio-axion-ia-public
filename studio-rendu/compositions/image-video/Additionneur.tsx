import React from "react";
/**
 * K09 · Additionneur : des minuteurs qui montent chacun sur son mot (0 → 8, 0 → 6, 0 → 5), puis l'addition
 * « 8 + 6 + 5 = 19 min » qui s'écrit mot par mot et dont le total se pose À l'heure de son mot ; enfin, le compteur
 * de bascule : 19:00 qui descend jusqu'à 0:45, puis « 45 sec » en vert. Les nombres sont ceux de la carte : un écart
 * entre la somme et le total lu est signalé par le plan (`ecart`), jamais corrigé. Le détail du résultat lu sur la carte
 * (« risque erreur : élevé ») se pose sous l'addition, sa valeur sur son mot. Pixels de l'écran de référence.
 */
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import type { Fond } from "../../../src/briques/ecrans-motion";
import { couleursDuFond, famille, graisse, planEntreeObjet, planSurgir, teinte } from "../cas-concret/plans/commun";
import { planAdditionneur, type ProprietesAdditionneur } from "./plan-objets";

export function Additionneur({ t, fond, ...p }: ProprietesAdditionneur & { t: number; fond: Fond }) {
  const plan = planAdditionneur(p, t);
  const c = couleursDuFond(fond);
  const accent = fond === "sombre" ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange;
  const g = plan.geometrie;
  const D = g.diametre;
  // Quand le compteur arrive, les minuteurs s'atténuent et l'addition laisse sa bande au compteur.
  const attenue = 1 - 0.6 * plan.retrait;
  const equationVisible = 1 - plan.retrait;
  return (
    <>
      {plan.minuteurs.map((m, i) => {
        if (m.entree <= 0) return null;
        const e = planEntreeObjet(m.entree, 40);
        const r = D / 2 - 9;
        const L = 2 * Math.PI * r;
        const rang = g.rangs[i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: rang.x,
              top: rang.y,
              width: rang.largeur,
              height: rang.hauteur,
              boxSizing: "border-box",
              padding: "0 40px",
              display: "flex",
              alignItems: "center",
              gap: 40,
              borderRadius: 36,
              opacity: e.opacite * attenue,
              transform: `translateY(${e.decalageY}px) scale(${e.echelle})`,
            }}
          >
            <div style={{ position: "relative", width: D, height: D, flex: "none", borderRadius: "50%", background: COULEURS_DUO.blanc, boxShadow: `0 16px 36px ${teinte(COULEURS_DUO.encre, 0.12)}` }}>
              <svg width={D} height={D} style={{ position: "absolute", inset: 0 }}>
                <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke={teinte(COULEURS_DUO.encre, 0.1)} strokeWidth={14} />
                <circle
                  cx={D / 2}
                  cy={D / 2}
                  r={r}
                  fill="none"
                  stroke={COULEURS_DUO.orangeVif}
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeDasharray={`${L} ${L}`}
                  strokeDashoffset={L * (1 - m.arc)}
                  transform={`rotate(-90 ${D / 2} ${D / 2})`}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: plan.tailles.minuteur, color: COULEURS_DUO.encre, fontVariantNumeric: "tabular-nums" }}>
                {m.affiche}
              </div>
            </div>
            <div style={{ fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: plan.tailles.libelle, lineHeight: 1.05, color: c.texte, textTransform: "uppercase", whiteSpace: "nowrap" }}>{m.libelle}</div>
          </div>
        );
      })}
      {equationVisible > 0 ? (
        <div
          style={{
            position: "absolute",
            left: g.bande.x,
            top: g.bande.y,
            width: g.bande.largeur,
            height: g.bande.hauteur,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.28em",
            fontFamily: famille("anton"),
            fontWeight: graisse("anton"),
            fontSize: plan.tailles.equation,
            lineHeight: 1,
            color: c.texte,
            whiteSpace: "nowrap",
            opacity: equationVisible,
            transform: `translateY(${-40 * plan.retrait}px)`,
          }}
        >
          {plan.equation.map((m, k) => {
            const s = m.accent ? planSurgir(m.entree) : null;
            const e = planEntreeObjet(m.entree, 30);
            return (
              <span
                key={k}
                style={{
                  display: "inline-block",
                  opacity: s ? s.opacite : e.opacite,
                  transform: s ? `scale(${s.echelle})` : `translateY(${e.decalageY}px)`,
                  color: m.accent ? accent : m.texte === "+" || m.texte === "=" ? COULEURS_DUO.gris : c.texte,
                  textTransform: "uppercase",
                }}
              >
                {m.texte}
              </span>
            );
          })}
        </div>
      ) : null}
      {plan.detail && g.detail && plan.detail.entree > 0 ? (
        // Détail du résultat lu sur la carte (« RISQUE ERREUR : ÉLEVÉ ») : le libellé entre, puis la valeur claque en orange.
        <div
          style={{
            position: "absolute",
            left: g.detail.x,
            top: g.detail.y,
            width: g.detail.largeur,
            height: g.detail.hauteur,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.3em",
            fontFamily: famille("anton"),
            fontWeight: graisse("anton"),
            fontSize: plan.detail.taille,
            lineHeight: 1,
            color: c.texte,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            opacity: planEntreeObjet(plan.detail.entree, 24).opacite * equationVisible,
            transform: `translateY(${planEntreeObjet(plan.detail.entree, 24).decalageY - 40 * plan.retrait}px)`,
          }}
        >
          <span>{plan.detail.valeur ? `${plan.detail.libelle} :` : plan.detail.libelle}</span>
          {plan.detail.valeur && plan.detail.entreeValeur > 0 ? (
            <span style={{ display: "inline-block", color: accent, opacity: planSurgir(plan.detail.entreeValeur).opacite, transform: `scale(${planSurgir(plan.detail.entreeValeur).echelle})` }}>{plan.detail.valeur}</span>
          ) : null}
        </div>
      ) : null}
      {plan.compteur && plan.compteur.visible > 0 ? (
        <div
          style={{
            position: "absolute",
            left: g.bande.x,
            top: g.bande.y,
            width: g.bande.largeur,
            height: g.bande.hauteur,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: famille("anton"),
            fontWeight: graisse("anton"),
            fontSize: plan.tailles.compteur,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            textTransform: "uppercase",
            opacity: plan.compteur.visible,
            color: plan.compteur.fini > 0 ? COULEURS_DUO.vert : c.texte,
            transform: `scale(${plan.compteur.fini > 0 ? planSurgir(plan.compteur.fini).echelle : 1})`,
            textShadow: plan.compteur.fini > 0 ? `0 0 40px ${teinte(COULEURS_DUO.vert, 0.45)}` : undefined,
          }}
        >
          {plan.compteur.texte}
        </div>
      ) : null}
    </>
  );
}
