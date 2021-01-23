// Imports
const Discord = require("discord.js");
const moment = require("moment");
const momenttimezone = require("moment-timezone");
const fs = require("fs");


// Define the client that we'll reference. This is used to receive messages and sign in. 
var client = new Discord.Client();

// We'll store an array of each server's complimented people as an array nested inside a property on this variable. 
// An hourly function will clear a compliment given or whatever is set as the timeout at the top of the script.
var complimented = new Object(); 
var complimentchance = new Object(); // Chance for a compliment as a float per message as a variable here. 
var timeoutref = new Object(); // Reference for each timeout. Clear it using the properties of this object. 

// Reminders - each property is a unique ID with an array that contains the timeout. 
var remindersarray = new Object();

// Default chance and time if they are not set. Chance is a float, time is an integer. 
var chancedefault = 3.0;
var timeoutdefault = 60;

client.on('ready', () => {
    client.guilds.cache.forEach((guild) => {
        console.log(guild.name+" - "+guild.id);
        timerSet(guild.id,-1);
    })
    startReminders();
});

client.on('message', msg => {
    var commands = fs.readFileSync('commands.txt').toString().split('\n'); // Fetches each command split by enter commands. Each command should be lower case. 
    var commanded = false;
    commands.forEach((cmd) => {
        let command = cmd.replace("\r","");
        if ((msg.content.toLowerCase().search(command) == 0)&&(commanded == false)) { // We found a command to action on - We'll pass this into handleCommand();
            try {
                if (msg.member.user.bot == false) {
                    handleCommand(command,msg);
                    commanded = true;
                }
            }
            catch (err) {
                console.log(err);
            }
        }
    })
    if ((commanded == false)&&(msg.channel.type == "text")) {
        try {
            if (msg.member.user.bot == false) {
                rollCompliment(msg);
            }
        }
        catch (err) {
            console.log(err);
        };
    }
});

// This will actually handle the commands. We should only ever get this passed to us if it's valid, however if it throws, we're fine.
function handleCommand(cmd,msg) {
    if (cmd == "compliment") {
        if (msg.mentions.members.first()) { // Check if someone is tagged. 
            fetchCompliment(msg,msg.mentions.members.first())
        }
        else if (msg.content.toLowerCase().search("compliment me") == 0) { // Check if we said to compliment ourselves
            fetchCompliment(msg,msg.member)
        }
    }
    if (cmd == "setcomplimenttimeout") {
        if (msg.member.permissions.has(0x00002000)) {
            var newtime = msg.content.match(/\d+/);
            if (newtime == null) {
                newtime = -1;
            }
            timerSet(msg.guild.id, newtime);
            if (newtime != -1) {
                msg.channel.send(`Set the compliment timeout for this server to ${newtime} minutes. The timer has been reset.`);
            }
            else {
                msg.channel.send(`Reset the compliment timeout for this server.`)
            }
        }
        else {
            msg.reply("you don't have permission to do that!")
        }
    }
    if (cmd == "setcomplimentchance") {
        if (msg.member.permissions.has(0x00002000)) {
            var newchance = msg.content.match(/\d+/);
            var newchancefloat = msg.content.match(/\d+\.\d+/);
            if (newchancefloat != null) {
                newchance = newchancefloat;
            }
            if (newchance == null) {
                msg.channel.send("Please say a number either as a whole digit or decimal (eg. 10 or 10.00).");
            }
            else if ((newchance > 99.0) || (newchance < 0.0)) {
                msg.channel.send(`Your chance must be between 0% and 99%. You entered ${newchance}`);
            } 
            else {
                chanceSet(msg.guild.id,newchance);
            }
        }
        else {
            msg.reply("you don't have permission to do that!");
        }
    }
    if (cmd == "remindme") {
        var messagestring = msg.content.slice(9);
        var testdaily = messagestring.match(/daily/i);
        var testweekly = messagestring.match(/weekly/i);
        var testmonthly = messagestring.match(/monthly/i);
        var testinhours = messagestring.match(/\sin\s\d+\shours/i);
        var testinminutes = messagestring.match(/\sin\s\d+\sminutes/i);
        var testat = messagestring.match(/\sat\s(([1-9]|[0-1][0-2])(pm|am)|([1-9]|[0-1][0-2]):([0-5]?[0-9]|60)(pm|am))/i);
        var testtime = messagestring.match(/(([1-9]|[0-1][0-2])(pm|am)|([1-9]|[0-1][0-2]):([0-5]?[0-9]|60)(pm|am))/i);
        var testeveryday = messagestring.match(/every\sday/i);
        var testeveryweek = messagestring.match(/every\sweek/i);
        var testeverymonth = messagestring.match(/every\smonth/i);
        var testdm = messagestring.match(/\sdm(\s|\.|$)/i);
        if (testdaily != null) { messagestring = messagestring.replace(testdaily[0],"") };
        if (testweekly != null) { messagestring = messagestring.replace(testweekly[0],"") };
        if (testmonthly != null) { messagestring = messagestring.replace(testmonthly[0],"") };
        if (testinhours != null) { messagestring = messagestring.replace(testinhours[0],"") };
        if (testinminutes != null) { messagestring = messagestring.replace(testinminutes[0],"") };
        if (testat != null) { console.log(testat); messagestring = messagestring.replace(testat[0],""); console.log(messagestring)};
        if (testtime != null) { messagestring = messagestring.replace(testtime[0],"") };
        if (testeveryday != null) { messagestring = messagestring.replace(testeveryday[0],"") };
        if (testeveryweek != null) { messagestring = messagestring.replace(testeveryweek[0],"") };
        if (testeverymonth != null) { messagestring = messagestring.replace(testeverymonth[0],"") };
        if (testdm != null) { messagestring = messagestring.replace(testdm[0],"") };
        if ((testat != null)||(testtime != null)) { // We were given an exact time to test for. 
            var occurence = "once";
            if ((testdaily != null)||(testeveryday != null)) {
                occurence = "daily";
            }
            else if ((testweekly != null)||(testeveryweek != null)) {
                occurence = "weekly"
            }
            else if ((testmonthly != null)||(testeverymonth != null)) {
                occurence = "monthly"
            }
            var momenttime = moment();
            var testhour = testtime[0].match(/([1-9]|[0-1][0-2])/i);
            var testminute = testtime[0].match(/:([0-5]?[0-9]|60)(pm|am)/i);
            console.log(testhour);
            console.log(testminute);
            if (testminute == null) {
                testminute = parseInt("00");
            }
            else {
                if (testminute[2].toLowerCase() == "pm") {
                    testhour[0] = parseInt(testhour[0])+12;
                }
                testminute = testminute[0].slice(1,-2);
            }
            momenttime.hours(testhour[0]);
            momenttime.minutes(testminute);
            if (testdm != null) {
                setReminder(msg.author.id,messagestring,momenttime,occurence,true);
            }
            else {
                setReminder(msg.author.id,messagestring,momenttime,occurence);
            }
        }
        else if (testinhours != null) {
            var momenttime = moment();
            var timeslice = parseInt(testinhours[0].slice(4,-6)); // Slice only the integer giving us the hours value.
            momenttime.add(timeslice,"h");
            momenttime.startOf('minute');
            if (testdm != null) {
                setReminder(msg.author.id,messagestring,momenttime,"once",true);
            }
            else {
                setReminder(msg.author.id,messagestring,momenttime,"once");
            }
        }
        else if (testinminutes != null) {
            var momenttime = moment();
            var timeslice = parseInt(testinminutes[0].slice(4,-8)); // Slice only the integer giving us the minutes value.
            console.log(testinminutes[0]);
            console.log(timeslice);
            momenttime.add(timeslice,"m");
            momenttime.startOf('minute');
            if (testdm != null) {
                setReminder(msg.author.id,messagestring,momenttime,"once",true);
            }
            else {
                setReminder(msg.author.id,messagestring,momenttime,"once");
            }
        }
    }
}

// Rolls a compliment based on the chance set per server. This will be stored in an array that is loaded at runtime or whenever a new chance is set. 
function rollCompliment(msg) {
    let authorid = msg.author.id;
    let guildid = msg.guild.id;
    if (!(complimented.hasOwnProperty(guildid))) { // Check to make sure that the object has this guild as a property. If it does, we can run this code, else we need to create it. 
        complimented[guildid] = [];
    }
    if (!(complimented[guildid].includes(authorid))) { // Check to see if the person is *not* on the list. If they aren't, we'll run this block. Else, we can just ignore it. 
        if (!(complimentchance.hasOwnProperty(guildid))) { // This block should never execute, but if it does, we'll just use the default listed at the top. 
            complimentchance[guildid] = chancedefault;
        }
        var chance = parseFloat(chanceSet(guildid,-1.0));
        var rolled = (Math.random()*parseFloat(100.0)) // This number must be LOWER than chance rolled above to succeed. 
        console.log(`Rolling chance ${chance} - ${rolled}`)
        if (chance > rolled) { // Succeeded the roll!
            console.log(`Succeeded roll for ${msg.member.displayName} in ${msg.guild.name}!`);
            fetchCompliment(msg, msg.member);
            addComplimented(msg);
        }
        else {
            console.log(`Failed roll for ${msg.member.displayName} in ${msg.guild.name}!`);
        }
    }
}

// Returns a string from a text file called compliments.txt and sends it in the channel. Personalized using <t> to replace with a member's text. This can be manually retrieved on command. 
async function fetchCompliment(msg, member) {
    var compliments = fs.readFileSync('compliments.txt').toString().split('\n'); // Compliments will be separated by each line.
    if (compliments == '') { // If for some stupid reason we can't find any compliments, alert me. 
        let enraa = client.users.get("125093095405518850");
        enraa.send(`There was a problem reading the compliments in ${msg.guild.name} for ${member.displayName}! Fix it!`);
    }
    else {
        let complimentroll = Math.floor(Math.random()*compliments.length) // Randomly chooses a compliment to roll for. This value is floored so we have an integer we can choose one from.
        var complimentstring = compliments[complimentroll]; // Sets our string from our compliment list. 
        complimentstring = complimentstring.replace("<t>",`<@${member.id}>`); // Replaces <t> if it is present. 
        complimentstring = complimentstring.replace("\r",``); // Replaces carriage return if it is present. 
        try {
            msg.channel.send(complimentstring); // Finally, attempt to send this message. 
        }
        catch (err) { // We weren't allowed to send on that channel for some reason, oh well. 
            console.log(err);
        }
    }
}

// Adds this user's ID to the complimented array for this guild. 
async function addComplimented(msg) {
    let authorid = msg.author.id;
    let guildid = msg.guild.id;
    if (!(complimented.hasOwnProperty(guildid))) { // Check to make sure that the object has this guild as a property. If it does, we can run this code, else we need to create it. 
        complimented[guildid] = [];
    }
    if (!(complimented[guildid].includes(authorid))) { // Check to see if the person is *not* on the list. If they aren't, we'll run this block. Else, we can just ignore it. 
        complimented[guildid].push(authorid);
    }
}

// Clears a timer and creates a new one with the new time if a value other than -1 is sent. 
function timerSet(guildid, time) {
    var newtime = time;
    var saving = false;
    if (!(timeoutref.hasOwnProperty(guildid))) { // Check to make sure that the object has this guild as a property. If it does, we can run this code, else we need to create it. 
        timeoutref[guildid] = -1;
    }
    if (timeoutref[guildid] != -1) { // A timer already exists for this guild - we need to clear it. 
        clearInterval(timeoutref[guildid])
    }
    if (newtime == -1) { // Check to see if we passed a new time to the function - if we did not, read from the function and set newtime to it. 
        var timeoutspairs = fs.readFileSync('timeouts.txt').toString().split('\n'); // Timeouts will be separated by each line. 
        timeoutspairs.forEach((split) => {
            var newsplit = split.split('Φ');
            if (newsplit[0] == guildid) {
                newtime = newsplit[1];
            }
        })
        if (newtime == -1) { // This guild isn't recorded. 
            newtime = timeoutdefault;
            saving = true;
        }
    }
    else {
        saving = true;
    }
    timeoutref[guildid] = setInterval(() => {
        complimented[guildid] = [];
    }, (newtime*60000));
    if (saving) {
        var found = false;
        var timeoutspairs = fs.readFileSync('timeouts.txt').toString().split('\n'); // Timeouts will be separated by each line. 
        for (i = 0, i < timeoutspairs.length; i++;) {
            var newsplit = timeoutspairs[i].split('Φ');
            if (newsplit[0] == guildid) {
                found = true;
                timeoutpairs[i] = `${guildid}Φ${newtime}`
            }
        }
        if (!(found)) { // We did not find and replace this guild in the timeout list - they probably didn't exist. 
            timeoutspairs.push(`${guildid}Φ${newtime}`)
        }
        fs.writeFile('timeouts.txt', timeoutspairs.join('\n'), function (err) {
            if (err) console.log(err);
            console.log(' ');
            console.log(`Updated timeouts.txt for ${guildid} to ${newtime} minutes.`);
            console.log(' ');
        });
    }
}

// Sets a new chance for a guild based on the value passed into this. -1 will return the value already here. 
function chanceSet(guildid, chance) {
    var newchance = chance;
    var saving = false;
    if (!(complimentchance.hasOwnProperty(guildid))) { // Check to make sure that the object has this guild as a property. If it does, we can run this code, else we need to create it. 
        complimentchance[guildid] = -1.0;
    }
    if (newchance == -1) { // Check to see if we passed a new chance to the function - if we did not, read from the function and set newchance to it. 
        var chancepairs = fs.readFileSync('chances.txt').toString().split('\n'); // Chances will be separated by each line. 
        chancepairs.forEach((split) => {
            var newsplit = split.split('Φ');
            if (newsplit[0] == guildid) {
                newchance = newsplit[1];
            }
        })
        if (newchance == -1.0) { // This guild isn't recorded. 
            newchance = chancedefault;
            saving = true;
        }
    }
    else {
        saving = true;
    }
    complimentchance[guildid] = newchance;
    if (saving) {
        var found = false;
        var chancepairs = fs.readFileSync('chances.txt').toString().split('\n'); // Chances will be separated by each line. 
        for (i = 0, i < chancepairs.length; i++;) {
            var newsplit = chancepairs[i].split('Φ');
            if (newsplit[0] == guildid) {
                found = true;
                chancepairs[i] = `${guildid}Φ${newchance}`
            }
        }
        if (!(found)) { // We did not find and replace this guild in the chance list - they probably didn't exist. 
            chancepairs.push(`${guildid}Φ${newchance}`)
        }
        fs.writeFile('chances.txt', chancepairs.join('\n'), function (err) {
            if (err) console.log(err);
            console.log(' ');
            console.log(`Updated chances.txt for ${guildid} to ${newchance}%.`);
            console.log(' ');
        });
    }
    return newchance;
}

// Sets a reminder for a userid. This will DM the user if available, else message them in the server. If forcedm is true it will only attempt to DM the user for this reminder. 
function setReminder(userid, remindertext, time, occurence, forcedm = false) {
    var themoment = time.toISOString();
    var now = moment();
    var difference = time.diff(now);
    if (now.isBefore(time)) { // Sanity check to make sure we're only setting it in the future. 
        var randomid = Math.floor((Math.random() * 299999) + 1);
        var thearray = [userid,remindertext,themoment,occurence,forcedm];
        remindersarray[randomid] = thearray;
        setReminderTimer(userid,remindertext,themoment,occurence,forcedm,randomid,difference);
    }
    var remindersets = fs.readFileSync('reminders.txt').toString().split('\n'); // Read the reminders
    remindersets.push(`${userid}Φ${remindertext}Φ${themoment}Φ${occurence}Φ${forcedm}`)
    fs.writeFile('reminders.txt', remindersets.join('\n'), function (err) {
        if (err) console.log(err);
        console.log(' ');
        console.log(`Updated reminders.txt for ${userid}. Added a ${occurence} occurence at ${time.format('dddd, MMMM Do YYYY, h:mm:ss a')}.`);
        console.log(' ');
    });
}

// Reads each reminder and then sets the timeouts based on current time. This will be run when the bot recovers.
function startReminders() {
    var remindersets = fs.readFileSync('reminders.txt').toString().split('\n'); // Read the reminders
    remindersets.forEach((reminder) => {
        var remindersplit = reminder.split('Φ');
        var randomid = Math.floor((Math.random() * 299999) + 1); // A new ID would be assigned to every reminder when recovering. This isn't a huge deal - it's only to prevent accidental overlap.
        var thearray = [remindersplit[0],remindersplit[1],remindersplit[2],remindersplit[3],remindersplit[4]];
        var now = moment();
        var targetmoment = moment(remindersplit[2]);
        var difference = now.diff(targetmoment);
        if (difference > 0) {
            remindersarray[randomid] = thearray;
            setReminderTimer(remindersplit[0],remindersplit[1],remindersplit[2],remindersplit[3],remindersplit[4],randomid,difference);
        }
        else {
            remindersarray[randomid] = thearray;
            clearReminders(-1, randomid);
        }
    })
}

// Clears reminders for a given person. Pass unique key to only remove that reminder. 
function clearReminders(userid = -1,uniquekey = -1) {
    var remindersets = fs.readFileSync('reminders.txt').toString().split('\n'); // Read the reminders
    var time;
    var occurrence;
    var userids;
    var updated = false; 
    if (uniquekey != -1) {
        var thetext = remindersarray[uniquekey][1];
        const theindex = remindersets.findIndex(element => element.split('Φ')[1] == thetext);
        if (theindex != -1) {
            occurence = remindersets[theindex][3];
            time = moment(remindersets[theindex][2]);
            userids = remindersets[theindex][0];
            remindersets.splice(theindex,1);
            updated = true;
        }
    }
    else {
        remindersets.forEach((element) => {
            if (element.split('Φ')[0] == userid) {
                occurence = remindersets[theindex][3];
                time = moment(remindersets[theindex][2]);
                userids = remindersets[theindex][0];
                remindersets.splice(theindex,1);
                updated = true;
            }
        });
    }
    if (updated) {
        fs.writeFile('reminders.txt', remindersets.join('\n'), function (err) {
            if (err) console.log(err);
            console.log(`Updated reminders.txt for ${userids}. Removed a ${occurrence} occurrence at ${time.format('dddd, MMMM Do YYYY, h:mm:ss a')}.`);
        });
    }
}

// Actually sets the timeout. 
function setReminderTimer(userid,remindertext,themoment,occurence,forcedm,randomid,difference) {
    remindersarray[randomid][5] = setTimeout(() => {
        var newdifference = difference;
        var theuser = client.users.cache.get(userid);
        var newmoment = moment(themoment);
        var now = moment();
        if (occurence == "daily") {
            while (newmoment.isBefore(now)) {
                newmoment.add(1, 'd');
                newdifference = 86400000
            }
        }
        else if (occurence == "weekly") {
            while (newmoment.isBefore(now)) {
                newmoment.add(1, 'w');
                newdifference = 604800000
            }
        }
        else if (occurence == "monthly") {
            while (newmoment.isBefore(now)) {
                newmoment.add(1, 'M');
                newdifference = 2419200000
            }
        }
        var newdifference = newmoment.diff(now);
        console.log(newdifference);
        try {
            theuser.send(remindertext);
        }
        catch (err) {
            console.log(err);
        }
        if (occurence != "once") {
            try { // I have no idea if this can possibly crash because of nested call stack. This should avoid killing the entire bot. 
                setReminderTimer(userid,remindertext,themoment,occurence,forcedm,randomid,difference);
            }
            catch (err) {
                console.log(err);
            }
        }
    },difference);
}

var tokencode = fs.readFileSync("token.txt").toString();
console.log(tokencode);
client.login(tokencode);