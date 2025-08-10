export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  database: {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  },
  email: {
    host: process.env.EMAIL_HOST ,
    port:process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  payment: {
    mtn: {
      apiKey: process.env.MTN_API_KEY,
      subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
      environment: process.env.MTN_ENVIRONMENT || 'sandbox',
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
});