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
app.use(cors());

// Create the client connection to the DB
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes

app.get('/location', searchToLatLong);
app.get('/weather', getWeather);

// app.use('*', handleError);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`City Explorer Backend is up on ${PORT}`));

// ERROR HANDLER
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Helper Functions

// What we need to do to refactor for SQL Storage
// 1. We need to check the database to see if the location exists
//    a. If it exists -> get the location information from the database
//    b. Return the information to the front-end

// 2. If the location is NOT in the database
//    a. Get the location information from the API
//    b. Run it through the constructor
//    c. Save it to the database
//    d. Add the newly added record id to location
//    e. Return the location

// THIS IS THE ORIGINAL CODE
// function searchToLatLong(request, response) {
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

//   return superagent.get(url)
//     .then(result => {
//       response.send(new Location(request.query.data, result.body.results[0]))
//     })
//     .catch(error => handleError(error, response));
// }

// LOCATION REFACTORED FOR SQL
function searchToLatLong(request, response) {
  let query = request.query.data;

  // Define the search query
  let sql = `SELECT * FROM locations WHERE search_query=$1;`
  let values = [query];

  // Make the query of the database
  client.query(sql, values)
    .then(result => {

      // If the location is in the database, return it to the frontend
      if (result.rowCount > 0) {
        console.log('LOCATION FROM SQL');
        response.send(result.rows[0]);

      } else {
        // Otherwise go get the data from the API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

        superagent.get(url)
          .then(data => {
            console.log('LOCATION FROM API');

            // Throw an error if there is a problem with the API
            if (!data.body.results.length) { throw 'NO DATA' }

            // If there is data...
            else {
              let location = new Location(query, data.body.results[0]);

              // Create a query string to add the Location data to SQL
              let newSql = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) RETURNING id;`;
              let newValues = Object.values(location);

              // Insert the location data into the DB and return the unique id for the new record.
              client.query(newSql, newValues)
                .then(result => {

                  // Attach the returned id onto the location object.
                  location.id = result.rows[0].id;

                  // return the location data to the frontend
                  response.send(location);
                })
            }
          })
          .catch(error => handleError(error, response));
      }
    })
}

function Location(query, location) {
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
}

// ORIGINAL WEATHER FUNCTION
// function getWeather(request, response) {
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

//   return superagent.get(url)
//     .then(weatherResults => {
//       const weatherSummaries = weatherResults.body.daily.data.map(day => {
//         return new Weather(day);
//       });
//       response.send(weatherSummaries);
//     })
//     .catch(error => handleError(error, response));
// }

// WEATHER REFACTORED FOR SQL
function getWeather(request, response) {
  let query = request.query.data.id;
  let sql = `SELECT * FROM weathers WHERE location_id=$1;`
  let values = [query];

  client.query(sql, values)
    .then(result => {
      if (result.rowCount > 0) {
        console.log('Weather From SQL');
        response.send(result.rows);
      } else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        superagent.get(url)
          .then(weatherResults => {
            console.log('WEATHER FROM API');
            if (!weatherResults.body.daily.data.length) { throw 'NO DATA' }
            else {
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.id = query;

                let newSql = `INSERT INTO weathers (forecast, time, location_id) VALUES($1, $2, $3);`;
                let newValues = Object.values(summary);
                client.query(newSql, newValues);

                return summary;
              });

              response.send(weatherSummaries);
            }
          })
      }
    })
    .catch(error => handleError(error, response));
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}
