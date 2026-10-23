"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { modifierElementAction, rangerElementAction } from "@/app/(studio)/bibliotheque/actions";
import { Bouton, BoutonIcone, Champ, FeuilleBas, Icone, notifier } from "@/components/ui";
import type { EtatLicence, Licence, ValeurElement } from "@/domaine/types";
import { BlocLicence } from "./BlocLicence";
import { DetailsValeur } from "./DetailsValeur";
import { FormatsParDefaut } from "./FormatsParDefaut";
import type { FormatCourt } from "./outils";

/** Forme commune : élément de la Bibliothèque ou rush présenté comme tel. */
export interface ElementDetail {
  id: string;
  type: string;
  nom: string;
  motsCles: string[];
  vignette: string | null;
  url: string | null;
  etatLicence: EtatLicence;
  licence: Licence;
  formatsParDefaut: string[];
  favori?: boolean;
  valeur?: ValeurElement;
}

const SANS_DEFAUT = ["illustration-image", "illustration-video", "decor", "rushs"];

/** Feuille de détail d'un élément : aperçu, valeur, licence, mots-clés, défaut par format, favori, rangement (jamais d'effacement). */
export function FeuilleDetailElement({ element, formats, onFermer, lectureSeule }: { element: ElementDetail | null; formats: FormatCourt[]; onFermer: () => void; lectureSeule?: boolean }) {
  // Garde le dernier élément affiché pendant l'animation de fermeture de la feuille.
  const [dernier, setDernier] = useState(element);
  if (element && element !== dernier) setDernier(element);
  const affiche = element ?? dernier;
  return (
    <FeuilleBas ouverte={!!element} onOuverteChange={(o) => !o && onFermer()} titre={affiche?.nom ?? "Élément"}>
      {affiche && <Contenu key={affiche.id} element={affiche} formats={formats} onFermer={onFermer} lectureSeule={lectureSeule} />}
    </FeuilleBas>
  );
}

function Contenu({ element: e, formats, onFermer, lectureSeule }: { element: ElementDetail; formats: FormatCourt[]; onFermer: () => void; lectureSeule?: boolean }) {
  const [nom, setNom] = useState(e.nom);
  const [mots, setMots] = useState(e.motsCles);
  const [saisie, setSaisie] = useState("");
  const [favori, setFavori] = useState(!!e.favori);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();
  const modifie = nom.trim() !== e.nom || mots.join("|") !== e.motsCles.join("|");

  function enregistrer() {
    demarrer(async () => {
      const r = await modifierElementAction(e.id, e.type, { nom, motsCles: saisie.trim() ? [...mots, saisie] : mots });
      if (!r.ok) return void notifier.erreur(r.message);
      setSaisie("");
      notifier.succes("Enregistré");
    });
  }

  function basculerFavori() {
    const v = !favori;
    setFavori(v);
    demarrer(async () => {
      const r = await modifierElementAction(e.id, e.type, { favori: v });
      if (!r.ok) {
        setFavori(!v);
        notifier.erreur(r.message);
      }
    });
  }

  function ranger() {
    demarrer(async () => {
      const r = await rangerElementAction(e.id, e.type);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`« ${e.nom} » archivé`, "Retrouvez-le dans « Archivés », en bas de la liste.");
      onFermer();
    });
  }

  function ajouterMot() {
    const m = saisie.trim().toLowerCase();
    if (m && !mots.includes(m)) setMots((x) => [...x, m]);
    setSaisie("");
  }

  const estVideo = e.type === "illustration-video" || e.type === "rushs";
  const estSon = e.type === "musique" || e.type === "bruitage";

  return (
    <div className="grid gap-5">
      {/* Aperçu */}
      {estVideo && e.url ? (
        <video src={e.url} poster={e.vignette ?? undefined} controls playsInline className="mx-auto max-h-[50dvh] w-auto rounded-carte bg-fond" />
      ) : e.type === "lut" ? (
        <Link href="/bibliotheque/lut" className="flex min-h-12 items-center gap-2 rounded-carte bg-surface-2 px-4 text-sm font-semibold text-texte">
          <Icone nom="contraste" size={18} className="text-orange-vif" />
          Voir l&apos;avant / après
          <Icone nom="chevron-droite" size={16} className="ml-auto" />
        </Link>
      ) : e.vignette && e.type !== "logo" && !estSon ? (
        <div className="relative mx-auto aspect-[4/5] w-full max-w-64 overflow-hidden rounded-carte bg-surface-2">
          <Image src={e.vignette} alt={e.nom} fill sizes="256px" className="object-cover" />
        </div>
      ) : null}
      {estSon && e.url && <audio src={e.url} controls className="w-full" />}
      {e.valeur && <DetailsValeur valeur={e.valeur} vignette={e.vignette} />}

      {/* Licence (modifiable, AV2.3-12) */}
      <BlocLicence id={e.id} type={e.type} licence={e.licence} etat={e.etatLicence} modifiable={!lectureSeule} />

      {!lectureSeule && (
        <>
          <Champ libelle="Nom" value={nom} onChange={(x) => setNom(x.target.value)} maxLength={80} />
          <div>
            <Champ
              libelle="Mots-clés"
              value={saisie}
              onChange={(x) => setSaisie(x.target.value)}
              onKeyDown={(k) => {
                if (k.key === "Enter" || k.key === ",") {
                  k.preventDefault();
                  ajouterMot();
                }
              }}
              placeholder="Ajouter un mot-clé"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {mots.map((m) => (
                <button key={m} type="button" onClick={() => setMots((x) => x.filter((y) => y !== m))} className="flex min-h-11 items-center gap-1 rounded-full bg-orange-doux px-3 text-sm font-semibold text-orange-vif" aria-label={`Retirer ${m}`}>
                  #{m}
                  <Icone nom="fermer" size={13} />
                </button>
              ))}
            </div>
          </div>

          {!SANS_DEFAUT.includes(e.type) && <FormatsParDefaut elementId={e.id} type={e.type} actifs={e.formatsParDefaut} formats={formats} />}

          <AnimatePresence initial={false}>
            {modifie && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Bouton pleineLargeur taille="lg" icone="coche" chargement={enCours} onClick={enregistrer}>
                  Enregistrer
                </Bouton>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 border-t border-trait pt-4">
            <BoutonIcone icone="etoile" libelle={favori ? "Retirer des favoris" : "Mettre en favori"} variante="secondaire" onClick={basculerFavori} className={favori ? "text-orange-vif" : undefined} />
            <span className="flex-1 text-sm text-texte-faible">{favori ? "Favori" : ""}</span>
            {confirmer ? (
              <>
                <Bouton variante="fantome" onClick={() => setConfirmer(false)}>
                  Garder
                </Bouton>
                <Bouton variante="secondaire" icone="archive" chargement={enCours} onClick={ranger}>
                  Archiver
                </Bouton>
              </>
            ) : (
              <Bouton variante="fantome" icone="archive" onClick={() => setConfirmer(true)}>
                Archiver
              </Bouton>
            )}
          </div>
        </>
      )}
    </div>
  );
}
