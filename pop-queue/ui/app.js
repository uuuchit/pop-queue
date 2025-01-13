document.addEventListener('DOMContentLoaded', () => {
    fetchJobDetails();
    document.getElementById('requeue-job').addEventListener('click', requeueJob);
});

async function fetchJobDetails() {
    try {
        const response = await fetch('/api/job-details');
        const jobDetails = await response.json();
        displayJobDetails(jobDetails);
    } catch (error) {
        console.error('Error fetching job details:', error);
    }
}

function displayJobDetails(jobDetails) {
    const jobDetailsContainer = document.getElementById('job-details');
    jobDetailsContainer.innerHTML = '';

    jobDetails.forEach(job => {
        const jobElement = document.createElement('div');
        jobElement.classList.add('job');
        jobElement.innerHTML = `
            <h2>${job.name}</h2>
            <p>Identifier: ${job.identifier}</p>
            <p>Status: ${job.status}</p>
            <p>Created At: ${new Date(job.createdAt).toLocaleString()}</p>
            <p>Picked At: ${job.pickedAt ? new Date(job.pickedAt).toLocaleString() : 'N/A'}</p>
            <p>Finished At: ${job.finishedAt ? new Date(job.finishedAt).toLocaleString() : 'N/A'}</p>
        `;
        jobDetailsContainer.appendChild(jobElement);
    });
}

async function requeueJob() {
    try {
        const response = await fetch('/api/requeue-job', { method: 'POST' });
        if (response.ok) {
            alert('Job requeued successfully');
            fetchJobDetails();
        } else {
            alert('Failed to requeue job');
        }
    } catch (error) {
        console.error('Error requeuing job:', error);
    }
}
