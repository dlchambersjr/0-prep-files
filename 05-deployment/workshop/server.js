'use strict';

//manage our environment variables
require('dotenv').config();

// add the express library to do the heavy lifiting
const express = require('express');

// This is from the express.js docs
const app = express();

// define which port the server will be available on
const PORT = process.env.PORT || 3000;

// tell express where to find your html and css files.
app.use(express.static('./public'));

// create a /hello route to listen for
app.get('/hello', (request, response) => {
  response.status(200).send('Hello');
});

// create a /data route to listen for
app.get('/data', (request, response) => {
  let airplanes = {
    departure: Date.now(),
    canFly: true,
    pilot: 'Well Trained'
  }
  response.status(200).json(airplanes);
});

// create a catch all route in case the user requests a route that doesn't exist.
app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))

// turn the server on and start listening for incoming requests on the port
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
