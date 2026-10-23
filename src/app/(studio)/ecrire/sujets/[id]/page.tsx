import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatsEcrivables, lignesAffichees, nomFormat } from "@/components/generateur/donnees";
import { FicheSujet, type VersionAffichee } from "@/components/generateur/FicheSujet";
import { lettresLigne } from "@/components/generateur/MiniGrille";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Pastille } from "@/components/ui/Pastille";
import { messageAttenteEcritureParDefaut } from "@/domaine/credits";
import { lireFiltres, ordreValide } from "@/domaine/classement-generateur";
import { ETATS_SUJET_GENERATEUR, MANQUES_GENERATEUR } from "@/domaine/libelles";
import type { ReseauDeclinaison } from "@/domaine/types";
import { lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { obtenirSujet } from "@/services/generateur";
import { assurerBoucleGeneration, chaineDeLEcriture, ecritureArretee, estCorpsCourt, etatEcriture, matieresSansAccord, prixLancement, prixRetouche } from "@/services/boucle-generation";
import { claudeBranche, taux } from "@/services/generation-claude";
import { retourValide } from "@/domaine/retour-video";
import { programmationsDuSujet, retouchesRestantes } from "@/services/generateur-ecran";
import { assemblerBlocs } from "@/domaine/derivations-generateur";
import { phraseControle } from "@/domaine/controles-script/phrases";
import { jourJParDefaut } from "@/services/mesures";
import { EcritureEnCours } from "@/components/generateur/EcritureEnCours";
import { pageSuivie, planProgrammerSujet } from "@/services/mesures";
import { lienDeVersion } from "@/domaine/mesures";
import { etatFabricationSujet, planFabricationSujet, propositionsFabrication } from "@/services/fabrication-reseaux";
import { formaterMontant } from "@/lib/montants";
import { phraseAvatarParle } from "@/domaine/double-reel";
import { partPayee } from "@/services/generateur-depenses";
import { decisionJeLis } from "@/services/reglages";
import { formateurDate } from "@/lib/intl";

export const metadata: Metadata = { title: "Sujet" };
export const dynamic = "force-dynamic";

/** FICHE SUJET (plan v5 B.6.7, écran Résultat validé en GM) : `?reseau=tiktok` ouvre l'onglet d'un réseau. */
export default async function PageSujet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await exigerSession();
  const { id } = await params;
  const sp = await searchParams;
  // Correcteur 3, B1 : sujet ouvert depuis « Nouvelle vidéo » : chaque version propose « Utiliser dans ma vidéo ».
  const retourVideo = retourValide(sp.retour);
  const vue = await obtenirSujet(id);
  if (!vue) notFound();
  const m = vue.maitre;
  // Lot G4 : la boucle d'écriture est démarrée ici aussi (son branchement dans instrumentation.ts est préparé à part).
  assurerBoucleGeneration();
  const ecriture = m.generationId ? await etatEcriture(id) : null;
  const ecrit = vue.versions.length > 0;
  // E2E-2 argent n° 2 : une écriture arrêtée sur une panne le dit, avec « Reprendre l'écriture ».
  const arret = await ecritureArretee(id);
  if (ecriture && !ecrit && ecriture.statut && (["en-cours", "en-pause", "en-attente-credit", "plafond-atteint", "bloquee-modele"].includes(ecriture.statut) || (ecriture.statut === "echec" && !!arret)) && !(ecriture.statut === "en-pause" && !ecriture.pause)) {
    const messages: Record<string, string> = {
      "en-attente-credit": ecriture.preteAReprendre ? "Prête à reprendre. Rien ne repart sans vous." : (ecriture.messageAttente ?? messageAttenteEcritureParDefaut(!!ecriture.abonnements)),
      "plafond-atteint": "Plafond du sujet atteint : ce qui est écrit est gardé.",
      "bloquee-modele": "Le modèle d'écriture a changé : mise à jour nécessaire.",
    };
    return (
      <div className="mx-auto max-w-2xl">
        <EnTetePage retour={retourVideo ? { href: retourVideo, libelle: "Ma vidéo" } : { href: "/ecrire", libelle: "Écrire" }} surTitre={m.numero !== undefined ? `n° ${m.numero}` : "Sujet"} titre={m.brief.idee} className="mb-4 [&_h1]:break-words" />
        <EcritureEnCours
          id={id}
          etat={{
            statut: ecriture.statut,
            etape: ecriture.etape,
            libelle: ecriture.libelle,
            etapes: ecriture.etapes,
            // B11 : le taux du réglage, plus écrit en dur.
            utiliseEur: formaterMontant({ centimes: Math.ceil(ecriture.utiliseUsd * (await taux()) * 100), devise: "EUR" }),
            medianeMin: ecriture.medianeSec !== null ? Math.max(1, Math.round(ecriture.medianeSec / 60)) : null,
            pause: ecriture.pause?.raison,
            angles: ecriture.angles,
            accroches: ecriture.accroches,
            message: ecriture.statut === "echec" ? arret?.message : (ecriture.attenteSeuil ?? ecriture.messagePlafond ?? messages[ecriture.statut]),
            essai: ecriture.essai,
            abonnements: ecriture.abonnements,
            aucunCompte: ecriture.aucunCompte,
            supplement: ecriture.statut === "echec" && arret?.supplement ? formaterMontant(arret.supplement) : undefined,
            // Garde-fous budget (15/10) : « Reprendre (≈ X €) », seul geste qui relance une écriture en attente ou au plafond ;
            // si elle ne peut pas partir, le bouton dit pourquoi (correctif après relecture).
            reprise: ecriture.reprise ? (ecriture.reprise.possible ? { possible: true, prix: formaterMontant({ centimes: ecriture.reprise.centimesEur, devise: "EUR" }), centimes: ecriture.reprise.centimesEur } : { possible: false, raison: ecriture.reprise.raison ?? "" }) : undefined,
            bloque: ecriture.statut === "echec" ? arret?.bloque : undefined,
          }}
        />
      </div>
    );
  }
  const lignes = lignesAffichees(vue.grille);
  /** Lot G6 / G6b : état de la vidéo de la version, 2e ouverture, prise à monter. */
  const fabricationDe = (varianteId: string): Pick<VersionAffichee, "fabrication" | "secondeOuverture" | "avatarParleSecondeOuverture" | "aMonter" | "prixMonter" | "essaiMonter"> => {
    const e = etatsFab.find((x) => x.varianteId === varianteId && x.role !== "seconde-ouverture");
    return {
      ...(e ? { fabrication: { videoId: e.videoId, attendMere: e.attendMere, attendConfirmation: e.attendConfirmation, attendCredit: e.attendCredit, raisonAttente: e.raisonAttente, coutComplet: e.coutComplet ? formaterMontant(e.coutComplet) : undefined, avatarParle: e.avatarParle ? phraseAvatarParle(e.avatarParle) : undefined, dureeReelleSec: e.dureeReelleSec, points: e.pointsSurVideo, enCours: e.statut === "en_file" || e.statut === "en_fabrication" } } : {}),
      ...(propositions.secondeOuverture?.varianteId === varianteId ? { secondeOuverture: formaterMontant(propositions.secondeOuverture.prix), avatarParleSecondeOuverture: propositions.secondeOuverture.avatarParle ? phraseAvatarParle(propositions.secondeOuverture.avatarParle) : undefined } : {}),
      ...(propositions.aMonter.includes(varianteId) ? { aMonter: true, prixMonter: propositions.prixMonter[varianteId] ? formaterMontant(propositions.prixMonter[varianteId]) : undefined, essaiMonter: jeLisEssai.has(vue.versions.find((x) => x.variante.id === varianteId)?.variante.formatId ?? "") } : {}),
    };
  };
  const formatsDesVersions = [...new Set(vue.versions.map((x) => x.variante.formatId))];
  const [ordre, heures, page, plan, planN, etatsFab, propositions, restantes, programmees, doubleSimule, jeLisEssai] = await Promise.all([
    lireParametre<string[]>("publication.ordreParDefaut", []),
    lireParametre<Partial<Record<ReseauDeclinaison, string>>>("publication.heureParReseau", {}),
    pageSuivie(),
    // Lot G7a : « Programmer les N » (un format à la fois, ordre J à J+4).
    m.numero !== undefined && !m.archiveLe ? planProgrammerSujet(id) : null,
    // Lot G6 : « Fabriquer les N », état des vidéos de versions, 2e ouverture et « Monter ma prise ».
    m.numero !== undefined && !m.archiveLe ? planFabricationSujet(id) : null,
    etatFabricationSujet(id),
    propositionsFabrication(id),
    // Vérification E2E n° 1 : retouches payantes restantes (n° 20), ce qui est programmé version par version (n° 22).
    retouchesRestantes(vue.versions.map((x) => x.variante.code)),
    programmationsDuSujet(id),
    // E2E-1 n° 24 / E2E-2 argent n° 7 : ESSAI seulement quand RIEN ne sera payé (une voix HeyGen réelle est payée).
    partPayee(formatsDesVersions).then((x) => x.rienNestPaye),
    // CORRECTEUR FINAL A : « Monter ma prise » est un essai quand SON moteur (« Je lis ») est celui d'essai.
    Promise.all(formatsDesVersions.map(async (f) => ((await decisionJeLis(f)).moteurId === "simulation" ? f : null))).then((x) => new Set(x.filter((f): f is string => !!f))),
  ]);
  const limiteEnAttente = !!m.exception && !m.exception.valideeParWill;
  const jourCourt = (iso: string) => formateurDate("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));
  const prixFab = new Map((planN?.versions ?? []).map((x) => [x.varianteId, x]));

  const versions: VersionAffichee[] = vue.versions.map(({ variante: v, texte, accroche, videoId }) => {
    const script = vue.scripts.find((s) => s.id === v.scriptId);
    const ligne = lignes.find((l) => l.formatId === v.formatId && l.mode === (script?.mode ?? "avatar") && l.adresse === (script?.adresse ?? "vous"));
    const caseEtat = ligne?.cases[v.reseau]?.etat ?? "a-relire";
    // Vérification E2E n° 1, n° 17-18 : on dit CE qui manque ; virgule française ; plus de voyant une fois la version validée.
    const souciBrut =
      v.etat === "validee"
        ? null
        : v.etat === "a-reverifier"
          ? "Milieu modifié, à revoir"
          : v.etat === "a-completer"
            ? limiteEnAttente
              ? "Validez la limite proposée ci-dessus"
              : "Un élément manque encore"
            : (() => {
                const x = v.controles.violations.find((y) => !y.bloquant);
                return x ? phraseControle(x) : null;
              })();
    const souci = souciBrut?.replace(/(\d)\.(\d)/g, "$1,$2") ?? null;
    const prog = programmees.find((x) => x.code === v.code);
    const cout = prixFab.get(v.id);
    return {
      id: v.id,
      code: v.code,
      reseau: v.reseau,
      ligne: ligne?.libelle ?? nomFormat(v.formatId),
      lettres: ligne ? lettresLigne(ligne) : undefined,
      accroche,
      texte,
      dureeSec: v.dureeEstimeeSec,
      etatCase: caseEtat,
      etat: v.etat,
      souci,
      note: v.note.globale,
      version: v.version,
      aUneVersionAvant: !!v.parentId,
      videoId,
      gardeFous: v.controles.violations.filter((x) => x.bloquant).map(phraseControle),
      prompteur: v.prompteur,
      trame: v.trame,
      juges: v.verdicts?.questions.map((q) => ({ id: q.id, oui: q.reponse })),
      lienSuivi: v.publication.lienSuivi ?? lienDeVersion(page, v),
      corpsCourt: v.controles.violations.some(estCorpsCourt),
      retouchesRestantes: restantes[v.code] ?? 0,
      phrases: script ? assemblerBlocs(script, v).flatMap((b) => b.segments.map((g) => ({ id: g.id, texte: g.texte }))).filter((g) => g.texte.trim()) : [],
      programmee: prog ? `${prog.statut === "publiee" ? "Publiée" : "Programmée"}${prog.statut === "essai" ? " (essai)" : ""} : ${jourCourt(prog.date)}` : undefined,
      formatId: v.formatId,
      prixFabrication: cout ? { centimes: cout.cout.centimes, texte: formaterMontant(cout.cout), avatarParle: cout.avatarParle ? phraseAvatarParle(cout.avatarParle) : undefined } : undefined,
      ...fabricationDe(v.id),
    };
  });

  const formatsDuSujet = [...new Set(lignes.map((l) => l.formatId))];
  const formatPrincipal = formatsEcrivables().find((f) => f.id === (formatsDuSujet[0] ?? m.brief.formatId));
  const aJeLis = lignes.some((l) => l.formatId === formatPrincipal?.id && l.mode === "teleprompteur");
  const aTu = lignes.some((l) => l.formatId === formatPrincipal?.id && l.adresse === "tu");
  const reseauActif = lireFiltres(sp).reseau ?? null;
  const etat = ETATS_SUJET_GENERATEUR[vue.etat]?.libelle ?? vue.etat;

  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage
        retour={retourVideo ? { href: retourVideo, libelle: "Ma vidéo" } : { href: "/ecrire", libelle: "Écrire" }}
        surTitre={
          m.numero !== undefined ? (
            <span className="flex flex-wrap items-center gap-2">
              {formatsDuSujet.map((f) => (
                <Pastille key={f} ton="orange" taille="md">
                  {nomFormat(f)}
                </Pastille>
              ))}
              <Pastille taille="md">
                {versions.length} version{versions.length > 1 ? "s" : ""}
              </Pastille>
              {m.archiveLe && <Pastille taille="md">Archivé</Pastille>}
            </span>
          ) : (
            "Sujet sans numéro"
          )
        }
        titre={m.numero !== undefined ? `n° ${m.numero}${m.version > 1 ? ` v${m.version}` : ""}` : m.brief.idee}
        sousTitre={m.numero !== undefined ? (m.angle?.titre ?? m.brief.idee) : undefined}
        className="mb-4 [&_h1]:break-words"
      />
      <FicheSujet
        key={`${id}-${versions.map((v) => `${v.id}:${v.etat}`).join(",")}`}
        id={id}
        numero={m.numero}
        idee={m.brief.idee}
        etat={etat}
        archive={!!m.archiveLe}
        manque={m.numero === undefined || m.manque ? (m.manque ? { libelle: MANQUES_GENERATEUR[m.manque.type] ?? "Il manque une matière", ceQuIlFaudrait: m.manque.ceQuIlFaudrait, horsDomaine: m.manque.type === "HORS_DOMAINE" } : null) : null}
        limite={m.exception ? { texte: m.exception.texte, validee: m.exception.valideeParWill } : null}
        lignes={lignes}
        versions={versions}
        reseauActif={reseauActif}
        reseauxSujet={m.brief.reseaux}
        ajouts={{
          formatId: formatPrincipal?.id ?? m.brief.formatId,
          jeLis: !!formatPrincipal?.modes.includes("teleprompteur") && !aJeLis,
          tu: !aTu,
          autresFormats: formatsEcrivables()
            .filter((f) => !formatsDuSujet.includes(f.id))
            .map((f) => ({ id: f.id, nom: f.nom, icone: f.icone, moteurAVenir: f.statut !== "actif", modeParDefaut: f.modes.includes(m.brief.modeParDefaut ?? "avatar") ? (m.brief.modeParDefaut ?? "avatar") : f.modeParDefaut })),
        }}
        ordre={ordreValide(ordre)}
        jourJ={plan?.creneaux.find((c) => c.rang === 0)?.jour ?? jourJParDefaut()}
        heures={heures}
        aDesVideos={versions.some((v) => !!v.videoId)}
        programmation={plan ? { formatNom: plan.formatId ? nomFormat(plan.formatId) : undefined, creneaux: plan.creneaux, autresFormats: plan.autresFormats, envoiSimule: plan.envoiSimule, modeBuffer: plan.modeBuffer } : undefined}
        ouvrirProgrammation={sp.programmer === "1"}
        versionOuverteInitiale={sp.v}
        arret={arret && ecrit ? arret.message : null}
        arretSupplement={arret?.supplement && ecrit ? formaterMontant(arret.supplement) : null}
        sansAccord={await matieresSansAccord(id)}
        prixAjouts={{ supplement: formaterMontant(await prixLancement(true, await chaineDeLEcriture(m.brief.modeChoix))), adresse: formaterMontant(await prixLancement("adresse", await chaineDeLEcriture(m.brief.modeChoix))), retouche: formaterMontant(await prixRetouche()) }}
        ecritureSimulee={!(await claudeBranche())}
        retourVideo={retourVideo}
        fabricationN={
          planN
            ? {
                formatId: planN.formatId,
                mere: { code: planN.mere.code, reseau: planN.mere.reseau, dureeSec: planN.mere.dureeSec },
                versions: planN.versions.map((x) => ({ varianteId: x.varianteId, code: x.code, reseau: x.reseau, role: x.role, prix: formaterMontant(x.cout), dejaVideo: !!x.videoId })),
                total: formaterMontant(planN.total),
                totalCentimes: planN.total.centimes,
                sansDeclinaison: formaterMontant(planN.sansDeclinaison),
                surMere: planN.surMere,
                avatarParle: planN.avatarParle ? phraseAvatarParle(planN.avatarParle, planN.versions.filter((x) => !x.videoId).length) : undefined,
                essai: doubleSimule,
              }
            : null
        }
      />
    </div>
  );
}
