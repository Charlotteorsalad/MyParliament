import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { adminApi } from '../../api';
import { DatePickerField } from '../../components/ui';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';

const TECH_SUPPORT_ACTIVE_TAB_KEY = 'technicalSupport.activeTab';
const TECH_SUPPORT_MAINTENANCE_VIEW_KEY = 'technicalSupport.maintenanceView';

const TechnicalSupport = ({ togglePin, isPinned, PinButton }) => {
  const { admin: currentAdmin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'incidents';

    const savedTab = window.localStorage.getItem(TECH_SUPPORT_ACTIVE_TAB_KEY);
    return ['incidents', 'changes', 'maintenance'].includes(savedTab) ? savedTab : 'incidents';
  });

  const [tickets, setTickets] = useState([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateMaintenance, setShowCreateMaintenance] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef(null);
  const [viewMode, setViewMode] = useState('list');
  const [incidentStatusTab, setIncidentStatusTab] = useState('New');
  const [changeStatusTab, setChangeStatusTab] = useState('New');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState('');
  
  // Maintenance Scheduler states
  const [scheduledMaintenance, setScheduledMaintenance] = useState([]);
  const [showCreateScheduledMaintenance, setShowCreateScheduledMaintenance] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [maintenanceView, setMaintenanceView] = useState(() => {
    if (typeof window === 'undefined') return 'calendar';

    const savedView = window.localStorage.getItem(TECH_SUPPORT_MAINTENANCE_VIEW_KEY);
    return ['calendar', 'list'].includes(savedView) ? savedView : 'calendar';
  }); // 'calendar' or 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [maintenanceNow, setMaintenanceNow] = useState(Date.now());
  const [maintenanceListStatusFilter, setMaintenanceListStatusFilter] = useState('Scheduled');
  const [maintenanceListCategoryFilter, setMaintenanceListCategoryFilter] = useState('all');
  const [maintenanceListPriorityFilter, setMaintenanceListPriorityFilter] = useState('all');
  const [maintenanceListPage, setMaintenanceListPage] = useState(1);
  const [maintenanceGoToPageInput, setMaintenanceGoToPageInput] = useState('');
  
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
    assignedTo: ''
  });
  const [incidentFormErrors, setIncidentFormErrors] = useState({});
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const [incidentSubmitError, setIncidentSubmitError] = useState('');
  const [incidentActionModal, setIncidentActionModal] = useState(null);
  const [incidentActionComment, setIncidentActionComment] = useState('');
  const [incidentActionAssignee, setIncidentActionAssignee] = useState('');
  const [incidentActionError, setIncidentActionError] = useState('');
  const [isSubmittingIncidentAction, setIsSubmittingIncidentAction] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [shakeMaintenanceForm, setShakeMaintenanceForm] = useState(false);
  const [shakeIncidentForm, setShakeIncidentForm] = useState(false);
  const [shakeChangeForm, setShakeChangeForm] = useState(false);
  
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
    scheduledStart: '',
    scheduledEnd: '',
    estimatedDuration: '',
    businessJustification: '',
    riskAssessment: '',
    implementationPlan: '',
    rollbackPlan: '',
    testingPlan: '',
    communicationPlan: ''
  });
  const [changeFormErrors, setChangeFormErrors] = useState({});
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);
  const [changeSubmitError, setChangeSubmitError] = useState('');
  const [editingChange, setEditingChange] = useState(null);

  const formatEstimatedDuration = (scheduledStart, scheduledEnd) => {
    if (!scheduledStart || !scheduledEnd) return '';

    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return '';
    }

    const totalMinutes = Math.round((endDate - startDate) / (1000 * 60));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

    return parts.join(' ') || '0 minutes';
  };

  const formatDateTimeForInput = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDateForInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Compute before/after diff for edit log — compares original DB object vs current form state.
  // Only fields that actually changed are included.
  const computeIncidentEditChanges = (original, form) => {
    const changes = [];
    const text = (field, label, orig, curr) => {
      const o = String(orig || '').trim();
      const n = String(curr || '').trim();
      if (o !== n) changes.push({ field, label, from: o || '(empty)', to: n || '(empty)' });
    };
    text('shortDescription', 'Short Description', original.shortDescription, form.shortDescription);
    text('description', 'Description', original.description, form.description);
    text('priority', 'Priority', original.priority, form.priority);
    text('urgency', 'Urgency', original.urgency, form.urgency);
    text('impact', 'Impact', original.impact, form.impact);
    text('category', 'Category', original.category, form.category);
    text('subcategory', 'Subcategory', original.subcategory, form.subcategory);
    text('caller', 'Caller Name', original.caller, form.caller);
    text('callerEmail', 'Caller Email', original.callerEmail, form.callerEmail);
    // Assignee: compare IDs, display names
    const origId = typeof original.assignedTo === 'object' ? String(original.assignedTo?._id || '') : String(original.assignedTo || '');
    const newId = form.assignedTo || '';
    if (origId !== newId) {
      const origName = original.assignedToName || 'Unassigned';
      const newAdmin = adminUsers.find(a => String(a._id) === newId);
      const newName = newId ? (newAdmin?.username || newAdmin?.name || 'Unknown') : 'Unassigned';
      changes.push({ field: 'assignedTo', label: 'Assigned To', from: origName, to: newName });
    }
    return changes;
  };

  const computeCREditChanges = (original, form) => {
    const changes = [];
    const text = (field, label, orig, curr) => {
      const o = String(orig || '').trim();
      const n = String(curr || '').trim();
      if (o !== n) changes.push({ field, label, from: o || '(empty)', to: n || '(empty)' });
    };
    text('shortDescription', 'Short Description', original.shortDescription, form.shortDescription);
    text('description', 'Description', original.description, form.description);
    text('priority', 'Priority', original.priority, form.priority);
    text('category', 'Category', original.category, form.category);
    text('subcategory', 'Subcategory', original.subcategory, form.subcategory);
    text('riskAssessment', 'Risk Level', original.riskAssessment, form.riskAssessment);
    text('businessJustification', 'Business Justification', original.businessJustification, form.businessJustification);
    text('implementationPlan', 'Implementation Plan', original.implementationPlan, form.implementationPlan);
    text('rollbackPlan', 'Rollback Plan', original.rollbackPlan, form.rollbackPlan);
    // testingNotes in DB → testingPlan in form
    text('testingNotes', 'Testing Plan', original.testingNotes, form.testingPlan);
    // implementationNotes in DB → communicationPlan in form
    text('implementationNotes', 'Communication Plan', original.implementationNotes, form.communicationPlan);
    // Dates: use the same local-time format used to populate the input
    const origStart = formatDateTimeForInput(original.scheduledStart);
    const origEnd = formatDateTimeForInput(original.scheduledEnd);
    if (origStart !== (form.scheduledStart || '')) {
      changes.push({ field: 'scheduledStart', label: 'Scheduled Start', from: origStart || '(empty)', to: form.scheduledStart || '(empty)' });
    }
    if (origEnd !== (form.scheduledEnd || '')) {
      changes.push({ field: 'scheduledEnd', label: 'Scheduled End', from: origEnd || '(empty)', to: form.scheduledEnd || '(empty)' });
    }
    // Assignee
    const origId = typeof original.assignedTo === 'object' ? String(original.assignedTo?._id || '') : String(original.assignedTo || '');
    const newId = form.assignedTo || '';
    if (origId !== newId) {
      const origName = original.assignedToName || 'Unassigned';
      const newAdmin = adminUsers.find(a => String(a._id) === newId);
      const newName = newId ? (newAdmin?.username || newAdmin?.name || 'Unknown') : 'Unassigned';
      changes.push({ field: 'assignedTo', label: 'Assigned To', from: origName, to: newName });
    }
    return changes;
  };

  const computeMaintenanceEditChanges = (original, form) => {
    const changes = [];
    const text = (field, label, orig, curr) => {
      const o = String(orig || '').trim();
      const n = String(curr || '').trim();
      if (o !== n) changes.push({ field, label, from: o || '(empty)', to: n || '(empty)' });
    };
    text('title', 'Title', original.title, form.title);
    text('description', 'Description', original.description, form.description);
    text('type', 'Type', original.type, form.type);
    text('priority', 'Priority', original.priority, form.priority);
    text('category', 'Category', original.category, form.category);
    text('impactLevel', 'Impact Level', original.impactLevel, form.impactLevel);
    text('riskLevel', 'Risk Level', original.riskLevel, form.riskLevel);
    text('rollbackPlan', 'Rollback Plan', original.rollbackPlan, form.rollbackPlan);
    text('scheduledStartTime', 'Start Time', original.scheduledStartTime, form.scheduledStartTime);
    text('scheduledEndTime', 'End Time', original.scheduledEndTime, form.scheduledEndTime);
    // Date: use same local-time format as openMaintenanceEditModal
    const origDate = formatDateForInput(original.scheduledDate);
    if (origDate !== (form.scheduledDate || '')) {
      changes.push({ field: 'scheduledDate', label: 'Scheduled Date', from: origDate || '(empty)', to: form.scheduledDate || '(empty)' });
    }
    return changes;
  };

  const getNow = () => new Date();

  const getDefaultAssignmentGroup = (category) => {
    switch (category) {
      case 'Infrastructure':
      case 'Hardware':
        return 'Infrastructure';
      case 'Security':
        return 'Security';
      case 'Network':
        return 'Network';
      case 'Application':
      case 'Database':
      case 'Configuration':
      case 'Process':
        return 'Application Development';
      default:
        return 'Other';
    }
  };

  // Maintenance creation states
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    description: '',
    type: 'Scheduled',
    priority: '3 - Medium',
    category: '',
    scheduledDate: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
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
  const [maintenanceSubmitError, setMaintenanceSubmitError] = useState('');
  const [editingMaintenance, setEditingMaintenance] = useState(null);

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
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
    }
  };

  const getApiErrorMessage = (error, fallbackMessage) => {
    const responseData = error?.response?.data;
    return (
      responseData?.message ||
      responseData?.error?.message ||
      error?.message ||
      fallbackMessage
    );
  };

  const getCurrentAdminId = () => currentAdmin?._id || currentAdmin?.id || null;

  const isSameAdminId = (left, right) => {
    if (!left || !right) return false;
    return String(left) === String(right);
  };

  const getOwnerAdminId = (item, kind) => {
    if (!item) return null;

    if (kind === 'incident') {
      return typeof item.openedBy === 'object' ? item.openedBy?._id : item.openedBy;
    }

    if (kind === 'change') {
      return typeof item.requestedBy === 'object' ? item.requestedBy?._id : item.requestedBy;
    }

    return typeof item.createdBy === 'object' ? item.createdBy?._id : item.createdBy;
  };

  const canEditIncident = (ticket) => {
    return ticket?.state === 'New' && isSameAdminId(getOwnerAdminId(ticket, 'incident'), getCurrentAdminId());
  };

  const canEditChangeRequest = (changeRequest) => {
    return ['New', 'Scheduled'].includes(changeRequest?.state) && isSameAdminId(getOwnerAdminId(changeRequest, 'change'), getCurrentAdminId());
  };

  const canEditMaintenanceTask = (maintenance) => {
    return getMaintenanceDisplayStatus(maintenance) === 'Scheduled' && isSameAdminId(getOwnerAdminId(maintenance, 'maintenance'), getCurrentAdminId());
  };

  // Fetch admin users for assignment
  useEffect(() => {
    const fetchAdminUsers = async () => {
      try {
        // Clear any invalid admin tokens first
        clearInvalidAdminToken();
        
        // Check if admin is logged in
        const adminToken = localStorage.getItem('adminToken');
        
        if (!isValidAdminToken(adminToken)) {
          // No valid admin session - do not show fake admin users
          setAdminUsers([]);
          return;
        } else {
          const response = await adminApi.getAdminUsers();
          setAdminUsers(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Error fetching admin users:', error);
        // Fallback: no admin users data instead of sample data
        setAdminUsers([]);
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
      
      if (!isValidAdminToken(adminToken)) {
        // No valid admin session - do not show fake incidents
        setTickets([]);
        setTotalPages(0);
        return;
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

        const response = await adminApi.getAllIncidents(params);
        setTickets(response.data.incidents);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      // Fallback: show no incidents instead of sample data
      setTickets([]);
      setTotalPages(0);
      return;
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
        estimatedDuration: '',
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
      
      if (isValidAdminToken(adminToken)) {
        // Admin token exists, make API call
        const params = {
          page: currentPage,
          limit: 10,
          sortBy,
          sortOrder,
          searchTerm,
          filterPriority,
          filterAssignee
        };

        const response = await adminApi.getAllChangeRequests(params);
        setMaintenanceTasks(response.data.changeRequests);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        // No valid token; do not populate with samples
        setMaintenanceTasks([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error fetching change requests:', error);
      // On error, do not populate with samples
      setMaintenanceTasks([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, searchTerm, filterPriority, filterAssignee]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterAssignee, sortBy, sortOrder]);


  // Load data when component mounts or tab changes
  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    } else if (activeTab === 'changes') {
      fetchChangeRequests();
    } else if (activeTab === 'maintenance') {
      fetchScheduledMaintenance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Reload data when filters change (for incidents and changes tabs)
  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    } else if (activeTab === 'changes') {
      fetchChangeRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortBy, sortOrder, searchTerm, filterStatus, filterPriority, filterAssignee]);

  // Close assignee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isAssigneeDropdownOpen && assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target)) {
        setIsAssigneeDropdownOpen(false);
        setAssigneeSearchTerm('');
      }
    };

    if (isAssigneeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAssigneeDropdownOpen]);

  // Fetch scheduled maintenance data
  const fetchScheduledMaintenance = useCallback(async () => {
    try {
      setLoading(true);
      
      // Clear any invalid admin tokens first
      clearInvalidAdminToken();
      
      // Check if admin is logged in
      const adminToken = localStorage.getItem('adminToken');
      
      if (!isValidAdminToken(adminToken)) {
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
      // Fallback: no scheduled maintenance data instead of sample data
      setScheduledMaintenance([]);
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
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kuala_Lumpur'
    });
  };

  const formatDateOnly = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur'
    });
  };

  const formatTime12Hour = (timeString) => {
    if (!timeString) return '';
    const [hours = '0', minutes = '00'] = timeString.split(':');
    const d = new Date();
    d.setHours(Number(hours), Number(minutes), 0, 0);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const buildMaintenanceWindow = (scheduledDate, startTime, endTime) => {
    if (!scheduledDate) return null;
    const dateOnly = new Date(scheduledDate).toISOString().slice(0, 10);
    const startDt = new Date(`${dateOnly}T${startTime || '00:00'}:00+08:00`);
    let endDt = new Date(`${dateOnly}T${endTime || '23:59'}:00+08:00`);
    if (endDt <= startDt) {
      endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
    }
    return { startDt, endDt };
  };

  const getMaintenanceDisplayStatus = useCallback((maintenance) => {
    if (!maintenance) return 'Scheduled';
    if (maintenance.status === 'Cancelled' || maintenance.status === 'Failed') {
      return maintenance.status;
    }
    if (maintenance.status === 'Completed') {
      return 'Completed';
    }

    const window = buildMaintenanceWindow(
      maintenance.scheduledDate,
      maintenance.scheduledStartTime,
      maintenance.scheduledEndTime
    );

    if (!window) {
      return maintenance.status || 'Scheduled';
    }

    if (maintenanceNow < window.startDt.getTime()) {
      return 'Scheduled';
    }

    if (maintenanceNow <= window.endDt.getTime()) {
      return 'In Progress';
    }

    return 'Completed';
  }, [maintenanceNow]);

  const maintenanceStats = useMemo(() => {
    return scheduledMaintenance.reduce((acc, maintenance) => {
      const status = getMaintenanceDisplayStatus(maintenance);
      if (status === 'Scheduled') acc.scheduled += 1;
      if (status === 'In Progress') acc.inProgress += 1;
      if (status === 'Completed') acc.completed += 1;
      return acc;
    }, { scheduled: 0, inProgress: 0, completed: 0 });
  }, [scheduledMaintenance, getMaintenanceDisplayStatus]);

  const selectedMaintenanceDisplayStatus = selectedMaintenance
    ? getMaintenanceDisplayStatus(selectedMaintenance)
    : null;

  const filteredMaintenanceList = useMemo(() => {
    return scheduledMaintenance.filter((maintenance) => {
      const displayStatus = getMaintenanceDisplayStatus(maintenance);

      if (displayStatus !== maintenanceListStatusFilter) {
        return false;
      }

      if (maintenanceListCategoryFilter !== 'all' && maintenance.category !== maintenanceListCategoryFilter) {
        return false;
      }

      if (maintenanceListPriorityFilter !== 'all' && maintenance.priority !== maintenanceListPriorityFilter) {
        return false;
      }

      return true;
    });
  }, [
    scheduledMaintenance,
    getMaintenanceDisplayStatus,
    maintenanceListStatusFilter,
    maintenanceListCategoryFilter,
    maintenanceListPriorityFilter
  ]);

  const maintenanceListTotalPages = Math.max(1, Math.ceil(filteredMaintenanceList.length / 6));
  const paginatedMaintenanceList = useMemo(() => {
    const startIndex = (maintenanceListPage - 1) * 6;
    return filteredMaintenanceList.slice(startIndex, startIndex + 6);
  }, [filteredMaintenanceList, maintenanceListPage]);

  const maintenanceCategoryOptions = useMemo(() => {
    return [...new Set(scheduledMaintenance.map((maintenance) => maintenance.category).filter(Boolean))].sort();
  }, [scheduledMaintenance]);

  useEffect(() => {
    const intervalId = setInterval(() => setMaintenanceNow(Date.now()), 30_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TECH_SUPPORT_ACTIVE_TAB_KEY, activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TECH_SUPPORT_MAINTENANCE_VIEW_KEY, maintenanceView);
    }
  }, [maintenanceView]);

  useEffect(() => {
    setMaintenanceListPage(1);
  }, [maintenanceListStatusFilter, maintenanceListCategoryFilter, maintenanceListPriorityFilter]);

  useEffect(() => {
    if (maintenanceListPage > maintenanceListTotalPages) {
      setMaintenanceListPage(maintenanceListTotalPages);
    }
  }, [maintenanceListPage, maintenanceListTotalPages]);

  useEffect(() => {
    if (!selectedTicket) return;

    const refreshedTicket = tickets.find(ticket => ticket._id === selectedTicket._id);
    if (refreshedTicket && refreshedTicket !== selectedTicket) {
      setSelectedTicket(refreshedTicket);
    }
  }, [tickets, selectedTicket]);

  useEffect(() => {
    if (!selectedMaintenance) return;

    const source = activeTab === 'changes' ? maintenanceTasks : scheduledMaintenance;
    const refreshedItem = source.find((item) => item._id === selectedMaintenance._id);
    if (refreshedItem && refreshedItem !== selectedMaintenance) {
      setSelectedMaintenance(refreshedItem);
    }
  }, [activeTab, maintenanceTasks, scheduledMaintenance, selectedMaintenance]);

  const getTicketAssignedAdminId = (ticket) => {
    if (!ticket?.assignedTo) return null;
    return typeof ticket.assignedTo === 'object' ? ticket.assignedTo?._id : ticket.assignedTo;
  };

  const canCurrentAdminStartIncident = (ticket) => {
    const assignedAdminId = getTicketAssignedAdminId(ticket);
    if (!currentAdmin || !assignedAdminId) return false;
    // Backend profile returns { id, ... } not { _id, ... }
    const myId = currentAdmin._id || currentAdmin.id;
    return String(assignedAdminId) === String(myId);
  };

  const closeIncidentActionModal = () => {
    setIncidentActionModal(null);
    setIncidentActionComment('');
    setIncidentActionAssignee('');
    setIncidentActionError('');
  };

  const openIncidentActionModal = (type, ticket) => {
    setIncidentActionModal({ type, ticket });
    setIncidentActionComment('');
    setIncidentActionAssignee(getTicketAssignedAdminId(ticket) || '');
    setIncidentActionError('');
  };

  const handleStartWork = async (ticket) => {
    try {
      if (!canCurrentAdminStartIncident(ticket)) {
        return;
      }

      await adminApi.updateIncident(ticket._id, { state: 'In Progress' });
      await fetchIncidents();
    } catch (error) {
      console.error('Error updating incident state:', error);
    }
  };

  const handleIncidentWorkflowAction = async () => {
    if (!incidentActionModal?.ticket) return;

    const { type, ticket } = incidentActionModal;
    if (!canCurrentAdminStartIncident(ticket)) {
      setIncidentActionError('Only the assigned admin can perform this action.');
      return;
    }

    const trimmedComment = incidentActionComment.trim();
    const payload = {};

    if (type === 'reassign') {
      if (!incidentActionAssignee) {
        setIncidentActionError('Please choose the admin to reassign this incident to.');
        return;
      }
      if (String(incidentActionAssignee) === String(getTicketAssignedAdminId(ticket))) {
        setIncidentActionError('Please choose a different admin for reassignment.');
        return;
      }
      if (!trimmedComment) {
        setIncidentActionError('A comment is required for reassignment.');
        return;
      }

      payload.assignedTo = incidentActionAssignee;
      payload.comment = trimmedComment;
    }

    if (type === 'resolve') {
      if (!trimmedComment) {
        setIncidentActionError('A comment is required before resolving this incident.');
        return;
      }

      payload.state = 'Resolved';
      payload.comment = trimmedComment;
      payload.resolutionNotes = trimmedComment;
    }

    try {
      setIsSubmittingIncidentAction(true);
      setIncidentActionError('');
      await adminApi.updateIncident(ticket._id, payload);
      await fetchIncidents();
      closeIncidentActionModal();
    } catch (error) {
      console.error('Error performing incident action:', error);
      console.error('Incident action response:', error?.response?.data);
      setIncidentActionError(getApiErrorMessage(error, 'Failed to update incident.'));
    } finally {
      setIsSubmittingIncidentAction(false);
    }
  };

  const addWorkNote = async (ticketId, content, isPublic = true) => {
    try {
      await adminApi.addWorkNote(ticketId, { content, isPublic });
      // Refresh the incidents list
      await fetchIncidents();
    } catch (error) {
      console.error('Error adding work note:', error);
      console.error('Add work note response:', error?.response?.data);
    }
  };

  // Incident creation functions
  const handleIncidentFormChange = (field, value) => {
    setIncidentForm(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // When category changes, clear subcategory
      if (field === 'category') {
        updated.subcategory = '';
        // Clear subcategory error as well
        if (incidentFormErrors.subcategory) {
          setIncidentFormErrors(prev => ({
            ...prev,
            subcategory: ''
          }));
        }
      }
      
      return updated;
    });
    
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
    
    setIncidentFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    setIncidentSubmitError('');
    
    if (!validateIncidentForm()) {
      setShakeIncidentForm(true);
      setTimeout(() => setShakeIncidentForm(false), 500);
      return;
    }
    
    setIsSubmittingIncident(true);
    
    try {
      if (editingIncident?._id) {
        const editChanges = computeIncidentEditChanges(editingIncident, incidentForm);
        await adminApi.updateIncident(editingIncident._id, { ...incidentForm, editChanges });
      } else {
        await adminApi.createIncident(incidentForm);
      }

      resetIncidentForm();
      setEditingIncident(null);
      setShowCreateTicket(false);
      setIncidentStatusTab('New');

      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        await fetchIncidents();
      }
      
    } catch (error) {
      console.error(`Error ${editingIncident ? 'updating' : 'creating'} incident:`, error);
      console.error('Incident response:', error?.response?.data);
      setIncidentSubmitError(getApiErrorMessage(error, `Failed to ${editingIncident ? 'update' : 'create'} incident. Please try again.`));
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
      assignedTo: ''
    });
    setIncidentFormErrors({});
    setIncidentSubmitError('');
  };

  // Change request creation functions
  const handleChangeFormChange = (field, value) => {
    setChangeForm(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // When category changes, clear subcategory
      if (field === 'category') {
        updated.subcategory = '';
        // Clear subcategory error as well
        if (changeFormErrors.subcategory) {
          setChangeFormErrors(prev => ({
            ...prev,
            subcategory: ''
          }));
        }
      }

      if (field === 'scheduledStart' || field === 'scheduledEnd') {
        const nextStart = field === 'scheduledStart' ? value : updated.scheduledStart;
        const nextEnd = field === 'scheduledEnd' ? value : updated.scheduledEnd;
        updated.estimatedDuration = formatEstimatedDuration(nextStart, nextEnd);
      }
      
      return updated;
    });
    
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
    const now = getNow();
    
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

    if (!changeForm.assignedTo) {
      errors.assignedTo = 'Assigned to is required';
    }

    if (!changeForm.riskAssessment) {
      errors.riskAssessment = 'Risk level is required';
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
      if (startDate < now) {
        errors.scheduledStart = 'Scheduled start time cannot be earlier than the current time';
      }
      if (endDate <= startDate) {
        errors.scheduledEnd = 'End time must be after start time';
      } else if (endDate < now) {
        errors.scheduledEnd = 'Scheduled end time cannot be earlier than the current time';
      }
    } else if (changeForm.scheduledStart) {
      const startDate = new Date(changeForm.scheduledStart);
      if (startDate < now) {
        errors.scheduledStart = 'Scheduled start time cannot be earlier than the current time';
      }
    } else if (changeForm.scheduledEnd) {
      const endDate = new Date(changeForm.scheduledEnd);
      if (endDate < now) {
        errors.scheduledEnd = 'Scheduled end time cannot be earlier than the current time';
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
    setChangeSubmitError('');
    
    if (!validateChangeForm()) {
      setShakeChangeForm(true);
      setTimeout(() => setShakeChangeForm(false), 500);
      return;
    }
    
    setIsSubmittingChange(true);
    
    try {
      const changeData = {
        shortDescription: changeForm.shortDescription,
        description: changeForm.description,
        priority: changeForm.priority,
        category: changeForm.category,
        subcategory: changeForm.subcategory,
        assignmentGroup: getDefaultAssignmentGroup(changeForm.category),
        scheduledStart: changeForm.scheduledStart,
        scheduledEnd: changeForm.scheduledEnd,
        estimatedDuration: changeForm.estimatedDuration,
        businessJustification: changeForm.businessJustification,
        riskAssessment: changeForm.riskAssessment,
        implementationPlan: changeForm.implementationPlan,
        rollbackPlan: changeForm.rollbackPlan,
        businessService: 'MyParliament Platform',
        configurationItems: [],
        dependencies: []
      };

      if (editingChange?._id) {
        const editChanges = computeCREditChanges(editingChange, changeForm);
        await adminApi.updateChangeRequest(editingChange._id, {
          ...changeData,
          assignedTo: changeForm.assignedTo || 'unassigned',
          testingNotes: changeForm.testingPlan,
          implementationNotes: changeForm.communicationPlan,
          editChanges
        });
      } else {
        await adminApi.createChangeRequest(changeData);
      }

      resetChangeForm();
      setEditingChange(null);
      setShowCreateMaintenance(false);

      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        await fetchChangeRequests();
      }
      
    } catch (error) {
      console.error(`Error ${editingChange ? 'updating' : 'creating'} change request:`, error);
      setChangeSubmitError(error?.response?.data?.message || error?.message || `Failed to ${editingChange ? 'update' : 'create'} change request. Please try again.`);
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
    const now = getNow();
    
    if (!maintenanceForm.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!maintenanceForm.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!maintenanceForm.category) {
      errors.category = 'Category is required';
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
    
    // Validate date and time logic
    if (maintenanceForm.scheduledDate && maintenanceForm.scheduledStartTime && maintenanceForm.scheduledEndTime) {
      const startDateTime = new Date(`${maintenanceForm.scheduledDate}T${maintenanceForm.scheduledStartTime}`);
      const endDateTime = new Date(`${maintenanceForm.scheduledDate}T${maintenanceForm.scheduledEndTime}`);

      if (startDateTime < now) {
        errors.scheduledStartTime = 'Scheduled start time cannot be earlier than the current time';
      }
      if (endDateTime <= startDateTime) {
        errors.scheduledEndTime = 'End time must be after start time';
      } else if (endDateTime < now) {
        errors.scheduledEndTime = 'Scheduled end time cannot be earlier than the current time';
      }
    }
    
    setMaintenanceFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    
    if (!validateMaintenanceForm()) {
      setShakeMaintenanceForm(true);
      setTimeout(() => setShakeMaintenanceForm(false), 500);
      return;
    }
    
    setIsSubmittingMaintenance(true);
    setMaintenanceSubmitError('');
    
    try {
      const maintenanceData = {
        title: maintenanceForm.title,
        description: maintenanceForm.description,
        type: maintenanceForm.type,
        priority: maintenanceForm.priority,
        category: maintenanceForm.category,
        scheduledDate: maintenanceForm.scheduledDate,
        scheduledStartTime: maintenanceForm.scheduledStartTime,
        scheduledEndTime: maintenanceForm.scheduledEndTime,
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

      const response = editingMaintenance?._id
        ? await adminApi.updateMaintenanceTask(editingMaintenance._id, {
            ...maintenanceData,
            editChanges: computeMaintenanceEditChanges(editingMaintenance, maintenanceForm)
          })
        : await adminApi.createMaintenanceTask(maintenanceData);
      const createdMaintenance = response?.data;

      // Close immediately on success and reset the form.
      setShowCreateScheduledMaintenance(false);
      resetMaintenanceForm();
      setEditingMaintenance(null);
      setActiveTab('maintenance');

      // Optimistically add the newly created task so it appears instantly.
      if (createdMaintenance && createdMaintenance._id) {
        setScheduledMaintenance((prev) => {
          const next = [createdMaintenance, ...prev.filter((item) => item._id !== createdMaintenance._id)];
          return next.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
        });
      }

      // Then re-fetch to stay in sync with backend-calculated fields.
      fetchScheduledMaintenance();
      
    } catch (error) {
      console.error(`Error ${editingMaintenance ? 'updating' : 'creating'} maintenance task:`, error);
      const msg = error?.response?.data?.message || error?.message || `Failed to ${editingMaintenance ? 'update' : 'create'} maintenance task. Please try again.`;
      setMaintenanceSubmitError(msg);
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
      scheduledDate: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
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
      scheduledStart: '',
      scheduledEnd: '',
      estimatedDuration: '',
      businessJustification: '',
      riskAssessment: '',
      implementationPlan: '',
      rollbackPlan: '',
      testingPlan: '',
      communicationPlan: ''
    });
    setChangeFormErrors({});
  };

  const openIncidentEditModal = (ticket) => {
    if (!canEditIncident(ticket)) return;

    setSelectedTicket(null);
    setEditingIncident(ticket);
    setIncidentForm({
      shortDescription: ticket.shortDescription || '',
      description: ticket.description || '',
      priority: ticket.priority || '3 - Medium',
      urgency: ticket.urgency || '3 - Medium',
      impact: ticket.impact || '3 - Medium',
      category: ticket.category || '',
      subcategory: ticket.subcategory || '',
      caller: ticket.caller || '',
      callerEmail: ticket.callerEmail || '',
      assignedTo: getTicketAssignedAdminId(ticket) || ''
    });
    setIncidentFormErrors({});
    setIncidentSubmitError('');
    setShowCreateTicket(true);
  };

  const openChangeEditModal = (changeRequest) => {
    if (!canEditChangeRequest(changeRequest)) return;

    setSelectedMaintenance(null);
    const requestedByName = changeRequest.requestedByName || changeRequest.requestedBy?.username || changeRequest.requestedBy?.name || '';
    const requestedByEmail = changeRequest.requestedBy?.email || currentAdmin?.email || '';

    setEditingChange(changeRequest);
    setChangeForm({
      shortDescription: changeRequest.shortDescription || '',
      description: changeRequest.description || '',
      priority: changeRequest.priority || '3 - Medium',
      category: changeRequest.category || '',
      subcategory: changeRequest.subcategory || '',
      requestedBy: requestedByName,
      requestedByEmail,
      assignedTo: (typeof changeRequest.assignedTo === 'object' ? changeRequest.assignedTo?._id : changeRequest.assignedTo) || '',
      scheduledStart: formatDateTimeForInput(changeRequest.scheduledStart),
      scheduledEnd: formatDateTimeForInput(changeRequest.scheduledEnd),
      estimatedDuration: changeRequest.estimatedDuration || '',
      businessJustification: changeRequest.businessJustification || '',
      riskAssessment: changeRequest.riskAssessment || 'Low',
      implementationPlan: changeRequest.implementationPlan || '',
      rollbackPlan: changeRequest.rollbackPlan || '',
      testingPlan: changeRequest.testingNotes || '',
      communicationPlan: changeRequest.implementationNotes || ''
    });
    setChangeFormErrors({});
    setChangeSubmitError('');
    setShowCreateMaintenance(true);
  };

  const openMaintenanceEditModal = (maintenance) => {
    if (!canEditMaintenanceTask(maintenance)) return;

    setSelectedMaintenance(null);
    setEditingMaintenance(maintenance);
    setMaintenanceForm({
      title: maintenance.title || '',
      description: maintenance.description || '',
      type: maintenance.type || 'Scheduled',
      priority: maintenance.priority || '3 - Medium',
      category: maintenance.category || '',
      scheduledDate: formatDateForInput(maintenance.scheduledDate),
      scheduledStartTime: maintenance.scheduledStartTime || '',
      scheduledEndTime: maintenance.scheduledEndTime || '',
      isRecurring: Boolean(maintenance.isRecurring),
      recurrencePattern: maintenance.recurrencePattern || 'Monthly',
      recurrenceInterval: maintenance.recurrenceInterval || 1,
      businessService: maintenance.businessService || '',
      configurationItems: maintenance.configurationItems || [],
      dependencies: maintenance.dependencies || [],
      prerequisites: maintenance.prerequisites || '',
      rollbackPlan: maintenance.rollbackPlan || '',
      impactLevel: maintenance.impactLevel || 'Medium',
      riskLevel: maintenance.riskLevel || 'Medium',
      affectedSystems: maintenance.affectedSystems || [],
      communicationPlan: maintenance.communicationPlan || '',
      stakeholders: maintenance.stakeholders || [],
      tags: maintenance.tags || []
    });
    setMaintenanceFormErrors({});
    setMaintenanceSubmitError('');
    setShowCreateScheduledMaintenance(true);
  };

  const IncidentCard = ({ ticket }) => (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex flex-col gap-4 mb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{ticket.shortDescription}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${getStateColor(ticket.state)}`}>
                {ticket.state}
              </span>
              {ticket.editHistory?.length > 0 && (
                <span className="px-2 py-1 text-xs font-medium rounded-full border border-purple-200 bg-purple-50 text-purple-700 whitespace-nowrap">
                  Edited
                </span>
              )}
              <span className={`px-2 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
              {ticket.isEscalated && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                  ESCALATED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2 break-words">{ticket.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>#{ticket.number}</span>
              <span className="hidden sm:inline">•</span>
              <span>Caller: {ticket.caller}</span>
              <span className="hidden sm:inline">•</span>
              <span>Category: {ticket.category} / {ticket.subcategory}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500">
            <p>Opened: {formatDate(ticket.openedAt || ticket.createdAt)}</p>
            <p>Assigned to: {ticket.assignedToName}</p>
            {ticket.slaDue && (
              <p className={new Date(ticket.slaDue) < new Date() ? 'text-red-600 font-medium' : ''}>
                SLA Due: {formatDate(ticket.slaDue)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <button
              onClick={() => setSelectedTicket(ticket)}
              className="text-xs py-0.5 block text-left sm:text-right text-blue-600 hover:text-blue-900"
            >
              View Details
            </button>
            {canEditIncident(ticket) && (
              <button
                onClick={() => openIncidentEditModal(ticket)}
                className="text-xs py-0.5 block text-left sm:text-right text-green-600 hover:text-green-900"
              >
                Edit
              </button>
            )}
            {ticket.state === 'New' && canCurrentAdminStartIncident(ticket) && (
              <button
                onClick={() => handleStartWork(ticket)}
                className="text-xs py-0.5 block text-left sm:text-right text-green-600 hover:text-green-900"
              >
                Start Work
              </button>
            )}
            {(ticket.state === 'New' || ticket.state === 'In Progress') && canCurrentAdminStartIncident(ticket) && (
              <button
                onClick={() => openIncidentActionModal('reassign', ticket)}
                className="text-xs py-0.5 block text-left sm:text-right text-amber-600 hover:text-amber-900"
              >
                Assign to Another Person
              </button>
            )}
            {ticket.state === 'In Progress' && canCurrentAdminStartIncident(ticket) && (
              <button
                onClick={() => openIncidentActionModal('resolve', ticket)}
                className="text-xs py-0.5 block text-left sm:text-right text-gray-600 hover:text-gray-900"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 p-4 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center">
        <div className="bg-white rounded-2xl max-w-6xl w-full mx-auto border border-gray-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-4 sm:px-6 py-4 bg-green-600 rounded-t-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-white break-words">Incident Details - {ticket.number}</h2>
                <p className="text-sm text-green-50 break-words">{ticket.shortDescription}</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white shrink-0 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {canEditIncident(ticket) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => openIncidentEditModal(ticket)}
                    className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Edit Incident
                  </button>
                </div>
              )}

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
                        <span className="text-sm text-gray-500">{formatDate(note.timestamp)}</span>
                      </div>
                      <p className="text-gray-700">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {ticket.editHistory?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Edit Log</h3>
                  <div className="space-y-3">
                    {ticket.editHistory
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <div key={`${entry.editedAt || index}-${index}`} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="font-medium text-gray-900">{entry.editorName}</span>
                            <span className="text-sm text-gray-500">{formatDate(entry.editedAt)}</span>
                          </div>
                          {entry.changes?.length > 0 ? (
                            <ul className="space-y-1 mt-1">
                              {entry.changes.map((change, ci) => (
                                <li key={ci} className="text-sm flex flex-wrap items-baseline gap-x-1">
                                  <span className="font-medium text-gray-700 shrink-0">{change.label}:</span>
                                  <span className="text-gray-400 line-through break-all">{change.from}</span>
                                  <span className="text-gray-400 shrink-0">→</span>
                                  <span className="text-gray-900 break-all">{change.to}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-700 text-sm">{entry.summary}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

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
                    <p className="text-gray-900">{ticket.assignedToName || 'Unassigned'}</p>
                  </div>
                  {canCurrentAdminStartIncident(ticket) ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ticket.state === 'New' && (
                        <button
                          type="button"
                          onClick={() => handleStartWork(ticket)}
                          className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Start Work
                        </button>
                      )}
                      {(ticket.state === 'New' || ticket.state === 'In Progress') && (
                        <button
                          type="button"
                          onClick={() => openIncidentActionModal('reassign', ticket)}
                          className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          Assign to Another Person
                        </button>
                      )}
                      {ticket.state === 'In Progress' && (
                        <button
                          type="button"
                          onClick={() => openIncidentActionModal('resolve', ticket)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Resolve with Comment
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Only the assigned admin can take action on this incident.</p>
                  )}
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
                    <p className="text-gray-900">{formatDate(ticket.openedAt || ticket.createdAt)}</p>
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
    </div>
  );

  const incidentActionModalContent = !incidentActionModal?.ticket
    ? null
    : (() => {
        const { type, ticket } = incidentActionModal;
        const isReassign = type === 'reassign';

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] p-4 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center">
              <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 bg-green-600 rounded-t-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {isReassign ? 'Reassign Incident' : 'Resolve Incident'}
                    </h2>
                    <p className="text-sm text-green-50">{ticket.number} - {ticket.shortDescription}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeIncidentActionModal}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                {isReassign && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reassign To <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={incidentActionAssignee}
                      onChange={(e) => setIncidentActionAssignee(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select admin</option>
                      {adminUsers.map(admin => (
                        <option key={admin._id} value={admin._id}>
                          {admin.username} ({admin.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comment <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={incidentActionComment}
                    onChange={(e) => setIncidentActionComment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    placeholder={isReassign ? 'Explain why this incident is being reassigned' : 'Explain how this incident was resolved'}
                  />
                </div>

                {incidentActionError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {incidentActionError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={closeIncidentActionModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleIncidentWorkflowAction}
                  disabled={isSubmittingIncidentAction}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingIncidentAction
                    ? 'Saving...'
                    : isReassign
                      ? 'Save Reassignment'
                      : 'Resolve Incident'}
                </button>
              </div>
            </div>
            </div>
          </div>
        );
      })();

  return (
    <div className="p-3 sm:p-6 max-w-full overflow-x-hidden space-y-4 sm:space-y-6">
      {/* ServiceNow-style Header */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Service Management</h1>
              <p className="text-sm sm:text-base text-gray-600">Incident and Change Management System</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation - horizontal scroll only, no y-scrollbar */}
        <div className="px-4 sm:px-6 overflow-x-auto overflow-y-hidden -mx-4 sm:mx-0">
          <nav className="flex space-x-4 sm:space-x-8 min-w-0 pb-2 -mb-2" aria-label="Technical support tabs">
            <button
              onClick={() => setActiveTab('incidents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap shrink-0 ${
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
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap shrink-0 ${
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
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap shrink-0 ${
                activeTab === 'maintenance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Maintenance Scheduler</span>
              {PinButton && <PinButton tabId="maintenance" tabName="Maintenance Scheduler" module="Technical Support" />}
            </button>
          </nav>
        </div>
      </div>

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Incident Management</h2>
                <p className="text-sm sm:text-base text-gray-600">Track, triage, and resolve technical incidents</p>
              </div>
              <button
                onClick={() => setShowCreateTicket(true)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create Incident</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mt-4 sm:mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">New</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {tickets.filter(t => t.state === 'New').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">In Progress</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {tickets.filter(t => t.state === 'In Progress').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Resolved</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {tickets.filter(t => t.state === 'Resolved').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Closed</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {tickets.filter(t => t.state === 'Closed').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="relative" ref={assigneeDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white flex items-center justify-between"
                  >
                    <span className="text-gray-900">
                      {filterAssignee === '' ? 'Select...' : 
                       filterAssignee === 'unassigned' ? 'Unassigned' :
                       adminUsers.find(a => a._id === filterAssignee)?.username || 'Select...'}
                    </span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isAssigneeDropdownOpen && (
                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search admins..."
                          value={assigneeSearchTerm}
                          onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterAssignee('unassigned');
                            setIsAssigneeDropdownOpen(false);
                            setAssigneeSearchTerm('');
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${filterAssignee === 'unassigned' ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                        >
                          Unassigned
                        </button>
                        {adminUsers
                          .filter(admin => {
                            const q = (assigneeSearchTerm || '').toLowerCase();
                            if (!q) return true;
                            const name = (admin.username || '').toLowerCase();
                            const email = (admin.email || '').toLowerCase();
                            return name.includes(q) || email.includes(q);
                          })
                          .map(admin => (
                            <button
                              key={admin._id}
                              type="button"
                              onClick={() => {
                                setFilterAssignee(admin._id);
                                setIsAssigneeDropdownOpen(false);
                                setAssigneeSearchTerm('');
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${filterAssignee === admin._id ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                            >
                              {admin.username}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Incoming Incidents Region */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 overflow-visible">
            {/* Status Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto overflow-y-hidden">
              <nav className="flex min-w-max sm:min-w-0 sm:flex">
                {[
                  { id: 'New', label: 'New', count: tickets.filter(t => t.state === 'New').length, color: 'blue' },
                  { id: 'In Progress', label: 'In Progress', count: tickets.filter(t => t.state === 'In Progress').length, color: 'yellow' },
                  { id: 'Resolved', label: 'Resolved', count: tickets.filter(t => t.state === 'Resolved').length, color: 'green' },
                  { id: 'Closed', label: 'Closed', count: tickets.filter(t => t.state === 'Closed').length, color: 'gray' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setIncidentStatusTab(tab.id)}
                    className={`flex-1 min-w-[80px] sm:min-w-0 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all duration-200 shrink-0 ${
                      incidentStatusTab === tab.id
                        ? `bg-white text-${tab.color}-600 border-b-2 border-${tab.color}-500`
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          incidentStatusTab === tab.id 
                            ? `bg-${tab.color}-100 text-${tab.color}-700` 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            {/* Incidents List */}
            <div className="p-4 sm:p-6 overflow-visible">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading incidents...</p>
                  </div>
                </div>
              ) : filteredTickets.filter(ticket => ticket.state === incidentStatusTab).length > 0 ? (
                <div className="space-y-4">
                  {filteredTickets
                    .filter(ticket => ticket.state === incidentStatusTab)
                    .map((ticket, index) => (
                      <IncidentCard key={ticket._id || ticket.id || `ticket-${index}`} ticket={ticket} />
                    ))}
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
                        <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
                      </form>
                      <span className="px-2 sm:px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
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
              ) : (
                <div className="text-center py-12 sm:py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium text-lg mb-2">No {incidentStatusTab} incidents</p>
                  <p className="text-gray-500 text-sm">There are no incidents with status "{incidentStatusTab}" at the moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Changes Tab */}
      {activeTab === 'changes' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Change Requests</h2>
                <p className="text-sm sm:text-base text-gray-600">Plan, review, and monitor system change requests</p>
              </div>
              <button
                onClick={() => setShowCreateMaintenance(true)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create CR</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">New</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceTasks.filter((chg) => chg.state === 'New').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Scheduled</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceTasks.filter((chg) => chg.state === 'Scheduled').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">In Progress</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceTasks.filter((chg) => chg.state === 'In Progress').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Completed</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceTasks.filter((chg) => chg.state === 'Completed').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="relative" ref={assigneeDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white flex items-center justify-between"
                  >
                    <span className="text-gray-900">
                      {filterAssignee === '' ? 'Select...' : 
                       filterAssignee === 'unassigned' ? 'Unassigned' :
                       adminUsers.find(a => a._id === filterAssignee)?.username || 'Select...'}
                    </span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isAssigneeDropdownOpen && (
                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search admins..."
                          value={assigneeSearchTerm}
                          onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterAssignee('unassigned');
                            setIsAssigneeDropdownOpen(false);
                            setAssigneeSearchTerm('');
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${filterAssignee === 'unassigned' ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                        >
                          Unassigned
                        </button>
                        {adminUsers
                          .filter(admin => {
                            const q = (assigneeSearchTerm || '').toLowerCase();
                            if (!q) return true;
                            const name = (admin.username || '').toLowerCase();
                            const email = (admin.email || '').toLowerCase();
                            return name.includes(q) || email.includes(q);
                          })
                          .map(admin => (
                            <button
                              key={admin._id}
                              type="button"
                              onClick={() => {
                                setFilterAssignee(admin._id);
                                setIsAssigneeDropdownOpen(false);
                                setAssigneeSearchTerm('');
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${filterAssignee === admin._id ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                            >
                              {admin.username}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Change Request List */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading changes...</span>
            </div>
          ) : (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 overflow-visible">
              <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto overflow-y-hidden">
                <nav className="flex min-w-max sm:min-w-0 sm:flex">
                  {[
                    { id: 'New', label: 'New', count: maintenanceTasks.filter((chg) => chg.state === 'New').length, activeClass: 'bg-white text-blue-600 border-b-2 border-blue-500', badgeClass: 'bg-blue-100 text-blue-700' },
                    { id: 'In Progress', label: 'In Progress', count: maintenanceTasks.filter((chg) => chg.state === 'In Progress').length, activeClass: 'bg-white text-yellow-600 border-b-2 border-yellow-500', badgeClass: 'bg-yellow-100 text-yellow-700' },
                    { id: 'Completed', label: 'Completed', count: maintenanceTasks.filter((chg) => chg.state === 'Completed').length, activeClass: 'bg-white text-green-600 border-b-2 border-green-500', badgeClass: 'bg-green-100 text-green-700' },
                    { id: 'Cancelled', label: 'Cancelled', count: maintenanceTasks.filter((chg) => chg.state === 'Cancelled').length, activeClass: 'bg-white text-gray-600 border-b-2 border-gray-500', badgeClass: 'bg-gray-200 text-gray-700' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChangeStatusTab(tab.id)}
                      className={`flex-1 min-w-[96px] sm:min-w-0 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all duration-200 shrink-0 ${
                        changeStatusTab === tab.id
                          ? tab.activeClass
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            changeStatusTab === tab.id ? tab.badgeClass : 'bg-gray-200 text-gray-600'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-4 sm:p-6 overflow-visible">
                {maintenanceTasks.filter((chg) => chg.state === changeStatusTab).length > 0 ? (
                  <div className="space-y-4">
                    {maintenanceTasks
                      .filter((chg) => chg.state === changeStatusTab)
                      .map((chg) => (
                        <div key={chg._id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 sm:space-x-3 mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900">{chg.shortDescription}</h3>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    chg.state === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                                    chg.state === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                    chg.state === 'Completed' ? 'bg-green-100 text-green-800' :
                                    chg.state === 'Failed' ? 'bg-red-100 text-red-800' :
                                    chg.state === 'Cancelled' ? 'bg-gray-200 text-gray-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {chg.state}
                                  </span>
                                  {chg.editHistory?.length > 0 && (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full border border-purple-200 bg-purple-50 text-purple-700">
                                      Edited
                                    </span>
                                  )}
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
                                  <span className="truncate">Category: {chg.category}{chg.subcategory ? ` / ${chg.subcategory}` : ''}</span>
                                  <span>•</span>
                                  <span>Assigned to: {chg.assignedToName || 'Unassigned'}</span>
                                </div>
                              </div>
                              <div className="text-left sm:text-right text-sm text-gray-500 shrink-0">
                                {chg.scheduledStart && <p>Starts: {formatDate(chg.scheduledStart)}</p>}
                                {chg.scheduledEnd && <p>Ends: {formatDate(chg.scheduledEnd)}</p>}
                                <p>Updated: {formatDate(chg.updatedAt || chg.createdAt)}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0">
                              <button
                                onClick={() => setSelectedMaintenance(chg)}
                                className="text-xs py-0.5 block text-right text-blue-600 hover:text-blue-900"
                              >
                                View Details
                              </button>
                              {canEditChangeRequest(chg) && (
                                <button
                                  onClick={() => openChangeEditModal(chg)}
                                  className="text-xs py-0.5 block text-right text-green-600 hover:text-green-900"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                    {totalPages > 1 && (
                      <div className="flex flex-wrap justify-center items-center gap-2 mt-6">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }}>
                          <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
                        </form>
                        <span className="px-2 sm:px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
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
                ) : (
                  <div className="text-center py-12 sm:py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium text-lg mb-2">No {changeStatusTab} change requests</p>
                    <p className="text-gray-500 text-sm">There are no change requests with status "{changeStatusTab}" at the moment.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Scheduler Tab */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Header with Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Maintenance Scheduler</h2>
                <p className="text-sm sm:text-base text-gray-600">Schedule and manage system maintenance tasks</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMaintenanceView('calendar')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                      maintenanceView === 'calendar'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Calendar
                  </button>
                  <button
                    onClick={() => setMaintenanceView('list')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                      maintenanceView === 'list'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List
                  </button>
                </div>
                <button
                  onClick={() => setShowCreateScheduledMaintenance(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Schedule Maintenance</span>
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Scheduled</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceStats.scheduled}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Completed</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceStats.completed}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">In Progress</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                      {maintenanceStats.inProgress}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {maintenanceView === 'calendar' && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 overflow-x-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 min-w-[280px]">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Maintenance Calendar</h3>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:space-x-4">
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h4 className="text-sm sm:text-lg font-medium text-gray-900 whitespace-nowrap">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h4>
                  <button
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Simple Calendar Grid */}
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-4 min-w-[560px]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-500 bg-gray-50 min-w-[72px]">
                      {day.slice(0, 2)}
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
                      <div key={day} className="p-1 sm:p-2 min-h-[60px] sm:min-h-[80px] border border-gray-200 bg-white min-w-[72px]">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 mb-1">{day}</div>
                        {dayMaintenance.map(maintenance => (
                          <div
                            key={maintenance._id}
                            onClick={() => setSelectedMaintenance(maintenance)}
                            className="text-xs p-1 mb-1 rounded cursor-pointer hover:opacity-80 break-words"
                            style={{
                              backgroundColor: maintenance.priority === 'High' ? '#fef2f2' : 
                                             maintenance.priority === 'Medium' ? '#fefce8' : '#f0fdf4',
                              color: maintenance.priority === 'High' ? '#dc2626' : 
                                     maintenance.priority === 'Medium' ? '#d97706' : '#16a34a',
                              border: `1px solid ${maintenance.priority === 'High' ? '#fecaca' : 
                                                     maintenance.priority === 'Medium' ? '#fed7aa' : '#bbf7d0'}`
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
            </div>
          )}

          {/* List View */}
          {maintenanceView === 'list' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        value={maintenanceListCategoryFilter}
                        onChange={(e) => setMaintenanceListCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="all">All Categories</option>
                        {maintenanceCategoryOptions.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select
                        value={maintenanceListPriorityFilter}
                        onChange={(e) => setMaintenanceListPriorityFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="all">All Priorities</option>
                        <option value="1 - Critical">1 - Critical</option>
                        <option value="2 - High">2 - High</option>
                        <option value="3 - Medium">3 - Medium</option>
                        <option value="4 - Low">4 - Low</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto overflow-y-hidden">
                  <nav className="flex min-w-max sm:min-w-0 sm:flex">
                    {[
                      { id: 'Scheduled', label: 'Scheduled', count: scheduledMaintenance.filter((maintenance) => getMaintenanceDisplayStatus(maintenance) === 'Scheduled').length, activeClass: 'bg-white text-blue-600 border-b-2 border-blue-500', badgeClass: 'bg-blue-100 text-blue-700' },
                      { id: 'In Progress', label: 'In Progress', count: scheduledMaintenance.filter((maintenance) => getMaintenanceDisplayStatus(maintenance) === 'In Progress').length, activeClass: 'bg-white text-yellow-600 border-b-2 border-yellow-500', badgeClass: 'bg-yellow-100 text-yellow-700' },
                      { id: 'Completed', label: 'Completed', count: scheduledMaintenance.filter((maintenance) => getMaintenanceDisplayStatus(maintenance) === 'Completed').length, activeClass: 'bg-white text-green-600 border-b-2 border-green-500', badgeClass: 'bg-green-100 text-green-700' },
                      { id: 'Cancelled', label: 'Cancelled', count: scheduledMaintenance.filter((maintenance) => getMaintenanceDisplayStatus(maintenance) === 'Cancelled').length, activeClass: 'bg-white text-gray-600 border-b-2 border-gray-500', badgeClass: 'bg-gray-200 text-gray-700' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMaintenanceListStatusFilter(tab.id)}
                        className={`flex-1 min-w-[110px] sm:min-w-0 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all duration-200 shrink-0 ${
                          maintenanceListStatusFilter === tab.id
                            ? tab.activeClass
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <span>{tab.label}</span>
                          {tab.count > 0 && (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              maintenanceListStatusFilter === tab.id ? tab.badgeClass : 'bg-gray-200 text-gray-600'
                            }`}>
                              {tab.count}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="p-4 sm:p-6 overflow-visible">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading maintenance tasks...</span>
                </div>
              ) : filteredMaintenanceList.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {paginatedMaintenanceList.map((maintenance) => {
                      const displayStatus = getMaintenanceDisplayStatus(maintenance);

                      return (
                        <div key={maintenance._id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 sm:space-x-3 mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900">{maintenance.title}</h3>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    displayStatus === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                                    displayStatus === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                    displayStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {displayStatus}
                                  </span>
                                  {maintenance.editHistory?.length > 0 && (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full border border-purple-200 bg-purple-50 text-purple-700">
                                      Edited
                                    </span>
                                  )}
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
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2 sm:line-clamp-none">{maintenance.description}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                  <span>Category: {maintenance.category}</span>
                                  <span>•</span>
                                  <span>Assigned to: {maintenance.assignedToName || 'Unassigned'}</span>
                                  {maintenance.estimatedDuration && (
                                    <>
                                      <span>•</span>
                                      <span>Duration: {maintenance.estimatedDuration}</span>
                                    </>
                                  )}
                                  {maintenance.isRecurring && (
                                    <>
                                      <span>•</span>
                                      <span>Recurring: {maintenance.recurrencePattern}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="text-sm text-gray-500">
                                <p>Scheduled: {formatDate(maintenance.scheduledDate)}</p>
                                {maintenance.scheduledStartTime && maintenance.scheduledEndTime && (
                                  <p>Time: {maintenance.scheduledStartTime} – {maintenance.scheduledEndTime} <span className="text-xs text-gray-400">MYT</span></p>
                                )}
                                {maintenance.nextScheduledDate && (
                                  <p>Next: {formatDate(maintenance.nextScheduledDate)}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-0">
                                <button
                                  onClick={() => setSelectedMaintenance(maintenance)}
                                  className="text-xs py-0.5 block text-right text-blue-600 hover:text-blue-900"
                                >
                                  View Details
                                </button>
                                {canEditMaintenanceTask(maintenance) && (
                                  <button
                                    onClick={() => openMaintenanceEditModal(maintenance)}
                                    className="text-xs py-0.5 block text-right text-green-600 hover:text-green-900"
                                  >
                                    Edit
                                  </button>
                                )}
                                {displayStatus === 'Scheduled' && (
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
                                    className="text-xs py-0.5 block text-right text-green-600 hover:text-green-900"
                                  >
                                    Start
                                  </button>
                                )}
                                {displayStatus === 'In Progress' && (
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
                                    className="text-xs py-0.5 block text-right text-blue-600 hover:text-blue-900"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                <div className="bg-white rounded-lg border border-gray-200 px-4 sm:px-6 py-4">
                  <div className="flex flex-row items-center justify-between gap-3 flex-nowrap min-w-0">
                    <div className="text-sm text-gray-700 flex items-center gap-2 flex-shrink-0">
                      <span>Items:</span>
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md">{paginatedMaintenanceList.length}</span>
                      <span>/</span>
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md">{filteredMaintenanceList.length}</span>
                      <span className="ml-1 whitespace-nowrap">— Page {maintenanceListPage} of {maintenanceListTotalPages}</span>
                    </div>
                    <nav className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                      <button
                        onClick={() => setMaintenanceListPage((prev) => Math.max(prev - 1, 1))}
                        disabled={maintenanceListPage === 1}
                        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {maintenanceListTotalPages > 1 && (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const n = parseInt(maintenanceGoToPageInput, 10);
                          if (!isNaN(n) && n >= 1 && n <= maintenanceListTotalPages) {
                            setMaintenanceListPage(n);
                            setMaintenanceGoToPageInput('');
                          }
                        }}>
                          <input
                            type="number"
                            min={1}
                            max={maintenanceListTotalPages}
                            value={maintenanceGoToPageInput}
                            onChange={(e) => setMaintenanceGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
                            placeholder={maintenanceListPage}
                            aria-label="Maintenance list page number"
                          />
                        </form>
                      )}
                      <button
                        onClick={() => setMaintenanceListPage((prev) => Math.min(prev + 1, maintenanceListTotalPages))}
                        disabled={maintenanceListPage === maintenanceListTotalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
                </>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No {maintenanceListStatusFilter} maintenance tasks</h3>
                  <p className="text-gray-500">There are no maintenance tasks with status "{maintenanceListStatusFilter}" that match the selected filters.</p>
                </div>
              )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}


      {/* Modals */}
      {selectedTicket && (
        <IncidentDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
      {incidentActionModalContent}

      {/* Maintenance Details Modal */}
      {selectedMaintenance && (
        (() => {
          const isChangeDetails = !!(selectedMaintenance.shortDescription || selectedMaintenance.scheduledStart || selectedMaintenance.scheduledEnd);
          const detailsTitle = isChangeDetails
            ? selectedMaintenance.shortDescription || selectedMaintenance.number || 'Change Request'
            : selectedMaintenance.title || 'Maintenance';
          const detailsStatus = isChangeDetails
            ? (selectedMaintenance.state || 'New')
            : selectedMaintenanceDisplayStatus;

          return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[9999] p-4 overflow-hidden">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[calc(100vh-2rem)] my-4 sm:my-0 flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 sm:px-6 py-4 bg-green-600 rounded-t-lg border-b border-green-700 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white break-words">
                  {isChangeDetails ? 'Change Request Details' : 'Maintenance Details'} - {detailsTitle}
                </h2>
                <button
                  onClick={() => setSelectedMaintenance(null)}
                  className="text-white/80 hover:text-white shrink-0 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main Content */}
                <div className="space-y-6">
                  {isChangeDetails ? (
                    canEditChangeRequest(selectedMaintenance) && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => openChangeEditModal(selectedMaintenance)}
                          className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          Edit Change Request
                        </button>
                      </div>
                    )
                  ) : (
                    canEditMaintenanceTask(selectedMaintenance) && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => openMaintenanceEditModal(selectedMaintenance)}
                          className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          Edit Maintenance
                        </button>
                      </div>
                    )
                  )}

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className={`mt-1 px-3 py-1 text-sm font-medium rounded-full inline-block ${
                          detailsStatus === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                          detailsStatus === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                          detailsStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {detailsStatus}
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

                  {selectedMaintenance.editHistory?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Edit Log</h3>
                      <div className="space-y-3">
                        {selectedMaintenance.editHistory
                          .slice()
                          .reverse()
                          .map((entry, index) => (
                            <div key={`${entry.editedAt || index}-${index}`} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <span className="font-medium text-gray-900">{entry.editorName}</span>
                                <span className="text-sm text-gray-500">{formatDate(entry.editedAt)}</span>
                              </div>
                              {entry.changes?.length > 0 ? (
                                <ul className="space-y-1 mt-1">
                                  {entry.changes.map((change, ci) => (
                                    <li key={ci} className="text-sm flex flex-wrap items-baseline gap-x-1">
                                      <span className="font-medium text-gray-700 shrink-0">{change.label}:</span>
                                      <span className="text-gray-400 line-through break-all">{change.from}</span>
                                      <span className="text-gray-400 shrink-0">→</span>
                                      <span className="text-gray-900 break-all">{change.to}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-gray-700 text-sm">{entry.summary}</p>
                              )}
                            </div>
                          ))}
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
                      {!isChangeDetails && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Type</label>
                          <p className="text-gray-900">{selectedMaintenance.type}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-500">Category</label>
                        <p className="text-gray-900">
                          {selectedMaintenance.category}
                          {isChangeDetails && selectedMaintenance.subcategory ? ` / ${selectedMaintenance.subcategory}` : ''}
                        </p>
                      </div>
                      {isChangeDetails && selectedMaintenance.assignedToName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Assigned To</label>
                          <p className="text-gray-900">{selectedMaintenance.assignedToName}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Schedule</h3>
                    <div className="space-y-3">
                      {selectedMaintenance.createdAt && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Created Date & Time (MYT)</label>
                          <p className="text-gray-900">
                            {formatDate(selectedMaintenance.createdAt)}
                            <span className="ml-1.5 text-xs text-gray-400 font-medium">MYT</span>
                          </p>
                        </div>
                      )}
                      {isChangeDetails ? (
                        <>
                          {selectedMaintenance.scheduledStart && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Scheduled Start (MYT)</label>
                              <p className="text-gray-900">
                                {formatDate(selectedMaintenance.scheduledStart)}
                                <span className="ml-1.5 text-xs text-gray-400 font-medium">MYT</span>
                              </p>
                            </div>
                          )}
                          {selectedMaintenance.scheduledEnd && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Scheduled End (MYT)</label>
                              <p className="text-gray-900">
                                {formatDate(selectedMaintenance.scheduledEnd)}
                                <span className="ml-1.5 text-xs text-gray-400 font-medium">MYT</span>
                              </p>
                            </div>
                          )}
                          {selectedMaintenance.estimatedDuration && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Estimated Duration</label>
                              <p className="text-gray-900">{selectedMaintenance.estimatedDuration}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {selectedMaintenance.scheduledDate && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Scheduled Date</label>
                              <p className="text-gray-900">{formatDateOnly(selectedMaintenance.scheduledDate)}</p>
                            </div>
                          )}
                          {selectedMaintenance.scheduledStartTime && selectedMaintenance.scheduledEndTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Scheduled Time (MYT)</label>
                          <p className="text-gray-900">
                            {formatTime12Hour(selectedMaintenance.scheduledStartTime)} – {formatTime12Hour(selectedMaintenance.scheduledEndTime)}
                            <span className="ml-1.5 text-xs text-gray-400 font-medium">MYT (UTC+8)</span>
                          </p>
                        </div>
                          )}
                        </>
                      )}
                      {selectedMaintenance.actualStartTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Actual Start (MYT)</label>
                          <p className="text-gray-900">
                            {formatDate(selectedMaintenance.actualStartTime)}
                            <span className="ml-1.5 text-xs text-gray-400 font-medium">MYT</span>
                          </p>
                        </div>
                      )}
                      {selectedMaintenance.actualEndTime && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Actual End (MYT)</label>
                          <p className="text-gray-900">
                            {formatDate(selectedMaintenance.actualEndTime)}
                            <span className="ml-1.5 text-xs text-gray-400 font-medium">MYT</span>
                          </p>
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
          );
        })()
      )}

      {/* Create/Edit Maintenance Modal */}
      {showCreateScheduledMaintenance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-hidden">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-auto max-h-[calc(100vh-2rem)] my-4 sm:my-0 flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 sm:px-6 py-4 bg-green-600 rounded-t-lg border-b border-green-700 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white">{editingMaintenance ? 'Edit Maintenance' : 'Schedule New Maintenance'}</h2>
                <button
                  onClick={() => {
                    setShowCreateScheduledMaintenance(false);
                    setEditingMaintenance(null);
                    resetMaintenanceForm();
                    setMaintenanceSubmitError('');
                  }}
                  className="text-white/80 hover:text-white transition-colors shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <form onSubmit={handleCreateMaintenance} className={`space-y-4 ${shakeMaintenanceForm ? 'form-shake' : ''}`}>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <DatePickerField
                      label="Scheduled Date"
                      required
                      value={maintenanceForm.scheduledDate ? new Date(maintenanceForm.scheduledDate + 'T12:00:00') : null}
                      onChange={(d) => handleMaintenanceFormChange('scheduledDate', d ? d.toISOString().slice(0, 10) : '')}
                      error={maintenanceFormErrors.scheduledDate}
                      placeholder="DD/MM/YYYY"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time <span className="text-red-500">*</span>
                      <span className="ml-1 text-xs font-normal text-gray-400">(MYT)</span>
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
                      <span className="ml-1 text-xs font-normal text-gray-400">(MYT)</span>
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

                {maintenanceSubmitError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {maintenanceSubmitError}
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateScheduledMaintenance(false);
                      setEditingMaintenance(null);
                      resetMaintenanceForm();
                      setMaintenanceSubmitError('');
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMaintenance}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isSubmittingMaintenance && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    <span>{isSubmittingMaintenance ? (editingMaintenance ? 'Saving...' : 'Creating...') : (editingMaintenance ? 'Save Changes' : 'Schedule Maintenance')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Change Request Modal */}
      {showCreateMaintenance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full mx-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden my-4 sm:my-0">
            <div className="px-4 sm:px-6 py-4 bg-green-600 rounded-t-lg flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white">{editingChange ? 'Edit Change Request' : 'Create New Change Request'}</h2>
                <button
                  onClick={() => {
                    setShowCreateMaintenance(false);
                    setEditingChange(null);
                    resetChangeForm();
                    setChangeSubmitError('');
                  }}
                  className="text-white hover:text-gray-200 transition-colors shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <form noValidate onSubmit={handleCreateChange} className={`space-y-6 ${shakeChangeForm ? 'form-shake' : ''}`}>
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
                        disabled={!changeForm.category || changeForm.category === ''}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.subcategory ? 'border-red-300' : 'border-gray-300'
                        } ${
                          !changeForm.category || changeForm.category === '' 
                            ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                            : ''
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
                        readOnly={Boolean(editingChange)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.requestedBy ? 'border-red-300' : 'border-gray-300'
                        } ${editingChange ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
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
                        readOnly={Boolean(editingChange)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          changeFormErrors.requestedByEmail ? 'border-red-300' : 'border-gray-300'
                        } ${editingChange ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned To <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={changeForm.assignedTo}
                      onChange={(e) => handleChangeFormChange('assignedTo', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        changeFormErrors.assignedTo ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select assignee</option>
                      {adminUsers.length > 0 ? (
                        adminUsers.map(admin => (
                          <option key={admin._id} value={admin._id}>{admin.username} ({admin.role})</option>
                        ))
                      ) : (
                        <option value="" disabled>No admin data available</option>
                      )}
                    </select>
                    {changeFormErrors.assignedTo && (
                      <p className="mt-1 text-sm text-red-600">{changeFormErrors.assignedTo}</p>
                    )}
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Scheduled Start <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-end">
                        <div className="flex-1 min-w-0">
                          <DatePickerField
                            value={changeForm.scheduledStart ? new Date(changeForm.scheduledStart.slice(0, 10) + 'T12:00:00') : null}
                            onChange={(d) => {
                              const dateStr = d ? d.toISOString().slice(0, 10) : '';
                              const timeStr = changeForm.scheduledStart ? changeForm.scheduledStart.slice(11, 16) : '00:00';
                              handleChangeFormChange('scheduledStart', dateStr ? dateStr + 'T' + timeStr : '');
                            }}
                            error={changeFormErrors.scheduledStart}
                            placeholder="DD/MM/YYYY"
                            autoComplete="off"
                          />
                        </div>
                        <input
                          type="time"
                          value={changeForm.scheduledStart ? changeForm.scheduledStart.slice(11, 16) : ''}
                          onChange={(e) => {
                            const t = e.target.value;
                            const d = changeForm.scheduledStart ? changeForm.scheduledStart.slice(0, 10) : new Date().toISOString().slice(0, 10);
                            handleChangeFormChange('scheduledStart', d + 'T' + t);
                          }}
                          className={`w-full lg:flex-shrink-0 lg:w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            changeFormErrors.scheduledStart ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {changeFormErrors.scheduledStart && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.scheduledStart}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Scheduled End <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-end">
                        <div className="flex-1 min-w-0">
                          <DatePickerField
                            value={changeForm.scheduledEnd ? new Date(changeForm.scheduledEnd.slice(0, 10) + 'T12:00:00') : null}
                            onChange={(d) => {
                              const dateStr = d ? d.toISOString().slice(0, 10) : '';
                              const timeStr = changeForm.scheduledEnd ? changeForm.scheduledEnd.slice(11, 16) : '00:00';
                              handleChangeFormChange('scheduledEnd', dateStr ? dateStr + 'T' + timeStr : '');
                            }}
                            error={changeFormErrors.scheduledEnd}
                            placeholder="DD/MM/YYYY"
                            autoComplete="off"
                          />
                        </div>
                        <input
                          type="time"
                          value={changeForm.scheduledEnd ? changeForm.scheduledEnd.slice(11, 16) : ''}
                          onChange={(e) => {
                            const t = e.target.value;
                            const d = changeForm.scheduledEnd ? changeForm.scheduledEnd.slice(0, 10) : new Date().toISOString().slice(0, 10);
                            handleChangeFormChange('scheduledEnd', d + 'T' + t);
                          }}
                          className={`w-full lg:flex-shrink-0 lg:w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            changeFormErrors.scheduledEnd ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {changeFormErrors.scheduledEnd && (
                        <p className="mt-1 text-sm text-red-600">{changeFormErrors.scheduledEnd}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration</label>
                      <input
                        type="text"
                        value={changeForm.estimatedDuration}
                        readOnly
                        placeholder="Auto calculated from scheduled start and end"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Auto calculated from scheduled start and end time.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risk Assessment */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Risk Assessment</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Risk Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={changeForm.riskAssessment}
                      onChange={(e) => handleChangeFormChange('riskAssessment', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        changeFormErrors.riskAssessment ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select risk level</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                    {changeFormErrors.riskAssessment && (
                      <p className="mt-1 text-sm text-red-600">{changeFormErrors.riskAssessment}</p>
                    )}
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

                {changeSubmitError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {changeSubmitError}
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateMaintenance(false);
                      setEditingChange(null);
                      resetChangeForm();
                      setChangeSubmitError('');
                    }}
                    className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingChange}
                    className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {isSubmittingChange ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{editingChange ? 'Saving...' : 'Creating...'}</span>
                      </>
                    ) : (
                      <>
                        {!editingChange && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        )}
                        <span>{editingChange ? 'Save Changes' : 'Create CR'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Incident Modal */}
      {showCreateTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden my-4 sm:my-0">
            <div className="px-4 sm:px-6 py-4 bg-green-600 rounded-t-lg flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white">{editingIncident ? 'Edit Incident' : 'Create New Incident'}</h2>
                <button
                  onClick={() => {
                    setShowCreateTicket(false);
                    setEditingIncident(null);
                    resetIncidentForm();
                    setIncidentSubmitError('');
                  }}
                  className="text-white hover:text-gray-200 transition-colors shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <form noValidate onSubmit={handleCreateIncident} className={`space-y-6 ${shakeIncidentForm ? 'form-shake' : ''}`}>
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
                        disabled={!incidentForm.category || incidentForm.category === ''}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          incidentFormErrors.subcategory ? 'border-red-300' : 'border-gray-300'
                        } ${
                          !incidentForm.category || incidentForm.category === '' 
                            ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                            : ''
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
                        {adminUsers.length > 0 ? (
                          adminUsers.map(admin => (
                            <option key={admin._id} value={admin._id}>{admin.username} ({admin.role})</option>
                          ))
                        ) : (
                          <option value="" disabled>No admin data available</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {incidentSubmitError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {incidentSubmitError}
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTicket(false);
                      setEditingIncident(null);
                      resetIncidentForm();
                      setIncidentSubmitError('');
                    }}
                    className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingIncident}
                    className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {isSubmittingIncident ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{editingIncident ? 'Saving...' : 'Creating...'}</span>
                      </>
                    ) : (
                      <>
                        {!editingIncident && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        )}
                        <span>{editingIncident ? 'Save Changes' : 'Create Incident'}</span>
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