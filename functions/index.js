const functions = require('firebase-functions');
const admin = require('firebase-admin'); 
admin.initializeApp();
const db = admin.firestore();

const Nexmo = require('nexmo');
const { api_key: apiKey, api_secret: apiSecret } = functions.config().nexmo;
const nexmo = new Nexmo({ apiKey, apiSecret });

exports.inboundSMS = functions.https.onRequest(async (req, res) => {
    const { msisdn, to: nexmoNumber, text, keyword } = req.body;
    switch (keyword) {
        case 'JOIN':
            setUsername(msisdn, nexmoNumber, text, true);
            break;
        case 'USERNAME':
            setUsername(msisdn, nexmoNumber, text, false);
            break;
        case 'TWITTER':
            setTwitter(msisdn, nexmoNumber, text);
            break;
        case 'LEAVE':
            leave(msisdn, nexmoNumber);
            break;
        case 'INFO':
            info(msisdn, nexmoNumber); // should return my username/twitter/score and info of match
            break;
        case 'MEET':
            meet(msisdn, nexmoNumber, text);
            break;
        default:
            // return manual of commands
            break;
    }
    res.send(200);
});

async function setUsername(recipientNumber, nexmoNumber, message, newPlayer) {
    const messageArr = message.split(' ');
    messageArr.shift();
    db.collection("players").doc(recipientNumber).set({ 
        fullName: messageArr.join(' ')
    }, { merge: true }).then(() => {
        const text = newPlayer ? 'Please tell us your Twitter handle. Reply "TWITTER <username>".' : 'We have updated your username.'
        return sendMessage(recipientNumber, nexmoNumber, text)
    }).catch((error) => {
        const text = newPlayer ? 'We had a problem setting you up. Try "JOIN <your_username>".' : 'We had a problem updating your username. Try "USERNAME <your_username>".'
        return sendMessage(recipientNumber, nexmoNumber, text)
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