'use strict';

let neighborhoods = [];

// REVIEW: This is another way to use a constructor to duplicate an array of raw data objects

function Neighborhood(rawDataObject) {

  // This will iterate over the object and assign the property name to the key variable
  for (let key in rawDataObject) {
    // console.log('key', key);

    // when using a variable name to identify the property, we MUST use bracket [] notation.
    this[key] = rawDataObject[key];
  }
}

Neighborhood.prototype.toHtml = function () {
  // 1. Get the template from the HTML document
  let $template = $('#neighborhood-template').html();
  console.log($template);
  // 2. Use Handlebars to "compile" the HTML
  let compiledTemplate = Handlebars.compile($template);
  console.log('compiledTemplate', compiledTemplate);
  // 3. Do not forget to return the HTML from this method
  // and... put it in the DOM.
  return compiledTemplate(this);

};

// Create a new instance of Neighborhood from the data set.
neighborhoodDataSet.forEach(neighborhoodObject => {
  neighborhoods.push(new Neighborhood(neighborhoodObject));
});

neighborhoods.forEach(ourNewNeighborhoodObject => {
  // What do we need to do here to render each of the neighborhoods to the DOM?
  $('#neighborhoods').append(ourNewNeighborhoodObject.toHtml());
});
