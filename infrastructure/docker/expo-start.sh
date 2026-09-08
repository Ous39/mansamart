#!/bin/sh
set -e

echo "Starting ${APP_PACKAGE:?APP_PACKAGE is required}..."
echo "API URL: ${EXPO_PUBLIC_API_URL}"

if [ "${EXPO_TUNNEL:-false}" = "true" ]; then
  echo "Expo tunnel mode enabled. This is easier for phones but can be slower."
  pnpm --filter "$APP_PACKAGE" exec expo start --tunnel --clear
else
  pnpm --filter "$APP_PACKAGE" dev -- --clear
fi
