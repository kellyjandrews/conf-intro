/* eslint-disable promise/no-nesting */
/* eslint-disable promise/always-return */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const Nexmo = require('nexmo');
const { api_key: apiKey, api_secret: apiSecret } = functions.config().nexmo;
const nexmo = new Nexmo({ apiKey, apiSecret });

exports.inboundSMS = functions.https.onRequest((req, res) => {
    const { msisdn, to: nexmoNumber, text, keyword } = req.body;
    const message = removeKeyword(text);
    switch (keyword) {
        case 'JOIN':
        case 'USERNAME':
            setUsername(msisdn, nexmoNumber, message);
            break;
        case 'TWITTER':
            setTwitter(msisdn, nexmoNumber, message);
            break;
        case 'LEAVE':
            leaveGame(msisdn, nexmoNumber);
            break;
        case 'INFO':
            info(msisdn, nexmoNumber);
            break;
        case 'MEET':
            validateMeet(msisdn, nexmoNumber, message);
            break;
        default:
            man(msisdn, nexmoNumber);
            break;
    }
    res.send(200);
})

function setUsername(recipientNumber, nexmoNumber, message) {
    let player = db.collection('players').doc(recipientNumber).get().then((doc) => {
        if (!doc.exists) {
            setUser({
                recipientNumber, nexmoNumber,
                data: { fullName: message, shortId: generateId(), introsMade: [] },
                onSuccess: 'Awesome! Please reply with TWITTER <your_username> to finish signing up.',
                onFail: 'We had a problem setting you up. Try "JOIN <your_username>".'
            })
            // TODO: RUN MATCH
        } else {
            setUser({
                recipientNumber, nexmoNumber,
                data: { fullName: message, active: true },
                onSuccess: 'We have updated your username.',
                onFail: 'We had a problem updating your username. Try "USERNAME <your_username>".'
            })
            return updateUsername(recipientNumber, nexmoNumber, message);
        }
    }).catch(() => {
        return sendMessage(recipientNumber, nexmoNumber, 'We had a problem checking if you have already registered')
    });
}

function setTwitter(recipientNumber, nexmoNumber, message) {
    setUser({
        recipientNumber, nexmoNumber,
        data: { twitter: message, active: true },
        onSuccess: 'We have set your Twitter username. We will message you when we have someone for you to meet.',
        onFail: 'We had a problem setting your Twitter username.'
    })
}

function leaveGame(recipientNumber, nexmoNumber) {
    setUser({
        recipientNumber, nexmoNumber,
        data: { active: false },
        onSuccess: 'You have successfully been removed from the game. We hope you enjoyed it.',
        onFail: 'We had a problem removing you from the game. See a Vonage team member and they can manually do it for you.'
    })
}

async function validateMeet(recipientNumber, nexmoNumber, message) {
    const playerRef = await db.collection('players').doc(recipientNumber).get();
    const player = playerRef.data();
    const matchRef = await db.collection('players').doc(player.currentIntro).get();
    const match = matchRef.data();

    if(String(match.shortId) === String(message)) {
        setUser({
            recipientNumber, nexmoNumber,
            data: { currentIntro: null, introsMade: [...player.introsMade, player.currentIntro] },
            onSuccess: 'Congrats on meeting! We will message you with a new person to meet soon.',
            onFail: 'We had a problem storing your meet. Try again.'
        })
        // TODO: RUN MATCH
    } else {
        sendMessage(recipientNumber, nexmoNumber, 'That is not the correct ID for your match')
    }
}

async function info(recipientNumber, nexmoNumber) {
    const playerRef = await db.collection('players').doc(recipientNumber).get();
    const player = playerRef.data();

    let message = `Your Twitter username is set to ${player.twitter}. You've met with ${player.introsMade.length} matches so far.`

    if(player.currentIntro) {
        const matchRef = await db.collection('players').doc(player.currentIntro).get();
        const match = matchRef.data();
        message += `\n\nYour match is ${match.fullName} and their Twitter username is ${match.twitter}. Once you've met text us with "MEET <their_id>".`
    } else {
        message += `\n\nWe'll provide you with a new person to meet soon.`
    }

    message += `\n\nSomeone will have you as their match - once you've had a converastion give them your ID which is ${player.shortId}.`

    sendMessage(recipientNumber, nexmoNumber, message);
}

function man(recipientNumber, nexmoNumber) {
    let man = [
        'HELP: show this manual',
        'JOIN <username>: joins or re-enrols in game if you have left',
        'USERNAME <username>: changes username',
        'TWITTER <twitter_handle>: sets Twitter username',
        'LEAVE: remove yourself from the game',
        'MEET <match_id>: tell us you have found your match',
        'INFO: Reminds you of your match\'s details'
    ]
    sendMessage(recipientNumber, nexmoNumber, man.join('\n\n'))
}

function setUser(payload) {
    const { recipientNumber, nexmoNumber, data, onSuccess, onFail } = payload;
    db.collection("players").doc(recipientNumber).set(data, { merge: true }).then(() => {
        return sendMessage(recipientNumber, nexmoNumber, onSuccess);
    }).catch(() => {
        return sendMessage(recipientNumber, nexmoNumber, onFail);
    })
}

function sendMessage(recipientNumber, nexmoNumber, message) {
    return nexmo.message.sendSms(nexmoNumber, recipientNumber, message, (err, res) => {
      if (err) {  console.log(err); } 
      else {
        if (res.messages[0]['status'] === "0")  console.log(`Message "${message}" sent successfully to ${recipientNumber}`);
        else console.log(`Message failed with error: ${res.messages[0]['error-text']}`);
      }
    })
}

function removeKeyword(message) {
    const a = message.split(' ');
    a.shift();
    return a.join(' ');
}

function generateId() {
    return String(Math.floor(Math.random() * 899999 + 100000))
}