document.addEventListener('DOMContentLoaded', () => {
    fetchJobDetails();
    document.getElementById('requeue-job').addEventListener('click', requeueJob);
    document.getElementById('rate-limit').addEventListener('change', updateRateLimit);
    document.getElementById('concurrency').addEventListener('change', updateConcurrency);
    document.getElementById('retry-strategy').addEventListener('change', updateRetryStrategy);
    document.getElementById('backoff-strategy').addEventListener('change', updateBackoffStrategy);
    document.getElementById('job-progress').addEventListener('change', updateJobProgress);
    document.getElementById('completion-callback').addEventListener('change', updateCompletionCallback);
    document.getElementById('schema-validation').addEventListener('change', updateSchemaValidation);
    document.getElementById('job-dependencies').addEventListener('change', updateJobDependencies);
    document.getElementById('flow-control').addEventListener('change', updateFlowControl);
    document.getElementById('metrics').addEventListener('change', updateMetrics);
    document.getElementById('job-events').addEventListener('change', updateJobEvents);
    document.getElementById('listeners').addEventListener('change', updateListeners);
    document.getElementById('job-progress').addEventListener('input', updateJobProgress);
    document.getElementById('completion-callback').addEventListener('input', updateCompletionCallback);
    document.getElementById('schema-validation').addEventListener('input', updateSchemaValidation);
    document.getElementById('job-dependencies').addEventListener('input', updateJobDependencies);
    document.getElementById('flow-control').addEventListener('input', updateFlowControl);
    document.getElementById('metrics').addEventListener('input', updateMetrics);
    document.getElementById('job-events').addEventListener('input', updateJobEvents);
    document.getElementById('listeners').addEventListener('input', updateListeners);
});

async function fetchJobDetails() {
    try {
        const response = await fetch('http://localhost:3210/api/job-details');
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
            <p>Progress: ${job.progress ? job.progress + '%' : 'N/A'}</p>
        `;
        jobDetailsContainer.appendChild(jobElement);
    });
}

async function requeueJob() {
    try {
        const response = await fetch('http://localhost:3210/api/requeue-job', { method: 'POST' });
        if (response.ok) {
            alert('Job requeued successfully');
            fetchJobDetails();
        } else {
            const errorData = await response.json();
            alert(`Failed to requeue job: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error requeuing job:', error);
        alert('An error occurred while requeuing the job.');
    }
}

async function updateRateLimit(event) {
    try {
        const rateLimit = event.target.value;
        const response = await fetch('http://localhost:3210/api/rate-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rateLimit })
        });
        if (response.ok) {
            alert('Rate limit updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update rate limit: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating rate limit:', error);
        alert('An error occurred while updating the rate limit.');
    }
}

async function updateConcurrency(event) {
    try {
        const concurrency = event.target.value;
        const response = await fetch('http://localhost:3210/api/concurrency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concurrency })
        });
        if (response.ok) {
            alert('Concurrency updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update concurrency: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating concurrency:', error);
        alert('An error occurred while updating the concurrency.');
    }
}

async function updateRetryStrategy(event) {
    try {
        const retryStrategy = event.target.value;
        const response = await fetch('http://localhost:3210/api/retry-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ retryStrategy })
        });
        if (response.ok) {
            alert('Retry strategy updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update retry strategy: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating retry strategy:', error);
        alert('An error occurred while updating the retry strategy.');
    }
}

async function updateBackoffStrategy(event) {
    try {
        const backoffStrategy = event.target.value;
        const response = await fetch('http://localhost:3210/api/backoff-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backoffStrategy })
        });
        if (response.ok) {
            alert('Backoff strategy updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update backoff strategy: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating backoff strategy:', error);
        alert('An error occurred while updating the backoff strategy.');
    }
}

async function updateJobProgress(event) {
    try {
        const jobProgress = event.target.value;
        const response = await fetch('http://localhost:3210/api/job-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobProgress })
        });
        if (response.ok) {
            alert('Job progress updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update job progress: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating job progress:', error);
        alert('An error occurred while updating the job progress.');
    }
}

async function updateCompletionCallback(event) {
    try {
        const completionCallback = event.target.value;
        const response = await fetch('http://localhost:3210/api/completion-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completionCallback })
        });
        if (response.ok) {
            alert('Completion callback updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update completion callback: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating completion callback:', error);
        alert('An error occurred while updating the completion callback.');
    }
}

async function updateSchemaValidation(event) {
    try {
        const schemaValidation = event.target.value;
        const response = await fetch('http://localhost:3210/api/schema-validation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schemaValidation })
        });
        if (response.ok) {
            alert('Schema validation updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update schema validation: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating schema validation:', error);
        alert('An error occurred while updating the schema validation.');
    }
}

async function updateJobDependencies(event) {
    try {
        const jobDependencies = event.target.value;
        const response = await fetch('http://localhost:3210/api/job-dependencies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobDependencies })
        });
        if (response.ok) {
            alert('Job dependencies updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update job dependencies: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating job dependencies:', error);
        alert('An error occurred while updating the job dependencies.');
    }
}

async function updateFlowControl(event) {
    try {
        const flowControl = event.target.value;
        const response = await fetch('http://localhost:3210/api/flow-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flowControl })
        });
        if (response.ok) {
            alert('Flow control updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update flow control: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating flow control:', error);
        alert('An error occurred while updating the flow control.');
    }
}

async function updateMetrics(event) {
    try {
        const metrics = event.target.value;
        const response = await fetch('http://localhost:3210/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metrics })
        });
        if (response.ok) {
            alert('Metrics updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update metrics: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating metrics:', error);
        alert('An error occurred while updating the metrics.');
    }
}

async function updateJobEvents(event) {
    try {
        const jobEvents = event.target.value;
        const response = await fetch('http://localhost:3210/api/job-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobEvents })
        });
        if (response.ok) {
            alert('Job events updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update job events: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating job events:', error);
        alert('An error occurred while updating the job events.');
    }
}

async function updateListeners(event) {
    try {
        const listeners = event.target.value;
        const response = await fetch('http://localhost:3210/api/listeners', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listeners })
        });
        if (response.ok) {
            alert('Listeners updated successfully');
        } else {
            const errorData = await response.json();
            alert(`Failed to update listeners: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error updating listeners:', error);
        alert('An error occurred while updating the listeners.');
    }
}
