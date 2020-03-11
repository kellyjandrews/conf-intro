/* eslint-disable promise/no-nesting */
/* eslint-disable promise/always-return */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const Nexmo = require('nexmo');
const { api_key: apiKey, api_secret: apiSecret } = functions.config().nexmo;
const nexmo = new Nexmo({ apiKey, apiSecret });

const shortid = require('shortid');

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
            info(msisdn, nexmoNumber); // should return my username/twitter/score and info of match
            break;
        case 'MEET':
            meet(msisdn, nexmoNumber, message);
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
                data: { fullName: message, shortId: shortid.generate(), active: true },
                onSuccess: 'Awesome! Please reply with TWITTER <your_username>.',
                onFail: 'We had a problem setting you up. Try "JOIN <your_username>".'
            })
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
        data: { twitter: message },
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

function man(recipientNumber, nexmoNumber) {
    let man = [
        'HELP: show this manual',
        'JOIN <username>: joins or re-enrols in game if you have left',
        'USERNAME <username>: changes username',
        'TWITTER <twitter_handle>: sets Twitter username',
        'LEAVE: remove yourself from the game',
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