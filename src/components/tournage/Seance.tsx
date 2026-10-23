"use client";

/**
 * Séance de tournage (lot G4c, B.6 n° 16) : l'ordre de passage groupé par format, l'état de chaque version (à filmer,
 * rangée, à refaire), « Filmer » qui ouvre la caméra sur la prochaine version et enchaîne les suivantes. Sans caméra
 * sur ce téléphone : « Lire sur un autre appareil », puis « Déposer la prise » (rangée de la même façon).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { enregistrerPriseAction, priseRateeAction } from "@/app/(studio)/ecrire/tournage/actions";
import type { VersionDeSeance } from "@/domaine/tournage";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { cn } from "@/lib/cn";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { Enregistreur } from "./Enregistreur";
import { SelecteurDrive } from "@/components/google-drive/SelecteurDrive";
import { ErreurLisible } from "@/lib/erreur-lisible";

const ETATS = {
  "a-filmer": { libelle: "À filmer", pastille: "bg-surface-3 text-texte-doux", icone: "camera" as const },
  rangee: { libelle: "Rangée", pastille: "bg-sauge text-fond", icone: "coche" as const },
  "a-refaire": { libelle: "À refaire", pastille: "bg-ambre text-fond", icone: "reessayer" as const },
};

export function Seance({ seanceId, groupes, prochaineId }: { seanceId: string; groupes: { libelle: string; versions: VersionDeSeance[] }[]; prochaineId: string | null }) {
  const router = useRouter();
  // Liste figée à l'ouverture de la caméra : le rafraîchissement après chaque prise ne la décale pas.
  const [camera, setCamera] = useState<VersionDeSeance[] | null>(null);
  const [enCours, demarrer] = useTransition();
  const depot = useRef<HTMLInputElement>(null);
  const [cibleDepot, setCibleDepot] = useState<string | null>(null);
  // Lot E2 : prise facecam choisie dans le Google Drive (copiée côté serveur, puis rangée comme un dépôt).
  const [cibleDrive, setCibleDrive] = useState<string | null>(null);
  // La copie continue feuille fermée : la version visée est gardée pour ranger la prise à l'arrivée.
  const versionDrive = useRef<string | null>(null);

  const toutes = groupes.flatMap((g) => g.versions);
  const rangees = toutes.filter((v) => v.etat === "rangee").length;
  const prochaine = toutes.find((v) => v.id === prochaineId);
  // Fin de séance : retour au sujet filmé (sur sa première version) ; plusieurs sujets → Mes vidéos.
  const sujets = new Set(toutes.map((v) => v.scriptMaitreId));
  const retourFin = sujets.size === 1 && toutes[0] ? `/ecrire/sujets/${toutes[0].scriptMaitreId}?v=${toutes[0].id}` : "/videos";
  // Versions passées à la caméra : celle choisie, puis les suivantes non rangées, dans l'ordre de la séance.
  const aFilmer = (depuis: string) => {
    const i = toutes.findIndex((v) => v.id === depuis);
    return [toutes[i], ...toutes.slice(i + 1).filter((v) => v.etat !== "rangee"), ...toutes.slice(0, i).filter((v) => v.etat !== "rangee")].filter(Boolean);
  };

  const refaire = (id: string) =>
    demarrer(async () => {
      const r = await priseRateeAction(seanceId, id);
      if (!r.ok) return void notifier.erreur(r.message);
      router.refresh();
    });

  const deposer = (fichier: File | undefined) => {
    const id = cibleDepot;
    if (!fichier || !id) return;
    demarrer(async () => {
      try {
        const { fichierId } = await envoyerFichier(fichier, { typeEntite: "rush", entiteId: seanceId });
        const duree = await dureeVideo(fichier);
        const r = await enregistrerPriseAction(seanceId, id, fichierId, duree);
        if (!r.ok) throw new ErreurLisible(r.message);
        notifier.succes("Prise rangée", r.donnees.nom);
        router.refresh();
      } catch (e) {
        notifier.erreur(e instanceof ErreurLisible ? e.message : "La prise n'est pas partie.");
      }
    });
  };

  const rangerDepuisDrive = async ({ fichierId, dureeSec }: { fichierId: string; dureeSec: number }) => {
    const id = versionDrive.current;
    if (!id) return;
    const r = await enregistrerPriseAction(seanceId, id, fichierId, dureeSec);
    if (!r.ok) return void notifier.erreur(r.message);
    notifier.succes("Prise rangée", r.donnees.nom);
    router.refresh();
  };

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full rounded-full bg-sauge transition-[width]" style={{ width: `${(100 * rangees) / Math.max(1, toutes.length)}%` }} />
        </span>
        <span className="text-sm font-semibold tabular-nums text-texte">
          {rangees}/{toutes.length}
        </span>
      </div>

      <div className="space-y-6">
        {groupes.map((g, gi) => (
          <section key={gi} aria-label={g.libelle || "Versions"}>
            {g.libelle && (
              <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-texte-faible">
                <Icone nom="personne" size={12} />
                {g.libelle} · même tenue
              </h2>
            )}
            <ol className="space-y-2">
              {g.versions.map((v) => {
                const e = ETATS[v.etat];
                return (
                  <li key={v.id} className={cn("rounded-carte border bg-surface-1 p-3", v.id === prochaineId ? "border-orange" : "border-trait")}>
                    <div className="flex items-start gap-3">
                      <span className="relative shrink-0">
                        <LogoReseau reseau={v.reseau} taille="lg" />
                        <span role="img" aria-label={e.libelle} className={cn("absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-surface-1", e.pastille)}>
                          <Icone nom={e.icone} size={11} />
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-texte">{v.titre}</p>
                        <p className="mt-0.5 text-xs text-texte-faible">
                          <span className="font-mono">{v.code}</span> · ≈ {v.dureeSec} s{v.prises > 0 && ` · ${v.prises} prise${v.prises > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      {v.etat === "rangee" ? (
                        <>
                          <Pastille ton="sauge" icone="coche" className="mr-auto">
                            Rangée
                          </Pastille>
                          <Bouton variante="fantome" icone="reessayer" disabled={enCours} onClick={() => refaire(v.id)}>
                            Refaire
                          </Bouton>
                        </>
                      ) : (
                        <>
                          {v.etat === "a-refaire" && (
                            <Pastille ton="ambre" icone="reessayer" className="mr-auto">
                              À refaire
                            </Pastille>
                          )}
                          <Link href={`/ecrire/sujets/${v.scriptMaitreId}/lire/${v.id}`} aria-label="Lire sur un autre appareil" title="Lire sur un autre appareil" className="grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-2 hover:text-texte">
                            <Icone nom="appareils" size={18} />
                          </Link>
                          <button
                            type="button"
                            aria-label="Déposer la prise"
                            title="Déposer la prise"
                            disabled={enCours}
                            onClick={() => {
                              setCibleDepot(v.id);
                              depot.current?.click();
                            }}
                            className="grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-2 hover:text-texte disabled:opacity-50"
                          >
                            <Icone nom="telecharger" size={18} />
                          </button>
                          {v.formatId === "facecam" && (
                            <Bouton variante="fantome" icone="prise" disabled={enCours} onClick={() => {
                                versionDrive.current = v.id;
                                setCibleDrive(v.id);
                              }}>
                              Drive
                            </Bouton>
                          )}
                          <Bouton variante="secondaire" icone="camera" onClick={() => setCamera(aFilmer(v.id))}>
                            Filmer
                          </Bouton>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <input
        ref={depot}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          deposer(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <BarreActionCollee>
        {prochaine ? (
          <Bouton taille="lg" icone="camera" onClick={() => setCamera(aFilmer(prochaine.id))}>
            Filmer · {prochaine.code}
          </Bouton>
        ) : (
          <Bouton asChild taille="lg" icone="video">
            <Link href={retourFin}>{retourFin === "/videos" ? "Séance terminée · Mes vidéos" : "Séance terminée · Voir le sujet"}</Link>
          </Bouton>
        )}
      </BarreActionCollee>

      <SelecteurDrive
        ouverte={!!cibleDrive}
        onOuverteChange={(o) => !o && setCibleDrive(null)}
        cible={{ typeEntite: "rush", entiteId: seanceId }}
        onPret={rangerDepuisDrive}
        onIphone={() => {
          setCibleDepot(cibleDrive);
          depot.current?.click();
        }}
      />

      {camera && <Enregistreur seanceId={seanceId} versions={camera} onFermer={() => setCamera(null)} />}
    </>
  );
}

/** Durée d'une vidéo déposée (0 si le navigateur ne sait pas la lire). */
function dureeVideo(f: File): Promise<number> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      ok(Number.isFinite(v.duration) ? v.duration : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      ok(0);
    };
    v.src = url;
  });
}
