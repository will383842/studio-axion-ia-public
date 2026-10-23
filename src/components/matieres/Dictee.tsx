"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Icone } from "@/components/ui";
import { cn } from "@/lib/cn";

/* Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : types minimaux, l'API n'est pas dans le DOM standard. */
interface ResultatVocal {
  isFinal: boolean;
  0: { transcript: string };
}
interface EvenementVocal {
  resultIndex: number;
  results: ArrayLike<ResultatVocal>;
}
interface Reconnaissance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EvenementVocal) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstructeurReconnaissance = new () => Reconnaissance;

function constructeur(): ConstructeurReconnaissance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictée : la reconnaissance du navigateur si elle existe ; sinon le micro du clavier (on donne le focus au champ).
 * Le texte reconnu est AJOUTÉ tel quel à la fin du champ ; rien n'est réécrit.
 */
export function useDictee(ajouter: (texte: string) => void, champ?: RefObject<HTMLTextAreaElement | null>) {
  const [ecoute, setEcoute] = useState(false);
  const reco = useRef<Reconnaissance | null>(null);
  const rappel = useRef(ajouter);
  useEffect(() => {
    rappel.current = ajouter;
  }, [ajouter]);
  useEffect(() => () => reco.current?.stop(), []);

  function arreter() {
    reco.current?.stop();
    setEcoute(false);
  }

  function demarrer() {
    const C = constructeur();
    if (!C) {
      champ?.current?.focus();
      return;
    }
    const r = new C();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) rappel.current(e.results[i][0].transcript.trim());
    };
    r.onend = () => setEcoute(false);
    r.onerror = () => setEcoute(false);
    reco.current = r;
    r.start();
    setEcoute(true);
  }

  return { ecoute, demarrer, arreter, basculer: ecoute ? arreter : demarrer };
}

/** Ajoute un morceau dicté à un texte (un blanc entre les deux, jamais d'autre changement). */
export function ajouterDicte(avant: string, morceau: string): string {
  if (!morceau) return avant;
  if (!avant.trim()) return morceau;
  return /\s$/.test(avant) ? avant + morceau : `${avant} ${morceau}`;
}

/**
 * Mention discrète pendant l'écoute : le son est traité par la dictée du téléphone (sous Chrome, chez Google ; sur
 * iPhone, chez Apple), pas par le studio. Les noms sensibles se gardent à part, comme avant.
 */
export const MENTION_DICTEE = "Dictée de votre téléphone";

/** Gros bouton micro, comme sur la carte « Il manque une matière ». */
export function BoutonMicro({ ecoute, onClick, taille = "lg", libelle }: { ecoute: boolean; onClick: () => void; taille?: "md" | "lg"; libelle?: string }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-pressed={ecoute}
        onClick={onClick}
        aria-label={ecoute ? "Arrêter la dictée" : "Dicter"}
        className={cn(
          "relative grid place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition-transform active:scale-95",
          taille === "lg" ? "size-20" : "size-14",
          ecoute && "bg-brique",
        )}
      >
        {ecoute && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brique/40" />}
        <Icone nom="micro" size={taille === "lg" ? 32 : 24} />
      </button>
      {libelle !== "" && <p className="mt-2 text-sm font-semibold text-texte">{ecoute ? "Je vous écoute…" : (libelle ?? "Dicter")}</p>}
      {/* Vérification E2E-1 n° 12 : la reconnaissance vocale est celle du téléphone (ou du navigateur), pas du studio. */}
      {ecoute && <p className="mt-0.5 text-xs text-texte-faible">{MENTION_DICTEE}</p>}
    </div>
  );
}
