# Commit each file individually and push to remote
# This script assumes you are in the repository root.

# Get list of untracked and modified files
git status --porcelain | ForEach-Object {
    $status = $_.Substring(0,2).Trim()
    $file = $_.Substring(3).Trim()
    if ($status -eq '??' -or $status -eq 'M') {
        Write-Host "Adding and committing $file"
        git add "${file}"
        git commit -m "Add $file"
    }
}

# Finally push all commits
git push -u origin main
