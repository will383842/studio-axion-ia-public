import React from "react";
/**
 * BANC D'ESSAI du lot 2 « Cartes qui se construisent » (v4) : un extrait par élément (palette A et B) sur la prise commune (vidéo de 15 s avec la
 * voix de Will, aucun zoom), plus l'enchaînement de 15 s du lot. Aucun rôle en production : `entree-lot2.tsx` n'est pas branché dans `Racine.tsx`.
 * Les mots de démonstration sont écrits à l'œil (la synchro exacte avec la voix n'est pas demandée) ; les instants des déclencheurs sont calés dessus.
 */
import { AbsoluteFill, Composition, Sequence, useCurrentFrame } from "remotion";
import { CarteCalendrier, evenementsCalendrier } from "./CarteCalendrier";
import { CarteChecklist, evenementsChecklist } from "./CarteChecklist";
import { CarteCommande, evenementsCommande } from "./CarteCommande";
import { CarteCommentaire, evenementsCommentaire } from "./CarteCommentaire";
import { CarteComparaison, evenementsComparaison } from "./CarteComparaison";
import { CarteStatuts, evenementsStatuts } from "./CarteStatuts";
import { FriseEtapes, evenementsFrise } from "./FriseEtapes";
import { GraphiqueBarres, evenementsGraphique } from "./GraphiqueBarres";
import { BarreProgression, changementsDescente, chargerPolicesV4, DESCENTE, EtiquetteTete, FPS, Prise, REGLAGE_SONS, SousTitresV4, valeurD, verifierYeux, Y_SOUS_CARTE, ySousTitresReel } from "./commun-lot2";
import type { FondTest, Mot, Palette } from "./commun-lot2";

export type IdElementLot2 = "carte-checklist" | "carte-commande" | "carte-commentaire" | "carte-statuts" | "graphique-barres" | "carte-calendrier" | "carte-comparaison" | "frise-etapes";
export const ELEMENTS_LOT_2: IdElementLot2[] = ["carte-checklist", "carte-commande", "carte-commentaire", "carte-statuts", "graphique-barres", "carte-calendrier", "carte-comparaison", "frise-etapes"];
export const NOM_CODE: Record<IdElementLot2, string> = {
  "carte-checklist": "CarteChecklist",
  "carte-commande": "CarteCommande",
  "carte-commentaire": "CarteCommentaire",
  "carte-statuts": "CarteStatuts",
  "graphique-barres": "GraphiqueBarres",
  "carte-calendrier": "CarteCalendrier",
  "carte-comparaison": "CarteComparaison",
  "frise-etapes": "FriseEtapes",
};

/* ------------------------------------------------------------------ Mots de démonstration ------------------------------------------------------------------ */

const lettresDe = (m: string): number => m.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length;
/** Mots au rythme de la parole (≈ 4 mots/s) à partir de `t0` ; `forts` / `chiffres` : indices. */
export function motsRythme(texte: string, t0: number, forts: number[] = [], chiffres: number[] = []): Mot[] {
  let t = t0;
  return texte.split(/\s+/).filter(Boolean).map((m, k) => {
    const d = 0.065 + 0.036 * lettresDe(m);
    const mot: Mot = { mot: m.toUpperCase(), debut: t, fin: t + d * 0.92, fort: forts.includes(k), chiffre: chiffres.includes(k) };
    t += d + 0.02;
    return mot;
  });
}
/** Mots répartis uniformément (au prorata des lettres) sur [a, b] secondes. */
export function motsRepartis(mots: string[], a: number, b: number, forts: number[] = [], chiffres: number[] = []): Mot[] {
  const poids = mots.map((m) => 3 + lettresDe(m));
  const somme = poids.reduce((x, y) => x + y, 0);
  let t = a;
  return mots.map((m, k) => {
    const d = ((b - a) * poids[k]) / somme;
    const mot: Mot = { mot: m.toUpperCase(), debut: t, fin: t + d * 0.9, fort: forts.includes(k), chiffre: chiffres.includes(k) };
    t += d;
    return mot;
  });
}

/* ------------------------------------------------------------------ Scénarios d'extrait (un par élément) ------------------------------------------------------------------ */

type Scenario = {
  phrase: string;
  forts: number[];
  chiffres?: number[];
  /** Indice du mot qui déclenche la chute de la carte. */
  debutMot: number;
  /** Images d'avance de la chute sur ce mot. */
  avance?: number;
  /** Indices de mots des déclencheurs (dans l'ordre de `decl` de l'élément). */
  decl: number[];
  /** Images de plus après le dernier déclencheur avant la remontée. */
  tenue: number;
  haute?: boolean;
  /** Seconde de la prise (15 s) où l'extrait démarre. */
  depuis: number;
};

export const SCENARIOS: Record<IdElementLot2, Scenario> = {
  "carte-checklist": { phrase: "on automatise les relances les devis les rendez-vous et les factures", forts: [1], debutMot: 1, avance: 2, decl: [3, 5, 7, 10], tenue: 30, depuis: 1.2 },
  "carte-commande": { phrase: "alors je tape une seule commande relance et j'envoie l'agent s'en occupe", forts: [2, 8], debutMot: 1, avance: 2, decl: [2, 4, 6, 8, 9], tenue: 30, depuis: 10.3 },
  "carte-commentaire": { phrase: "alors commentez RELANCE et je vous envoie le guide", forts: [1], debutMot: 1, avance: 2, decl: [2, 4, 6], tenue: 30, depuis: 3.3 },
  "carte-statuts": { phrase: "alors le premier trie les demandes le deuxième écrit le troisième envoie", forts: [2, 7, 10], debutMot: 1, avance: 2, decl: [2, 7, 10], tenue: 30, depuis: 5.9 },
  "graphique-barres": { phrase: "et le taux de réponse a doublé deux fois plus", forts: [6], chiffres: [7], debutMot: 1, avance: 2, decl: [2, 6, 7], tenue: 30, depuis: 1.4 },
  "carte-calendrier": { phrase: "et vos rendez-vous se calent tout seuls dans la semaine", forts: [2, 6, 9], debutMot: 1, avance: 2, decl: [2, 5], tenue: 30, depuis: 10.4 },
  "carte-comparaison": { phrase: "alors une agence met des mois vos agents une heure", forts: [3, 6], debutMot: 1, avance: 2, decl: [2, 6, 9], tenue: 30, depuis: 9.9 },
  "frise-etapes": { phrase: "alors la demande arrive le devis part la relance suit le client signe", forts: [0], debutMot: 1, avance: 2, decl: [2, 5, 8, 12], tenue: 30, haute: true, depuis: 5.0 },
};

export type PlanExtrait = { mots: Mot[]; elStart: number; duree: number; decl: number[]; total: number; haute: boolean; depuis: number };
export function planExtrait(id: IdElementLot2): PlanExtrait {
  const s = SCENARIOS[id];
  const mots = motsRythme(s.phrase, 0.12, s.forts, s.chiffres);
  const f = (k: number) => Math.round(mots[k].debut * FPS);
  // La première ligne / le premier objet arrive 6 images après la pose (la carte n'est jamais vide plus de 0,2 s).
  const elStart = Math.max(9, f(s.decl[0]) - 6);
  const decl = s.decl.map((k) => f(k) - elStart);
  if (decl.some((d) => d < 3)) throw new Error(`Déclencheur trop tôt pour ${id} : ${decl.join(",")}`);
  const duree = decl[decl.length - 1] + s.tenue;
  return { mots, elStart, duree, decl, total: Math.max(90, elStart + duree + 12), haute: !!s.haute, depuis: s.depuis };
}

/** Rend l'élément `id` avec ses déclencheurs `decl` (images locales). */
export function Element({ id, palette, decl, duree, avecSons, extra }: { id: IdElementLot2; palette: Palette; decl: number[]; duree: number; avecSons: boolean; extra?: Record<string, unknown> }) {
  const c = { palette, decl, duree, avecSons, ...(extra ?? {}) };
  switch (id) {
    case "carte-checklist":
      return <CarteChecklist {...c} lignes={(extra?.lignes as string[] | undefined) ?? ["Les relances", "Les devis", "Les rendez-vous", "Les factures"]} />;
    case "carte-commande":
      return <CarteCommande {...c} />;
    case "carte-commentaire":
      return <CarteCommentaire {...c} />;
    case "carte-statuts":
      return <CarteStatuts {...c} />;
    case "graphique-barres":
      return <GraphiqueBarres {...c} />;
    case "carte-calendrier":
      return <CarteCalendrier {...c} />;
    case "carte-comparaison":
      return <CarteComparaison {...c} />;
    case "frise-etapes":
      return <FriseEtapes {...c} />;
  }
}

/** Événements graphiques de l'élément (images locales) pour le contrôle de densité R1. */
export function evenementsDe(id: IdElementLot2, decl: number[], duree: number): number[] {
  switch (id) {
    case "carte-checklist":
      return evenementsChecklist(decl, duree);
    case "carte-commande":
      return evenementsCommande(decl, duree);
    case "carte-commentaire":
      return evenementsCommentaire(decl, duree);
    case "carte-statuts":
      return evenementsStatuts(decl, duree);
    case "graphique-barres":
      return evenementsGraphique(decl, duree);
    case "carte-calendrier":
      return evenementsCalendrier(decl, duree);
    case "carte-comparaison":
      return evenementsComparaison(decl, duree);
    case "frise-etapes":
      return evenementsFrise(decl, duree);
  }
}

/* ------------------------------------------------------------------ Extrait ------------------------------------------------------------------ */

export function ExtraitLot2({ element, palette, fond = "prise" }: { element: IdElementLot2; palette: Palette; fond?: FondTest }) {
  chargerPolicesV4();
  const frame = useCurrentFrame();
  const plan = planExtrait(element);
  const D = plan.haute ? DESCENTE.D3 : DESCENTE.D2;
  const changements = changementsDescente([{ de: plan.elStart, fin: plan.elStart + plan.duree, D }]);
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Prise D={valeurD(frame, changements)} depuis={plan.depuis} fond={fond} />
      <Sequence from={plan.elStart} durationInFrames={plan.duree} layout="none">
        <Element id={element} palette={palette} decl={plan.decl} duree={plan.duree} avecSons />
      </Sequence>
      <SousTitresV4
        mots={plan.mots}
        frame={frame}
        palette={palette}
        y={(f) => {
          const d = valeurD(f, changements);
          const y = ySousTitresReel(d, plan.haute ? Y_SOUS_CARTE.M3 : Y_SOUS_CARTE.M2);
          verifierYeux(f, y, d);
          return y;
        }}
      />
      <BarreProgression frame={frame} total={plan.total} palette={palette} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ Enchaînement de 15 s ------------------------------------------------------------------ */

type ItemEnch = {
  cle: string;
  genre: "etiq" | "carte";
  el?: IdElementLot2;
  t0: number;
  t1: number;
  mots: string;
  forts: number[];
  chiffres?: number[];
  /** Pour les cartes : indices de mots (ou { mot, plus } = mot + images) des déclencheurs. */
  decl?: (number | { mot: number; plus: number })[];
  textes?: string[];
  changeMot?: number;
  blanc?: boolean;
  inclinaison?: number;
  extra?: Record<string, unknown>;
};

/** Plan de l'enchaînement : 8 cartes (dont M3), 5 étiquettes de remplissage, jamais plus de 2 cartes de suite. */
export const PLAN_ENCH: ItemEnch[] = [
  { cle: "e1", genre: "etiq", t0: 0, t1: 0.75, mots: "vos relances vos devis", forts: [], textes: ["VOS RELANCES", "VOS DEVIS"], changeMot: 2, inclinaison: -3 },
  { cle: "c1", genre: "carte", el: "carte-checklist", t0: 0.75, t1: 2.35, mots: "automatisé devis rendez-vous factures", forts: [0], decl: [1, 2, 3], extra: { lignes: ["Les devis", "Les rendez-vous", "Les factures"] } },
  { cle: "e2", genre: "etiq", t0: 2.35, t1: 3.05, mots: "et tout seul", forts: [], textes: ["TOUT SEUL"], blanc: true, inclinaison: 2 },
  { cle: "c2", genre: "carte", el: "carte-commande", t0: 3.05, t1: 4.7, mots: "une seule commande relance envoyée", forts: [], decl: [0, 2, 3, 4, { mot: 4, plus: 7 }], extra: { reponse: "Relance envoyée" } },
  { cle: "c3", genre: "carte", el: "carte-commentaire", t0: 4.7, t1: 6.2, mots: "commentez relance vous recevez le guide", forts: [0], decl: [1, 3, 5] },
  { cle: "e3", genre: "etiq", t0: 6.2, t1: 6.9, mots: "pendant ce temps", forts: [], textes: ["PENDANT CE TEMPS"], inclinaison: -4 },
  { cle: "c4", genre: "carte", el: "carte-statuts", t0: 6.9, t1: 8.35, mots: "il trie il écrit il envoie", forts: [], decl: [0, 2, 4] },
  { cle: "c5", genre: "carte", el: "graphique-barres", t0: 8.35, t1: 9.85, mots: "le taux de réponse doublé deux fois", forts: [4], chiffres: [5], decl: [1, 4, 5] },
  { cle: "e4", genre: "etiq", t0: 9.85, t1: 10.5, mots: "et sans effort", forts: [], textes: ["SANS EFFORT"], blanc: true, inclinaison: 3 },
  { cle: "c6", genre: "carte", el: "carte-calendrier", t0: 10.5, t1: 11.85, mots: "vos rendez-vous se calent tout seuls", forts: [1, 5], decl: [1, 4] },
  { cle: "c7", genre: "carte", el: "carte-comparaison", t0: 11.85, t1: 13.1, mots: "agence des mois agents une heure", forts: [], decl: [0, 3, 5] },
  { cle: "e5", genre: "etiq", t0: 13.1, t1: 13.7, mots: "au final", forts: [], textes: ["AU FINAL"], inclinaison: -3 },
  { cle: "c8", genre: "carte", el: "frise-etapes", t0: 13.7, t1: 15.0, mots: "demande devis relance signature", forts: [], decl: [0, 1, 2, 3], extra: { etapes: ["La demande", "Le devis", "La relance", "La signature"], badge: "SIGNÉ" } },
];

export type ItemCalcule = ItemEnch & { de: number; duree: number; mots2: Mot[]; declF: number[]; D: number };
export function calculerEnchainement(): { items: ItemCalcule[]; mots: Mot[] } {
  const items: ItemCalcule[] = PLAN_ENCH.map((it) => {
    const de = Math.round(it.t0 * FPS);
    const fin = Math.round(it.t1 * FPS);
    const liste = it.mots.split(/\s+/);
    const a = it.genre === "carte" ? it.t0 + 0.1 : it.t0 + 0.04;
    const b = it.genre === "carte" ? it.t1 - 0.55 : it.t1 - 0.08;
    const mots2 = motsRepartis(liste, a, b, it.forts, it.chiffres);
    const declF = (it.decl ?? []).map((d) => (typeof d === "number" ? Math.round(mots2[d].debut * FPS) - de : Math.round(mots2[d.mot].debut * FPS) - de + d.plus));
    return { ...it, de, duree: fin - de, mots2, declF, D: it.genre === "etiq" ? DESCENTE.D1 : it.el === "frise-etapes" ? DESCENTE.D3 : DESCENTE.D2 };
  });
  return { items, mots: items.flatMap((i) => i.mots2) };
}

export function EnchainementLot2({ palette }: { palette: Palette }) {
  chargerPolicesV4();
  REGLAGE_SONS.facteur = 0.5;
  const frame = useCurrentFrame();
  const { items, mots } = React.useMemo(calculerEnchainement, []);
  const changements = React.useMemo(() => changementsDescente(items.map((i) => ({ de: i.de, fin: i.de + i.duree, D: i.D }))), [items]);
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Prise D={valeurD(frame, changements)} depuis={0} />
      {items.map((it) => (
        <Sequence key={it.cle} from={it.de} durationInFrames={it.duree} layout="none">
          {it.genre === "etiq" ? (
            <EtiquetteChoix it={it} palette={palette} />
          ) : (
            <Element id={it.el as IdElementLot2} palette={palette} decl={it.declF} duree={it.duree} avecSons extra={it.extra} />
          )}
        </Sequence>
      ))}
      <SousTitresV4
        mots={mots}
        frame={frame}
        palette={palette}
        y={(f) => {
          const d = valeurD(f, changements);
          const actif = [...items].reverse().find((it) => it.de <= f);
          const ybas = !actif || actif.genre === "etiq" ? null : actif.el === "frise-etapes" ? Y_SOUS_CARTE.M3 : Y_SOUS_CARTE.M2;
          const y = ySousTitresReel(d, ybas);
          verifierYeux(f, y, d);
          return y;
        }}
      />
      <BarreProgression frame={frame} total={450} palette={palette} />
    </AbsoluteFill>
  );
}

function EtiquetteChoix({ it, palette }: { it: ItemCalcule; palette: Palette }) {
  const i = useCurrentFrame();
  const change = it.changeMot !== undefined ? Math.round(it.mots2[it.changeMot].debut * FPS) - it.de : undefined;
  return <EtiquetteTete palette={palette} textes={it.textes ?? []} changes={change !== undefined ? [0, change] : [0]} i={i} duree={it.duree} blanc={it.blanc} inclinaison={it.inclinaison} avecSons />;
}

/* ------------------------------------------------------------------ Racine ------------------------------------------------------------------ */

export function RacinePlancheLot2() {
  return (
    <>
      <Composition
        id="ExtraitLot2"
        component={ExtraitLot2}
        durationInFrames={120}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ element: "carte-checklist" as IdElementLot2, palette: "B" as Palette, fond: "prise" as FondTest }}
        calculateMetadata={({ props }) => ({ durationInFrames: planExtrait(props.element).total })}
      />
      <Composition id="EnchainementLot2" component={EnchainementLot2} durationInFrames={450} fps={FPS} width={1080} height={1920} defaultProps={{ palette: "B" as Palette }} />
    </>
  );
}
