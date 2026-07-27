param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$CommitMessage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail {
    param([string]$Message)
    Write-Error $Message
    exit 1
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [string]$ErrorMessage = "La commande Git a echoue."
    )

    & git @Args
    if ($LASTEXITCODE -ne 0) {
        Fail "$ErrorMessage (git $($Args -join ' '))"
    }
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    Fail "Le message de commit est obligatoire et ne peut pas etre vide."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git est introuvable. Installez Git et verifiez qu'il est dans le PATH."
}

# Verification du depot Git
$insideRepo = & git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or "$insideRepo".Trim() -ne 'true') {
    Fail "Le repertoire courant n'est pas un depot Git valide."
}

# Recuperation de la branche courante
$currentBranch = (& git branch --show-current 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace("$currentBranch")) {
    Fail "Impossible de determiner la branche courante."
}
$currentBranch = "$currentBranch".Trim()

if ($currentBranch -eq 'main' -or $currentBranch -eq 'master') {
    Fail "Refus de continuer : la branche courante est '$currentBranch'. Utilisez une branche de fonctionnalite."
}

Invoke-Git -Args @('add', '-A') -ErrorMessage "Impossible d'indexer les changements (git add -A)."

# Verification des changements indexes
& git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    Invoke-Git -Args @('commit', '-m', $CommitMessage) -ErrorMessage "Impossible de creer le commit."
}
elseif ($LASTEXITCODE -eq 0) {
    Write-Host "Aucun nouveau changement a commiter. Aucun commit supplementaire n'est necessaire."
}
else {
    Fail "Impossible de verifier les changements indexes."
}

Invoke-Git -Args @('push', '--set-upstream', 'origin', $currentBranch) -ErrorMessage "Impossible de pousser la branche '$currentBranch'."

$ghPath = 'C:\Program Files\GitHub CLI\gh.exe'
if (-not (Test-Path -LiteralPath $ghPath)) {
    Fail "GitHub CLI introuvable a l'emplacement attendu : $ghPath"
}

# Detection d'une PR existante pour la branche
$existingPrRaw = & $ghPath pr list --head $currentBranch --json number,url --limit 1 2>$null
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($existingPrRaw | Out-String))) {
    try {
        $existingPr = $existingPrRaw | ConvertFrom-Json
        if ($null -ne $existingPr -and $existingPr.Count -gt 0) {
            Write-Host "Une Pull Request existe deja pour '$currentBranch' : $($existingPr[0].url)"
            exit 0
        }
    }
    catch {
        Write-Warning "Impossible d'analyser la verification de PR existante. Tentative de creation de PR."
    }
}

& $ghPath pr create --fill --web
if ($LASTEXITCODE -ne 0) {
    Fail "La creation de Pull Request a echoue."
}

Write-Host "Pull Request lancee avec succes pour la branche '$currentBranch'."
