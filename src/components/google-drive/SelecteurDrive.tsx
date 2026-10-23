"use client";

/**
 * « Depuis mon Drive » (lot E2, plan facecam v4 L1) : feuille du bas qui liste les vidéos récentes du Google Drive de
 * Will (vignette, date, durée, taille), avec une recherche par nom. Un appui lance la copie CÔTÉ SERVEUR (le téléphone
 * peut se mettre en veille) ; la feuille suit l'avancement puis rend le fichier prêt, exactement comme un envoi depuis
 * l'iPhone. Si Google refuse : « Reconnecter » ou « Envoyer depuis l'iPhone ».
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { importerDepuisDriveAction, listerVideosDriveAction, reprendreImportDriveAction, suivreImportDriveAction } from "@/app/(studio)/reglages/google-drive/actions";
import type { VideoDrive } from "@/fournisseurs/google-drive/types";
import type { VueImportDrive } from "@/services/google-drive";
import { dateCourte } from "@/lib/dates";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";

const SUIVI_MS = 1_500;

export function tailleLisible(octets: number): string {
  const go = octets / 1024 ** 3;
  if (go >= 1) return `${go.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go`;
  return `${(octets > 0 ? Math.max(1, Math.round(octets / 1024 ** 2)) : 0).toLocaleString("fr-FR")} Mo`;
}

/** « 45 s », « 2 min 22 s », « 1 h 05 » (jamais confondu avec une heure de la journée). */
export function dureeLisible(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, "0")} s` : ""}`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}

/** Copie en cours pour cette destination, gardée dans ce navigateur (la feuille rouverte la retrouve). */
const cleSuivi = (c: { typeEntite: string; entiteId: string }) => `studio.drive:${c.typeEntite}:${c.entiteId}`;
function lireSuivi(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}
function ecrireSuivi(cle: string, id: string | null) {
  try {
    if (id) window.localStorage.setItem(cle, id);
    else window.localStorage.removeItem(cle);
  } catch {
    /* stockage du navigateur indisponible : le suivi tient tant que la feuille est ouverte */
  }
}

export interface ProprietesSelecteurDrive {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  /** Même destination qu'un envoi depuis l'iPhone (ex. `{ typeEntite: "rush", entiteId: seanceId }`). */
  cible: { typeEntite: string; entiteId: string };
  /** Le fichier est arrivé et contrôlé : à ranger comme une prise envoyée depuis l'iPhone. */
  onPret: (f: { fichierId: string; dureeSec: number; nom: string }) => Promise<void> | void;
  /** « Envoyer depuis l'iPhone » (repli) : ouvre le choix de fichier habituel. */
  onIphone?: () => void;
  titre?: string;
}

export function SelecteurDrive({ ouverte, onOuverteChange, cible, onPret, onIphone, titre = "Choisir dans mon Drive" }: ProprietesSelecteurDrive) {
  const [recherche, setRecherche] = useState("");
  const [videos, setVideos] = useState<VideoDrive[] | null>(null);
  const [suite, setSuite] = useState<string | undefined>();
  const [erreur, setErreur] = useState<{ message: string; reconnecter: boolean } | null>(null);
  const [copie, setCopie] = useState<VueImportDrive | null>(null);
  const [occupe, setOccupe] = useState(false);
  const rangee = useRef<string | null>(null);
  const cle = cleSuivi(cible);

  const charger = useCallback(async (texte: string, apres?: string) => {
    const r = await listerVideosDriveAction(texte || undefined, apres);
    if (!r.ok) {
      setErreur({ message: r.message, reconnecter: r.code === "DRIVE_EXPIRE" });
      setVideos([]);
      return;
    }
    setErreur(null);
    setVideos((av) => (apres && av ? [...av, ...r.donnees.videos] : r.donnees.videos));
    setSuite(r.donnees.suite);
  }, []);

  // Liste (et recherche, 350 ms après la dernière lettre) à l'ouverture.
  useEffect(() => {
    if (!ouverte || copie) return;
    const t = setTimeout(() => void charger(recherche.trim()), recherche ? 350 : 0);
    return () => clearTimeout(t);
  }, [ouverte, recherche, copie, charger]);

  // Une copie déjà lancée pour cette destination est retrouvée à la réouverture.
  useEffect(() => {
    if (!ouverte || copie) return;
    const id = lireSuivi(cle);
    if (!id) return;
    void suivreImportDriveAction(id).then((r) => {
      if (r.ok && r.donnees.statut !== "termine") setCopie(r.donnees);
      else ecrireSuivi(cle, null);
    });
  }, [ouverte, cle, copie]);

  // Suivi de la copie, puis rangement comme une prise envoyée depuis l'iPhone.
  useEffect(() => {
    if (!copie) return;
    if (copie.statut === "termine" && copie.fichierId) {
      if (rangee.current === copie.id) return;
      rangee.current = copie.id;
      ecrireSuivi(cle, null);
      void Promise.resolve(onPret({ fichierId: copie.fichierId, dureeSec: copie.dureeSec, nom: copie.nom })).finally(() => {
        setCopie(null);
        onOuverteChange(false);
      });
      return;
    }
    if (copie.statut !== "en_cours" && copie.statut !== "en_attente") return;
    const t = setTimeout(async () => {
      const r = await suivreImportDriveAction(copie.id);
      if (r.ok) setCopie(r.donnees);
    }, SUIVI_MS);
    return () => clearTimeout(t);
  }, [copie, cle, onPret, onOuverteChange]);

  const choisir = async (v: VideoDrive) => {
    setOccupe(true);
    const r = await importerDepuisDriveAction(v.id, cible);
    setOccupe(false);
    if (!r.ok) return setErreur({ message: r.message, reconnecter: r.code === "DRIVE_EXPIRE" });
    ecrireSuivi(cle, r.donnees.id);
    setCopie(r.donnees);
  };

  const reprendre = async () => {
    if (!copie) return;
    setOccupe(true);
    const r = await reprendreImportDriveAction(copie.id);
    setOccupe(false);
    if (r.ok) setCopie(r.donnees);
    else setErreur({ message: r.message, reconnecter: r.code === "DRIVE_EXPIRE" });
  };

  const abandonner = () => {
    ecrireSuivi(cle, null);
    setCopie(null);
  };

  const iphone = onIphone
    ? () => {
        onOuverteChange(false);
        onIphone();
      }
    : undefined;

  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre={copie ? "Copie depuis mon Drive" : titre} description={copie ? undefined : "Vos vidéos les plus récentes. Le Drive est lu, jamais modifié."} pleinEcran>
      {copie ? (
        <SuiviCopie copie={copie} occupe={occupe} onReprendre={reprendre} onAutre={abandonner} onIphone={iphone} />
      ) : (
        <div className="space-y-3">
          <Champ libelle="Chercher par nom" libelleMasque icone="loupe" type="search" inputMode="search" placeholder="Chercher par nom de fichier" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {erreur && <Repli message={erreur.message} reconnecter={erreur.reconnecter} onIphone={iphone} />}
          {videos === null ? (
            <ul className="space-y-2" aria-busy="true" aria-label="Chargement des vidéos">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[76px] animate-pulse rounded-carte bg-surface-2" />
              ))}
            </ul>
          ) : videos.length === 0 && !erreur ? (
            <p className="py-8 text-center text-sm text-texte-doux">{recherche ? "Aucune vidéo à ce nom dans le Drive." : "Aucune vidéo dans le Drive."}</p>
          ) : (
            <ul className="space-y-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <button type="button" disabled={occupe} onClick={() => void choisir(v)} className="flex w-full items-center gap-3 rounded-carte border border-trait bg-surface-1 p-2 text-left hover:border-orange disabled:opacity-60">
                    <span className="grid h-[60px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-md bg-surface-3 text-texte-faible">
                      {v.vignette ? (
                        // eslint-disable-next-line @next/next/no-img-element -- vignette servie par le studio (session), pas d'optimisation d'image
                        <img src={`/api/google-drive/vignette?id=${encodeURIComponent(v.id)}`} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <Icone nom="video" size={18} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-texte">{v.nom}</span>
                      <span className="mt-0.5 block text-xs tabular-nums text-texte-faible">
                        {v.modifieLe ? dateCourte(v.modifieLe) : "—"}
                        {v.dureeSec > 0 && ` · ${dureeLisible(v.dureeSec)}`} · {tailleLisible(v.taille)}
                      </span>
                    </span>
                    <Icone nom="chevron-droite" size={18} className="shrink-0 text-texte-faible" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {suite && (
            <Bouton variante="fantome" pleineLargeur onClick={() => void charger(recherche.trim(), suite)}>
              Voir plus
            </Bouton>
          )}
          {iphone && !erreur && (
            <p className="pt-1 text-center text-xs text-texte-faible">
              La vidéo n&apos;est pas dans le Drive ?{" "}
              <button type="button" onClick={iphone} className="min-h-11 font-semibold text-texte-doux underline underline-offset-2">
                Envoyer depuis l&apos;iPhone
              </button>
            </p>
          )}
        </div>
      )}
    </FeuilleBas>
  );
}

function Repli({ message, reconnecter, onIphone }: { message: string; reconnecter: boolean; onIphone?: () => void }) {
  return (
    <div role="alert" className="rounded-carte border border-ambre/40 bg-surface-2 p-3">
      <p className="flex items-start gap-2 text-sm font-semibold text-texte">
        <Icone nom="attention" size={16} className="mt-0.5 shrink-0 text-ambre" />
        {message}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {reconnecter && (
          <Bouton asChild icone="cle">
            <Link href="/reglages/google-drive">Reconnecter</Link>
          </Bouton>
        )}
        {onIphone && (
          <Bouton variante="secondaire" icone="telephone" onClick={onIphone}>
            Envoyer depuis l&apos;iPhone
          </Bouton>
        )}
      </div>
    </div>
  );
}

function SuiviCopie({ copie, occupe, onReprendre, onAutre, onIphone }: { copie: VueImportDrive; occupe: boolean; onReprendre: () => void; onAutre: () => void; onIphone?: () => void }) {
  const pct = copie.taille ? Math.min(100, Math.floor((100 * copie.octetsFaits) / copie.taille)) : 0;
  const enMarche = copie.statut === "en_cours" || copie.statut === "en_attente";
  return (
    <div className="space-y-4">
      <div className="rounded-carte border border-trait bg-surface-1 p-4">
        <p className="truncate text-[15px] font-semibold text-texte">{copie.nom}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Copie depuis le Drive">
          <span className="block h-full rounded-full bg-orange transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 flex justify-between text-xs tabular-nums text-texte-faible">
          <span>
            {tailleLisible(copie.octetsFaits)} sur {tailleLisible(copie.taille)}
          </span>
          <span>{copie.statut === "termine" ? "Arrivée" : copie.statut === "en_attente" ? "En attente…" : `${pct} %`}</span>
        </p>
      </div>
      {enMarche && (
        <p className="flex items-start gap-2 text-sm text-texte-doux">
          <Icone nom="info" size={16} className="mt-0.5 shrink-0" />
          La copie se fait sur le serveur : vous pouvez verrouiller le téléphone ou fermer cette page, elle continue.
        </p>
      )}
      {copie.statut === "en_pause" && (
        <div className="space-y-2">
          <Repli message={copie.message ?? "Copie interrompue."} reconnecter={false} onIphone={onIphone} />
          <Bouton icone="reessayer" pleineLargeur chargement={occupe} onClick={onReprendre}>
            Reprendre la copie
          </Bouton>
        </div>
      )}
      {copie.statut === "refuse" && (
        <div className="space-y-2">
          <Repli message={copie.message ?? "Google refuse cette vidéo."} reconnecter={copie.action === "reconnecter"} onIphone={onIphone} />
          {copie.action === "reconnecter" && (
            <Bouton variante="secondaire" icone="reessayer" pleineLargeur chargement={occupe} onClick={onReprendre}>
              Reprendre après reconnexion
            </Bouton>
          )}
          <Bouton variante="fantome" pleineLargeur onClick={onAutre}>
            Choisir une autre vidéo
          </Bouton>
        </div>
      )}
    </div>
  );
}
