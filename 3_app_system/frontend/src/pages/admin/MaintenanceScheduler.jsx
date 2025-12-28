import React, { useState, useEffect } from 'react';

const MaintenanceScheduler = () => {
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'Routine Maintenance',
    priority: 'medium',
    scheduledDate: '',
    estimatedDuration: '',
    assignedTo: '',
    notes: ''
  });

  // Sample maintenance data
  useEffect(() => {
    const sampleTasks = [
      {
        id: 'MAINT-001',
        title: 'Database optimization and cleanup',
        description: 'Perform routine database maintenance including index optimization, cleanup of old logs, and performance tuning.',
        type: 'Routine Maintenance',
        priority: 'medium',
        status: 'scheduled',
        scheduledDate: '2024-01-20T02:00:00Z',
        estimatedDuration: '2 hours',
        assignedTo: 'Database Admin',
        createdAt: '2024-01-15T09:00:00Z',
        notes: 'This is a routine monthly maintenance task. Ensure all users are notified 24 hours in advance.',
        dependencies: ['Backup completion', 'User notification'],
        impact: 'Low - Minimal user impact expected'
      },
      {
        id: 'MAINT-002',
        title: 'Security patch deployment',
        description: 'Deploy latest security patches and update system dependencies to address critical vulnerabilities.',
        type: 'Security Update',
        priority: 'high',
        status: 'completed',
        scheduledDate: '2024-01-10T01:00:00Z',
        completedDate: '2024-01-10T03:30:00Z',
        estimatedDuration: '2.5 hours',
        actualDuration: '2.5 hours',
        assignedTo: 'Security Team',
        createdAt: '2024-01-08T14:00:00Z',
        notes: 'Successfully deployed all security patches. No issues encountered.',
        dependencies: ['Security team approval', 'Testing environment validation'],
        impact: 'Medium - Brief service interruption during deployment'
      },
      {
        id: 'MAINT-003',
        title: 'Server hardware upgrade',
        description: 'Upgrade server hardware components including RAM and storage to improve performance and reliability.',
        type: 'Hardware Upgrade',
        priority: 'high',
        status: 'in-progress',
        scheduledDate: '2024-01-18T00:00:00Z',
        estimatedDuration: '4 hours',
        assignedTo: 'Infrastructure Team',
        createdAt: '2024-01-12T10:00:00Z',
        notes: 'Hardware components have been ordered and are expected to arrive by Jan 17th.',
        dependencies: ['Hardware delivery', 'Data center access approval'],
        impact: 'High - Extended downtime expected'
      },
      {
        id: 'MAINT-004',
        title: 'Application version update',
        description: 'Update application to latest version with new features and bug fixes.',
        type: 'Application Update',
        priority: 'medium',
        status: 'scheduled',
        scheduledDate: '2024-01-25T01:00:00Z',
        estimatedDuration: '1.5 hours',
        assignedTo: 'Development Team',
        createdAt: '2024-01-16T11:00:00Z',
        notes: 'New version includes improved performance and new user interface enhancements.',
        dependencies: ['QA testing completion', 'Staging environment validation'],
        impact: 'Low - Rolling update with minimal downtime'
      },
      {
        id: 'MAINT-005',
        title: 'Backup system verification',
        description: 'Verify backup system integrity and test disaster recovery procedures.',
        type: 'Backup Verification',
        priority: 'low',
        status: 'pending',
        scheduledDate: '2024-01-22T03:00:00Z',
        estimatedDuration: '1 hour',
        assignedTo: 'System Admin',
        createdAt: '2024-01-17T14:00:00Z',
        notes: 'Quarterly backup verification to ensure data integrity and recovery procedures.',
        dependencies: ['Backup system access', 'Test environment setup'],
        impact: 'None - No user impact'
      }
    ];

    setMaintenanceTasks(sampleTasks);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Routine Maintenance': return 'bg-blue-100 text-blue-800';
      case 'Security Update': return 'bg-red-100 text-red-800';
      case 'Hardware Upgrade': return 'bg-purple-100 text-purple-800';
      case 'Application Update': return 'bg-green-100 text-green-800';
      case 'Backup Verification': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTasks = maintenanceTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreateTask = () => {
    const task = {
      id: `MAINT-${String(maintenanceTasks.length + 1).padStart(3, '0')}`,
      ...newTask,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      dependencies: [],
      impact: 'TBD'
    };
    setMaintenanceTasks([...maintenanceTasks, task]);
    setNewTask({
      title: '',
      description: '',
      type: 'Routine Maintenance',
      priority: 'medium',
      scheduledDate: '',
      estimatedDuration: '',
      assignedTo: '',
      notes: ''
    });
    setShowCreateModal(false);
  };

  const handleStatusChange = (taskId, newStatus) => {
    const updatedTasks = maintenanceTasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = { ...task, status: newStatus };
        if (newStatus === 'completed') {
          updatedTask.completedDate = new Date().toISOString();
        }
        return updatedTask;
      }
      return task;
    });
    setMaintenanceTasks(updatedTasks);
  };

  const MaintenanceCard = ({ task }) => (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                {task.status.replace('-', ' ').toUpperCase()}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                {task.priority.toUpperCase()}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(task.type)}`}>
                {task.type}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
              <div>
                <p><span className="font-medium">ID:</span> {task.id}</p>
                <p><span className="font-medium">Assigned to:</span> {task.assignedTo}</p>
                <p><span className="font-medium">Scheduled:</span> {formatDate(task.scheduledDate)}</p>
              </div>
              <div>
                <p><span className="font-medium">Duration:</span> {task.estimatedDuration}</p>
                <p><span className="font-medium">Impact:</span> {task.impact}</p>
                {task.completedDate && (
                  <p><span className="font-medium">Completed:</span> {formatDate(task.completedDate)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <p>Created: {formatDate(task.createdAt)}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setSelectedTask(task);
                setShowEditModal(true);
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              View Details
            </button>
            {task.status === 'scheduled' && (
              <button
                onClick={() => handleStatusChange(task.id, 'in-progress')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Start
              </button>
            )}
            {task.status === 'in-progress' && (
              <button
                onClick={() => handleStatusChange(task.id, 'completed')}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const CreateMaintenanceModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Schedule New Maintenance</h2>
            <button
              onClick={() => setShowCreateModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter maintenance title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Describe the maintenance task"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTask.type}
                  onChange={(e) => setNewTask({...newTask, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="Routine Maintenance">Routine Maintenance</option>
                  <option value="Security Update">Security Update</option>
                  <option value="Hardware Upgrade">Hardware Upgrade</option>
                  <option value="Application Update">Application Update</option>
                  <option value="Backup Verification">Backup Verification</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input
                  type="datetime-local"
                  value={newTask.scheduledDate}
                  onChange={(e) => setNewTask({...newTask, scheduledDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration</label>
                <input
                  type="text"
                  value={newTask.estimatedDuration}
                  onChange={(e) => setNewTask({...newTask, estimatedDuration: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 2 hours"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <input
                type="text"
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter assignee name or team"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={newTask.notes}
                onChange={(e) => setNewTask({...newTask, notes: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Additional notes or requirements"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Schedule Maintenance
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const TaskDetailsModal = ({ task, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Maintenance Task Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Title</label>
                  <p className="text-gray-900">{task.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900">{task.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className="text-gray-900">{task.type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Priority</label>
                    <p className="text-gray-900">{task.priority}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="text-gray-900">{task.status}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Assigned To</label>
                    <p className="text-gray-900">{task.assignedTo}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule & Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Scheduled Date</label>
                  <p className="text-gray-900">{formatDate(task.scheduledDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Estimated Duration</label>
                  <p className="text-gray-900">{task.estimatedDuration}</p>
                </div>
                {task.completedDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Completed Date</label>
                    <p className="text-gray-900">{formatDate(task.completedDate)}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Impact</label>
                  <p className="text-gray-900">{task.impact}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">{formatDate(task.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {task.notes && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{task.notes}</p>
              </div>
            </div>
          )}
          
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dependencies</h3>
              <ul className="list-disc list-inside space-y-1">
                {task.dependencies.map((dep, index) => (
                  <li key={index} className="text-gray-700">{dep}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Maintenance Scheduler</h2>
            <p className="text-gray-600">Plan and manage system maintenance activities effectively</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Schedule Maintenance</span>
          </button>
        </div>
        
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search maintenance tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Scheduled</p>
              <p className="text-2xl font-semibold text-gray-900">
                {maintenanceTasks.filter(t => t.status === 'scheduled').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">In Progress</p>
              <p className="text-2xl font-semibold text-gray-900">
                {maintenanceTasks.filter(t => t.status === 'in-progress').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {maintenanceTasks.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{maintenanceTasks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Tasks List */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <MaintenanceCard key={task.id} task={task} />
        ))}
      </div>

      {/* Modals */}
      {showCreateModal && <CreateMaintenanceModal />}
      
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => {
            setSelectedTask(null);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
};

export default MaintenanceScheduler;
