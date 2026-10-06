$ErrorActionPreference = "Stop"

function Get-DotEnvValue {
    param([Parameter(Mandatory = $true)][string]$Name)

    $line = Get-Content -LiteralPath ".env.local" |
        Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
        Select-Object -First 1

    if (-not $line) {
        throw "Missing $Name in .env.local"
    }

    return $line.Substring($line.IndexOf("=") + 1).Trim()
}

$names = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
)

foreach ($name in $names) {
    $value = Get-DotEnvValue -Name $name
    $value | & vercel env add $name production --force
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set $name on Vercel"
    }
}

Write-Host "Vercel production environment variables synchronized."
