"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifier } from "@/components/ui";
import type { Montant } from "@/domaine/types";
import type { Resultat } from "@/services/_commun";

export interface ResultatEcoute {
  url: string;
  dureeSec: number;
  cout: Montant;
  simulee: boolean;
  voix?: string;
}

/**
 * Lecture d'un son court (une seule à la fois sur la page) : `jouer(cle, demande)` lance la demande au serveur puis lit
 * le son ; un même son déjà fabriqué est relu sans repayer. `enCours` = clé en préparation, `joue` = clé qui se lit.
 */
export function useEcoute() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const deja = useRef(new Map<string, ResultatEcoute>());
  const [enCours, setEnCours] = useState<string | null>(null);
  const [joue, setJoue] = useState<string | null>(null);
  const [dernier, setDernier] = useState<ResultatEcoute | null>(null);

  useEffect(() => {
    return () => {
      audio.current?.pause();
      audio.current = null;
    };
  }, []);

  const arreter = useCallback(() => {
    audio.current?.pause();
    setJoue(null);
  }, []);

  const lire = useCallback((cle: string, r: ResultatEcoute) => {
    audio.current?.pause();
    if (!r.url) return void notifier.erreur("Ce son n'est pas disponible.");
    const a = new Audio(r.url);
    audio.current = a;
    a.onended = () => setJoue((j) => (j === cle ? null : j));
    a.onpause = () => setJoue((j) => (j === cle ? null : j));
    a.onerror = () => {
      setJoue(null);
      notifier.erreur("Le son ne se lit pas. Réessayez dans un instant.");
    };
    setJoue(cle);
    void a.play().catch(() => setJoue(null));
  }, []);

  const jouer = useCallback(
    async (cle: string, demande: () => Promise<Resultat<ResultatEcoute>>): Promise<ResultatEcoute | null> => {
      if (joue === cle) {
        arreter();
        return null;
      }
      const connu = deja.current.get(cle);
      if (connu) {
        lire(cle, connu);
        return connu;
      }
      setEnCours(cle);
      const r = await demande();
      setEnCours(null);
      if (!r.ok) {
        notifier.erreur(r.message);
        return null;
      }
      deja.current.set(cle, r.donnees);
      setDernier(r.donnees);
      lire(cle, r.donnees);
      return r.donnees;
    },
    [arreter, joue, lire],
  );

  /** Lit une adresse déjà connue (aperçu d'une voix). */
  const jouerAdresse = useCallback(
    (cle: string, url: string) => {
      if (joue === cle) return arreter();
      lire(cle, { url, dureeSec: 0, cout: { centimes: 0, devise: "EUR" }, simulee: false });
    },
    [arreter, joue, lire],
  );

  return { jouer, jouerAdresse, arreter, enCours, joue, dernier };
}
