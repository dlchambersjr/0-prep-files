'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

// Application Setup
const PORT = process.env.PORT
const app = express();
app.use(cors());

// API Routes
app.get('/location', searchToLatLong);
app.get('/weather', getWeather);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`App is up on ${PORT}`));

// Helper Functions

function searchToLatLong(request, response) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

  console.log(url);

  superagent.get(url)
    .then(result => {
      console.log(result.body.results[0]);
      let location = new Location(request.query.data, result);
      response.send(location);
    })
    .catch(error => handleError(error, response));
}

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

function getWeather(request, response) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
  console.log('url', url);

  superagent.get(url)
    .then(result => {
      console.log(result.body)

      let weatherSummaries = result.body.daily.data.map(day => {
        let summary = new Weather(day);
        return summary;
      });

      response.send(weatherSummaries);
    })
    .catch(error => handleError(error, response));
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

// ERROR HANDLER
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}
