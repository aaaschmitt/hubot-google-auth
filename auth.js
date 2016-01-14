// Description:
//   Some tools for authenticating to google's api and using it with hubot
//
// Dependencies:
//   google-api-nodejs-client --> npm googleapis
//
// Author:
//   Andrew Schmitt
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

/**
 * Initialzie the module will all the necessary google information 
 * along with the brain of your robot.
 * This module will then store tokens into your robot's brain for you using the keys above.
 *
 * @param  serviceName   the name of google service this client should use. 
 *                       Keys names for the brain are generated based on service name.
 *                       This allows scripts to share the same service or use different services
 * @param  clientId      string, found in your client_secret.json
 * @param  clientSecret  string, found in your client_secret.json
 * @param  redirectUrl   string, found in your client_secret.json
 * @param  scopes        string of scope urls, separated by semicolons
 * @param  brain         your robot's brain
 */
function HubotGoogleAuth(serviceName, clientId, clientSecret, redirectUrl, scopes, brain) {
    var client = new OAuth2(clientId, clientSecret, redirectUrl),
        tok_key = serviceName + '_GOOGLE_AUTH_TOKEN',
        ref_key = serviceName + '_GOOGLE_AUTH_REFRESH_TOKEN',
        exp_key = serviceName + '_GOOGLE_AUTH_EXPIRE_TIME';

    // may be null initially. It is your scipts job to hanlde initial app authorization
    // See generateAuthUrl and setCode
    client.setCredentials({
        access_token: brain.get(tok_key),
        refresh_token: brain.get(ref_key)
    });

    // Tells the google object to use this client to authenticate all requests
    google.options({
        auth: client
    });

    this.oauthClient = client
    this.scopes = scopes;
    this.google = google;

    // Make sure that these keys do not conflict with things that are already in your hubot's brain
    this.TOKEN_KEY = tok_key;
    this.REFRESH_KEY = ref_key;
    this.EXPIRY_KEY = exp_key;
    this.serviceName = serviceName;
}

HubotGoogleAuth.prototype = {

    /**
     * Stores the token and expire time into the robot brain and
     * Sets it in the oauthClient
     *
     * @param  token  the token object returned from google oauth2
     */
    storeToken: function(token) {
        this.oauthClient.setCredentials(token);
        this.brain.set(this.TOKEN_KEY, token.access_token);
        if (token.refresh_token) {
            this.brain.set(this.REFRESH_KEY, token.refresh_token);
        }
        this.brain.set(this.EXPIRY_KEY, +token.expiry_date);
        this.brain.save();
        this.brain.resetSaveInterval(60);
    },

    /**
     * Initially tokens must be created from the command line.
     * This requires a user manually inputting a code so it cannot be done by the bot alone.
     * This generates the url where the code can be obtained
     *
     * Generally a script should check if a token exists by calling auth.getTokens() below.
     * If no tokens are found then generate this auth url and send a message to the user
     * The user visits the auth url and then sets the code using the setCode function below
     */
    generateAuthUrl: function() {

        var authUrl = this.oauthClient.generateAuthUrl({
            access_type: 'offline', //offline means that we get a refresh token
            scope: this.scopes.split(';')
        });

        return authUrl;
    },

    /**
     * Used to set the code provided by the generated auth url. 
     * This code is generated for a user and is needed to initiate the oauth2 handshake
     *
     * @param  code  the code obtained by a user from the auth url
     */
    setCode: function(code, cb) {
        var self = this;
        this.oauthClient.getToken(code, function(err, token) {
            if (err) {
                console.log(err);
                cb({
                    err: err,
                    msg: 'Error while trying to retrieve access token'
                });
                return;
            }
            self.storeToken(token);
            cb(null, {
                resp: token,
                msg: "Google auth code successfully set"
            });
        });
    },

    /**
     * Checks the current expire time and determines if the token is valid.
     * Refreshes the token if it is not valid.
     *
     * @param  cb  the callback function (err, resp), use this to make api calls
     */
    validateToken: function(brain, cb) {
        var at = this.brain.get(this.TOKEN_KEY),
            rt = this.brain.get(this.REFRESH_KEY);

        if (at == null || rt == null) {

            cb({
                err: null,
                msg: 'Error: No tokens found. Please authorize this app and store a refresh token'
            });
            return;
        }

        var expirTime = this.brain.get(this.EXPIRY_KEY),
            curTime = (new Date()) / 1;

        var self = this;
        if (expirTime < curTime) {
            this.oauthClient.refreshAccessToken(function(err, token) {
                if (err != null) {
                    cb({
                        err: err,
                        msg: 'Google Authentication Error: error refreshing token'
                    }, null);
                    return;
                }

                self.storeToken(token);
                cb(null, {
                    resp: token,
                    msg: 'Token refreshed'
                });
            });
        } else {
            cb(null);
        }
    },

    /**
     * Returns the current set of tokens
     */
    getTokens: function() {
        return {
            token: this.brain.get(this.TOKEN_KEY),
            refresh_token: this.brain.get(this.REFRESH_KEY),
            expire_date: this.brain.get(this.EXPIRY_KEY)
        }
    }

}

module.exports = HubotGoogleAuth;