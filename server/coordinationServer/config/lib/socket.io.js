'use strict';

// Load the module dependencies
let config = require('../config'),
    path = require('path'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    cookieParser = require('cookie-parser'),
    socketio = require('socket.io'),
    session = require('express-session'),
    MongoStore = require('connect-mongo')(session);

// Define the Socket.io configuration method
module.exports = function (app, db) {
    let server;

    if (config.secure && config.secure.ssl === true) {
    // Load SSL key and certificate
        let privateKey = fs.readFileSync(path.resolve(config.secure.privateKey), 'utf8');
        let certificate = fs.readFileSync(path.resolve(config.secure.certificate), 'utf8');
        let options = {
            key: privateKey,
            cert: certificate,

            /*
             *  RequestCert : true,
             *  RejectUnauthorized : true,
             */
            secureProtocol: 'TLSv1_method',
            ciphers: [
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-ECDSA-AES256-GCM-SHA384',
                'DHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES128-SHA256',
                'DHE-RSA-AES128-SHA256',
                'ECDHE-RSA-AES256-SHA384',
                'DHE-RSA-AES256-SHA384',
                'ECDHE-RSA-AES256-SHA256',
                'DHE-RSA-AES256-SHA256',
                'HIGH',
                '!aNULL',
                '!eNULL',
                '!EXPORT',
                '!DES',
                '!RC4',
                '!MD5',
                '!PSK',
                '!SRP',
                '!CAMELLIA'
            ].join(':'),
            honorCipherOrder: true
        };

        // Create new HTTPS Server
        server = https.createServer(options, app);
    } else {
    // Create a new HTTP server
        server = http.createServer(app);
    }
    // Create a new Socket.io server
    let io = socketio.listen(server);

    // Create a MongoDB storage object
    let mongoStore = new MongoStore({
        mongooseConnection: db,
        collection: config.sessionCollection
    });

    // Intercept Socket.io's handshake request
    io.use((socket, next) => {
    // Use the 'cookie-parser' module to parse the request cookies
        cookieParser(config.sessionSecret)(socket.request, {}, (err) => {
            // Get the session id from the request cookies
            let sessionId = socket.request.signedCookies ? socket.request.signedCookies[config.sessionKey] : undefined;

            if (!sessionId) {
                return next(new Error('sessionId was not found in socket.request'), false);
            }

            // Use the mongoStorage instance to get the Express session information
            mongoStore.get(sessionId, (err, session) => {
                if (err) {
                    return next(err, false);
                }
                if (!session) {
                    return next(new Error('session was not found for ' + sessionId), false);
                }

                // Set the Socket.io session information
                socket.request.session = session;
            });
        });
    });

    // Add an event listener to the 'connection' event
    io.on('connection', (socket) => {
        config.files.server.sockets.forEach((socketConfiguration) => {
            require(path.resolve(socketConfiguration))(io, socket);
        });
    });

    return server;
};
