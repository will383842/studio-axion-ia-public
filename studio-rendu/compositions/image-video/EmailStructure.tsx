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
import { useVariete } from "./variete/ContexteVariete";
import { habillageObjet } from "./variete/objets/habillage";
import { codeDe } from "../../../src/briques/schema-motion/variete";
import { ECART_NOM_EMAIL, ICONE_LIBRE_EMAIL, planEmail, type ChampEmail, type TamponIV } from "./plan-objets";

export function EmailStructure({ champs, debut, t, fond, tampon, titre = "Nouveau message" }: { champs: ChampEmail[]; debut: number; t: number; fond: Fond; tampon?: TamponIV; titre?: string }) {
  const m = planEmail({ champs, debut, tampon }, t);
  if (m.entree <= 0) return null;
  const e = planEntreeObjet(m.entree);
  const sombre = fond === "sombre";
  const h = habillageObjet(codeDe(useVariete()?.recette, "objets"), fond);
  return (
    <div
      style={{
        position: "absolute",
        left: m.boite.x,
        top: m.boite.y,
        width: m.boite.largeur,
        height: m.boite.hauteur,
        borderRadius: h.rayon,
        background: COULEURS_DUO.blanc,
        boxShadow: `0 ${h.ombre.decalageY}px ${h.ombre.flou}px ${teinte(COULEURS_DUO.encre, sombre ? h.ombre.alphaSombre : h.ombre.alphaClair)}`,
        overflow: "hidden",
        opacity: e.opacite,
        transform: `translateY(${e.decalageY}px) scale(${e.echelle})`,
      }}
    >
      <div style={{ ...(h.enTete.filetGauche ? { position: "relative" as const } : {}), height: m.enTete, background: h.enTete.fond, display: "flex", alignItems: "center", gap: 24, padding: "0 44px" }}>
        {h.enTete.filetGauche ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 12, background: h.enTete.filetGauche }} /> : null}
        <Icone nom="mail" taille={60} couleur={h.enTete.icone} epaisseur={h.enTete.epaisseurIcone} />
        {h.enTete.point ? <div style={{ width: 18, height: 18, borderRadius: "50%", background: h.enTete.point, flex: "none" }} /> : null}
        <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.etiquette * 1920, letterSpacing: h.enTete.majuscules ? "0.24em" : "0.02em", textTransform: h.enTete.majuscules ? "uppercase" : "none", color: h.enTete.texte }}>{titre}</div>
        {m.tampon && m.tampon.opacite > 0 ? (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: `${h.tampon.paddingV}px ${h.tampon.paddingH}px`,
              borderRadius: h.tampon.rayon,
              background: h.tampon.fond ?? "transparent",
              border: h.tampon.contour ? `3px solid ${h.tampon.contour}` : undefined,
              fontFamily: famille("inter-gras"),
              fontWeight: graisse("inter-gras"),
              fontSize: TAILLES_DUO.etiquette * 1920,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: h.tampon.texte,
              opacity: m.tampon.opacite,
              transform: `${h.tampon.angle ? `rotate(${h.tampon.angle}deg) ` : ""}scale(${m.tampon.echelle})`,
              transformOrigin: "100% 50%",
            }}
          >
            {m.tampon.texte}
            <Icone nom="coche" taille={TAILLES_DUO.etiquette * 1920 * 1.2} couleur={h.tampon.texte} epaisseur={3.2} />
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
