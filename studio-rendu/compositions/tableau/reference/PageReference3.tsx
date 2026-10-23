/**
 * RENDU DU STYLE « reference/3 » (gabarit par parties, 14/10/2026), habillé à la charte Axion le 15/10/2026 (direction A
 * « Page ivoire », maquette `maquettes/tableau-charte-axion/`) : la page ivoire écrite au crayon brun, la barre des
 * chapitres nommés (choix de Will du 15/10), le repère « Exemple illustratif », une icône au trait par page, la pastille d'étape à l'encre, la carte de
 * l'exemple concret, le surlignage orange pâle sous le mot-clé, l'entouré au crayon, avant / maintenant (✕ barré, ✓),
 * la page d'appel au même fond (bouton plein qui bat). Transition de page : « fondu + montée » (850 ms).
 * PEPS (maquette validée par Will le 15/10, PR #260), sur une page qui en a : le VISUEL dessiné de la banque (tracé au
 * crayon trait par trait, grain de mine, hachures, puis sa seule touche orange qui s'anime, puis il respire), la flèche
 * dessinée vers lui, le BLOC ORANGE (rebond, compteur, poussée), le MARQUEUR qui balaie sous le mot-clé (et la poussée
 * de sa ligne), la pastille d'étape qui rebondit.
 *
 * Positions : `mise-en-page-v3.ts` ; instants : `animation-3.ts`. Ce composant ne décide de rien, il dessine. Tout se
 * calcule depuis le numéro d'image (aucun hasard, aucune horloge).
 */
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { GRILLE_DESSIN, TRACES_DESSINS } from "../../../../src/briques/dessins/traces";
import { STYLE_ECRITURE_EXACTE } from "../../../../src/briques/stylo/mesure-ecriture";
import { cheminTrace } from "../../../../src/briques/tableau-scene/reference/animation";
import { apparition3, avancement3, battement3, blocOrange3, etatVisuel3, opaciteLigne3, pastillePeps3, planPage3, poseCrayon3, poussee3, traceIcone3, transitionPage3, type Plan3 } from "../../../../src/briques/tableau-scene/reference/animation-3";
import { APPROCHE_VISUEL_3, GRILLE_VISUEL_3, TRAIT_HACHURE_3, TRAIT_VISUEL_3, boiteTexteVisuel3, cheminPoints3, dessinVisuel3, etapesVisuel3, etatOrange3, estIdVisuel3, portionsChemins3, souffle3, type DessinVisuel3 } from "../../../../src/briques/tableau-scene/reference/visuels-3";
import { APPROCHE_REFERENCE, COULEURS_REFERENCE_3, CRAYON_REFERENCE, CRAYON_REFERENCE_3, FIN_REFERENCE, RYTHME_REFERENCE_3, SIGNES_CODES_3, TAILLES_GABARIT_3, courbeReference3, remplissageChapitre3 } from "../../../../src/briques/tableau-scene/reference/charte";
import { FAMILLE_INTER_MEDIUM, FAMILLE_INTER_SEMIBOLD, FAMILLE_MONTSERRAT, FAMILLE_TITRE, chargerPoliceInterMedium, chargerPoliceInterSemiBold } from "../../commune/polices";
import type { ElementPlace, PagePlacee, ProprietesTableauScene } from "../types";

const C = COULEURS_REFERENCE_3;
const R = RYTHME_REFERENCE_3;
const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
type Famille = "titre" | "detail" | "bouton";
const FAMILLES: Record<Famille, { famille: string; poids: number; approche: number }> = {
  titre: { famille: FAMILLE_MONTSERRAT, poids: 800, approche: APPROCHE_REFERENCE },
  detail: { famille: FAMILLE_INTER_MEDIUM, poids: 500, approche: 0 },
  bouton: { famille: FAMILLE_TITRE, poids: 700, approche: 0 },
};
const police = (taille: number, couleur: string, f: Famille = "titre"): CSSProperties => ({ fontFamily: `"${FAMILLES[f].famille}", sans-serif`, fontWeight: FAMILLES[f].poids, fontSize: taille, letterSpacing: `${FAMILLES[f].approche}em`, color: couleur, whiteSpace: "pre", ...STYLE_ECRITURE_EXACTE });
const familleDe = (e: ElementPlace): Famille => (e.gabarit?.sorte === "bouton" ? "bouton" : e.niveau === "titre" ? "titre" : "detail");

export function PageReference3({ p }: { p: ProprietesTableauScene }) {
  chargerPoliceInterMedium();
  const image = useCurrentFrame();
  const r = p.styleReference!;
  const plan = useMemo(() => planPage3(p.page, r, { largeur: p.largeur, hauteur: p.hauteur }), [p.page, r, p.largeur, p.hauteur]);
  const avant = useMemo(() => (p.pagePrecedente ? planPage3(p.pagePrecedente, r, { largeur: p.largeur, hauteur: p.hauteur }, true) : null), [p.pagePrecedente, r, p.largeur, p.hauteur]);
  const t = p.scene.debutMs / 1000 + image / p.fps;
  const tr = transitionPage3(plan, t);
  const fondu = r.derniere ? borne((t * 1000 - (r.finVideoMs - FIN_REFERENCE.fonduImageMs)) / FIN_REFERENCE.fonduImageMs) : 0;
  const pose = poseCrayon3(plan, t);
  const dy = tr.enCours ? (1 - tr.montee) * R.monteeArriveePx * plan.k : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.fond, overflow: "hidden" }}>
      {avant && p.pagePrecedente && tr.enCours && tr.depart < 1 ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - tr.depart, transform: `translateY(${(-tr.depart * R.monteeDepartPx * plan.k).toFixed(2)}px)` }}>
          <Page page={p.pagePrecedente} plan={avant} t={1e6} />
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, opacity: tr.enCours ? tr.opacite : 1, transform: dy ? `translateY(${dy.toFixed(2)}px)` : undefined }}>
        <Page page={p.page} plan={plan} t={t} />
      </div>
      <Barre p={p} t={t} />
      {pose ? <CrayonAxion x={pose.pointe.x} y={pose.pointe.y + dy} angle={pose.angle} k={plan.k} opacite={tr.enCours ? tr.opacite : 1} /> : null}
      {fondu > 0 ? <AbsoluteFill style={{ backgroundColor: "#000000", opacity: fondu }} /> : null}
    </AbsoluteFill>
  );
}

/** Une page entière : ses surlignages (sous le texte), ses éléments, ses traits. */
function Page({ page, plan, t }: { page: PagePlacee; plan: Plan3; t: number }) {
  return (
    <AbsoluteFill>
      <Surlignages page={page} plan={plan} t={t} />
      {page.elements.map((e) => (
        <Element key={e.elementId} e={e} plan={plan} t={t} />
      ))}
      <Traits plan={plan} t={t} largeur={plan.largeur} hauteur={plan.hauteur} />
    </AbsoluteFill>
  );
}

/**
 * Surlignage orange pâle sous le mot-clé : une bande arrondie qui se trace de gauche à droite. Page avec peps : le
 * MARQUEUR orange franc (bord irrégulier, à peine incliné), qui se pousse avec sa ligne.
 */
function Surlignages({ page, plan, t }: { page: PagePlacee; plan: Plan3; t: number }) {
  return (
    <>
      {page.elements.map((e) => {
        const g = e.gabarit;
        if ((g?.sorte !== "titre" && g?.sorte !== "phrase") || !g.surligne) return null;
        const u = avancement3(plan, e.elementId, "surligne", t);
        if (u <= 0) return null;
        const z = g.surligne;
        if (g.marqueur) {
          const p = poussee3(plan, e.elementId, t);
          const l = e.lignes[e.lignes.length - 1]?.px;
          const origine = l ? `${(l.x - z.x).toFixed(1)}px ${(l.y + l.hauteur * 0.6 - z.y).toFixed(1)}px` : "0 50%";
          return <div key={`s-${e.elementId}`} style={{ position: "absolute", left: z.x, top: z.y, width: z.largeur * u, height: z.hauteur, borderRadius: `${Math.round(6 * plan.k)}px ${Math.round(18 * plan.k)}px ${Math.round(8 * plan.k)}px ${Math.round(16 * plan.k)}px`, rotate: "-0.8deg", transformOrigin: origine, transform: p !== 1 ? `scale(${p.toFixed(4)})` : undefined, backgroundColor: C.marqueur }} />;
        }
        return <div key={`s-${e.elementId}`} style={{ position: "absolute", left: z.x, top: z.y, width: z.largeur * u, height: z.hauteur, borderRadius: Math.round(z.hauteur * 0.28), backgroundColor: C.surlignage }} />;
      })}
    </>
  );
}

/** Une ligne de texte qui se dévoile de gauche à droite (bord légèrement fondu) au rythme de son action. */
function LigneEcrite({ l, u, taille, couleur, famille, opacite = 1 }: { l: ElementPlace["lignes"][number]; u: number; taille: number; couleur: string; famille: Famille; opacite?: number }): ReactNode {
  if (u <= 0) return null;
  const marge = Math.round(taille * 0.4);
  const bord = marge + u * l.px.largeur;
  const fondu = Math.max(1, Math.round(taille * 0.16));
  const masque = u >= 1 ? undefined : `linear-gradient(to right, #000 ${(bord - fondu).toFixed(2)}px, transparent ${bord.toFixed(2)}px)`;
  return (
    <div style={{ position: "absolute", left: l.px.x - marge, top: l.px.y - marge, width: l.px.largeur + 2 * marge, height: l.px.hauteur + 2 * marge, WebkitMaskImage: masque, maskImage: masque, opacity: opacite }}>
      <span style={{ position: "absolute", left: marge, top: marge, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, ...police(taille, couleur, famille) }}>{l.texte}</span>
    </div>
  );
}

/** Les lignes d'un élément ; `accent` : la ligne écrite en orange (une seule par page). */
function Textes({ e, plan, t, couleur, opacite, famille, accent }: { e: ElementPlace; plan: Plan3; t: number; couleur?: string; opacite?: number; famille?: Famille; accent?: number }) {
  return (
    <>
      {e.lignes.map((l, i) => (
        <LigneEcrite key={i} l={l} u={avancement3(plan, e.elementId, `ligne:${i}`, t)} taille={e.taillePx ?? 60} famille={famille ?? familleDe(e)} couleur={i === accent ? C.accentTexte : (couleur ?? e.couleurTexte ?? C.encre)} opacite={(opacite ?? 1) * opaciteLigne3(plan, e.elementId, `ligne:${i}`, t)} />
      ))}
    </>
  );
}

const disque = (r: { x: number; y: number; largeur: number; hauteur: number }, fond: string, echelle = 1, o = 1, bord?: string): ReactNode => (
  <div style={{ position: "absolute", left: r.x, top: r.y, width: r.largeur, height: r.hauteur, borderRadius: "50%", backgroundColor: fond, border: bord, boxSizing: "border-box", transform: `scale(${echelle.toFixed(4)})`, opacity: o }} />
);

/** Signe ✕ (cercle au trait, brun foncé) ou ✓ (disque à l'encre, coche ivoire), comme la maquette. */
function Signe({ r, signe }: { r: { x: number; y: number; largeur: number; hauteur: number }; signe: "croix" | "coche" }) {
  return (
    <svg viewBox="0 0 24 24" style={{ position: "absolute", left: r.x, top: r.y, width: r.largeur, height: r.hauteur, overflow: "visible" }}>
      {signe === "croix" ? (
        <g fill="none" stroke={C.mention} strokeWidth={2.2} strokeLinecap="round">
          <circle cx={12} cy={12} r={10} />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
        </g>
      ) : (
        <>
          <circle cx={12} cy={12} r={11} fill={C.encre} />
          <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke={C.fond} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function Element({ e, plan, t }: { e: ElementPlace; plan: Plan3; t: number }): ReactNode {
  const g = e.gabarit;
  if (e.type === "dessin") return <Icone e={e} plan={plan} t={t} />;
  switch (g?.sorte) {
    case "partie": {
      const a = apparition3(plan, e.elementId, t);
      const l = e.lignes[0];
      return (
        <div style={{ opacity: a.o, transform: `translateY(${a.dy.toFixed(2)}px)` }}>
          {disque(g.point, g.couleurPoint)}
          <span style={{ position: "absolute", left: l.px.x, top: l.px.y, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, ...police(e.taillePx ?? 52, g.couleur, "detail") }}>{l.texte}</span>
        </div>
      );
    }
    case "pastille": {
      const a = g.peps ? { ...pastillePeps3(plan, e.elementId, t), dy: 0 } : apparition3(plan, e.elementId, t, true);
      if (a.o <= 0) return null;
      const l = e.lignes[0];
      const s = g.etape;
      const o = borne((t - (plan.apparitions[e.elementId] ?? 0) - 0.12) / R.apparitionSec);
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", inset: 0, opacity: a.o }}>
            {disque(g.disque, g.couleur, a.echelle)}
            <span style={{ position: "absolute", left: l.px.x, top: l.px.y, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, transform: `scale(${a.echelle.toFixed(4)})`, ...police(e.taillePx ?? 60, C.fond) }}>{l.texte}</span>
          </div>
          {s ? <span style={{ position: "absolute", left: s.x, top: s.y, height: s.hauteur, lineHeight: `${s.hauteur}px`, opacity: plan.fini ? 1 : courbeReference3(o), ...police(s.taille, C.mention, "detail") }}>{s.texte}</span> : null}
        </div>
      );
    }
    case "code": {
      const a = apparition3(plan, e.elementId, t, true);
      const d = g.disque;
      return (
        <>
          {a.o > 0 ? (
            <div style={{ position: "absolute", inset: 0, opacity: a.o }}>
              {disque(d, g.couleur, a.echelle)}
              <svg viewBox="0 0 24 24" style={{ position: "absolute", left: d.x + d.largeur * 0.2, top: d.y + d.hauteur * 0.2, width: d.largeur * 0.6, height: d.hauteur * 0.6, transform: `scale(${a.echelle.toFixed(4)})`, overflow: "visible" }}>
                <path d={SIGNES_CODES_3[g.code]} fill="none" stroke={C.fond} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : null}
          <Textes e={e} plan={plan} t={t} />
        </>
      );
    }
    case "case": {
      const b = g.boite;
      const ep = Math.max(3, Math.round(4 * plan.k));
      if (g.attente) {
        const encre = plan.fini ? 1 : courbeReference3((t - (plan.apparitions[`${e.elementId}#encre`] ?? 1e9)) / 0.25);
        return (
          <>
            <div style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, borderRadius: Math.round(12 * plan.k), border: `${ep}px solid ${encre > 0.5 ? C.encre : C.attente}`, boxSizing: "border-box" }} />
            <Textes e={e} plan={plan} t={t} couleur={C.attente} opacite={1 - encre} />
            {encre > 0 ? <Textes e={e} plan={plan} t={t} couleur={C.encre} opacite={encre} /> : null}
          </>
        );
      }
      const a = apparition3(plan, e.elementId, t);
      return (
        <>
          {a.o > 0 ? <div style={{ position: "absolute", left: b.x, top: b.y + a.dy, width: b.largeur, height: b.hauteur, borderRadius: Math.round(12 * plan.k), border: `${ep}px solid ${C.encre}`, boxSizing: "border-box", opacity: a.o }} /> : null}
          <Textes e={e} plan={plan} t={t} />
        </>
      );
    }
    case "avant-apres": {
      const a = apparition3(plan, e.elementId, t);
      if (a.o <= 0) return null;
      const l = e.lignes[0];
      return (
        <div style={{ opacity: a.o, transform: `translateY(${a.dy.toFixed(2)}px)` }}>
          <Signe r={g.disque} signe={g.signe} />
          <span style={{ position: "absolute", left: l.px.x, top: l.px.y, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, ...police(e.taillePx ?? 56, e.couleurTexte ?? C.mention, "detail") }}>{l.texte}</span>
        </div>
      );
    }
    case "idee": {
      const a = apparition3(plan, e.elementId, t);
      const x = g.texte;
      return (
        <>
          {a.o > 0 ? (
            <div style={{ opacity: a.o, transform: `translateY(${a.dy.toFixed(2)}px)` }}>
              <Signe r={g.signe} signe="croix" />
              <span style={{ position: "absolute", left: x.x, top: x.y, height: x.hauteur, lineHeight: `${x.hauteur}px`, ...police(x.taille, C.mention, "detail") }}>{x.texte}</span>
            </div>
          ) : null}
          <Textes e={e} plan={plan} t={t} />
        </>
      );
    }
    case "transformation": {
      const a = apparition3(plan, e.elementId, t);
      const c = g.carte;
      const [de, vers] = e.lignes;
      return (
        <>
          {a.o > 0 ? <div style={{ position: "absolute", left: c.x, top: c.y + a.dy, width: c.largeur, height: c.hauteur, borderRadius: g.rayon, backgroundColor: g.fond, border: `${Math.max(2, Math.round(TAILLES_GABARIT_3.bordCarte * plan.k))}px solid ${C.bordCarte}`, boxSizing: "border-box", opacity: a.o }} /> : null}
          {de ? <LigneEcrite l={de} u={avancement3(plan, e.elementId, "ligne:0", t)} taille={g.tailleDe} couleur={C.mention} famille="detail" opacite={opaciteLigne3(plan, e.elementId, "ligne:0", t)} /> : null}
          {vers ? <LigneEcrite l={vers} u={avancement3(plan, e.elementId, "ligne:1", t)} taille={e.taillePx ?? 80} couleur={C.encre} famille="titre" opacite={opaciteLigne3(plan, e.elementId, "ligne:1", t)} /> : null}
        </>
      );
    }
    case "titre":
    case "phrase": {
      // Peps : la ligne du mot-clé se pousse (×1,06) quand la voix le dit, avec son marqueur.
      const p = g.marqueur ? poussee3(plan, e.elementId, t) : 1;
      const l = e.lignes[e.lignes.length - 1]?.px;
      if (p === 1 || !l) return <Textes e={e} plan={plan} t={t} accent={g.accent} />;
      return (
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${l.x.toFixed(1)}px ${(l.y + l.hauteur * 0.6).toFixed(1)}px`, transform: `scale(${p.toFixed(4)})` }}>
          <Textes e={e} plan={plan} t={t} accent={g.accent} />
        </div>
      );
    }
    case "visuel":
      return <Visuel e={e} plan={plan} t={t} />;
    case "bloc-orange":
      return <BlocOrange e={e} plan={plan} t={t} />;
    case "appel-plein":
      return <Textes e={e} plan={plan} t={t} accent={g.accent} />;
    case "bouton": {
      const b = battement3(plan, t);
      const c = g.cadre;
      return (
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${(c.x + c.largeur / 2).toFixed(1)}px ${(c.y + c.hauteur / 2).toFixed(1)}px`, transform: b !== 1 ? `scale(${b.toFixed(4)})` : undefined }}>
          <div style={{ position: "absolute", left: c.x, top: c.y, width: c.largeur, height: c.hauteur, borderRadius: g.rayon, backgroundColor: g.fond }} />
          <Textes e={e} plan={plan} t={t} famille="bouton" couleur={C.fond} />
        </div>
      );
    }
    default:
      return <Textes e={e} plan={plan} t={t} />;
  }
}

/** Traits du crayon (souligné, entouré, barré, coche, flèche) : un trait simple qui suit la pointe. */
function Traits({ plan, t, largeur, hauteur }: { plan: Plan3; t: number; largeur: number; hauteur: number }) {
  const traits = plan.actions.filter((a) => a.trace !== "ecrire" && a.trace !== "contour" && a.trace !== "surligne");
  return (
    <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      {traits.map((a) => {
        const u = avancement3(plan, a.id, a.partie, t);
        if (u <= 0) return null;
        const fin = a.points[a.points.length - 1];
        const tete = a.trace === "fleche" && u > 0.7 ? `M${(fin.x - 18 * plan.k).toFixed(1)} ${(fin.y - 14 * plan.k).toFixed(1)} L${fin.x.toFixed(1)} ${fin.y.toFixed(1)} L${(fin.x - 18 * plan.k).toFixed(1)} ${(fin.y + 14 * plan.k).toFixed(1)}` : null;
        return (
          <g key={`${a.id}-${a.partie}`}>
            <path d={cheminTrace(a.points)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - u).toFixed(4)} fill="none" stroke={a.couleur} strokeWidth={a.epaisseur} strokeLinecap="round" strokeLinejoin="round" />
            {tete ? <path d={tete} fill="none" stroke={a.couleur} strokeWidth={a.epaisseur} strokeLinecap="round" strokeLinejoin="round" opacity={borne((u - 0.7) * 3.3)} /> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Icône au trait (brun foncé), tracée seule en douceur : un dessin de la banque, sans aplat. */
function Icone({ e, plan, t }: { e: ElementPlace; plan: Plan3; t: number }) {
  const traces = (TRACES_DESSINS as Record<string, readonly (readonly [string, { d: string }])[]>)[e.dessinId ?? ""];
  const u = traceIcone3(plan, e.elementId, t);
  if (!traces || u <= 0) return null;
  return (
    <svg viewBox={`0 0 ${GRILLE_DESSIN} ${GRILLE_DESSIN}`} style={{ position: "absolute", left: e.px.x, top: e.px.y, width: e.px.largeur, height: e.px.hauteur, overflow: "visible", pointerEvents: "none" }}>
      {traces.map(([, a], i) => (
        <path key={i} d={a.d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - u).toFixed(4)} fill="none" stroke={C.icone} strokeWidth={TAILLES_GABARIT_3.traitIcone} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/**
 * Bloc orange plein (peps) : il apparaît en rebond, son compteur défile (« 0 → 3 »), il se pousse (×1,06) quand la voix
 * dit son chiffre. Texte ivoire en Montserrat ExtraBold (4,56 pour 1 sur l'orange, mesuré).
 */
function BlocOrange({ e, plan, t }: { e: ElementPlace; plan: Plan3; t: number }) {
  const g = e.gabarit;
  if (g?.sorte !== "bloc-orange") return null;
  const a = blocOrange3(plan, e.elementId, t, g.compteur);
  if (a.o <= 0) return null;
  const c = g.cadre;
  const echelle = a.echelle * poussee3(plan, e.elementId, t);
  const z = g.compteur?.zone;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: a.o, transformOrigin: `${c.x.toFixed(1)}px ${(c.y + c.hauteur / 2).toFixed(1)}px`, transform: echelle !== 1 ? `scale(${echelle.toFixed(4)})` : undefined }}>
      <div style={{ position: "absolute", left: c.x, top: c.y, width: c.largeur, height: c.hauteur, borderRadius: g.rayon, backgroundColor: C.accent }} />
      {z && g.compteur ? (
        <span style={{ position: "absolute", left: z.x, top: z.y, width: z.largeur, height: z.hauteur, lineHeight: `${z.hauteur}px`, textAlign: "center", ...police(g.compteur.taille, C.fond) }}>{String(a.valeur ?? g.compteur.a)}</span>
      ) : null}
      {e.lignes.map((l, i) => (
        <span key={i} style={{ position: "absolute", left: l.px.x, top: l.px.y, height: l.px.hauteur, lineHeight: `${l.px.hauteur}px`, ...police(e.taillePx ?? 72, C.fond) }}>{l.texte}</span>
      ))}
    </div>
  );
}

/**
 * Visuel dessiné de la banque (`visuels-3.ts`) : ses traits à la mine (bord un peu tremblé, grain), ses hachures sable,
 * ses textes dévoilés de gauche à droite, puis sa seule touche orange qui s'anime ; une fois fini, il respire. Chaque
 * trait se dévoile exactement là où passe la pointe du crayon (mêmes points, mêmes sauts).
 */
function Visuel({ e, plan, t }: { e: ElementPlace; plan: Plan3; t: number }) {
  chargerPoliceInterSemiBold();
  const g = e.gabarit;
  const d = useMemo(() => (g?.sorte === "visuel" && estIdVisuel3(g.id) ? dessinVisuel3(g.id, g.options) : null), [g]);
  const etapes = useMemo(() => (d ? etapesVisuel3(d) : []), [d]);
  if (g?.sorte !== "visuel" || !d) return null;
  const etat = etatVisuel3(plan, e.elementId, t);
  if (!plan.fini && t < etat.debut) return null;
  const b = g.boite;
  const s = souffle3(etat.apres, etat.vie);
  const filtre = `mine-${e.elementId.replace(/[^\w-]/g, "_")}`;
  const part = (cle: string) => etat.parties[cle] ?? 0;
  const traits = etapes.filter((x) => x.sorte === "trait");
  const fleau = etapes.filter((x) => x.sorte === "fleau");
  const orange = etapes.filter((x) => x.sorte === "orange");
  const oSeul = d.orange.sorte !== "trace" ? etatOrange3(d.orange, part("visuel:orange:0"), etat.apres, etat.vie) : null;
  const traitsDe = (xs: typeof etapes, couleur: string, ep: number) =>
    xs.flatMap((x) => {
      const u = part(`visuel:${x.sorte}:${x.i}`);
      if (u <= 0) return [];
      const v = portionsChemins3(x.chemins, u);
      return x.chemins.map((c, j) => (v[j] > 0 ? <path key={`${x.sorte}-${x.i}-${j}`} d={cheminPoints3(c)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - v[j]).toFixed(4)} fill="none" stroke={couleur} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" /> : null));
    });
  const angleFleau = oSeul?.sorte === "poids" ? oSeul.angle : 0;
  return (
    <svg viewBox={`0 0 ${GRILLE_VISUEL_3} ${GRILLE_VISUEL_3}`} style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, overflow: "visible", pointerEvents: "none", transformOrigin: "50% 50%", transform: s.dy || s.echelle !== 1 ? `translateY(${(s.dy * plan.k).toFixed(2)}px) scale(${s.echelle.toFixed(4)})` : undefined }}>
      <defs>
        {/* Trait de crayon : bord légèrement tremblé + grain de mine (aucune couleur ajoutée : seule l'opacité varie). */}
        <filter id={filtre} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={4} result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale={3.2} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={9} result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.95" result="g" />
          <feComposite in="d" in2="g" operator="in" />
        </filter>
        {d.hachures.map((h, i) => (
          <clipPath key={i} id={`${filtre}-h${i}`}>
            <path d={h.clip ?? `M${h.x} ${h.y} H${h.x + h.l} V${h.y + h.h} H${h.x} Z`} clipRule={h.regle ?? "nonzero"} />
          </clipPath>
        ))}
      </defs>
      <g filter={`url(#${filtre})`}>
        {etapes
          .filter((x) => x.sorte === "hachure")
          .map((x) => (
            <g key={`h${x.i}`} clipPath={`url(#${filtre}-h${x.i})`}>
              {traitsDe([x], C.hachure, TRAIT_HACHURE_3)}
            </g>
          ))}
      </g>
      <g filter={`url(#${filtre})`}>{traitsDe(traits, C.mine, TRAIT_VISUEL_3)}</g>
      {fleau.length ? (
        <g transform={angleFleau ? `rotate(${angleFleau.toFixed(2)} 200 100)` : undefined}>
          <g filter={`url(#${filtre})`}>{traitsDe(fleau, C.mine, TRAIT_VISUEL_3)}</g>
          {oSeul?.sorte === "poids" && oSeul.visible && d.orange.sorte === "poids" ? <rect x={d.orange.x} y={oSeul.y} width={d.orange.l} height={d.orange.h} rx={6} fill={C.accent} /> : null}
        </g>
      ) : null}
      <Textes3 d={d} etat={etat.parties} prefixe={filtre} />
      <Orange d={d} etat={oSeul} parties={etat.parties} etapes={orange} />
    </svg>
  );
}

/** Les textes du visuel, dévoilés de gauche à droite (Montserrat ExtraBold ou Inter SemiBold), comme la maquette. */
function Textes3({ d, etat, prefixe }: { d: DessinVisuel3; etat: Record<string, number>; prefixe: string }) {
  return (
    <>
      {d.textes.map((x, i) => {
        const u = etat[`visuel:texte:${i}`] ?? 0;
        if (u <= 0) return null;
        const b = boiteTexteVisuel3(x);
        const titre = x.police === "titre";
        const id = `${prefixe}-t${i}`;
        return (
          <g key={i}>
            {u < 1 ? (
              <clipPath id={id}>
                <rect x={b.x - 4} y={0} width={((b.l + 8) * u).toFixed(2)} height={GRILLE_VISUEL_3} />
              </clipPath>
            ) : null}
            <text x={x.x} y={x.y} fontFamily={`"${titre ? FAMILLE_MONTSERRAT : FAMILLE_INTER_SEMIBOLD}", sans-serif`} fontWeight={titre ? 800 : 600} fontSize={x.taille} letterSpacing={titre ? `${APPROCHE_VISUEL_3}em` : "0"} fill={x.couleur === "mention" ? C.mention : C.encre} textAnchor={x.ancre} clipPath={u < 1 ? `url(#${id})` : undefined}>
              {x.t}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** La seule touche orange du visuel, à son avancement. */
function Orange({ d, etat, parties, etapes }: { d: DessinVisuel3; etat: ReturnType<typeof etatOrange3> | null; parties: Record<string, number>; etapes: ReturnType<typeof etapesVisuel3> }) {
  const O = d.orange;
  if (O.sorte === "trace")
    return (
      <g>
        {etapes.map((x) => {
          const u = parties[`visuel:orange:${x.i}`] ?? 0;
          if (u <= 0) return null;
          const v = portionsChemins3(x.chemins, u);
          return x.chemins.map((c, j) => (v[j] > 0 ? <path key={`${x.i}-${j}`} d={cheminPoints3(c)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - v[j]).toFixed(4)} fill="none" stroke={C.accent} strokeWidth={O.epaisseur} strokeLinecap="round" strokeLinejoin="round" /> : null));
        })}
      </g>
    );
  if (!etat) return null;
  switch (O.sorte) {
    case "barre":
      if (etat.sorte !== "barre") return null;
      return (
        <g>
          {etat.hauteur > 0 ? <rect x={O.x} y={etat.y} width={O.l} height={etat.hauteur} rx={4} fill={C.accent} /> : null}
          {O.etiquette && etat.etiquette > 0 ? (
            <text x={O.etiquette.x} y={O.etiquette.y} fontFamily={`"${FAMILLE_MONTSERRAT}", sans-serif`} fontWeight={800} fontSize={44} letterSpacing={`${APPROCHE_VISUEL_3}em`} fill={C.encre} textAnchor="middle" opacity={etat.etiquette}>
              {O.etiquette.t}
            </text>
          ) : null}
        </g>
      );
    case "aiguille": {
      if (etat.sorte !== "aiguille" || !etat.visible) return null;
      const ra = O.r * 0.62;
      const a1 = ((etat.angle - 90) * Math.PI) / 180;
      return (
        <g>
          {etat.angle >= 1 ? <path d={`M${O.cx} ${O.cy - ra} A${ra} ${ra} 0 ${etat.angle > 180 ? 1 : 0} 1 ${(O.cx + ra * Math.cos(a1)).toFixed(1)} ${(O.cy + ra * Math.sin(a1)).toFixed(1)}`} fill="none" stroke={C.traceTemps} strokeWidth={26} strokeLinecap="round" /> : null}
          <path d={`M${O.cx} ${O.cy + 14} V${O.cy - O.r}`} transform={`rotate(${etat.angle.toFixed(2)} ${O.cx} ${O.cy})`} stroke={C.accent} strokeWidth={9} strokeLinecap="round" fill="none" />
          <circle cx={O.cx} cy={O.cy} r={11} fill={C.accent} />
        </g>
      );
    }
    case "goutte":
      return etat.sorte === "goutte" && etat.visible ? <circle cx={O.x} cy={etat.y.toFixed(1)} r={O.r} fill={C.accent} /> : null;
    case "fleche": {
      if (etat.sorte !== "fleche" || !etat.visible) return null;
      const n = Math.hypot(O.dx, O.dy);
      const ux = O.dx / n;
      const uy = O.dy / n;
      const bx = O.x + O.dx;
      const by = O.y + O.dy;
      const px = -uy;
      const py = ux;
      return (
        <g>
          <g transform={`translate(${etat.dx.toFixed(1)} ${etat.dy.toFixed(1)})`} opacity={etat.opacite}>
            <path d={`M${O.x} ${O.y} L${bx} ${by}`} stroke={C.accent} strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={`M${bx - ux * 34 + px * 4} ${by - uy * 34 + py * 4} L${bx + px * 26} ${by + py * 26} M${bx - ux * 34 - px * 4} ${by - uy * 34 - py * 4} L${bx - px * 26} ${by - py * 26}`} stroke={C.accent} strokeWidth={8} strokeLinecap="round" fill="none" />
          </g>
          {etat.impact ? <path d={`M${O.x - 30} ${O.y + 34} l-16 14 M${O.x + 34} ${O.y + 30} l16 12 M${O.x - 36} ${O.y - 14} l-20 -4`} stroke={C.accent} strokeWidth={6} strokeLinecap="round" fill="none" /> : null}
        </g>
      );
    }
    case "badge":
      if (etat.sorte !== "badge" || etat.opacite <= 0) return null;
      return (
        <g opacity={etat.opacite} transform={`translate(${O.x} ${O.y}) scale(${etat.echelle.toFixed(4)}) translate(${-O.x} ${-O.y})`}>
          <circle cx={O.x} cy={O.y} r={O.r} fill={C.accent} />
          <text x={O.x} y={O.y + 13} fontFamily={`"${FAMILLE_MONTSERRAT}", sans-serif`} fontWeight={800} fontSize={38} fill={C.fond} textAnchor="middle">
            {O.t}
          </text>
        </g>
      );
    case "points":
      if (etat.sorte !== "points" || !etat.visible) return null;
      return (
        <g>
          {etat.dy.map((dy, i) => (
            <circle key={i} cx={O.x - O.ecart + i * O.ecart} cy={O.y} r={O.r} fill={C.accent} transform={`translate(0 ${dy.toFixed(1)})`} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

/**
 * Barre des CHAPITRES NOMMÉS (choix de Will du 15/10, variante « 1. Chapitres nommés ») : une barre arrondie par
 * chapitre, son nom dessous (Inter SemiBold, légèrement espacé). Fait : barre pleine à l'encre, nom brun foncé.
 * En cours : rail ivoire foncé qui se remplit en orange de gauche à droite pendant que la voix parle (temps écoulé dans
 * le chapitre ÷ sa durée, courbe douce), nom à l'encre. À venir : rail brun clair, nom brun (contrastes mesurés).
 */
function Barre({ p, t }: { p: ProprietesTableauScene; t: number }) {
  chargerPoliceInterSemiBold();
  const r = p.styleReference!;
  const b = r.barre;
  const n = r.nomsChapitres;
  const parties = r.parties ?? [];
  if (!b || !parties.length) return null;
  const ecart = Math.max(4, Math.round(TAILLES_GABARIT_3.ecartBarre * r.k));
  const w = (b.largeur - ecart * (parties.length - 1)) / parties.length;
  const ms = t * 1000;
  return (
    <>
      {parties.map((q, i) => {
        const etat = ms >= q.finMs ? "fait" : ms >= q.debutMs ? "encours" : "avenir";
        const u = etat === "fait" ? 1 : etat === "encours" ? remplissageChapitre3((ms - q.debutMs) / Math.max(1, q.finMs - q.debutMs)) : 0;
        const x = b.x + i * (w + ecart);
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: x, top: b.y, width: w, height: b.hauteur, borderRadius: b.hauteur / 2, backgroundColor: C.barreFond, overflow: "hidden" }}>
              {u > 0 ? <div style={{ width: `${(u * 100).toFixed(3)}%`, height: "100%", borderRadius: b.hauteur / 2, backgroundColor: etat === "fait" ? C.encre : C.accent }} /> : null}
            </div>
            {n && q.nom ? (
              <span style={{ position: "absolute", left: x, top: n.y, width: w, height: n.hauteur, lineHeight: `${n.hauteur}px`, overflow: "hidden", fontFamily: `"${FAMILLE_INTER_SEMIBOLD}", sans-serif`, fontWeight: 600, fontSize: n.taille, letterSpacing: `${TAILLES_GABARIT_3.approcheNomChapitre}em`, color: etat === "fait" ? C.mention : etat === "encours" ? C.encre : C.chapitreAVenir, whiteSpace: "pre", ...STYLE_ECRITURE_EXACTE }}>
                {q.nom}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/** Le crayon de la charte : corps brun, bois ivoire, bague sable, gomme ivoire foncé (plus de jaune miel). */
function CrayonAxion({ x, y, angle, k, opacite = 1 }: { x: number; y: number; angle: number; k: number; opacite?: number }) {
  const echelle = (CRAYON_REFERENCE.longueur / 388) * k;
  const c = CRAYON_REFERENCE_3;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: opacite, filter: `drop-shadow(${(9 * k).toFixed(1)}px ${(16 * k).toFixed(1)}px ${(9 * k).toFixed(1)}px ${c.ombre})` }}>
      <svg viewBox="0 0 420 420" overflow="visible" style={{ position: "absolute", left: 0, top: 0, width: 420, height: 420, overflow: "visible", transformOrigin: "0 0", transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${angle.toFixed(2)}deg) scale(${echelle.toFixed(4)})` }}>
        <g strokeLinejoin="round">
          <path d="M0 0 L84 -24 L84 24 Z" fill={c.bois} stroke={c.trait} strokeWidth="2.4" />
          <path d="M84 -24 Q76 -8 84 0 Q76 8 84 24" fill="none" stroke={c.veine} strokeWidth="2" />
          <path d="M0 0 L26 -7.5 Q22 0 26 7.5 Z" fill={c.mine} stroke={c.trait} strokeWidth="1.8" />
          <path d="M84 -24 H300 V-8 H84 Z" fill={c.corps[0]} />
          <path d="M84 -8 H300 V8 H84 Z" fill={c.corps[1]} />
          <path d="M84 8 H300 V24 H84 Z" fill={c.corps[2]} />
          <path d="M84 -24 H300 V24 H84" fill="none" stroke={c.trait} strokeWidth="2.4" />
          <rect x="300" y="-25" width="44" height="50" rx="3" fill={c.bague} stroke={c.trait} strokeWidth="2.2" />
          <path d="M311 -25 V25 M322 -25 V25 M333 -25 V25" stroke={c.stries} strokeWidth="2" />
          <path d="M344 -24 H372 Q388 -24 388 -8 V8 Q388 24 372 24 H344 Z" fill={c.gomme} stroke={c.trait} strokeWidth="2.2" />
        </g>
      </svg>
    </div>
  );
}
