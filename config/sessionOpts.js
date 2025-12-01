const MongoStore = require('connect-mongo');

const isProd            = process.env.NODE_ENV === 'production';
const diarkeia_session  = Number(process.env.DIARKEIA_SESSION || 30); // λεπτά
const secret            = process.env.SESSION_SECRET || process.env.SECRET || "default-secret";
const mongoUrl          = process.env.MONGODB_URL;

const sessionOpts = {
    name: 'sid',
    secret,
    resave: false,
    saveUninitialized: false,
    store: mongoUrl
		? MongoStore.create({
				mongoUrl,
				ttl: 60 * diarkeia_session,   // λεπτά
				autoRemove: 'native',
				touchAfter: 24 * 3600,
			})
		: undefined,                      // MemoryStore σε dev
    cookie: {
		maxAge  : 1000 * 60 * diarkeia_session,
		httpOnly: true,
		secure  : isProd,                 // dev:false, prod:true (με trust proxy)
		sameSite: 'lax',
		path    : '/',                    // ⚠️ ίδιο στο clearCookie
		...(isProd && process.env.COOKIE_DOMAIN && { 
    	    domain: process.env.COOKIE_DOMAIN 
    	})
  	},
	rolling: false,
  	proxy: isProd,
};

module.exports = { sessionOpts, isProd };
