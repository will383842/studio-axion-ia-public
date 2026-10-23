import React from "react";
/**
 * Les maquettes de variété (lot L1), une fonction par maquette. Contenu : cas `articles-blog` (faits prouvés
 * uniquement) et un écran du cas `recrutement-apporteurs`. Prototypes : aucun n'est branché au moteur.
 */
import { AbsoluteFill } from "remotion";
import type { ReactNode } from "react";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, doux, famille, graisse, planSurgir, progres, rebond, teinte, va } from "../plans/commun";
import { barresProportionnelles, MARGE_PX, planZoomLent } from "./donnees";
import { Affiche, EtiquetteMaquette, FondMaquette, LigneMaquette, MarqueMaquette, ObjetPose, Particules, Pilule, SousTitre, type FondMaquette as NomFond } from "./pieces";

const C = COULEURS_DUO;
const ANTON = { fontFamily: famille("anton"), fontWeight: graisse("anton") } as const;
const INTER = { fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras") } as const;

/** Cadre commun : fond, caméra (échelle et décalage), marque, contenu, sous-titre (d'illustration ou réel). */
export function Cadre({ fond, echelle = 1, origine = "50% 45%", decalageX = 0, sousTitre, calque, children, particules = false }: { fond: NomFond; echelle?: number; origine?: string; decalageX?: number; sousTitre?: string; calque?: ReactNode; children: ReactNode; particules?: boolean }) {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${decalageX}px) scale(${echelle})`, transformOrigin: origine }}>
        <FondMaquette fond={fond} />
        {particules ? <Particules /> : null}
        {children}
      </AbsoluteFill>
      <MarqueMaquette fond={fond} />
      {calque ?? (sousTitre ? <SousTitre texte={sousTitre} fond={fond} /> : null)}
    </AbsoluteFill>
  );
}

/** Texte « fantôme » géant, en contour, au fond de l'image (profondeur). */
function Fantome({ texte, x, y, taille, couleur, opacite = 0.14, rotation = 0 }: { texte: string; x: number; y: number; taille: number; couleur: string; opacite?: number; rotation?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, ...ANTON, fontSize: taille, lineHeight: 0.85, color: "transparent", WebkitTextStroke: `3px ${teinte(couleur, opacite)}`, whiteSpace: "nowrap", transform: `rotate(${rotation}deg)`, textTransform: "uppercase" }}>
      {texte}
    </div>
  );
}

/** Halo de lumière (profondeur) : disque flou d'une couleur de la charte. */
function Halo({ x, y, rayon, couleur, opacite }: { x: number; y: number; rayon: number; couleur: string; opacite: number }) {
  return <div style={{ position: "absolute", left: x - rayon, top: y - rayon, width: rayon * 2, height: rayon * 2, borderRadius: rayon, background: `radial-gradient(circle, ${teinte(couleur, opacite)} 0%, ${teinte(couleur, 0)} 70%)` }} />;
}

/* ------------------------------------------------------------------ */
/* 1. Ouverture chiffre-choc                                            */
/* ------------------------------------------------------------------ */
export function M01OuvertureChiffre({ t, calque }: { t: number; calque?: ReactNode }) {
  const z = progres(t, 0, 0.45);
  const echelle200 = 1.6 - 0.6 * doux(z);
  const flou = (1 - z) * 22;
  return (
    <Cadre fond="sombre" echelle={planZoomLent(t, 4, 1, 1.05)} calque={calque} particules sousTitre="jusqu'à *deux cents* par jour.">
      <Halo x={540} y={830} rayon={620} couleur={C.orangeVif} opacite={0.32} />
      <EtiquetteMaquette texte="Blog · cas réel" fond="sombre" x={0} y={300} largeur={1080} />
      <Affiche lignes={["Jusqu'à"]} fond="sombre" x={0} y={372} largeur={1080} taille={120} ecoule={t - 0.35} />
      <div style={{ position: "absolute", left: 0, top: 470, width: 1080, textAlign: "center", ...ANTON, fontSize: 640, lineHeight: 1, color: C.orangeVif, opacity: c01(z * 2), filter: flou > 0.2 ? `blur(${flou}px)` : "none", transform: `scale(${echelle200})`, textShadow: `0 0 80px ${teinte(C.orangeVif, 0.55)}, 0 0 220px ${teinte(C.orangeVif, 0.35)}` }}>200</div>
      <Affiche lignes={["articles par jour."]} fond="sombre" x={0} y={1160} largeur={1080} taille={128} ecoule={t - 0.6} />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Ouverture : titre géant aligné à gauche, qui déborde               */
/* ------------------------------------------------------------------ */
export function M02TitreGauche({ t }: { t: number }) {
  return (
    <Cadre fond="ivoire" echelle={planZoomLent(t, 4, 1.02, 1)} sousTitre="Nos articles s'écrivent *seuls.*">
      <div style={{ position: "absolute", left: MARGE_PX - 20, top: 300, width: 14, height: 1180, background: C.orange, borderRadius: 7, transform: `scaleY(${doux(progres(t, 0, 0.6))})`, transformOrigin: "top" }} />
      <EtiquetteMaquette texte="Blog · cas réel" fond="ivoire" x={MARGE_PX + 20} y={300} largeur={900} alignement="left" />
      <Affiche lignes={["Nos articles", "s'écrivent"]} fond="ivoire" x={MARGE_PX + 10} y={370} largeur={1300} taille={186} interligne={1.04} alignement="left" ecoule={t - 0.05} pas={0.12} />
      <Affiche lignes={["*seuls.*"]} fond="ivoire" x={MARGE_PX + 4} y={800} largeur={1400} taille={445} interligne={0.94} alignement="left" ecoule={t - 0.4} />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Étape : objet plein cadre, titre en bas                           */
/* ------------------------------------------------------------------ */
export function M03EtapePleinCadre({ t, calque }: { t: number; calque?: ReactNode }) {
  return (
    <Cadre fond="sombre" echelle={planZoomLent(t, 4, 1, 1.04)} calque={calque} sousTitre="L'IA écrit *l'article*.">
      <Halo x={540} y={720} rayon={560} couleur={C.orangeVif} opacite={0.22} />
      <Fantome texte="02" x={560} y={160} taille={760} couleur={C.orangeVif} opacite={0.12} />
      <ObjetPose objet="rapport" fond="sombre" textes={["Article · 1 200 mots", "Rédaction"]} x={120} y={250} largeur={840} hauteur={900} t={t} rotY={-14} rotX={8} />
      <EtiquetteMaquette texte="Étape 02" fond="sombre" x={0} y={1210} largeur={1080} />
      <Affiche lignes={["L'*écriture*"]} fond="sombre" x={0} y={1262} largeur={1080} taille={190} ecoule={t - 0.3} lueur />
      <Pilule x={318} y={1478} fond={C.blanc} couleur={C.encre} taille={36} style={{ opacity: c01((t - 0.9) * 3) }}>
        900 à 1 300 mots
      </Pilule>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Étape : objet à gauche, texte à droite                            */
/* ------------------------------------------------------------------ */
export function M04EtapeObjetGauche({ t }: { t: number }) {
  return (
    <Cadre fond="ivoire" echelle={planZoomLent(t, 4, 1, 1.04)} origine="20% 50%" sousTitre="Chaque article reçoit *une note*.">
      <div style={{ position: "absolute", left: -140, top: 520, width: 760, height: 760, borderRadius: 380, background: teinte(C.orange, 0.1) }} />
      <ObjetPose objet="bouclier-coche" fond="ivoire" x={30} y={640} largeur={520} hauteur={520} t={t} rotY={14} rotX={4} />
      <EtiquetteMaquette texte="Étape 03" fond="ivoire" x={600} y={560} largeur={440} alignement="left" />
      <Affiche lignes={["Noté", "*sur 100.*"]} fond="ivoire" x={598} y={612} largeur={460} taille={138} interligne={0.98} alignement="left" ecoule={t - 0.2} />
      <div style={{ position: "absolute", left: 604, top: 912, width: 96, height: 10, borderRadius: 5, background: C.orange, transform: `scaleX(${doux(progres(t, 0.8, 0.4))})`, transformOrigin: "left" }} />
      <LigneMaquette texte={"13 critères.\nSous 75 : réécrit."} fond="ivoire" x={604} y={950} largeur={440} t={t} debut={0.9} taille={46} alignement="left" couleur={C.encre} />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Liste « avant » en pile de cartes                                 */
/* ------------------------------------------------------------------ */
const TACHES_AVANT = ["Trouver un sujet", "Écrire un long article", "Vérifier qu'on ne se répète pas", "Soigner le référencement", "Chercher une photo libre de droits", "Mettre en ligne"];

export function M05ListePile({ t }: { t: number }) {
  return (
    <Cadre fond="sombre" sousTitre="trouver un sujet, *écrire*, vérifier…">
      <Halo x={540} y={1100} rayon={600} couleur={C.orangeVif} opacite={0.2} />
      <EtiquetteMaquette texte="Avant" fond="sombre" x={0} y={290} largeur={1080} />
      <Affiche lignes={["C'était *ça.*"]} fond="sombre" x={0} y={340} largeur={1080} taille={170} ecoule={t} />
      {TACHES_AVANT.map((tache, i) => {
        const x = progres(t, 0.35 + i * 0.22, 0.4);
        const s = planSurgir(x, 0);
        const rot = (i % 2 ? 1.6 : -1.8) * (1 + i * 0.12);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 120 + (i % 2 ? 26 : -8),
              top: 600 + i * 132,
              width: 840,
              height: 170,
              borderRadius: 34,
              background: C.blanc,
              boxShadow: `0 26px 50px ${teinte(C.nuit, 0.6)}, 0 4px 0 ${teinte(C.grisClair, 0.7)}`,
              opacity: s.opacite,
              transform: `translateY(${(1 - doux(x)) * -80}px) rotate(${rot}deg) scale(${0.9 + 0.1 * rebond(x)})`,
              display: "flex",
              alignItems: "flex-start",
              paddingTop: 30,
              paddingLeft: 40,
              gap: 28,
              ...INTER,
              fontSize: 44,
              color: C.encre,
            }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 12, border: `5px solid ${C.grisClair}`, flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap" }}>{tache}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 640, top: 1360, transform: `rotate(-5deg) scale(${planSurgir(progres(t, 1.9, 0.35)).echelle})`, opacity: planSurgir(progres(t, 1.9, 0.35)).opacite }}>
        <div style={{ padding: "18px 34px", borderRadius: 26, background: C.orangeVif, color: C.blanc, ...ANTON, fontSize: 70, lineHeight: 1, boxShadow: `0 20px 50px ${teinte(C.nuit, 0.6)}` }}>½ JOURNÉE</div>
      </div>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 6. 3ᵉ fond : terracotta plein (moment fort)                           */
/* ------------------------------------------------------------------ */
export function M06Terracotta({ t }: { t: number }) {
  return (
    <Cadre fond="terracotta" echelle={planZoomLent(t, 4, 1.05, 1)} sousTitre="Il reste *une seule* chose à faire.">
      <Fantome texte="RELIRE" x={-60} y={1180} taille={520} couleur={C.nuit} opacite={0.16} rotation={-6} />
      <EtiquetteMaquette texte="Notre seule part" fond="terracotta" x={0} y={430} largeur={1080} couleur={C.ivoireHaut} />
      <Affiche lignes={["Notre seul", "travail :"]} fond="terracotta" x={0} y={500} largeur={1080} taille={150} ecoule={t} />
      <Affiche lignes={["*Relire.*"]} fond="terracotta" x={0} y={790} largeur={1080} taille={300} ecoule={t - 0.4} />
      <LigneMaquette texte="les articles mis de côté par les contrôles" fond="terracotta" x={140} y={1130} largeur={800} t={t} debut={1} taille={46} couleur={C.ivoireHaut} />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Résultat : barres PROPORTIONNELLES 1 → 200                         */
/* ------------------------------------------------------------------ */
export function M07Barres({ t }: { t: number }) {
  const [avant, maintenant] = barresProportionnelles([1, 200]);
  const piste = 940;
  const xA = doux(progres(t, 0.5, 0.5));
  const xM = doux(progres(t, 1, 0.9));
  return (
    <Cadre fond="ivoire" sousTitre="Le blog *grandit* chaque jour.">
      <EtiquetteMaquette texte="Résultat" fond="ivoire" x={MARGE_PX} y={300} largeur={900} alignement="left" />
      <Affiche lignes={["Le blog", "*grandit.*"]} fond="ivoire" x={MARGE_PX - 4} y={350} largeur={960} taille={190} alignement="left" ecoule={t} />
      {/* Avant */}
      <div style={{ position: "absolute", left: MARGE_PX, top: 820, ...INTER, fontSize: 40, color: C.gris, letterSpacing: "0.04em" }}>AVANT · À LA MAIN</div>
      <div style={{ position: "absolute", left: MARGE_PX, top: 880, width: piste, height: 120, borderRadius: 26, background: teinte(C.encre, 0.06) }} />
      <div style={{ position: "absolute", left: MARGE_PX, top: 880, width: Math.max(28, piste * avant * xA), height: 120, borderRadius: 14, background: C.encre }} />
      <div style={{ position: "absolute", left: MARGE_PX + 60, top: 868, ...ANTON, fontSize: 120, lineHeight: 1.1, color: C.encre }}>
        1 <span style={{ ...INTER, fontSize: 44 }}>article</span>
      </div>
      {/* Maintenant */}
      <div style={{ position: "absolute", left: MARGE_PX, top: 1080, ...INTER, fontSize: 40, color: C.orange, letterSpacing: "0.04em" }}>{"MAINTENANT · JUSQU'À"}</div>
      <div style={{ position: "absolute", left: MARGE_PX, top: 1140, width: piste, height: 220, borderRadius: 30, background: teinte(C.encre, 0.06) }} />
      <div style={{ position: "absolute", left: MARGE_PX, top: 1140, width: piste * maintenant * xM, height: 220, borderRadius: 30, background: `linear-gradient(90deg, ${C.orange}, ${C.orangeVif})`, boxShadow: `0 24px 60px ${teinte(C.orange, 0.4)}` }} />
      <div style={{ position: "absolute", left: MARGE_PX + 44, top: 1142, ...ANTON, fontSize: 196, lineHeight: 1.1, color: C.blanc, opacity: c01((xM - 0.3) * 3) }}>
        200 <span style={{ ...INTER, fontSize: 56 }}>par jour</span>
      </div>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Objet composé : cadre téléphone + 3 rangées                       */
/* ------------------------------------------------------------------ */
function Rangee({ t, debut, children }: { t: number; debut: number; children: ReactNode }) {
  const x = progres(t, debut, 0.45);
  return <div style={{ opacity: c01(x * 2.5), transform: `translateY(${(1 - doux(x)) * 60}px) scale(${0.94 + 0.06 * rebond(x)})`, marginBottom: 30 }}>{children}</div>;
}
const CARTE_RANGEE = { background: C.blanc, borderRadius: 34, padding: "30px 32px", display: "flex", alignItems: "center", gap: 26, boxShadow: `0 18px 40px ${teinte(C.nuit, 0.22)}` } as const;

export function M08ObjetCompose({ t }: { t: number }) {
  const remplissage = doux(progres(t, 1.6, 0.8));
  return (
    <Cadre fond="sombre" echelle={planZoomLent(t, 4, 1, 1.05)} sousTitre="Publié, puis *signalé* aux moteurs.">
      <Halo x={540} y={1000} rayon={620} couleur={C.orangeVif} opacite={0.28} />
      <EtiquetteMaquette texte="Étape 05" fond="sombre" x={0} y={270} largeur={1080} />
      <Affiche lignes={["La *publication*"]} fond="sombre" x={0} y={318} largeur={1080} taille={150} ecoule={t} />
      <div style={{ position: "absolute", left: 175, top: 540, width: 730, height: 1000, borderRadius: 96, background: C.nuit, border: `14px solid ${C.nuitHaut}`, boxShadow: `0 60px 120px ${teinte(C.nuit, 0.9)}, 0 0 0 3px ${teinte(C.orangeVif, 0.35)}, inset 0 0 0 2px ${teinte(C.grisClair, 0.25)}`, transform: `perspective(1900px) rotateY(${-8 + 2 * Math.sin(t * 0.9)}deg) rotateX(5deg)`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 260, top: 26, width: 180, height: 40, borderRadius: 20, background: C.nuitHaut }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 110, textAlign: "center", ...INTER, fontSize: 30, color: C.grisClair, letterSpacing: "0.1em" }}>{"AUJOURD'HUI"}</div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 200 }}>
          <Rangee t={t} debut={0.5}>
            <div style={CARTE_RANGEE}>
              <div style={{ width: 84, height: 84, borderRadius: 24, background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", ...ANTON, fontSize: 52, color: C.blanc }}>A</div>
              <div style={{ ...INTER, color: C.encre }}>
                <div style={{ fontSize: 26, color: C.gris }}>Blog · maintenant</div>
                <div style={{ fontSize: 38 }}>Nouvel article en ligne</div>
              </div>
            </div>
          </Rangee>
          <Rangee t={t} debut={0.95}>
            <div style={CARTE_RANGEE}>
              <div style={{ width: 84, height: 84, borderRadius: 42, background: C.vert, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${planSurgir(progres(t, 1.2, 0.35)).echelle})` }}>
                <div style={{ width: 22, height: 40, borderRight: `9px solid ${C.blanc}`, borderBottom: `9px solid ${C.blanc}`, transform: "rotate(45deg) translate(-4px, -4px)" }} />
              </div>
              <div style={{ ...INTER, fontSize: 38, color: C.encre }}>Signalé aux moteurs</div>
            </div>
          </Rangee>
          <Rangee t={t} debut={1.4}>
            <div style={{ ...CARTE_RANGEE, flexDirection: "column", alignItems: "stretch", gap: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...INTER, fontSize: 32, color: C.encre }}>
                <span>8 h</span>
                <span style={{ color: C.gris }}>Publication</span>
                <span>22 h</span>
              </div>
              <div style={{ height: 30, borderRadius: 15, background: C.ivoire }}>
                <div style={{ width: `${100 * remplissage}%`, height: 30, borderRadius: 15, background: `linear-gradient(90deg, ${C.orange}, ${C.orangeVif})` }} />
              </div>
            </div>
          </Rangee>
        </div>
      </div>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Ouverture : question plein cadre                                  */
/* ------------------------------------------------------------------ */
export function M09Question({ t, calque }: { t: number; calque?: ReactNode }) {
  return (
    <Cadre fond="sombre" echelle={planZoomLent(t, 4, 1.06, 1)} calque={calque} sousTitre="Votre blog vous prend *combien* ?">
      <div style={{ position: "absolute", left: 140, top: 340, width: 800, height: 800, borderRadius: 400, border: `3px solid ${teinte(C.orangeVif, 0.3)}`, transform: `scale(${0.9 + 0.1 * doux(progres(t, 0, 1.5))})` }} />
      <div style={{ position: "absolute", left: 40, top: 240, width: 1000, height: 1000, borderRadius: 500, border: `2px solid ${teinte(C.orangeVif, 0.14)}`, transform: `scale(${0.85 + 0.15 * doux(progres(t, 0, 1.8))})` }} />
      <Halo x={540} y={900} rayon={560} couleur={C.orangeVif} opacite={0.18} />
      <Affiche lignes={["Votre blog", "vous prend", "*combien ?*"]} fond="sombre" x={0} y={520} largeur={1080} taille={220} interligne={0.96} ecoule={t} pas={0.13} lueur />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 10. Ouverture : avant / après éclair, écran partagé                  */
/* ------------------------------------------------------------------ */
export function M10AvantApres({ t }: { t: number }) {
  const coupe = doux(progres(t, 0.1, 0.5));
  const eclair = Math.max(0, 1 - Math.abs(t - 0.6) / 0.2);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <FondMaquette fond="sombre" />
      <AbsoluteFill style={{ clipPath: `polygon(0 ${54 * coupe + 46 * (1 - coupe)}%, 100% ${44}%, 100% 100%, 0 100%)` }}>
        <FondMaquette fond="ivoire" />
      </AbsoluteFill>
      {/* Avant (haut, sombre) */}
      <EtiquetteMaquette texte="Avant" fond="sombre" x={MARGE_PX} y={300} largeur={900} alignement="left" couleur={C.grisClair} />
      <div style={{ position: "absolute", left: MARGE_PX - 6, top: 340, ...ANTON, fontSize: 420, lineHeight: 1, color: C.ivoire }}>1</div>
      <div style={{ position: "absolute", left: MARGE_PX + 250, top: 440, ...ANTON, fontSize: 124, lineHeight: 1.02, color: C.ivoire, textTransform: "uppercase" }}>
        article,
        <br />
        <span style={{ color: C.grisClair }}>à la main</span>
      </div>
      {/* Maintenant (bas, ivoire) */}
      <EtiquetteMaquette texte="Maintenant · jusqu'à" fond="ivoire" x={0} y={1000} largeur={1080 - MARGE_PX} alignement="center" />
      <div style={{ position: "absolute", left: 0, width: 1080, top: 1040, textAlign: "center", ...ANTON, fontSize: 330, lineHeight: 1, color: C.orange }}>200</div>
      <div style={{ position: "absolute", left: 0, width: 1080, top: 1380, textAlign: "center", ...ANTON, fontSize: 92, lineHeight: 1, color: C.encre, textTransform: "uppercase" }}>par jour</div>
      {/* Ligne d'éclair sur la coupe */}
      <div style={{ position: "absolute", left: -40, top: 1920 * 0.5 - 6, width: 1160, height: 12, background: C.orangeVif, transform: "rotate(-5.3deg)", boxShadow: `0 0 40px ${teinte(C.orangeVif, 0.9)}, 0 0 120px ${teinte(C.orangeVif, 0.6)}` }} />
      <AbsoluteFill style={{ background: C.orangeVif, opacity: 0.45 * eclair }} />
      <MarqueMaquette fond="sombre" />
      <SousTitre texte="Avant : un. Maintenant : *deux cents*." fond="ivoire" />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* 11. Ouverture : objet révélé en zoom arrière                         */
/* ------------------------------------------------------------------ */
export function M11ZoomArriere({ t, calque }: { t: number; calque?: ReactNode }) {
  const z = va(progres(t, 0, 1.4));
  const echelle = 2.3 - 1.3 * z;
  return (
    <Cadre fond="sombre" calque={calque} sousTitre="Un nouvel article, *tout seul*.">
      <Halo x={540} y={780} rayon={600} couleur={C.orangeVif} opacite={0.3} />
      <AbsoluteFill style={{ transform: `scale(${echelle})`, transformOrigin: "50% 38%", filter: z < 0.9 ? `blur(${(0.9 - z) * 8}px)` : "none" }}>
        <ObjetPose objet="telephone-notification" fond="sombre" textes={["Nouvel article en ligne", "Blog"]} x={220} y={270} largeur={640} hauteur={940} t={t} rotY={-6} rotX={3} />
      </AbsoluteFill>
      <Affiche lignes={["Il s'écrit", "*tout seul.*"]} fond="sombre" x={0} y={1236} largeur={1080} taille={160} ecoule={t - 1.1} lueur />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 12. Citation géante plein cadre                                      */
/* ------------------------------------------------------------------ */
export function M12Citation({ t }: { t: number }) {
  return (
    <Cadre fond="ivoire" echelle={planZoomLent(t, 4, 1, 1.04)} sousTitre="sans qu'on écrive *une ligne*.">
      <div style={{ position: "absolute", left: MARGE_PX - 20, top: 150, ...ANTON, fontSize: 620, lineHeight: 1, color: C.orange, opacity: c01(t * 4), transform: `translateY(${(1 - doux(progres(t, 0, 0.5))) * 60}px)` }}>“</div>
      <Affiche lignes={["Le blog", "grandit", "sans qu'on", "écrive", "*une ligne.*"]} fond="ivoire" x={MARGE_PX} y={560} largeur={960} taille={168} interligne={0.98} alignement="left" ecoule={t - 0.25} pas={0.11} />
      <div style={{ position: "absolute", left: MARGE_PX, top: 1450, width: 120, height: 10, borderRadius: 5, background: C.orange }} />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 13. Comparatif deux colonnes                                         */
/* ------------------------------------------------------------------ */
const COMPARATIF = [
  { avant: "Trouver un sujet", apres: "Toutes les 15 min" },
  { avant: "Écrire un long article", apres: "900 à 1 300 mots" },
  { avant: "Vérifier, relire", apres: "Note sur 100" },
  { avant: "Chercher une photo", apres: "Libre de droits" },
];
export function M13Comparatif({ t }: { t: number }) {
  return (
    <Cadre fond="sombre" sousTitre="À la main, ou *tout seul*.">
      <Halo x={800} y={1000} rayon={520} couleur={C.orangeVif} opacite={0.22} />
      <Affiche lignes={["À la main", "ou *tout seul ?*"]} fond="sombre" x={0} y={280} largeur={1080} taille={140} ecoule={t} />
      <div style={{ position: "absolute", left: MARGE_PX, top: 640, width: 450, ...INTER, fontSize: 30, letterSpacing: "0.18em", color: C.grisClair }}>AVANT</div>
      <div style={{ position: "absolute", left: 556, top: 640, width: 460, ...INTER, fontSize: 30, letterSpacing: "0.18em", color: C.orangeVif }}>{"AVEC L'OUTIL"}</div>
      {COMPARATIF.map((r, i) => {
        const x = progres(t, 0.5 + i * 0.25, 0.4);
        return (
          <div key={i} style={{ position: "absolute", left: MARGE_PX, top: 700 + i * 180, width: 952, height: 150, opacity: c01(x * 2.5), transform: `translateY(${(1 - doux(x)) * 40}px)` }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 440, height: 150, borderRadius: 28, background: teinte(C.ivoire, 0.06), border: `2px solid ${teinte(C.grisClair, 0.25)}`, display: "flex", alignItems: "center", padding: "0 28px", ...INTER, fontSize: 36, color: C.grisClair, textDecoration: "line-through", textDecorationColor: teinte(C.grisClair, 0.6) }}>{r.avant}</div>
            <div style={{ position: "absolute", left: 492, top: 0, width: 460, height: 150, borderRadius: 28, background: C.blanc, display: "flex", alignItems: "center", gap: 20, padding: "0 26px", ...INTER, fontSize: 38, color: C.encre, boxShadow: `0 20px 50px ${teinte(C.nuit, 0.6)}` }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: C.vert, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 12, height: 22, borderRight: `6px solid ${C.blanc}`, borderBottom: `6px solid ${C.blanc}`, transform: "rotate(45deg) translate(-2px, -2px)" }} />
              </div>
              {r.apres}
            </div>
          </div>
        );
      })}
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 14. Chronologie : la journée de 8 h à 22 h                            */
/* ------------------------------------------------------------------ */
export function M14Journee({ t }: { t: number }) {
  const heures = [8, 10, 12, 14, 16, 18, 20, 22];
  const y0 = 770;
  const pasY = 104;
  const avance = doux(progres(t, 0.4, 1.6));
  return (
    <Cadre fond="ivoire" sousTitre="Publié *entre 8 h et 22 h*.">
      <EtiquetteMaquette texte="Une journée" fond="ivoire" x={MARGE_PX} y={300} largeur={900} alignement="left" />
      <Affiche lignes={["De 8 h", "à *22 h.*"]} fond="ivoire" x={MARGE_PX - 4} y={346} largeur={960} taille={150} alignement="left" ecoule={t} />
      <div style={{ position: "absolute", left: 250, top: y0, width: 8, height: pasY * 7, borderRadius: 4, background: teinte(C.encre, 0.1) }} />
      <div style={{ position: "absolute", left: 250, top: y0, width: 8, height: pasY * 7 * avance, borderRadius: 4, background: C.orange }} />
      {heures.map((h, i) => {
        const allume = avance * 7 >= i - 0.01;
        const s = planSurgir(progres(t, 0.4 + (i / 7) * 1.6, 0.3));
        const article = i % 2 === 1;
        return (
          <div key={h}>
            <div style={{ position: "absolute", left: MARGE_PX, top: y0 + i * pasY - 30, width: 150, textAlign: "right", ...ANTON, fontSize: 60, lineHeight: 1, color: allume ? C.encre : C.grisClair }}>{h} h</div>
            <div style={{ position: "absolute", left: 238, top: y0 + i * pasY - 10, width: 32, height: 32, borderRadius: 16, background: allume ? C.orange : C.ivoire, border: `5px solid ${allume ? C.orange : C.grisClair}`, transform: `scale(${allume ? s.echelle : 1})` }} />
            {article ? (
              <div style={{ position: "absolute", left: 310, top: y0 + i * pasY - 46, width: 640, height: 92, borderRadius: 24, background: C.blanc, boxShadow: `0 14px 34px ${teinte(C.encre, 0.12)}`, display: "flex", alignItems: "center", gap: 20, padding: "0 26px", ...INTER, fontSize: 34, color: C.encre, opacity: s.opacite, transform: `translateX(${(1 - s.echelle) * 80}px)` }}>
                <div style={{ width: 16, height: 52, borderRadius: 8, background: C.orange }} />
                Article publié
              </div>
            ) : null}
          </div>
        );
      })}
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 15. Pastilles comptées : jauge de 13 critères                         */
/* ------------------------------------------------------------------ */
export function M15Jauge({ t, calque }: { t: number; calque?: ReactNode }) {
  const n = 13;
  const cx = 540;
  const cy = 1000;
  const r = 380;
  const allumes = Math.floor(c01((t - 0.4) / 1.6) * n + 0.001);
  return (
    <Cadre fond="sombre" echelle={planZoomLent(t, 4, 1, 1.04)} calque={calque} sousTitre="Une note sur 100, sur *13 critères*.">
      <Halo x={cx} y={cy} rayon={520} couleur={C.orangeVif} opacite={0.3} />
      <EtiquetteMaquette texte="Les contrôles" fond="sombre" x={0} y={290} largeur={1080} />
      <Affiche lignes={["13 *critères*"]} fond="sombre" x={0} y={356} largeur={1080} taille={160} ecoule={t} />
      {Array.from({ length: n }, (_, i) => {
        const a = Math.PI * (0.85 + (1.3 * i) / (n - 1));
        const on = i < allumes;
        const s = planSurgir(progres(t, 0.4 + (i / n) * 1.6, 0.3));
        return (
          <div key={i} style={{ position: "absolute", left: cx + Math.cos(a) * r - 42, top: cy + Math.sin(a) * r - 42, width: 84, height: 84, borderRadius: 42, background: on ? C.orangeVif : teinte(C.ivoire, 0.08), border: on ? "none" : `3px solid ${teinte(C.grisClair, 0.35)}`, boxShadow: on ? `0 0 30px ${teinte(C.orangeVif, 0.7)}` : "none", transform: `scale(${on ? s.echelle : 0.9})`, display: "flex", alignItems: "center", justifyContent: "center", ...INTER, fontSize: 30, color: on ? C.blanc : C.grisClair }}>
            {i + 1}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, width: 1080, top: cy - 200, textAlign: "center", ...ANTON, fontSize: 300, lineHeight: 1, color: C.ivoire }}>100</div>
      <div style={{ position: "absolute", left: 0, width: 1080, top: cy + 110, textAlign: "center", ...INTER, fontSize: 40, color: C.grisClair }}>note maximale</div>
      <Pilule x={300} y={cy + 230} fond={C.blanc} couleur={C.encre} taille={36}>
        Sous 75 : <span style={{ color: C.orange }}>réécrit</span>
      </Pilule>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* 16. Fin variante : même logo, même bouton, autre composition          */
/* ------------------------------------------------------------------ */
export function M16FinVariante({ t }: { t: number }) {
  const fleche = Math.sin(t * 4) * 12;
  const sig = planSurgir(progres(t, 1.3, 0.4));
  return (
    <Cadre fond="terracotta" echelle={planZoomLent(t, 4, 1, 1.04)}>
      <Affiche lignes={["Le lien", "est en", "*commentaire*"]} fond="terracotta" x={MARGE_PX} y={330} largeur={960} taille={168} interligne={0.96} alignement="left" ecoule={t} />
      <div style={{ position: "absolute", left: MARGE_PX + 6, top: 900 + fleche, width: 14, height: 150, borderRadius: 7, background: C.nuit }} />
      <div style={{ position: "absolute", left: MARGE_PX - 18, top: 1010 + fleche, width: 62, height: 62, borderRight: `14px solid ${C.nuit}`, borderBottom: `14px solid ${C.nuit}`, transform: "rotate(45deg)" }} />
      <ObjetPose objet="bulle-lien" fond="ivoire" textes={["Diagnostic gratuit · lien en commentaire"]} x={110} y={1130} largeur={860} hauteur={210} t={t} debut={0.6} rotY={-6} rotX={4} />
      <div style={{ position: "absolute", left: 0, width: 1080, top: 1400, textAlign: "center", ...ANTON, fontSize: 140, lineHeight: 1, color: C.ivoireHaut, opacity: sig.opacite, transform: `scale(${sig.echelle})` }}>
        Axion-<span style={{ color: C.nuit }}>IA</span>
      </div>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Autre vidéo (recrutement) : autre tirage                              */
/* ------------------------------------------------------------------ */
export function M17Recrutement({ t }: { t: number }) {
  return (
    <Cadre fond="ivoire" echelle={planZoomLent(t, 4, 1.05, 1)} origine="50% 40%" sousTitre="Oui, *quinze minutes*.">
      <div style={{ position: "absolute", left: 140, top: 250, width: 800, height: 800, borderRadius: 400, background: teinte(C.orange, 0.08) }} />
      <ObjetPose objet="chrono" fond="ivoire" textes={["15", "minutes"]} x={190} y={300} largeur={700} hauteur={700} t={t} rotY={0} rotX={0} />
      <EtiquetteMaquette texte="Recrutement · cas réel" fond="ivoire" x={MARGE_PX} y={1090} largeur={900} alignement="left" />
      <Affiche lignes={["On recrute", "en *15 min.*"]} fond="ivoire" x={MARGE_PX - 4} y={1140} largeur={960} taille={176} alignement="left" ecoule={t - 0.4} />
    </Cadre>
  );
}
