# hubot-google-auth
Hubot utility functions for authenticating to google apis

Check out an example script [here](https://github.com/aaaschmitt/hubot-googledrive-search/blob/master/src/hubot-googledrive-search.js).

## Install
```
npm install --save hubot-google-auth
```

## Configuration

You will need to generate a client\_secret.json file to authenticate via google's oauth2 protocol. Instructions for doing this can be found by following **step 1** [here](https://developers.google.com/drive/v2/web/quickstart/nodejs).

Using your client\_secret.json you can initialize the HubotGoogleAuth object like this:
```
HubotGoogleAuth = require 'hubot-google-auth'

# Note that we need acess to the robot's brain to init the auth object
# Scopes should be a text string of scope urls, each seperated by a semicolon (;)
# Service name should be the google service that is being used or that you would like to share tokens between bots for
auth = new HubotGoogoleAuth ServiceName, CLIENT_ID, CLIENT_SECRET, REDIRECT_URL, SCOPES, robot.brain
```

## Usage
Inteneded be be used by hubot scripts to perform google auth by storing api tokens in the brain relative to a certain service name that is provided.  This is useful because it allows you to require this module in several different scripts that need to use google auth and have all of these scripts use the same keys to get and set api tokens from hubots brain.

## Sample script

See an extened example script [here](https://github.com/aaaschmitt/hubot-googledrive-search/blob/master/src/hubot-googledrive-search.js). Check out the package that it comes from [here](https://www.npmjs.com/package/hubot-googledrive-search).

```
CLIENT_ID = process.env.HUBOT_DRIVE_CLIENT_ID
CLIENT_SECRET = process.env.HUBOT_DRIVE_CLIENT_SECRET
REDIRECT_URL = process.env.HUBOT_DRIVE_REDIRECT_URL
SCOPES = 'https://www.googleapis.com/auth/drive'

HubotGoogleAuth = require 'hubot-google-auth'

module.exports = (robot) ->
	
	# We need to initialize the auth client here because it is initialzed with the brain
    auth = new HubotGoogleAuth "GoogleDrive", CLIENT_ID, CLIENT_SECRET, REDIRECT_URL, SCOPES, robot.brain

    # Tokens may be null initially
    tokens = auth.getTokens()

    # Google apis are exposed via the google object
    # See the googleapis npm package for how to use these apis
    drive = auth.google.drive('v2')

    robot.respond /show tokens/i, (msg)->

    	if !tokens.token
    		msg.send "No tokens found"
    		msg.send "Please copy the code at this url #{auth.generateAuthUrl()}"
    		msg.send "Then use the command @hubot set code <code>"
    		return

    	msg.send auth.getTokens()

    robot.respond /set code (.+)/i, (msg)->
    	code = msg.match[1]

    	# Gets new token and refresh token and stores into brain
    	auth.setCode code, (err, resp)->
    		if err
    			msg.send "Could not obtain tokens with code: #{code}"
    			return

    		msg.send "Code successfully set. Tokens now stored in brain for service: #{auth.serviceName}"

    robot.respond /drive request/i, (msg)->
		drive.files.get {fileId: 'some_id'}, (err, resp)->
			if err
				return msg.send "ERROR: could not get file: #{err}"

			msg.send resp.title
```	
