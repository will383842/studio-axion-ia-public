"use client";

import { useRef, useState } from "react";
import { doublonsMesImagesAction, importerMesImagesAction, preparerImportDriveAction } from "@/app/(studio)/bibliotheque/actions";
import { BarreProgression, Bouton, Champ, FeuilleBas, Icone, notifier, ZoneDepot } from "@/components/ui";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { dimensionsMedia, empreinteFichier, estMediaAccepte } from "./outils";

/**
 * Dépôt EN VRAC dans « Mes images » : fichiers (sélection multiple), dossier entier, ou (bientôt) un dossier Google
 * Drive en lecture seule. Les doublons ne sont pas renvoyés ; le studio classe tout, Will valide ensuite.
 */
export function FeuilleImport({ ouverte, onOuverteChange, onImportees }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; onImportees: (n: number) => void }) {
  const [progression, setProgression] = useState<{ fait: number; total: number; nom: string } | null>(null);
  const [drive, setDrive] = useState("");
  const [messageDrive, setMessageDrive] = useState<string | null>(null);
  const dossier = useRef<HTMLInputElement>(null);
  // Un seul envoi à la fois (E2E-1 n° 27) : deux envois croisés faisaient compter « déjà là » une image qu'ils
  // rangeaient tous deux, et le message ne disait plus ce qui avait été ajouté.
  const occupe = useRef(false);

  async function importer(brut: File[], depuis: "fichier" | "dossier") {
    if (occupe.current) return;
    const fichiers = brut.filter(estMediaAccepte).slice(0, 200);
    if (!fichiers.length) return void notifier.info("Aucune image ni vidéo dans ce choix");
    occupe.current = true;
    setProgression({ fait: 0, total: fichiers.length, nom: "Préparation" });
    try {
      const infos = await Promise.all(fichiers.map(async (f) => ({ f, empreinte: await empreinteFichier(f), ...(await dimensionsMedia(f)) })));
      const connus = await doublonsMesImagesAction(infos.map((x) => x.empreinte).filter((x): x is string => !!x));
      const deja = new Set(connus.ok ? connus.donnees : []);
      const vus = new Set<string>();
      const aEnvoyer = infos.filter((x) => {
        if (!x.empreinte) return true;
        if (deja.has(x.empreinte) || vus.has(x.empreinte)) return false;
        vus.add(x.empreinte);
        return true;
      });
      const envoyes = [];
      for (const [i, x] of aEnvoyer.entries()) {
        setProgression({ fait: i, total: aEnvoyer.length, nom: x.f.name });
        const r = await envoyerFichier(x.f, { typeEntite: "element", entiteId: "mes-images" });
        // Essai local : sans stockage réel, l'image est gardée sur cet ordinateur pour être vue.
        if (r.simulation && x.f.type.startsWith("image/") && x.f.size <= 15 * 1024 * 1024) {
          await fetch(`/api/mes-images/essai-local?fichierId=${encodeURIComponent(r.fichierId)}`, { method: "POST", body: x.f }).catch(() => undefined);
        }
        envoyes.push({ fichierId: r.fichierId, nom: x.f.name, mime: x.f.type, empreinte: x.empreinte, largeur: x.largeur, hauteur: x.hauteur, depuis });
      }
      const doublons = infos.length - aEnvoyer.length;
      if (!envoyes.length) {
        notifier.info(`${doublons} déjà dans Mes images : rien de nouveau`);
        return;
      }
      const r = await importerMesImagesAction(envoyes);
      if (!r.ok) return void notifier.erreur(r.message);
      const total = doublons + r.donnees.doublons.length;
      notifier.succes(`${r.donnees.importees.length} rangée${r.donnees.importees.length > 1 ? "s" : ""}${total ? ` · ${total} déjà là` : ""}`);
      onImportees(r.donnees.importees.length);
      onOuverteChange(false);
    } catch {
      notifier.erreur("L'envoi s'est interrompu. Réessayez : ce qui est arrivé est gardé.");
    } finally {
      occupe.current = false;
      setProgression(null);
    }
  }

  async function verifierDrive() {
    const r = await preparerImportDriveAction(drive);
    setMessageDrive(r.ok ? r.donnees.message : r.message);
  }

  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre="Ajouter à Mes images" description="Déposez en vrac : le studio range tout.">
      <div className="grid gap-4 pb-2">
        {progression ? (
          <div className="rounded-carte border border-trait bg-surface-1 p-4" aria-live="polite">
            <p className="truncate text-sm font-semibold text-texte">{progression.nom}</p>
            <p className="mb-2 text-xs tabular-nums text-texte-faible">
              {progression.fait} / {progression.total} · gardez l&apos;écran allumé
            </p>
            <BarreProgression valeur={Math.round((progression.fait / Math.max(1, progression.total)) * 100)} />
          </div>
        ) : (
          <>
            <ZoneDepot libelle="Choisir des images" detail="Photos, captures, vidéos · plusieurs à la fois" accepte="image/*,video/*" icone="images" essai={false} onFichiers={(f) => void importer(f, "fichier")} />
            <input
              ref={dossier}
              type="file"
              multiple
              className="sr-only"
              aria-label="Choisir un dossier"
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(e) => {
                const f = Array.from(e.target.files ?? []);
                e.target.value = "";
                void importer(f, "dossier");
              }}
            />
            <Bouton variante="secondaire" icone="calques" pleineLargeur onClick={() => dossier.current?.click()}>
              Choisir un dossier entier
            </Bouton>
          </>
        )}
        <div className="rounded-carte border border-dashed border-trait-fort p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-texte">
            <Icone nom="lien" size={15} className="text-orange-vif" />
            Dossier Google Drive
          </p>
          <p className="mt-1 text-xs text-texte-faible">Lu sans jamais être modifié.</p>
          <div className="mt-3 flex gap-2">
            <Champ libelle="Adresse du dossier" libelleMasque placeholder="https://drive.google.com/drive/folders/…" value={drive} onChange={(e) => setDrive(e.target.value)} className="flex-1" />
            <Bouton variante="secondaire" disabled={!drive.trim()} onClick={() => void verifierDrive()}>
              Vérifier
            </Bouton>
          </div>
          {messageDrive && <p className="mt-2 text-xs text-texte-doux">{messageDrive}</p>}
        </div>
      </div>
    </FeuilleBas>
  );
}
