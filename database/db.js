
const mysql = require('mysql');
const { Sequelize } = require('sequelize');

const connection = mysql.createConnection({
  host: process.env.DB_HOST,  // your MySQL host
  user: process.env.DB_USER,      // your MySQL username
  password: process.env.DB_PASSWORD, //  your MySQL password
  database: process.env.DB_NAME, //  your MySQL database name
});

connection.connect(function(err) {
    if (err) {
      console.error('Error connecting: ' + err.stack);
      return;
    }
    console.log('Connected as id ' + connection.threadId);
  });

  // Database connection configuration
const sequelize = new Sequelize('database_name', 'username', 'password', {
  host: 'localhost',
  dialect: 'mysql', 
  logging: false, // Set to true to see SQL queries in the console
});

// Test the connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

testConnection();

module.exports = {
  connection,
  sequelize
};
