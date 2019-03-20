'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();
const superagent = require('superagent')

// Application Dependencies
const express = require('express');
const cors = require('cors');

// Application Setup
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());

// API Routes

app.get('/location', searchToLatLong)

app.get('/weather', getWeather);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`App is up on ${PORT}`));

// ERROR HANDLER
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Helper Functions

// Refactor this function
// function searchToLatLong(query) {
//   const geoData = require('./data/geo.json');
//   const location = new Location(query, geoData);
//   return location;
// }

function searchToLatLong(request, response) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

  return superagent.get(url)
    .then(result => {
      response.send(new Location(request.query.data, result.body.results[0]))
    })
    .catch(error => handleError(error, response));
}

function Location(query, location) {
  console.log(location.body)
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
}

function getWeather(request, response) {
  // const darkskyData = require('./data/darksky.json');

  console.log(request.query)

  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

  return superagent.get(url)
    .then(weatherResults => {
      const weatherSummaries = weatherResults.body.daily.data.map(day => {
        return new Weather(day);
      });

      // weatherResults.body.daily.data.forEach(day => {
      //   let summary = new Weather(day);
      //   weatherSummaries.push(summary);
      // });
      response.send(weatherSummaries);
    })
    .catch(error => handleError(error, response));


  // const weatherSummaries = [];

  // darkskyData.daily.data.forEach(day => {
  //   weatherSummaries.push(new Weather(day));
  // });

  // return weatherSummaries;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}


