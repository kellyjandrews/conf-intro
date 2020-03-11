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

exports.inboundSMS = functions.https.onRequest(async (req, res) => {
    const { msisdn, to: nexmoNumber, text, keyword } = req.body;
    const message = removeKeyword(text);
    switch (keyword) {
        case 'JOIN':
            createUser(msisdn, nexmoNumber, message);
            break;
        case 'USERNAME':
            updateUsername(msisdn, nexmoNumber, message);
            break;
        case 'TWITTER':
            setTwitter(msisdn, nexmoNumber, message);
            break;
        case 'LEAVE':
            leave(msisdn, nexmoNumber);
            break;
        case 'INFO':
            info(msisdn, nexmoNumber); // should return my username/twitter/score and info of match
            break;
        case 'MEET':
            meet(msisdn, nexmoNumber, message);
            break;
        default:
            // return manual of commands
            break;
    }
    res.send(200);
})

async function createUser(recipientNumber, nexmoNumber, message) {
    let player = db.collection('players').doc(recipientNumber).get().then((doc) => {
        if (!doc.exists) {
            db.collection("players").doc(recipientNumber).set({ 
                fullName: message,
                shortId: shortid.generate(),
                active: true
            }, { merge: true }).then(() => {
                return sendMessage(recipientNumber, nexmoNumber, 'Awesome! Please reply with TWITTER <your_username>.')
            }).catch((error) => {
                return sendMessage(recipientNumber, nexmoNumber, 'We had a problem setting you up. Try "JOIN <your_username>".')
            })
        } else {
            return updateUsername(recipientNumber, nexmoNumber, message);
        }
    }).catch(() => {
        return sendMessage(recipientNumber, nexmoNumber, 'We had a problem checking if you have already registered')
    });
}

async function updateUsername(recipientNumber, nexmoNumber, message) {
    db.collection("players").doc(recipientNumber).set({ 
        fullName: message
    }, { merge: true }).then(() => {
        return sendMessage(recipientNumber, nexmoNumber, 'We have updated your username.')
    }).catch((error) => {
        return sendMessage(recipientNumber, nexmoNumber, 'We had a problem updating your username. Try "USERNAME <your_username>".')
    });
}

async function setTwitter(recipientNumber, nexmoNumber, message) {
    db.collection("players").doc(recipientNumber).set({ 
        twitter: message
    }, { merge: true }).then(() => {
        return sendMessage(recipientNumber, nexmoNumber, 'We have set your Twitter username. We will message you when we have someone for you to meet.')
    }).catch((error) => {
        return sendMessage(recipientNumber, nexmoNumber, 'We had a problem setting your Twitter username.')
    });
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