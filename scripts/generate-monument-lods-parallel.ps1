param(
    [ValidateRange(1, 8)]
    [int]$ThrottleLimit = 3,
    [string]$Only = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $root 'assets\media\models\monuments'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDirectory = Join-Path $env:TEMP "raidlands-monument-lod-parallel-$stamp"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$queue = New-Object 'System.Collections.Generic.Queue[string]'
$assetIds = if ($Only.Trim() -ne '') {
    $Only.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' } | Sort-Object -Unique
} else {
    Get-ChildItem -LiteralPath $sourceDirectory -Filter '*.glb' | Sort-Object Name | ForEach-Object { $_.BaseName }
}
$assetIds | ForEach-Object { $queue.Enqueue($_) }

$running = @()
$failures = @()
$completed = 0
$total = $queue.Count

while ($queue.Count -gt 0 -or $running.Count -gt 0) {
    while ($queue.Count -gt 0 -and $running.Count -lt $ThrottleLimit) {
        $id = $queue.Dequeue()
        $stdout = Join-Path $logDirectory "$id.out.log"
        $stderr = Join-Path $logDirectory "$id.err.log"
        $process = Start-Process -FilePath 'npm.cmd' `
            -ArgumentList @('run', 'monuments:lod', '--', "--only=$id") `
            -WorkingDirectory $root `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -WindowStyle Hidden `
            -PassThru
        $running += [pscustomobject]@{ Id = $id; Process = $process; Stdout = $stdout; Stderr = $stderr }
    }

    Start-Sleep -Milliseconds 500
    $next = @()
    foreach ($job in $running) {
        $job.Process.Refresh()
        if (-not $job.Process.HasExited) {
            $next += $job
            continue
        }
        $job.Process.WaitForExit()
        $completed++
        $stdoutRaw = if (Test-Path -LiteralPath $job.Stdout) { Get-Content -LiteralPath $job.Stdout -Raw } else { '' }
        $completedSuccessfully = $job.Process.ExitCode -eq 0 -or ([string]$stdoutRaw).Contains("Generated and validated $($job.Id)")
        if (-not $completedSuccessfully) {
            $errorRaw = if (Test-Path -LiteralPath $job.Stderr) { Get-Content -LiteralPath $job.Stderr -Raw } else { '' }
            $errorText = if ($null -eq $errorRaw) { '' } else { ([string]$errorRaw).Trim() }
            $failures += "$($job.Id): $errorText"
            Write-Host "[$completed/$total] FAILED $($job.Id)"
        } else {
            Write-Host "[$completed/$total] $($job.Id)"
        }
    }
    $running = $next
}

if ($failures.Count -gt 0) {
    throw "Monument LOD generation failed:`n$($failures -join "`n")`nLogs: $logDirectory"
}

& npm.cmd run monuments:lod -- --manifest-only
if ($LASTEXITCODE -ne 0) { throw "Manifest reconciliation failed. Logs: $logDirectory" }
Write-Host "Generated $total monument recipes with throttle $ThrottleLimit. Logs: $logDirectory"
