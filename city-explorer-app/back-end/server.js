'use strict';

// PROVIDE ACCESS TO ENVIRONMENT VARIABLES IN .env
require('dotenv').config();

// LOAD APPLICATION DEPENDENCIES
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// APPLICATION SETUP
const app = express();
app.use(cors());
const PORT = process.env.PORT;

//CONNECT TO DATABASE
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.log(err));

// API ROUTES
app.get('/location', searchToLatLong);
app.get('/weather', getWeather);
app.get('/events', getEvents);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);
app.get('/trails', getTrails);

// TURN THE SERVER ON
app.listen(PORT, () => console.log(`City Explorer Backend is up on ${PORT}`));

// ERROR HANDLER
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// HELPER FUNCTIONS

function getDataFromDB(sqlInfo) {
  let condition = '';
  let values = [];

  if (sqlInfo.searchQuery) {
    condition = 'search_query';
    values = [sqlInfo.searchQuery];
  } else {
    condition = 'location_id';
    values = [sqlInfo.id];
  }

  let sql = `SELECT * FROM ${sqlInfo.endpoint}s WHERE ${condition}=$1;`;

  try { return client.query(sql, values); }
  catch (error) { handleError(error); }
}

function saveDataToDB(sqlInfo) {
  let params = [];

  for (let i = 1; i <= sqlInfo.values.length; i++) {
    params.push(`$${i}`);
  }

  let sqlParams = params.join();
  let sql = '';

  if (sqlInfo.searchQuery) {
    // location
    sql = `INSERT INTO ${sqlInfo.endpoint}s (${sqlInfo.columns}) VALUES (${sqlParams}) RETURNING ID;`;
  } else {
    // all other endpoints
    sql = `INSERT INTO ${sqlInfo.endpoint}s (${sqlInfo.columns}) VALUES (${sqlParams});`;
  }

  try { return client.query(sql, sqlInfo.values); }
  catch (err) { handleError(err); }
}

function checkTimeouts(sqlInfo, sqlData) {

  const timeouts = {
    weather: 15 * 1000, // 15-seconds
    yelp: 24 * 1000 * 60 * 60, // 24-Hours
    movie: 30 * 1000 * 60 * 60 * 24, // 30-Days
    event: 6 * 1000 * 60 * 60, // 6-Hours
    trail: 7 * 1000 * 60 * 60 * 24 // 7-Days
  };

  // if there is data, find out how old it is.
  if (sqlData.rowCount > 0) {
    let ageOfResults = (Date.now() - sqlData.rows[0].created_at);

    // Compare the age of the results with the timeout value
    // Delete the data if it is old
    if (ageOfResults > timeouts[sqlInfo.endpoint]) {
      let sql = `DELETE FROM ${sqlInfo.endpoint}s WHERE location_id=$1;`;
      let values = [sqlInfo.id];
      client.query(sql, values)
        .then(() => { return null; })
        .catch(error => handleError(error));
    } else { return sqlData; }
  }
}

function searchToLatLong(request, response) {
  let sqlInfo = {
    searchQuery: request.query.data,
    endpoint: 'location'
  };

  getDataFromDB(sqlInfo)
    .then(result => {
      if (result.rowCount > 0) {
        response.send(result.rows[0]);
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

        superagent.get(url)
          .then(result => {
            if (!result.body.results.length) { throw 'NO DATA'; }
            else {
              let location = new Location(sqlInfo.searchQuery, result.body.results[0]);

              sqlInfo.columns = Object.keys(location).join();
              sqlInfo.values = Object.values(location);

              saveDataToDB(sqlInfo)
                .then(data => {
                  location.id = data.rows[0].id;
                  response.send(location);
                });
            }
          })
          .catch(error => handleError(error, response));
      }
    });
}

function getWeather(request, response) {

  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'weather'
  };

  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows); }
      else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        return superagent.get(url)
          .then(weatherResults => {
            console.log('Weather from API');
            if (!weatherResults.body.daily.data.length) { throw 'NO DATA'; }
            else {
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.location_id = sqlInfo.id;

                sqlInfo.columns = Object.keys(summary).join();
                sqlInfo.values = Object.values(summary);

                saveDataToDB(sqlInfo);
                return summary;
              });
              response.send(weatherSummaries);
            }
          })
          .catch(error => handleError(error, response));
      }
    });
}

function getEvents(request, response) {

  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'event'
  };

  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows); }
      else {
        const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

        superagent.get(url)
          .then(result => {
            const events = result.body.events.map(eventData => {
              const event = new Event(eventData);
              event.location_id = sqlInfo.id;

              sqlInfo.columns = Object.keys(event).join();
              sqlInfo.values = Object.values(event);

              saveDataToDB(sqlInfo);

              return event;
            });

            response.send(events);
          })
          .catch(error => handleError(error, response));
      }
    });
}

function getYelp(request, response) {

  // Create an object to hold the SQL query info
  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'yelp',
  }

  // Get the Data and process it
  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;

        superagent.get(url)
          .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
          .then(yelpResults => {
            if (!yelpResults.body.businesses.length) { throw 'NO DATA'; }
            else {
              const yelpReviews = yelpResults.body.businesses.map(business => {
                let review = new Yelp(business);
                review.location_id = sqlInfo.id;

                // Insert into SQL database
                sqlInfo.columns = Object.keys(review).join();
                sqlInfo.values = Object.values(review);

                saveDataToDB(sqlInfo);

                return review;
              });
              response.send(yelpReviews);
            }
          });
      }
    })
    .catch(error => handleError(error));
}

function getMovies(request, response) {

  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'movie',
  }

  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&language=en-US&page=1&query=${request.query.data.search_query}`;

        superagent.get(url)
          .then(result => {
            const movieSummaries = result.body.results.map(movie => {
              const summary = new Movie(movie);
              summary.location_id = sqlInfo.id;

              sqlInfo.columns = Object.keys(summary).join();
              sqlInfo.values = Object.values(summary);

              saveDataToDB(sqlInfo);

              return summary;
            });

            response.send(movieSummaries);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getTrails(request, response) {

  let sqlInfo = {
    id: request.query.data.id,
    endpoint: 'trail',
  }

  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows) }
      else {
        const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=200&key=${process.env.HIKING_API_KEY}`;

        superagent.get(url)
          .then(result => {
            const trailConditions = result.body.trails.map(trail => {
              const condition = new Trail(trail);
              condition.location_id = sqlInfo.id;

              sqlInfo.columns = Object.keys(condition).join();
              sqlInfo.values = Object.values(condition);

              saveDataToDB(sqlInfo);
              return condition;
            });

            response.send(trailConditions);
          })
          .catch(error => handleError(error, response));
      }
    })
}

//DATA MODELS
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

function Event(event) {
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
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
