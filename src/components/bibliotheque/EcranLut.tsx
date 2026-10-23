"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { importerLutAction, modifierValeurAction } from "@/app/(studio)/bibliotheque/actions";
import { BarreActionCollee, Bouton, Champ, Curseur, EtatVide, FeuilleBas, Icone, notifier, Pastille, ZoneDepot } from "@/components/ui";
import { cn } from "@/lib/cn";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { CARACTERES_MAX_CUBE } from "@/lib/lut3d";
import type { VueLut } from "@/services/B-personnages-bibliotheque";
import { infosFichier, nomDepuisFichier, tailleLisible } from "../personnages/outils";
import { CadreApercu } from "./CadreApercu";
import { FormatsParDefaut } from "./FormatsParDefaut";
import { validerCubeLocal, type FormatCourt } from "./outils";

const LIMITE_ENVOI = 800 * 1024;

/** LUT (AV2.3-5) : avant / après avec coupure glissable, curseur d'intensité, défaut par format, import .cube validé. */
export function EcranLut({ luts, formats, ajouterAuDepart }: { luts: VueLut[]; formats: FormatCourt[]; ajouterAuDepart?: boolean }) {
  const [choisieId, setChoisieId] = useState(luts.find((l) => l.formatsParDefaut.includes("avocat"))?.id ?? luts[0]?.id);
  const lut = luts.find((l) => l.id === choisieId) ?? luts[0];
  const [intensites, setIntensites] = useState<Record<string, number>>({});
  const [coupure, setCoupure] = useState(50);
  const [import_, setImport] = useState(!!ajouterAuDepart);
  const [enSauvegarde, sauver] = useTransition();
  const intensite = lut ? (intensites[lut.id] ?? lut.intensite) : 70;
  const modifiee = !!lut && intensite !== lut.intensite;

  function enregistrerIntensite() {
    if (!lut || lut.valeur.type !== "lut") return;
    const valeur = { ...lut.valeur, intensiteParDefaut: intensite };
    sauver(async () => {
      const r = await modifierValeurAction(lut.id, valeur);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`Intensité de « ${lut.nom} » : ${intensite} %`);
    });
  }

  return (
    <div className="space-y-6">
      {lut ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-4">
            <div className="relative">
              <CadreApercu avant={lut.avant} apres={lut.apres} intensite={intensite} coupure={coupure} mentionIA={false} />
              <input
                type="range"
                min={0}
                max={100}
                value={coupure}
                onChange={(e) => setCoupure(Number(e.target.value))}
                aria-label="Comparer avant et après"
                className="peer absolute inset-0 size-full cursor-ew-resize touch-pan-y opacity-0"
              />
              {/* Le curseur est invisible : l'aperçu s'entoure quand il a le focus clavier. touch-pan-y laisse la page défiler au doigt. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-carte peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-orange-vif" />
            </div>
            <Curseur libelle="Intensité" valeur={intensite} onChange={(v) => setIntensites((x) => ({ ...x, [lut.id]: v }))} unite=" %" />
            {modifiee && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                <Bouton variante="fantome" onClick={() => setIntensites((x) => ({ ...x, [lut.id]: lut.intensite }))}>
                  Annuler
                </Bouton>
                <Bouton variante="contour" icone="coche" className="flex-1" chargement={enSauvegarde} onClick={enregistrerIntensite}>
                  Garder {intensite} % par défaut
                </Bouton>
              </motion.div>
            )}
          </div>

          <div className="space-y-5 rounded-carte border border-trait bg-surface-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-titre text-xl text-texte">{lut.nom}</p>
                <p className="text-sm text-texte-faible">
                  {lut.tailleCube >= 64 ? "Très précise" : lut.tailleCube >= 32 ? "Précise" : "Simple"}{!lut.apres && " · aperçu approché"}
                </p>
              </div>
              {lut.etatLicence !== "ok" && <Pastille ton="ambre" icone="attention">À vérifier</Pastille>}
            </div>
            <FormatsParDefaut key={lut.id} elementId={lut.id} type="lut" actifs={lut.formatsParDefaut} formats={formats} />
          </div>
        </div>
      ) : (
        <EtatVide icone="contraste" titre="Aucune couleur" phrase="Ajoutez un fichier .cube pour donner sa couleur à vos vidéos." />
      )}

      {luts.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {luts.map((l, i) => {
            const actif = l.id === lut?.id;
            return (
              <motion.li key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <button
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setChoisieId(l.id)}
                  className={cn("group block w-full overflow-hidden rounded-carte border text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5", actif ? "border-orange shadow-orange" : "border-trait hover:border-trait-fort")}
                >
                  <div className="relative aspect-video bg-surface-2">
                    {(l.apres ?? l.avant) && <Image src={(l.apres ?? l.avant)!} alt="" fill sizes="(max-width: 640px) 50vw, 260px" className={cn("object-cover", !l.apres && "contrast-125 saturate-150 sepia-[.2]")} />}
                    {!l.apres && (
                      <>
                        {/* Image de référence : son mot « AVANT » (en bas à gauche) est masqué, l'effet est approché. */}
                        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-surface-1 via-surface-1/80 to-transparent" />
                        <span className="absolute bottom-2 left-2">
                          <Pastille>Approché</Pastille>
                        </span>
                      </>
                    )}
                    {l.formatsParDefaut.length > 0 && (
                      <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-orange text-sur-orange" title="Par défaut d'un format">
                        <Icone nom="etoile" size={14} fill="currentColor" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-surface-1 p-3">
                    <span className="truncate text-sm font-semibold text-texte">{l.nom}</span>
                    <span className="font-titre text-sm tabular-nums text-texte-faible">{l.intensite}%</span>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setImport(true)}>
          Ajouter une couleur
        </Bouton>
      </BarreActionCollee>
      <FeuilleImportLut ouverte={import_} onOuverteChange={setImport} onImportee={(id) => setChoisieId(id)} />
    </div>
  );
}

function FeuilleImportLut({ ouverte, onOuverteChange, onImportee }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; onImportee: (id: string) => void }) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [nom, setNom] = useState("");
  const [verif, setVerif] = useState<{ ok: true; taille: number; contenu: string; avertissement?: string } | { ok: false; erreur: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  async function choisir(f: File) {
    setFichier(f);
    setNom(nomDepuisFichier(f.name));
    if (!/\.cube$/i.test(f.name)) return setVerif({ ok: false, erreur: "Choisissez un fichier .cube." });
    // Jamais lu en entier s'il est démesuré (même plafond que le serveur).
    if (f.size > CARACTERES_MAX_CUBE) return setVerif({ ok: false, erreur: "Ce fichier dépasse 50 Mo : ce n'est pas un fichier de couleur." });
    const contenu = await f.text();
    const v = validerCubeLocal(contenu);
    setVerif(v.ok ? { ...v, contenu } : v);
  }

  function importer() {
    if (!fichier || !verif?.ok) return;
    demarrer(async () => {
      // Lot R5 : le .cube part tel quel dans le stockage (le serveur du studio en a besoin pour l'image « après »).
      let fichierId: string | undefined;
      try {
        fichierId = (await envoyerFichier(fichier, { typeEntite: "element", entiteId: "lut" })).fichierId;
      } catch {
        return void notifier.erreur("Le fichier n'a pas pu être envoyé. Vérifiez la connexion et réessayez.");
      }
      const r = await importerLutAction({ nom, fichier: infosFichier(fichier), contenu: verif.contenu.length <= LIMITE_ENVOI ? verif.contenu : null, tailleCube: verif.taille, fichierId });
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(r.donnees.apres ? `Couleur « ${nom} » ajoutée` : `Couleur « ${nom} » ajoutée · aperçu approché`);
      onImportee(r.donnees.id);
      setFichier(null);
      setVerif(null);
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Ajouter une couleur"
      description="Un fichier .cube, vérifié avant l'ajout."
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} disabled={!verif?.ok || !nom.trim()} onClick={importer}>
          Ajouter cette couleur
        </Bouton>
      }
    >
      <div className="grid gap-4">
        <ZoneDepot libelle="Choisir un fichier .cube" accepte=".cube" multiple={false} icone="contraste" onFichiers={(f) => f[0] && void choisir(f[0])} />
        {fichier && verif && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex min-h-14 items-center gap-3 rounded-carte border px-4", verif.ok ? "border-sauge/40 bg-sauge-doux" : "border-brique/40 bg-brique-doux")}
          >
            <Icone nom={verif.ok ? "valide" : "attention"} size={20} className={verif.ok ? "text-sauge" : "text-brique"} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-texte">{fichier.name}</span>
              <span className={cn("text-sm", verif.ok ? "text-sauge" : "text-brique")}>{verif.ok ? `Fichier de couleur valide · ${tailleLisible(fichier.size)}` : verif.erreur}</span>
            </span>
          </motion.div>
        )}
        {verif?.ok && verif.avertissement && (
          <p className="flex items-start gap-2 rounded-carte border border-orange/30 bg-orange-doux px-4 py-3 text-sm text-texte">
            <Icone nom="attention" size={18} className="mt-0.5 shrink-0 text-orange-vif" />
            {verif.avertissement}
          </p>
        )}
        {verif?.ok && <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} />}
      </div>
    </FeuilleBas>
  );
}
