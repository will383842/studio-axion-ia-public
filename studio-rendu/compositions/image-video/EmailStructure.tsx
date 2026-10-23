import React from "react";
/**
 * K16 · E-mail structuré : un e-mail dont les lignes se remplissent chacune sur son mot (Objet, Contexte, Demande,
 * Urgence). Un champ sans valeur écrite sur l'image se remplit d'une barre, sans texte inventé (rien d'inventé, I9).
 * Quand plus rien n'arrive, un « Envoyé ✓ » s'allume à droite du bandeau d'en-tête (relance du rythme, posée par la
 * mise en scène).
 * Pixels de l'écran de référence 1080 × 1920.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO, TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse, planEntreeObjet, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { ECART_NOM_EMAIL, ICONE_LIBRE_EMAIL, planEmail, type ChampEmail, type TamponIV } from "./plan-objets";

export function EmailStructure({ champs, debut, t, fond, tampon, titre = "Nouveau message" }: { champs: ChampEmail[]; debut: number; t: number; fond: Fond; tampon?: TamponIV; titre?: string }) {
  const m = planEmail({ champs, debut, tampon }, t);
  if (m.entree <= 0) return null;
  const e = planEntreeObjet(m.entree);
  const sombre = fond === "sombre";
  return (
    <div
      style={{
        position: "absolute",
        left: m.boite.x,
        top: m.boite.y,
        width: m.boite.largeur,
        height: m.boite.hauteur,
        borderRadius: 40,
        background: COULEURS_DUO.blanc,
        boxShadow: `0 28px 64px ${teinte(COULEURS_DUO.encre, sombre ? 0.5 : 0.14)}`,
        overflow: "hidden",
        opacity: e.opacite,
        transform: `translateY(${e.decalageY}px) scale(${e.echelle})`,
      }}
    >
      <div style={{ height: m.enTete, background: COULEURS_DUO.encre, display: "flex", alignItems: "center", gap: 24, padding: "0 44px" }}>
        <Icone nom="mail" taille={60} couleur={COULEURS_DUO.orangeVif} epaisseur={2.8} />
        <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.etiquette * 1920, letterSpacing: "0.24em", textTransform: "uppercase", color: COULEURS_DUO.blanc }}>{titre}</div>
        {m.tampon && m.tampon.opacite > 0 ? (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 22px",
              borderRadius: 40,
              background: COULEURS_DUO.orangeVif,
              fontFamily: famille("inter-gras"),
              fontWeight: graisse("inter-gras"),
              fontSize: TAILLES_DUO.etiquette * 1920,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: COULEURS_DUO.blanc,
              opacity: m.tampon.opacite,
              transform: `scale(${m.tampon.echelle})`,
              transformOrigin: "100% 50%",
            }}
          >
            {m.tampon.texte}
            <Icone nom="coche" taille={TAILLES_DUO.etiquette * 1920 * 1.2} couleur={COULEURS_DUO.blanc} epaisseur={3.2} />
          </div>
        ) : null}
      </div>
      {m.champs.map((c, i) =>
        c.entree > 0 && c.libre ? (
          // Un bloc de la carte posé dans l'e-mail : son libellé s'écrit sur son mot, sur toute la largeur.
          <div key={i} style={{ position: "absolute", left: 48, right: 48, top: c.y, height: c.hauteur, opacity: c.entree, display: "flex", alignItems: "center", gap: ECART_NOM_EMAIL }}>
            <div style={{ flex: "none", opacity: 0.35 + 0.65 * c.remplissage }}>
              <Icone nom="envoyer" taille={ICONE_LIBRE_EMAIL} couleur={COULEURS_DUO.orangeVif} epaisseur={2.8} />
            </div>
            <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: c.libre.taille, lineHeight: 1.1, color: COULEURS_DUO.encre }}>{c.frappeLibre?.texte ?? ""}</div>
          </div>
        ) : c.entree > 0 ? (
          <div
            key={i}
            style={{ position: "absolute", left: 48, right: 48, top: c.y, height: c.hauteur, opacity: c.entree, display: "flex", flexDirection: m.enLigne ? "row" : "column", justifyContent: "center", alignItems: m.enLigne ? "center" : undefined, gap: m.enLigne ? ECART_NOM_EMAIL : undefined }}
          >
            <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: c.tailleNom, lineHeight: 1.1, color: c.remplissage > 0 ? COULEURS_DUO.orange : COULEURS_DUO.gris, marginBottom: m.enLigne ? 0 : 16, width: m.largeurNom ?? undefined, flexShrink: 0 }}>{c.nom}</div>
            <div style={{ flex: m.enLigne ? 1 : undefined }}>
              {c.valeur && c.frappe ? (
                <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: c.valeur.taille, lineHeight: 1.1, color: COULEURS_DUO.encre }}>{c.frappe.texte}</div>
              ) : (
                // Rien d'écrit sur l'image : deux barres se remplissent (aucun texte inventé).
                [0, 1].map((k) => (
                  <div key={k} style={{ position: "relative", height: 26, marginTop: k ? 16 : 0, width: k ? "72%" : "100%", borderRadius: 13, background: teinte(COULEURS_DUO.grisClair, 0.45), overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(0.55 + (0.4 * ((i * 37 + k * 23) % 10)) / 10) * 100 * c.remplissage}%`, borderRadius: 13, background: COULEURS_DUO.encre }} />
                  </div>
                ))
              )}
            </div>
            {i < m.champs.length - 1 ? <div style={{ position: "absolute", left: 0, right: 0, bottom: -12, height: 2, background: teinte(COULEURS_DUO.grisClair, 0.6) }} /> : null}
          </div>
        ) : null,
      )}
    </div>
  );
}
