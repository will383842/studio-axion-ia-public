"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { archiverMesImageAction, validerMesImageAction } from "@/app/(studio)/bibliotheque/actions";
import { Bouton, CaseACocher, FeuilleBas, Icone, notifier, Pastille } from "@/components/ui";
import { CATEGORIES_MES_IMAGES, manquesPourEtrePrete } from "@/domaine/mes-images";
import type { CategorieMesImages } from "@/domaine/types";
import { cn } from "@/lib/cn";
import type { VueMesImage } from "@/services/mes-images";
import { ImageAvecZones } from "./ImageAvecZones";

/**
 * VALIDATION EN SÉRIE : on fait défiler les images « à vérifier » ; pour chacune, un geste suffit (« OK »), ou
 * corriger la catégorie, les mots-clés, les zones à flouter, les accords. Rien n'est supprimé (« Archiver »).
 */
export function ValidationEnSerie({ images, ouverte, onOuverteChange, depart = 0 }: { images: VueMesImage[]; ouverte: boolean; onOuverteChange: (v: boolean) => void; depart?: number }) {
  const [index, setIndex] = useState(depart);
  const [faites, setFaites] = useState(0);
  const image = images[Math.min(index, images.length - 1)];
  const fin = index >= images.length;

  function suivante(validee: boolean) {
    if (validee) setFaites((n) => n + 1);
    setIndex((i) => i + 1);
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={(o) => {
        onOuverteChange(o);
        if (!o) {
          setIndex(0);
          setFaites(0);
        }
      }}
      titre={fin ? "Tout est vu" : `Image ${index + 1} sur ${images.length}`}
      description={fin ? undefined : "Un geste par image : OK, ou corrigez."}
    >
      {fin || !image ? (
        <div className="grid place-items-center gap-3 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-sauge/15 text-sauge">
            <Icone nom="coche" size={26} strokeWidth={3} />
          </span>
          <p className="font-titre text-2xl text-texte">{faites} prête{faites > 1 ? "s" : ""}</p>
          <Bouton variante="secondaire" onClick={() => onOuverteChange(false)}>
            Fermer
          </Bouton>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={image.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
            <CarteValidation image={image} onFaite={suivante} />
          </motion.div>
        </AnimatePresence>
      )}
    </FeuilleBas>
  );
}

function CarteValidation({ image, onFaite }: { image: VueMesImage; onFaite: (validee: boolean) => void }) {
  const [categorie, setCategorie] = useState<CategorieMesImages | undefined>(image.categorie);
  const [mots, setMots] = useState(image.motsCles);
  const [saisie, setSaisie] = useState("");
  const [choisies, setChoisies] = useState(() => new Set(image.zones.map((_, i) => i)));
  const [accordTiers, setAccordTiers] = useState(!!image.accordTiers);
  const [accordClient, setAccordClient] = useState(!!image.accordClient);
  const [enCours, demarrer] = useTransition();

  const besoinTiers = image.accordTiers !== undefined;
  const besoinClient = categorie === "clients";
  const manques = manquesPourEtrePrete({
    categorieImage: categorie,
    confidentialite: { statut: "a_verifier", zones: image.zones.filter((_, i) => choisies.has(i)).map((z) => ({ ...z, floutee: true })), fichierFlouteId: "x", accordTiers: besoinTiers ? accordTiers : undefined, accordClient: besoinClient ? accordClient : undefined },
  });

  function valider() {
    demarrer(async () => {
      const r = await validerMesImageAction(image.id, {
        categorie,
        motsCles: saisie.trim() ? [...mots, saisie] : mots,
        zonesAFlouter: [...choisies],
        accordTiers: besoinTiers ? accordTiers : undefined,
        accordClient: besoinClient ? accordClient : undefined,
      });
      if (!r.ok) return void notifier.erreur(r.message);
      if (r.donnees.statut === "prete") notifier.succes("Prête : le moteur peut l'utiliser");
      else notifier.info("Gardée à vérifier", manquesPourEtrePrete({ categorieImage: r.donnees.categorie, confidentialite: { statut: "a_verifier", zones: r.donnees.zones, fichierFlouteId: r.donnees.floutee ? "x" : undefined, accordTiers: r.donnees.accordTiers, accordClient: r.donnees.accordClient } }).join(", "));
      onFaite(true);
    });
  }

  function archiver() {
    demarrer(async () => {
      const r = await archiverMesImageAction(image.id, true);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.info("Archivée (rien n'est supprimé)");
      onFaite(false);
    });
  }

  return (
    <div className="grid gap-4 pb-2">
      <div className="grid h-[42dvh] place-items-center">
        <ImageAvecZones
          src={image.vignette}
          alt={image.nom}
          largeur={image.largeur}
          hauteur={image.hauteur}
          zones={image.zones}
          floutee={false}
          copieReelle={false}
          choisies={choisies}
          video={image.type === "illustration-video"}
          tailles="(max-width: 640px) 92vw, 480px"
          onBasculer={(i) =>
            setChoisies((s) => {
              const n = new Set(s);
              if (n.has(i)) n.delete(i);
              else n.add(i);
              return n;
            })
          }
          className="max-h-[42dvh]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {image.zones.length > 0 && (
          <Pastille ton="ambre" icone="bouclier">
            {choisies.size} zone{choisies.size > 1 ? "s" : ""} à flouter
          </Pastille>
        )}
        {image.qualite && (!image.qualite.nette || !image.qualite.assezGrande) && (
          <Pastille ton="brique" icone="attention">
            {image.qualite.remarques[0] ?? "Qualité faible"}
          </Pastille>
        )}
        {image.description && <span className="w-full truncate text-xs text-texte-faible">{image.description}</span>}
      </div>

      <div role="radiogroup" aria-label="Catégorie" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4">
        {CATEGORIES_MES_IMAGES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={categorie === c.id}
            onClick={() => setCategorie(c.id)}
            className={cn("flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition-colors", categorie === c.id ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte-doux hover:text-texte")}
          >
            {c.nom}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {mots.map((m) => (
          <button key={m} type="button" onClick={() => setMots((x) => x.filter((y) => y !== m))} className="flex min-h-11 items-center gap-1 rounded-full bg-orange-doux px-3 text-sm font-semibold text-orange-vif" aria-label={`Retirer ${m}`}>
            {m}
            <Icone nom="fermer" size={13} />
          </button>
        ))}
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && saisie.trim()) {
              e.preventDefault();
              setMots((x) => Array.from(new Set([...x, saisie.trim().toLowerCase()])));
              setSaisie("");
            }
          }}
          placeholder="+ mot-clé"
          aria-label="Ajouter un mot-clé"
          className="min-h-11 w-28 rounded-full border border-dashed border-trait-fort bg-transparent px-3 text-sm text-texte outline-none placeholder:text-texte-faible focus:border-orange"
        />
      </div>

      {(besoinTiers || besoinClient) && (
        <div className="grid gap-2 rounded-carte border border-ambre/40 bg-ambre/10 p-3">
          {besoinTiers && <CaseACocher libelle="Accord de la personne visible" detail="Sans accord, l'image n'est pas utilisée." coche={accordTiers} onChange={setAccordTiers} />}
          {besoinClient && <CaseACocher libelle="Accord du client" detail="Lieu ou document d'un client." coche={accordClient} onChange={setAccordClient} />}
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Bouton variante="secondaire" icone="archive" disabled={enCours} onClick={archiver}>
          Archiver
        </Bouton>
        <Bouton taille="lg" icone="coche" chargement={enCours} onClick={valider}>
          {manques.length ? "Enregistrer" : "OK, prête"}
        </Bouton>
      </div>
      {manques.length > 0 && <p className="-mt-2 text-center text-xs text-texte-faible">Il manque : {manques.join(", ").toLowerCase()}</p>}
      <button type="button" onClick={() => onFaite(false)} className="mx-auto min-h-11 px-4 text-sm font-semibold text-texte-doux hover:text-texte">
        Passer
      </button>
    </div>
  );
}
