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
const crud = require('./crud'); // Import CRUD operations
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken'); 
const axios = require('axios'); 
const fetch = require('node-fetch');

// Create a connection to the database using environment variables
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10 // Adjust as needed
});

// Connection to DB
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database', err.stack);
    return;
  }
  console.log('Connected to the database.');
});

// Middleware setup
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
app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ extended: false }));

app.use((err, req, res, next) => {
  console.error('Error details:', err.stack); // Log stack trace
  res.status(500).send('Something went wrong!');
});


// View engine setup
app.set('view engine', 'ejs');
const path = require('path');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function authenticate(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  // Verify token (example using JWT)
  jwt.verify(token, 'your-secret-key', (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Failed to authenticate token.' });
    }
    req.user = decoded;
    next();
  });
}

// Apply middleware to routes
app.use('/api/protected', authenticate, (req, res) => {
  res.json({ message: 'You have access to this protected route.' });
});

// Define routes for teams and players
app.get('/teams', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:5000/teams');
    res.render('teams', { teams: response.data });
  } catch (error) {
    console.error('Error retrieving teams from Flask API:', error);
    res.status(500).send('Error retrieving teams');
  }
});

app.get('/players', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:5000/players');
    res.render('players', { players: response.data });
  } catch (error) {
    console.error('Error retrieving players from Flask API:', error);
    res.status(500).send('Error retrieving players');
  }
});

app.get('/', (req, res) => {
  res.render('live');
});


app.get('/api/cricket-scores', async (req, res) => {
  const url = "https://cricbuzz-cricket.p.rapidapi.com/matches/v1/recent";
  const headers = {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY, // Ensure this environment variable is correctly set
    "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com"
  };
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      // Log the response status and status text for debugging
      const errorText = await response.text(); // Get error text for more details
      throw new Error(`Error fetching scores: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Process the data as required
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
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});


app.get('/api/upcoming-matches', async (req, res) => {
  try {
      const response = await axios.get('http://localhost:5000/upcoming-matches');
      res.json(response.data);
  } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      res.status(500).send('Error fetching upcoming matches');
  }
});

// Other routes and passport configuration

app.post('/login', passport.authenticate('local', {
  successRedirect: '/index',
  failureRedirect: '/login',
  failureFlash: true
}), (req, res) => {
  console.log('User authenticated:', req.user);
  res.redirect('/index');
});

app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).send('Internal server error');
      }
      if (results.length > 0) {
        return res.render('register', { messages: { error: 'Email already in use' } });
      }

      try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the database
        connection.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], (err) => {
          if (err) {
            console.error('Error inserting user:', err);
            return res.status(500).send('Internal server error');
          }

          res.redirect('/login');
        });
      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        res.status(500).send('Internal server error');
      }
    });
  } catch (e) {
    console.error('Error during registration:', e);
    res.redirect('/register');
  }
});


passport.use(new LocalStrategy(
  {usernameField: 'email', passwordField: 'password'},
  (email, password, done) => {
    crud.getUserByEmail(
      email,
      (err, results) => {
        if (err) {
          return done(err); // handle database errors
        }
        if (!results || results.length === 0) {
          return done(null, false, { message: 'Incorrect email.' });
        }
        const user = results[0];

        bcrypt.compare(password, user.password, function(err, isMatch) {
          if (err) {
            return done(err);
          }
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: 'Incorrect password.' });
          }
        });
      });
  }
));

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  crud.getUserById(
    id,
    (err, results) => {
      if (err) {
        return done(err);
      }
      done(null, results);
    }
  );
});

app.get('/', checkAuthenticated, (req, res) => {
  res.render('index.ejs', { name: req.user.name });
});

app.get('/index', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('index', { email: req.user.email });
  } else {
    res.redirect('/login');
  }
});

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});

app.delete("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
