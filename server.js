const Discord = require('discord.js');
const Gamedig = require('gamedig');
const _ = require('lodash');

const tools = require('./tools');
const data = require('./data');
const config = require('./config');

const bot = new Discord.Client();

const ID_CMD = 0;
const ID_FUNC = 1;
const ID_INFO = 2;
const ID_HELP = 3;

var knownservers = data.knownservers;
var wfamaps = data.wfamaps;
var byRank = {}
var byTag = {}
var allMaps = []

//init custom extensions
tools.init();

var getArgs = message => message.content.split(' ');

var getRandomWords = () => {
	var w1 = data.rwords1[Math.floor(Math.random() * data.rwords1.length)]; 
	var w2 = data.rwords2[Math.floor(Math.random() * data.rwords2.length)]; 
	
	//console.log(w1 + " " + w2);
	
	return w1 + " " + w2;
}

var getCustomEnding = () => data.customendings[Math.floor(Math.random() * data.customendings.length)]; 

// shot someone msg1 - if someone was mentioned, msg2 - if nobody was mentioned
var shot = (message, msg1, msg2) => {
	var args = message.content.split(' ');
	var msg = "";
	var author = message.author;		
	
	var ments = "";
	var firstMent = true;
	
	message.mentions.users.forEach(u => {			
		if (firstMent) {
			firstMent = false;
			ments += u;		
		} else {
			ments += " " + u;		
		}
	});		
	
	//console.log("mentions: " + ments + ".");
	
	//var matches = message.content.match(/\(([^)]+)\)/);
	var firstI = message.content.indexOf('(') + 1;
	var lastI = message.content.lastIndexOf(')');
	//var custom = matches && matches.length > 0 ? matches[1] : undefined;		
	
	var custom = firstI > 0 && lastI > 0 ? message.content.substring(firstI, lastI) : undefined;
	
	//console.log(custom);
	
	if (ments.length > 0) {			
		msg += msg1
			.replace('%t', ments)
			.replace('%a', author)
	} else {
		msg += msg2
			.replace('%a', author)			
	}
	
	if (msg.indexOf('%r') > 0)
		msg = custom != undefined ? 
			msg.replace('%r', custom) : 
			msg.replace('%r', getRandomWords());
	else if (custom != undefined)
		msg += " " + (custom == 'r' || firstI == lastI ? getCustomEnding() : custom);	
	
	message.channel.send(msg);
}

var getKnownServers = () => {
	var res = "```";
	for(var i = 0; i < knownservers.length; i++)
		res += "" + knownservers[i][0].padEnd(7) + " " + knownservers[i][2] + "\n";
	res += "```";
	return res;
}

var processMaps = () => {
    // Called during startup, saved to global vars
	wfamaps.forEach(function(map) {
        name = map[0]
        rank = map[1]
        tags = map[2].split()
        console.log('processing '+ name +' '+ rank +' ' + tags)
        allMaps.push(name)
        if(!byRank[rank]) {
            console.log("initiating list "+ rank)
            byRank[rank] = []
        }
        byRank[rank].push(name)
        tags.forEach(function(tag) {
            if(!byTag[tag]) {
                console.log("initiating list "+ tag)
                byTag[tag] = []
            } 
            byTag[tag].push(name)
        });
    });
}

var parseMapArgs = (args) => {
    console.log(args.length + ' args:' + args.join(' '))
    var a = {
        'action': null,
        'filter': null,
        'number': 1,
    }
    args.forEach(function(arg) {
        switch(arg) {
            case '\\maps': break;
            case 'pick':            
                console.log('action '+ arg)
                a.action = arg;
                break;
            case /^\d*$/.test(arg) && arg:   
                console.log('number '+ arg)
                a.number = parseInt(arg);
                break;
            default:                
                console.log('filter '+ arg)
                a.filter = arg;
                break;
        }
    });
    console.log(a)
    return a;
}

var getRankedMaps = (message) => {
    var args = parseMapArgs(getArgs(message))
    var ranksSorted = ['S','A','B','C']
    var everything = ''
    ranksSorted.forEach(function(rank) {
        everything += "Rank {0}: {1}\n".format(rank, byRank[rank].join(', '))
    });
    var match = everything

    if(args.filter) {
        // Populate filtered pool
        var pool = byRank[args.filter] || byTag[args.filter] || null
        match = "No matches for "+ args.filter
        // Filter + Random Pick
        if (args.action == 'pick') {
            match = "Random '{0}' Map(s): {2}".format(
                args.filter, 
                args.number,
                _.sampleSize(pool, args.number).join(', ')
            )
        } else if (pool) { 
            // Filter matched something, but no random picking
            match = pool.join(', ')
            match += "'{0}' Maps: {1}\n".format(args.filter, pool)
        }
    } else if (args.action == 'pick') {
        // Non filtered random pick(s)
        match = "Random Map(s): {0}".format(_.sampleSize(allMaps, args.number).join(', '))
    }

	return match;
}

var getGameVersion = (protocol) => {
	switch(protocol) {
		case '43' : return '1.11-1.16';
		case '45' : return '1.17';
		case '48' : return '1.2x';
		case '66' : return '1.30';
		case '67' : return '1.31';
		case '68' : return '1.32';
		default: 'unknown';
	}
}

var getKnownServerIP = (tmp) => {
	for(var i = 0; i < knownservers.length; i++)
		if (knownservers[i][0] == tmp)
			return knownservers[i][1];

	return tmp;
}

//return help if not found return quick info
var getHelp = cmd => {		
	for (var i = 0; i < cmds.length; i++) 
		if (cmds[i][ID_CMD] == cmd) {
			var help = cmds[i][ID_HELP];
			if (!help) {
				var qhelp = cmds[i][ID_INFO];				
				return (qhelp && qhelp.length > 1 ? qhelp.trim() : `No additional info for command \\${cmd}`);					
			} else {
				return help.trim();
			}			
		}
		
	return `I don't know command \\${cmd}`;
}

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var getServerFromArgs = (message, args) => {
	if (args && args.length > 1) {	
		var tmp = args[1].trim();
		var ip = '';
		var port = 27960;
		
		if (tmp.indexOf(':') < 0)	
			tmp = getKnownServerIP(tmp);				

		if (tmp.indexOf(':') > 0) {
			var splits = tmp.split(':');
			ip = splits[0];
			port = parseInt(splits[1]);
			if (!port || port <= 0 || port > 65535 || port == NaN) {
				message.channel.send('Invalid port ' + splits[1] + ', must be between 1 and 65535');
				return;
			}			
		} else {
			ip = tmp;
		}
		
		if (ip.length <= 5) {
			message.channel.send('Invalid ip ' + ip);
			return;
		}
	    
        return [ip, port]
	} else {			
		message.channel.send(getHelp('ping'));
		return;
	}
}

var getServerInfo = (message, ip, port) => {
    var response = '';

    var server = Gamedig.query( {
        'type': 'quake3',
        'host': ip,
        'port': port
    }).then((state) => {
        //console.log(state)
        active = state.players.length + state.bots.length;
        max = state.maxplayers
        a_players = state.players.map(function(p) { return p.name } );
        a_bots = state.bots.map(function(p) { return p.name } );
        count = "({0}/{1})".format(active, max)
        players = ''
        if (active > 0) {
            players = '\n'
            players += a_players.concat(a_bots).join(', ')
            console.log(players)
        }
        response = "`/connect {0}` | {1}ms | {2} {3}{4}".format(state.connect, state.ping, state.map, count, players)
        console.log(response);
        message.channel.send(response);
    }).catch((error) => {
        console.log("Couldn't query "+ip+":"+port);
        console.log(error)
        message.channel.send("Couldn't query "+ip+":"+port+" - down maybe?");
    })
}

// pings servers, gestatus sets serverInfo and players variables
var pingServer = (message, showInfo, showPlayers, editMessage) => {
	var args = !editMessage ? getArgs(message) : editMessage.split(' ');
    var servers = []
    var argServer = getServerFromArgs(message, args)

    if(args.includes('all')) {
	    knownservers.forEach(server => {
            var address = server[1].split(':')
            servers.push({
                'ip': address[0],
                'port': address[1]
            })
        })
    } else if (argServer) {
        servers.push({
            'ip': argServer[0],
            'port': argServer[1]
        })
    }
    servers.forEach(server => {
        getServerInfo(message, server.ip, server.port);
    })
}

//all commands: command name, function, quick info, help description
var cmds = [
	[ 'help', message => { 
		var args = getArgs(message);
	
		var msg = ""
				
		if (args && args.length > 1) {
			var cmd = args[1].trim().toLowerCase();

			msg += getHelp(cmd);
		} else {				
			for (var i = 0; i < cmds.length; i++) 
				if (cmds[i][ID_INFO])
					msg += "**\\" + cmds[i][ID_CMD] + "**" + (cmds[i][ID_INFO].length > 1 ? " - " : "") + cmds[i][ID_INFO];
		}
	
		msg += "";
	
		message.channel.send(msg);
	}, 'display quick help\n' ],		
	
	[ 'ping', message => pingServer(message, false, true), 
	'pings any known server or any ip:port\n', 
	"`\\ping east` - pings east server `\\ping 139.5.28.161:27961` - pings specified ip:port\n`\\servers` - display known servers"],		
	
	[ 'info', message => pingServer(message, true, false), 
	'gets serverinfo of any known server or any ip:port\n', 
	"`\\ping east` - pings east server `\\ping 139.5.28.161:27961` - pings specified ip:port\n`\\servers` - display known servers"],		
	
	[ 'servers', message => message.channel.send("Known servers:\n" + getKnownServers()), 'display known servers\n\n'],
	[ 'maps', message => message.channel.send(getRankedMaps(message)), 'display maps the bot konws ranks for\n\n'],
	
	[ 'md',			message => shot(message, '%a drawing %r with machinegun on wall for %t',	'%a drawing %r with machinegun on wall'),	],		
	[ 'mgdraw',		message => shot(message, '%a drawing %r with machinegun on wall for %t',	'%a drawing %r with machinegun on wall'),	
		'use machinegun to draw random stuff on wall\n',
		'`\\md` - draw random `\\md @Name` - draw random for someone `\\md @Name (sacred relic)` - draw custom for someone'],		
		
	[ 'rd',			message => shot(message, '%a drawing %r with railgun on wall for %t', 		'%a drawing %r with railgun on wall'),		],
	[ 'raildraw',	message => shot(message, '%a drawing %r with railgun on wall for %t', 		'%a drawing %r with railgun on wall'),		
		'use railgun to draw random stuff on wall\n\n',
		'`\\md` - draw random `\\md @Name` - draw random for someone `\\md @Name (colorful rainbow)` - draw custom for someone'],				
	
	[ 'pummel', 	message => shot(message, '%t was pummeled by %a', 				'%a seeking blood'),	 					' ' ],		
	[ 'mg', 		message => shot(message, '%t was machinegunned by %a', 			'%a drawing %r with machinegun on wall'),	' ', "it's machinegun" ],		
	[ 'shotgun', 	message => shot(message, "%t was gunned down by %a", 			'%a shooting in air with shotgun'),			' ' ],
	[ 'grenade', 	message => shot(message, "%t was shredded by %a's shrapnel", 	'%a tripped on its own grenade'), 			' ' ],
	[ 'rocket', 	message => shot(message, "%t ate %a's rocket", 					'%a blew itself up'),						' ' ],	
	[ 'lg', 		message => shot(message, "%t was electrocuted by %a", 			"%a electrolucing it's butt"), 				' ', "it's lightning gun (shaft)" ],
	[ 'shaft', 		message => shot(message, "%t was electrocuted by %a", 			"%a electrolucing it's butt"),					],
	[ 'rail', 		message => shot(message, '%t was railed by %a', 				"%a drawing %r with rail on wall"),			' ' ],
	[ 'plasma', 	message => shot(message, "%t was melted by %a's plasmagun", 	'%a melted itself'), 						' ' ],
	[ 'bfg', 		message => shot(message, "%t was blasted by %a's BFG", 			'%a should have used a smaller gun'), 		
		'use any weapon to attack \n\nExamples: `\\rail @Name` `\\lg` `\\rocket @Name (with quad)` `\\bfg @Name (r)`, write in `( )` any custom ending, r - for random generated' ],
		
	[ 'name',			message => message.channel.send(getRandomWords()),			, 'generate random name' ]
]

//push short info for some quake 3 commands
var pushQ3commands = () => {
	for(var j in data.q3commands) {				
		cmds.push([
			data.q3commands[data.q3commands.length - j - 1][0],
			(message, i) => {				
				i = cmds.length - i - 1;
				
				var defaultVal  = data.q3commands[i][1];
				var recommended = data.q3commands[i][2] ? `recommended: ${data.q3commands[i][2]}` : "";
				
				message.channel.send(data.q3commands[i][3] + "\n`" + `default: ${defaultVal} ${recommended}` + "`");
			}
		]);
	}
}

pushQ3commands();

bot.on('messageReactionAdd', (reaction, user) => {	
	if(reaction.emoji.name === "🔄") {									
		if (!user.bot) {
			var matches = reaction.message.content.match(/`(.*?)`/gi);
			if (matches && matches.length >= 3) {
				var ip = matches[2].replace(/`/g, "");					
				
				reaction.remove(user).then(reaction =>  {
					console.log("Refresh clicked " + user.username);
				}, error =>  {
					console.log('Unexpected error: ' + error);
				});
				
				pingServer(reaction.message, false, true, "\ping " + ip);			
			}			
		}
	}		
});

bot.on('message', message => {	
	//console.log(message.content);
	
	if (message.content.substring(0, 1) == config.prefix) {						
		var args = message.content.substring(1).split(' ');
		var cmd = args[0];
		
		console.log(message.author + " " + message.content);
	   
		//args = args.splice(1);
		
		for(var i = 0; i < cmds.length; i++)
			if (cmd == cmds[i][ID_CMD])
				cmds[i][ID_FUNC](message, i);		
	}		
});

bot.on("guildMemberAdd", member => {
	console.log(`New User "${member.user.username}" has joined "${member.guild.name}"` );

	var channel = member.guild.channels.find("id", config.MAIN_CHANNEL_ID);  

	if (channel) {	  
		var infochannel = member.guild.channels.find("id", config.INFO_CHANNEL_ID);

		var emoji1 = bot.emojis.find("name", "twitchheyguys");
		//var emoji2 = bot.emojis.find("name", "ugandangeweh");
		var emoji3 = bot.emojis.find("name", "pepe");

		var msg = `Welcome to ${member.guild.name} discord server, ${member.user}! ${emoji1 || ""} Please check ${infochannel} channel for quick info and help, have fun ${emoji3 || ""}`;
		channel.send(msg);
	}
	
	var role = member.guild.roles.find("name", "Quakers");
	
	if (role) {
		member.addRole(role).catch(console.error);
	}
});

bot.on('ready', evt => {	
	//bot.user.setUsername(confin.username);
	bot.user.setActivity(config.activity);
    console.log('Connected as: ' + bot.user.tag);    
	//console.log(`Ready to serve on ${bot.guilds.size} servers, for ${bot.users.size} users.`);
});

if (config.token === '')
	throw new Error('Token is not defined');	

processMaps();
bot.login(config.token);

console.log('Connecting...');
