"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { envoyerVersBufferAction, noterPublicationManuelleAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { reseauxProposesBuffer } from "@/domaine/classement-generateur";
import { casesEnvoi, casesParDefaut, ciblesDepuisCases, libelleComptes } from "@/domaine/comptes-envoi";
import type { IdReseau, ModeEnvoiPublication } from "@/domaine/types";
import { RAPPEL_VOTRE_MARQUE } from "@/domaine/votre-marque";
import { useVideo } from "./ContexteVideo";

type Quand = "maintenant" | "demain" | "choisir";

/** Valeur d'un <input type="datetime-local"> (heure locale). */
function versLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function demainNeufHeures(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Libellé du bouton : ce qui va VRAIMENT se passer. */
export function libelleEnvoi(mode: ModeEnvoiPublication | undefined, simule: boolean): string {
  if (simule || !mode) return "Envoyer";
  return mode === "brouillon" ? "Envoyer en brouillon" : "Programmer dans Buffer";
}

/** TEST-UI-REEL U8 (CORRECTEUR UI2) : phrase d'une vidéo d'essai, dite dès l'ouverture de la feuille (sans envoi proposé). */
export const PHRASE_VIDEO_ESSAI = "Vidéo d'essai : elle ne part pas sur vos réseaux.";

/** TEST-UI-REEL U8 : l'envoi n'est proposé que pour une vraie vidéo (le serveur refuse aussi une vidéo d'essai). */
export function envoiPropose(kit: { videoEssai?: boolean } | null | undefined): boolean {
  return !!kit && !kit.videoEssai;
}

/** TEST-UI-REEL U8 : l'encart d'une vidéo d'essai, à la place des réseaux, de la date et du bouton d'envoi. */
export function AvisVideoEssai() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-ambre/40 bg-ambre-doux p-3.5">
      <PastilleEssai className="mt-0.5 shrink-0" />
      <p className="min-w-0">
        <span className="block text-base font-semibold leading-snug text-texte">{PHRASE_VIDEO_ESSAI}</span>
        <span className="mt-0.5 block text-sm text-texte-doux">Une vidéo de démonstration remplace la vôtre. Fabriquez-la pour de vrai pour l&apos;envoyer.</span>
      </p>
    </div>
  );
}

/**
 * Feuille « Envoyer vers Buffer » : réseaux + date. En simulation (défaut), ESSAI : rien n'est envoyé, la publication
 * est notée « simulation » et n'apparaît jamais comme programmée (AV2.4-4). En réel (lot R1) : brouillon dans Buffer
 * par défaut (Will programme dans Buffer), compte de chaque réseau lu en base (jamais un appel à Buffer à l'affichage).
 * Lot R1b : un réseau à plusieurs comptes (deux LinkedIn) montre une case par compte ; Will coche l'un, l'autre ou les
 * deux. Par défaut, son dernier choix ; sans dernier choix, aucun de ces comptes n'est coché.
 */
export function FeuilleEnvoyerBuffer() {
  const router = useRouter();
  const { feuille, ouvrir, kit, videoId, reseauxParDefaut, publiable, envoiBuffer } = useVideo();
  // Ce qui empêche un réseau de partir (une seule règle) : fichier trop long ou sans le bon format d'image, ou, en réel
  // (lot R1), aucun compte Buffer (ou un compte déconnecté).
  const raisonBlocage = useCallback(
    (reseau: IdReseau) => kit?.reseaux.find((r) => r.reseau === reseau)?.avertissements.find((a) => a.code === "trop-longue" || a.code === "ratio-absent")?.message ?? envoiBuffer?.comptes[reseau]?.probleme,
    [kit, envoiBuffer],
  );
  // Générateur (G1b, B.5.5 ; critère G1b, vérification E2E n° 1 n° 23) : une vidéo issue d'une version part sur le
  // SEUL réseau de sa version (chaque réseau a sa propre version) ; aucun autre réseau n'est proposé.
  const reseauVersion = kit?.variante?.reseau;
  const autreReseau = false;
  const proposes = reseauxProposesBuffer((kit?.reseaux ?? []).map((r) => r.reseau), reseauVersion, autreReseau);
  // Lot R1b : une case par réseau, ou une par compte quand le réseau en a plusieurs.
  const cases = casesEnvoi(
    (kit?.reseaux ?? []).filter((r) => proposes.includes(r.reseau)).map((r) => ({ reseau: r.reseau, nom: r.nom })),
    envoiBuffer?.comptes,
  );
  const [cles, setCles] = useState<string[]>(() => {
    if (reseauVersion) return casesParDefaut(cases, [reseauVersion], envoiBuffer?.comptes);
    const possibles = cases.filter((c) => !raisonBlocage(c.reseau));
    const parDefaut = casesParDefaut(possibles, reseauxParDefaut, envoiBuffer?.comptes);
    // Jamais un compte que Will n'a pas choisi : le repli ne prend qu'un réseau à un seul compte.
    return parDefaut.length ? parDefaut : possibles.filter((c) => !c.canalId).slice(0, 1).map((c) => c.cle);
  });
  const { reseaux, comptes } = ciblesDepuisCases(cles, cases);
  // Réseaux à comptes à cocher dont aucun compte n'est coché : on le dit, simplement.
  const sansCompte = [...new Set(cases.filter((c) => c.canalId && !raisonBlocage(c.reseau)).map((c) => c.reseau))].filter((r) => !reseaux.includes(r));
  const avertissements = [...new Set(cases.map((c) => envoiBuffer?.comptes[c.reseau]?.avertissement).filter((a): a is string => !!a))];
  const [quand, setQuand] = useState<Quand>("demain");
  const [date, setDate] = useState(() => versLocal(demainNeufHeures()));
  // Vérification E2E n° 1, n° 29 : date choisie dans le passé (calculé au choix de la date, pas pendant l'affichage).
  const [datePassee, setDatePassee] = useState(false);
  const [envoi, demarrerEnvoi] = useTransition();
  const [manuel, demarrerManuel] = useTransition();
  if (!kit) return null;

  // TEST-UI-REEL U8 : vidéo d'essai : la feuille le dit tout de suite et ne propose pas l'envoi.
  if (!envoiPropose(kit)) {
    return (
      <FeuilleBas
        ouverte={feuille === "buffer"}
        onOuverteChange={(o) => ouvrir(o ? "buffer" : null)}
        titre="Envoyer vers Buffer"
        pied={
          <Bouton taille="lg" pleineLargeur variante="secondaire" icone="coche" onClick={() => ouvrir(null)}>
            Compris
          </Bouton>
        }
      >
        <AvisVideoEssai />
      </FeuilleBas>
    );
  }

  const dateIso = () => (quand === "maintenant" ? new Date() : quand === "demain" ? demainNeufHeures() : new Date(date)).toISOString();

  function envoyer() {
    if (quand === "choisir" && new Date(date).getTime() < Date.now()) {
      notifier.erreur("Choisissez une date à venir.");
      return;
    }
    demarrerEnvoi(async () => {
      const r = await envoyerVersBufferAction(videoId, reseaux, dateIso(), autreReseau, comptes);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const n = r.donnees.nombre;
      if (r.donnees.simulation) notifier.essai("rien n'a été envoyé à Buffer");
      // Un envoi par compte coché (deux LinkedIn = deux comptes) : on compte des comptes, pas des réseaux.
      else if (n && r.donnees.mode === "brouillon") notifier.succes(`Brouillon dans Buffer · ${libelleComptes(n)}`, "Relisez et programmez dans Buffer.");
      else if (n) notifier.succes(`Programmée sur ${libelleComptes(n)}`);
      const autres = r.donnees.problemes.length - 1;
      if (r.donnees.problemes.length) notifier.erreur(r.donnees.problemes[0], autres > 0 ? `Et ${autres} autre${autres > 1 ? "s" : ""} compte${autres > 1 ? "s" : ""} à revoir.` : undefined);
      ouvrir(null);
      router.refresh();
    });
  }

  function noterPubliee() {
    demarrerManuel(async () => {
      for (const reseau of reseaux) {
        // Lot G7a : « Choisir » une date passée note le vrai jour de publication (les mesures J+3 et J+7 en partent).
        const choisie = quand === "choisir" ? new Date(date) : null;
        const le = choisie && choisie.getTime() <= Date.now() ? choisie.toISOString() : new Date().toISOString();
        const r = await noterPublicationManuelleAction(videoId, reseau, le, "publiee");
        if (!r.ok) {
          notifier.erreur(r.message);
          return;
        }
      }
      notifier.succes("C'est noté : publiée");
      ouvrir(null);
      router.refresh();
    });
  }

  return (
    <FeuilleBas
      ouverte={feuille === "buffer"}
      onOuverteChange={(o) => ouvrir(o ? "buffer" : null)}
      titre="Envoyer vers Buffer"
      pied={
        <div className="flex flex-col gap-2">
          <Bouton taille="lg" pleineLargeur icone="envoyer" essai={kit.envoiSimule} disabled={!reseaux.length || !publiable} chargement={envoi} onClick={envoyer}>
            {libelleEnvoi(envoiBuffer?.mode, kit.envoiSimule)}
          </Bouton>
          <Bouton variante="fantome" pleineLargeur icone="coche" disabled={!reseaux.length} chargement={manuel} onClick={noterPubliee}>
            Je l&apos;ai publiée moi-même
          </Bouton>
          {/* Lot G7a : la mesure est branchée, « Programmer les versions du sujet » ouvre la fiche sujet. */}
          {kit.variante?.sujetId && (
            <Bouton asChild variante="secondaire" pleineLargeur icone="calendrier">
              <Link href={`/ecrire/sujets/${kit.variante.sujetId}?programmer=1`} onClick={() => ouvrir(null)}>
                Programmer les versions du sujet
              </Link>
            </Bouton>
          )}
        </div>
      }
    >
      {kit.envoiSimule && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-ambre/30 bg-ambre-doux px-3 py-2.5 text-sm text-texte">
          <PastilleEssai />
          Rien ne partira vraiment.
        </p>
      )}
      {!kit.envoiSimule && envoiBuffer && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
          <Icone nom="envoyer" size={16} className="shrink-0 text-orange-vif" />
          {envoiBuffer.mode === "brouillon" ? "Brouillon dans Buffer : rien ne part tant que vous ne l'avez pas programmé dans Buffer." : "La vidéo partira à la date choisie."}
        </p>
      )}
      {/* Équipe 7 : Buffer ne sait pas déclarer « Votre marque » : le geste est rappelé, en grand. */}
      {kit.votreMarque.cochee && reseaux.includes("tiktok") && (
        <div role="note" className="mb-5 flex items-start gap-3 rounded-2xl border border-ambre/50 bg-ambre-doux p-3.5">
          <Icone nom="certifie" size={22} className="mt-0.5 shrink-0 text-ambre" />
          <p className="min-w-0">
            <span className="block text-base font-bold leading-snug text-texte">{RAPPEL_VOTRE_MARQUE}</span>
            <span className="mt-0.5 block text-sm text-texte-doux">Avant de publier le brouillon : la vidéo met en avant Axion IA.</span>
          </p>
        </div>
      )}
      {!publiable && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
          <Icone nom="attention" size={16} className="text-ambre" />
          Cochez d&apos;abord « Avant de publier ».
        </p>
      )}
      <div className="space-y-6">
        {reseauVersion && cases.length === 1 && !cases[0].canalId ? (
          <div className="flex min-h-14 items-center gap-3 rounded-champ border border-trait bg-surface-2 px-3">
            <LogoReseau reseau={reseauVersion} taille="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-texte">{kit.reseaux.find((r) => r.reseau === reseauVersion)?.nom ?? reseauVersion}</span>
              <span className="block truncate text-xs text-texte-faible">
                Version <span className="font-mono">{kit.variante?.code}</span>, écrite pour ce réseau
              </span>
            </span>
          </div>
        ) : (
          <div>
            <SelecteurPastilles<string>
              multiple
              libelle={reseauVersion ? "Comptes" : "Réseaux"}
              valeur={cles}
              onChange={setCles}
              options={cases.map((c) => {
                const bloquant = raisonBlocage(c.reseau);
                const compte = envoiBuffer?.comptes[c.reseau]?.nom;
                return { valeur: c.cle, libelle: c.libelle, visuel: <LogoReseau reseau={c.reseau} taille="sm" />, desactive: !!bloquant, raison: bloquant, detail: bloquant ?? c.detail ?? compte };
              })}
            />
            {sansCompte.length > 0 && (
              <p className="mt-2 text-sm text-texte-doux">
                {sansCompte
                  .map((r) => {
                    const nom = kit.reseaux.find((x) => x.reseau === r)?.nom ?? "";
                    return cases.filter((c) => c.reseau === r).length > 1 ? `Plusieurs comptes ${nom} : cochez le ou les comptes où envoyer.` : `Cochez le compte ${nom} pour l'y envoyer.`;
                  })
                  .join(" ")}
              </p>
            )}
            {/* Un compte déconnecté est nommé ; les comptes restés connectés se cochent quand même. */}
            {avertissements.length > 0 && <p className="mt-2 text-sm text-texte-doux">{avertissements.join(" ")}</p>}
          </div>
        )}
        <SelecteurPastilles<Quand>
          libelle="Quand"
          valeur={quand}
          onChange={setQuand}
          options={[
            { valeur: "maintenant", libelle: "Maintenant", icone: "eclair" },
            { valeur: "demain", libelle: "Demain 9 h", icone: "horloge" },
            { valeur: "choisir", libelle: "Choisir", icone: "calendrier" },
          ]}
        />
        {quand === "choisir" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-texte-doux">Date et heure</span>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDatePassee(new Date(e.target.value).getTime() < Date.now());
              }}
              className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte outline-none [color-scheme:light] focus:border-orange"
            />
          </label>
        )}
        {/* Vérification E2E n° 1, n° 29 : une date passée sert à noter une publication faite à la main (mesures J+3, J+7). */}
        {quand === "choisir" && datePassee && (
          <p className="text-sm text-texte-doux">Date passée : touchez « Je l&apos;ai publiée moi-même ». Les mesures de J+3 et J+7 partiront de ce jour.</p>
        )}
      </div>
    </FeuilleBas>
  );
}
