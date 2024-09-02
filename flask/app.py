from flask import Flask, request, jsonify, url_for, redirect, render_template, send_file, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_cors import CORS
import os
import requests
import json
from bs4 import BeautifulSoup
import csv
from io import StringIO
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret_key')
app.config['PORT'] = int(os.environ.get("PORT", 8080))

CORS(app)
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"

# Models
class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)

class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    position = db.Column(db.String(80), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    team = db.relationship('Team', backref=db.backref('players', lazy=True))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

# Create tables if they don't exist
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return send_from_directory('', 'live.html')


# Player class for handling cricket player data
class CricketPlayer:
    def __init__(self, player_id):
        self.player_id = player_id
        self.url = f"https://www.espncricinfo.com/player/player-name-{player_id}"
        self.json_url = f"http://core.espnuk.org/v2/sports/cricket/athletes/{player_id}"
        self.new_json_url = f"https://hs-consumer-api.espncricinfo.com/v1/pages/player/home?playerId={player_id}"
        self.headers = {'user-agent': 'Mozilla/5.0'}
        self.json = self.get_json()
        self.new_json = self.get_new_json()

    def get_html(self):
        r = requests.get(self.url, headers=self.headers)
        if r.status_code == 404:
            raise ValueError("Player not found")
        return BeautifulSoup(r.text, 'html.parser')

    def get_json(self):
        r = requests.get(self.json_url, headers=self.headers)
        if r.status_code == 404:
            raise ValueError("Player not found")
        return r.json()

    def get_new_json(self):
        r = requests.get(self.new_json_url, headers=self.headers)
        if r.status_code == 404:
            raise ValueError("Player not found")
        return r.json()

    def get_data(self, file_name=None, match_format=11, data_type='allround', view='match'):
        url = f"https://stats.espncricinfo.com/ci/engine/player/{self.player_id}.html?class={match_format};template=results;type={data_type};view={view}"
        html_doc = requests.get(url, headers=self.headers)
        soup = BeautifulSoup(html_doc.text, 'html.parser')
        tables = soup.find_all("table")[3]
        table_rows = tables.find_all("tr")
        scores = [tr.text for tr in table_rows]

        if file_name is None:
            file_name = f"{self.player_id}_{match_format}_{data_type}_{view}.csv"

        output = StringIO()
        writer = csv.writer(output)
        for row in scores:
            writer.writerow(row.splitlines())
        output.seek(0)
        return output, file_name

# Routes for fetching cricket scores
def Get_Cricket_Scores():
    url = "https://cricbuzz-cricket.p.rapidapi.com/matches/v1/recent"
    headers = {
        "X-RapidAPI-Key": "YOUR-API-KEY",
        "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com"
    }
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        return jsonify({'error': 'Failed to fetch scores'}), 500

    data = response.json()
    matches_data = []

    if 'typeMatches' in data:
        for match in data['typeMatches'][0]['seriesMatches'][0]['seriesAdWrapper']['matches']:
            match_info = {
                'matchDesc': match['matchInfo']['matchDesc'],
                'team1': match['matchInfo']['team1']['teamName'],
                'team2': match['matchInfo']['team2']['teamName'],
                'seriesName': match['matchInfo']['seriesName'],
                'matchFormat': match['matchInfo']['matchFormat'],
                'status': match['matchInfo']['status'],
                'team1Score': f"{match['matchScore']['team1Score']['inngs1']['runs']}/{match['matchScore']['team1Score']['inngs1']['wickets']} in {match['matchScore']['team1Score']['inngs1']['overs']} overs",
                'team2Score': f"{match['matchScore']['team2Score']['inngs1']['runs']}/{match['matchScore']['team2Score']['inngs1']['wickets']} in {match['matchScore']['team2Score']['inngs1']['overs']} overs"
            }
            matches_data.append(match_info)
    else:
        return jsonify({'error': 'No match data found'}), 404

    return jsonify(matches_data)

def fetch_upcoming_matches():
    url = "https://cricbuzz-cricket.p.rapidapi.com/schedule/v1/international"
    headers = {
        "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com",
        "X-RapidAPI-Key": "YOUR-API-KEY"
    }
    response = requests.get(url, headers=headers)
    upcoming_matches = []

    if response.status_code == 200:
        try:
            data = response.json()
            match_schedules = data.get('matchScheduleMap', [])

            for schedule in match_schedules:
                if 'scheduleAdWrapper' in schedule:
                    date = schedule['scheduleAdWrapper']['date']
                    matches = schedule['scheduleAdWrapper']['matchScheduleList']

                    for match_info in matches:
                        for match in match_info['matchInfo']:
                            description = match['matchDesc']
                            team1 = match['team1']['teamName']
                            team2 = match['team2']['teamName']
                            match_data = {
                                'Date': date,
                                'Description': description,
                                'Teams': f"{team1} vs {team2}"
                            }
                            upcoming_matches.append(match_data)
        except json.JSONDecodeError as e:
            print("Error parsing JSON:", e)
        except KeyError as e:
            print("Key error:", e)
    return upcoming_matches

@app.route('/')
def index():
    cricket_scores = Get_Cricket_Scores()
    upcoming_matches = fetch_upcoming_matches()
    return render_template('score.html', cricket_scores=cricket_scores, upcoming_matches=upcoming_matches)

# Routes for Teams
@app.route('/teams', methods=['POST'])
def create_team():
    data = request.get_json()
    new_team = Team(name=data['name'])
    db.session.add(new_team)
    db.session.commit()
    return jsonify({'id': new_team.id}), 201

@app.route('/teams', methods=['GET'])
def get_teams():
    teams = Team.query.all()
    return jsonify([{'id': team.id, 'name': team.name} for team in teams])

@app.route('/teams/<int:id>', methods=['GET'])
def get_team(id):
    team = Team.query.get_or_404(id)
    return jsonify({'id': team.id, 'name': team.name})

@app.route('/teams/<int:id>', methods=['PUT'])
def update_team(id):
    data = request.get_json()
    team = Team.query.get_or_404(id)
    team.name = data['name']
    db.session.commit()
    return jsonify({'id': team.id, 'name': team.name})

@app.route('/teams/<int:id>', methods=['DELETE'])
def delete_team(id):
    team = Team.query.get_or_404(id)
    db.session.delete(team)
    db.session.commit()
    return '', 204

# Routes for Players
@app.route('/players', methods=['POST'])
def create_player():
    data = request.get_json()
    new_player = Player(name=data['name'], position=data['position'], team_id=data['team_id'])
    db.session.add(new_player)
    db.session.commit()
    return jsonify({'id': new_player.id}), 201

@app.route('/players', methods=['GET'])
def get_players():
    players = Player.query.all()
    return jsonify([{'id': player.id, 'name': player.name, 'position': player.position, 'team_id': player.team_id} for player in players])

@app.route('/players/<int:id>', methods=['GET'])
def get_player(id):
    player = Player.query.get_or_404(id)
    return jsonify({'id': player.id, 'name': player.name, 'position': player.position, 'team_id': player.team_id})

@app.route('/players/<int:id>', methods=['PUT'])
def update_player(id):
    data = request.get_json()
    player = Player.query.get_or_404(id)
    player.name = data['name']
    player.position = data['position']
    player.team_id = data['team_id']
    db.session.commit()
    return jsonify({'id': player.id, 'name': player.name, 'position': player.position, 'team_id': player.team_id})

@app.route('/players/<int:id>', methods=['DELETE'])
def delete_player(id):
    player = Player.query.get_or_404(id)
    db.session.delete(player)
    db.session.commit()
    return '', 204

@app.route('/player/<int:player_id>/data', methods=['GET'])
def get_player_data(player_id):
    player = CricketPlayer(player_id)
    file_name = request.args.get('file_name')
    match_format = int(request.args.get('match_format', 11))
    data_type = request.args.get('data_type', 'allround')
    view = request.args.get('view', 'match')
    
    csv_data, filename = player.get_data(file_name, match_format, data_type, view)
    
    return send_file(
        csv_data,
        mimetype='text/csv',
        as_attachment=True,
        attachment_filename=filename
    )

# Authentication and user registration routes
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data['email']
    password = data['password']

    if not email or not password:
        return jsonify({'error': 'Missing email or password'}), 400
    
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    try:
        new_user = User(email=email, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'User with this email already exists'}), 400
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()

    if user and bcrypt.check_password_hash(user.password, password):
        login_user(user)
        return jsonify({'message': 'Logged in successfully'}), 200
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

if __name__ == '__main__':
    app.run(port=app.config['PORT'], host='0.0.0.0', debug=True)
