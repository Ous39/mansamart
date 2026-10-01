const appJson = require("./app.json");

module.exports = () => ({
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    config: process.env.GOOGLE_MAPS_CUSTOMER_IOS_API_KEY
      ? { googleMapsApiKey: process.env.GOOGLE_MAPS_CUSTOMER_IOS_API_KEY }
      : undefined,
  },
  android: {
    ...appJson.expo.android,
    config: process.env.GOOGLE_MAPS_CUSTOMER_ANDROID_API_KEY
      ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_CUSTOMER_ANDROID_API_KEY } }
      : undefined,
  },
});
