'use strict'
// configure environemnt variables
// in other words, use the .env file

require('dotenv').config();

// Application dependencies
const express = require('express');
const app = express();

// Cross Origin Resource Sharing
const cors = require('cors');
app.use(cors());

const PORT = process.env.PORT;

app.get('/location', (request, response) => {
  const locationData = searchToLatLong(request.query.data)
  // console.log(request);
  // console.log('Client Query', request.query);
  console.log('location', request.query.data);
  response.send(locationData);
});

//test route
// form of a route:  app.METHOD(PATH, CALLBACK);
app.get('/testing', (request, response) => {
  console.log('Hit the testing route!');
  let caity = { firstName: 'Caity', lastname: 'Heath', awesome: true }
  response.json(caity);
})

// Turn the server on so it will listen for incoming requests
app.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));

// HELPER FUNCTIONS

function searchToLatLong(query) {
  const geoData = require('./data/geo.json');
  const location = new Location(geoData);
  location.search_query = query;
  console.log(location);
  return location;
}

function Location(data) {
  this.formatted_query = data.results[0].formatted_address;
  this.latitude = data.results[0].geometry.location.lat;
  this.longitude = data.results[0].geometry.location.lng;
}

// Create a weatherLookup
// get the data
// run it through a constructor
// return it to the frontend

