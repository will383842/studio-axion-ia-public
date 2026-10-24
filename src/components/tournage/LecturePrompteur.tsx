"use client";

/**
 * « LECTURE » plein écran pour iPad / Safari : gros texte blanc sur noir, défilement réglable en vitesse, miroir
 * optionnel (iPad posé sous une vitre de téléprompteur). Le texte vient du fragment du lien (`texteDepuisLien`).
 * Un toucher sur le texte lance ou met en pause. Aucune dépendance, aucun appel réseau.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { defilementPx, fermetureLecture, LIEN_FERMETURE_LECTURE, PAUSE, texteDepuisLien, VITESSE_DEFAUT, VITESSE_MAX, VITESSE_MIN } from "@/domaine/teleprompteur";

const TAILLE_MIN = 28;
const TAILLE_MAX = 96;

function sabonner(rappel: () => void) {
  window.addEventListener("hashchange", rappel);
  return () => window.removeEventListener("hashchange", rappel);
}
const fragment = () => window.location.hash;

export function LecturePrompteur() {
  const hash = useSyncExternalStore(sabonner, fragment, () => "");
  const { texte, titre } = texteDepuisLien(hash);
  const [lecture, setLecture] = useState(false);
  const [vitesse, setVitesse] = useState(VITESSE_DEFAUT);
  const [taille, setTaille] = useState(56);
  const [miroir, setMiroir] = useState(false);
  const routeur = useRouter();

  /** Historique : retour. Onglet ouvert seul : on le ferme, et s'il reste ouvert on revient à l'assistant. */
  function fermer() {
    if (fermetureLecture(window.history.length) === "retour") return routeur.back();
    window.close();
    setTimeout(() => {
      if (!window.closed) routeur.push(LIEN_FERMETURE_LECTURE);
    }, 150);
  }
  const zone = useRef<HTMLDivElement>(null);
  const vitesseRef = useRef(vitesse);
  useEffect(() => {
    vitesseRef.current = vitesse;
  }, [vitesse]);

  // Défilement : Safari arrondit `scrollTop`, on cumule donc les fractions de pixel.
  useEffect(() => {
    if (!lecture) return;
    let image = 0;
    let avant = performance.now();
    let reste = 0;
    const pas = (maintenant: number) => {
      const el = zone.current;
      if (el) {
        reste += defilementPx(vitesseRef.current, maintenant - avant);
        const entier = Math.floor(reste);
        if (entier > 0) {
          el.scrollTop += entier;
          reste -= entier;
        }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return setLecture(false);
      }
      avant = maintenant;
      image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [lecture]);

  function debut() {
    zone.current?.scrollTo({ top: 0 });
    setLecture(false);
  }

  const paragraphes = texte.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-fond text-texte">
      <div
        ref={zone}
        onClick={() => setLecture((l) => !l)}
        className="min-h-0 flex-1 cursor-pointer overflow-y-auto px-[6vw] py-[40vh]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {paragraphes.length === 0 ? (
          <p className="text-center text-2xl text-texte">Aucun texte à lire. Ouvrez cette page depuis « {titre || "Lire sur l'iPad"} » de l&apos;écran du texte.</p>
        ) : (
          <div style={{ transform: miroir ? "scaleX(-1)" : undefined, fontSize: taille, lineHeight: 1.35 }} className="mx-auto max-w-[1100px] font-bold">
            {paragraphes.map((p, i) =>
              p === PAUSE ? (
                <p key={i} className="my-[0.8em] text-center text-[0.5em] font-semibold uppercase tracking-widest text-ambre">
                  — pause —
                </p>
              ) : (
                <p key={i} className="mb-[0.9em] text-texte">
                  {p}
                </p>
              ),
            )}
          </div>
        )}
      </div>

      <div role="group" aria-label="Réglages de lecture" className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-trait-fort bg-fond px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => setLecture((l) => !l)} className="min-h-12 min-w-28 rounded-full bg-texte px-5 text-lg font-bold text-fond">
          {lecture ? "Pause" : "Lecture"}
        </button>
        <button type="button" onClick={debut} className="min-h-12 rounded-full border border-texte px-4 text-base font-semibold text-texte">
          Début
        </button>
        <label className="flex items-center gap-2 text-base font-semibold text-texte">
          Vitesse
          <input type="range" min={VITESSE_MIN} max={VITESSE_MAX} step={1} value={vitesse} onChange={(e) => setVitesse(Number(e.target.value))} className="h-8 w-36 accent-ambre" />
          <span className="w-5 tabular-nums">{vitesse}</span>
        </label>
        <label className="flex items-center gap-2 text-base font-semibold text-texte">
          Taille
          <input type="range" min={TAILLE_MIN} max={TAILLE_MAX} step={4} value={taille} onChange={(e) => setTaille(Number(e.target.value))} className="h-8 w-28 accent-ambre" />
        </label>
        <label className="flex min-h-12 items-center gap-2 text-base font-semibold text-texte">
          <input type="checkbox" checked={miroir} onChange={(e) => setMiroir(e.target.checked)} className="size-6 accent-ambre" />
          Miroir
        </label>
        <button
          type="button"
          onClick={fermer}
          className="ml-auto min-h-12 content-center rounded-full border border-texte px-4 text-base font-semibold text-texte"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
