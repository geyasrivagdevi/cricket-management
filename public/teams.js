document.addEventListener('DOMContentLoaded', () => {
    loadTeams();

    document.getElementById('addTeamForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.name.value;
        await axios.post('/api/teams', { name });
        loadTeams();
    });
});

async function loadTeams() {
    const response = await axios.get('/api/teams');
    const teams = response.data;
    const teamsList = document.getElementById('teamsList');
    teamsList.innerHTML = teams.map(team => `
        <li>
            ${team.name}
            <button onclick="showEditForm(${team.id}, '${team.name}')">Edit</button>
            <button onclick="deleteTeam(${team.id})">Delete</button>
        </li>
    `).join('');
}

function showEditForm(id, name) {
    // Display the edit form
    // You will need to add functionality to handle editing
}

async function deleteTeam(id) {
    await axios.delete(`/api/teams/${id}`);
    loadTeams();
}
