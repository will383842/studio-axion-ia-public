# Fabrique l'ÉTALON du calage (lot « calage », D3) : un son de la voix de synthèse de Windows (Hortense, fr-FR), gratuit,
# avec le début EXACT de chaque mot (événement SpeakProgress), sur un texte DIFFÉRENT de tests/fixtures/voix-essai.
# Il sert à mesurer UNE fois la latence propre du modèle d'alignement (constante `LATENCE_MODELE_SEC` de
# studio-aligneur/aligneur/calage.py) ; la fixture voix-essai et les 5 phrases HeyGen restent des contrôles INDÉPENDANTS.
# Usage : powershell -File outils/alignement/fabriquer-etalon.ps1 [-Sortie outils/alignement/etalon/etalon]
param([string]$Sortie = "outils/alignement/etalon/etalon")

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Hortense Desktop")
$s.Rate = 1

$ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">
<break time="300ms"/>Votre employeur vous doit peut-être des heures supplémentaires.<break time="600ms"/>
Gardez chaque bulletin de paie, notez vos horaires, et demandez conseil rapidement.<break time="500ms"/>
Le délai pour agir est de trois ans : après, c'est trop tard.<break time="350ms"/>
</speak>
"@

$mots = New-Object System.Collections.ArrayList
$s.add_SpeakProgress({ param($o, $e) [void]$mots.Add([pscustomobject]@{ mot = $e.Text; debutSec = [math]::Round($e.AudioPosition.TotalSeconds, 3) }) })

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
New-Item -ItemType Directory -Force (Split-Path $Sortie) | Out-Null
$s.SetOutputToWaveFile("$Sortie.wav", $format)
$s.SpeakSsml($ssml)
$s.SetOutputToNull()
$s.Dispose()

$texte = ($mots | ForEach-Object { $_.mot }) -join " "
[pscustomobject]@{ texte = $texte; mots = $mots } | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 "$Sortie.debuts.json"
Write-Output "Son : $Sortie.wav ; débuts des mots : $Sortie.debuts.json ($($mots.Count) mots)"
