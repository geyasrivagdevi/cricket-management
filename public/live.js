document.addEventListener('DOMContentLoaded', function() {
    const scoresElement = document.getElementById('scores');

    function fetchScores() {
        fetch('/api/cricket-scores') // This endpoint should return live scores
            .then(response => response.json())
            .then(data => {
                // Clear existing scores
                scoresElement.innerHTML = '';

                // Update scores
                data.forEach(match => {
                    const matchElement = document.createElement('div');
                    matchElement.classList.add('score');
                    matchElement.innerHTML = `
                        <strong>${match.matchDesc}</strong><br>
                        ${match.team1} vs ${match.team2}<br>
                        ${match.seriesName}<br>
                        ${match.matchFormat}<br>
                        Result: ${match.status}<br>
                        ${match.team1} Score: ${match.team1Score}<br>
                        ${match.team2} Score: ${match.team2Score}
                    `; // Adjust according to your data structure
                    scoresElement.appendChild(matchElement);
                });
            })
            .catch(error => console.error('Error fetching scores:', error));
    }

    // Fetch scores every second
    fetchScores(); // Initial fetch
    setInterval(fetchScores, 1000); // Fetch every second
});
