"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { OrigineBrouillon } from "@/app/(studio)/nouvelle/[format]/actions";
import { creerBrouillonAction, enregistrerBrouillonAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import type { DonneesBrouillon } from "@/services/videos";
import { obtenirFormat } from "@/formats";
import { cn } from "@/lib/cn";
import { ETAPES_EXPRESS, META_ETAPES, type CleEtape } from "./etapes/meta";
import { etapesDuFormat } from "./etapes/registre";
import type { BrouillonAssistant, ContexteAssistant, DonneesAssistant } from "./etapes/types";
import { useEnregistrementDiffere } from "./express/useEnregistrementDiffere";

/** Champs purement CLIENT : les changer ne déclenche aucun enregistrement. */
const CHAMPS_CLIENT = new Set<keyof BrouillonAssistant>(["versions", "versionChoisie", "notes", "travailId", "videoId"]);

/** Ce qui part en base à chaque étape (jamais l'état purement client). */
function versDonnees(b: BrouillonAssistant, etape: CleEtape): DonneesBrouillon {
  return {
    // Titre absent = il suit le sujet (modifierBrouillon) ; ne jamais envoyer un titre vide.
    ...(b.titre.trim() ? { titre: b.titre.trim() } : {}),
    sujet: b.sujet.trim(),
    dureeCibleSec: b.dureeCibleSec,
    ratios: b.ratios,
    distribution: b.distribution,
    entrees: b.entrees,
    reglages: b.reglages,
    styles: b.styles,
    briquesCoupees: b.briquesCoupees,
    briquesAllumees: b.briquesAllumees,
    // La mention vient du réglage lu par la page (jamais d'une constante qui l'écraserait, bug corrigé B.0 §1).
    mentionIA: b.mentionIA,
    adresse: b.adresse,
    ...(b.posture ? { posture: b.posture } : {}),
    // Script choisi dans « Mes scripts » : il devient celui de la vidéo sans être réécrit (lot M3).
    ...(b.scriptId ? { scriptId: b.scriptId } : {}),
    etapeAssistant: etape,
  };
}

/**
 * COQUILLE DE L'ASSISTANT (B.8 #4, AV2.4-5).
 * - étapes générées depuis le format (bibliothèque d'étapes) ;
 * - brouillon ENREGISTRÉ à chaque passage d'étape (création au premier passage, URL ?brouillon=) ;
 * - étapes repliées en une ligne quand tout a une valeur par défaut (« Modifier » pour déplier) ;
 * - saut direct (« Fabriquer avec les réglages habituels ») : s'arrête sur la première étape incomplète.
 * Parcours le plus court depuis l'accueil : Nouvelle vidéo → format → Continuer → Fabriquer avec les réglages habituels → Fabriquer (5 touches, 6 avec la confirmation de coût).
 */
export function Assistant({
  initial,
  etapeInitiale,
  origine,
  donnees,
  recents,
}: {
  initial: BrouillonAssistant;
  etapeInitiale?: CleEtape;
  origine: OrigineBrouillon;
  donnees: DonneesAssistant;
  /** Vidéos récentes du format (serveur), affichées sous l'écran « Votre vidéo » seulement ; absentes quand on reprend un brouillon. */
  recents?: ReactNode;
}) {
  const format = obtenirFormat(initial.formatId);
  const etapes = useMemo(() => etapesDuFormat(initial.formatId), [initial.formatId]);
  const [brouillon, setBrouillon] = useState(initial);
  const reference = useRef(initial);
  const [index, setIndex] = useState(Math.max(0, etapes.findIndex((e) => e.cle === etapeInitiale)));
  const [deplies, setDeplies] = useState<Set<CleEtape>>(new Set());
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistreLe, setEnregistreLe] = useState<Date | null>(initial.videoId ? new Date() : null);
  // Texte déjà en base : on ne le réécrit que s'il a changé (un script ouvert depuis « Écrire » n'est pas modifié pour rien).
  // Un texte sans script (une version du générateur revenue par « Utiliser dans ma vidéo », B1) n'est pas encore en base.
  const dernierTexte = useRef(initial.scriptId ? JSON.stringify(initial.blocs) : "");
  // Une vraie saisie de Will (E2E-1 n° 6) : avant, rien ne crée de brouillon de soi-même.
  const saisie = useRef(!!initial.videoId);
  // B1 : le texte d'une version est repris une fois ; l'adresse ne le garde pas (un rechargement ne l'imposerait pas de nouveau).
  useEffect(() => {
    const u = new URL(window.location.href);
    if (!u.searchParams.has("variante")) return;
    u.searchParams.delete("variante");
    window.history.replaceState(null, "", `${u.pathname}${u.search}`);
  }, []);
  const courante = etapes[index];
  const meta = META_ETAPES[courante.cle];

  const modifier = useCallback((patch: Partial<BrouillonAssistant>) => {
    reference.current = { ...reference.current, ...patch };
    setBrouillon(reference.current);
  }, []);

  const enregistrerVers = useCallback(
    async (etape: CleEtape): Promise<string | null> => {
      let b = reference.current;
      let id = b.videoId;
      if (!id) {
        const r = await creerBrouillonAction(b.formatId, origine);
        if (!r.ok) {
          notifier.erreur(r.message);
          return null;
        }
        id = r.donnees;
        modifier({ videoId: id });
        b = reference.current;
        window.history.replaceState(null, "", `/nouvelle/${b.formatId}?brouillon=${id}`);
      }
      const texte = JSON.stringify(b.blocs);
      const blocs = b.blocs.length && texte !== dernierTexte.current ? b.blocs : undefined;
      const r = await enregistrerBrouillonAction(id, versDonnees(b, etape), blocs);
      if (!r.ok) {
        notifier.erreur(r.message);
        return null;
      }
      if (blocs) dernierTexte.current = texte;
      if (r.donnees.scriptId) modifier({ scriptId: r.donnees.scriptId });
      setEnregistreLe(new Date());
      return id;
    },
    [modifier, origine],
  );

  const aller = useCallback(
    async (cible: number, options: { sansEnregistrer?: boolean } = {}) => {
      let destination = Math.max(0, Math.min(etapes.length - 1, cible));
      if (destination > index) {
        // Saut en avant : s'arrêter sur la première étape incomplète.
        for (let i = index; i < destination; i++) {
          if (!etapes[i].estValide(reference.current)) {
            destination = i;
            const manque = etapes[i].manque?.(reference.current);
            if (i !== index && manque) notifier.info(manque);
            break;
          }
        }
        if (destination === index) {
          const manque = courante.manque?.(reference.current);
          if (manque) notifier.info(manque);
          return;
        }
        if (!options.sansEnregistrer) {
          setEnregistrement(true);
          const id = await enregistrerVers(etapes[destination].cle);
          setEnregistrement(false);
          if (!id) return;
        }
      }
      setIndex(destination);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [courante, enregistrerVers, etapes, index],
  );

  const suivant = useCallback(() => void aller(index + 1), [aller, index]);
  const allerA = useCallback((cle: CleEtape, options?: { sansEnregistrer?: boolean }) => void aller(etapes.findIndex((e) => e.cle === cle), options), [aller, etapes]);

  // Écran « Votre vidéo » (lot M3) : plus de passage d'étape, le brouillon s'enregistre ≈ 800 ms après chaque changement.
  const express = courante.cle === "express";
  const enregistrerExpress = useCallback(async () => {
    setEnregistrement(true);
    try {
      await enregistrerVers("express");
    } finally {
      setEnregistrement(false);
    }
  }, [enregistrerVers]);
  const differe = useEnregistrementDiffere(enregistrerExpress, express);
  const modifierEtape = useCallback(
    (patch: Partial<BrouillonAssistant>) => {
      modifier(patch);
      if (Object.keys(patch).some((k) => !CHAMPS_CLIENT.has(k as keyof BrouillonAssistant))) {
        saisie.current = true;
        if (express) differe.planifier();
      }
    },
    [differe, express, modifier],
  );

  const contexte: ContexteAssistant = useMemo(
    () => ({
      ...donnees,
      enregistrer: express
        ? async () => {
            // Ce qui attend part tout de suite ; sans changement en attente, le brouillon est créé au besoin.
            await differe.vider();
            return reference.current.videoId ?? (await enregistrerVers("express"));
          }
        : () => enregistrerVers(courante.cle),
      aSaisi: () => saisie.current || !!reference.current.videoId,
    }),
    [donnees, enregistrerVers, courante.cle, express, differe],
  );

  const Composant = courante.Composant;
  const repliee = meta.repliable && !!courante.aDesValeursParDefaut?.(brouillon) && !deplies.has(courante.cle);
  const proprietes = { formatId: brouillon.formatId, brouillon, modifier: modifierEtape, suivant, allerA, repliee, contexte };

  if (meta.pleinEcran) return <Composant {...proprietes} />;

  const quitter = { href: "/", libelle: "Quitter l'assistant" };
  const etatEnregistrement = <EtatEnregistrement enregistrement={enregistrement} enregistreLe={enregistreLe} />;
  const nomFormat = (
    <span className="inline-flex items-center gap-1.5">
      <Icone nom={format.icone} size={15} className="shrink-0" />
      {format.nom}
    </span>
  );

  if (express) {
    return (
      <GabaritCreation entete={{ titre: meta.titre, surTitre: nomFormat, retour: quitter, actions: etatEnregistrement }} etapes={{ etapes: ETAPES_EXPRESS, courante: 0 }} recents={recents}>
        <Composant {...proprietes} />
      </GabaritCreation>
    );
  }

  return (
    <GabaritCreation
      entete={{ titre: meta.titre, surTitre: nomFormat, retour: quitter, actions: etatEnregistrement }}
      etapes={{ etapes: etapes.map((e) => ({ cle: e.cle, libelle: META_ETAPES[e.cle].court })), courante: index, onAller: (i) => void aller(i) }}
      actionSecondaire={!meta.actionPropre && index > 0 ? <Bouton variante="secondaire" taille="lg" icone="fleche-gauche" aria-label="Étape précédente" onClick={() => void aller(index - 1)} /> : undefined}
      action={
        !meta.actionPropre ? (
          <Bouton taille="lg" iconeDroite="fleche-droite" chargement={enregistrement} disabled={!courante.estValide(brouillon)} onClick={suivant}>
            {meta.action}
          </Bouton>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={courante.cle} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
          {repliee ? (
            <EtapeRepliee
              icone={meta.icone}
              titre={meta.court}
              resume={courante.resume?.(brouillon, donnees) ?? "Réglages habituels"}
              onModifier={() => setDeplies((s) => new Set(s).add(courante.cle))}
            />
          ) : (
            <Composant {...proprietes} />
          )}
        </motion.section>
      </AnimatePresence>
    </GabaritCreation>
  );
}

/** État de l'enregistrement du brouillon, à droite de l'en-tête. */
function EtatEnregistrement({ enregistrement, enregistreLe }: { enregistrement: boolean; enregistreLe: Date | null }) {
  return (
    <span aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-xs text-texte-faible">
      {enregistrement ? (
        <>
          <Icone nom="chargement" size={13} className="animate-spin" /> Enregistrement…
        </>
      ) : enregistreLe ? (
        <>
          <Icone nom="valide" size={13} className="text-sauge" /> Brouillon enregistré
        </>
      ) : null}
    </span>
  );
}

/** Étape repliée en une ligne (AV2.4-5) : tout a une valeur par défaut. */
function EtapeRepliee({ icone, titre, resume, onModifier }: { icone: (typeof META_ETAPES)[CleEtape]["icone"]; titre: string; resume: string; onModifier: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex min-h-16 items-center gap-3 rounded-carte border border-trait bg-surface-1 p-3 pl-4")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sauge-doux text-sauge">
        <Icone nom="coche" size={18} strokeWidth={2.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-texte-faible">
          <Icone nom={icone} size={12} />
          {titre} · réglages habituels
        </span>
        <span className="block truncate text-[15px] font-semibold text-texte">{resume}</span>
      </span>
      <Bouton variante="fantome" icone="ecrire" onClick={onModifier}>
        Modifier
      </Bouton>
    </motion.div>
  );
}
