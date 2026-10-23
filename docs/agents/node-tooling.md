# Node tooling

The repository's required Node version is the single source of truth in `.nvmrc`. Use that version before running `npm`, `npx`, or project scripts.

On Unix-like shells with nvm:

```sh
nvm use
```

On Windows with nvm-windows:

```powershell
nvm use (Get-Content .nvmrc).Trim()
```

If the runtime manager is not available to the shell, prepend an installed matching Node directory to the current process PATH before running the command. Keep this change process-local; do not hard-code a user-specific installation path in the repository:

```powershell
$nodeRoot = Get-ChildItem "$env:USERPROFILE\.nvm\versions\node" -Directory |
  Where-Object { $_.Name -like "v$((Get-Content .nvmrc).Trim()).*" } |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$nodeRoot\bin;$nodeRoot;$env:Path"
npm ci
```

Completion criterion: `node --version` satisfies `.nvmrc` and `npm --version` resolves before project checks run.
