-- Sample Schema

CREATE TABLE IF NOT EXISTS
students(
  id SERIAL PRIMARY KEY NOT NULL,
  first_name VARCHAR(256) NOT NULL,
  last_name VARCHAR(256) NOT NULL,
  city VARCHAR(25),
  miles NUMERIC (3,1),
);

-- INSERT RECORDS
INSERT INTO students(first_name, last_name, course, status) VALUES('TBD', 'tbd', 'TBD', 12.3);
INSERT INTO students(first_name, last_name, course, status) VALUES('TBD', 'tbd', 'TBD', 12.3);
INSERT INTO students(first_name, last_name, course, status) VALUES('TBD', 'tbd', 'TBD', 12.3);
INSERT INTO students(first_name, last_name, course, status) VALUES('TBD', 'tbd', 'TBD', 12.3);

-- SELECT RECORDS
SELECT * FROM students;

SELECT first_name FROM students;

SELECT * FROM students WHERE id=2;

-- UPDATE RECORDS

UPDATE students SET city='Seattle' WHERE id=3;

-- DELETE RECORDS

DELETE FROM students WHERE id=4;


-- DELETE TABLE
DROP TABLE students;