const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { MongoClient } = require('mongodb');
const utcPlugin = require('dayjs/plugin/utc');
const frLocale = require('dayjs/locale/fr');
const timezonePlugin = require('dayjs/plugin/timezone');
const { saveSubscription } = require('../helper/saveSubscription');
const { sendMessage } = require('../helper/messengerApi');
const { calculateExpirationDate } = require('../helper/expireDateCalculator');

dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);
dayjs.locale(frLocale);

// Add your MongoDB connection URL here
const mongoConnectionURL = process.env.SUB_DETAIL;
// Define the MongoDB database and collection names
const dbName = 'subdetail';
const collectionName = 'mana';

router.post('/', async (req, res, next) => {
  try {
    const { fbid, subscriptionStatus } = req.body;

    console.log('Received subscription request:', { fbid, subscriptionStatus });

    const T = subscriptionStatus; 

    const A = dayjs().utcOffset('+03:00').format('D MMMM YYYY, HH:mm:ss'); 

    const expireDate = calculateExpirationDate(subscriptionStatus);
    const E = dayjs(expireDate).utcOffset('+03:00').format('D MMMM YYYY, HH:mm:ss'); 
    const success = await saveSubscription(fbid, subscriptionStatus);

    if (success) {
      // Check if the document with the given fbid already exists in the collection
      const client = await MongoClient.connect(mongoConnectionURL, { useUnifiedTopology: true });
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
      const existingSubscription = await collection.findOne({ fbid });

      if (existingSubscription) {
        // If the document exists, update the subscription data
        const updateData = {
          $set: {
            'T': T,
            'A': A,
            'E': E
          }
        };

        await collection.updateOne({ fbid }, updateData);

        console.log('Subscription updated successfully.');
        res.status(200).json({ message: 'Subscription updated successfully.' });
      } else {
        // If the document does not exist, insert a new subscription data
        const subscriptionData = {
          fbid,
          'T': T,
          'A': A,
          'E': E
        };

        await collection.insertOne(subscriptionData);

        console.log('Subscription activated successfully.');
        res.status(200).json({ message: 'Subscription activated successfully.' });
      }

      // Close the MongoDB client connection
      client.close();

      // Send confirmation message to the user
      const messageParts = [
        `Félicitations ! 🎉 Votre abonnement a été activé avec succès. Nous sommes ravis de vous présenter les détails de votre souscription 😊:`,
        '',
        `   Type d'abonnement: ${T} ✨   `,
        `   Date d'activation: ${A} ⏳   `,
        `   Date d'expiration: ${E} ⌛   `,
        '',
        `Nous espérons que vous apprécierez pleinement les avantages et les fonctionnalités offertes par votre abonnement 🚀. Si vous avez des questions ou des préoccupations, n'hésitez pas à nous contacter 📞. Merci encore pour votre souscription et nous vous souhaitons une excellente expérience 🌟!`
      ];
      const message = messageParts.join('\n');

      await sendMessage(fbid, message);
    } else {
      console.error('Failed to activate subscription.');
      res.status(500).json({ message: 'Failed to activate subscription.' });
    }
  } catch (error) {
    console.error('Error subscribing user:', error);
    next(error);
  }
});

module.exports = {
  router,
};
