/**
 * Planche des transitions communes (C6-H7a) : les 14 entrées de `TRANSITIONS_COMMUNES`, chacune 2 s (50 images à 25 i/s),
 * jouée en entrée puis en sortie sur une boîte témoin. Moitié haute : carte ivoire sur fond noir ; moitié basse : carte noire
 * sur fond ivoire. Lancée à la main ; aucun générateur ne demande ces compositions.
 *
 * Mesure AM-05 : `HabillageMesure` (60 images, propriété `cas`). Aucun calcul de temps ici : le temps et la mémoire sont
 * relevés par `studio-rendu/scripts/planche-habillage.ts`, hors composition.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, adoucir, avecOpacite, couleursSur, progression } from "../../../../src/briques/jetons-motion";
import { IDS_TRANSITIONS_COMMUNES, TRANSITIONS_COMMUNES } from "../../../../src/briques/motion/habillage-commun/transitions";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";

export const IMAGES_PAR_TABLEAU = 50;
const DUREE_PASSAGE = 14;
const DEBUT_SORTIE = 34;
export const IMAGES_PLANCHE = IDS_TRANSITIONS_COMMUNES.length * IMAGES_PAR_TABLEAU;

export type ProprietesPlancheTransitions = { largeur: number; hauteur: number; fps: number };

const BOITE = { largeur: 640, hauteur: 360 };

function Temoin({ fond, local, indice }: { fond: "ivoire" | "noir"; local: number; indice: number }) {
  const def = TRANSITIONS_COMMUNES[IDS_TRANSITIONS_COMMUNES[indice]];
  const c = couleursSur(fond);
  const carte = couleursSur(fond === "noir" ? "ivoire" : "noir");
  const entree = progression(local, 0, DUREE_PASSAGE);
  const sortie = 1 - progression(local, DEBUT_SORTIE, DUREE_PASSAGE);
  const enSortie = local >= DEBUT_SORTIE;
  const style = def.style(enSortie ? sortie : entree, enSortie ? "sortie" : "entree", BOITE);
  return (
    <div style={{ position: "relative", flex: 1, backgroundColor: c.fond, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: BOITE.largeur, height: BOITE.hauteur, borderRadius: 24, backgroundColor: carte.fond, border: `2px solid ${c.filet}`, ...style }}>
        <div style={{ padding: 32, fontFamily: FAMILLE_CSS_AXION, fontSize: 40, fontWeight: 700, color: carte.texte }}>Carte témoin</div>
      </div>
    </div>
  );
}

export function PlancheTransitions(_props: ProprietesPlancheTransitions) {
  chargerManrope();
  const image = useCurrentFrame();
  const indice = Math.min(IDS_TRANSITIONS_COMMUNES.length - 1, Math.floor(image / IMAGES_PAR_TABLEAU));
  const local = image - indice * IMAGES_PAR_TABLEAU;
  const def = TRANSITIONS_COMMUNES[IDS_TRANSITIONS_COMMUNES[indice]];
  const mentions = [def.attendMesure ? "à mesurer (AM-05)" : null, def.emprise === "plein-cadre" ? "plein cadre" : null].filter(Boolean).join(" · ");
  const lisible = adoucir(Math.min(1, local / 6));
  return (
    <AbsoluteFill style={{ backgroundColor: CHARTE_AXION.noir }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
        <Temoin fond="noir" local={local} indice={indice} />
        <Temoin fond="ivoire" local={local} indice={indice} />
      </div>
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontFamily: FAMILLE_CSS_AXION, color: CHARTE_AXION.ivoire,
          opacity: lisible, textShadow: `0 2px 12px ${avecOpacite(CHARTE_AXION.noir, 0.8)}`,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>{def.nom}</div>
        <div style={{ fontSize: 28, fontWeight: 500 }}>{def.id}</div>
        {mentions ? <div style={{ fontSize: 28, fontWeight: 600, color: CHARTE_AXION.orange }}>{mentions}</div> : null}
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Mesure AM-05                                                        */
/* ------------------------------------------------------------------ */

export const CAS_MESURE = [
  "flou-0-plein", "flou-6-plein", "flou-12-plein",
  "flou-0-boite", "flou-6-boite", "flou-12-boite",
  "clip-path", "mix-blend-mode", "feTurbulence",
] as const;
export type CasMesure = (typeof CAS_MESURE)[number];
export type ProprietesMesure = { largeur: number; hauteur: number; fps: number; images: number; cas: CasMesure };

const flouDe = (cas: CasMesure) => (cas.startsWith("flou-") ? Number(cas.split("-")[1]) : 0);

export function HabillageMesureVue({ cas }: { cas: CasMesure }) {
  chargerManrope();
  const image = useCurrentFrame();
  const n = flouDe(cas);
  const c = couleursSur("ivoire");
  const bouge = { transform: `translateX(${image * 4}px)` };
  const fond = (
    <div style={{ position: "absolute", inset: 0, backgroundColor: c.fond, fontFamily: FAMILLE_CSS_AXION, color: c.texte, fontSize: 56, fontWeight: 700, lineHeight: 1.2, padding: 48 }}>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} style={{ marginBottom: 40, ...bouge, color: i % 2 ? c.accent : c.texte }}>Studio Axion IA · mesure AM-05 · ligne {i + 1}</div>
      ))}
    </div>
  );
  const flou = n > 0 ? { filter: `blur(${n}px)` } : {};
  let contenu;
  if (cas.endsWith("-plein")) {
    contenu = <AbsoluteFill style={flou}>{fond}</AbsoluteFill>;
  } else if (cas.endsWith("-boite")) {
    contenu = (
      <>
        {fond}
        <div style={{ position: "absolute", left: 220, top: 760, width: 640, height: 360, borderRadius: 24, backgroundColor: CHARTE_AXION.noir, ...flou, ...bouge }} />
      </>
    );
  } else if (cas === "clip-path") {
    contenu = <AbsoluteFill style={{ clipPath: `circle(${30 + (image % 40)}% at 50% 50%)` }}>{fond}</AbsoluteFill>;
  } else if (cas === "mix-blend-mode") {
    contenu = (
      <>
        {fond}
        <div style={{ position: "absolute", inset: 0, backgroundColor: CHARTE_AXION.terracotta, mixBlendMode: "multiply" }} />
      </>
    );
  } else {
    contenu = (
      <>
        <AbsoluteFill style={{ filter: "url(#habillage-grain)" }}>{fond}</AbsoluteFill>
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id="habillage-grain">
            <feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={2} seed={image} />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
        </svg>
      </>
    );
  }
  return <AbsoluteFill style={{ backgroundColor: c.fond }}>{contenu}</AbsoluteFill>;
}

export function HabillageMesure({ cas }: ProprietesMesure) {
  return <HabillageMesureVue cas={cas} />;
}
