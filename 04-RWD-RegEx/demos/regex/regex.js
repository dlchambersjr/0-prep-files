let regex;

// .match

// .match() by just comparing a string to a simple possible substring:
regex = 'dog'.match('o')
console.log('.match 1. ', regex);

// .match() for a comparison that will not find any matches:
regex = 'dog'.match('cat');
console.log('.match 2. ', regex);

// .match() just using a simple regex
regex = 'dog'.match(/o/);
console.log('.match 3. ', regex);

// check a string to see if someone mistakenly typed a number in place of a letter, like '0' instead of 'o'.
regex = 'Kookaburra sits in the 01d gum tree'.match(/0/);
console.log('.match 4. ', regex);

// check for any other numbers? 
regex = 'Kookaburra sits in the o1d gum tree'.match(/\d/);
console.log('.match 5. ', regex);

// do a global search, by adding g at the end:
regex = 'Kookaburra sits in the 01d gum tree'.match(/\d/g);
console.log('.match 6. ', regex);

// .replace() method returns a new string with some or all matches of a pattern replaced by a replacement.

// eplace all vowels with a seven.
// regex = 'The quick brown fox jumps over the lazy dog'.replace(/[aeiou]/g, 7);
// console.log('.replace 1. ', regex);

// only the letters between “a” and “g”, replaced with a space?
// regex = 'The quick brown fox jumps over the lazy dog'.replace(/[a-g]/g, ' ');
// console.log('.replace 2. ', regex);

// replace every letter after a lowercase “o” or “e” and its following letter with a pair of dashes:
// regex = 'The quick brown fox jumps over the lazy dog'.replace(/(e|o)[a-z]/g, '--');
// console.log('.replace 3. ', regex);

// replace every sequence of four consecutive letters with a comma:
// regex = 'The quick brown fox jumps over the lazy dog'.replace(/[a-z]{4}/g, ',');
// console.log('.replace 4. ', regex);

// .search() is very similar to the array method indexOf(), in that it seeks a match, and if it finds one, will return the index of where the match first appears in the string. If there is no match, it returns the value -1.

const str = 'We at Code Fellows believe that software development skills lead to a better life, community, and world.';

// // Why does theis not work
regex = str.search(/A-Z/g);
console.log('.search 1. ', regex);

// // Why does this work
// regex = str.search(/[A-Z]/g);
// console.log('.search 2. ', regex);

// // Find the first "F"
// regex = str.search(/F/g);
// console.log('.search 3. ', regex);

// // Returns the first appearance of w,x,y,z
// regex = str[str.search(/[w-z]/g)];
// console.log('.search 4. ', regex);

// The split() method splits a String object into an array of strings by separating the string into substrings, using a specified separator string to determine where to make each split

// // splits on the 'e'
// regex = str.split('e');
// console.log('.split 1. ', regex);

// // splits and returns the 6th element in the array
// regex = str.split(' ')[6];
// console.log('.split 2. ', regex);

// // splits on'be'
// regex = str.split(/be/);
// console.log('.split 3. ', regex);

// // splits on'be'
// regex = str.split(/e/).reverse().join();
// console.log('.split 4. ', regex);
