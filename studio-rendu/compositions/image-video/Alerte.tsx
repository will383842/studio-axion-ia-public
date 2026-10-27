import React from "react";
/**
 * K15 · Alerte : la notification tombe du haut (« Telegram · maintenant » / « Intervention requise »), rebondit, la
 * cloche s'agite et l'écran tremble (`secousseAlerte`, à appliquer à la scène entière). Style de l'image 07 de la
 * maquette validée : carte blanche cerclée d'encre, pastille bleue d'envoi ; elle tombe sur l'écran verrouillé d'un
 * téléphone qui remplit la zone utile. Ce qui la déclenche (« le client écrit ») s'allume en haut de l'écran
 * verrouillé : une ligne à puce orange par nœud cité, sur le mot qui le nomme ; la notification tombe dessous, à la
 * place de la cloche. Quand plus rien n'arrive, un « Lu ✓ » s'allume en haut à droite de la notification (relance du
 * rythme, posée par la mise en scène). Pixels de l'écran de référence 1080 × 1920.
 */
import { COULEURS_DUO, TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { Lignes } from "./CarteBenefice";
import { codeDe } from "../../../src/briques/schema-motion/variete";
import { useVariete } from "./variete/ContexteVariete";
import { habillageObjet } from "./variete/objets/habillage";
import { PUCE_DECLENCHEUR, planAlerte, type DeclencheurAlerte, type TamponIV } from "./plan-objets";

/** Bleu de la pastille d'envoi (messagerie), comme la maquette. */
const BLEU_MESSAGERIE = "#2AABEE";

export function Alerte({ source, moment, message, t0, frappe, t, declencheurs, tampon, icone = "envoyer" }: { source: string; moment?: string; message: string; t0: number; frappe?: number; t: number; declencheurs?: DeclencheurAlerte[]; tampon?: TamponIV; icone?: string }) {
  const a = planAlerte({ source, moment, message, t: t0, declencheurs, tampon, frappe }, t);
  const tel = a.telephone;
  const h = habillageObjet(codeDe(useVariete()?.recette, "objets"), "sombre");
  const premier = Math.min(t0, ...(declencheurs ?? []).map((d) => d.t));
  const entreeTel = Math.min(1, Math.max(0, (t - (premier - 0.6)) / 0.4));
  return (
    <>
      {/* Le téléphone (écran verrouillé) remplit la zone utile ; la cloche s'agite au milieu de l'écran. */}
      <div
        style={{
          position: "absolute",
          left: tel.x,
          top: tel.y,
          width: tel.largeur,
          height: tel.hauteur,
          boxSizing: "border-box",
          borderRadius: 80,
          border: `14px solid ${COULEURS_DUO.encre}`,
          background: `linear-gradient(180deg, ${COULEURS_DUO.nuitHaut}, ${COULEURS_DUO.encre})`,
          boxShadow: `0 40px 90px ${teinte(COULEURS_DUO.encre, 0.3)}`,
          opacity: entreeTel,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: 22, width: 180, height: 40, marginLeft: -90, borderRadius: 20, background: COULEURS_DUO.encre }} />
        {a.cloche ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, display: "flex", justifyContent: "center", opacity: 0.9 }}>
            <div style={{ transform: `rotate(${a.angleCloche}deg)`, transformOrigin: "50% 10%", width: 230, height: 230, borderRadius: "50%", background: teinte(COULEURS_DUO.orangeVif, 0.16), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: a.opacite > 0 ? `0 0 90px ${teinte(COULEURS_DUO.orangeVif, 0.45)}` : undefined }}>
              <Icone nom="cloche" taille={130} couleur={COULEURS_DUO.orangeVif} epaisseur={2.4} />
            </div>
          </div>
        ) : null}
        <div style={{ position: "absolute", left: "50%", bottom: 34, width: 220, height: 12, marginLeft: -110, borderRadius: 6, background: teinte(COULEURS_DUO.ivoire, 0.35) }} />
      </div>
      {a.declencheurs.map((d, i) =>
        d.opacite > 0 ? (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: d.largeur,
              height: d.hauteur,
              boxSizing: "border-box",
              padding: "0 32px",
              borderRadius: 36,
              background: teinte(COULEURS_DUO.ivoire, 0.12),
              border: `3px solid ${teinte(COULEURS_DUO.ivoire, 0.28)}`,
              display: "flex",
              alignItems: "center",
              gap: 24,
              opacity: d.opacite,
              transform: `translateY(${d.decalageY}px)`,
            }}
          >
            <div style={{ width: PUCE_DECLENCHEUR, height: PUCE_DECLENCHEUR, borderRadius: "50%", background: COULEURS_DUO.orangeVif, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: `0 0 36px ${teinte(COULEURS_DUO.orangeVif, 0.5)}` }}>
              <Icone nom="eclair" taille={36} couleur={COULEURS_DUO.blanc} epaisseur={2.8} />
            </div>
            <Lignes texte={d.texte} couleur={COULEURS_DUO.ivoire} police="inter-gras" />
          </div>
        ) : null,
      )}
      {a.opacite > 0 ? (
        <div
          style={{
            position: "absolute",
            left: a.notification.x,
            top: a.notification.y,
            width: a.largeur,
            boxSizing: "border-box",
            padding: "30px 32px",
            borderRadius: h.alerte.rayon,
            background: h.alerte.fond,
            border: `${h.alerte.epaisseurBordure}px solid ${h.alerte.bordure}`,
            borderLeft: h.alerte.filetGauche ? `18px solid ${h.alerte.filetGauche}` : undefined,
            display: "flex",
            alignItems: "center",
            gap: 30,
            boxShadow: `0 30px 70px ${teinte(COULEURS_DUO.encre, 0.35)}`,
            opacity: a.opacite,
            transform: `translate(${a.secousse.x}px, ${a.decalageY + a.secousse.y}px)`,
          }}
        >
          <div style={{ width: 116, height: 116, borderRadius: "50%", background: BLEU_MESSAGERIE, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icone nom={icone} taille={64} couleur={COULEURS_DUO.blanc} epaisseur={2.8} />
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.etiquette * 1920, letterSpacing: "0.2em", textTransform: "uppercase", color: COULEURS_DUO.gris, marginBottom: 10 }}>{a.etiquette}</div>
            <div style={{ opacity: a.opaciteMessage }}>
              <Lignes texte={a.message} couleur={COULEURS_DUO.encre} police="inter-gras" />
            </div>
            {a.opaciteMessage < 1 ? (
              // Le message s'écrit sur le mot qui nomme l'alerte : trois points FIXES « en train d'écrire » jusque-là (aucun micro-mouvement).
              <div style={{ position: "absolute", left: 0, bottom: 8, display: "flex", gap: 14, opacity: 1 - a.opaciteMessage }}>
                {[0, 1, 2].map((k) => (
                  <div key={k} style={{ width: 22, height: 22, borderRadius: "50%", background: COULEURS_DUO.gris, opacity: 0.7 }} />
                ))}
              </div>
            ) : null}
          </div>
          {a.tampon && a.tampon.opacite > 0 ? (
            <div
              style={{
                position: "absolute",
                right: 26,
                top: 22,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: famille("inter-gras"),
                fontWeight: graisse("inter-gras"),
                fontSize: TAILLES_DUO.etiquette * 1920,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: h.alerte.tamponTexte,
                opacity: a.tampon.opacite,
                transform: `${h.tampon.angle ? `rotate(${h.tampon.angle}deg) ` : ""}scale(${a.tampon.echelle})`,
                transformOrigin: "100% 50%",
              }}
            >
              {a.tampon.texte}
              <Icone nom="coche" taille={TAILLES_DUO.etiquette * 1920 * 1.2} couleur={h.alerte.tamponTexte} epaisseur={3.2} />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
