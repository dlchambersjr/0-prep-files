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
app.get('/yelp', getYelp);
app.get('/meetups', getMeetups);
app.get('/movies', getMovies);
app.get('/trails', getTrails);

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
// NOTE: the names are singular so they can be dynamically used
// The weather timeout MUST be 15 seconds for this lab. You can change
// The others as you see fit... or not.

const timeouts = {
  weather: 15 * 1000, // 15-seconds
  yelp: 24 * 1000 * 60 * 60, // 24-Hours
  movie: 30 * 1000 * 60 * 60 * 24, // 30-Days
  meetup: 6 * 1000 * 60 * 60, // 6-Hours
  trail: 7 * 1000 * 60 * 60 * 24 // 7-Days
};

// TODO: Check to see if the data is still valid
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

  // TODO: Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'weather',
  }

  // TODO: Get the Data and process it
  getData(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        superagent.get(url)
          .then(weatherResults => {
            if (!weatherResults.body.daily.data.length) { throw 'NO DATA'; }
            else {
              // Process the data through the constructor to be returned to the client
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.id = sqlInfo.id;

                // Insert into SQL database
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

function getYelp(request, response) {

  // TODO: Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'yelp',
  }

  // TODO: Get the Data and process it
  getData(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;

        console.log('yelp', url);

        superagent.get(url)
          .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
          .then(yelpResults => {
            if (!yelpResults.body.businesses.length) { throw 'NO DATA'; }
            else {
              const yelpReviews = yelpResults.body.businesses.map(business => {
                let review = new Yelp(business);
                review.id = sqlInfo.id;

                let sql = `INSERT INTO yelps (name, image_url, price, rating, url, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7);`;

                let values = Object.values(review);
                client.query(sql, values);

                return review;
              });
              response.send(yelpReviews);
            }
          });
      }
    })
    .catch(error => handleError(error));
}

function getMeetups(request, response) {

  // TODO: Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'meetup',
  }

  // TODO: Get the Data and process it
  getData(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${request.query.data.longitude}&page=20&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`;

        console.log('meetups', url);

        superagent.get(url)
          .then(result => {
            const meetups = result.body.events.map(meetup => {
              const event = new Meetup(meetup);

              event.id = sqlInfo.id;

              const SQL = `INSERT INTO meetups (link, name, creation_date, host, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
              const values = Object.values(event);

              client.query(SQL, values);

              return event;
            });
            response.send(meetups);
          })
          .catch(error => handleError(error));
      }
    })
}

function getMovies(request, response) {

  // TODO: Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'movie',
  }

  // TODO: Get the Data and process it
  getData(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&language=en-US&page=1&query=${request.query.data.search_query}`;

        console.log('movies', url);

        superagent.get(url)
          .then(result => {
            const movieSummaries = result.body.results.map(movie => {
              const summary = new Movie(movie);
              summary.id = sqlInfo.id;

              const SQL = `INSERT INTO movies (title, overview, average_votes, total_votes, image_url, popularity, released_on, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
              const values = Object.values(summary);

              client.query(SQL, values);

              return summary;
            });

            response.send(movieSummaries);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getTrails(request, response) {

  // TODO: Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'trail',
  }

  // TODO: Get the Data and process it
  getData(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=200&key=${process.env.HIKING_API_KEY}`;

        console.log('trails', url);

        superagent.get(url)
          .then(result => {
            const trailConditions = result.body.trails.map(trail => {
              const condition = new Trail(trail);
              condition.id = sqlInfo.id;

              const SQL = `INSERT INTO trails (name, location, length, stars, star_votes, summary, trail_url, conditions, condition_date, condition_time, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`;
              const values = Object.values(condition);

              client.query(SQL, values);





              return condition;
            });

            response.send(trailConditions);
          })
          .catch(error => handleError(error, response));
      }
    })
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
  this.created_at = Date.now(); //TODO: Don't forget to update the schema.sql file
}

function Yelp(business) {
  // this.tableName = 'yelps';
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
  this.created_at = Date.now();
}

function Meetup(meetup) {
  // this.tableName = 'meetups';
  this.link = meetup.link;
  this.name = meetup.group.name;
  this.creation_date = new Date(meetup.group.created).toString().slice(0, 15);
  this.host = meetup.group.who;
  this.created_at = Date.now();
}

function Movie(movie) {
  // this.tableName = 'movies';
  this.title = movie.title;
  this.overview = movie.overview;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  this.image_url = 'https://image.tmdb.org/t/p/w500' + movie.poster_path;
  this.popularity = movie.popularity;
  this.released_on = movie.release_date;
  this.created_at = Date.now();
}

function Trail(trail) {
  // this.tableName = 'trails';
  this.name = trail.name;
  this.location = trail.location;
  this.length = trail.length;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
  this.summary = trail.summary;
  this.trail_url = trail.url;
  this.conditions = trail.conditionDetails;
  this.condition_date = trail.conditionDate.slice(0, 10);
  this.condition_time = trail.conditionDate.slice(12);
  this.created_at = Date.now();
}




