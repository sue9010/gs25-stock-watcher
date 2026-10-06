$ErrorActionPreference = "Stop"

$projectRef = "zbopnlzsqlmxlrknyugu"
$cronSecret = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")

try {
    npx supabase secrets set `
        "CRON_SECRET=$cronSecret" `
        "DAISO_API_BASE_URL=https://mcp.aka.page" `
        --project-ref $projectRef

    if ($LASTEXITCODE -ne 0) { throw "Supabase Edge Function cron secret setup failed" }

    $sql = "delete from vault.secrets where name = 'gs25_cron_secret'; select vault.create_secret('$cronSecret', 'gs25_cron_secret', 'GS25 stock check cron authentication');"

    npx supabase db query --linked $sql
    if ($LASTEXITCODE -ne 0) { throw "Supabase Vault cron secret setup failed" }

    npx supabase db query --linked --file supabase/cron/setup.sql
    if ($LASTEXITCODE -ne 0) { throw "Supabase Cron job setup failed" }

    Write-Host "Supabase Cron secret and job configured."
}
finally {
    $cronSecret = $null
}
