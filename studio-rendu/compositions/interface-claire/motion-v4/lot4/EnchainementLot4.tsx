import React from "react";
/**
 * ENCHAÎNEMENT DE 15 S du lot 4 « Fenêtres vidéo » (standard v4, § I.2) : les 7 éléments du lot sur la prise de 15 s (voix de Will), sous-titres continus,
 * barre de progression, complétés d'`EtiquetteTete` génériques (version locale) pour tenir la densité (R1) et la prise seule (R2).
 * Règle des 5 premières secondes : AUCUNE fenêtre sur le visage avant 5,0 s (étiquettes, cercle d'épaule, bande du bas seulement) ; la prise descend de 0,06 H
 * (D1) sous les étiquettes. Les éléments sont calés sur les mots de la phrase de démonstration (plausible, non transcrite), elle-même calée sur la parole réelle.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { AvantApres } from "./AvantApres";
import { BandeVideo } from "./BandeVideo";
import { CercleEpaule } from "./CercleEpaule";
import { FenetreDouble } from "./FenetreDouble";
import { DUREE_PLEIN_CADRE, FenetrePleinCadre } from "./FenetrePleinCadre";
import { FenetreTelephone } from "./FenetreTelephone";
import { MosaiqueVideos } from "./MosaiqueVideos";
import { MOTS_ETIQUETTES, SOURCES } from "./PlancheLot4";
import type { IdElementLot4 } from "./PlancheLot4";
import { BarreProgression, chargerMontserratBlack, EtiquetteTete, FPS, H, Prise, SousTitresV4, motsSurVoix, valeurDescente, ySousTitresSurYeux } from "./commun-lot4";
import type { MotBrut, MotDemo, Palette, SegDescente } from "./commun-lot4";

export const TOTAL_ENCHAINEMENT = 450;

const w = (m: string, fort = false): MotBrut => ({ mot: m, fort });
/** Phrase de démonstration (plausible, non transcrite), découpée en 8 sections : chaque section est posée sur la parole réelle de SA plage de la prise (tour 2). */
type Section = { de: number; a: number; mots: MotBrut[] };
export const SECTIONS: Section[] = [
  { de: 0, a: 1.5, mots: [w("VOS", true), w("DEVIS", true), w("PARTENT"), w("TOUT"), w("SEULS", true)] },
  { de: 1.5, a: 3.0, mots: [w("UN"), w("COUP"), w("DE"), w("FIL", true), w("DE"), w("MOINS", true)] },
  { de: 3.0, a: 5.0, mots: [w("LES"), w("DEMANDES", true), w("ARRIVENT"), w("TOUTE"), w("LA"), w("JOURNÉE", true)] },
  { de: 5.0, a: 6.8, mots: [w("LE"), w("CLIENT"), w("VALIDE", true), w("DEPUIS"), w("SON"), w("TÉLÉPHONE", true)] },
  { de: 6.8, a: 9.1, mots: [w("LE"), w("DEVIS", true), w("PART"), w("ET"), w("IL"), w("REVIENT", true), w("SIGNÉ", true)] },
  { de: 9.1, a: 11.1, mots: [w("PENDANT"), w("QUE"), w("VOUS"), w("ÊTES"), w("SUR"), w("LE"), w("CHANTIER", true), w("ÇA"), w("TOURNE", true), w("TOUT"), w("SEUL", true)] },
  { de: 11.1, a: 13.3, mots: [w("AVANT"), w("TOUT"), w("À"), w("LA"), w("MAIN", true), w("MAINTENANT"), w("C'EST"), w("AUTOMATIQUE", true)] },
  { de: 13.3, a: 15.0, mots: [w("DES"), w("DIZAINES"), w("DE"), w("DEVIS"), w("DE"), w("CHANTIERS", true), w("DE"), w("CLIENTS", true)] },
];
export function motsEnchainement(): MotDemo[] {
  return SECTIONS.flatMap((sec) => motsSurVoix(sec.mots, sec.de, sec.a - sec.de).map((m) => ({ ...m, debut: +(m.debut + sec.de).toFixed(3), fin: +(m.fin + sec.de).toFixed(3) })));
}

/** Temps (s) du `n`-ième mot `m` de la plage [de, a] de l'enchaînement, une fois posé sur la voix. */
export function tempsMot(mots: MotDemo[], m: string, de = 0, a = 15, n = 1): number {
  let k = 0;
  for (const x of mots) if (x.mot === m && x.debut >= de - 1e-6 && x.debut < a && ++k === n) return x.debut;
  return de;
}

type Genre = IdGenre;
type IdGenre = "etiquette" | "cercle" | "bande" | "telephone" | "double" | "plein" | "avantapres" | "mosaique";
export type Item = { cle: string; genre: Genre; de: number; duree: number; texte?: string; sur?: string; blanc?: boolean; interjection?: boolean; x?: number; inclinaison?: number; cote?: "droite" | "gauche" };
const ID_GENRE: Partial<Record<Genre, IdElementLot4>> = { cercle: "cercle-epaule", bande: "bande-video", telephone: "fenetre-telephone", double: "fenetre-double", plein: "fenetre-plein-cadre", avantapres: "avant-apres", mosaique: "mosaique-videos" };

/** Plan de montage (secondes) : 7 éléments + 2 étiquettes d'ouverture, sans temps mort. Rien ne couvre le visage avant 5,0 s (R des 5 s). */
export function planEnchainement(): { items: Item[]; descente: SegDescente[]; positions: Array<{ de: number; y: number }> } {
  const items: Item[] = [
    { cle: "e1", genre: "etiquette", de: 0, duree: 0.75, texte: "VOS DEVIS", x: 0.5 * 1080, inclinaison: -3 },
    { cle: "e2", genre: "etiquette", de: 0.75, duree: 0.75, texte: "TOUT SEULS.", interjection: true, x: 0.47 * 1080, inclinaison: -3 },
    { cle: "cercle", genre: "cercle", de: 1.5, duree: 1.5, texte: "COUP DE FIL" },
    { cle: "bande", genre: "bande", de: 3.0, duree: 1.8 },
    { cle: "tel", genre: "telephone", de: 5.0, duree: 1.8 },
    { cle: "double", genre: "double", de: 6.8, duree: 2.3 },
    { cle: "plein", genre: "plein", de: 9.1, duree: DUREE_PLEIN_CADRE / FPS },
    { cle: "avap", genre: "avantapres", de: 11.1, duree: 2.2 },
    { cle: "mosa", genre: "mosaique", de: 13.3, duree: 1.7 },
  ];
  const f = (s: number) => Math.round(s * FPS);
  const descente: SegDescente[] = [
    { de: 0, D: 0.06 },
    { de: f(1.5) + 1, D: 0 },
  ];
  // Centre vertical des sous-titres (coupe sèche à chaque changement d'objet), garde-fou sur les yeux appliqué ensuite image par image.
  const de = (c: string) => items.find((i) => i.cle === c)!.de;
  const positions = [
    { de: 0, y: 0.72 * H },
    { de: de("cercle"), y: 0.075 * H },
    { de: de("bande"), y: 0.075 * H },
    { de: de("tel"), y: 0.745 * H },
    { de: de("double"), y: 0.91 * H },
    { de: de("plein"), y: 0.72 * H },
    { de: de("plein") + 16 / FPS, y: 0.795 * H },
    { de: de("avap"), y: 0.745 * H },
    { de: de("mosa"), y: 0.82 * H },
  ].sort((a, b) => a.de - b.de);
  return { items, descente, positions };
}

function Objet({ item, palette, mots }: { item: Item; palette: Palette; mots: MotDemo[] }) {
  const f = useCurrentFrame();
  const duree = Math.round(item.duree * FPS);
  const img = (m: string, a: number, b: number, defaut: number): number => Math.max(0, Math.round((tempsMot(mots, m, a, b) - item.de) * FPS)) || defaut;
  const de = item.de;
  const a = de + item.duree;
  switch (item.genre) {
    case "etiquette":
      return <EtiquetteTete f={f} debut={0} fin={duree - 3} palette={palette} texte={item.texte ?? ""} sur={item.sur} blanc={item.blanc} interjection={item.interjection} x={item.x} inclinaison={item.inclinaison} />;
    case "cercle":
      return <CercleEpaule f={f} duree={duree} palette={palette} etiquette={item.texte ?? ""} cote="droite" iBarre={Math.min(24, Math.max(18, img("MOINS", de, a, 22)))} />;
    case "bande":
      return <BandeVideo f={f} duree={duree} palette={palette} etiquette="LES DEMANDES" etiquette2="TOUTE LA JOURNÉE" iPuce={5} iPuce2={Math.min(24, Math.max(18, img("JOURNÉE", de, a, 22)))} />;
    case "telephone":
      return <FenetreTelephone f={f} duree={duree} palette={palette} etiquette="LE CLIENT" etiquette2="DEVIS SIGNÉ" />;
    case "double":
      return <FenetreDouble f={f} duree={duree} palette={palette} iEnvoi={Math.min(14, Math.max(10, img("PART", de, a, 12)))} iB={Math.min(28, Math.max(24, img("REVIENT", de, a, 26)))} iTampon={Math.min(40, Math.max(36, img("SIGNÉ", de, a, 38)))} />;
    case "plein":
      return <FenetrePleinCadre f={f} duree={duree} palette={palette} src={SOURCES.chantier} etiquette="LE CHANTIER" etiquette2="ÇA TOURNE" etiquette3="TOUT SEUL" sens={-1} iEtiq2={Math.min(24, Math.max(20, img("TOURNE", de, a, 22)))} iEtiq3={Math.min(38, Math.max(34, img("SEUL", de, a, 36)))} />;
    case "avantapres":
      return <AvantApres f={f} duree={duree} palette={palette} srcAvant={SOURCES.papier} iBalaie={Math.min(24, Math.max(14, img("MAINTENANT", de, a, 18)))} depuisAvant={0.6} />;
    case "mosaique": {
      const iH = Math.max(20, img("CHANTIERS", de, a, 24));
      return <MosaiqueVideos f={f} duree={duree} palette={palette} sources={SOURCES.mosaique} iHeros={Math.min(iH, duree - 20)} motFort="CHANTIERS" />;
    }
  }
}

export function EnchainementLot4({ palette }: { palette: Palette }) {
  chargerMontserratBlack();
  const f = useCurrentFrame();
  const mots = React.useMemo(() => motsEnchainement(), []);
  const plan = React.useMemo(() => planEnchainement(), []);
  const D = valeurDescente(f, plan.descente);
  // Position des sous-titres : plan par objet, puis garde-fou calculé à CHAQUE image depuis la descente réelle D(t) (jamais sur les yeux).
  const position = (ff: number) => {
    const t = ff / FPS;
    let y = plan.positions[0].y;
    for (const p of plan.positions) if (t >= p.de - 1e-6) y = p.y;
    return { y: ySousTitresSurYeux(y, valeurDescente(ff, plan.descente)) };
  };
  // Un mot fort déjà affiché par une étiquette posée n'est pas répété en plaque ; le plein cadre masque le groupe ≤ 6 i pendant son ouverture.
  const exclure = (m: MotDemo): boolean => {
    if (!m.fort) return false;
    return plan.items.some((it) => {
      const id = ID_GENRE[it.genre];
      return !!id && m.debut >= it.de - 1e-6 && m.debut < it.de + it.duree && MOTS_ETIQUETTES[id].includes(m.mot);
    });
  };
  const iPlein = Math.round(plan.items.find((i) => i.cle === "plein")!.de * FPS);
  const masque = (ff: number) => ff >= iPlein + 16 && ff < iPlein + 22;
  return (
    <AbsoluteFill style={{ background: "#E9DCC8" }}>
      <Prise debutSec={0} descente={D} />
      {plan.items.map((it) => (
        <Sequence key={it.cle} from={Math.round(it.de * FPS)} durationInFrames={Math.round(it.duree * FPS) + 2}>
          <Objet item={it} palette={palette} mots={mots} />
        </Sequence>
      ))}
      <SousTitresV4 f={f} mots={mots} palette={palette} position={position} exclure={exclure} masque={masque} />
      <BarreProgression f={f} total={TOTAL_ENCHAINEMENT} palette={palette} />
    </AbsoluteFill>
  );
}
