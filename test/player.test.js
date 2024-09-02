const request = require('supertest');
const app = require('../server'); // Update path as necessary
const { expect } = require('chai');
const { connection } = require('../crud'); // Assuming you have exported the connection

describe('Players API', () => {
  let teamId;
  let playerId;

  before((done) => {
    // Clear players and teams tables before starting tests
    connection.query('DELETE FROM players', (err) => {
      if (err) return done(err);
      connection.query('DELETE FROM teams', done);
    });
  });

  beforeEach((done) => {
    request(app)
      .post('/teams')
      .send({ name: 'Test Team for Player' })
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        teamId = res.body.id;
        done();
      });
  });

  it('should create a player', (done) => {
    request(app)
      .post('/players')
      .send({ name: 'Test Player', position: 'Forward', team_id: teamId })
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('id');
        playerId = res.body.id;
        done();
      });
  });

  it('should get all players', (done) => {
    request(app)
      .get('/players')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('should get a player by ID', (done) => {
    request(app)
      .get(`/players/${playerId}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('id', playerId);
        done();
      });
  });

  it('should update a player', (done) => {
    request(app)
      .put(`/players/${playerId}`)
      .send({ name: 'Updated Player Name', position: 'Midfielder', team_id: teamId })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.text).to.equal('Player updated successfully');
        done();
      });
  });

  it('should delete a player', (done) => {
    request(app)
      .delete(`/players/${playerId}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.text).to.equal('Player deleted successfully');
        done();
      });
  });
});
