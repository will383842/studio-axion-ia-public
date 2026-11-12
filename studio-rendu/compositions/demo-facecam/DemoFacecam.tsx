/**
 * COMPOSITION « DemoFacecam » (lot J) : écran partagé moitié / moitié — l'écran réel de Williams d'un côté, sa facecam
 * de l'autre, sur le fond ivoire de la charte. Le motion design (zooms doux, surlignages de clic, légendes, plan de
 * scènes du lot C) et les sous-titres restent DANS la moitié écran, jamais devant le visage. Carte de fin Axion.
 * Mise en page, zooms et pistes calculés côté studio (`src/moteurs/montage-demo-facecam/`) ; ici : le dessin.
 * Le son est celui de la facecam (la voix réelle) ; l'écran est muet.
 */
import { AbsoluteFill, continueRender, delayRender, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { ImagePlan } from "../../../src/briques/plan-scenes/rendu";
import { adoucir, CHARTE_AXION, FAMILLE_CSS_AXION, avecOpacite } from "../../../src/briques/jetons-motion";
import { miseEnPageDemo, transformZoom, zoomA, type RectPx } from "../../../src/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "../../../src/moteurs/montage-demo-facecam/proprietes";
import { CalqueSousTitres } from "../sous-titres/CalqueSousTitres";
import manrope from "../../../src/app/polices/manrope-latin.woff2";

let chargement: Promise<void> | null = null;
function chargerManrope(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police Manrope");
  const face = new FontFace("Manrope", `url(${manrope})`, { weight: "200 800" });
  chargement = face
    .load()
    .then(() => {
      document.fonts.add(face);
    })
    .finally(() => continueRender(attente));
}

const borne01 = (t: number) => Math.max(0, Math.min(1, t));

/** Une source recadrée dans sa boîte : la région `recadrage` (pixels de la source) remplit la boîte, sans étirer. */
function SourceRecadree({ src, boite, recadrage, source, muet, debutImage }: { src?: string; boite: RectPx; recadrage: RectPx; source: { largeur: number; hauteur: number }; muet: boolean; debutImage?: number }) {
  if (!src) return <div style={{ position: "absolute", inset: 0, background: CHARTE_AXION.gris }} />;
  const echelle = boite.largeur / recadrage.largeur;
  return (
    <OffthreadVideo
      src={src}
      muted={muet}
      {...(debutImage ? { startFrom: debutImage } : {})}
      style={{ position: "absolute", left: -recadrage.x * echelle, top: -recadrage.y * echelle, width: source.largeur * echelle, height: source.hauteur * echelle, maxWidth: "none" }}
    />
  );
}

export function DemoFacecam(p: ProprietesDemoFacecam) {
  chargerManrope();
  const image = useCurrentFrame();
  const ms = (image * 1000) / p.fps;
  const { ecran, facecam, sousTitres } = p.miseEnPage;
  const decalageImages = Math.round(p.decalageEcranSec * p.fps);
  const zoom = zoomA(p.zooms, ms);
  const enFin = ms >= p.dureeParoleMs;
  const tFin = adoucir(borne01((ms - p.dureeParoleMs) / 500));
  const echellePlan = Math.min(ecran.largeur / p.plan.format.largeur, ecran.hauteur / p.plan.format.hauteur);
  const groupe = p.sousTitres.find((g) => ms >= g.debutMs && ms < g.finMs);
  const legende = p.legendes.find((l) => ms >= l.debutMs && ms < l.finMs);
  const videoEcran = <SourceRecadree src={p.ecran} boite={ecran} recadrage={p.recadrageEcran} source={p.sourceEcran} muet debutImage={decalageImages < 0 ? -decalageImages : undefined} />;
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, fontFamily: FAMILLE_CSS_AXION }}>
      {/* Moitié écran : vidéo zoomée + surlignages + clics, puis le motion du plan, les légendes et les sous-titres. */}
      <div style={{ position: "absolute", left: ecran.x, top: ecran.y, width: ecran.largeur, height: ecran.hauteur, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, ...transformZoom(zoom) }}>
          {decalageImages > 0 ? <Sequence from={decalageImages}>{videoEcran}</Sequence> : videoEcran}
          {p.surlignages
            .filter((s) => ms >= s.debutMs && ms < s.finMs)
            .map((s, i) => (
              <div key={`s${i}`} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: `${s.largeur}%`, height: `${s.hauteur}%`, border: `4px solid ${CHARTE_AXION.terracotta}`, borderRadius: 12, background: avecOpacite(CHARTE_AXION.terracotta, 0.08), opacity: adoucir(borne01((ms - s.debutMs) / 300)) }} />
            ))}
          {p.clics
            .filter((c) => ms >= c.ms && ms < c.ms + 700)
            .map((c, i) => {
              const t = adoucir((ms - c.ms) / 700);
              const taille = 24 + 56 * t;
              return <div key={`c${i}`} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: taille, height: taille, marginLeft: -taille / 2, marginTop: -taille / 2, borderRadius: "50%", border: `5px solid ${CHARTE_AXION.terracotta}`, opacity: 1 - t }} />;
            })}
        </div>
        <div style={{ position: "absolute", left: (ecran.largeur - p.plan.format.largeur * echellePlan) / 2, top: (ecran.hauteur - p.plan.format.hauteur * echellePlan) / 2, width: p.plan.format.largeur, height: p.plan.format.hauteur, transform: `scale(${echellePlan})`, transformOrigin: "0 0" }}>
          <ImagePlan plan={{ ...p.plan, facecam: true }} image={image} />
        </div>
        {legende && (
          <div style={{ position: "absolute", left: "50%", top: Math.round(ecran.hauteur * 0.05), transform: "translateX(-50%)", padding: "12px 28px", borderRadius: 999, background: CHARTE_AXION.noir, color: CHARTE_AXION.ivoire, fontSize: Math.round(ecran.hauteur * 0.045), fontWeight: 700, whiteSpace: "nowrap" }}>{legende.texte}</div>
        )}
      </div>
      {p.calqueSousTitres ? <CalqueSousTitres donnees={p.calqueSousTitres} /> : null}
      {!p.calqueSousTitres && groupe && (
        <div style={{ position: "absolute", left: sousTitres.x, top: sousTitres.y, width: sousTitres.largeur, height: sousTitres.hauteur, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ padding: "10px 22px", borderRadius: 16, background: avecOpacite(CHARTE_AXION.noir, 0.82), color: CHARTE_AXION.ivoire, fontSize: Math.round(Math.min(sousTitres.hauteur * 0.42, 58)), fontWeight: 800, textAlign: "center", lineHeight: 1.15 }}>
            {groupe.mots.map((m, i) => (
              <span key={i} style={{ color: ms >= m.debutMs ? CHARTE_AXION.ivoire : avecOpacite(CHARTE_AXION.ivoire, 0.55) }}>
                {i ? " " : ""}
                {m.texte}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Moitié facecam : la prise de Williams, sa voix. Rien ne s'y pose. */}
      <div style={{ position: "absolute", left: facecam.x, top: facecam.y, width: facecam.largeur, height: facecam.hauteur, overflow: "hidden" }}>
        <SourceRecadree src={p.facecam} boite={facecam} recadrage={p.recadrageFacecam} source={p.sourceFacecam} muet={false} />
      </div>
      {enFin && (
        <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, opacity: tFin, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18 }}>
          <div style={{ color: CHARTE_AXION.noir, fontSize: Math.round(p.largeur * 0.09), fontWeight: 800, letterSpacing: -1 }}>{p.carteFin.titre}</div>
          <div style={{ width: Math.round(p.largeur * 0.12), height: 6, borderRadius: 3, background: CHARTE_AXION.terracotta }} />
          <div style={{ color: CHARTE_AXION.terracotta, fontSize: Math.round(p.largeur * 0.04), fontWeight: 600 }}>{p.carteFin.sousTitre}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

export const metaDemoFacecam = ({ props }: { props: ProprietesDemoFacecam }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: Math.max(1, props.images) });

/** Propriétés vides (carte de fin seule après 1 s) : les vraies arrivent par la demande de rendu. */
const MISE_VIDE = miseEnPageDemo("4:5");
export const DEMO_FACECAM_VIDE: ProprietesDemoFacecam = {
  largeur: MISE_VIDE.largeur,
  hauteur: MISE_VIDE.hauteur,
  fps: 25,
  images: 88,
  dureeParoleMs: 1000,
  miseEnPage: MISE_VIDE,
  recadrageFacecam: { x: 0, y: 0, largeur: 1920, hauteur: 1080 },
  recadrageEcran: { x: 0, y: 0, largeur: 1920, hauteur: 1080 },
  sourceFacecam: { largeur: 1920, hauteur: 1080 },
  sourceEcran: { largeur: 1920, hauteur: 1080 },
  decalageEcranSec: 0,
  zooms: [],
  clics: [],
  surlignages: [],
  legendes: [],
  plan: { version: "plan-scenes-1", format: { largeur: MISE_VIDE.ecran.largeur, hauteur: MISE_VIDE.ecran.hauteur, fps: 25 }, facecam: false, dureeMs: 1000, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes: [] },
  sousTitres: [],
  carteFin: { titre: "Axion IA", sousTitre: "axion-ia.com" },
};
