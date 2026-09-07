# Windows Install Fix for MansaMart

You are using PowerShell, not Linux bash. Do not use `rm -rf`.

Recommended location:

```powershell
C:\Users\OUSMAN JALLOW\Documents\Projects\mansamart
```

Avoid running Node projects inside `C:\Program Files\Ampps\www` because Windows often blocks deletion of `node_modules` there and causes EPERM errors.

## Clean install

Open PowerShell as Administrator, then run:

```powershell
cd "C:\Program Files\Ampps\www\mansamart"
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Stop-Process -Name npm -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
npm run typecheck
npm run dev:server
```

If you extract this updated ZIP, the included package-lock.json has already been corrected so it no longer points to the internal sandbox registry.

## Why your old install failed

1. `rm -rf` is Linux/macOS syntax. PowerShell uses `Remove-Item -Recurse -Force`.
2. `EPERM` happened because Windows could not remove locked files inside `node_modules`, likely because the project is under `Program Files` or a Node process was still running.
3. `ETIMEDOUT ... applied-caas-gateway...` happened because the previous package-lock had sandbox-only registry URLs. Your computer cannot access that internal registry.
4. `tsc` and `cross-env` were not recognized because npm install failed before dependencies were fully installed.
