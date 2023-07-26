// index.js
require('dotenv').config();
const express = require('express');
const subscribeRoute = require('./routes/subscribeRoute');
const { sendMessage } = require('./helper/messengerApi');

const webApp = express();
const PORT = process.env.PORT || 3000;

webApp.use(express.urlencoded({ extended: true }));
webApp.use(express.json());
webApp.use('/subscribe', subscribeRoute.router);

const homeRoute = require('./routes/homeRoute');

webApp.use('/', homeRoute.router);

webApp.post('/send_message', async (req, res, next) => {
  try {
    const { fbid, message =  "Désolé, votre abonnement n'a pas été activé. Veuillez vérifier le numéro que vous avez fourni ou nous contacter." } = req.body;

    const success = await sendMessage(fbid, message);

    if (success) {
      console.log('Message sent successfully.'); 
      res.status(200).json({ message: 'Message sent successfully.' });
    } else {
      console.error('Failed to send message.'); 
      res.status(500).json({ message: 'Failed to send message.' });
    }
  } catch (error) {
    console.error('Error sending message:', error); 
    next(error);
  }
});

webApp.use((err, req, res, next) => {
  console.error('An error occurred:', err); 
  res.status(500).json({ error: 'Internal Server Error' });
});

webApp.listen(PORT, () => {
  console.log(`Server is up and running at ${PORT}`); 
});
