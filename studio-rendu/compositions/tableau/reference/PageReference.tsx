/**
 * RENDU DU STYLE « reference/1 » (maquette validée le 14/10/2026, `maquettes/tableau-style-reference/`) : une page
 * blanche cassée que le crayon ÉCRIT, bloc après bloc. Le texte se dévoile de gauche à droite (bord légèrement fondu),
 * la pointe suit le bord ; les dessins se tracent (contour, puis couleur) ; les marques et les gestes sont un trait
 * simple, du même crayon. Signature discrète en bas à gauche. À la fin de la vidéo, le crayon se pose et l'image
 * s'efface.
 *
 * Positions : la mise en page (`src/moteurs/montage-tableau/mise-en-page-reference.ts`) ; instants : le plan de la
 * page (`src/briques/tableau-scene/reference/animation.ts`). Ce composant ne décide de rien, il dessine. Tout se
 * calcule depuis le numéro d'image (aucun hasard, aucune horloge).
 */
import { useMemo, type ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { STYLE_ECRITURE_EXACTE } from "../../../../src/briques/stylo/mesure-ecriture";
import { apparition, avancementReference, cheminTrace, couleurDessin, finPartie, planPageReference, pointsTrace, poseCrayonReference, type ActionReference, type PlanPageReference } from "../../../../src/briques/tableau-scene/reference/animation";
import { APPROCHE_REFERENCE, COULEURS_REFERENCE, CRAYON_REFERENCE, FIN_REFERENCE, OPACITE_SIGNATURE, SIGNATURE_REFERENCE, TAILLES_GABARIT, TAILLES_REFERENCE, couleurDuTon } from "../../../../src/briques/tableau-scene/reference/charte";
import { clipartRecolorie } from "../../../../src/briques/tableau-scene/reference/cliparts";
import { FAMILLE_MONTSERRAT } from "../../commune/polices";
import type { ElementPlace, ProprietesTableauScene } from "../types";

const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lisse = (x: number) => x * x * (3 - 2 * x);

/** Style « reference/2 » : ce que le gabarit pose sans le crayon (il apparaît en fondu court). */
const apparait = (e: ElementPlace) => e.gabarit?.sorte === "repere" || e.gabarit?.sorte === "bandeau" || e.gabarit?.sorte === "etiquette" || e.gabarit?.sorte === "puce";

export function PageReference({ p }: { p: ProprietesTableauScene }) {
  const image = useCurrentFrame();
  const r = p.styleReference!;
  const plan = useMemo(() => planPageReference(p.page, r), [p.page, r]);
  const t = p.scene.debutMs / 1000 + image / p.fps;
  const k = r.k;
  const fondu = r.derniere ? borne((t * 1000 - (r.finVideoMs - FIN_REFERENCE.fonduImageMs)) / FIN_REFERENCE.fonduImageMs) : 0;
  const pose = poseCrayonReference(plan, t, { largeur: p.largeur, hauteur: p.hauteur });
  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS_REFERENCE.fond, overflow: "hidden" }}>
      {p.page.elements.map((e) => (e.gabarit ? <Decor key={`d-${e.elementId}`} e={e} plan={plan} t={t} /> : null))}
      {p.page.elements.map((e) => (e.type === "dessin" ? <Clipart key={e.elementId} e={e} plan={plan} t={t} /> : apparait(e) ? null : <Bloc key={e.elementId} e={e} plan={plan} t={t} />))}
      <Traits p={p} plan={plan} t={t} k={k} />
      {r.signature ? (
        <div style={{ position: "absolute", left: r.signature.x, top: r.signature.y, height: r.signature.hauteur, lineHeight: `${r.signature.hauteur}px`, fontFamily: `"${FAMILLE_MONTSERRAT}", sans-serif`, fontWeight: 800, fontSize: r.signature.taillePx, letterSpacing: `${APPROCHE_REFERENCE}em`, color: COULEURS_REFERENCE.encre, opacity: OPACITE_SIGNATURE, whiteSpace: "pre", ...STYLE_ECRITURE_EXACTE }}>
          {SIGNATURE_REFERENCE}
        </div>
      ) : null}
      {pose ? <Crayon x={pose.pointe.x} y={pose.pointe.y} angle={pose.angle} k={k} /> : null}
      {fondu > 0 ? <AbsoluteFill style={{ backgroundColor: "#000000", opacity: fondu }} /> : null}
    </AbsoluteFill>
  );
}

/** Un bloc de texte : chaque ligne se dévoile de gauche à droite, au rythme de son action. */
function Bloc({ e, plan, t }: { e: ElementPlace; plan: PlanPageReference; t: number }): ReactNode {
  const taille = e.taillePx ?? 40;
  return (
    <>
      {e.lignes.map((l, i) => {
        const u = avancementReference(plan, e.elementId, `ligne:${i}`, t);
        if (u <= 0) return null;
        const marge = Math.round(taille * 0.4);
        const bord = marge + u * l.px.largeur;
        const fondu = Math.max(1, Math.round(taille * 0.18));
        const masque = u >= 1 ? undefined : `linear-gradient(to right, #000 ${(bord - fondu).toFixed(2)}px, transparent ${bord.toFixed(2)}px)`;
        return (
          <div key={i} style={{ position: "absolute", left: l.px.x - marge, top: l.px.y - marge, width: l.px.largeur + 2 * marge, height: l.px.hauteur + 2 * marge, WebkitMaskImage: masque, maskImage: masque }}>
            <span
              style={{
                position: "absolute",
                left: marge,
                top: marge,
                height: l.px.hauteur,
                lineHeight: `${l.px.hauteur}px`,
                fontFamily: `"${FAMILLE_MONTSERRAT}", sans-serif`,
                fontWeight: 800,
                fontSize: taille,
                letterSpacing: `${APPROCHE_REFERENCE}em`,
                color: l.ton ? couleurDuTon(l.ton) : e.couleurTexte,
                whiteSpace: "pre",
                ...STYLE_ECRITURE_EXACTE,
              }}
            >
              {l.texte}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** Marques des lignes et gestes de la fiche : un trait simple, de la couleur du bloc, qui suit la pointe. */
function Traits({ p, plan, t, k }: { p: ProprietesTableauScene; plan: PlanPageReference; t: number; k: number }) {
  const couleurDe = (id: string) => {
    const el = p.page.elements.find((e) => e.elementId === id);
    const g = p.page.gestes.find((x) => x.elementId === id);
    const cible = g ? p.page.elements.find((e) => e.elementId === g.cibleId) : el;
    // « reference/2 » : la pastille et le cadre de l'appel prennent la couleur de leur fond ; le titre, son trait.
    if (!g && el?.gabarit?.sorte === "pastille") return el.gabarit.couleur;
    if (!g && el?.gabarit?.sorte === "appel") return el.gabarit.couleur;
    return (!g ? el?.couleurMarque : undefined) ?? cible?.couleurTexte ?? COULEURS_REFERENCE.encre;
  };
  const epaisseurDe = (id: string) => p.page.elements.find((e) => e.elementId === id)?.epaisseurMarque ?? Math.max(2, TAILLES_REFERENCE.trait * k);
  const traits = plan.actions.filter((a: ActionReference) => a.trace !== "ecrire" && a.trace !== "contour" && a.trace !== "pointe");
  return (
    <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      {traits.map((a) => {
        const u = avancementReference(plan, a.id, a.partie, t);
        if (u <= 0) return null;
        return <path key={`${a.id}-${a.partie}`} d={cheminTrace(pointsTrace(a, k))} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - u).toFixed(4)} fill="none" stroke={couleurDe(a.id)} strokeWidth={epaisseurDe(a.id)} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

/**
 * Style « reference/2 » : ce que le gabarit pose autour du texte, SOUS le texte — points du repère, bandeau
 * « Exemple », étiquettes « AVANT » / « APRÈS » et leur pointillé, puces de « À retenir » (ils apparaissent) ; tache
 * pâle d'un dessin (avec son contour), filet d'un détail (avec sa première ligne), disque d'une pastille et cadre de
 * l'appel (ils se remplissent une fois leur rond ou leur cadre tracé par le crayon).
 */
function Decor({ e, plan, t }: { e: ElementPlace; plan: PlanPageReference; t: number }): ReactNode {
  const g = e.gabarit!;
  const remplir = (fin: number) => lisse(borne((t - fin) / 0.2));
  const texte = (o: number) =>
    e.lignes.map((l, i) => (
      <span key={i} style={{ position: "absolute", left: l.px.x, top: l.px.y, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, fontFamily: `"${FAMILLE_MONTSERRAT}", sans-serif`, fontWeight: 800, fontSize: e.taillePx ?? 40, letterSpacing: `${APPROCHE_REFERENCE}em`, color: e.couleurTexte, whiteSpace: "pre", opacity: o, ...STYLE_ECRITURE_EXACTE }}>
        {l.texte}
      </span>
    ));
  const boite = (r: { x: number; y: number; largeur: number; hauteur: number }, fond: string, rayon: number, o: number, cle = "b") => <div key={cle} style={{ position: "absolute", left: r.x, top: r.y, width: r.largeur, height: r.hauteur, borderRadius: rayon, backgroundColor: fond, opacity: o }} />;
  switch (g.sorte) {
    case "repere": {
      const o = apparition(plan, e.elementId, t);
      if (o <= 0) return null;
      const halo = Math.max(2, (TAILLES_GABARIT.halo * plan.k));
      return (
        <>
          {g.points.map((q, i) => (
            <div key={i} style={{ position: "absolute", left: q.x, top: q.y, width: q.diametre, height: q.diametre, borderRadius: "50%", boxSizing: "border-box", border: `${Math.max(2, 4 * plan.k)}px solid ${g.couleur}`, backgroundColor: q.plein ? g.couleur : "transparent", boxShadow: q.courant ? `0 0 0 ${halo}px ${g.halo}` : undefined, opacity: o }} />
          ))}
        </>
      );
    }
    case "bandeau":
    case "etiquette": {
      const o = apparition(plan, e.elementId, t);
      if (o <= 0) return null;
      const sep = g.sorte === "etiquette" ? g.separateur : undefined;
      return (
        <>
          {sep ? <div style={{ position: "absolute", left: sep.x, top: sep.y - 2 * plan.k, width: sep.largeur, height: 0, borderTop: `${Math.max(2, 4 * plan.k)}px dashed #D9CFC0`, opacity: o }} /> : null}
          {boite(g.cadre, e.couleurFond ?? COULEURS_REFERENCE.encre, g.rayon, o)}
          {texte(o)}
        </>
      );
    }
    case "puce": {
      const o = apparition(plan, e.elementId, t);
      if (o <= 0) return null;
      return (
        <>
          {boite(g.disque, g.couleur, g.disque.largeur / 2, o)}
          {texte(o)}
        </>
      );
    }
    case "pastille": {
      const o = remplir(finPartie(plan, e.elementId, "rond"));
      return o > 0 ? boite(g.disque, g.couleur, g.disque.largeur / 2, o) : null;
    }
    case "appel": {
      const o = remplir(finPartie(plan, e.elementId, "entoure"));
      return o > 0 ? boite(g.cadre, g.couleur, g.rayon, o) : null;
    }
    case "detail": {
      const o = borne(avancementReference(plan, e.elementId, "ligne:0", t) * 4);
      return o > 0 ? boite(g.filet, g.couleur, g.filet.largeur / 2, o) : null;
    }
    case "dessin": {
      const o = borne(avancementReference(plan, e.elementId, "contour", t) * 2);
      return o > 0 ? boite(g.tache, g.couleur, g.tache.largeur / 2, o) : null;
    }
    default:
      return null;
  }
}

/** Un dessin recolorié : ses traits se tracent l'un après l'autre (contour), puis ses aplats prennent leur couleur. */
function Clipart({ e, plan, t }: { e: ElementPlace; plan: PlanPageReference; t: number }) {
  const c = clipartRecolorie(e.dessinId ?? "");
  const contour = avancementReference(plan, e.elementId, "contour", t);
  if (!c || contour <= 0) return null;
  const couleur = couleurDessin(plan, e.elementId, t);
  const traces = [...c.aplats.filter((a) => a.contour).map((a) => ({ d: a.d, couleur: COULEURS_REFERENCE.encre, epaisseur: 1 })), ...c.traits];
  const n = traces.length;
  return (
    <svg viewBox={`0 0 ${c.grille} ${c.grille}`} style={{ position: "absolute", left: e.px.x, top: e.px.y, width: e.px.largeur, height: e.px.hauteur, overflow: "visible", pointerEvents: "none" }}>
      {c.aplats.map((a, i) => (couleur > 0 ? <path key={`a${i}`} d={a.d} fill={a.couleur} fillOpacity={couleur} stroke="none" /> : null))}
      {traces.map((tr, i) => {
        const u = borne(contour * n - i);
        if (u <= 0) return null;
        return <path key={`t${i}`} d={tr.d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - u).toFixed(4)} fill="none" stroke={tr.couleur} strokeWidth={tr.epaisseur} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

/**
 * Le crayon de la maquette : jaune miel, bois taillé sable, mine encre, bague, gomme terracotta ; dessiné couché, la
 * pointe à l'origine, le corps vers la droite ; posé par sa pointe et incliné autour d'elle. Ombre douce.
 */
export function Crayon({ x, y, angle, k }: { x: number; y: number; angle: number; k: number }) {
  const echelle = (CRAYON_REFERENCE.longueur / 388) * k;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", filter: `drop-shadow(${(9 * k).toFixed(1)}px ${(16 * k).toFixed(1)}px ${(9 * k).toFixed(1)}px rgba(17,10,5,.20))` }}>
      <svg viewBox="0 0 420 420" overflow="visible" style={{ position: "absolute", left: 0, top: 0, width: 420, height: 420, overflow: "visible", transformOrigin: "0 0", transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${angle.toFixed(2)}deg) scale(${echelle.toFixed(4)})` }}>
        <defs>
          <linearGradient id="crayon-bois" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EBD3AC" />
            <stop offset="1" stopColor="#D9B98A" />
          </linearGradient>
          <linearGradient id="crayon-bague" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EEE6D8" />
            <stop offset=".45" stopColor="#C4B8A6" />
            <stop offset="1" stopColor="#9A8E7E" />
          </linearGradient>
        </defs>
        <g strokeLinejoin="round">
          <path d="M0 0 L84 -24 L84 24 Z" fill="url(#crayon-bois)" stroke="#5A4630" strokeWidth="2.2" />
          <path d="M84 -24 Q76 -8 84 0 Q76 8 84 24" fill="none" stroke="#BF9C6C" strokeWidth="2" />
          <path d="M0 0 L26 -7.5 Q22 0 26 7.5 Z" fill="#3A3330" stroke="#110A05" strokeWidth="1.8" />
          <path d="M3 -0.6 L18 -5" stroke="#7A706A" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M84 -24 L300 -24 L300 -8 L84 -8 Z" fill="#F2C861" />
          <path d="M84 -8 L300 -8 L300 8 L84 8 Z" fill="#E8B23A" />
          <path d="M84 8 L300 8 L300 24 L84 24 Z" fill="#C9922A" />
          <path d="M84 -20 L300 -20" stroke="#F8E2A6" strokeWidth="2.5" opacity=".9" />
          <path d="M84 -8 L300 -8 M84 8 L300 8" stroke="#A9781F" strokeWidth="1.4" opacity=".7" />
          <path d="M84 -24 L300 -24 L300 24 L84 24" fill="none" stroke="#5A4630" strokeWidth="2.2" />
          <rect x="300" y="-25" width="44" height="50" rx="3" fill="url(#crayon-bague)" stroke="#5A4E42" strokeWidth="2.2" />
          <path d="M311 -25 V25 M322 -25 V25 M333 -25 V25" stroke="#8A7E70" strokeWidth="2" />
          <path d="M344 -24 L372 -24 Q388 -24 388 -8 L388 8 Q388 24 372 24 L344 24 Z" fill="#B44F29" stroke="#5A4630" strokeWidth="2.2" />
          <path d="M350 -17 L374 -17" stroke="#D27A55" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
