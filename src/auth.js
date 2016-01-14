// Description:
//   Perform google api oauth for you hubot
//
// Dependencies:
//   google-api-nodejs-client --> npm googleapis
//   requires a hubot brain
//
// Commands:
//   hubot google-auth code <code>  
//          -  used to authenticate the bot initially (see setCode and generateAuthUrl)
//
//   hubot google-auth tokens  
//          -  shows the refresh token, access token, and expiration time for the access token
//
// Author:
//  Andrew Schmitt
var google = require('googleapis');

// Make sure that these keys do not conflict with things that are already in your hubot's brain
var TOKEN_KEY = 'GOOGLE_AUTH_TOKEN',
    REFRESH_KEY = 'GOOGLE_AUTH_REFRESH_TOKEN',
    EXPIRY_KEY = 'GOOGLE_AUTH_EXPIRE_TIME';

var CLIENT_ID = process.env.HUBOT_GOOGLE_AUTH_CLIENT_ID,
    CLIENT_SECRET = process.env.HUBOT_GOOGLE_AUTH_CLIENT_SECRET,
    REDIRECT_URL = process.env.HUBOT_GOOGLE_AUTH_REDIRECT_URL,
    SCOPES = process.env.HUBOT_GOOGLE_AUTH_SCOPES;

// The object that is exported
var auth = {};

// Initialize the oauthClient
var OAuth2 = google.auth.OAuth2;
var oauthClient = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({
    auth: oauthClient
});

/**
 * Stores the token and expire time into the robot brain and
 * Sets it in the oauthClient
 *
 * @param  token  the token object returned from google oauth2
 */
auth.storeToken = function(token) {
    oauthClient.setCredentials(token);
    robot.brain.set(TOKEN_KEY, token.access_token);
    if (token.refresh_token) {
        robot.brain.set(REFRESH_KEY, token.refresh_token);
    }
    robot.brain.set(EXPIRY_KEY, +token.expiry_date);
    robot.brain.save();
    robot.brain.resetSaveInterval(60);
}

/**
 * Initially tokens must be created from the command line.
 * This requires a user manually inputting a code so it cannot be done by the bot alone.
 * This generates the url where the code can be obtained
 */
auth.generateAuthUrl = function() {
    if (!SCOPES) {
        return null;
    }

    var authUrl = oauthClient.generateAuthUrl({
        access_type: 'offline', //offline means that we get a refresh token
        scope: SCOPES.split(';')
    });

    return authUrl;
}

/**
 * Used to set the code provided by the generated auth url. 
 * This code is generated for a user and is needed to initiate the oauth2 handshake.
 *
 * @param  code  the code obtained by a user from the auth url
 */
auth.setCode = function(code, cb) {
    oauthClient.getToken(code, function(err, token) {
        if (err) {
            console.log(err);
            cb({
                err: err,
                msg: 'Error while trying to retrieve access token'
            });
            return;
        }
        storeToken(token);
        cb(null, {
            resp: token,
            msg: "Google auth code successfully set"
        });
    });
}

/**
 * Checks the current expire time and determines if the token is valid.
 * Refreshes the token if it is not valid.
 *
 * @param  cb  the callback function (err, resp), use this to make api calls
 */
auth.validateToken = function(cb) {
    var at = robot.brain.get(TOKEN_KEY),
        rt = robot.brain.get(REFRESH_KEY);

    if (at == null || rt == null) {
        var url = generateAuthUrl();
        var authMsg;
        if (!url) {
            authMsg = 'Please set the HUBOT_GOOGLE_AUTH_SCOPES env variable';
        } else {
            authMsg = `Authorize this app by visiting this url :\n ${url}` +
                '\nThen use @hubot google set code <code>';
        }

        cb({
            err: null,
            msg: authMsg
        });
        return;
    }

    var expirTime = robot.brain.get(EXPIRY_KEY),
        curTime = (new Date()) / 1;

    if (expirTime < curTime) {
        oauthClient.refreshAccessToken(function(err, token) {
            if (err != null) {
                cb({
                    err: err,
                    msg: 'Google Authentication Error: error refreshing token'
                }, null);
                return;
            }

            auth.storeToken(token);
            cb(null, {
                resp: token,
                msg: 'Token refreshed'
            });
        });
    } else {
        cb(null);
    }
}

/**
 * Use this object to make api calls
 * ex: auth.google.drive.get
 */
auth.google = google

/**
 * Returns the current set of tokens
 */
auth.getTokens = function() {
    return {
        token: robot.brain.get(TOKEN_KEY),
        refresh_token: robot.brain.get(REFRESH_KEY),
        expire_date: robot.brain.get(EXPIRY_KEY)
    }
}

// Export robot functions (it's still ok to have this required in multiple hubot scripts)
var initialBrainLoad = true;
module.exports = function(robot) {

    robot.respond(/google-auth(\s+set)?\s+code\s+([^\s]+)/i, {
        id: 'google-auth.set-code'
    }, function(msg) {
        var code = msg.match[2];
        msg.send('Attempting to set code...')
        auth.setCode(code, function(err, resp) {
            if (err) {
                msg.send(err.msg);
                return;
            }

            msg.send(resp.msg);
        });
    });

    robot.respond(/google-auth tokens/i, {
        id: 'google-auth.show-tokens'
    }, function(msg) {
        var tokens = auth.getTokens();
        for (var name in tokens) {
            msg.send(`name: ${tokens[name]}`);
        }
    });

    // Set credentials on load. Does not validate/refresh tokens
    robot.brain.on('loaded', function() {
        if (!initialBrainLoad) {
            return;
        }

        initialBrainLoad = false;
        var at = robot.brain.get(TOKEN_KEY),
            rt = robot.brain.get(REFRESH_KEY);

        oauthClient.setCredentials({
            access_token: at,
            refresh_token: rt
        });
    });
}

// Export the utility functions
for (var func in auth) {
    module.exports[func] = auth[func];
}