require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { name } = require('ejs');

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database', err.stack);
    return;
  }
  console.log('Connected to the database.');
});

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// Passport configuration
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  (email, password, done) => {
    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
      if (err) return done(err);
      if (!results || results.length === 0) return done(null, false, { message: 'Incorrect email.' });
      
      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return done(err);
        if (isMatch) {
          user.user_type = email.endsWith('@cricket.com') ? 'admin' : 'customer';
          return done(null, user);
        } else {
          return done(null, false, { message: 'Incorrect password.' });
        }
      });
    });
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  connection.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

// Authentication middleware
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Function to fetch cricket country data with pagination
async function fetchFromOffset(offset) {
  const apiKey = process.env.CRICKET_API_KEY; // Use environment variable for API key
  const url = `https://cricket.sportmonks.com/api/v2.0/countries`;

  try {
    const fetch = (await import('node-fetch')).default; // Use dynamic import
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'success') {
      console.error('Failed to fetch data');
      return [];
    }

    let datarray = data.data;
    if (!datarray) {
      return [];
    } else if (offset >= data.info.totalRows) {
      return datarray;
    } else {
      const nextData = await fetchFromOffset(offset + 25);
      return datarray.concat(nextData);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
}

// Routes
app.get('/', checkAuthenticated, async (req, res) => {
  try {
    // Fetch and render data
    res.render('index', { name: req.user.name });
  } catch (error) {
    console.error('Error loading page:', error);
    res.status(500).send('Error loading page');
  }
});

// Fetch all players
app.get('/players', async (req, res) => {
  try {
    const response = await axios.get("https://cricket.sportmonks.com/api/v2.0/players?api_token="+ process.env.CRICKET_DATA_API_KEY);
    const headers = {
      "Authorization": `Bearer ${process.env.CRICKET_DATA_API_KEY}`, // Include the API token from environment variables
      "X-API-Key": process.env.CRICKET_DATA_API_KEY, 
    };

    // Return the data in the required format
  
    res.render('players', { players: response.data.data });
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).send('Error fetching players');
  }
});


app.get('/player/:id', async (req, res) => {
  const playerId = req.params.id; // Correctly getting player ID from the request parameters
  const apiKey = process.env.CRICKET_DATA_API_KEY; // Ensure this is set in your .env file

  try {
      
      // Fetch player details
      const playerResponse = await axios.get(`https://cricket.sportmonks.com/api/v2.0/players/${playerId}?api_token=${apiKey}`);
      
      console.log('Player Response:', JSON.stringify(playerResponse.data, null, 2));

      // Check if the response indicates success
      if (!playerResponse.data || !playerResponse.data.data) {
        return res.status(404).send('Player not found');
      }

      const player = playerResponse.data.data; // Get player data directly

      // Prepare player details for rendering
      const playerDetails = {
          id: player.id,
          fullname: player.fullname,
          firstname: player.firstname,
          lastname: player.lastname,
          imagePath: player.image_path,
          dateOfBirth: player.dateofbirth,
          gender: player.gender,
          battingStyle: player.battingstyle,
          bowlingStyle: player.bowlingstyle,
          position: player.position.name, // Accessing position name
      };

      // Fetch career stats
      const careerResponse = await axios.get(`https://cricket.sportmonks.com/api/v2.0/players/${playerId}?include=career&api_token=${apiKey}`);
      const careerStats = careerResponse.data.data.career || [];

      // Map the relevant statistics to a more usable format
      const formattedCareerStats = careerStats.map(stat => ({
        format: stat.type, // Adjusted to use the correct field for format
        matches: stat.batting.matches || 'N/A',
        runs: stat.batting.runs_scored || 'N/A',
        wickets: stat.bowling ? stat.bowling.wickets || 'N/A' : 'N/A' // Assuming a similar structure for bowling
      }));

      console.log('Formatted Career Stats:', JSON.stringify(formattedCareerStats, null, 2));

    // Render the player details along with career stats
    res.render('player_details', { 
      player: playerDetails, 
      careerStats: formattedCareerStats 
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching player data');
  }
});


app.get('/admin', checkAuthenticated, (req, res) => {
  if (req.user.email.endsWith('@cricket.com')) {
    res.render('admin', { message: req.query.message || null }); // Render admin page
  } else {
    res.redirect('/login'); // Redirect to login if not an admin
  }
});

app.get('/about', (req, res) => {
  res.render('about');
});

// Create Team
app.post('/admin/add-team', upload.single('teamFlag'), async (req, res) => {
  try {
    const { teamName } = req.body;
    const teamFlag = req.file ? '/uploads/' + req.file.filename : null;

    const query = 'INSERT INTO teams (team_name, photo_path) VALUES (?, ?)';
    connection.query(query, [teamName, teamFlag], (err, result) => {
      if (err) {
        console.error('Error adding team:', err);
        return res.status(500).redirect('/admin?message=Error adding team');
      } else {
        res.status(201).redirect('/admin?message=Team added successfully');
      }
    });
  } catch (error) {
    console.error('Error in add team route:', error);
    res.status(500).redirect('/admin?message=Internal server error');
  }
});

// Update Team
app.post('/admin/update-team', async (req, res) => {
  try {
    console.log('Received body:', req.body); // Log the incoming request body

    const { id, team_name, photo_path } = req.body;

    // Check for required fields
    if (!id || !team_name) {
      console.error('Missing fields:', { id, team_name });
      return res.status(400).redirect('/admin?message=Missing required fields');
    }

    const query = 'UPDATE `teams` SET `team_name`=?, `photo_path`=? WHERE `id`=?';
    connection.query(query, [team_name, photo_path, id], (err, result) => {
      if (err) {
        console.error('Error updating team:', err);
        return res.status(500).redirect('/admin?message=Error updating team');
      }

      if (result.affectedRows === 0) {
        return res.status(404).redirect('/admin?message=Team not found or no changes made');
      }

      res.redirect('/admin?message=Team updated successfully');
    });
  } catch (error) {
    console.error('Error in update team route:', error);
    res.status(500).redirect('/admin?message=Internal server error');
  }
});

// Delete Team
app.post('/admin/delete-team', async (req, res) => {
  try {
    const { id } = req.body;
    const query = 'DELETE FROM teams WHERE id = ?';
    connection.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error deleting team:', err);
        return res.status(500).redirect('/admin?message=Error deleting team');
      } else {
        res.redirect('/admin?message=Team deleted successfully');
      }
    });
  } catch (error) {
    console.error('Error in delete team route:', error);
    res.status(500).redirect('/admin?message=Internal server error');
  }
});

// Create Player
app.post('/admin/add-player', upload.single('photo_path'), async (req, res) => {
  try {
    const {
      full_name,
      date_of_birth,
      batting_style,
      bowling_style,
      playing_role,
      player_profile,
      records,
      debut_match,
      last_match,
      age,
      teams
    } = req.body;

    const photo_path = req.file ? '/uploads/' + req.file.filename : null;

    const query = `
      INSERT INTO players (
        full_name, date_of_birth, age, batting_style, bowling_style, playing_role,
        player_profile, photo_path, debut_match, last_match, records
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const playerValues = [
      full_name, date_of_birth, age, batting_style, bowling_style, playing_role,
      player_profile, photo_path, debut_match, last_match, records
    ];

    connection.query(query, playerValues, (err, result) => {
      if (err) {
        console.error('Error adding player:', err);
        return res.status(500).json({ error: 'Error adding player', details: err.message });
      }

      const playerId = result.insertId;

      // If teams are provided, add them to the player_teams table
      if (teams && teams.length > 0) {
        const teamInsertQuery = 'INSERT INTO player_teams (player_id, team_id) VALUES ?';
        const teamValues = teams.map(teamId => [playerId, teamId]);

        connection.query(teamInsertQuery, [teamValues], (teamErr) => {
          if (teamErr) {
            console.error('Error adding teams:', teamErr);
            return res.status(500).redirect('/admin?message=Error updating team',teamErr.message );
          }
          res.status(201).redirect('/admin?message=Player and teams added successfully');
        });
      } else {
        res.status(201).redirect('/admin?message=Player added successfully');
      }
    });
  } catch (error) {
    console.error('Error in add player route:', error);
    res.status(500).redirect('/admin?message=Internal server error');

  }
});

app.post('/admin/update-player', upload.single('photo_path'), async (req, res) => {

  const {
      playerId,
      newfull_name,
      newdate_of_birth,
      newAge,
      newbatting_style,
      newbowling_style,
      newplaying_role,
      newteam,
      new_profile,
      add_profile,
      new_records,
      add_records,
      new_new_debut,
      add_new_debut,
      new_last_match,
      add_last_records
  } = req.body;

  // Check if playerId is provided
  if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
  }

  // Prepare the update statement
  const updates = [];
  const params = [];

  // Add fields to update based on non-empty values
  if (newfull_name) {
      updates.push('full_name = ?');
      params.push(newfull_name);
  }
  if (newdate_of_birth) {
      updates.push('date_of_birth = ?');
      params.push(newdate_of_birth);
  }
  if (newAge) {
      updates.push('age = ?');
      params.push(newAge);
  }
  if (newbatting_style) {
      updates.push('batting_style = ?');
      params.push(newbatting_style);
  }
  if (newbowling_style) {
      updates.push('bowling_style = ?');
      params.push(newbowling_style);
  }
  if (newplaying_role) {
      updates.push('playing_role = ?');
      params.push(newplaying_role);
  }
  if (newteam) {
      updates.push('team = ?');
      params.push(newteam);
  }
  if (new_profile) {
      updates.push('player_profile = ?');
      params.push(new_profile);
  }
  if (add_profile) {
      updates.push('player_profile = CONCAT(player_profile, ?, "")');
      params.push(`, ${add_profile}`); // Append new profile
  }
  if (new_records) {
      updates.push('records = ?');
      params.push(new_records);
  }
  if (add_records) {
      updates.push('records = CONCAT(records, ?, "")');
      params.push(`, ${add_records}`); // Append new records
  }
  if (new_new_debut) {
      updates.push('debut_match = ?');
      params.push(new_new_debut);
  }
  if (add_new_debut) {
      updates.push('debut_match = CONCAT(debut_match, ?, "")');
      params.push(`, ${add_new_debut}`); // Append new debut match
  }
  if (new_last_match) {
      updates.push('last_match = ?');
      params.push(new_last_match);
  }
  if (add_last_records) {
      updates.push('last_match = CONCAT(last_match, ?, "")');
      params.push(`, ${add_last_records}`); // Append new last match
  }
  if (req.file) {
      const photoPath = req.file.path; // Adjust according to how you store the file path
      updates.push('photo_path = ?');
      params.push(photoPath);
  }


  // Check for updates
  if (updates.length === 0) {
      return res.status(400).redirect('/admin?message=No fields to update');
  }

  // Add the playerId to the parameters
  params.push(playerId);

  // Construct the SQL query
  const sql = `UPDATE players SET ${updates.join(', ')} WHERE id = ?`;

  // Execute the query
  connection.query(sql, params, (err, result) => {
      if (err) {
          console.error('Update Error:', err);
          return res.status(500).redirect('/admin?message=An error occurred while updating the player');
      }
      res.status(200).redirect('/admin?message=Player updated successfully');
  });
});


// Delete Player
app.delete('/admin/delete-player/:id', async (req, res) => {
  const { id } = req.params;

  try {
      const query = 'DELETE FROM players WHERE id = ?';
      connection.query(query, [id], (err, result) => {
          if (err) {
              console.error('Error deleting player:', err);
              return res.status(500).json({ message: 'Error deleting player' });
          }
          res.status(200).json({ message: 'Player deleted successfully' });
      });
  } catch (error) {
      console.error('Error in delete player route:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to fetch and display matches
app.get('/matches', async (req, res) => {
  const options = {
    method: 'GET',
    url: 'https://api.cricapi.com/v1/matches?apikey=adeba55a-761c-4c2c-817b-9f7d9f9fd156&offset=0',
  };

  try {
    const response = await axios.request(options);
    console.log('Full response data:', JSON.stringify(response.data, null, 2));

    // Check if there are matches in the response
    if (!response.data || !response.data.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
      return res.render('matches', { matches: [] });
    }

    // Extract match data
    const matches = response.data.data.map(match => ({
      id: match.id,
      name: match.name,
      matchType: match.matchType,
      status: match.status,
      venue: match.venue,
      date: match.date,
    }));

    console.log('Matches data:', matches); // Debugging line

    // Render matches to the webpage
    res.render('matches', { matches });
  } catch (error) {
    console.error('Error fetching matches:', error.response ? error.response.data : error.message);
    res.status(500).render('error', { message: 'Failed to fetch match details' });
  }
});
app.get('/live_scores', async (req, res) => {
  try {
    const response = await axios.get('https://cricket.sportmonks.com/api/v2.0/livescores', {
      params: {
        api_token: process.env.CRICKET_DATA_API_KEY
      }
    });

    if (response.data && response.data.data) {
      const matchesData = response.data.data.map(match => ({
        matchDesc: match.matchDesc || 'N/A',
        team1: match.t1 || 'Team 1',
        team2: match.t2 || 'Team 2',
        team1Score: match.t1s || 'N/A',
        team2Score: match.t2s || 'N/A',
        seriesName: match.seriesName || 'N/A',
        matchFormat: match.matchType || 'N/A',
        status: match.status || 'N/A'
      }));
      console.log("live scoring:", matchesData);
      res.render('live_scores', { matchesData });
    } else {
      res.render('live_scores', { matchesData: [] });
    }
  } catch (error) {
    console.error('Error fetching live scores:', error);
    res.render('live_scores', { matchesData: [], error: 'Failed to fetch live scores' });
  }
});

// Error handling route
app.get('/error', (req, res) => {
    res.render('error', { message: 'An error occurred. Please try again.' });
});


// Route to fetch team details and players for a specific team
app.get('/teams', async (req, res) => {
  try {
    const teamsUrl = `https://cricket.sportmonks.com/api/v2.0/teams?api_token=${process.env.CRICKET_DATA_API_KEY}`;
    const rankingsUrl = `https://cricket.sportmonks.com/api/v2.0/team-rankings?api_token=${process.env.CRICKET_DATA_API_KEY}`;

    const [teamsResponse, rankingsResponse] = await Promise.all([
      axios.get(teamsUrl),
      axios.get(rankingsUrl)
    ]);

    const rankingsMap = new Map();
    if (rankingsResponse.data && rankingsResponse.data.data) {
      rankingsResponse.data.data.forEach(ranking => {
        if (ranking.team_id && ranking.position) {
          rankingsMap.set(ranking.team_id, ranking.position);
        }
      });
    }

    console.log("Global Ranking:", rankingsMap);

    const teamsData = teamsResponse.data.data.map(team => ({
      id: team.id,
      name: team.name,
      code: team.code,
      imagePath: team.image_path,
      ranking: rankingsMap.get(team.id) || null
    }));

    res.render('teams', { teamsData });
  } catch (error) {
    console.error('Error fetching teams or rankings:', error);
    res.status(500).render('error', { message: 'Failed to fetch teams or rankings' });
  }
});
app.get('/team/:teamId', async (req, res) => {
  const teamId = req.params.teamId;

  try {
    // Fetch team details
    const teamResponse = await axios.get(`https://cricket.sportmonks.com/api/v2.0/teams/${teamId}?api_token=${process.env.CRICKET_DATA_API_KEY}&include=squad`);
    const team = teamResponse.data.data;

    // The squad is now included in the team object
    const players = team.squad || [];

    // Render the team details along with the players
    res.render('team_details', { team, players });
  } catch (error) {
    console.error('Error fetching team data:', error.response ? error.response.data : error.message);
    res.status(500).render('error', { message: 'Error fetching team data' });
  }
});

// Render customer index page
app.get('/index', checkAuthenticated, (req, res) => {
  if (req.user.user_type === 'customer') {
    res.render('index'); // Render customer page
  } else {
    res.redirect('/login'); // Redirect to login if not a customer
  }
});

// Handle login
app.post('/login', passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: true
}), (req, res) => {
  if (req.user.email.endsWith('@cricket.com')) {
    res.redirect('/admin');
  } else {
    res.redirect('/index');
  }
});

app.post('/logout', (req, res, next) => {
  req.logout((err) => {
      if (err) { return next(err); }
      res.redirect('/login'); 
  });
});

// Render login page
app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login');
});

// Render registration page
app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register');
});

// Handle registration
app.post('/register', checkNotAuthenticated, async (req, res) => {
  const { name, email, password } = req.body;

  let userType;
  if (email.endsWith('@cricket.com')) {
    userType = 'admin';
  } else if (email.match(/@(gmail\.com|yahoo\.com|outlook\.com)$/)) {
    userType = 'customer';
  } else {
    return res.render('register', { messages: { error: 'Invalid email domain' } });
  }

  connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).send('Internal server error');
    }
    if (results.length > 0) {
      return res.render('register', { messages: { error: 'Email already in use' } });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      connection.query('INSERT INTO users (name, email, password, user_type) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, userType], (err) => {
        if (err) {
          console.error('Error inserting user:', err);
          return res.render('register', { messages: { error: 'Internal server error' } });
        }
        res.redirect('/login');
      });
    } catch (hashError) {
      console.error('Error hashing password:', hashError);
      res.status(500).send('Internal server error');
    }
  });
});

// Handle logout
app.delete('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(`Something broke! Error: ${err.message}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
