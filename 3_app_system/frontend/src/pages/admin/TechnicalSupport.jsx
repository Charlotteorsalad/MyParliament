import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api';

const TechnicalSupport = ({ togglePin, isPinned, PinButton }) => {
  const [activeTab, setActiveTab] = useState('incidents');
  const [tickets, setTickets] = useState([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateMaintenance, setShowCreateMaintenance] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Maintenance Scheduler states
  const [scheduledMaintenance, setScheduledMaintenance] = useState([]);
  const [showCreateScheduledMaintenance, setShowCreateScheduledMaintenance] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [maintenanceView, setMaintenanceView] = useState('calendar'); // 'calendar' or 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Incident creation states
  const [incidentForm, setIncidentForm] = useState({
    shortDescription: '',
    description: '',
    priority: '3 - Medium',
    urgency: '3 - Medium',
    impact: '3 - Medium',
    category: '',
    subcategory: '',
    caller: '',
    callerEmail: '',
    assignedTo: '',
    assignmentGroup: ''
  });
  const [incidentFormErrors, setIncidentFormErrors] = useState({});
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  
  // Change request creation states
  const [changeForm, setChangeForm] = useState({
    shortDescription: '',
    description: '',
    priority: '3 - Medium',
    category: '',
    subcategory: '',
    requestedBy: '',
    requestedByEmail: '',
    assignedTo: '',
    assignmentGroup: '',
    scheduledStart: '',
    scheduledEnd: '',
    estimatedDuration: '2 hours',
    businessJustification: '',
    riskAssessment: 'Low',
    implementationPlan: '',
    rollbackPlan: '',
    testingPlan: '',
    communicationPlan: ''
  });
  const [changeFormErrors, setChangeFormErrors] = useState({});
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);

  // Maintenance creation states
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    description: '',
    type: 'Scheduled',
    priority: '3 - Medium',
    category: '',
    assignedTo: '',
    assignmentGroup: '',
    scheduledDate: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
    estimatedDuration: '',
    isRecurring: false,
    recurrencePattern: 'Monthly',
    recurrenceInterval: 1,
    businessService: '',
    configurationItems: [],
    dependencies: [],
    prerequisites: '',
    rollbackPlan: '',
    impactLevel: 'Medium',
    riskLevel: 'Medium',
    affectedSystems: [],
    communicationPlan: '',
    stakeholders: [],
    tags: []
  });
  const [maintenanceFormErrors, setMaintenanceFormErrors] = useState({});
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);

  // Helper function to check if admin token is valid
  const isValidAdminToken = (token) => {
    return token && 
           token !== 'null' && 
           token !== 'undefined' && 
           token.trim() !== '' && 
           token.length > 10; // Basic validation
  };

  // Clear invalid admin token
  const clearInvalidAdminToken = () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!isValidAdminToken(adminToken)) {
      console.log('🧹 Clearing invalid admin token');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
    }
  };

  // Fetch admin users for assignment
  useEffect(() => {
    const fetchAdminUsers = async () => {
      try {
        // Clear any invalid admin tokens first
        clearInvalidAdminToken();
        
        // Check if admin is logged in
        const adminToken = localStorage.getItem('adminToken');
        console.log('🔍 fetchAdminUsers - Admin token exists:', !!adminToken);
        console.log('🔍 fetchAdminUsers - Admin token value:', adminToken);
        console.log('🔍 fetchAdminUsers - Admin token length:', adminToken ? adminToken.length : 0);
        
        if (!isValidAdminToken(adminToken)) {
          console.log('✅ No valid admin token found, using sample data');
          const sampleAdmins = [
            { _id: 'admin1', name: 'John Admin', role: 'IT Manager', email: 'john.admin@parliament.gov' },
            { _id: 'admin2', name: 'Sarah Tech', role: 'Senior Developer', email: 'sarah.tech@parliament.gov' },
            { _id: 'admin3', name: 'Mike Support', role: 'Support Specialist', email: 'mike.support@parliament.gov' },
            { _id: 'admin4', name: 'Lisa Security', role: 'Security Admin', email: 'lisa.security@parliament.gov' },
            { _id: 'admin5', name: 'David DevOps', role: 'DevOps Engineer', email: 'david.devops@parliament.gov' }
          ];
          setAdminUsers(sampleAdmins);
          return;
        } else {
          // Admin token exists, make API call
          console.log('🚀 Making API call to getAdminUsers');
          const response = await adminApi.getAdminUsers();
          console.log('✅ API call successful, response:', response.data);
          setAdminUsers(response.data);
        }
      } catch (error) {
        console.error('Error fetching admin users:', error);
        // Fallback to sample data if API fails
        const sampleAdmins = [
          { _id: 'admin1', name: 'John Admin', role: 'IT Manager', email: 'john.admin@parliament.gov' },
          { _id: 'admin2', name: 'Sarah Tech', role: 'Senior Developer', email: 'sarah.tech@parliament.gov' },
          { _id: 'admin3', name: 'Mike Support', role: 'Support Specialist', email: 'mike.support@parliament.gov' },
          { _id: 'admin4', name: 'Lisa Security', role: 'Security Admin', email: 'lisa.security@parliament.gov' },
          { _id: 'admin5', name: 'David DevOps', role: 'DevOps Engineer', email: 'david.devops@parliament.gov' }
        ];
        setAdminUsers(sampleAdmins);
      }
    };

    fetchAdminUsers();
  }, []);

  // Fetch incidents data
  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Clear any invalid admin tokens first
      clearInvalidAdminToken();
      
      // Check if admin is logged in
      const adminToken = localStorage.getItem('adminToken');
      console.log('🔍 fetchIncidents - Admin token exists:', !!adminToken);
      console.log('🔍 fetchIncidents - Admin token value:', adminToken);
      console.log('🔍 fetchIncidents - Admin token length:', adminToken ? adminToken.length : 0);
      
      if (!isValidAdminToken(adminToken)) {
        console.log('✅ No valid admin token found, using sample data for incidents');
        // Use sample data when not logged in
        const sampleTickets = [
          {
            _id: 'INC0010001',
            number: 'INC0010001',
            shortDescription: 'Report module glitching intermittently',
            description: 'Users are experiencing intermittent glitches when generating reports. The issue occurs randomly and affects data accuracy. Multiple users have reported this issue across different browsers.',
            state: 'New',
            priority: '2 - High',
            urgency: '2 - High',
            impact: '2 - High',
            category: 'Software',
            subcategory: 'Application',
            caller: 'John Smith',
            callerEmail: 'john.smith@parliament.gov',
            assignedTo: 'admin2',
            assignedToName: 'Sarah Tech',
            assignmentGroup: 'Application Development',
            openedBy: 'admin1',
            openedByName: 'John Admin',
            openedAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            resolvedAt: null,
            closedAt: null,
            workNotes: [],
            resolutionNotes: '',
            slaDue: '2024-01-15T18:30:00Z'
          },
          {
            _id: 'INC0010002',
            number: 'INC0010002',
            shortDescription: 'Database connection timeout errors',
            description: 'Users experiencing frequent database connection timeouts when accessing the system. This affects data retrieval and system performance.',
            state: 'In Progress',
            priority: '1 - Critical',
            urgency: '1 - Critical',
            impact: '1 - Critical',
            category: 'Infrastructure',
            subcategory: 'Database',
            caller: 'Mary Johnson',
            callerEmail: 'mary.johnson@parliament.gov',
            assignedTo: 'admin3',
            assignedToName: 'Mike Support',
            assignmentGroup: 'Database Team',
            openedBy: 'admin1',
            openedByName: 'John Admin',
            openedAt: '2024-01-14T14:20:00Z',
            updatedAt: '2024-01-15T08:45:00Z',
            resolvedAt: null,
            closedAt: null,
            workNotes: [
              {
                id: 1,
                author: 'Mike Support',
                authorId: 'admin3',
                note: 'Investigating database connection pool settings and monitoring logs',
                timestamp: '2024-01-15T08:45:00Z',
                isPublic: true
              }
            ],
            resolutionNotes: '',
            slaDue: '2024-01-15T16:20:00Z'
          },
          {
            _id: 'INC0010003',
            number: 'INC0010003',
            shortDescription: 'User authentication issues',
            description: 'Some users unable to log in with their credentials. Error message shows "Invalid credentials" even with correct password.',
            state: 'Resolved',
            priority: '2 - High',
            urgency: '2 - High',
            impact: '2 - High',
            category: 'Security',
            subcategory: 'Authentication',
            caller: 'David Wilson',
            callerEmail: 'david.wilson@parliament.gov',
            assignedTo: 'admin4',
            assignedToName: 'Lisa Security',
            assignmentGroup: 'Security Team',
            openedBy: 'admin1',
            openedByName: 'John Admin',
            openedAt: '2024-01-13T09:15:00Z',
            updatedAt: '2024-01-14T11:30:00Z',
            resolvedAt: '2024-01-14T11:30:00Z',
            closedAt: '2024-01-14T11:30:00Z',
            workNotes: [
              {
                id: 1,
                author: 'Lisa Security',
                authorId: 'admin4',
                note: 'Identified issue with password hashing algorithm. Updated to use bcrypt.',
                timestamp: '2024-01-14T10:15:00Z',
                isPublic: true
              }
            ],
            resolutionNotes: 'Fixed password hashing algorithm. All affected users can now log in successfully.',
            slaDue: '2024-01-15T09:15:00Z'
          }
        ];
        setTickets(sampleTickets);
        setTotalPages(1);
        setLoading(false);
        return;
      } else {
        // Admin token exists, make API call
        const params = {
          page: currentPage,
          limit: 10,
          sortBy,
          sortOrder,
          searchTerm,
          filterState: filterStatus,
          filterPriority,
          filterAssignee
        };

        console.log('🚀 Making API call to getAllIncidents with params:', params);
        const response = await adminApi.getAllIncidents(params);
        console.log('✅ API call successful, response:', response.data);
        setTickets(response.data.incidents);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      // Fallback to sample data if API fails
      const sampleTickets = [
      {
        id: 'INC0010001',
        number: 'INC0010001',
        shortDescription: 'Report module glitching intermittently',
        description: 'Users are experiencing intermittent glitches when generating reports. The issue occurs randomly and affects data accuracy. Multiple users have reported this issue across different browsers.',
        state: 'New',
        priority: '2 - High',
        urgency: '2 - High',
        impact: '2 - High',
        category: 'Software',
        subcategory: 'Application',
        caller: 'John Smith',
        callerEmail: 'john.smith@parliament.gov',
        assignedTo: 'admin2',
        assignedToName: 'Sarah Tech',
        assignmentGroup: 'Application Development',
        openedBy: 'admin1',
        openedByName: 'John Admin',
        openedAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        resolvedAt: null,
        closedAt: null,
        workNotes: [
          {
            id: 1,
            author: 'Sarah Tech',
            authorId: 'admin2',
            content: 'Initial investigation started. Checking application logs for patterns.',
            timestamp: '2024-01-15T11:00:00Z',
            isPublic: true
          }
        ],
        resolutionNotes: '',
        businessService: 'Parliament Management System',
        configurationItem: 'Report Generation Module',
        slaDue: '2024-01-17T10:30:00Z',
        escalationLevel: 0,
        isEscalated: false
      },
      {
        id: 'INC0010002',
        number: 'INC0010002',
        shortDescription: 'Authentication service failing for some users',
        description: 'Some users are unable to log in despite correct credentials. Error message appears after 3 attempts. This is affecting user productivity.',
        state: 'In Progress',
        priority: '1 - Critical',
        urgency: '1 - Critical',
        impact: '1 - Critical',
        category: 'Software',
        subcategory: 'Authentication',
        caller: 'Sarah Johnson',
        callerEmail: 'sarah.johnson@parliament.gov',
        assignedTo: 'admin3',
        assignedToName: 'Mike Support',
        assignmentGroup: 'IT Support',
        openedBy: 'admin1',
        openedByName: 'John Admin',
        openedAt: '2024-01-14T14:20:00Z',
        updatedAt: '2024-01-15T09:15:00Z',
        resolvedAt: null,
        closedAt: null,
        workNotes: [
          {
            id: 1,
            author: 'Mike Support',
            authorId: 'admin3',
            content: 'Investigating the authentication service logs. Found some anomalies in the token validation process.',
            timestamp: '2024-01-15T09:15:00Z',
            isPublic: true
          },
          {
            id: 2,
            author: 'Lisa Security',
            authorId: 'admin4',
            content: 'Security team notified. Checking for potential security implications.',
            timestamp: '2024-01-15T10:00:00Z',
            isPublic: false
          }
        ],
        resolutionNotes: '',
        businessService: 'User Authentication',
        configurationItem: 'Authentication Service',
        slaDue: '2024-01-16T14:20:00Z',
        escalationLevel: 1,
        isEscalated: true
      },
      {
        id: 'INC0010003',
        number: 'INC0010003',
        shortDescription: 'Database connection timeout during peak hours',
        description: 'Database queries are timing out during peak hours, causing slow response times and occasional service unavailability.',
        state: 'Resolved',
        priority: '2 - High',
        urgency: '2 - High',
        impact: '2 - High',
        category: 'Infrastructure',
        subcategory: 'Database',
        caller: 'Mike Wilson',
        callerEmail: 'mike.wilson@parliament.gov',
        assignedTo: 'admin5',
        assignedToName: 'David DevOps',
        assignmentGroup: 'Infrastructure',
        openedBy: 'admin1',
        openedByName: 'John Admin',
        openedAt: '2024-01-10T08:45:00Z',
        updatedAt: '2024-01-12T16:30:00Z',
        resolvedAt: '2024-01-12T16:30:00Z',
        closedAt: '2024-01-12T16:30:00Z',
        workNotes: [
          {
            id: 1,
            author: 'David DevOps',
            authorId: 'admin5',
            content: 'Identified the issue with connection pooling. Implemented fix and monitoring.',
            timestamp: '2024-01-11T14:20:00Z',
            isPublic: true
          },
          {
            id: 2,
            author: 'John Admin',
            authorId: 'admin1',
            content: 'Verified the fix. Performance has improved significantly. Closing incident.',
            timestamp: '2024-01-12T16:30:00Z',
            isPublic: true
          }
        ],
        resolutionNotes: 'Updated database connection pool settings and implemented monitoring. Performance restored to normal levels.',
        businessService: 'Database Services',
        configurationItem: 'Primary Database Server',
        slaDue: '2024-01-12T08:45:00Z',
        escalationLevel: 0,
        isEscalated: false
      },
      {
        id: 'INC0010004',
        number: 'INC0010004',
        shortDescription: 'Mobile responsiveness issues on user interface',
        description: 'The interface is not properly responsive on mobile devices, causing layout issues and poor user experience.',
        state: 'New',
        priority: '4 - Low',
        urgency: '4 - Low',
        impact: '4 - Low',
        category: 'Software',
        subcategory: 'User Interface',
        caller: 'Lisa Brown',
        callerEmail: 'lisa.brown@parliament.gov',
        assignedTo: null,
        assignedToName: 'Unassigned',
        assignmentGroup: 'Application Development',
        openedBy: 'admin1',
        openedByName: 'John Admin',
        openedAt: '2024-01-13T11:10:00Z',
        updatedAt: '2024-01-13T11:10:00Z',
        resolvedAt: null,
        closedAt: null,
        workNotes: [],
        resolutionNotes: '',
        businessService: 'Parliament Management System',
        configurationItem: 'Frontend Application',
        slaDue: '2024-01-20T11:10:00Z',
        escalationLevel: 0,
        isEscalated: false
      }
    ];

    const sampleMaintenance = [
      {
        id: 'CHG0010001',
        number: 'CHG0010001',
        shortDescription: 'Database optimization and cleanup',
        description: 'Perform routine database maintenance including index optimization, cleanup of old logs, and performance tuning.',
        state: 'Scheduled',
        priority: '3 - Medium',
        category: 'Maintenance',
        subcategory: 'Database',
        requestedBy: 'admin1',
        requestedByName: 'John Admin',
        assignedTo: 'admin5',
        assignedToName: 'David DevOps',
        assignmentGroup: 'Infrastructure',
        scheduledStart: '2024-01-20T02:00:00Z',
        scheduledEnd: '2024-01-20T04:00:00Z',
        actualStart: null,
        actualEnd: null,
        estimatedDuration: '2 hours',
        actualDuration: null,
        businessJustification: 'Routine monthly maintenance to ensure optimal database performance',
        riskAssessment: 'Low - Scheduled during low usage hours',
        implementationPlan: '1. Backup database 2. Run optimization scripts 3. Clean up logs 4. Verify performance',
        rollbackPlan: 'Restore from backup if issues occur',
        approvalStatus: 'Approved',
        approvedBy: 'admin1',
        approvedAt: '2024-01-15T09:00:00Z',
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T09:00:00Z'
      },
      {
        id: 'CHG0010002',
        number: 'CHG0010002',
        shortDescription: 'Security patch deployment',
        description: 'Deploy latest security patches and update system dependencies to address critical vulnerabilities.',
        state: 'Completed',
        priority: '1 - Critical',
        category: 'Security',
        subcategory: 'Patch Management',
        requestedBy: 'admin4',
        requestedByName: 'Lisa Security',
        assignedTo: 'admin5',
        assignedToName: 'David DevOps',
        assignmentGroup: 'Infrastructure',
        scheduledStart: '2024-01-10T01:00:00Z',
        scheduledEnd: '2024-01-10T03:30:00Z',
        actualStart: '2024-01-10T01:00:00Z',
        actualEnd: '2024-01-10T03:30:00Z',
        estimatedDuration: '2.5 hours',
        actualDuration: '2.5 hours',
        businessJustification: 'Critical security vulnerabilities need immediate patching',
        riskAssessment: 'Medium - Brief service interruption during deployment',
        implementationPlan: '1. Test patches in staging 2. Deploy to production 3. Verify functionality',
        rollbackPlan: 'Rollback to previous version if issues occur',
        approvalStatus: 'Approved',
        approvedBy: 'admin1',
        approvedAt: '2024-01-09T14:00:00Z',
        createdAt: '2024-01-08T14:00:00Z',
        updatedAt: '2024-01-10T03:30:00Z'
      }
      ];
      setTickets(sampleTickets);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, searchTerm, filterStatus, filterPriority, filterAssignee]);

  // Fetch change requests data
  const fetchChangeRequests = useCallback(async () => {
    try {
      setLoading(true);
      
      // Clear any invalid admin tokens first
      clearInvalidAdminToken();
      
      // Check if admin is logged in
      const adminToken = localStorage.getItem('adminToken');
      console.log('🔍 fetchChangeRequests - Admin token exists:', !!adminToken);
      console.log('🔍 fetchChangeRequests - Admin token value:', adminToken);
      console.log('🔍 fetchChangeRequests - Admin token length:', adminToken ? adminToken.length : 0);
      
      if (isValidAdminToken(adminToken)) {
        // Admin token exists, make API call
        const params = {
          page: currentPage,
          limit: 10,
          sortBy,
          sortOrder,
          searchTerm,
          filterState: filterStatus,
          filterPriority,
          filterAssignee
        };

        console.log('🚀 Making API call to getAllChangeRequests with params:', params);
        const response = await adminApi.getAllChangeRequests(params);
        console.log('✅ API call successful, response:', response.data);
        setMaintenanceTasks(response.data.changeRequests);
      } else {
        // No valid token; do not populate with samples
        setMaintenanceTasks([]);
      }
    } catch (error) {
      console.error('Error fetching change requests:', error);
      // On error, do not populate with samples
      setMaintenanceTasks([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, searchTerm, filterStatus, filterPriority, filterAssignee]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterAssignee, sortBy, sortOrder]);

  // Load data when component mounts or filters change
  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    } else if (activeTab === 'changes') {
      fetchChangeRequests();
    } else if (activeTab === 'maintenance') {
      fetchScheduledMaintenance();
    }
  }, [activeTab, fetchIncidents, fetchChangeRequests]);

  // Fetch scheduled maintenance data
  const fetchScheduledMaintenance = useCallback(async () => {
    try {
      setLoading(true);
      
      // Clear any invalid admin tokens first
      clearInvalidAdminToken();
      
      // Check if admin is logged in
      const adminToken = localStorage.getItem('adminToken');
      
      if (!isValidAdminToken(adminToken)) {
        console.log('✅ No valid admin token found, using sample data for scheduled maintenance');
        // Use sample data when not logged in
        const sampleScheduledMaintenance = [
          {
            _id: 'MAINT001',
            title: 'Database Optimization',
            description: 'Monthly database optimization and cleanup',
            type: 'Recurring',
            frequency: 'Monthly',
            scheduledDate: '2024-01-20T02:00:00Z',
            estimatedDuration: '2 hours',
            assignedTo: 'admin5',
            assignedToName: 'David DevOps',
            status: 'Scheduled',
            priority: 'Medium',
            category: 'Database',
            lastExecuted: '2023-12-20T02:00:00Z',
            nextExecution: '2024-01-20T02:00:00Z',
            createdAt: '2023-12-15T09:00:00Z',
            updatedAt: '2024-01-15T09:00:00Z'
          },
          {
            _id: 'MAINT002',
            title: 'Security Patch Update',
            description: 'Deploy latest security patches and updates',
            type: 'One-time',
            frequency: 'N/A',
            scheduledDate: '2024-01-25T01:00:00Z',
            estimatedDuration: '1.5 hours',
            assignedTo: 'admin4',
            assignedToName: 'Lisa Security',
            status: 'Scheduled',
            priority: 'High',
            category: 'Security',
            lastExecuted: null,
            nextExecution: '2024-01-25T01:00:00Z',
            createdAt: '2024-01-10T14:00:00Z',
            updatedAt: '2024-01-10T14:00:00Z'
          },
          {
            _id: 'MAINT003',
            title: 'System Backup Verification',
            description: 'Verify and test system backup integrity',
            type: 'Recurring',
            frequency: 'Weekly',
            scheduledDate: '2024-01-18T03:00:00Z',
            estimatedDuration: '1 hour',
            assignedTo: 'admin5',
            assignedToName: 'David DevOps',
            status: 'Scheduled',
            priority: 'High',
            category: 'Backup',
            lastExecuted: '2024-01-11T03:00:00Z',
            nextExecution: '2024-01-18T03:00:00Z',
            createdAt: '2024-01-01T09:00:00Z',
            updatedAt: '2024-01-15T09:00:00Z'
          },
          {
            _id: 'MAINT004',
            title: 'Log Cleanup',
            description: 'Clean up old log files and archive important ones',
            type: 'Recurring',
            frequency: 'Weekly',
            scheduledDate: '2024-01-19T04:00:00Z',
            estimatedDuration: '30 minutes',
            assignedTo: 'admin2',
            assignedToName: 'Sarah Tech',
            status: 'Completed',
            priority: 'Low',
            category: 'Maintenance',
            lastExecuted: '2024-01-12T04:00:00Z',
            nextExecution: '2024-01-19T04:00:00Z',
            createdAt: '2024-01-01T09:00:00Z',
            updatedAt: '2024-01-12T04:30:00Z'
          }
        ];
        setScheduledMaintenance(sampleScheduledMaintenance);
        setLoading(false);
        return;
      } else {
        // Admin token exists, make API call
        const response = await adminApi.getAllMaintenanceTasks({
          page: 1,
          limit: 50,
          sortBy: 'scheduledDate',
          sortOrder: 'asc'
        });
        setScheduledMaintenance(response.data.maintenanceTasks || []);
      }
    } catch (error) {
      console.error('Error fetching scheduled maintenance:', error);
      // Fallback to sample data if API fails
      const sampleScheduledMaintenance = [
        {
          _id: 'MAINT001',
          title: 'Database Optimization',
          description: 'Monthly database optimization and cleanup',
          type: 'Recurring',
          frequency: 'Monthly',
          scheduledDate: '2024-01-20T02:00:00Z',
          estimatedDuration: '2 hours',
          assignedTo: 'admin5',
          assignedToName: 'David DevOps',
          status: 'Scheduled',
          priority: 'Medium',
          category: 'Database',
          lastExecuted: '2023-12-20T02:00:00Z',
          nextExecution: '2024-01-20T02:00:00Z',
          createdAt: '2023-12-15T09:00:00Z',
          updatedAt: '2024-01-15T09:00:00Z'
        }
      ];
      setScheduledMaintenance(sampleScheduledMaintenance);
    } finally {
      setLoading(false);
    }
  }, []);

  const getStateColor = (state) => {
    switch (state) {
      case 'New': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'Closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'Scheduled': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case '1 - Critical': return 'bg-red-100 text-red-800 border-red-200';
      case '2 - High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case '3 - Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case '4 - Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case '1 - Critical': return 'bg-red-100 text-red-800';
      case '2 - High': return 'bg-orange-100 text-orange-800';
      case '3 - Medium': return 'bg-yellow-100 text-yellow-800';
      case '4 - Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filtering is now handled by the API, so we just use the tickets directly
  const filteredTickets = tickets;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStateChange = async (ticketId, newState) => {
    try {
      await adminApi.updateIncident(ticketId, { state: newState });
      // Refresh the incidents list
      await fetchIncidents();
    } catch (error) {
      console.error('Error updating incident state:', error);
    }
  };

  const handleAssignTicket = async (ticketId, assigneeId) => {
    try {
      const assignee = adminUsers.find(admin => admin._id === assigneeId);
      await adminApi.updateIncident(ticketId, { 
        assignedTo: assigneeId === 'unassigned' ? null : assigneeId,
        assignedToName: assignee ? assignee.name : 'Unassigned'
      });
      // Refresh the incidents list
      await fetchIncidents();
    } catch (error) {
      console.error('Error assigning ticket:', error);
    }
  };

  const addWorkNote = async (ticketId, content, isPublic = true) => {
    try {
      await adminApi.addWorkNote(ticketId, { content, isPublic });
      // Refresh the incidents list
      await fetchIncidents();
    } catch (error) {
      console.error('Error adding work note:', error);
    }
  };

  // Incident creation functions
  const handleIncidentFormChange = (field, value) => {
    setIncidentForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (incidentFormErrors[field]) {
      setIncidentFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateIncidentForm = () => {
    const errors = {};
    
    if (!incidentForm.shortDescription.trim()) {
      errors.shortDescription = 'Short description is required';
    }
    
    if (!incidentForm.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!incidentForm.category) {
      errors.category = 'Category is required';
    }
    
    if (!incidentForm.subcategory) {
      errors.subcategory = 'Subcategory is required';
    }
    
    if (!incidentForm.caller.trim()) {
      errors.caller = 'Caller name is required';
    }
    
    if (!incidentForm.callerEmail.trim()) {
      errors.callerEmail = 'Caller email is required';
    } else if (!/\S+@\S+\.\S+/.test(incidentForm.callerEmail)) {
      errors.callerEmail = 'Please enter a valid email address';
    }
    
    if (!incidentForm.assignmentGroup.trim()) {
      errors.assignmentGroup = 'Assignment group is required';
    }
    
    setIncidentFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    
    if (!validateIncidentForm()) {
      return;
    }
    
    setIsSubmittingIncident(true);
    
    try {
      const incidentData = {
        ...incidentForm,
        state: 'New',
        openedBy: 'current-admin', // This would be the current admin's ID
        openedByName: 'Current Admin', // This would be the current admin's name
        openedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        slaDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      };
      
      // Here you would call the API to create the incident
      // await adminApi.createIncident(incidentData);
      
      // For now, we'll just add it to the local state
      const newIncident = {
        _id: `INC${Date.now()}`,
        number: `INC${Date.now()}`,
        ...incidentData,
        assignedToName: incidentData.assignedTo ? 
          adminUsers.find(admin => admin._id === incidentData.assignedTo)?.name || 'Unassigned' : 
          'Unassigned',
        workNotes: [],
        resolutionNotes: '',
        isEscalated: false
      };
      
      setTickets(prev => [newIncident, ...prev]);
      
      // Reset form
      setIncidentForm({
        shortDescription: '',
        description: '',
        priority: '3 - Medium',
        urgency: '3 - Medium',
        impact: '3 - Medium',
        category: '',
        subcategory: '',
        caller: '',
        callerEmail: '',
        assignedTo: '',
        assignmentGroup: ''
      });
      
      setShowCreateTicket(false);
      
      // Show success message (you could add a toast notification here)
      console.log('Incident created successfully');
      
    } catch (error) {
      console.error('Error creating incident:', error);
      // Show error message (you could add a toast notification here)
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const resetIncidentForm = () => {
    setIncidentForm({
      shortDescription: '',
      description: '',
      priority: '3 - Medium',
      urgency: '3 - Medium',
      impact: '3 - Medium',
      category: '',
      subcategory: '',
      caller: '',
      callerEmail: '',
      assignedTo: '',
      assignmentGroup: ''
    });
    setIncidentFormErrors({});
  };

  // Change request creation functions
  const handleChangeFormChange = (field, value) => {
    setChangeForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (changeFormErrors[field]) {
      setChangeFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateChangeForm = () => {
    const errors = {};
    
    if (!changeForm.shortDescription.trim()) {
      errors.shortDescription = 'Short description is required';
    }
    
    if (!changeForm.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!changeForm.category) {
      errors.category = 'Category is required';
    }
    
    if (!changeForm.subcategory) {
      errors.subcategory = 'Subcategory is required';
    }
    
    if (!changeForm.requestedBy.trim()) {
      errors.requestedBy = 'Requested by name is required';
    }
    
    if (!changeForm.requestedByEmail.trim()) {
      errors.requestedByEmail = 'Requested by email is required';
    } else if (!/\S+@\S+\.\S+/.test(changeForm.requestedByEmail)) {
      errors.requestedByEmail = 'Please enter a valid email address';
    }
    
    if (!changeForm.assignmentGroup.trim()) {
      errors.assignmentGroup = 'Assignment group is required';
    }
    
    if (!changeForm.scheduledStart) {
      errors.scheduledStart = 'Scheduled start time is required';
    }
    
    if (!changeForm.scheduledEnd) {
      errors.scheduledEnd = 'Scheduled end time is required';
    }
    
    if (changeForm.scheduledStart && changeForm.scheduledEnd) {
      const startDate = new Date(changeForm.scheduledStart);
      const endDate = new Date(changeForm.scheduledEnd);
      if (endDate <= startDate) {
        errors.scheduledEnd = 'End time must be after start time';
      }
    }
    
    if (!changeForm.businessJustification.trim()) {
      errors.businessJustification = 'Business justification is required';
    }
    
    if (!changeForm.implementationPlan.trim()) {
      errors.implementationPlan = 'Implementation plan is required';
    }
    
    if (!changeForm.rollbackPlan.trim()) {
      errors.rollbackPlan = 'Rollback plan is required';
    }
    
    setChangeFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateChange = async (e) => {
    e.preventDefault();
    
    if (!validateChangeForm()) {
      return;
    }
    
    setIsSubmittingChange(true);
    
    try {
      const changeData = {
        ...changeForm,
        state: 'New',
        requestedBy: 'current-admin', // This would be the current admin's ID
        requestedByName: 'Current Admin', // This would be the current admin's name
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvalStatus: 'Pending'
      };
      
      // Here you would call the API to create the change request
      // await adminApi.createChangeRequest(changeData);
      
      // For now, we'll just add it to the local state
      const newChange = {
        _id: `CHG${Date.now()}`,
        number: `CHG${Date.now()}`,
        ...changeData,
        assignedToName: changeData.assignedTo ? 
          adminUsers.find(admin => admin._id === changeData.assignedTo)?.name || 'Unassigned' : 
          'Unassigned',
        requestedByName: changeData.requestedBy ? 
          adminUsers.find(admin => admin._id === changeData.requestedBy)?.name || 'Current Admin' : 
          'Current Admin'
      };
      
      setMaintenanceTasks(prev => [newChange, ...prev]);
      
      // Reset form
      setChangeForm({
        shortDescription: '',
        description: '',
        priority: '3 - Medium',
        category: '',
        subcategory: '',
        requestedBy: '',
        requestedByEmail: '',
        assignedTo: '',
        assignmentGroup: '',
        scheduledStart: '',
        scheduledEnd: '',
        estimatedDuration: '2 hours',
        businessJustification: '',
        riskAssessment: 'Low',
        implementationPlan: '',
        rollbackPlan: '',
        testingPlan: '',
        communicationPlan: ''
      });
      
      setShowCreateMaintenance(false);
      
      // Show success message (you could add a toast notification here)
      console.log('Change request created successfully');
      
    } catch (error) {
      console.error('Error creating change request:', error);
      // Show error message (you could add a toast notification here)
    } finally {
      setIsSubmittingChange(false);
    }
  };

  // Maintenance creation functions
  const handleMaintenanceFormChange = (field, value) => {
    setMaintenanceForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (maintenanceFormErrors[field]) {
      setMaintenanceFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateMaintenanceForm = () => {
    const errors = {};
    
    if (!maintenanceForm.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!maintenanceForm.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!maintenanceForm.category) {
      errors.category = 'Category is required';
    }
    
    if (!maintenanceForm.assignmentGroup) {
      errors.assignmentGroup = 'Assignment group is required';
    }
    
    if (!maintenanceForm.scheduledDate) {
      errors.scheduledDate = 'Scheduled date is required';
    }
    
    if (!maintenanceForm.scheduledStartTime) {
      errors.scheduledStartTime = 'Start time is required';
    }
    
    if (!maintenanceForm.scheduledEndTime) {
      errors.scheduledEndTime = 'End time is required';
    }
    
    if (!maintenanceForm.estimatedDuration) {
      errors.estimatedDuration = 'Estimated duration is required';
    }
    
    // Validate date and time logic
    if (maintenanceForm.scheduledDate && maintenanceForm.scheduledStartTime && maintenanceForm.scheduledEndTime) {
      const startDateTime = new Date(`${maintenanceForm.scheduledDate}T${maintenanceForm.scheduledStartTime}`);
      const endDateTime = new Date(`${maintenanceForm.scheduledDate}T${maintenanceForm.scheduledEndTime}`);
      
      if (endDateTime <= startDateTime) {
        errors.scheduledEndTime = 'End time must be after start time';
      }
    }
    
    setMaintenanceFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    
    if (!validateMaintenanceForm()) {
      return;
    }
    
    setIsSubmittingMaintenance(true);
    
    try {
      const maintenanceData = {
        title: maintenanceForm.title,
        description: maintenanceForm.description,
        type: maintenanceForm.type,
        priority: maintenanceForm.priority,
        category: maintenanceForm.category,
        assignedTo: maintenanceForm.assignedTo || undefined,
        assignmentGroup: maintenanceForm.assignmentGroup,
        scheduledDate: maintenanceForm.scheduledDate,
        scheduledStartTime: maintenanceForm.scheduledStartTime,
        scheduledEndTime: maintenanceForm.scheduledEndTime,
        estimatedDuration: maintenanceForm.estimatedDuration,
        isRecurring: maintenanceForm.isRecurring,
        recurrencePattern: maintenanceForm.recurrencePattern,
        recurrenceInterval: maintenanceForm.recurrenceInterval,
        businessService: maintenanceForm.businessService,
        configurationItems: maintenanceForm.configurationItems,
        dependencies: maintenanceForm.dependencies,
        prerequisites: maintenanceForm.prerequisites,
        rollbackPlan: maintenanceForm.rollbackPlan,
        impactLevel: maintenanceForm.impactLevel,
        riskLevel: maintenanceForm.riskLevel,
        affectedSystems: maintenanceForm.affectedSystems,
        communicationPlan: maintenanceForm.communicationPlan,
        stakeholders: maintenanceForm.stakeholders,
        tags: maintenanceForm.tags
      };
      
      // Call the API to create the maintenance task
      await adminApi.createMaintenanceTask(maintenanceData);
      
      // Reset form
      setMaintenanceForm({
        title: '',
        description: '',
        type: 'Scheduled',
        priority: '3 - Medium',
        category: '',
        assignedTo: '',
        assignmentGroup: '',
        scheduledDate: '',
        scheduledStartTime: '',
        scheduledEndTime: '',
        estimatedDuration: '',
        isRecurring: false,
        recurrencePattern: 'Monthly',
        recurrenceInterval: 1,
        businessService: '',
        configurationItems: [],
        dependencies: [],
        prerequisites: '',
        rollbackPlan: '',
        impactLevel: 'Medium',
        riskLevel: 'Medium',
        affectedSystems: [],
        communicationPlan: '',
        stakeholders: [],
        tags: []
      });
      
      setShowCreateScheduledMaintenance(false);
      
      // Refresh maintenance tasks
      await fetchScheduledMaintenance();
      
      // Show success message
      console.log('Maintenance task created successfully');
      
    } catch (error) {
      console.error('Error creating maintenance task:', error);
      // Show error message
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  const resetMaintenanceForm = () => {
    setMaintenanceForm({
      title: '',
      description: '',
      type: 'Scheduled',
      priority: '3 - Medium',
      category: '',
      assignedTo: '',
      assignmentGroup: '',
      scheduledDate: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
      estimatedDuration: '',
      isRecurring: false,
      recurrencePattern: 'Monthly',
      recurrenceInterval: 1,
      businessService: '',
      configurationItems: [],
      dependencies: [],
      prerequisites: '',
      rollbackPlan: '',
      impactLevel: 'Medium',
      riskLevel: 'Medium',
      affectedSystems: [],
      communicationPlan: '',
      stakeholders: [],
      tags: []
    });
    setMaintenanceFormErrors({});
  };

  const resetChangeForm = () => {
    setChangeForm({
      shortDescription: '',
      description: '',
      priority: '3 - Medium',
      category: '',
      subcategory: '',
      requestedBy: '',
      requestedByEmail: '',
      assignedTo: '',
      assignmentGroup: '',
      scheduledStart: '',
      scheduledEnd: '',
      estimatedDuration: '2 hours',
      businessJustification: '',
      riskAssessment: 'Low',
      implementationPlan: '',
      rollbackPlan: '',
      testingPlan: '',
      communicationPlan: ''
    });
    setChangeFormErrors({});
  };

  const IncidentCard = ({ ticket }) => (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{ticket.shortDescription}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStateColor(ticket.state)}`}>
                {ticket.state}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
              {ticket.isEscalated && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                  ESCALATED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">{ticket.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>#{ticket.number}</span>
              <span>•</span>
              <span>Caller: {ticket.caller}</span>
              <span>•</span>
              <span>Category: {ticket.category} / {ticket.subcategory}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <p>Opened: {formatDate(ticket.openedAt)}</p>
            <p>Assigned to: {ticket.assignedToName}</p>
            <p>Assignment Group: {ticket.assignmentGroup}</p>
            {ticket.slaDue && (
              <p className={new Date(ticket.slaDue) < new Date() ? 'text-red-600 font-medium' : ''}>
                SLA Due: {formatDate(ticket.slaDue)}
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedTicket(ticket)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              View Details
            </button>
            {ticket.state === 'New' && (
              <button
                onClick={() => handleStateChange(ticket._id, 'In Progress')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Start Work
              </button>
            )}
            {ticket.state === 'In Progress' && (
              <button
                onClick={() => handleStateChange(ticket._id, 'Resolved')}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const IncidentDetailsModal = ({ ticket, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Incident Details - {ticket.number}</h2>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{ticket.description}</p>
                </div>
              </div>

              {/* Work Notes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Work Notes</h3>
                <div className="space-y-4">
                  {ticket.workNotes && ticket.workNotes.map((note, index) => (
                    <div key={note.id || `note-${index}`} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{note.author}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{formatDate(note.timestamp)}</span>
                          {note.isPublic ? (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Public</span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Private</span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution Notes */}
              {ticket.resolutionNotes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Resolution Notes</h3>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-gray-700">{ticket.resolutionNotes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">State</label>
                    <p className="text-gray-900">{ticket.state}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Priority</label>
                    <p className="text-gray-900">{ticket.priority}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Urgency</label>
                    <p className="text-gray-900">{ticket.urgency}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Impact</label>
                    <p className="text-gray-900">{ticket.impact}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <p className="text-gray-900">{ticket.category} / {ticket.subcategory}</p>
                  </div>
                </div>
              </div>

              {/* Assignment */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Assignment</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Assigned To</label>
                    <select
                      value={ticket.assignedTo || ''}
                      onChange={(e) => handleAssignTicket(ticket._id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {adminUsers.map(admin => (
                        <option key={admin._id} value={admin._id}>{admin.name} ({admin.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Assignment Group</label>
                    <p className="text-gray-900">{ticket.assignmentGroup}</p>
                  </div>
                </div>
              </div>

              {/* Caller Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Caller Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Caller</label>
                    <p className="text-gray-900">{ticket.caller}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{ticket.callerEmail}</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Opened</label>
                    <p className="text-gray-900">{formatDate(ticket.openedAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="text-gray-900">{formatDate(ticket.updatedAt)}</p>
                  </div>
                  {ticket.resolvedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Resolved</label>
                      <p className="text-gray-900">{formatDate(ticket.resolvedAt)}</p>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Closed</label>
                      <p className="text-gray-900">{formatDate(ticket.closedAt)}</p>
                    </div>
                  )}
                  {ticket.slaDue && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">SLA Due</label>
                      <p className={`text-gray-900 ${new Date(ticket.slaDue) < new Date() ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(ticket.slaDue)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ServiceNow-style Header */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Service Management</h1>
              <p className="text-gray-600">Incident and Change Management System</p>
              
              {/* Debug button - remove in production */}
              <div className="mt-2">
                <button
                  onClick={() => {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminData');
                    console.log('🧹 Cleared admin token for testing');
                    window.location.reload();
                  }}
                  className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                >
                  Clear Admin Token (Debug)
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateTicket(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>New Incident</span>
              </button>
              <button
                onClick={() => setShowCreateMaintenance(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>New Change</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('incidents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'incidents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Incidents</span>
              {PinButton && <PinButton tabId="incidents" tabName="Incidents" module="Technical Support" />}
            </button>
            <button
              onClick={() => setActiveTab('changes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'changes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Changes</span>
              {PinButton && <PinButton tabId="changes" tabName="Changes" module="Technical Support" />}
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'maintenance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Maintenance Scheduler</span>
              {PinButton && <PinButton tabId="maintenance" tabName="Maintenance Scheduler" module="Technical Support" />}
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Dashboard</span>
              {PinButton && <PinButton tabId="dashboard" tabName="Dashboard" module="Technical Support" />}
            </button>
          </nav>
        </div>
      </div>

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search incidents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All States</option>
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Priorities</option>
                  <option value="1 - Critical">1 - Critical</option>
                  <option value="2 - High">2 - High</option>
                  <option value="3 - Medium">3 - Medium</option>
                  <option value="4 - Low">4 - Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Assignees</option>
                  <option value="">Unassigned</option>
                  {adminUsers.map(admin => (
                    <option key={admin._id} value={admin._id}>{admin.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">New</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {tickets.filter(t => t.state === 'New').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">In Progress</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {tickets.filter(t => t.state === 'In Progress').length}
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
                  <p className="text-sm font-medium text-gray-500">Resolved</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {tickets.filter(t => t.state === 'Resolved').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Escalated</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {tickets.filter(t => t.isEscalated).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Incidents List */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading incidents...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket, index) => (
                <IncidentCard key={ticket._id || ticket.id || `ticket-${index}`} ticket={ticket} />
              ))}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Changes Tab */}
      {activeTab === 'changes' && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search changes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All States</option>
                  <option value="New">New</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Priorities</option>
                  <option value="1 - Critical">1 - Critical</option>
                  <option value="2 - High">2 - High</option>
                  <option value="3 - Medium">3 - Medium</option>
                  <option value="4 - Low">4 - Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Assignees</option>
                  <option value="">Unassigned</option>
                  {adminUsers.map(admin => (
                    <option key={admin._id} value={admin._id}>{admin.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Sort by:
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="ml-2 px-2 py-1 border border-gray-300 rounded"
              >
                <option value="createdAt">Created</option>
                <option value="updatedAt">Updated</option>
                <option value="priority">Priority</option>
                <option value="scheduledStart">Scheduled Start</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="ml-2 px-2 py-1 border border-gray-300 rounded"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>

          {/* Changes List */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading changes...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {maintenanceTasks.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  No change requests found.
                </div>
              ) : (
                maintenanceTasks.map((chg) => (
                  <div key={chg._id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{chg.shortDescription}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              chg.state === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                              chg.state === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                              chg.state === 'Completed' ? 'bg-green-100 text-green-800' :
                              chg.state === 'New' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {chg.state}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              chg.priority === '1 - Critical' ? 'bg-red-100 text-red-800' :
                              chg.priority === '2 - High' ? 'bg-orange-100 text-orange-800' :
                              chg.priority === '3 - Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {chg.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{chg.description}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                            <span>#{chg.number}</span>
                            <span>•</span>
                            <span>Category: {chg.category}{chg.subcategory ? ` / ${chg.subcategory}` : ''}</span>
                            <span>•</span>
                            <span>Assigned to: {chg.assignedToName || 'Unassigned'}</span>
                            <span>•</span>
                            <span>Group: {chg.assignmentGroup || '—'}</span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {chg.scheduledStart && <p>Starts: {formatDate(chg.scheduledStart)}</p>}
                          {chg.scheduledEnd && <p>Ends: {formatDate(chg.scheduledEnd)}</p>}
                          <p>Updated: {formatDate(chg.updatedAt || chg.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedMaintenance(chg)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Maintenance Scheduler Tab */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Header with Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Maintenance Scheduler</h2>
                <p className="text-gray-600">Schedule and manage system maintenance tasks</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setMaintenanceView('calendar')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      maintenanceView === 'calendar'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Calendar
                  </button>
                  <button
                    onClick={() => setMaintenanceView('list')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      maintenanceView === 'list'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List
                  </button>
                </div>
                <button
                  onClick={() => setShowCreateScheduledMaintenance(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Schedule Maintenance</span>
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Scheduled</p>
                    <p className="text-2xl font-semibold text-blue-900">
                      {scheduledMaintenance.filter(m => m.status === 'Scheduled').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Completed</p>
                    <p className="text-2xl font-semibold text-green-900">
                      {scheduledMaintenance.filter(m => m.status === 'Completed').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">In Progress</p>
                    <p className="text-2xl font-semibold text-yellow-900">
                      {scheduledMaintenance.filter(m => m.status === 'In Progress').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Recurring</p>
                    <p className="text-2xl font-semibold text-purple-900">
                      {scheduledMaintenance.filter(m => m.type === 'Recurring').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {maintenanceView === 'calendar' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Maintenance Calendar</h3>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h4 className="text-lg font-medium text-gray-900">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h4>
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Simple Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                    {day}
                  </div>
                ))}
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => {
                  const day = i + 1;
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const dayMaintenance = scheduledMaintenance.filter(m => {
                    const maintenanceDate = new Date(m.scheduledDate);
                    return maintenanceDate.getDate() === day && 
                           maintenanceDate.getMonth() === currentDate.getMonth() && 
                           maintenanceDate.getFullYear() === currentDate.getFullYear();
                  });
                  
                  return (
                    <div key={day} className="p-2 min-h-[80px] border border-gray-200 bg-white">
                      <div className="text-sm font-medium text-gray-900 mb-1">{day}</div>
                      {dayMaintenance.map(maintenance => (
                        <div
                          key={maintenance._id}
                          onClick={() => setSelectedMaintenance(maintenance)}
                          className="text-xs p-1 mb-1 rounded cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: maintenance.priority === 'High' ? '#fef2f2' : 
                                           maintenance.priority === 'Medium' ? '#fefce8' : '#f0f9ff',
                            color: maintenance.priority === 'High' ? '#dc2626' : 
                                   maintenance.priority === 'Medium' ? '#d97706' : '#2563eb',
                            border: `1px solid ${maintenance.priority === 'High' ? '#fecaca' : 
                                                   maintenance.priority === 'Medium' ? '#fed7aa' : '#bfdbfe'}`
                          }}
                        >
                          {maintenance.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {maintenanceView === 'list' && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading maintenance tasks...</span>
                </div>
              ) : scheduledMaintenance.length > 0 ? (
                scheduledMaintenance.map((maintenance) => (
                  <div key={maintenance._id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{maintenance.title}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              maintenance.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                              maintenance.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                              maintenance.status === 'Completed' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {maintenance.status}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              maintenance.priority === '1 - Critical' ? 'bg-red-100 text-red-800' :
                              maintenance.priority === '2 - High' ? 'bg-orange-100 text-orange-800' :
                              maintenance.priority === '3 - Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {maintenance.priority}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              {maintenance.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{maintenance.description}</p>
                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <span>Category: {maintenance.category}</span>
                            <span>•</span>
                            <span>Assigned to: {maintenance.assignedToName || 'Unassigned'}</span>
                            <span>•</span>
                            <span>Duration: {maintenance.estimatedDuration}</span>
                            {maintenance.isRecurring && (
                              <>
                                <span>•</span>
                                <span>Recurring: {maintenance.recurrencePattern}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          <p>Scheduled: {formatDate(maintenance.scheduledDate)}</p>
                          {maintenance.scheduledStartTime && maintenance.scheduledEndTime && (
                            <p>Time: {maintenance.scheduledStartTime} - {maintenance.scheduledEndTime}</p>
                          )}
                          {maintenance.nextScheduledDate && (
                            <p>Next: {formatDate(maintenance.nextScheduledDate)}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSelectedMaintenance(maintenance)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            View Details
                          </button>
                          {maintenance.status === 'Scheduled' && (
                            <button
                              onClick={async () => {
                                try {
                                  await adminApi.updateMaintenanceTask(maintenance._id, { 
                                    status: 'In Progress',
                                    actualStartTime: new Date().toISOString()
                                  });
                                  await fetchScheduledMaintenance();
                                } catch (error) {
                                  console.error('Error starting maintenance:', error);
                                }
                              }}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              Start
                            </button>
                          )}
                          {maintenance.status === 'In Progress' && (
                            <button
                              onClick={async () => {
                                try {
                                  await adminApi.updateMaintenanceTask(maintenance._id, { 
                                    status: 'Completed',
                                    actualEndTime: new Date().toISOString()
                                  });
                                  await fetchScheduledMaintenance();
                                } catch (error) {
                                  console.error('Error completing maintenance:', error);
                                }
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No maintenance tasks found</h3>
                  <p className="text-gray-500">Get started by creating a new maintenance task.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Management Dashboard</h2>
            <p className="text-gray-600">Analytics and metrics will be displayed here.</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedTicket && (
        <IncidentDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {/* Maintenance Details Modal */}
      {selectedMaintenance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Maintenance Details - {selectedMaintenance.title}</h2>
                <button
                  onClick={() => setSelectedMaintenance(null)}
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
                {/* Main Content */}
                <div className="space-y-6">
                  {/* Description */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700">{selectedMaintenance.description}</p>
                    </div>
                  </div>

                  {/* Status and Priority */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Status & Priority</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className={`mt-1 px-3 py-1 text-sm font-medium rounded-full inline-block ${
                          selectedMaintenance.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                          selectedMaintenance.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                          selectedMaintenance.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedMaintenance.status}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Priority</label>
                        <p className={`mt-1 px-3 py-1 text-sm font-medium rounded-full inline-block ${
                          selectedMaintenance.priority === '1 - Critical' ? 'bg-red-100 text-red-800' :
                          selectedMaintenance.priority === '2 - High' ? 'bg-orange-100 text-orange-800' :
                          selectedMaintenance.priority === '3 - Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {selectedMaintenance.priority}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Type</label>
                        <p className="text-gray-900">{selectedMaintenance.type}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Category</label>
                        <p className="text-gray-900">{selectedMaintenance.category}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Recurring</label>
                        <p className="text-gray-900">
                          {selectedMaintenance.isRecurring ? 
                            `${selectedMaintenance.recurrencePattern} (every ${selectedMaintenance.recurrenceInterval} ${selectedMaintenance.recurrencePattern.toLowerCase()})` : 
                            'One-time'
                          }
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Estimated Duration</label>
                        <p className="text-gray-900">{selectedMaintenance.estimatedDuration}</p>
                      </div>
                    </div>
                  </div>

                  {/* Assignment */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Assignment</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Assigned To</label>
                        <p className="text-gray-900">{selectedMaintenance.assignedToName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Schedule</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Scheduled Date</label>
                        <p className="text-gray-900">{formatDate(selectedMaintenance.scheduledDate)}</p>
                      </div>
                      {selectedMaintenance.scheduledStartTime && selectedMaintenance.scheduledEndTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Scheduled Time</label>
                          <p className="text-gray-900">{selectedMaintenance.scheduledStartTime} - {selectedMaintenance.scheduledEndTime}</p>
                        </div>
                      )}
                      {selectedMaintenance.actualStartTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Actual Start</label>
                          <p className="text-gray-900">{formatDate(selectedMaintenance.actualStartTime)}</p>
                        </div>
                      )}
                      {selectedMaintenance.actualEndTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Actual End</label>
                          <p className="text-gray-900">{formatDate(selectedMaintenance.actualEndTime)}</p>
                        </div>
                      )}
                      {selectedMaintenance.nextScheduledDate && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Next Scheduled</label>
                          <p className="text-gray-900">{formatDate(selectedMaintenance.nextScheduledDate)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Maintenance Modal */}
      {showCreateScheduledMaintenance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Schedule New Maintenance</h2>
                <button
                  onClick={() => setShowCreateScheduledMaintenance(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleCreateMaintenance} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={maintenanceForm.title}
                      onChange={(e) => handleMaintenanceFormChange('title', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceFormErrors.title ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter maintenance title"
                    />
                    {maintenanceFormErrors.title && (
                      <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.title}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={maintenanceForm.category}
                      onChange={(e) => handleMaintenanceFormChange('category', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceFormErrors.category ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select category</option>
                      <option value="System">System</option>
                      <option value="Database">Database</option>
                      <option value="Network">Network</option>
                      <option value="Security">Security</option>
                      <option value="Application">Application</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Other">Other</option>
                    </select>
                    {maintenanceFormErrors.category && (
                      <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.category}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={maintenanceForm.description}
                    onChange={(e) => handleMaintenanceFormChange('description', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      maintenanceFormErrors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter maintenance description"
                  />
                  {maintenanceFormErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select 
                      value={maintenanceForm.type}
                      onChange={(e) => handleMaintenanceFormChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Preventive">Preventive</option>
                      <option value="Corrective">Corrective</option>
                      <option value="Upgrade">Upgrade</option>
                      <option value="Security">Security</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select 
                      value={maintenanceForm.priority}
                      onChange={(e) => handleMaintenanceFormChange('priority', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="1 - Critical">1 - Critical</option>
                      <option value="2 - High">2 - High</option>
                      <option value="3 - Medium">3 - Medium</option>
                      <option value="4 - Low">4 - Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                    <select 
                      value={maintenanceForm.assignedTo}
                      onChange={(e) => handleMaintenanceFormChange('assignedTo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {adminUsers.map(admin => (
                        <option key={admin._id} value={admin._id}>{admin.name} ({admin.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assignment Group <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={maintenanceForm.assignmentGroup}
                      onChange={(e) => handleMaintenanceFormChange('assignmentGroup', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceFormErrors.assignmentGroup ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select assignment group</option>
                      <option value="Application Development">Application Development</option>
                      <option value="IT Support">IT Support</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Security">Security</option>
                      <option value="Network">Network</option>
                      <option value="Database">Database</option>
                      <option value="Other">Other</option>
                    </select>
                    {maintenanceFormErrors.assignmentGroup && (
                      <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.assignmentGroup}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration</label>
                    <select 
                      value={maintenanceForm.estimatedDuration}
                      onChange={(e) => handleMaintenanceFormChange('estimatedDuration', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select duration</option>
                      <option value="30 minutes">30 minutes</option>
                      <option value="1 hour">1 hour</option>
                      <option value="2 hours">2 hours</option>
                      <option value="4 hours">4 hours</option>
                      <option value="8 hours">8 hours</option>
                      <option value="1 day">1 day</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scheduled Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={maintenanceForm.scheduledDate}
                      onChange={(e) => handleMaintenanceFormChange('scheduledDate', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceFormErrors.scheduledDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {maintenanceFormErrors.scheduledDate && (
                      <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.scheduledDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={maintenanceForm.scheduledStartTime}
                      onChange={(e) => handleMaintenanceFormChange('scheduledStartTime', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceFormErrors.scheduledStartTime ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {maintenanceFormErrors.scheduledStartTime && (
                      <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.scheduledStartTime}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={maintenanceForm.scheduledEndTime}
                      onChange={(e) => handleMaintenanceFormChange('scheduledEndTime', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maintenanceFormErrors.scheduledEndTime ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {maintenanceFormErrors.scheduledEndTime && (
                      <p className="mt-1 text-sm text-red-600">{maintenanceFormErrors.scheduledEndTime}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateScheduledMaintenance(false);
                      resetMaintenanceForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMaintenance}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSubmittingMaintenance && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    <span>{isSubmittingMaintenance ? 'Creating...' : 'Schedule Maintenance'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Change Request Modal */}
      {showCreateMaintenance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create New Change Request</h2>
                <button
                  onClick={() => {
                    setShowCreateMaintenance(false);
                    resetChangeForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleCreateChange} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Short Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={changeForm.shortDescription}
                      onChange={(e) => handleChangeFormChange('shortDescription', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        changeFormErrors.shortDescription ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Brief description of the change"
                    />
                    {changeFormErrors.shortDescription && (
                      <p className="mt-1 text-sm text-red-600">{changeFormErrors.shortDescription}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={changeForm.description}
                      onChange={(e) => handleChangeFormChange('description', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        changeFormErrors.description ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Detailed description of the change"
                    />
                    {changeFormErrors.description && (
                      <p className="mt-1 text-sm text-red-600">{changeFormErrors.description}</p>
                    )}
                  </div>
                </div>

                {/* Priority and Category */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Priority & Category</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={changeForm.priority}
                        onChange={(e) => handleChangeFormChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1 - Critical">1 - Critical</option>
                        <option value="2 - High">2 - High</option>
                        <option value="3 - Medium">3 - Medium</option>
                        <option value="4 - Low">4 - Low</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={changeForm.category}
                        onChange={(e) => handleChangeFormChange('category', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.category ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select category</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Application">Application</option>
                        <option value="Database">Database</option>
                        <option value="Security">Security</option>
                        <option value="Network">Network</option>
                        <option value="Hardware">Hardware</option>
                        <option value="Process">Process</option>
                        <option value="Configuration">Configuration</option>
                      </select>
                      {changeFormErrors.category && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.category}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subcategory <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={changeForm.subcategory}
                        onChange={(e) => handleChangeFormChange('subcategory', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.subcategory ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select subcategory</option>
                        {changeForm.category === 'Infrastructure' && (
                          <>
                            <option value="Server">Server</option>
                            <option value="Storage">Storage</option>
                            <option value="Power">Power</option>
                            <option value="Cooling">Cooling</option>
                          </>
                        )}
                        {changeForm.category === 'Application' && (
                          <>
                            <option value="Feature Update">Feature Update</option>
                            <option value="Bug Fix">Bug Fix</option>
                            <option value="Performance">Performance</option>
                            <option value="Integration">Integration</option>
                          </>
                        )}
                        {changeForm.category === 'Database' && (
                          <>
                            <option value="Schema Change">Schema Change</option>
                            <option value="Data Migration">Data Migration</option>
                            <option value="Backup">Backup</option>
                            <option value="Performance">Performance</option>
                          </>
                        )}
                        {changeForm.category === 'Security' && (
                          <>
                            <option value="Patch">Patch</option>
                            <option value="Access Control">Access Control</option>
                            <option value="Encryption">Encryption</option>
                            <option value="Monitoring">Monitoring</option>
                          </>
                        )}
                        {changeForm.category === 'Network' && (
                          <>
                            <option value="Configuration">Configuration</option>
                            <option value="Hardware">Hardware</option>
                            <option value="Security">Security</option>
                            <option value="Performance">Performance</option>
                          </>
                        )}
                        {changeForm.category === 'Hardware' && (
                          <>
                            <option value="Replacement">Replacement</option>
                            <option value="Upgrade">Upgrade</option>
                            <option value="Installation">Installation</option>
                            <option value="Maintenance">Maintenance</option>
                          </>
                        )}
                        {changeForm.category === 'Process' && (
                          <>
                            <option value="Workflow">Workflow</option>
                            <option value="Policy">Policy</option>
                            <option value="Procedure">Procedure</option>
                            <option value="Training">Training</option>
                          </>
                        )}
                        {changeForm.category === 'Configuration' && (
                          <>
                            <option value="System Config">System Config</option>
                            <option value="Application Config">Application Config</option>
                            <option value="Network Config">Network Config</option>
                            <option value="Security Config">Security Config</option>
                          </>
                        )}
                      </select>
                      {changeFormErrors.subcategory && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.subcategory}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Requestor Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Requestor Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Requested By <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={changeForm.requestedBy}
                        onChange={(e) => handleChangeFormChange('requestedBy', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.requestedBy ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter requestor's name"
                      />
                      {changeFormErrors.requestedBy && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.requestedBy}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Requestor Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={changeForm.requestedByEmail}
                        onChange={(e) => handleChangeFormChange('requestedByEmail', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.requestedByEmail ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter requestor's email"
                      />
                      {changeFormErrors.requestedByEmail && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.requestedByEmail}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignment */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Assignment</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                      <select
                        value={changeForm.assignedTo}
                        onChange={(e) => handleChangeFormChange('assignedTo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Unassigned</option>
                        {adminUsers.map(admin => (
                          <option key={admin._id} value={admin._id}>{admin.name} ({admin.role})</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assignment Group <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={changeForm.assignmentGroup}
                        onChange={(e) => handleChangeFormChange('assignmentGroup', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.assignmentGroup ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select assignment group</option>
                        <option value="Change Management">Change Management</option>
                        <option value="Application Development">Application Development</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Database Team">Database Team</option>
                        <option value="Security Team">Security Team</option>
                        <option value="Network Team">Network Team</option>
                        <option value="IT Operations">IT Operations</option>
                      </select>
                      {changeFormErrors.assignmentGroup && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.assignmentGroup}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Scheduled Start <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={changeForm.scheduledStart}
                        onChange={(e) => handleChangeFormChange('scheduledStart', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.scheduledStart ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {changeFormErrors.scheduledStart && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.scheduledStart}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Scheduled End <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={changeForm.scheduledEnd}
                        onChange={(e) => handleChangeFormChange('scheduledEnd', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.scheduledEnd ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {changeFormErrors.scheduledEnd && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.scheduledEnd}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration</label>
                      <select
                        value={changeForm.estimatedDuration}
                        onChange={(e) => handleChangeFormChange('estimatedDuration', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="30 minutes">30 minutes</option>
                        <option value="1 hour">1 hour</option>
                        <option value="2 hours">2 hours</option>
                        <option value="4 hours">4 hours</option>
                        <option value="8 hours">8 hours</option>
                        <option value="1 day">1 day</option>
                        <option value="2 days">2 days</option>
                        <option value="1 week">1 week</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Risk Assessment */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Risk Assessment</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                    <select
                      value={changeForm.riskAssessment}
                      onChange={(e) => handleChangeFormChange('riskAssessment', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Business Justification */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Business Justification</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Justification <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={changeForm.businessJustification}
                      onChange={(e) => handleChangeFormChange('businessJustification', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        changeFormErrors.businessJustification ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Explain the business need and benefits of this change"
                    />
                    {changeFormErrors.businessJustification && (
                      <p className="mt-1 text-sm text-red-600">{changeFormErrors.businessJustification}</p>
                    )}
                  </div>
                </div>

                {/* Implementation Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Implementation Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Implementation Plan <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        value={changeForm.implementationPlan}
                        onChange={(e) => handleChangeFormChange('implementationPlan', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.implementationPlan ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Step-by-step implementation plan"
                      />
                      {changeFormErrors.implementationPlan && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.implementationPlan}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rollback Plan <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        value={changeForm.rollbackPlan}
                        onChange={(e) => handleChangeFormChange('rollbackPlan', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.rollbackPlan ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Plan to rollback if issues occur"
                      />
                      {changeFormErrors.rollbackPlan && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.rollbackPlan}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Testing Plan</label>
                      <textarea
                        rows={3}
                        value={changeForm.testingPlan}
                        onChange={(e) => handleChangeFormChange('testingPlan', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Testing procedures and validation steps"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Communication Plan</label>
                      <textarea
                        rows={3}
                        value={changeForm.communicationPlan}
                        onChange={(e) => handleChangeFormChange('communicationPlan', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="How stakeholders will be notified"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateMaintenance(false);
                      resetChangeForm();
                    }}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingChange}
                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {isSubmittingChange ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Create Change Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create New Incident</h2>
                <button
                  onClick={() => {
                    setShowCreateTicket(false);
                    resetIncidentForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleCreateIncident} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Short Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={incidentForm.shortDescription}
                      onChange={(e) => handleIncidentFormChange('shortDescription', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        incidentFormErrors.shortDescription ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Brief description of the incident"
                    />
                    {incidentFormErrors.shortDescription && (
                      <p className="mt-1 text-sm text-red-600">{incidentFormErrors.shortDescription}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={incidentForm.description}
                      onChange={(e) => handleIncidentFormChange('description', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        incidentFormErrors.description ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Detailed description of the incident"
                    />
                    {incidentFormErrors.description && (
                      <p className="mt-1 text-sm text-red-600">{incidentFormErrors.description}</p>
                    )}
                  </div>
                </div>

                {/* Priority and Impact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Priority & Impact</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={incidentForm.priority}
                        onChange={(e) => handleIncidentFormChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1 - Critical">1 - Critical</option>
                        <option value="2 - High">2 - High</option>
                        <option value="3 - Medium">3 - Medium</option>
                        <option value="4 - Low">4 - Low</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                      <select
                        value={incidentForm.urgency}
                        onChange={(e) => handleIncidentFormChange('urgency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1 - Critical">1 - Critical</option>
                        <option value="2 - High">2 - High</option>
                        <option value="3 - Medium">3 - Medium</option>
                        <option value="4 - Low">4 - Low</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Impact</label>
                      <select
                        value={incidentForm.impact}
                        onChange={(e) => handleIncidentFormChange('impact', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1 - Critical">1 - Critical</option>
                        <option value="2 - High">2 - High</option>
                        <option value="3 - Medium">3 - Medium</option>
                        <option value="4 - Low">4 - Low</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Category and Classification */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Category & Classification</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={incidentForm.category}
                        onChange={(e) => handleIncidentFormChange('category', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          incidentFormErrors.category ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select category</option>
                        <option value="Software">Software</option>
                        <option value="Hardware">Hardware</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Security">Security</option>
                        <option value="Network">Network</option>
                        <option value="Database">Database</option>
                        <option value="User Access">User Access</option>
                        <option value="Performance">Performance</option>
                      </select>
                      {incidentFormErrors.category && (
                        <p className="mt-1 text-sm text-red-600">{incidentFormErrors.category}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subcategory <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={incidentForm.subcategory}
                        onChange={(e) => handleIncidentFormChange('subcategory', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          incidentFormErrors.subcategory ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select subcategory</option>
                        {incidentForm.category === 'Software' && (
                          <>
                            <option value="Application">Application</option>
                            <option value="Operating System">Operating System</option>
                            <option value="Browser">Browser</option>
                            <option value="Mobile App">Mobile App</option>
                          </>
                        )}
                        {incidentForm.category === 'Hardware' && (
                          <>
                            <option value="Server">Server</option>
                            <option value="Workstation">Workstation</option>
                            <option value="Network Device">Network Device</option>
                            <option value="Printer">Printer</option>
                          </>
                        )}
                        {incidentForm.category === 'Infrastructure' && (
                          <>
                            <option value="Server Room">Server Room</option>
                            <option value="Power">Power</option>
                            <option value="Cooling">Cooling</option>
                            <option value="Physical Security">Physical Security</option>
                          </>
                        )}
                        {incidentForm.category === 'Security' && (
                          <>
                            <option value="Authentication">Authentication</option>
                            <option value="Authorization">Authorization</option>
                            <option value="Malware">Malware</option>
                            <option value="Data Breach">Data Breach</option>
                          </>
                        )}
                        {incidentForm.category === 'Network' && (
                          <>
                            <option value="Internet">Internet</option>
                            <option value="LAN">LAN</option>
                            <option value="WAN">WAN</option>
                            <option value="VPN">VPN</option>
                          </>
                        )}
                        {incidentForm.category === 'Database' && (
                          <>
                            <option value="Performance">Performance</option>
                            <option value="Connection">Connection</option>
                            <option value="Backup">Backup</option>
                            <option value="Corruption">Corruption</option>
                          </>
                        )}
                        {incidentForm.category === 'User Access' && (
                          <>
                            <option value="Login Issues">Login Issues</option>
                            <option value="Password Reset">Password Reset</option>
                            <option value="Account Locked">Account Locked</option>
                            <option value="Permissions">Permissions</option>
                          </>
                        )}
                        {incidentForm.category === 'Performance' && (
                          <>
                            <option value="Slow Response">Slow Response</option>
                            <option value="Timeout">Timeout</option>
                            <option value="Memory Issues">Memory Issues</option>
                            <option value="CPU Issues">CPU Issues</option>
                          </>
                        )}
                      </select>
                      {incidentFormErrors.subcategory && (
                        <p className="mt-1 text-sm text-red-600">{incidentFormErrors.subcategory}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Caller Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Caller Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Caller Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={incidentForm.caller}
                        onChange={(e) => handleIncidentFormChange('caller', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          incidentFormErrors.caller ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter caller's name"
                      />
                      {incidentFormErrors.caller && (
                        <p className="mt-1 text-sm text-red-600">{incidentFormErrors.caller}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Caller Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={incidentForm.callerEmail}
                        onChange={(e) => handleIncidentFormChange('callerEmail', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          incidentFormErrors.callerEmail ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter caller's email"
                      />
                      {incidentFormErrors.callerEmail && (
                        <p className="mt-1 text-sm text-red-600">{incidentFormErrors.callerEmail}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignment */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Assignment</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                      <select
                        value={incidentForm.assignedTo}
                        onChange={(e) => handleIncidentFormChange('assignedTo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Unassigned</option>
                        {adminUsers.map(admin => (
                          <option key={admin._id} value={admin._id}>{admin.name} ({admin.role})</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assignment Group <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={incidentForm.assignmentGroup}
                        onChange={(e) => handleIncidentFormChange('assignmentGroup', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          incidentFormErrors.assignmentGroup ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select assignment group</option>
                        <option value="IT Support">IT Support</option>
                        <option value="Application Development">Application Development</option>
                        <option value="Database Team">Database Team</option>
                        <option value="Security Team">Security Team</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Network Team">Network Team</option>
                        <option value="Help Desk">Help Desk</option>
                      </select>
                      {incidentFormErrors.assignmentGroup && (
                        <p className="mt-1 text-sm text-red-600">{incidentFormErrors.assignmentGroup}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTicket(false);
                      resetIncidentForm();
                    }}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingIncident}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {isSubmittingIncident ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Create Incident</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalSupport;