export default () => ({
  app: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  database: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
  },
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  payment: {
    mtn: {
      apiUserId: process.env.MTN_API_USER_ID,
      apiKey: process.env.MTN_API_KEY,
      subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
      environment: process.env.MTN_ENVIRONMENT ?? 'sandbox',
    },
    airtel: {
      apiKey: process.env.AIRTEL_API_KEY,
      clientId: process.env.AIRTEL_CLIENT_ID,
      clientSecret: process.env.AIRTEL_CLIENT_SECRET,
    },
    africell: {
      apiKey: process.env.AFRICELL_API_KEY,
    },
  },
  delivery: {
    storeLatitude: parseFloat(process.env.DELIVERY_STORE_LATITUDE ?? '0'),
    storeLongitude: parseFloat(process.env.DELIVERY_STORE_LONGITUDE ?? '0'),
    maxDistanceKm: parseFloat(process.env.DELIVERY_MAX_DISTANCE_KM ?? '0'),
    baseFee: parseFloat(process.env.DELIVERY_BASE_FEE ?? '0'),
    feePerKm: parseFloat(process.env.DELIVERY_FEE_PER_KM ?? '0'),
    averageMinutes: parseInt(process.env.DELIVERY_AVERAGE_MINUTES ?? '30', 10),
    bomboMinLatitude: parseFloat(process.env.DELIVERY_BOMBO_MIN_LATITUDE ?? '0'),
    bomboMaxLatitude: parseFloat(process.env.DELIVERY_BOMBO_MAX_LATITUDE ?? '0'),
    bomboMinLongitude: parseFloat(process.env.DELIVERY_BOMBO_MIN_LONGITUDE ?? '0'),
    bomboMaxLongitude: parseFloat(process.env.DELIVERY_BOMBO_MAX_LONGITUDE ?? '0'),
  },
});
