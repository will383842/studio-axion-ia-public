import React from "react";
/**
 * K03 · Nœud : carte arrondie blanche (style de la maquette validée), pastille d'icône au trait à cheval sur le bord
 * gauche (les flèches arrivent en haut, partent en bas, reviennent par la droite), libellé Anton, détail Inter Bold. Surgit avec rebond à son mot ; actif (contour et halo de sa couleur), vu
 * (grisé à 35 %), fait (coche verte). Coordonnées et tailles en pixels de toile.
 *
 * Variété (lot APP-MAT, lue par `useVariete()` ; sans variété, ou en APP-A et MAT-A : rendu de référence inchangé) :
 * APP-B tracé au feutre, APP-C carte éteinte qui s'allume à son mot (`fantome` : éteinte, sans texte), APP-D fiche qui
 * tombe ; MAT-B carte de papier, MAT-C contour fait main et ombre en hachures, MAT-D tranche (épaisseur).
 */
import { ECRAN_IV, MESURES_TOILE, type BoiteNoeud } from "../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse, planSurgir, rebond, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { couleurTrait, OPACITE_VU, RAYON_PASTILLE, type EtatNoeud } from "./plan";
import { apparitionDe, BEIGE_ETEINT, chuteFiche, graineDe, progresDe, TEMPS_APPARITION, traceFeutre } from "./variete/apparition/apparition";
import { contourBas, Feutre, pointContourBas } from "./variete/apparition/Feutre";
import { useVariete } from "./variete/ContexteVariete";
import { hachures, matiereDe, rectMain } from "./variete/matiere/trait";

export function Noeud({ boite, icone, etat, ecoule = 0, fantome = false }: { boite: BoiteNoeud; icone?: string; etat: EtatNoeud; ecoule?: number; fantome?: boolean }) {
  const variete = useVariete();
  const app = apparitionDe(variete);
  const mat = matiereDe(variete);
  const eteinte = fantome && app?.code === "APP-C" && etat.etat === "absent";
  if (etat.etat === "absent" && !eteinte) return null;
  const s = planSurgir(etat.entree);
  const actif = etat.etat === "actif";
  const accent = couleurTrait(boite.couleur);
  const halo = boite.couleur === "orange" ? teinte(COULEURS_DUO.orangeVif, 0.38) : teinte(COULEURS_DUO.encre, 0.2);
  const contour = actif ? 6 : 0;
  const M = MESURES_TOILE;
  // Apparition : opacité et transformation de la carte, part de blanc posée, part de texte visible.
  let opacite = s.opacite;
  let transform = `scale(${s.echelle})`;
  let blanc = 1;
  let texte = 1;
  let feutre: ReturnType<typeof traceFeutre> | null = null;
  let chute: ReturnType<typeof chuteFiche> | null = null;
  if (app?.code === "APP-B") {
    feutre = traceFeutre(ecoule);
    opacite = 1;
    transform = "none";
    blanc = feutre.blanc;
    texte = feutre.texte;
  } else if (app?.code === "APP-C") {
    opacite = 1;
    transform = "none";
    blanc = eteinte ? 0 : progresDe(ecoule, 0, TEMPS_APPARITION.allumage);
    texte = blanc;
  } else if (app?.code === "APP-D") {
    chute = chuteFiche(boite.id, ecoule);
    opacite = chute.opacite;
    transform = `translateY(${chute.y.toFixed(1)}px) rotate(${chute.rotation.toFixed(2)}deg)`;
  }
  const main = mat === "MAT-C";
  const fondCarte = mat === "MAT-B" ? COULEURS_DUO.ivoireHaut : COULEURS_DUO.blanc;
  const ombreRepos =
    mat === "MAT-B"
      ? `0 34px 90px ${teinte(COULEURS_DUO.encre, 0.12)}, 0 6px 14px ${teinte(COULEURS_DUO.encre, 0.06)}`
      : mat === "MAT-D"
        ? `0 60px 80px ${teinte(COULEURS_DUO.encre, 0.1)}`
        : chute
          ? `0 6px 10px ${teinte(COULEURS_DUO.encre, 0.08)}, 0 22px 40px ${teinte(COULEURS_DUO.encre, 0.1)}`
          : `0 18px 44px ${teinte(COULEURS_DUO.encre, 0.08)}`;
  const ombre = main ? "none" : actif ? `0 26px 60px ${teinte(COULEURS_DUO.encre, 0.16)}, 0 0 70px ${halo}` : ombreRepos;
  const graine = graineDe(boite.id);
  const pastilleOmbre = mat === "MAT-D" ? `0 12px 0 ${COULEURS_DUO.nuitHaut}` : `0 10px 24px ${teinte(COULEURS_DUO.encre, 0.18)}`;
  return (
    <>
      {chute ? (
        // APP-D : l'ombre de la fiche est déjà sur la table, là où elle va se poser.
        <div
          style={{
            position: "absolute",
            left: boite.x + boite.largeur * 0.08,
            top: boite.y + boite.hauteur * 0.62,
            width: boite.largeur * 0.84,
            height: boite.hauteur * 0.5,
            borderRadius: 40,
            background: teinte(COULEURS_DUO.encre, chute.ombre.opacite),
            filter: `blur(${chute.ombre.flou.toFixed(1)}px)`,
            transform: `scale(${chute.ombre.echelle.toFixed(3)})`,
          }}
        />
      ) : null}
      <div
        data-noeud={app || mat ? boite.id : undefined}
        data-eteinte={eteinte ? "" : undefined}
        style={{
          position: "absolute",
          left: boite.x,
          top: boite.y,
          width: boite.largeur,
          height: boite.hauteur,
          opacity: opacite,
          transform,
          transformOrigin: "50% 50%",
        }}
      >
        {mat === "MAT-D" ? (
          // Tranche de la carte : l'épaisseur, de la couleur de son trait (assombrie).
          <div style={{ position: "absolute", left: 0, top: 22, width: boite.largeur, height: boite.hauteur, borderRadius: 34, background: boite.couleur === "orange" ? COULEURS_DUO.orange : COULEURS_DUO.nuitHaut, opacity: blanc }} />
        ) : null}
        {main && blanc > 0 ? <Hachures l={boite.largeur} h={boite.hauteur} id={boite.id} opacite={blanc} /> : null}
        {app?.code === "APP-C" ? <div style={{ position: "absolute", inset: 0, borderRadius: main ? 10 : 34, background: BEIGE_ETEINT }} /> : null}
        {/* La carte reste opaque une fois vue : un fil ne la traverse jamais ; seul son contenu se grise. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxSizing: "border-box",
            borderRadius: main ? 10 : 34,
            background: fondCarte,
            border: main ? undefined : `${contour}px solid ${accent}`,
            boxShadow: ombre,
            opacity: !feutre && blanc < 1 ? blanc : undefined,
            clipPath: feutre && blanc < 1 ? `inset(0 ${((1 - blanc) * 100).toFixed(1)}% 0 0)` : undefined,
          }}
        />
        {main && blanc > 0 ? (
          <svg width={boite.largeur} height={boite.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: blanc }} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={rectMain(0, 0, boite.largeur, boite.hauteur, graine, 3, 16)} stroke={actif ? accent : COULEURS_DUO.encre} strokeWidth={actif ? 7 : 5} />
            <path d={rectMain(5, 4, boite.largeur - 8, boite.hauteur - 6, graine + 12, 2.5, 10)} stroke={COULEURS_DUO.encre} strokeWidth={3} opacity={0.8} />
          </svg>
        ) : null}
        {feutre && feutre.contour < 1 ? <TraitFeutre l={boite.largeur} h={boite.hauteur} trace={feutre.contour} /> : null}
        {feutre && feutre.contour >= 1 && blanc < 1 ? <TraitFeutre l={boite.largeur} h={boite.hauteur} trace={1} opacite={1 - blanc} /> : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${M.marge}px ${M.marge}px`,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            gap: M.ecartTextes,
            opacity: (actif ? 1 : OPACITE_VU) * texte,
            filter: actif ? undefined : "grayscale(1)",
          }}
        >
          {boite.textes.map((tx) => (
            <div
              key={tx.role}
              style={{
                fontFamily: famille(tx.role === "libelle" ? "anton" : "inter-gras"),
                fontWeight: graisse(tx.role === "libelle" ? "anton" : "inter-gras"),
                fontSize: tx.taille * ECRAN_IV.hauteur,
                lineHeight: M.interligne,
                color: COULEURS_DUO.encre,
                overflowWrap: "break-word",
                maxWidth: "100%",
              }}
            >
              {tx.texte}
            </div>
          ))}
        </div>
        {icone ? (
          <div
            style={{
              position: "absolute",
              left: -2 * RAYON_PASTILLE + 30,
              top: boite.hauteur / 2 - RAYON_PASTILLE,
              width: 2 * RAYON_PASTILLE,
              height: 2 * RAYON_PASTILLE,
              borderRadius: "50%",
              background: eteinte ? COULEURS_DUO.grisClair : actif ? (boite.couleur === "vert" ? COULEURS_DUO.vert : COULEURS_DUO.encre) : COULEURS_DUO.grisClair,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: eteinte ? undefined : pastilleOmbre,
              opacity: feutre ? Math.max(feutre.blanc, 0) : undefined,
            }}
          >
            <Icone nom={icone} taille={RAYON_PASTILLE * 1.15} couleur={eteinte ? COULEURS_DUO.ivoire : actif && boite.couleur === "orange" ? COULEURS_DUO.orangeVif : COULEURS_DUO.blanc} epaisseur={2.6} />
          </div>
        ) : null}
        {etat.coche > 0 ? <Coche x={etat.coche} /> : null}
        {feutre && feutre.feutre > 0 ? <FeutreSurCarte l={boite.largeur} h={boite.hauteur} trace={feutre.contour} opacite={feutre.feutre} /> : null}
      </div>
    </>
  );
}

/** APP-B · le trait du feutre, en deux passes un peu décalées (bords vivants), du milieu du bas, sens horaire. */
function TraitFeutre({ l, h, trace, opacite = 1 }: { l: number; h: number; trace: number; opacite?: number }) {
  const d = contourBas(l, h);
  return (
    <svg width={l} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: opacite }}>
      <path d={d} pathLength={1} fill="none" stroke={COULEURS_DUO.encre} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - trace} />
      <path d={d} pathLength={1} fill="none" stroke={COULEURS_DUO.encre} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - trace} opacity={0.35} transform="translate(1.5 -1.5)" />
    </svg>
  );
}

/** APP-B · le feutre posé sur le bout du trait ; une fois le contour fermé, il reste au milieu du bas puis s'efface. */
function FeutreSurCarte({ l, h, trace, opacite }: { l: number; h: number; trace: number; opacite: number }) {
  const [x, y] = pointContourBas(l, h, trace);
  return <Feutre x={x} y={y} angle={32} opacite={opacite} />;
}

/** MAT-C · ombre « au feutre » : hachures obliques en bas et à droite de la carte. */
function Hachures({ l, h, id, opacite }: { l: number; h: number; id: string; opacite: number }) {
  const clip = `hach-${id}`;
  const e = 26;
  return (
    <svg width={l} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: opacite }}>
      <defs>
        <clipPath id={clip}>
          <path d={`M${30} ${h} L${l} ${h} L${l} ${34} L${l + e} ${34} L${l + e} ${h + e} L${30} ${h + e} Z`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} stroke={COULEURS_DUO.encre} strokeWidth={4} opacity={0.5} strokeLinecap="round">
        {hachures(0, 0, l + e, h + e).map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}

/** Coche verte qui surgit à cheval sur le coin haut droit de la carte (hors du texte). */
function Coche({ x }: { x: number }) {
  const echelle = 0.4 + 0.6 * rebond(x);
  return (
    <div
      style={{
        position: "absolute",
        right: -RAYON_PASTILLE + 14,
        top: -RAYON_PASTILLE + 14,
        width: 2 * RAYON_PASTILLE,
        height: 2 * RAYON_PASTILLE,
        borderRadius: "50%",
        background: COULEURS_DUO.vert,
        transform: `scale(${echelle})`,
        opacity: Math.min(1, x * 3),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 10px 24px ${teinte(COULEURS_DUO.vert, 0.4)}`,
      }}
    >
      <svg width={RAYON_PASTILLE * 1.1} height={RAYON_PASTILLE * 1.1} viewBox="0 0 24 24" fill="none" stroke={COULEURS_DUO.blanc} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} strokeDashoffset={24 * (1 - Math.min(1, x * 1.4))} />
      </svg>
    </div>
  );
}
