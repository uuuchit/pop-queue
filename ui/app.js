import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Container,
  Box
} from '@mui/material';
import { Settings, Refresh, PlayArrow, Replay, Add } from '@mui/icons-material';

const Dashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [newJob, setNewJob] = useState({
    jobName: '',
    jobIdentifier: '',
    jobData: '',
    jobScore: 0,
    priority: 1,
    delay: 0
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3210/api/job-details');
      const data = await response.json();
      setJobs(data);
    } catch (err) {
      setError('Failed to fetch jobs');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRequeueJob = async (jobId) => {
    try {
      await fetch('http://localhost:3210/api/requeue-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      fetchJobs();
    } catch (err) {
      setError('Failed to requeue job');
    }
  };

  const handleRunJob = async (jobName, jobIdentifier, jobData) => {
    try {
      await fetch('http://localhost:3210/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobName, jobIdentifier, jobData })
      });
      fetchJobs();
    } catch (err) {
      setError('Failed to run job');
    }
  };

  const handleAddNewJob = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:3210/api/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob)
      });
      setNewJob({
        jobName: '',
        jobIdentifier: '',
        jobData: '',
        jobScore: 0,
        priority: 1,
        delay: 0
      });
      fetchJobs();
    } catch (err) {
      setError('Failed to add new job');
    }
  };

  const handleDialogOpen = (job) => {
    setSelectedJob(job);
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setSelectedJob(null);
  };

  return (
    <Container maxWidth="md">
      <Box my={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Task Management Dashboard
        </Typography>
        <Box display="flex" justifyContent="space-between" mb={4}>
          <Button
            onClick={() => setShowConfig(!showConfig)}
            startIcon={<Settings />}
            variant="contained"
          >
            Configuration
          </Button>
          <Button
            onClick={fetchJobs}
            startIcon={<Refresh />}
            variant="contained"
            color="primary"
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Snackbar open={true} autoHideDuration={6000} onClose={() => setError(null)}>
            <Alert onClose={() => setError(null)} severity="error">
              {error}
            </Alert>
          </Snackbar>
        )}

        {showConfig && (
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardHeader title="Add New Job" />
            <CardContent>
              <form onSubmit={handleAddNewJob}>
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                  <TextField
                    label="Job Name"
                    value={newJob.jobName}
                    onChange={(e) => setNewJob({...newJob, jobName: e.target.value})}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Job Identifier"
                    value={newJob.jobIdentifier}
                    onChange={(e) => setNewJob({...newJob, jobIdentifier: e.target.value})}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Job Data (JSON)"
                    value={newJob.jobData}
                    onChange={(e) => setNewJob({...newJob, jobData: e.target.value})}
                    required
                    fullWidth
                    multiline
                    rows={4}
                  />
                  <TextField
                    label="Job Score"
                    type="number"
                    value={newJob.jobScore}
                    onChange={(e) => setNewJob({...newJob, jobScore: parseInt(e.target.value)})}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Priority"
                    type="number"
                    value={newJob.priority}
                    onChange={(e) => setNewJob({...newJob, priority: parseInt(e.target.value)})}
                    required
                    fullWidth
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="success"
                    startIcon={<Add />}
                    fullWidth
                  >
                    Add Job
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        )}

        <Card variant="outlined">
          <CardHeader title="Jobs Queue" />
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">Loading...</TableCell>
                    </TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No jobs found</TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.id}</TableCell>
                        <TableCell>{job.name}</TableCell>
                        <TableCell>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: job.status === 'done' ? '#d4edda' :
                                             job.status === 'failed' ? '#f8d7da' :
                                             '#fff3cd',
                            color: job.status === 'done' ? '#155724' :
                                   job.status === 'failed' ? '#721c24' :
                                   '#856404'
                          }}>
                            {job.status}
                          </span>
                        </TableCell>
                        <TableCell>{job.score}</TableCell>
                        <TableCell>{job.priority}</TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <Button
                              onClick={() => handleDialogOpen(job)}
                              startIcon={<PlayArrow />}
                              variant="contained"
                              color="primary"
                            >
                              Run
                            </Button>
                            <Button
                              onClick={() => handleRequeueJob(job.id)}
                              startIcon={<Replay />}
                              variant="contained"
                              color="warning"
                            >
                              Requeue
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Dialog open={openDialog} onClose={handleDialogClose}>
          <DialogTitle>Run Job</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to run this job? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} color="primary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleRunJob(selectedJob.name, selectedJob.identifier, selectedJob.data);
                handleDialogClose();
              }}
              color="primary"
              autoFocus
            >
              Run
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<Dashboard />);