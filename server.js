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
app.use(express.urlencoded({ extended: false }));
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
  const url = `https://api.cricapi.com/v1/countries?apikey=${apiKey}&offset=${offset}`;

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
    connection.query('SELECT * FROM players', (err, results) => {
      if (err) {
        console.error('Error fetching players:', err);
        return res.status(500).send('Error fetching players');
      }
      res.json(results);
    });
  } catch (error) {
    console.error('Error in /players route:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/admin', checkAuthenticated, (req, res) => {
  if (req.user.email.endsWith('@cricket.com')) {
    res.render('admin'); // Render admin page
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
    const flagPath = req.file ? '/uploads/' + req.file.filename : null;
    
    const query = 'INSERT INTO teams (name, flag_path) VALUES (?, ?)';
    connection.query(query, [teamName, flagPath], (err, result) => {
      if (err) {
        console.error('Error adding team:', err);
        res.status(500).send('Error adding team');
      } else {
        res.status(201).send('Team added successfully');
      }
    });
  } catch (error) {
    console.error('Error in add team route:', error);
    res.status(500).send('Internal server error');
  }
});

// Update Team
app.put('/admin/update-team/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { teamName } = req.body;
    const query = 'UPDATE teams SET name = ? WHERE id = ?';
    connection.query(query, [teamName, id], (err, result) => {
      if (err) {
        console.error('Error updating team:', err);
        res.status(500).send('Error updating team');
      } else {
        res.send('Team updated successfully');
      }
    });
  } catch (error) {
    console.error('Error in update team route:', error);
    res.status(500).send('Internal server error');
  }
});

// Delete Team
app.delete('/admin/delete-team/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM teams WHERE id = ?';
    connection.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error deleting team:', err);
        res.status(500).send('Error deleting team');
      } else {
        res.send('Team deleted successfully');
      }
    });
  } catch (error) {
    console.error('Error in delete team route:', error);
    res.status(500).send('Internal server error');
  }
});



// Create Player
app.post('/admin/add-player', upload.single('playerPhoto'), async (req, res) => {
  try {
    const { playerName, teamId } = req.body;
    const photoPath = req.file ? '/uploads/' + req.file.filename : null;
    
    const query = 'INSERT INTO players (name, team_id, photo_path) VALUES (?, ?, ?)';
    connection.query(query, [playerName, teamId, photoPath], (err, result) => {
      if (err) {
        console.error('Error adding player:', err);
        res.status(500).send('Error adding player');
      } else {
        res.status(201).send('Player added successfully');
      }
    });
  } catch (error) {
    console.error('Error in add player route:', error);
    res.status(500).send('Internal server error');
  }
});

// Update Player
app.put('/admin/update-player/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { playerName, teamId } = req.body;
    const query = 'UPDATE players SET name = ?, team_id = ? WHERE id = ?';
    connection.query(query, [playerName, teamId, id], (err, result) => {
      if (err) {
        console.error('Error updating player:', err);
        res.status(500).send('Error updating player');
      } else {
        res.send('Player updated successfully');
      }
    });
  } catch (error) {
    console.error('Error in update player route:', error);
    res.status(500).send('Internal server error');
  }
});

// Delete Player
app.delete('/admin/delete-player/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM players WHERE id = ?';
    connection.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error deleting player:', err);
        res.status(500).send('Error deleting player');
      } else {
        res.send('Player deleted successfully');
      }
    });
  } catch (error) {
    console.error('Error in delete player route:', error);
    res.status(500).send('Internal server error');
  }
});

// Fetch cricket scores from external API
app.get('/api/cricket-scores', async (req, res) => {
  const url = "https://cricket-buzz-api.p.rapidapi.com/matches/v1/recent";
  const headers = {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
    "X-RapidAPI-Host": "cricket-buzz-api.p.rapidapi.com"
  };

  try {
    const response = await axios.get(url, { headers });
    const data = response.data;
    const matchesData = [];

    if (data['typeMatches']) {
      for (const match of data['typeMatches'][0]['seriesMatches'][0]['seriesAdWrapper']['matches']) {
        const matchInfo = {
          matchDesc: match['matchInfo']['matchDesc'],
          team1: match['matchInfo']['team1']['teamName'],
          team2: match['matchInfo']['team2']['teamName'],
          seriesName: match['matchInfo']['seriesName'],
          matchFormat: match['matchInfo']['matchFormat'],
          status: match['matchInfo']['status'],
          team1Score: `${match['matchScore']['team1Score']['inngs1']['runs']}/${match['matchScore']['team1Score']['inngs1']['wickets']} in ${match['matchScore']['team1Score']['inngs1']['overs']} overs`,
          team2Score: `${match['matchScore']['team2Score']['inngs1']['runs']}/${match['matchScore']['team2Score']['inngs1']['wickets']} in ${match['matchScore']['team2Score']['inngs1']['overs']} overs`
        };
        matchesData.push(matchInfo);
      }
    } else {
      return res.status(404).json({ error: 'No match data found' });
    }

    res.json(matchesData);
  } catch (error) {
    console.error('Error fetching scores:', error);
    if (error.response) {
      console.error(error.response.data);
      console.error(error.response.status);
      console.error(error.response.headers);
    } else if (error.request) {
      console.error(error.request);
    } else {
      console.error('Error', error.message);
    }
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// Render matches page with data
app.get('/matches', (req, res) => {
  const matches = []; 
  res.render('matches', { matches: matches });
});

// Render teams page with data
app.get('/teams', (req, res) => {
  res.render('teams');
});

// Fetch live scores and render
app.get('/live_scores', async (req, res) => {
  try {
    const url = "https://cricket-buzz-api.p.rapidapi.com/matches/v1/recent";
    const headers = {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": "cricket-buzz-api.p.rapidapi.com"
    };

    const response = await axios.get(url, { headers });
    console.log('API Response:', JSON.stringify(response.data, null, 2));
    const data = response.data;
    const matchesData = [];

    if (data['typeMatches']) {
      for (const match of data['typeMatches'][0]['seriesMatches'][0]['seriesAdWrapper']['matches']) {
        const matchInfo = {
          matchDesc: match['matchInfo']['matchDesc'],
          team1: match['matchInfo']['team1']['teamName'],
          team2: match['matchInfo']['team2']['teamName'],
          seriesName: match['matchInfo']['seriesName'],
          matchFormat: match['matchInfo']['matchFormat'],
          status: match['matchInfo']['status'],
          team1Score: `${match['matchScore']['team1Score']['inngs1']['runs']}/${match['matchScore']['team1Score']['inngs1']['wickets']} in ${match['matchScore']['team1Score']['inngs1']['overs']} overs`,
          team2Score: `${match['matchScore']['team2Score']['inngs1']['runs']}/${match['matchScore']['team2Score']['inngs1']['wickets']} in ${match['matchScore']['team2Score']['inngs1']['overs']} overs`
        };
        matchesData.push(matchInfo);
      }
    }

    res.render('live_scores', { matchesData });
  } catch (error) {
    console.error('Error fetching live scores:', error);
    res.status(500).render('error', { message: 'Failed to fetch live scores' });
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
