import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';
import { adminApi } from '../../api';
import { isHistoricalParty } from '../../utils/mpUtils';

// Base utility to remove common Malaysian honorifics from names
const removeHonorifics = (name) => {
  if (!name) return name;

  // Common Malaysian honorifics and titles
  const malaysianHonorifics = [
    // Royal titles
    'Yang di-Pertuan Agong', 'Yang Dipertuan Agong', 'YDPA',
    'Sultan', 'Tengku', 'Tunku', 'Raja', 'Dato\' Seri', 'Dato Seri',

    // Federal titles
    'Tun', 'Tan Sri', 'Dato\'', 'Dato', 'Datuk', 'Datuk Seri', 'Dato\' Sri', 'Dato Sri',

    // Professional titles
    'Dr\\.', 'Dr', 'Prof\\.', 'Prof', 'Professor',
    'Ir\\.', 'Ir', 'Eng\\.', 'Eng', 'Engineer',
    'Ts\\.', 'Ts',

    // Religious titles
    'Haji', 'Hajjah', 'Ustaz', 'Ustazah',

    // Common titles (including simple honorifics often used in MP names)
    'Mr\\.', 'Mr', 'Mrs\\.', 'Mrs', 'Ms\\.', 'Ms', 'Miss',
    'Sir', 'Madam', 'YB', 'Y\\.B\\.', 'YBhg', 'Y\\.Bhg\\.',
    'Tuan', 'Puan', 'Sri',

    // Military titles
    'Gen\\.', 'General', 'Col\\.', 'Colonel', 'Maj\\.', 'Major',
    'Capt\\.', 'Captain', 'Lt\\.', 'Lieutenant', 'Sgt\\.', 'Sergeant',

    // Suffixes
    'Jr\\.', 'Jr', 'Sr\\.', 'Sr', 'III', 'IV', 'V'
  ];

  // Create regex pattern that matches honorifics at the beginning or end
  const pattern = new RegExp(
    `^(${malaysianHonorifics.join('|')})\\s+|\\s+(${malaysianHonorifics.join('|')})$|\\b(${malaysianHonorifics.join('|')})\\s+`,
    'gi'
  );

  return name.replace(pattern, '').replace(/\s+/g, ' ').trim();
};

// Use MongoDB-derived honorifics on each MP record (mp.honorifics) to further clean the display name
const getMpDisplayName = (mp) => {
  const rawName = mp?.full_name_with_titles || mp?.name || '';
  if (!rawName) return rawName;

  // First remove the common/static honorifics
  let cleanName = removeHonorifics(rawName);

  // Then remove any honorifics detected and stored on the MP document (honorific_dictionary from MongoDB)
  if (Array.isArray(mp.honorifics) && mp.honorifics.length > 0) {
    mp.honorifics.forEach((h) => {
      if (!h || typeof h !== 'string') return;
      // Escape regex special chars
      const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dynamicPattern = new RegExp(
        `^${escaped}\\s+|\\s+${escaped}$|\\b${escaped}\\s+`,
        'gi'
      );
      cleanName = cleanName.replace(dynamicPattern, ' ');
    });

    cleanName = cleanName.replace(/\s+/g, ' ').trim();
  }

  return cleanName;
};

const AdminMPManagement = () => {
  const { admin } = useAdminAuth();
  const [mps, setMps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMPs, setTotalMPs] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('current');
  const [searchField, setSearchField] = useState('all');
  const [filterParty, setFilterParty] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [filterTerm, setFilterTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mpToDelete, setMpToDelete] = useState(null);
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [mpToChangeStatus, setMpToChangeStatus] = useState(null);
  const [selectedMp, setSelectedMp] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [selectedMps, setSelectedMps] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error');
  const [goToPageInput, setGoToPageInput] = useState('');
  
  // Image upload states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Form validation states
  const [formErrors, setFormErrors] = useState({});
  const [shakeForm, setShakeForm] = useState(false);

  // Any modal that should lock body scroll when open
  const anyModalOpen = showCreateModal || showEditModal || showDetailModal || showDeleteModal || showStatusChangeModal;

  // Form validation function
  const validateForm = () => {
    const errors = {};
    
    if (!formData.mp_id?.trim()) {
      errors.mp_id = 'MP ID is required';
    }
    
    if (!formData.name?.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.party?.trim()) {
      errors.party = 'Party is required';
    }
    
    if (!formData.constituency?.trim()) {
      errors.constituency = 'Constituency is required';
    }
    
    if (!formData.parliament_term?.trim()) {
      errors.parliament_term = 'Parliament Term is required';
    }

    // Require either uploaded image or URL
    if (!selectedImage && !formData.profilePicture?.trim()) {
      errors.profilePicture = 'Profile picture is required';
    }
    
    setFormErrors(errors);
    
    // Trigger shake animation if validation fails
    if (Object.keys(errors).length > 0) {
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 600);
    }
    
    return Object.keys(errors).length === 0;
  };

  // Helper function to show alerts
  const showAlertMessage = (message, type = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  // Image upload functions
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validate image format
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    
    const isValidType = allowedImageTypes.includes(file.type);
    const isValidExtension = allowedImageExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!isValidType || !isValidExtension) {
      showAlertMessage(`Invalid image format: ${file.name}. Allowed formats: ${allowedImageExtensions.join(', ')}`, 'warning');
      return;
    }
    
    // Check file size (5MB limit for images)
    if (file.size > 5 * 1024 * 1024) {
      showAlertMessage(`Image too large: ${file.name}. Maximum size is 5MB.`, 'warning');
      return;
    }
    
    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Clear the file input
    const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Form states for create/edit
  const [formData, setFormData] = useState({
    mp_id: '',
    name: '',
    full_name_with_titles: '',
    honorifics: [],
    party: '',
    party_full_name: '',
    constituency: '',
    constituency_code: '',
    constituency_name: '',
    positionInParliament: '',
    parliament_term: '',
    status: 'current',
    service: '',
    state: '',
    positionInCabinet: '',
    seatNumber: '',
    phone: '',
    fax: '',
    email: '',
    address: '',
    profilePicture: '',
    profile_url: '',
    biography: '',
    hasPastTerm: false
  });
  const [pastTerms, setPastTerms] = useState([]);

  // Check if current admin is superadmin
  const hasManageMPs = admin?.role === 'superadmin' || (Array.isArray(admin?.permissions) && admin.permissions.includes('manage_mps'));

  // Debounced search effect
  useEffect(() => {
    if (hasManageMPs) {
      const timeoutId = setTimeout(() => {
        fetchMps();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [hasManageMPs, currentPage, searchTerm, filterStatus, filterParty, filterTerm, sortBy]);

  // Lock body scroll when any major modal is open; restore on close
  useEffect(() => {
    if (!anyModalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [anyModalOpen]);

  const fetchMps = async () => {
    try {
      setLoading(true);
      setIsApplyingFilter(true);
      
      // Convert sortBy to server format
      let serverSortBy = 'created_at';
      let serverSortOrder = 'desc';
      
      if (sortBy === 'name-asc') {
        serverSortBy = 'name';
        serverSortOrder = 'asc';
      } else if (sortBy === 'name-desc') {
        serverSortBy = 'name';
        serverSortOrder = 'desc';
      } else if (sortBy === 'party-asc') {
        serverSortBy = 'party';
        serverSortOrder = 'asc';
      } else if (sortBy === 'party-desc') {
        serverSortBy = 'party';
        serverSortOrder = 'desc';
      } else if (sortBy === 'constituency-asc') {
        serverSortBy = 'constituency';
        serverSortOrder = 'asc';
      } else if (sortBy === 'constituency-desc') {
        serverSortBy = 'constituency';
        serverSortOrder = 'desc';
      } else if (sortBy === 'parliament_term-asc') {
        serverSortBy = 'parliament_term';
        serverSortOrder = 'asc';
      } else if (sortBy === 'parliament_term-desc') {
        serverSortBy = 'parliament_term';
        serverSortOrder = 'desc';
      }
      
      const response = await adminApi.getAllMPs(
        currentPage,
        10,
        serverSortBy,
        serverSortOrder,
        searchTerm,
        searchField,
        filterStatus === 'historical' ? filterTerm : '',
        filterStatus,
        filterParty
      );
      setMps(response.data.mps);
      setTotalPages(response.data.pagination.pages);
      setTotalMPs(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching MPs:', error);
      showAlertMessage('Error fetching MPs: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
      setIsApplyingFilter(false);
    }
  };

  const handleCreateMp = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Convert image to Base64 if selected
      let imageData = null;
      if (selectedImage) {
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedImage);
        });
      }
      
      // Include image data in form data
      const mpData = {
        ...formData,
        profilePicture: imageData || formData.profilePicture,
        // Convert pastTerms to parliamentary_history format
        parliamentary_history: formData.hasPastTerm && pastTerms.length > 0
          ? pastTerms.map(term => ({
              parliament_term: term.parliament_term,
              term_number: parseInt(term.parliament_term.replace(/\D/g, '') || '0', 10),
              party: term.party,
              party_full_name: term.party_full_name,
              constituency: term.constituency,
              constituency_code: term.constituency_code,
              constituency_name: term.constituency_name,
              status: 'historical'
            }))
          : []
      };
      
      // Remove hasPastTerm from the data before sending
      const { hasPastTerm, ...dataToSend } = mpData;
      
      await adminApi.createMp(dataToSend);
      showAlertMessage('MP created successfully', 'success');
      setShowCreateModal(false);
      // Restore scrollbars
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      resetForm();
      setSelectedImage(null);
      setImagePreview(null);
      setFormErrors({});
      fetchMps();
    } catch (error) {
      console.error('Error creating MP:', error);
      showAlertMessage('Error creating MP: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMp = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Convert image to Base64 if new image selected
      let imageData = formData.profilePicture; // Keep existing if no new image
      if (selectedImage) {
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedImage);
        });
      }
      
      // Include image data in form data
      const mpData = {
        ...formData,
        profilePicture: imageData,
        // Convert pastTerms to parliamentary_history format
        parliamentary_history: formData.hasPastTerm && pastTerms.length > 0
          ? pastTerms.map(term => ({
              parliament_term: term.parliament_term,
              term_number: parseInt(term.parliament_term.replace(/\D/g, '') || '0', 10),
              party: term.party,
              party_full_name: term.party_full_name,
              constituency: term.constituency,
              constituency_code: term.constituency_code,
              constituency_name: term.constituency_name,
              status: 'historical'
            }))
          : []
      };
      
      // Remove hasPastTerm from the data before sending
      const { hasPastTerm, ...dataToSend } = mpData;
      
      // Validate that selectedMp and _id exist
      if (!selectedMp || !selectedMp._id) {
        showAlertMessage('Error: MP ID is missing. Please try again.');
        return;
      }
      
      const mpId = selectedMp._id || selectedMp.id;
      if (!mpId) {
        showAlertMessage('Error: MP ID is missing. Please try again.');
        return;
      }
      const mpIdString = String(mpId);
      
      await adminApi.updateMp(mpIdString, dataToSend);
      showAlertMessage('MP updated successfully', 'success');
      closeEditModal();
      setFormErrors({});
      fetchMps();
    } catch (error) {
      showAlertMessage('Error updating MP: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMp = async () => {
    try {
      setLoading(true);
      await adminApi.deleteMp(mpToDelete._id);
      showAlertMessage('MP deleted successfully', 'success');
      setShowDeleteModal(false);
      setMpToDelete(null);
      fetchMps();
    } catch (error) {
      console.error('Error deleting MP:', error);
      showAlertMessage('Error deleting MP: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (mpId, newStatus) => {
    try {
      setLoading(true);
      await adminApi.updateMpStatus(mpId, newStatus);
      showAlertMessage('MP status updated successfully', 'success');
      fetchMps();
    } catch (error) {
      console.error('Error updating MP status:', error);
      showAlertMessage('Error updating MP status: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    // Restore scrollbars
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    resetForm();
    setSelectedImage(null);
    setImagePreview(null);
    setPastTerms([]);
  };

  const openCreateModal = () => {
    resetForm();
    // Clear image states
    setSelectedImage(null);
    setImagePreview(null);
    // Clear form errors
    setFormErrors({});
    setPastTerms([]);
    // Control scrollbars
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    setShowCreateModal(true);
  };

  const openEditModal = (mp) => {
    setSelectedMp(mp);
    setFormData({
      mp_id: mp.mp_id || '',
      name: mp.name || '',
      full_name_with_titles: mp.full_name_with_titles || '',
      honorifics: mp.honorifics || [],
      party: mp.party || '',
      party_full_name: mp.party_full_name || '',
      constituency: mp.constituency || '',
      constituency_code: mp.constituency_code || '',
      constituency_name: mp.constituency_name || '',
      positionInParliament: mp.positionInParliament || '',
      parliament_term: mp.parliament_term || '',
      status: mp.status || 'current',
      service: mp.service || '',
      state: mp.state || '',
      positionInCabinet: mp.positionInCabinet || '',
      seatNumber: mp.seatNumber || '',
      phone: mp.phone || '',
      fax: mp.fax || '',
      email: mp.email || '',
      address: mp.address || '',
      profilePicture: mp.profilePicture || '',
      profile_url: mp.profile_url || '',
      biography: mp.biography || '',
      hasPastTerm: mp.parliamentary_history && mp.parliamentary_history.length > 0
    });
    // Load past terms from parliamentary_history
    if (mp.parliamentary_history && mp.parliamentary_history.length > 0) {
      setPastTerms(mp.parliamentary_history.map(term => ({
        parliament_term: term.parliament_term || '',
        party: term.party || '',
        party_full_name: term.party_full_name || '',
        constituency: term.constituency || '',
        constituency_code: term.constituency_code || '',
        constituency_name: term.constituency_name || '',
        status: term.status || 'historical'
      })));
    } else {
      setPastTerms([]);
    }
    
    // Handle existing image
    if (mp.profilePicture) {
      setSelectedImage(null);
      setImagePreview(mp.profilePicture);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
    
    // Clear form errors
    setFormErrors({});
    // Control scrollbars
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    setShowEditModal(true);
  };

  const openDetailModal = (mp) => {
    setSelectedMp(mp);
    // Control scrollbars
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    setShowDetailModal(true);
  };

  const openDeleteModal = (mp) => {
    setMpToDelete(mp);
    setShowDeleteModal(true);
  };

  const openStatusChangeModal = (mp) => {
    setMpToChangeStatus(mp);
    setShowStatusChangeModal(true);
  };

  const confirmStatusChange = async () => {
    if (!mpToChangeStatus) return;

    try {
      setLoading(true);
      const newStatus = mpToChangeStatus.status === 'current' ? 'historical' : 'current';
      
      await adminApi.updateMp(mpToChangeStatus._id, { 
        ...mpToChangeStatus, 
        status: newStatus 
      });
      
      showAlertMessage(
        `MP ${mpToChangeStatus.name} status changed to ${newStatus === 'current' ? 'Current' : 'Historical'}`, 
        'success'
      );
      
      setShowStatusChangeModal(false);
      setMpToChangeStatus(null);
      fetchMps();
    } catch (error) {
      console.error('Error changing MP status:', error);
      showAlertMessage('Error changing MP status: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      mp_id: '',
      name: '',
      full_name_with_titles: '',
      honorifics: [],
      party: '',
      party_full_name: '',
      constituency: '',
      constituency_code: '',
      constituency_name: '',
      positionInParliament: '',
      parliament_term: '',
      status: 'current',
      service: '',
      state: '',
      positionInCabinet: '',
      seatNumber: '',
      phone: '',
      fax: '',
      email: '',
      address: '',
      profilePicture: '',
      profile_url: '',
      biography: '',
      hasPastTerm: false
    });
    setPastTerms([]);
    setFormErrors({});
    setShakeForm(false);
  };

  const handleSort = (column) => {
    if (sortBy === `${column}-asc`) {
      setSortBy(`${column}-desc`);
    } else {
      setSortBy(`${column}-asc`);
    }
    setCurrentPage(1);
  };

  const getSortIcon = (column) => {
    if (sortBy === `${column}-asc`) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else if (sortBy === `${column}-desc`) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedMps.length === 0) return;

    const actionText = bulkAction === 'activate' ? 'mark as Current' : 
                      bulkAction === 'deactivate' ? 'mark as Historical' : 'delete';
    
    if (!window.confirm(`Are you sure you want to ${actionText} ${selectedMps.length} selected MP(s)?`)) {
      return;
    }

    try {
      setLoading(true);
      if (bulkAction === 'delete') {
        await adminApi.bulkDeleteMPs(selectedMps);
        showAlertMessage('Selected MPs deleted successfully', 'success');
      } else if (bulkAction === 'activate') {
        await adminApi.bulkUpdateMPs(selectedMps, { status: 'current' });
        showAlertMessage('Selected MPs marked as Current successfully', 'success');
      } else if (bulkAction === 'deactivate') {
        await adminApi.bulkUpdateMPs(selectedMps, { status: 'historical' });
        showAlertMessage('Selected MPs marked as Historical successfully', 'success');
      }
      setSelectedMps([]);
      setBulkAction('');
      fetchMps();
    } catch (error) {
      console.error('Error performing bulk action:', error);
      showAlertMessage('Error performing bulk action: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMp = (mpId) => {
    setSelectedMps(prev => 
      prev.includes(mpId) 
        ? prev.filter(id => id !== mpId)
        : [...prev, mpId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMps.length === mps.length) {
      setSelectedMps([]);
    } else {
      setSelectedMps(mps.map(mp => mp._id));
    }
  };

  if (!hasManageMPs) {
    return (
      <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to manage MPs. The manage_mps permission is required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6 px-4 sm:px-6 min-w-0">
      {/* Alert */}
      {showAlert && (
        <div className={`rounded-lg p-4 ${
          alertType === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          alertType === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
          'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <span>{alertMessage}</span>
            <button
              onClick={() => setShowAlert(false)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header with Actions */}
      <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 overflow-hidden min-w-0">
        <div className="px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-r from-green-500 to-green-600">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">MP Management</h2>
                <p className="text-green-100 mt-1 text-sm sm:text-base truncate">Manage Members of Parliament data and profiles</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add MP</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 p-4 sm:p-6 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
              <select
                value={searchField}
                onChange={(e) => { setSearchField(e.target.value); }}
                className="w-full sm:w-auto min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 flex-shrink-0"
              >
                <option value="all">All</option>
                <option value="name">Name</option>
                <option value="party">Party</option>
                <option value="constituency">Constituency</option>
                <option value="state">State</option>
              </select>
              <input
                type="text"
                placeholder={
                  searchField === 'name' ? 'Search by name...' :
                  searchField === 'party' ? 'Search by party...' :
                  searchField === 'constituency' ? 'Search by constituency...' :
                  searchField === 'state' ? 'Search by state...' :
                  'Search MPs...'
                }
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Term Tabs and Filter - same structure for Current and Past so table layout below is identical */}
          <div className="lg:col-span-2 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end min-w-0">
              <div className="inline-flex w-fit rounded-md shadow-sm border border-gray-300 overflow-hidden flex-shrink-0" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterStatus === 'current'}
                  onClick={() => { setFilterStatus('current'); setCurrentPage(1); }}
                  className={`${filterStatus === 'current' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-4 py-2 text-sm font-medium whitespace-nowrap flex-shrink-0`}
                >
                  Current Term
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterStatus === 'historical'}
                  onClick={() => { setFilterStatus('historical'); setCurrentPage(1); }}
                  className={`${filterStatus === 'historical' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-4 py-2 text-sm font-medium border-l border-gray-300 whitespace-nowrap flex-shrink-0`}
                >
                  Past Term
                </button>
              </div>
              {/* Same structure for both tabs: flex-1 slot so table below gets identical width (Current: empty, Past: term input) */}
              <div className="flex-1 min-w-0">
                {filterStatus === 'historical' && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="e.g., 14"
                    value={filterTerm}
                    onChange={(e) => { setFilterTerm(e.target.value.replace(/[^0-9]/g, '')); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedMps.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 sm:mb-6 mt-4 sm:mt-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm text-green-800 flex-shrink-0">
              {selectedMps.length} MP(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select Action</option>
                <option value="activate">Mark as Current</option>
                <option value="deactivate">Mark as Historical</option>
                <option value="delete">Delete Selected</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="px-4 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                Apply
              </button>
              <button
                onClick={() => setSelectedMps([])}
                className="px-4 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MP Table - same layout for Current and Past Term; card constrains width so inner scroll shows and Actions column is visible */}
      <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 min-w-0 w-full max-w-full overflow-hidden">
        <div className="overflow-x-auto min-w-0 w-full" style={{ maxWidth: '100%' }}>
          <table className="w-full min-w-[980px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedMps.length === mps.length && mps.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                  <div className="flex items-center space-x-1" onClick={() => handleSort('name')}>
                    <span>Name</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                  <div className="flex items-center space-x-1" onClick={() => handleSort('party')}>
                    <span>Party</span>
                    {getSortIcon('party')}
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                  <div className="flex items-center space-x-1" onClick={() => handleSort('constituency')}>
                    <span>Constituency</span>
                    {getSortIcon('constituency')}
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap">
                  <div className="flex items-center space-x-1" onClick={() => handleSort('parliament_term')}>
                    <span>Latest Term</span>
                    {getSortIcon('parliament_term')}
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ width: '8rem', minWidth: '8rem' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 sm:px-6 py-12 text-center">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 flex-shrink-0"></div>
                      <span className="text-gray-600">Loading MPs...</span>
                    </div>
                  </td>
                </tr>
              ) : mps.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 sm:px-6 py-12 text-center text-gray-500">
                    No MPs found
                  </td>
                </tr>
              ) : (
                mps.map((mp) => (
                  <tr key={mp._id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <input
                        type="checkbox"
                        checked={selectedMps.includes(mp._id)}
                        onChange={() => handleSelectMp(mp._id)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 max-w-[180px] sm:max-w-none">
                      <div className="flex items-center min-w-0">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                          <img
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover"
                            src={mp.profilePicture || '/src/assets/image/placeholder-mp.jpg'}
                            alt={mp.name}
                            onError={(e) => {
                              e.target.src = '/src/assets/image/placeholder-mp.jpg';
                            }}
                          />
                        </div>
                        <div className="ml-2 sm:ml-4 min-w-0">
                          <div className="text-sm font-medium text-gray-900 line-clamp-2 break-words max-w-[10rem] sm:max-w-[12rem]" title={getMpDisplayName(mp)}>
                            {getMpDisplayName(mp)}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate" title={mp.mp_id}>{mp.mp_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-900 max-w-[100px] sm:max-w-none">
                      <span className="block truncate" title={isHistoricalParty(mp.party) ? 'Unknown' : (mp.party || 'N/A')}>
                        {isHistoricalParty(mp.party) ? 'Unknown' : (mp.party || 'N/A')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-900 max-w-[120px] sm:max-w-none">
                      <span className="block truncate" title={mp.constituency && mp.constituency.replace(/^P\d+\s*/, '') || 'N/A'}>
                        {mp.constituency && mp.constituency.replace(/^P\d+\s*/, '') || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-900 whitespace-nowrap">
                      {(() => {
                        const term = parseInt(mp.parliament_term, 10);
                        return Number.isFinite(term) ? term : (mp.parliament_term || 'N/A');
                      })()}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-900 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        mp.status === 'current' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {mp.status === 'current' ? 'Current' : 'Historical'}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 text-sm font-medium whitespace-nowrap align-top" style={{ width: '8rem', minWidth: '8rem' }}>
                      <div className="flex flex-col items-start gap-0">
                        <button
                          onClick={() => openDetailModal(mp)}
                          className="text-xs text-blue-600 hover:text-blue-900 py-0.5 block text-left"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEditModal(mp)}
                          className="text-xs text-green-600 hover:text-green-900 py-0.5 block text-left"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openStatusChangeModal(mp)}
                          className={`text-xs py-0.5 block text-left ${
                            mp.status === 'current' 
                              ? 'text-orange-600 hover:text-orange-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={mp.status === 'current' ? 'Mark as Historical' : 'Mark as Current'}
                        >
                          {mp.status === 'current' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openDeleteModal(mp)}
                          className="text-xs text-red-600 hover:text-red-900 py-0.5 block text-left"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - single row */}
        {mps.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 min-w-0">
            <div className="flex flex-row items-center justify-between gap-2 flex-nowrap min-w-0">
              <div className="text-sm text-gray-700 flex-shrink-0 truncate min-w-0">
                Showing page {currentPage} of {totalPages} (Total MPs: {totalMPs})
              </div>
              <nav className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                <button type="button" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                {totalPages > 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(goToPageInput, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setGoToPageInput(''); } }} className="flex-shrink-0">
                    <input type="number" min={1} max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-12 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center" placeholder={currentPage} aria-label="Page number" />
                  </form>
                )}
                <button type="button" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal – portalled to body; high z-index; clicks outside close modal */}
      {showCreateModal && createPortal(
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center p-4"
          style={{ zIndex: 999999 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowCreateModal(false);
          }}
        >
          <div
            className="relative p-0 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 max-w-4xl shadow-xl rounded-lg bg-white max-h-[90vh] flex flex-col overflow-hidden"
            data-modal-content="true"
            onClick={(e) => {
              // Allow form submit, just stop click from closing backdrop
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="bg-green-600 px-6 py-4 rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Create New MP</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCreateModal(false);
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleCreateMp} noValidate className={`space-y-6 ${shakeForm ? 'form-shake' : ''}`} style={{ position: 'relative' }}>
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        MP ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="mp_id"
                        value={formData.mp_id}
                        onChange={(e) => setFormData({...formData, mp_id: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.mp_id ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., MP001"
                      />
                      <div className="mt-1 h-5">
                        {formErrors.mp_id && (
                          <p className="text-sm text-red-600">{formErrors.mp_id}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <div className="mt-1 h-5">
                        {formErrors.name && (
                          <p className="text-sm text-red-600">{formErrors.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Full Name with Titles</label>
                      <input
                        type="text"
                        value={formData.full_name_with_titles}
                        onChange={(e) => setFormData({...formData, full_name_with_titles: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Political Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Political Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Party <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="party"
                        value={formData.party}
                        onChange={(e) => setFormData({...formData, party: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.party ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <div className="mt-1 h-5">
                        {formErrors.party && (
                          <p className="text-sm text-red-600">{formErrors.party}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Party Full Name</label>
                      <input
                        type="text"
                        value={formData.party_full_name}
                        onChange={(e) => setFormData({...formData, party_full_name: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Constituency <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="constituency"
                        value={formData.constituency}
                        onChange={(e) => setFormData({...formData, constituency: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.constituency ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <div className="mt-1 h-5">
                        {formErrors.constituency && (
                          <p className="text-sm text-red-600">{formErrors.constituency}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Constituency Code</label>
                      <input
                        type="text"
                        value={formData.constituency_code}
                        onChange={(e) => setFormData({...formData, constituency_code: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Constituency Name</label>
                      <input
                        type="text"
                        value={formData.constituency_name}
                        onChange={(e) => setFormData({...formData, constituency_name: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Parliament Term <span className="text-red-500">*</span></label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.hasPastTerm}
                            onChange={(e) => setFormData({...formData, hasPastTerm: e.target.checked})}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-600">Has past term?</span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          name="parliament_term"
                          value={formData.parliament_term}
                          onChange={(e) => setFormData({...formData, parliament_term: e.target.value})}
                          className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                            formErrors.parliament_term ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        <div className="h-5 ml-2">
                          {formErrors.parliament_term && (
                            <p className="text-sm text-red-600">{formErrors.parliament_term}</p>
                          )}
                        </div>
                        {formData.hasPastTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setPastTerms([...pastTerms, {
                                parliament_term: '',
                                party: '',
                                party_full_name: '',
                                constituency: '',
                                constituency_code: '',
                                constituency_name: '',
                                status: 'historical'
                              }]);
                            }}
                            className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            title="Add past term"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {formData.hasPastTerm && pastTerms.length > 0 && (
                      <div className="md:col-span-2 mt-4 space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Past Terms</label>
                        {pastTerms.map((term, index) => (
                          <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">Past Term {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPastTerms(pastTerms.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 hover:text-red-800"
                                title="Remove past term"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Parliament Term</label>
                                <input
                                  type="text"
                                  value={term.parliament_term}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].parliament_term = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., 14th"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Party</label>
                                <input
                                  type="text"
                                  value={term.party}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].party = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., BN"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Party Full Name</label>
                                <input
                                  type="text"
                                  value={term.party_full_name}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].party_full_name = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., Barisan Nasional"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Constituency</label>
                                <input
                                  type="text"
                                  value={term.constituency}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].constituency = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., P123 Kanowit"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="current">Current</option>
                        <option value="historical">Historical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position in Parliament</label>
                      <input
                        type="text"
                        value={formData.positionInParliament}
                        onChange={(e) => setFormData({...formData, positionInParliament: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position in Cabinet</label>
                      <input
                        type="text"
                        value={formData.positionInCabinet}
                        onChange={(e) => setFormData({...formData, positionInCabinet: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Service</label>
                      <input
                        type="text"
                        value={formData.service}
                        onChange={(e) => setFormData({...formData, service: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Seat Number</label>
                      <input
                        type="text"
                        value={formData.seatNumber}
                        onChange={(e) => setFormData({...formData, seatNumber: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fax</label>
                      <input
                        type="text"
                        value={formData.fax}
                        onChange={(e) => setFormData({...formData, fax: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profile Picture <span className="text-red-500">*</span>
                      </label>
                      
                      {/* Image Preview */}
                      {imagePreview && (
                        <div className="mb-4">
                          <div className="relative inline-block">
                            <img
                              src={imagePreview}
                              alt="Profile Preview"
                              className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Upload Controls */}
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-3">
                          <label className={`cursor-pointer px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                            formErrors.profilePicture
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                            </svg>
                            <span>Choose Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                          </label>
                          {selectedImage && (
                            <span className="text-sm text-gray-600">
                              {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Supported formats: JPG, PNG, GIF • Maximum size: 5MB
                        </div>
                        
                        {/* Alternative URL Input */}
                        <div className="border-t pt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Or enter image URL</label>
                          <input
                            type="url"
                            value={formData.profilePicture}
                            onChange={(e) => setFormData({...formData, profilePicture: e.target.value})}
                            placeholder="https://example.com/image.jpg"
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 text-sm ${
                              formErrors.profilePicture ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </div>

                        {formErrors.profilePicture && (
                          <p className="mt-2 text-sm text-red-600">{formErrors.profilePicture}</p>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Parliament Profile URL</label>
                      <input
                        type="url"
                        value={formData.profile_url}
                        onChange={(e) => setFormData({...formData, profile_url: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Biography & Additional Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Biography & Additional Information</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Biography</label>
                      <textarea
                        value={formData.biography}
                        onChange={(e) => setFormData({...formData, biography: e.target.value})}
                        rows={4}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="Enter MP's biography and background information..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Honorifics (comma-separated)</label>
                      <input
                        type="text"
                        value={formData.honorifics ? formData.honorifics.join(', ') : ''}
                        onChange={(e) => setFormData({...formData, honorifics: e.target.value.split(',').map(h => h.trim()).filter(h => h)})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="e.g., Dato', YB, Dr."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCreateModal(false);
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create MP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal - portalled to body; fixed size card, inner scroll, no outer scroll */}
      {showEditModal && selectedMp && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4" style={{ zIndex: 999999 }}>
          <div className="flex flex-col w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 max-w-4xl shadow-xl rounded-lg overflow-hidden" style={{ height: '85vh' }}>
            {/* Header - same width as card, no scroll */}
            <div className="flex-shrink-0 bg-green-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Edit MP</h3>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowEditModal(false); }}
                  className="text-white hover:text-gray-200 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form - inner scroll only */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white p-6">
              <form onSubmit={handleUpdateMp} className={`space-y-6 ${shakeForm ? 'form-shake' : ''}`} style={{ position: 'relative' }}>
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">MP ID <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="mp_id"
                        value={formData.mp_id}
                        onChange={(e) => setFormData({...formData, mp_id: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.mp_id ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., MP001"
                      />
                      <div className="mt-1 h-5">
                        {formErrors.mp_id && (
                          <p className="text-sm text-red-600">{formErrors.mp_id}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <div className="mt-1 h-5">
                        {formErrors.name && (
                          <p className="text-sm text-red-600">{formErrors.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Full Name with Titles</label>
                      <input
                        type="text"
                        value={formData.full_name_with_titles}
                        onChange={(e) => setFormData({...formData, full_name_with_titles: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Political Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Political Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Party <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="party"
                        value={formData.party}
                        onChange={(e) => setFormData({...formData, party: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.party ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <div className="mt-1 h-5">
                        {formErrors.party && (
                          <p className="text-sm text-red-600">{formErrors.party}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Party Full Name</label>
                      <input
                        type="text"
                        value={formData.party_full_name}
                        onChange={(e) => setFormData({...formData, party_full_name: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Constituency <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="constituency"
                        value={formData.constituency}
                        onChange={(e) => setFormData({...formData, constituency: e.target.value})}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                          formErrors.constituency ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <div className="mt-1 h-5">
                        {formErrors.constituency && (
                          <p className="text-sm text-red-600">{formErrors.constituency}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Constituency Code</label>
                      <input
                        type="text"
                        value={formData.constituency_code}
                        onChange={(e) => setFormData({...formData, constituency_code: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Constituency Name</label>
                      <input
                        type="text"
                        value={formData.constituency_name}
                        onChange={(e) => setFormData({...formData, constituency_name: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Parliament Term <span className="text-red-500">*</span></label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.hasPastTerm}
                            onChange={(e) => setFormData({...formData, hasPastTerm: e.target.checked})}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-600">Has past term?</span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          name="parliament_term"
                          value={formData.parliament_term}
                          onChange={(e) => setFormData({...formData, parliament_term: e.target.value})}
                          className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 ${
                            formErrors.parliament_term ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        <div className="h-5 ml-2">
                          {formErrors.parliament_term && (
                            <p className="text-sm text-red-600">{formErrors.parliament_term}</p>
                          )}
                        </div>
                        {formData.hasPastTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setPastTerms([...pastTerms, {
                                parliament_term: '',
                                party: '',
                                party_full_name: '',
                                constituency: '',
                                constituency_code: '',
                                constituency_name: '',
                                status: 'historical'
                              }]);
                            }}
                            className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            title="Add past term"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {formData.hasPastTerm && pastTerms.length > 0 && (
                      <div className="md:col-span-2 mt-4 space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Past Terms</label>
                        {pastTerms.map((term, index) => (
                          <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">Past Term {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPastTerms(pastTerms.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 hover:text-red-800"
                                title="Remove past term"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Parliament Term</label>
                                <input
                                  type="text"
                                  value={term.parliament_term}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].parliament_term = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., 14th"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Party</label>
                                <input
                                  type="text"
                                  value={term.party}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].party = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., BN"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Party Full Name</label>
                                <input
                                  type="text"
                                  value={term.party_full_name}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].party_full_name = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., Barisan Nasional"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Constituency</label>
                                <input
                                  type="text"
                                  value={term.constituency}
                                  onChange={(e) => {
                                    const updated = [...pastTerms];
                                    updated[index].constituency = e.target.value;
                                    setPastTerms(updated);
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                                  placeholder="e.g., P123 Kanowit"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="current">Current</option>
                        <option value="historical">Historical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position in Parliament</label>
                      <input
                        type="text"
                        value={formData.positionInParliament}
                        onChange={(e) => setFormData({...formData, positionInParliament: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position in Cabinet</label>
                      <input
                        type="text"
                        value={formData.positionInCabinet}
                        onChange={(e) => setFormData({...formData, positionInCabinet: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Service</label>
                      <input
                        type="text"
                        value={formData.service}
                        onChange={(e) => setFormData({...formData, service: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Seat Number</label>
                      <input
                        type="text"
                        value={formData.seatNumber}
                        onChange={(e) => setFormData({...formData, seatNumber: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fax</label>
                      <input
                        type="text"
                        value={formData.fax}
                        onChange={(e) => setFormData({...formData, fax: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                      
                      {/* Image Preview */}
                      {imagePreview && (
                        <div className="mb-4">
                          <div className="relative inline-block">
                            <img
                              src={imagePreview}
                              alt="Profile Preview"
                              className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Upload Controls */}
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-3">
                          <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                            </svg>
                            <span>Choose Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                          </label>
                          {selectedImage && (
                            <span className="text-sm text-gray-600">
                              {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Supported formats: JPG, PNG, GIF • Maximum size: 5MB
                        </div>
                        
                        {/* Alternative URL Input */}
                        <div className="border-t pt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Or enter image URL</label>
                          <input
                            type="url"
                            value={formData.profilePicture}
                            onChange={(e) => setFormData({...formData, profilePicture: e.target.value})}
                            placeholder="https://example.com/image.jpg"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Parliament Profile URL</label>
                      <input
                        type="url"
                        value={formData.profile_url}
                        onChange={(e) => setFormData({...formData, profile_url: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Biography & Additional Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Biography & Additional Information</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Biography</label>
                      <textarea
                        value={formData.biography}
                        onChange={(e) => setFormData({...formData, biography: e.target.value})}
                        rows={4}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="Enter MP's biography and background information..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Honorifics (comma-separated)</label>
                      <input
                        type="text"
                        value={formData.honorifics ? formData.honorifics.join(', ') : ''}
                        onChange={(e) => setFormData({...formData, honorifics: e.target.value.split(',').map(h => h.trim()).filter(h => h)})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="e.g., Dato', YB, Dr."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update MP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Detail Modal - portalled to body; fixed size card, inner scroll, no outer scroll */}
      {showDetailModal && selectedMp && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4" style={{ zIndex: 999999 }}>
          {/* Card: same width constraint, fixed height so inner content scrolls */}
          <div className="flex flex-col w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 max-w-4xl shadow-xl rounded-lg overflow-hidden" style={{ height: '85vh' }}>
            {/* Header - no scroll, same width as card */}
            <div className="flex-shrink-0 bg-green-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">MP Details</h3>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDetailModal(false); }}
                  className="text-white hover:text-gray-200 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Scrollable content - inner scrollbar only */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white" data-modal-content="true">
            <div className="p-6">

              {/* MP Profile Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
                  <div className="flex-shrink-0">
                    <img
                      className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg"
                      src={selectedMp.profilePicture || '/src/assets/image/placeholder-mp.jpg'}
                      alt={selectedMp.name}
                      onError={(e) => {
                        e.target.src = '/src/assets/image/placeholder-mp.jpg';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-2xl font-bold text-gray-900 mb-2">
                          {getMpDisplayName(selectedMp) || 'Unknown MP'}
                        </h4>
                        {selectedMp.positionInCabinet && (
                          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 mb-2">
                            {selectedMp.positionInCabinet}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {isHistoricalParty(selectedMp.party) ? 'Unknown' : (selectedMp.party_full_name || selectedMp.party || 'No Party')}
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {selectedMp.constituency && selectedMp.constituency.replace(/^P\d+\s*/, '') || 'No Constituency'}
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {selectedMp.positionInParliament || 'MP'} • Term {selectedMp.parliament_term || 'Unknown'}
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              selectedMp.status === 'current' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedMp.status === 'current' ? 'Current' : 'Historical'} Status
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h5 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Information
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-sm text-gray-900">{selectedMp.email || 'Not available'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="text-sm text-gray-900">{selectedMp.phone || 'Not available'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Fax</p>
                      <p className="text-sm text-gray-900">{selectedMp.fax || 'Not available'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Seat Number</p>
                      <p className="text-sm text-gray-900">{selectedMp.seatNumber || 'Not available'}</p>
                    </div>
                  </div>
                </div>
                {selectedMp.address && (
                  <div className="mt-4 flex items-start space-x-3">
                    <svg className="w-5 h-5 text-gray-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Address</p>
                      <p className="text-sm text-gray-900">{selectedMp.address}</p>
                    </div>
                  </div>
                )}
                {selectedMp.profile_url && (
                  <div className="mt-4">
                    <a 
                      href={selectedMp.profile_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Parliament Profile
                    </a>
                  </div>
                )}
              </div>

              {/* Parliamentary History */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h5 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Parliamentary History
                </h5>
                <div className="space-y-4">
                  {(() => {
                    // Build terms list from parliamentary_history if available
                    let terms = [];
                    
                    if (selectedMp.parliamentary_history && selectedMp.parliamentary_history.length > 0) {
                      // Use parliamentary_history if available
                      terms = selectedMp.parliamentary_history.map(term => ({
                        parliament_term: term.parliament_term || `Term ${term.term_number || 'N/A'}`,
                        term_number: term.term_number || parseInt(term.parliament_term?.replace(/\D/g, '') || '0', 10),
                        status: term.status || 'historical',
                        party: term.party,
                        party_full_name: term.party_full_name,
                        constituency: term.constituency,
                        constituency_name: term.constituency_name
                      }));
                    } else {
                      // If no parliamentary_history, create entry from current MP data
                      if (selectedMp.parliament_term) {
                        terms = [{
                          parliament_term: selectedMp.parliament_term,
                          term_number: parseInt(selectedMp.parliament_term.replace(/\D/g, '') || '0', 10),
                          status: selectedMp.status || 'current',
                          party: selectedMp.party,
                          party_full_name: selectedMp.party_full_name,
                          constituency: selectedMp.constituency,
                          constituency_name: selectedMp.constituency_name
                        }];
                      }
                    }
                    
                    // Sort by term number descending (newest first)
                    terms.sort((a, b) => {
                      const termA = a.term_number || 0;
                      const termB = b.term_number || 0;
                      return termB - termA;
                    });
                    
                    return terms.length > 0 ? (
                      terms.map((term, index) => (
                        <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-base font-semibold text-gray-900">
                                {term.parliament_term}
                              </span>
                              {term.status === 'current' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Current
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Past
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Party: </span>
                              {isHistoricalParty(term.party) ? 'Unknown' : (term.party_full_name || term.party || 'N/A')}
                            </div>
                            <div>
                              <span className="font-medium">Constituency: </span>
                              {term.constituency_name || (term.constituency && term.constituency.replace(/^P\d+\s*/, '')) || 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No parliamentary history available</p>
                    );
                  })()}
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h5 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Additional Information
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">MP ID</p>
                    <p className="text-sm text-gray-900">{selectedMp.mp_id || 'Not available'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">State</p>
                    <p className="text-sm text-gray-900">{selectedMp.state || 'Not available'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Service</p>
                    <p className="text-sm text-gray-900">{selectedMp.service || 'Not available'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Constituency Code</p>
                    <p className="text-sm text-gray-900">{selectedMp.constituency_code || 'Not available'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDetailModal(false); }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedMp);
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                >
                  Edit MP
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Modal - portalled to body, body scroll lock, high z-index */}
      {showDeleteModal && mpToDelete && createPortal(
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 999999 }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 id="delete-modal-title" className="text-lg font-medium text-gray-900 text-center mb-2">Delete MP</h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Are you sure you want to delete <strong>{getMpDisplayName(mpToDelete)}</strong>?
              </p>
              <div className="text-xs text-gray-400 text-center mb-6">
                This action cannot be undone.
              </div>
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteModal(false); }}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMp(); }}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Status Change (Deactivate/Activate) Modal - portalled to body, body scroll lock, high z-index */}
      {showStatusChangeModal && mpToChangeStatus && createPortal(
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 999999 }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowStatusChangeModal(false); setMpToChangeStatus(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-change-modal-title"
        >
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="mt-3">
              <div className={`flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full ${
                mpToChangeStatus.status === 'current' ? 'bg-orange-100' : 'bg-green-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  mpToChangeStatus.status === 'current' ? 'text-orange-600' : 'text-green-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d={mpToChangeStatus.status === 'current' 
                      ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    } 
                  />
                </svg>
              </div>
              <h3 id="status-change-modal-title" className="text-lg font-medium text-gray-900 text-center mb-2">
                {mpToChangeStatus.status === 'current' ? 'Deactivate MP' : 'Activate MP'}
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Are you sure you want to {mpToChangeStatus.status === 'current' ? 'deactivate' : 'activate'}{' '}
                <strong>{getMpDisplayName(mpToChangeStatus)}</strong>?
              </p>
              <div className="text-xs text-gray-400 text-center mb-6">
                {mpToChangeStatus.status === 'current' 
                  ? 'This will mark the MP as no longer serving (e.g., due to new term, resignation, etc.)'
                  : 'This will mark the MP as currently serving'
                }
              </div>
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowStatusChangeModal(false); setMpToChangeStatus(null); }}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmStatusChange(); }}
                  disabled={loading}
                  className={`px-4 py-2 text-white rounded-md text-sm font-medium disabled:opacity-50 ${
                    mpToChangeStatus.status === 'current'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loading ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminMPManagement;
