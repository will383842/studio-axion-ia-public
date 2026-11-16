"use client";

/**
 * G15-03 · « Enregistrer mon écran » dans le navigateur : `getDisplayMedia` + `MediaRecorder`, aperçu, arrêt.
 * L'avertissement est affiché AVANT le bouton « Commencer ». Rend la prise par `onTermine(blob)`, une seule fois.
 * Composant neuf, monté nulle part ; rien n'est envoyé, rien n'est rangé : c'est à l'appelant de décider du Blob.
 */
import { useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";

export const AVERTISSEMENT_ECRAN = "Fermez vos messages et vos mots de passe : tout ce qui est à l'écran sera filmé.";
const PHRASE_NON_PRISE_EN_CHARGE = "L'enregistrement d'écran n'est pas possible sur ce navigateur. Essayez avec Chrome, Edge ou Firefox sur un ordinateur.";
const PHRASE_REFUS = "Le partage d'écran a été refusé : rien n'est filmé. Vous pouvez réessayer quand vous voulez.";
const PHRASE_ECHEC = "L'enregistrement de l'écran n'a pas pu démarrer. Vous pouvez réessayer.";

type Phase = "avertissement" | "enregistre" | "termine";

function choisirFormat(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidats = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidats.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

export function EnregistreurEcran({ onTermine }: { onTermine: (prise: Blob) => void }) {
  const [phase, setPhase] = useState<Phase>("avertissement");
  const [message, setMessage] = useState<string | null>(null);
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const enreg = useRef<MediaRecorder | null>(null);
  const fluxCourant = useRef<MediaStream | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const rendu = useRef(false);
  const apercuCourant = useRef<string | null>(null);

  const fermerFlux = () => {
    fluxCourant.current?.getTracks().forEach((t) => t.stop());
    fluxCourant.current = null;
    setFlux(null);
  };

  // En quittant : le partage est refermé, l'aperçu libéré.
  useEffect(
    () => () => {
      fluxCourant.current?.getTracks().forEach((t) => t.stop());
      if (apercuCourant.current) URL.revokeObjectURL(apercuCourant.current);
    },
    [],
  );

  const commencer = async () => {
    setMessage(null);
    const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!md || typeof md.getDisplayMedia !== "function" || typeof MediaRecorder === "undefined") {
      setMessage(PHRASE_NON_PRISE_EN_CHARGE);
      return;
    }
    let f: MediaStream;
    try {
      f = await md.getDisplayMedia({ video: true, audio: false });
    } catch (e) {
      const nom = (e as { name?: string } | null)?.name;
      setMessage(nom === "NotAllowedError" || nom === "AbortError" || nom === "SecurityError" ? PHRASE_REFUS : PHRASE_ECHEC);
      return;
    }
    try {
      const mime = choisirFormat();
      const r = new MediaRecorder(f, mime ? { mimeType: mime } : undefined);
      morceaux.current = [];
      rendu.current = false;
      r.ondataavailable = (e) => {
        if (e.data?.size) morceaux.current.push(e.data);
      };
      r.onstop = () => {
        fermerFlux();
        enreg.current = null;
        if (rendu.current) return;
        rendu.current = true;
        const blob = new Blob(morceaux.current, { type: r.mimeType || mime || "video/webm" });
        const url = URL.createObjectURL(blob);
        apercuCourant.current = url;
        setApercu(url);
        setPhase("termine");
        onTermine(blob);
      };
      // Le bouton « Arrêter le partage » du navigateur arrête aussi la prise.
      f.getVideoTracks?.().forEach((t) => {
        t.onended = () => {
          if (enreg.current && enreg.current.state !== "inactive") enreg.current.stop();
        };
      });
      fluxCourant.current = f;
      enreg.current = r;
      r.start(1000);
      setFlux(f);
      setPhase("enregistre");
    } catch {
      f.getTracks().forEach((t) => t.stop());
      setMessage(PHRASE_ECHEC);
    }
  };

  const arreter = () => {
    const r = enreg.current;
    if (r && r.state !== "inactive") r.stop();
  };

  const recommencer = () => {
    if (apercuCourant.current) URL.revokeObjectURL(apercuCourant.current);
    apercuCourant.current = null;
    setApercu(null);
    setMessage(null);
    setPhase("avertissement");
  };

  return (
    <section aria-label="Enregistrer mon écran" className="space-y-4 rounded-2xl bg-ecran p-5 text-ecran-texte">
      {phase === "avertissement" && (
        <>
          <p role="note" className="flex items-start gap-2 text-lg font-semibold">
            <Icone nom="alerte" size={22} className="mt-0.5 shrink-0" />
            <span>{AVERTISSEMENT_ECRAN}</span>
          </p>
          {message && (
            <p role="alert" className="text-sm font-semibold">
              {message}
            </p>
          )}
          <Bouton taille="lg" icone="ecran-partage" onClick={commencer}>
            Commencer
          </Bouton>
        </>
      )}

      {phase === "enregistre" && (
        <>
          <video
            ref={(el) => {
              if (el && flux && el.srcObject !== flux) el.srcObject = flux;
            }}
            autoPlay
            muted
            playsInline
            aria-label="Aperçu de votre écran"
            className="aspect-video w-full rounded-xl bg-black object-contain"
          />
          <Bouton variante="danger" taille="lg" onClick={arreter} aria-label="Arrêter">
            Arrêter
          </Bouton>
        </>
      )}

      {phase === "termine" && (
        <>
          {apercu && <video src={apercu} controls playsInline aria-label="Relecture de la prise" className="aspect-video w-full rounded-xl bg-black object-contain" />}
          <Bouton variante="secondaire" icone="reessayer" onClick={recommencer}>
            Recommencer
          </Bouton>
        </>
      )}
    </section>
  );
}
