const request = require('supertest');
const app = require('../server'); // Update path as necessary
const { expect } = require('chai');
const { connection } = require('../crud'); // Assuming you have exported the connection

describe('Teams API', () => {
  let teamId;

  before((done) => {
    // Clear teams table before starting tests
    connection.query('DELETE FROM teams', done);
  });

  it('should create a team', (done) => {
    request(app)
      .post('/teams')
      .send({ name: 'Test Team' })
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('id');
        teamId = res.body.id;
        done();
      });
  });

  it('should get all teams', (done) => {
    request(app)
      .get('/teams')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('should get a team by ID', (done) => {
    request(app)
      .get(`/teams/${teamId}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('id', teamId);
        done();
      });
  });

  it('should update a team', (done) => {
    request(app)
      .put(`/teams/${teamId}`)
      .send({ name: 'Updated Team Name' })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.text).to.equal('Team updated successfully');
        done();
      });
  });

  it('should delete a team', (done) => {
    request(app)
      .delete(`/teams/${teamId}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.text).to.equal('Team deleted successfully');
        done();
      });
  });
});
