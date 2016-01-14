// Description:
//   Some tools for authenticating to google's api and using it with hubot
//
// Dependencies:
//   google-api-nodejs-client --> npm googleapis
//
// Author:
//   Andrew Schmitt
var google = require('googleapis');

// Make sure that these keys do not conflict with things that are already in your hubot's brain
var TOKEN_KEY = 'GOOGLE_AUTH_TOKEN',
    REFRESH_KEY = 'GOOGLE_AUTH_REFRESH_TOKEN',
    EXPIRY_KEY = 'GOOGLE_AUTH_EXPIRE_TIME';


/**
 * Initialzie the module will all the necessary google information 
 * along with the brain of your robot.
 * This module will then store tokens into your robot's brain for you using the keys above.
 */
function HubotGoogleAuth(clientId, clientSecret, redirectUrl, scopes, brain) {
    var OAuth2 = google.auth.OAuth2;
    this.oauthClient = new OAuth2(clientId, clientSecret, redirectUrl);
    this.scopes = scopes;
    this.google = google;
    google.options({
        auth: this.oauthClient
    })
    this.brain = brain;
}

HubotGoogleAuth.prototype = {

    /**
     * Stores the token and expire time into the robot brain and
     * Sets it in the oauthClient
     *
     * @param  token  the token object returned from google oauth2
     */
    storeToken: function(token) {
        oauthClient.setCredentials(token);
        this.brain.set(TOKEN_KEY, token.access_token);
        if (token.refresh_token) {
            this.brain.set(REFRESH_KEY, token.refresh_token);
        }
        this.brain.set(EXPIRY_KEY, +token.expiry_date);
        this.brain.save();
        this.brain.resetSaveInterval(60);
    },

    /**
     * Initially tokens must be created from the command line.
     * This requires a user manually inputting a code so it cannot be done by the bot alone.
     * This generates the url where the code can be obtained
     */
    generateAuthUrl: function() {

        var authUrl = oauthClient.generateAuthUrl({
            access_type: 'offline', //offline means that we get a refresh token
            scope: this.scopes.split(';')
        });

        return authUrl;
    },

    /**
     * Used to set the code provided by the generated auth url. 
     * This code is generated for a user and is needed to initiate the oauth2 handshake.
     *
     * @param  code  the code obtained by a user from the auth url
     */
    setCode: function(code, cb) {
        var self = this;
        oauthClient.getToken(code, function(err, token) {
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
        var at = this.brain.get(TOKEN_KEY),
            rt = this.brain.get(REFRESH_KEY);

        if (at == null || rt == null) {

            cb({
                err: null,
                msg: 'Error: No tokens found. Please authorize this app and store a refresh token'
            });
            return;
        }

        var expirTime = this.brain.get(EXPIRY_KEY),
            curTime = (new Date()) / 1;

        var self = this;
        if (expirTime < curTime) {
            oauthClient.refreshAccessToken(function(err, token) {
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
            token: this.brain.get(TOKEN_KEY),
            refresh_token: this.brain.get(REFRESH_KEY),
            expire_date: this.brain.get(EXPIRY_KEY)
        }
    }

}

module.exports = HubotGoogleAuth;