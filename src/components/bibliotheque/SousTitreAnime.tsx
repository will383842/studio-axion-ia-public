"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cssElement, donneesCalque, fabriquerSousTitres, gabaritDe, sceneAuTemps, type NomPolice } from "@/briques/sous-titres";
import { COULEURS_REPLI, type CouleursSousTitres } from "@/briques/sous-titres/style";
import type { IntensiteSousTitres, SegmentSousTitres } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { lireJeton, type ValeurSousTitres } from "./outils";
import { chargerPolicesSousTitres, FAMILLES_SOUS_TITRES } from "./polices-sous-titres";

// Les MÊMES fichiers de police que le rendu Remotion (aucune dépendance réseau, licence SIL OFL 1.1).
const FAMILLES: Record<NomPolice, string> = FAMILLES_SOUS_TITRES;

const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels. 35 heures pour tout vérifier.";
const EN_VALEUR = ["mails", "jamais", "personnels."];
const LARGEUR = 1080;
const PAUSE_FIN_SEC = 0.8;

/**
 * Aperçu animé d'un style de sous-titres (Bibliothèque, Style) : le MÊME moteur de rendu que la vidéo
 * (`briques/sous-titres/scene.ts`), mis à l'échelle du cadre. Un style d'accent (Impact, Bandeau) est montré seul ;
 * un style de base l'est avec le mélange de l'intensité choisie.
 */
export function SousTitreAnime({ style, phrase = PHRASE, intensite = "equilibre", className }: { style: ValeurSousTitres; phrase?: string; intensite?: IntensiteSousTitres; className?: string }) {
  const reduit = useReducedMotion();
  const cadre = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ l: 0, h: 0 });
  const [t, setT] = useState(1.2);
  const gabarit = gabaritDe(style);
  const base = gabarit === "minimal" ? "minimal" : "karaoke";
  const accent = gabarit === "impact" || gabarit === "bandeau";

  const segments = useMemo<SegmentSousTitres[]>(() => {
    const brut = fabriquerSousTitres({ texte: phrase, dureeSec: phrase.split(/\s+/).length / 4.4, emphase: EN_VALEUR, style, base, intensite: accent ? "sobre" : intensite });
    // Un élément Impact ou Bandeau : chaque groupe dans ce style (pour juger le style lui-même).
    return accent ? brut.map((s) => ({ ...s, style: gabarit === "impact" ? "impact" : "bandeau", importance: 3, position: "milieu", inclinaison: gabarit === "impact" ? 4 : 0 })) : brut;
  }, [phrase, style, base, gabarit, accent, intensite]);
  const duree = (segments.at(-1)?.finSec ?? 0) + PAUSE_FIN_SEC;

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const mesurer = () => setTaille({ l: el.clientWidth, h: el.clientHeight });
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reduit) return;
    let image = 0;
    const depart = performance.now();
    const tour = (maintenant: number) => {
      setT(((maintenant - depart) / 1000) % duree);
      image = requestAnimationFrame(tour);
    };
    image = requestAnimationFrame(tour);
    return () => cancelAnimationFrame(image);
  }, [reduit, duree]);

  // Polices chargées une fois par page (mêmes fichiers que le rendu).
  useEffect(() => {
    void chargerPolicesSousTitres();
  }, []);
  const echelle = taille.l ? taille.l / LARGEUR : 0;
  // Couleurs lues dans les JETONS de la marque (globals.css), jamais écrites dans le composant (lues une fois le
  // cadre mesuré, donc côté navigateur seulement).
  const mesure = echelle > 0;
  const couleurs = useMemo<CouleursSousTitres>(
    () =>
      mesure
        ? { texte: lireJeton("texte") || COULEURS_REPLI.texte, accent: lireJeton(style.jetonEmphase ?? "orange-vif") || COULEURS_REPLI.accent, contour: lireJeton("fond") || COULEURS_REPLI.contour }
        : COULEURS_REPLI,
    [mesure, style.jetonEmphase],
  );
  const hauteur = echelle ? taille.h / echelle : 1920;
  const donnees = useMemo(() => ({ ...donneesCalque({ segments, base, style, couleurs }), hauteur }), [segments, base, style, couleurs, hauteur]);
  const instant = reduit ? (segments[1]?.debutSec ?? 0) + 0.3 : t;
  const el = echelle ? sceneAuTemps(donnees, instant) : null;
  const css = el ? cssElement(el, donnees, FAMILLES[el.police]) : null;

  return (
    <div ref={cadre} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {el && css && (
        <div style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: hauteur, transform: `scale(${echelle})`, transformOrigin: "0 0" }}>
          <div style={css.conteneur}>
            <div style={css.ligne}>
              {el.mots.map((m, i) => (
                <span key={i} style={css.mot(i)}>
                  {m.texte}
                  {m.souligne > 0 && <span style={css.trait(i)} />}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
