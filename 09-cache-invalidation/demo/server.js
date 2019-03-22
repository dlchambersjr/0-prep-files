'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent')
const pg = require('pg');

// Application Setup
const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());

// Create the client connection to the DB
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes
app.get('/location', searchToLatLong);
app.get('/weather', getWeather);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`City Explorer Backend is up on ${PORT}`));

// ERROR HANDLER
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Helper Functions and Data Models

// Lookup the location information
function searchToLatLong(request, response) {
  let query = request.query.data;
  let sql = `SELECT * FROM locations WHERE search_query=$1;`
  let values = [query];

  client.query(sql, values)
    .then(result => {
      if (result.rowCount > 0) {
        console.log('LOCATION FROM SQL');
        response.send(result.rows[0]);
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

        superagent.get(url)
          .then(data => {
            console.log('LOCATION FROM API');
            if (!data.body.results.length) { throw 'NO DATA' }
            else {
              let location = new Location(query, data.body.results[0]);

              let newSql = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) RETURNING id;`;
              let newValues = Object.values(location);

              client.query(newSql, newValues)
                .then(result => {
                  location.id = result.rows[0].id;
                  response.send(location);
                })
            }
          })
          .catch(error => handleError(error, response));
      }
    })
}

//TODO: Get the SQL data for the requested resource
function getData(sqlInfo) {
  let sql = `SELECT * FROM ${sqlInfo.endpoint}s WHERE location_id=$1;`
  let values = [sqlInfo.id];

  console.log('GETTING DATA FOR: ', sqlInfo.endpoint); //Debugging only

  // Return the data
  try { return client.query(sql, values); }
  catch (error) { handleError(error) }
}

// TODO: Establish the length of time to keep data for each resource
// NOTE: the names are singular for
const timeouts = {
  weather: 15 * 1000,
  yelp: 24 * 1000 * 60 * 60,
  movie: 30 * 1000 * 60 * 60 * 24,
  meetup: 6 * 1000 * 60 * 60,
  trail: 7 * 1000 * 60 * 60 * 24
};

// Check to see if the data is still valid
function checkTimeouts(sqlInfo, sqlData) {

  // if there is data, find out how old it is.
  if (sqlData.rowCount > 0) {
    let ageOfResults = (Date.now() - sqlData.rows[0].created_at);

    // For debugging only
    console.log(sqlInfo.endpoint, ' AGE:', ageOfResults);
    console.log(sqlInfo.endpoint, ' Timeout:', timeouts[sqlInfo.endpoint]);

    // Compare the age of the results with the timeout value
    // Delete the data if it is old
    if (ageOfResults > timeouts[sqlInfo.endpoint]) {
      let sql = `DELETE FROM ${sqlInfo.endpoint}s WHERE location_id=$1;`;
      let values = [sqlInfo.id];
      client.query(sql, values)
        .then(() => { return null; })
        .catch(error => handleError(error));
    } else { return sqlData }
  }
}

// Retrieve the Weather based on location
function getWeather(request, response) {
  //Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'weather',
  }

  getData(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      // console.log(sqlInfo.endpoint, 'Result:', result.rows);
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        superagent.get(url)
          .then(weatherResults => {
            console.log('Weather Rows = ', weatherResults.body.daily.data.length);
            if (!weatherResults.body.daily.data.length) { throw 'NO DATA'; }
            else {
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.id = sqlInfo.id;

                let newSql = `INSERT INTO weathers (forecast, time, created_at, location_id) VALUES($1, $2, $3, $4);`;
                let newValues = Object.values(summary);
                client.query(newSql, newValues);

                return summary;
              });
              response.send(weatherSummaries);
            }
          });
      }
    })
    .catch(error => handleError(error));
}

// Data Models
function Location(query, location) {
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}
