Babel preset fix:
This version explicitly adds babel-preset-expo to devDependencies.
After extracting, run:
  rmdir /s /q node_modules
  del package-lock.json
  npm install
  npx expo start --host lan --clear
