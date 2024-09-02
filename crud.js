const mysql = require('mysql2');

// Create a connection to the database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit:10
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');
});

// Create User
const createUser = (name, email, password, callback) => {
  const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
  connection.query(sql, [name, email, password], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Get Users
const getUsers = (callback) => {
  const sql = 'SELECT * FROM users';
  connection.query(sql, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

// Get User by ID
const getUserById = (id, callback) => {
  const sql = 'SELECT * FROM users WHERE id = ?';
  connection.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    console.log('results', results);
    callback(null, results[0]);
  });
};

// Get User by Email
const getUserByEmail = (email, callback) => {
  const sql = 'SELECT * FROM users WHERE email = ?';
  connection.query(sql, [email], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

// Update User
const updateUser = (id, name, email, password, callback) => {
  const sql = 'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?';
  connection.query(sql, [name, email, password, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Delete User
const deleteUser = (id, callback) => {
  const sql = 'DELETE FROM users WHERE id = ?';
  connection.query(sql, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Create a team
function createTeam(name, callback) {
  const query = 'INSERT INTO teams (name) VALUES (?)';
  connection.query(query, [name], callback);
}

// Get all teams
function getTeams(callback) {
  const query = 'SELECT * FROM teams';
  connection.query(query, callback);
}

// Get a team by ID
function getTeamById(id, callback) {
  const query = 'SELECT * FROM teams WHERE id = ?';
  connection.query(query, [id], callback);
}

// Update a team
function updateTeam(id, name, callback) {
  const query = 'UPDATE teams SET name = ? WHERE id = ?';
  connection.query(query, [name, id], callback);
}

// Delete a team
function deleteTeam(id, callback) {
  const query = 'DELETE FROM teams WHERE id = ?';
  connection.query(query, [id], callback);
}

// Create a player
function createPlayer(name, position, teamId, callback) {
  const query = 'INSERT INTO players (name, position, team_id) VALUES (?, ?, ?)';
  connection.query(query, [name, position, teamId], callback);
}

// Get all players
function getPlayers(callback) {
  const query = 'SELECT * FROM players';
  connection.query(query, callback);
}

// Get a player by ID
function getPlayerById(id, callback) {
  const query = 'SELECT * FROM players WHERE id = ?';
  connection.query(query, [id], callback);
}

// Update a player
function updatePlayer(id, name, position, teamId, callback) {
  const query = 'UPDATE players SET name = ?, position = ?, team_id = ? WHERE id = ?';
  connection.query(query, [name, position, teamId, id], callback);
}

// Delete a player
function deletePlayer(id, callback) {
  const query = 'DELETE FROM players WHERE id = ?';
  connection.query(query, [id], callback);
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  createPlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer
};
