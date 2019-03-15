'use strict'

$('#click').on('click', () => {
  console.log('clicked');
  var counter = 0;
  $('p').on('click', counter++);
  console.log(counter);
});
