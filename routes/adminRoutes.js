const express = require('express');
const router = express.Router();
const Team = require('/models/Team'); 
const Player = require('/models/Players'); 

// Create Team
router.post('/add-team', async (req, res) => {
    const { teamName } = req.body;
    try {
        const team = new Team({ name: teamName });
        await team.save();
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

// Read Teams
router.get('/teams', async (req, res) => {
    try {
        const teams = await Team.find();
        res.json(teams);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Update Team
router.post('/update-team/:id', async (req, res) => {
    const { id } = req.params;
    const { teamName } = req.body;
    try {
        await Team.findByIdAndUpdate(id, { name: teamName });
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

// Delete Team
router.post('/delete-team/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await Team.findByIdAndDelete(id);
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

// Similar routes for Player CRUD operations
// Create Player
router.post('/add-player', async (req, res) => {
    const { playerName, teamId } = req.body;
    try {
        const player = new Player({ name: playerName, team: teamId });
        await player.save();
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

// Read Players
router.get('/players', async (req, res) => {
    try {
        const players = await Player.find().populate('team');
        res.json(players);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Update Player
router.post('/update-player/:id', async (req, res) => {
    const { id } = req.params;
    const { playerName, teamId } = req.body;
    try {
        await Player.findByIdAndUpdate(id, { name: playerName, team: teamId });
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

// Delete Player
router.post('/delete-player/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await Player.findByIdAndDelete(id);
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

module.exports = router;
