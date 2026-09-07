#!/bin/sh
set -e

echo "Starting MansaMart Expo app..."
echo "API URL: ${EXPO_PUBLIC_API_URL}"

if [ "${EXPO_TUNNEL:-false}" = "true" ]; then
  echo "Expo tunnel mode enabled. This is easier for phones but can be slower."
  npx expo start --tunnel --clear
else
  echo "Expo LAN mode enabled. Open http://localhost:8081 for web, or use the QR code if your phone can reach your computer."
  npx expo start --host lan --clear
fi
