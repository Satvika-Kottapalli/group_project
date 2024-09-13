// Imports and initial setup
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

// Firebase setup
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
}));

// EJS setup
app.set('view engine', 'ejs');

// Routes

// Login page (GET)

app.get('/', (req, res) => {
    res.render('login', { error: null }); // Always pass error, even if it's null
});

// Signup page (GET)
app.get('/signup', (req, res) => {
  res.render('signup');  // Render signup page
});

// Signup route (POST)
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
        // Store user info in Firestore
        await db.collection('users').doc(username).set({
            username: username,
            password: hashedPassword,
        });

        // Redirect to login page after successful signup
        res.redirect('/');
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).send('Error during signup');
    }
});



// Login route (POST)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the user exists
        const userRef = db.collection('users').doc(username);
        const doc = await userRef.get();

        if (!doc.exists) {
            // User doesn't exist, send an error message
            return res.render('login', { error: 'Invalid username or password' });
        }

        const user = doc.data();

        // Compare passwords
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            // Password doesn't match, send an error message
            return res.render('login', { error: 'Invalid username or password' });
        }

        // If successful, start session and redirect to search page
        req.session.user = username;
        res.redirect('/search');
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal server error');
    }
});



// Search page (GET)
app.get('/search', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/'); // If not logged in, redirect to login
    }
    res.render('search', { recipes: [], error: null });
});

// Search results (POST)
app.post('/search', async (req, res) => {
    const ingredient = req.body.ingredient;
    const apiUrl = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        // If no meals are found, set recipes to undefined
        if (!data.meals) {
            return res.render('search', { recipes: [] });
        }
        
        // Render search page with the recipes related to the ingredient
        res.render('search', { recipes: data.meals });
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.send('Error fetching recipes');
    }
});


// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
