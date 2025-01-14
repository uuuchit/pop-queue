package main

import (
	"container/heap"
	"fmt"
	"sync"
	"time"
)

// Job represents a job in the queue
type Job struct {
	ID        string
	Priority  int
	Timestamp time.Time
	Index     int
}

// PriorityQueue implements heap.Interface and holds Jobs
type PriorityQueue []*Job

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	if pq[i].Priority == pq[j].Priority {
		return pq[i].Timestamp.Before(pq[j].Timestamp)
	}
	return pq[i].Priority > pq[j].Priority
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].Index = i
	pq[j].Index = j
}

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	job := x.(*Job)
	job.Index = n
	*pq = append(*pq, job)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	job := old[n-1]
	old[n-1] = nil
	job.Index = -1
	*pq = old[0 : n-1]
	return job
}

// JobQueue represents the job queue
type JobQueue struct {
	queue PriorityQueue
	mutex sync.Mutex
	cond  *sync.Cond
}

// NewJobQueue creates a new JobQueue
func NewJobQueue() *JobQueue {
	jq := &JobQueue{
		queue: make(PriorityQueue, 0),
	}
	jq.cond = sync.NewCond(&jq.mutex)
	heap.Init(&jq.queue)
	return jq
}

// AddJob adds a job to the queue
func (jq *JobQueue) AddJob(job *Job) {
	jq.mutex.Lock()
	defer jq.mutex.Unlock()
	heap.Push(&jq.queue, job)
	jq.cond.Signal()
}

// GetJob retrieves and removes the highest priority job from the queue
func (jq *JobQueue) GetJob() *Job {
	jq.mutex.Lock()
	defer jq.mutex.Unlock()
	for jq.queue.Len() == 0 {
		jq.cond.Wait()
	}
	return heap.Pop(&jq.queue).(*Job)
}

// Worker represents a worker that processes jobs
type Worker struct {
	ID       string
	JobQueue *JobQueue
}

// NewWorker creates a new Worker
func NewWorker(id string, jq *JobQueue) *Worker {
	return &Worker{
		ID:       id,
		JobQueue: jq,
	}
}

// Start starts the worker to process jobs
func (w *Worker) Start() {
	go func() {
		for {
			job := w.JobQueue.GetJob()
			w.processJob(job)
		}
	}()
}

// processJob processes a job
func (w *Worker) processJob(job *Job) {
	// Simulate job processing
	time.Sleep(2 * time.Second)
}

func main() {
	jobQueue := NewJobQueue()

	workerCount := 5
	workers := make([]*Worker, workerCount)
	for i := 0; i < workerCount; i++ {
		workers[i] = NewWorker(fmt.Sprintf("worker%d", i+1), jobQueue)
		workers[i].Start()
	}

	jobs := []*Job{
		{ID: "job1", Priority: 1, Timestamp: time.Now()},
		{ID: "job2", Priority: 2, Timestamp: time.Now()},
		{ID: "job3", Priority: 1, Timestamp: time.Now()},
	}

	for _, job := range jobs {
		jobQueue.AddJob(job)
	}

	time.Sleep(10 * time.Second)
}
