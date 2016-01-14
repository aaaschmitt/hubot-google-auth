# An example script demonstraing how to use this script in your own hubot scripts
# Since this script exports robot functionality it can also loaded as an external script which
# gives you access to the hubot commands

googleAuth = require './src/auth.js'


module.exports = function(robot) ->
	
	robot.respond /is token valid/i, (msg)-> 
		googleAuth.validateToken (err, resp)->
			if err
				msg.send(err.msg) # This will send the inital authorization msg
				return

			msg.send('Yes it is!')