import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Table, Button, Layout, Menu } from 'shadcn';

const { Header, Sider, Content } = Layout;

const App = () => {
  const [jobDetails, setJobDetails] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchJobDetails();
  }, []);

  const fetchJobDetails = async () => {
    try {
      const response = await fetch('http://localhost:3210/api/job-details');
      const data = await response.json();
      setJobDetails(data);
    } catch (error) {
      console.error('Error fetching job details:', error);
    }
  };

  const requeueJob = async (jobId) => {
    try {
      const response = await fetch('http://localhost:3210/api/requeue-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
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
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Identifier', dataIndex: 'identifier', key: 'identifier' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (text) => new Date(text).toLocaleString() },
    { title: 'Picked At', dataIndex: 'pickedAt', key: 'pickedAt', render: (text) => text ? new Date(text).toLocaleString() : 'N/A' },
    { title: 'Finished At', dataIndex: 'finishedAt', key: 'finishedAt', render: (text) => text ? new Date(text).toLocaleString() : 'N/A' },
    { title: 'Progress', dataIndex: 'progress', key: 'progress', render: (text) => text ? `${text}%` : 'N/A' },
    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <Button onClick={() => requeueJob(record.identifier)}>Requeue</Button>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
          <Menu.Item key="1">Jobs Management</Menu.Item>
          <Menu.Item key="2">Config Setting</Menu.Item>
          <Menu.Item key="3">Dashboard</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0 }} />
        <Content style={{ margin: '0 16px' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            <Table columns={columns} dataSource={jobDetails} rowKey="identifier" />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
