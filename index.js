const { URLSearchParams } = require('url');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');

const { getStoredNumbers } = require('./redis');

require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || '', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const queryResultSchema = new mongoose.Schema({
  number: String,
  fbid: String,
  receivedate: Date,
});

const QueryResultModel = mongoose.model('QueryResult', queryResultSchema);

const redisUrl = process.env.REDIS_URL || '';
const redisClient = new Redis(redisUrl);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/query', async (req, res) => {
  try {
    const numberToQuery = req.query.number || '';

    const items = await getStoredNumbers(numberToQuery);

    // Step 3: Save the queried data to MongoDB
    await Promise.all(
      items.map(async (item) => {
        const { number, fbid, receivedate } = item;
        const queryResult = new QueryResultModel({ number, fbid, receivedate });
        await queryResult.save();
      })
    );

    // Step 4: Delete the data from Redis after successfully saving to MongoDB
    await Promise.all(
      items.map(async (item) => {
        const key = item.number; // Assuming the "number" field is used as the Redis key
        await redisClient.del(key);
      })
    );

    res.json({ numberToQuery, items });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});


app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.post('/subscribe', async (req, res) => {
  try {
    const { fbid, subscriptionStatus } = req.body;

    const payload = {
      fbid,
      subscriptionStatus,
    };

    const response = await axios.post('https://usersub.onrender.com/subscribe', new URLSearchParams(payload));

    const responseData = response.data;

    res.json(responseData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.post('/send_message', async (req, res, next) => {
  try {
    const { fbid } = req.body;

    console.log('Received message request:', { fbid });

    const success = await sendMessage(fbid);

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

async function sendMessage(fbid) {
  const url = 'https://usersub.onrender.com/send_message';
  const data = { fbid };

  try {
    const response = await axios.post(url, data);
    return true;
  } catch (error) {
    console.error('Error sending the message:', error.message);
    return false;
  }
}


app.get('/', (req, res) => {
  res.render('form', { numberToQuery: '' });
});
async function sendMessagesToNumbers() {
  try {
    let cursor = '0';
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000; // 1 day in milliseconds

    // Get the current date in milliseconds
    const currentDateInMs = Date.now();

    // Loop until SCAN returns '0' (end of iteration)
    do {
      // Use the SCAN command to get a batch of keys (numbers)
      const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', '*');

      // Update the cursor for the next iteration
      cursor = newCursor;

      // Send messages to each number (key) in the current batch
      for (const key of keys) {
        try {
          const numberData = await redisClient.hgetall(key);
          const { fbid, receivedate } = numberData;

          if (!fbid) {
            console.error(`Missing fbid for key: ${key}`);
            continue;
          }

          // Calculate the time difference between receive date and current date
          const receiveDateInMs = Date.parse(receivedate);
          const timeDifferenceInMs = currentDateInMs - receiveDateInMs;

          // If the time difference is greater than 1 day, send the post request
          if (timeDifferenceInMs >= oneDayInMilliseconds) {
            const success = await sendMessage(fbid);
            if (success) {
              console.log(`Message sent successfully to fbid: ${fbid}`);
              // Delete the data related to fbid in Redis after sending the message successfully
              await redisClient.hdel(key, 'number', 'receivedate', 'fbid'); // Delete all fields in the hash
            } else {
              console.error(`Failed to send message to fbid: ${fbid}`);
            }
          } else {
            console.log(`Message for fbid: ${fbid} not sent. Receive date within 1 day.`);
          }
        } catch (error) {
          console.error(`Error processing key: ${key}`, error);
        }
      }
    } while (cursor !== '0'); // Loop until the end of iteration

    // Reschedule the function to run again in one day
    setTimeout(sendMessagesToNumbers, oneDayInMilliseconds);
  } catch (error) {
    console.error('Error sending messages:', error);
  }
}

// Start sending messages to all numbers every day for testing
sendMessagesToNumbers();

app.get('/', (req, res) => {
  res.render('form', { numberToQuery: '' });
});


const port = 3002;
const server = http.createServer(app);
const io = socketIO(server);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
