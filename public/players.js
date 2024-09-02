document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();

    document.getElementById('addPlayerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.name.value;
        const position = e.target.position.value;
        const team_id = e.target.team_id.value;
        await axios.post('/api/players', { name, position, team_id });
        loadPlayers();
    });
});

async function loadPlayers() {
    const response = await axios.get('/api/players');
    const players = response.data;
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = players.map(player => `
        <li>
            ${player.name} - ${player.position} (Team ID: ${player.team_id})
            <button onclick="showEditForm(${player.id}, '${player.name}', '${player.position}', ${player.team_id})">Edit</button>
            <button onclick="deletePlayer(${player.id})">Delete</button>
        </li>
    `).join('');
}

function showEditForm(id, name, position, team_id) {
    const form = document.getElementById('addPlayerForm');
    form.name.value = name;
    form.position.value = position;
    form.team_id.value = team_id;
    form.dataset.editId = id;
    document.querySelector('button[type="submit"]').textContent = 'Update Player';
}

async function deletePlayer(id) {
    try {
        await axios.delete(`/api/players/${id}`);
        loadPlayers();
    } catch (error) {
        console.error('Error deleting player:', error);
    }
}

document.getElementById('addPlayerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const position = e.target.position.value;
    const team_id = e.target.team_id.value;
    const editId = e.target.dataset.editId;
    
    if (editId) {
        // Update existing player
        await axios.put(`/api/players/${editId}`, { name, position, team_id });
        delete e.target.dataset.editId; // Clear the edit ID
        document.querySelector('button[type="submit"]').textContent = 'Add Player';
    } else {
        // Add new player
        await axios.post('/api/players', { name, position, team_id });
    }
    e.target.reset(); // Reset form fields after submission
    loadPlayers();
});