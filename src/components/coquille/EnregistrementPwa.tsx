"use client";

import { useCallback, useEffect, useState } from "react";

/** Clé publique VAPID (base64 url) → octets attendus par `pushManager.subscribe`. */
function versOctets(base64: string): Uint8Array<ArrayBuffer> {
  const complete = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(complete);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/** Clé publique donnée par le studio (null : notifications pas proposées). */
async function lireCle(): Promise<string | null> {
  try {
    const r = await fetch("/api/notifications/abonnement", { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { cle: string | null }).cle;
  } catch {
    return null;
  }
}

/** L'abonnement de CET appareil est-il actif côté studio ? (adresse connue du navigateur, réponse oui/non) */
async function cetAppareilActif(): Promise<boolean> {
  try {
    const existant = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!existant) return false;
    const r = await fetch("/api/notifications/abonnement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ verifier: existant.endpoint }) });
    return r.ok && ((await r.json()) as { actif?: boolean }).actif === true;
  } catch {
    return false;
  }
}

/**
 * Transmet l'abonnement de cet appareil. `neuf` (geste de Will) : l'ancien abonnement est abandonné et un neuf est
 * demandé — c'est ce qui répare un abonnement que le service du navigateur a refusé (le studio ne le ranime jamais).
 */
async function abonner(cle: string, neuf: boolean): Promise<boolean> {
  const enregistrement = await navigator.serviceWorker.ready;
  const existant = await enregistrement.pushManager.getSubscription();
  if (existant && neuf) await existant.unsubscribe().catch(() => false);
  const abonnement = (!neuf && existant) || (await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(cle) }));
  const r = await fetch("/api/notifications/abonnement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ abonnement: abonnement.toJSON() }) });
  return r.ok;
}

function pushPossible(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Enregistre le service de cache (page hors ligne, notifications). Production seulement.
 * Si Will a déjà autorisé les notifications sur cet appareil, l'abonnement est (re)transmis au studio sans rien demander.
 */
export function EnregistrementPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async () => {
        if (!pushPossible() || Notification.permission !== "granted") return;
        const cle = await lireCle();
        if (cle) await abonner(cle, false);
      })
      .catch(() => undefined);
  }, []);
  return null;
}

/**
 * État des notifications sur CET appareil (lot M1b, précisé au lot R3) :
 * - « indisponible » : développement (le service de cache n'est enregistré qu'en production) ;
 * - « ecran-accueil » : iPhone ou iPad ouvert dans Safari. Apple n'autorise les notifications d'un site que depuis
 *   l'application ajoutée à l'écran d'accueil (iOS 16.4 ou plus récent) ;
 * - « navigateur » : ce navigateur ne sait pas recevoir de notifications ;
 * - « serveur » : le studio ne propose pas encore les notifications (réglage absent ou carte en simulation) ;
 * - « a-activer », « actives », « refusees » : selon l'autorisation donnée sur cet appareil ET son abonnement chez le studio.
 */
export type EtatNotificationsTelephone = "indisponible" | "ecran-accueil" | "navigateur" | "serveur" | "a-activer" | "actives" | "refusees";

interface Appareil {
  production: boolean;
  ios: boolean;
  installe: boolean;
  pushPossible: boolean;
}

/** Ce que l'on sait SANS demander au studio (PUR) : null quand il faut sa réponse pour conclure. */
export function etatAppareil(a: Appareil): "indisponible" | "ecran-accueil" | "navigateur" | null {
  if (!a.production) return "indisponible";
  if (a.ios && !a.installe) return "ecran-accueil";
  if (!a.pushPossible) return "navigateur";
  return null;
}

/**
 * Décision PURE (testée) de l'état du téléphone. Autorisation donnée mais l'abonnement de CET appareil n'est pas actif
 * chez le studio (refusé puis marqué expiré, ou jamais transmis) : « a-activer », pour que le bouton revienne et le
 * répare — même si un autre appareil reste actif.
 */
export function etatTelephone(e: Appareil & { cle: string | null; cetAppareilActif: boolean; permission: NotificationPermission | null }): EtatNotificationsTelephone {
  const appareil = etatAppareil(e);
  if (appareil) return appareil;
  if (!e.cle) return "serveur";
  if (e.permission === "denied") return "refusees";
  if (e.permission === "granted" && e.cetAppareilActif) return "actives";
  return "a-activer";
}

/** iPhone, iPod ou iPad (l'iPad récent se présente comme un Mac tactile). */
function estIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Ouvert depuis l'icône de l'écran d'accueil (application installée). */
function estInstalle(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Notifications sur ce téléphone : état et activation (sur un geste de Will : obligatoire sur iPhone).
 */
export function useNotificationsTelephone() {
  // « verification » : premier affichage, avant de connaître l'appareil (rien ne clignote).
  const [etat, setEtat] = useState<EtatNotificationsTelephone | "verification">("verification");
  const [cle, setCle] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    const appareil: Appareil = { production: process.env.NODE_ENV === "production", ios: estIos(), installe: estInstalle(), pushPossible: pushPossible() };
    const sansStudio = etatAppareil(appareil);
    if (sansStudio) {
      queueMicrotask(() => !annule && setEtat(sansStudio));
    } else {
      void (async () => {
        const c = await lireCle();
        const permission = Notification.permission;
        const actif = !!c && permission === "granted" && (await cetAppareilActif());
        if (annule) return;
        setCle(c);
        setEtat(etatTelephone({ ...appareil, cle: c, cetAppareilActif: actif, permission }));
      })();
    }
    return () => {
      annule = true;
    };
  }, []);

  const activer = useCallback(async (): Promise<boolean> => {
    if (!cle) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setEtat(permission === "denied" ? "refusees" : "a-activer");
      return false;
    }
    const ok = await abonner(cle, true).catch(() => false);
    setEtat(ok ? "actives" : "a-activer");
    return ok;
  }, [cle]);

  return { etat, activer };
}
