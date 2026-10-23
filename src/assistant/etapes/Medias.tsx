"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { deposerFichierAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import { obtenirFormat } from "@/formats";
import type { TypeEntree } from "@/formats/types";
import type { FichierDepose, ProprietesEtape } from "./types";

const ICONES: Record<TypeEntree, NomIcone> = {
  "medias-illustration": "images",
  "capture-ecran": "ecran-partage",
  "page-a-faire-defiler": "lien",
  produit: "etoile",
  "logo-client": "certifie",
  musique: "musique",
  rushs: "camera",
};

function lireFichiers(v: unknown): FichierDepose[] {
  return Array.isArray(v) ? (v as FichierDepose[]) : [];
}

/** Étape « medias » : une zone de dépôt par entrée du format (captures, page à faire défiler, produit…). Envoi réel (Essai tant que le stockage n'est pas relié). */
export function EtapeMedias({ formatId, brouillon, modifier }: ProprietesEtape) {
  const format = obtenirFormat(formatId);
  const [enCours, setEnCours] = useState<string | null>(null);

  if (!format.entrees.length) return <EtatVide compact icone="images" titre="Rien à fournir" phrase="Ce format se débrouille avec le texte." />;

  async function deposer(cle: TypeEntree, fichiers: File[], multiple: boolean) {
    setEnCours(cle);
    const deposes: FichierDepose[] = [];
    const cible = { typeEntite: "entree", entiteId: brouillon.videoId ?? "brouillon" };
    const e = await envoyerFichiers(fichiers, cible);
    if (!e.ok) notifier.erreur(e.message);
    for (const fichierId of e.ok ? e.fichierIds : []) {
      const r = await deposerFichierAction({ fichierId, ...cible });
      if (r.ok) deposes.push(r.donnees);
      else notifier.erreur(r.message);
    }
    setEnCours(null);
    if (!deposes.length) return;
    const avant = lireFichiers(brouillon.entrees[cle]);
    modifier({ entrees: { ...brouillon.entrees, [cle]: multiple ? [...avant, ...deposes] : deposes.slice(0, 1) } });
    if (e.ok && e.simulation) notifier.essai("rien n'a été envoyé, fichier de démonstration");
  }

  function retirer(cle: TypeEntree, id: string) {
    modifier({ entrees: { ...brouillon.entrees, [cle]: lireFichiers(brouillon.entrees[cle]).filter((f) => f.id !== id) } });
  }

  return (
    <div className="space-y-7">
      {format.entrees.map((e) => {
        const fichiers = lireFichiers(brouillon.entrees[e.cle]);
        return (
          <section key={e.cle}>
            <div className="mb-2 flex items-center gap-2">
              <Icone nom={ICONES[e.cle]} size={16} className="text-orange-vif" />
              <h2 className="font-texte text-[15px] font-semibold text-texte">{e.nom}</h2>
              {e.obligatoire ? <Pastille ton="orange">Obligatoire</Pastille> : <Pastille>Facultatif</Pastille>}
              {fichiers.length > 0 && <span className="ml-auto text-sm tabular-nums text-texte-faible">{fichiers.length}</span>}
            </div>
            {fichiers.length > 0 && (
              <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                <AnimatePresence initial={false}>
                  {fichiers.map((f) => (
                    <motion.li key={f.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative aspect-square overflow-hidden rounded-xl border border-trait bg-surface-2">
                      {f.url && f.mime.startsWith("image/") ? (
                        <Image src={f.url} alt={f.nom} fill sizes="120px" className="object-cover" />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-texte-faible">
                          <Icone nom={f.mime.startsWith("video/") ? "film" : f.mime.startsWith("audio/") ? "musique" : "document"} size={24} />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-fond/75 px-1.5 py-1 text-[10px] font-semibold text-texte">{f.nom}</span>
                      <button
                        type="button"
                        aria-label={`Retirer ${f.nom}`}
                        onClick={() => retirer(e.cle, f.id)}
                        className="absolute right-0.5 top-0.5 grid size-11 place-items-center text-texte"
                      >
                        <span className="grid size-7 place-items-center rounded-full bg-fond/80 backdrop-blur">
                          <Icone nom="fermer" size={14} />
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {(e.multiple || fichiers.length === 0) && (
              <ZoneDepot
                libelle={enCours === e.cle ? "Ajout…" : fichiers.length ? "Ajouter" : "Déposer ou choisir"}
                detail={e.aide}
                accepte={e.accepte.join(",")}
                multiple={e.multiple}
                icone={ICONES[e.cle]}
                compacte
                onFichiers={(f) => void deposer(e.cle, f, e.multiple)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
