$filePath = 'D:\Paper\src-tauri\target\debug\deps\research_paper_scraper_lib-0f5a2626941c9a03.exe'
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$str = [System.Text.Encoding]::ASCII.GetString($bytes)
$matches = [regex]::Matches($str, '[a-zA-Z0-9_\-]{2,30}\.dll', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$matches | ForEach-Object { $_.Value } | Sort-Object -Unique
