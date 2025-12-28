import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api';

const AdminEduContentManagement = () => {
  // Remove useAdminAuth since we're already in an authenticated admin context
  
  const [activeTab, setActiveTab] = useState('content');
  const [content, setContent] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [contentStatusFilter, setContentStatusFilter] = useState('all'); // 'all', 'published', 'draft', 'archived'
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [quizFilter, setQuizFilter] = useState('all');
  const [attachmentsFilter, setAttachmentsFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt-desc');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Category options for dropdown
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'parliamentary_process', label: 'Parliamentary Process' },
    { value: 'government_structure', label: 'Government Structure' },
    { value: 'democracy_basics', label: 'Democracy Basics' },
    { value: 'civic_engagement', label: 'Civic Engagement' },
    { value: 'constitutional_law', label: 'Constitutional Law' },
    { value: 'elections', label: 'Elections' },
    { value: 'policy_making', label: 'Policy Making' },
    { value: 'public_administration', label: 'Public Administration' }
  ];

  // Quiz filter options
  const quizOptions = [
    { value: 'all', label: 'All Quiz Types' },
    { value: 'has', label: 'Has Quiz' },
    { value: 'none', label: 'No Quiz' }
  ];

  // Attachments filter options
  const attachmentsOptions = [
    { value: 'all', label: 'All Attachments' },
    { value: '0', label: 'No Files (0)' },
    { value: '1', label: '1 File' },
    { value: '2', label: '2 Files' }
  ];

  // Handle column sorting
  const handleSort = (column) => {
    if (sortBy === `${column}-asc`) {
      setSortBy(`${column}-desc`);
    } else {
      setSortBy(`${column}-asc`);
    }
    // Reset to page 1 when sorting changes
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
  const [editingContent, setEditingContent] = useState(null);
  const [viewingContent, setViewingContent] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedQuizFiles, setSelectedQuizFiles] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdContent, setCreatedContent] = useState(null);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error'); // 'error', 'success', 'warning'
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [contentToArchive, setContentToArchive] = useState(null);
  const [contentToDelete, setContentToDelete] = useState(null);
  const [contentToRestore, setContentToRestore] = useState(null);

  // Helper function to show alerts
  const showAlertMessage = (message, type = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setContentStatusFilter('all');
    setQuizFilter('all');
    setAttachmentsFilter('all');
    setCurrentPage(1);
  };

  // Form states
  const [contentForm, setContentForm] = useState({
    title: '',
    description: '',
    content: '',
    category: 'parliamentary_process',
    tags: '',
    themes: '',
    timeToRead: 5,
    difficulty: 'beginner',
    featured: false,
    // Quiz fields integrated into content form
    hasQuiz: false,
    quizTitle: '',
    quizDescription: '',
    quizTimeLimit: 30,
    quizPassingScore: 70,
    quizMaxAttempts: 3,
    quizQuestions: []
  });

  useEffect(() => {
    if (activeTab === 'content') {
      fetchContent();
      fetchQuizzes();
      fetchStats();
    }
  }, [activeTab, currentPage, contentStatusFilter, categoryFilter, quizFilter, attachmentsFilter, sortBy]);

  // Debounced search effect
  useEffect(() => {
    if (activeTab === 'content') {
      const timeoutId = setTimeout(() => {
        setCurrentPage(1); // Reset to first page when searching
        fetchContent();
      }, 500); // 500ms delay

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm]);

  // Initial load
  useEffect(() => {
    if (activeTab === 'content') {
      fetchContent();
      fetchQuizzes();
      fetchStats();
    }
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      
      // Parse sortBy and sortOrder from the combined format
      let sortField = 'createdAt';
      let sortDirection = 'desc';
      
      if (sortBy) {
        if (sortBy.endsWith('-asc')) {
          sortField = sortBy.replace('-asc', '');
          sortDirection = 'asc';
        } else if (sortBy.endsWith('-desc')) {
          sortField = sortBy.replace('-desc', '');
          sortDirection = 'desc';
        }
      }
      
      const params = {
        page: currentPage,
        limit: 10,
        sortBy: sortField,
        sortOrder: sortDirection
      };
      
      // Add filters if not 'all'
      if (contentStatusFilter !== 'all') {
        params.status = contentStatusFilter;
      }
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }
      if (quizFilter !== 'all') {
        params.hasQuiz = quizFilter === 'has';
      }
      if (attachmentsFilter !== 'all') {
        params.attachmentsCount = attachmentsFilter;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      
      console.log('Fetching content with params:', params);
      const response = await adminApi.getAllEduContent(params);
      console.log('Content response:', response.data.content);
      if (response.data.content && response.data.content.length > 0) {
        console.log('First content item quiz:', response.data.content[0].quiz);
        console.log('First content item attachments:', {
          contentAttachments: response.data.content[0].contentAttachments,
          quizAttachments: response.data.content[0].quizAttachments,
          attachments: response.data.content[0].attachments
        });
      }
      setContent(response.data.content || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching content:', error);
      // If it's a 404 or the endpoint doesn't exist, show empty state
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        setApiAvailable(false);
        setContent([]);
        setTotalPages(1);
      } else {
        // For other errors, still show empty state but log the error
        setContent([]);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getAllQuizzes();
      setQuizzes(response.data || []);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      // If it's a 404 or the endpoint doesn't exist, show empty state
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        setQuizzes([]);
      } else {
        setQuizzes([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await adminApi.getEduContentStats();
      setStats(response.data || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
      // If it's a 404 or the endpoint doesn't exist, show empty stats
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        setStats({});
      } else {
        setStats({});
      }
    }
  };

  const handleCreateContent = async (e) => {
    e.preventDefault();
    
    // Only proceed if we're on step 5 (preview & confirm)
    if (currentStep !== 5) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if admin token exists
      const adminToken = localStorage.getItem('adminToken');
      
      // Convert image to Base64 if selected
      let imageData = null;
      let imageContentType = null;
      let imageSize = 0;
      let imageOriginalName = null;
      
      if (selectedImage) {
        // Check file size (limit to 5MB for Base64 storage)
        if (selectedImage.size > 5 * 1024 * 1024) {
          showAlertMessage('Image too large. Please select an image smaller than 5MB.', 'warning');
          setLoading(false);
          return;
        }
        
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedImage);
        });
        imageContentType = selectedImage.type;
        imageSize = selectedImage.size;
        imageOriginalName = selectedImage.name;
        
      }
      
      // Format the form data for the API
      const formattedData = {
        title: contentForm.title || '',
        description: contentForm.description || '',
        content: contentForm.content || '',
        category: contentForm.category || 'parliamentary_process',
        tags: contentForm.tags || '',
        themes: contentForm.themes || '',
        timeToRead: contentForm.timeToRead || 5,
        difficulty: contentForm.difficulty || 'beginner',
        featured: Boolean(contentForm.featured),
        imageData,
        imageContentType,
        imageSize,
        imageOriginalName,
        hasQuiz: Boolean(contentForm.hasQuiz),
        quizTitle: contentForm.quizTitle || '',
        quizDescription: contentForm.quizDescription || '',
        quizTimeLimit: contentForm.quizTimeLimit || 30,
        quizPassingScore: contentForm.quizPassingScore || 70,
        quizMaxAttempts: contentForm.quizMaxAttempts || 3,
        quizQuestions: JSON.stringify(contentForm.quizQuestions || [])
      };
      
      
      const response = await adminApi.createEduContent(formattedData);
      const contentId = response.data.content._id;
      
      // Upload content attachments if any
      console.log('Selected content files for upload:', selectedFiles);
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            console.log('Uploading content attachment:', file.name, file.size, file.type);
            const fileFormData = new FormData();
            fileFormData.append('file', file);
            fileFormData.append('attachmentType', 'content');
            const uploadResponse = await adminApi.uploadEduContentAttachment(contentId, fileFormData);
            console.log('Content attachment upload response:', uploadResponse);
          } catch (attachmentError) {
            console.error('Error uploading content attachment:', attachmentError);
            showAlertMessage(`Content created but attachment ${file.name} upload failed. You can upload it later.`, 'warning');
          }
        }
      } else {
        console.log('No content files selected for upload');
      }

      // Upload quiz attachments if any
      console.log('Selected quiz files for upload:', selectedQuizFiles);
      if (selectedQuizFiles.length > 0) {
        for (const file of selectedQuizFiles) {
          try {
            console.log('Uploading quiz attachment:', file.name, file.size, file.type);
            const fileFormData = new FormData();
            fileFormData.append('file', file);
            fileFormData.append('attachmentType', 'quiz');
            const uploadResponse = await adminApi.uploadEduContentAttachment(contentId, fileFormData);
            console.log('Quiz attachment upload response:', uploadResponse);
          } catch (attachmentError) {
            console.error('Error uploading quiz attachment:', attachmentError);
            showAlertMessage(`Content created but quiz attachment ${file.name} upload failed. You can upload it later.`, 'warning');
          }
        }
      } else {
        console.log('No quiz files selected for upload');
      }
      
      // Show success message
      setCreatedContent(response.data.content);
      setShowSuccess(true);
      setShowCreateModal(false);
      resetContentForm();
      fetchContent();
      fetchStats();
    } catch (error) {
      console.error('Error creating content:', error);
      console.error('Error details:', error.response?.data);
      showAlertMessage('Error creating content. Please check if you are logged in as admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContent = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Format the form data for the API
      const formattedData = {
        title: contentForm.title || '',
        description: contentForm.description || '',
        content: contentForm.content || '',
        category: contentForm.category || 'parliamentary_process',
        tags: contentForm.tags || '',
        themes: contentForm.themes || '',
        timeToRead: contentForm.timeToRead || 5,
        difficulty: contentForm.difficulty || 'beginner',
        featured: Boolean(contentForm.featured)
      };
      
      
      await adminApi.updateEduContent(editingContent._id, formattedData);
      setShowCreateModal(false);
      setEditingContent(null);
      resetContentForm();
      fetchContent();
      
      // Show success message
      showAlertMessage('Content updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating content:', error);
      showAlertMessage('Error updating content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishContent = async (id) => {
    try {
      await adminApi.publishEduContent(id);
      fetchContent();
      fetchStats();
    } catch (error) {
      console.error('Error publishing content:', error);
    }
  };

  const handleArchiveContent = (content) => {
    setContentToArchive(content);
    setShowArchiveModal(true);
  };

  const confirmArchiveContent = async () => {
    try {
      await adminApi.archiveEduContent(contentToArchive._id);
      fetchContent();
      fetchStats();
      setShowArchiveModal(false);
      setContentToArchive(null);
      showAlertMessage('Content archived successfully!', 'success');
    } catch (error) {
      console.error('Error archiving content:', error);
      showAlertMessage('Failed to archive content. Please try again.', 'error');
    }
  };

  const handleDeleteContent = (content) => {
    setContentToDelete(content);
    setShowDeleteModal(true);
  };

  const confirmDeleteContent = async () => {
    try {
      await adminApi.deleteEduContent(contentToDelete._id);
        fetchContent();
        fetchStats();
      setShowDeleteModal(false);
      setContentToDelete(null);
      showAlertMessage('Content deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting content:', error);
      showAlertMessage('Failed to delete content. Please try again.', 'error');
    }
  };

  const handleRestoreContent = (content) => {
    setContentToRestore(content);
    setShowRestoreModal(true);
  };

  const confirmRestoreContent = async () => {
    try {
      await adminApi.publishEduContent(contentToRestore._id);
      fetchContent();
      fetchStats();
      setShowRestoreModal(false);
      setContentToRestore(null);
      showAlertMessage('Content restored successfully!', 'success');
    } catch (error) {
      console.error('Error restoring content:', error);
      showAlertMessage('Failed to restore content. Please try again.', 'error');
    }
  };


  const handleEditContent = (content) => {
    setEditingContent(content);
    setContentForm({
      title: content.title,
      description: content.description,
      content: content.content,
      category: content.category,
      tags: content.tags ? content.tags.join(', ') : '',
      themes: content.themes ? content.themes.join(', ') : '',
      timeToRead: content.timeToRead,
      difficulty: content.difficulty || 'beginner',
      featured: content.featured,
      hasQuiz: !!content.quiz,
      quizTitle: content.quiz?.title || '',
      quizDescription: content.quiz?.description || '',
      quizTimeLimit: content.quiz?.timeLimit || 30,
      quizPassingScore: content.quiz?.passingScore || 70,
      quizMaxAttempts: content.quiz?.maxAttempts || 3,
      quizQuestions: content.quiz?.questions || []
    });
    
    // Set image preview for existing image
    console.log('Editing content image data:', content.image);
    if (content.image) {
      // Handle different image data formats
      let imageData = null;
      if (content.image.data) {
        // New Base64 format
        imageData = content.image.data;
      } else if (content.image.url) {
        // Old Cloudinary format (fallback)
        imageData = content.image.url;
      }
      
      if (imageData) {
        console.log('Setting image preview with data:', imageData.substring(0, 50) + '...');
        setImagePreview(imageData);
        // Create a mock file object for the existing image
        const mockFile = {
          name: content.image.originalName || 'existing-image.jpg',
          size: content.image.size || 0,
          type: content.image.contentType || 'image/jpeg'
        };
        setSelectedImage(mockFile);
      } else {
        console.log('No valid image data found, clearing preview');
        setImagePreview(null);
        setSelectedImage(null);
      }
    } else {
      console.log('No image object found, clearing preview');
      setImagePreview(null);
      setSelectedImage(null);
    }
    
    setShowCreateModal(true);
  };

  const handleViewContent = (content) => {
    console.log('Viewing content:', content);
    console.log('Content attachments:', content.contentAttachments);
    console.log('Quiz attachments:', content.quizAttachments);
    console.log('Legacy attachments:', content.attachments);
    setViewingContent(content);
  };

  const handleSaveAsDraft = async () => {
    try {
      setLoading(true);
      
      // Convert image to Base64 if selected
      let imageData = null;
      let imageContentType = null;
      let imageSize = 0;
      let imageOriginalName = null;
      
      if (selectedImage) {
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedImage);
        });
        imageContentType = selectedImage.type;
        imageSize = selectedImage.size;
        imageOriginalName = selectedImage.name;
      }
      
      const formattedData = {
        title: contentForm.title || '',
        description: contentForm.description || '',
        content: contentForm.content || '',
        category: contentForm.category || 'parliamentary_process',
        tags: contentForm.tags || '',
        themes: contentForm.themes || '',
        timeToRead: contentForm.timeToRead || 5,
        difficulty: contentForm.difficulty || 'beginner',
        featured: Boolean(contentForm.featured),
        imageData,
        imageContentType,
        imageSize,
        imageOriginalName,
        hasQuiz: Boolean(contentForm.hasQuiz),
        quizTitle: contentForm.quizTitle || '',
        quizDescription: contentForm.quizDescription || '',
        quizTimeLimit: contentForm.quizTimeLimit || 30,
        quizPassingScore: contentForm.quizPassingScore || 70,
        quizMaxAttempts: contentForm.quizMaxAttempts || 3,
        quizQuestions: JSON.stringify(contentForm.quizQuestions || []),
        status: 'draft' // Save as draft
      };
      
      await adminApi.createEduContent(formattedData);
      setShowCreateModal(false);
      setShowCancelOptions(false);
      resetContentForm();
      fetchContent();
      fetchStats();
      
      showAlertMessage('Content saved as draft successfully!', 'success');
    } catch (error) {
      console.error('Error saving draft:', error);
      showAlertMessage('Error saving draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardConfirm(true);
  };

  const confirmDiscardChanges = () => {
    setShowCreateModal(false);
    setShowCancelOptions(false);
    setShowDiscardConfirm(false);
    resetContentForm();
  };

  const resetContentForm = () => {
    setContentForm({
      title: '',
      description: '',
      content: '',
      category: 'parliamentary_process',
      tags: '',
      themes: '',
      timeToRead: 5,
      difficulty: 'beginner',
      featured: false,
      hasQuiz: false,
      quizTitle: '',
      quizDescription: '',
      quizTimeLimit: 30,
      quizPassingScore: 70,
      quizMaxAttempts: 3,
      quizQuestions: []
    });
    setSelectedFiles([]);
    setSelectedQuizFiles([]);
    setSelectedImage(null);
    setImagePreview(null);
    setShowQuizForm(false);
    setCurrentStep(1);
    setFormErrors({});
    setShowSuccess(false);
    setCreatedContent(null);
    setShowCancelOptions(false);
  };

  const validateStep = (step) => {
    const errors = {};
    
    switch (step) {
      case 1:
        if (!contentForm.title?.trim()) errors.title = 'Title is required';
        if (!contentForm.description?.trim()) errors.description = 'Description is required';
        if (!contentForm.content?.trim()) errors.content = 'Content is required';
        break;
      case 2:
        if (!contentForm.tags?.trim()) errors.tags = 'At least one tag is recommended';
        if (!contentForm.themes?.trim()) errors.themes = 'At least one theme is recommended';
        if (!selectedImage) errors.image = 'Featured image is required';
        break;
      case 3:
        if (contentForm.hasQuiz) {
          if (!contentForm.quizTitle?.trim()) errors.quizTitle = 'Quiz title is required';
          if (!contentForm.quizQuestions || contentForm.quizQuestions.length === 0) errors.quizQuestions = 'At least one question is required';
          // Validate each quiz question has content
          if (contentForm.quizQuestions && contentForm.quizQuestions.length > 0) {
            contentForm.quizQuestions.forEach((question, index) => {
              if (!question.question?.trim()) {
                errors[`quizQuestion_${index}`] = `Question ${index + 1} content is required`;
              }
            });
          }
        }
        break;
      case 4:
        // Attachments are optional, no validation needed
        break;
      case 5:
        // Final preview step, no validation needed
        break;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    // Skip validation for step 4 (attachments are optional)
    if (currentStep === 4) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    } else if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const goToStep = (step) => {
    if (step <= currentStep || validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    console.log('Files selected:', files);
    
    // Validate file formats
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'video/mp4', 'audio/mpeg', 'audio/wav'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.mp4', '.mp3', '.wav'];
    
    const validFiles = files.filter(file => {
      const isValidType = allowedTypes.includes(file.type);
      const isValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      
      console.log(`File ${file.name}: type=${file.type}, isValidType=${isValidType}, isValidExtension=${isValidExtension}`);
      
      if (!isValidType || !isValidExtension) {
        showAlertMessage(`Invalid file format: ${file.name}. Allowed formats: ${allowedExtensions.join(', ')}`, 'warning');
        return false;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        showAlertMessage(`File too large: ${file.name}. Maximum size is 10MB.`, 'warning');
        return false;
      }
      
      return true;
    });
    
    console.log('Valid files:', validFiles);
    setSelectedFiles(prev => {
      const newFiles = [...prev, ...validFiles];
      console.log('Updated selectedFiles:', newFiles);
      return newFiles;
    });
  };

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

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuizFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedQuizFiles(prev => [...prev, ...files]);
  };

  const removeQuizFile = (index) => {
    setSelectedQuizFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file) => {
    const type = file?.type || file?.mimeType || '';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📈';
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const addQuizQuestion = () => {
    const newQuestion = {
      question: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: null, // Changed to null to use index-based selection
      explanation: '',
      points: 1
    };
    setContentForm({
      ...contentForm,
      quizQuestions: [...contentForm.quizQuestions, newQuestion]
    });
  };

  const updateQuizQuestion = (index, field, value) => {
    const updatedQuestions = [...contentForm.quizQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setContentForm({ ...contentForm, quizQuestions: updatedQuestions });
  };

  const removeQuizQuestion = (index) => {
    const updatedQuestions = contentForm.quizQuestions.filter((_, i) => i !== index);
    setContentForm({ ...contentForm, quizQuestions: updatedQuestions });
  };

  const clearCorrectAnswer = (index) => {
    updateQuizQuestion(index, 'correctAnswer', null);
  };

  const addQuizOption = (questionIndex) => {
    const updatedQuestions = [...contentForm.quizQuestions];
    updatedQuestions[questionIndex].options.push('');
    setContentForm({ ...contentForm, quizQuestions: updatedQuestions });
  };

  const removeQuizOption = (questionIndex, optionIndex) => {
    const updatedQuestions = [...contentForm.quizQuestions];
    const question = updatedQuestions[questionIndex];
    
    // If removing the correct answer option, clear it
    if (question.correctAnswer === optionIndex) {
      question.correctAnswer = null;
    } else if (question.correctAnswer !== null && question.correctAnswer > optionIndex) {
      // Adjust the correct answer index if it's after the removed option
      question.correctAnswer = question.correctAnswer - 1;
    }
    
    question.options.splice(optionIndex, 1);
    setContentForm({ ...contentForm, quizQuestions: updatedQuestions });
  };


  const getStatusBadge = (status) => {
    const statusClasses = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Content & Quizzes Sub-tabs */}
      <div className="bg-white/80 rounded-lg shadow-sm border border-green-200/60 mb-6">
        <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            <div>
                <h2 className="text-xl font-bold text-white">Content Management</h2>
                <p className="text-green-100 mt-1">Manage educational content, resources, and materials</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 border border-white/30 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Content</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* API Status Notice */}
        {!apiAvailable && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Backend API Not Available
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    The educational content management backend is not running yet. 
                    The interface is ready, but you'll need to start the backend server to create and manage content.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">📚</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Content</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalContent || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">✅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Published</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.publishedContent || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">📝</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Drafts</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.draftContent || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">📦</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Archived</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.archivedContent || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
             {/* Content */}
              <div className="space-y-6">
                {/* Content List */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Educational Content</h3>
                      
                      {/* Status Filter Tabs */}
                      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setContentStatusFilter('all')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            contentStatusFilter === 'all'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          All ({stats.totalContent || 0})
                        </button>
                        <button
                          onClick={() => setContentStatusFilter('published')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            contentStatusFilter === 'published'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Published ({stats.publishedContent || 0})
                        </button>
                        <button
                          onClick={() => setContentStatusFilter('draft')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            contentStatusFilter === 'draft'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Drafts ({stats.draftContent || 0})
                        </button>
                        <button
                          onClick={() => setContentStatusFilter('archived')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            contentStatusFilter === 'archived'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Archived ({stats.archivedContent || 0})
                        </button>
                      </div>
                    </div>

                    {/* Search and Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      {/* Search Input */}
                      <div className="flex-1 min-w-0">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            placeholder="Search content by title, description, or content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                              <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Category Filter Dropdown */}
                      <div className="w-full sm:w-48">
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        >
                          {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quiz Filter Dropdown */}
                      <div className="w-full sm:w-40">
                        <select
                          value={quizFilter}
                          onChange={(e) => setQuizFilter(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        >
                          {quizOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Attachments Filter Dropdown */}
                      <div className="w-full sm:w-40">
                        <select
                          value={attachmentsFilter}
                          onChange={(e) => setAttachmentsFilter(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        >
                          {attachmentsOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>


                      {/* Clear Filters Button */}
                      {(searchTerm || categoryFilter !== 'all' || contentStatusFilter !== 'all' || quizFilter !== 'all' || attachmentsFilter !== 'all') && (
                        <button
                          onClick={clearFilters}
                          className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Clear Filters
                        </button>
                      )}
                    </div>

                    {/* Active Filters Display */}
                    {(searchTerm || categoryFilter !== 'all' || contentStatusFilter !== 'all' || quizFilter !== 'all' || attachmentsFilter !== 'all') && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-sm text-gray-500">Active filters:</span>
                        {searchTerm && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Search: "{searchTerm}"
                            <button
                              onClick={() => setSearchTerm('')}
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                            >
                              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                                <path d="m0 0 2 2m0 0 2 2m-2-2 2-2m-2 2-2 2" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {categoryFilter !== 'all' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Category: {categoryOptions.find(opt => opt.value === categoryFilter)?.label}
                            <button
                              onClick={() => setCategoryFilter('all')}
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-500"
                            >
                              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                                <path d="m0 0 2 2m0 0 2 2m-2-2 2-2m-2 2-2 2" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {quizFilter !== 'all' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Quiz: {quizOptions.find(opt => opt.value === quizFilter)?.label}
                            <button
                              onClick={() => setQuizFilter('all')}
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-orange-400 hover:bg-orange-200 hover:text-orange-500"
                            >
                              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                                <path d="m0 0 2 2m0 0 2 2m-2-2 2-2m-2 2-2 2" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {attachmentsFilter !== 'all' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            Attachments: {attachmentsOptions.find(opt => opt.value === attachmentsFilter)?.label}
                            <button
                              onClick={() => setAttachmentsFilter('all')}
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500"
                            >
                              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                                <path d="m0 0 2 2m0 0 2 2m-2-2 2-2m-2 2-2 2" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {contentStatusFilter !== 'all' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Status: {contentStatusFilter.charAt(0).toUpperCase() + contentStatusFilter.slice(1)}
                            <button
                              onClick={() => setContentStatusFilter('all')}
                              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-500"
                            >
                              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                                <path d="m0 0 2 2m0 0 2 2m-2-2 2-2m-2 2-2 2" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('title')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Title</span>
                              {getSortIcon('title')}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('category')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Category</span>
                              {getSortIcon('category')}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Status</span>
                              {getSortIcon('status')}
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quiz
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Attachments
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('createdAt')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Created</span>
                              {getSortIcon('createdAt')}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('updatedAt')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Last Updated</span>
                              {getSortIcon('updatedAt')}
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {content.map((item) => (
                          <tr key={item._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 w-80">
                              <div className="flex items-start">
                                <div className="w-full">
                                  <div className="text-sm font-medium text-gray-900 break-words">
                                    {item.title}
                                  </div>
                                  <div className="text-sm text-gray-500 break-words mt-1">
                                    {item.description}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(item.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.quiz && (item.quiz.title || item.quiz.questions?.length > 0) ? (
                                <span className="text-green-600">✓ Has Quiz</span>
                              ) : (
                                <span className="text-gray-400">No Quiz</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(() => {
                                const contentAttachments = item.contentAttachments || [];
                                const quizAttachments = item.quizAttachments || [];
                                const legacyAttachments = item.attachments || [];
                                const totalAttachments = contentAttachments.length + quizAttachments.length + legacyAttachments.length;
                                
                                return totalAttachments > 0 ? (
                                  <span className="text-blue-600">{totalAttachments} files</span>
                                ) : (
                                  <span className="text-gray-400">No files</span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex flex-col">
                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex flex-col">
                                <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(item.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleViewContent(item)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleEditContent(item)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Edit
                                </button>
                                {item.status === 'draft' && (
                                  <button
                                    onClick={() => handlePublishContent(item._id)}
                                    className="text-green-600 hover:text-green-900"
                                  >
                                    Publish
                                  </button>
                                )}
                                {item.status === 'published' && (
                                  <button
                                    onClick={() => handleArchiveContent(item)}
                                    className="text-yellow-600 hover:text-yellow-900"
                                  >
                                    Archive
                                  </button>
                                )}
                                {item.status === 'archived' && (
                                <button
                                    onClick={() => handleRestoreContent(item)}
                                    className="text-green-600 hover:text-green-900"
                                  >
                                    Restore
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteContent(item)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {content.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {contentStatusFilter === 'all' ? 'No content found' : 
                           contentStatusFilter === 'published' ? 'No published content' :
                           contentStatusFilter === 'draft' ? 'No draft content' :
                           'No archived content'}
                        </h3>
                        <p className="text-gray-500">
                          {contentStatusFilter === 'all' ? 'Get started by creating your first educational content.' :
                           contentStatusFilter === 'published' ? 'Publish some content to see it here.' :
                           contentStatusFilter === 'draft' ? 'Create some drafts to see them here.' :
                           'Archive some content to see it here.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pagination */}
                {content.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing page {currentPage} of {totalPages} (Total items: {content.length})
                      </div>
                    <nav className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                        {(() => {
                          const maxVisiblePages = 5;
                          const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                          const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                          const pages = [];
                          
                          // Add first page and ellipsis if needed
                          if (startPage > 1) {
                            pages.push(
                        <button
                                key={1}
                                onClick={() => setCurrentPage(1)}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                1
                              </button>
                            );
                            if (startPage > 2) {
                              pages.push(
                                <span key="ellipsis1" className="px-3 py-2 text-sm text-gray-500">
                                  ...
                                </span>
                              );
                            }
                          }
                          
                          // Add visible page numbers
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                                  currentPage === i
                              ? 'bg-green-500 text-white'
                              : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                                {i}
                        </button>
                            );
                          }
                          
                          // Add ellipsis and last page if needed
                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) {
                              pages.push(
                                <span key="ellipsis2" className="px-3 py-2 text-sm text-gray-500">
                                  ...
                                </span>
                              );
                            }
                            pages.push(
                              <button
                                key={totalPages}
                                onClick={() => setCurrentPage(totalPages)}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                {totalPages}
                              </button>
                            );
                          }
                          
                          return pages;
                        })()}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
              </div>
            )}
                        </div>

          </>
        )}
      </div>

      {/* Create/Edit Content Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-6 border w-[1280px] max-w-[95vw] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingContent ? 'Edit Content' : 'Create New Content'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingContent(null);
                    resetContentForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step Navigation */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700">Step {currentStep} of 5</h4>
                  <span className="text-sm text-gray-500">
                    {currentStep === 1 && 'Basic Information'}
                    {currentStep === 2 && 'Tags & Settings'}
                    {currentStep === 3 && 'Quiz (Optional)'}
                    {currentStep === 4 && 'Attachments (Optional)'}
                    {currentStep === 5 && 'Preview & Confirm'}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => goToStep(step)}
                      className={`flex-1 h-2 rounded-full transition-colors ${
                        step <= currentStep
                          ? 'bg-green-600'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              <form onSubmit={editingContent ? handleUpdateContent : handleCreateContent} className="space-y-6">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    {/* Error Messages */}
                    {(formErrors.title || formErrors.description || formErrors.content) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex">
                          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h3 className="text-sm font-medium text-red-800">Please fill in all required fields:</h3>
                            <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                              {formErrors.title && <li>{formErrors.title}</li>}
                              {formErrors.description && <li>{formErrors.description}</li>}
                              {formErrors.content && <li>{formErrors.content}</li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-blue-900 mb-2">Basic Information</h3>
                      <p className="text-sm text-blue-700">Start by providing the essential details about your educational content.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contentForm.title}
                          onChange={(e) => setContentForm({...contentForm, title: e.target.value})}
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                            formErrors.title ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Enter a compelling title for your content"
                          required
                        />
                        {formErrors.title && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={contentForm.category}
                          onChange={(e) => setContentForm({...contentForm, category: e.target.value})}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="parliamentary_process">Parliamentary Process</option>
                          <option value="democracy">Democracy</option>
                          <option value="civic_education">Civic Education</option>
                          <option value="government_structure">Government Structure</option>
                          <option value="elections">Elections</option>
                          <option value="constitution">Constitution</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={contentForm.description}
                        onChange={(e) => setContentForm({...contentForm, description: e.target.value})}
                        rows={3}
                        className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                          formErrors.description ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Brief description of what this content covers"
                        required
                      />
                      {formErrors.description && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Content <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={contentForm.content}
                        onChange={(e) => setContentForm({...contentForm, content: e.target.value})}
                        rows={8}
                        className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                          formErrors.content ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Write your educational content here. You can use multiple paragraphs to organize your information."
                        required
                      />
                      {formErrors.content && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Tags & Settings */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {/* Error Messages */}
                    {(formErrors.tags || formErrors.themes || formErrors.image) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex">
                          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h3 className="text-sm font-medium text-red-800">Please complete all required fields:</h3>
                            <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                              {formErrors.image && <li>{formErrors.image}</li>}
                              {formErrors.tags && <li>{formErrors.tags}</li>}
                              {formErrors.themes && <li>{formErrors.themes}</li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-green-900 mb-2">Tags & Settings</h3>
                      <p className="text-sm text-green-700">Add tags and configure settings to help users find and understand your content.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Tags <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contentForm.tags}
                          onChange={(e) => setContentForm({...contentForm, tags: e.target.value})}
                          placeholder="e.g., parliament, democracy, voting"
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                            formErrors.tags ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {formErrors.tags && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.tags}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">Separate multiple tags with commas</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Themes <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contentForm.themes}
                          onChange={(e) => setContentForm({...contentForm, themes: e.target.value})}
                          placeholder="e.g., Parliamentary System, Democratic Governance, Legislative Process"
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                            formErrors.themes ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {formErrors.themes && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.themes}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">These will be displayed as theme badges on the user side</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Time to Read (minutes)</label>
                        <input
                          type="number"
                          value={contentForm.timeToRead}
                          onChange={(e) => setContentForm({...contentForm, timeToRead: parseInt(e.target.value) || 5})}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                          min="1"
                        />
                        <p className="mt-1 text-xs text-gray-500">Estimated reading time for users</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Difficulty Level</label>
                        <select
                          value={contentForm.difficulty}
                          onChange={(e) => setContentForm({...contentForm, difficulty: e.target.value})}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Help users choose appropriate content</p>
                      </div>
                    </div>

                    {/* Featured Content Checkbox */}
                    <div className="mt-6">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="featured"
                          checked={contentForm.featured}
                          onChange={(e) => setContentForm({...contentForm, featured: e.target.checked})}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="featured" className="ml-2 block text-sm text-gray-900">
                          Mark as featured content
                        </label>
                  </div>
                      <p className="mt-1 text-xs text-gray-500">Featured content will be highlighted on the homepage</p>
                    </div>

                    {/* Featured Image Upload */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700">Featured Image (Required)</label>
                      <p className="mt-1 text-sm text-gray-500">Add a cover image for this content</p>
                      <div className="mt-2">
                    <input
                      type="file"
                          onChange={handleImageSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                          accept=".jpg,.jpeg,.png,.gif"
                        />
                        <p className="mt-1 text-xs text-gray-500">Supported: JPG, PNG, GIF (Max 5MB)</p>
                        {formErrors.image && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.image}</p>
                        )}
                        
                        {imagePreview && (
                          <div className="mt-3">
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="h-32 w-32 object-cover rounded-lg border border-gray-200"
                            />
                              <button
                                type="button"
                              onClick={() => {
                                setSelectedImage(null);
                                setImagePreview(null);
                              }}
                              className="mt-2 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove Image
                              </button>
                      </div>
                    )}
                  </div>
                </div>
                  </div>
                )}



                

                {/* Step 3: Quiz Section */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Error Messages */}
                    {(formErrors.quizTitle || formErrors.quizQuestions || Object.keys(formErrors).some(key => key.startsWith('quizQuestion_'))) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex">
                          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h3 className="text-sm font-medium text-red-800">Please complete all quiz fields:</h3>
                            <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                              {formErrors.quizTitle && <li>{formErrors.quizTitle}</li>}
                              {formErrors.quizQuestions && <li>{formErrors.quizQuestions}</li>}
                              {Object.keys(formErrors).filter(key => key.startsWith('quizQuestion_')).map(key => (
                                <li key={key}>{formErrors[key]}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-purple-900 mb-2">Quiz (Optional)</h3>
                      <p className="text-sm text-purple-700">Add a quiz to test users' understanding of the content.</p>
                    </div>

                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="hasQuiz"
                        checked={contentForm.hasQuiz}
                        onChange={(e) => {
                          setContentForm({...contentForm, hasQuiz: e.target.checked});
                          setShowQuizForm(e.target.checked);
                        }}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasQuiz" className="ml-2 block text-sm font-medium text-gray-900">
                        Include Quiz
                      </label>
                    </div>

                    {contentForm.hasQuiz && (
                    <div className="space-y-6 bg-gray-50 p-6 rounded-lg">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Quiz Title</label>
                          <input
                            type="text"
                            value={contentForm.quizTitle}
                            onChange={(e) => {
                              setContentForm({...contentForm, quizTitle: e.target.value});
                            }}
                            className={`mt-1 block w-full rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                              formErrors.quizTitle ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="Enter quiz title"
                          />
                          {formErrors.quizTitle && (
                            <p className="mt-1 text-sm text-red-600">{formErrors.quizTitle}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Quiz Description</label>
                          <input
                            type="text"
                            value={contentForm.quizDescription}
                            onChange={(e) => setContentForm({...contentForm, quizDescription: e.target.value})}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            placeholder="Enter quiz description"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Time Limit (minutes)</label>
                          <input
                            type="number"
                            value={contentForm.quizTimeLimit}
                            onChange={(e) => setContentForm({...contentForm, quizTimeLimit: parseInt(e.target.value) || 30})}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Passing Score (%)</label>
                          <input
                            type="number"
                            value={contentForm.quizPassingScore}
                            onChange={(e) => setContentForm({...contentForm, quizPassingScore: parseInt(e.target.value) || 70})}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            min="1"
                            max="100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
                          <input
                            type="number"
                            value={contentForm.quizMaxAttempts}
                            onChange={(e) => setContentForm({...contentForm, quizMaxAttempts: parseInt(e.target.value) || 3})}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            min="1"
                          />
                        </div>
                      </div>

                      {/* Quiz Questions */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-sm font-medium text-gray-700">Quiz Questions</label>
                          <button
                            type="button"
                            onClick={addQuizQuestion}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                          >
                            Add Question
                          </button>
                        </div>
                        {formErrors.quizQuestions && (
                          <p className="mb-3 text-sm text-red-600">{formErrors.quizQuestions}</p>
                        )}

                        {contentForm.quizQuestions.map((question, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-6 mb-4 bg-white">
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="text-lg font-medium text-gray-700">Question {index + 1}</h4>
                              <button
                                type="button"
                                onClick={() => removeQuizQuestion(index)}
                                className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-300 rounded hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Question</label>
                                <textarea
                                  value={question.question}
                                  onChange={(e) => {
                                    updateQuizQuestion(index, 'question', e.target.value);
                                  }}
                                  rows={2}
                                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 ${
                                    formErrors[`quizQuestion_${index}`] ? 'border-red-300' : 'border-gray-300'
                                  }`}
                                  placeholder="Enter your question"
                                />
                                {formErrors[`quizQuestion_${index}`] && (
                                  <p className="mt-1 text-sm text-red-600">{formErrors[`quizQuestion_${index}`]}</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700">Question Type</label>
                                <select
                                  value={question.type}
                                  onChange={(e) => updateQuizQuestion(index, 'type', e.target.value)}
                                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                >
                                  <option value="multiple_choice">Multiple Choice</option>
                                  <option value="true_false">True/False</option>
                                  <option value="short_answer">Short Answer</option>
                                </select>
                              </div>

                              {question.type === 'multiple_choice' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                                  <p className="text-sm text-gray-500 mb-3">Click on an option to mark it as the correct answer</p>
                                  <div className="space-y-3">
                                    {question.options.map((option, optIndex) => (
                                      <div 
                                        key={optIndex} 
                                        className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                                          question.correctAnswer === optIndex 
                                            ? 'border-green-500 bg-green-50 shadow-md' 
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                        onClick={() => {
                                          if (option.trim()) {
                                            updateQuizQuestion(index, 'correctAnswer', optIndex);
                                          }
                                        }}
                                      >
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                          question.correctAnswer === optIndex 
                                            ? 'border-green-500 bg-green-500' 
                                            : 'border-gray-300'
                                        }`}>
                                          {question.correctAnswer === optIndex && (
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2">
                                            <span className={`text-sm font-medium ${
                                              question.correctAnswer === optIndex ? 'text-green-700' : 'text-gray-500'
                                            }`}>
                                              {String.fromCharCode(65 + optIndex)}.
                                            </span>
                                        <input
                                          type="text"
                                          value={option}
                                          onChange={(e) => {
                                            const newOptions = [...question.options];
                                            newOptions[optIndex] = e.target.value;
                                            updateQuizQuestion(index, 'options', newOptions);
                                          }}
                                              className={`flex-1 border-0 bg-transparent focus:ring-0 focus:outline-none ${
                                                question.correctAnswer === optIndex ? 'text-green-700' : 'text-gray-900'
                                              }`}
                                          placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {question.correctAnswer === optIndex && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                              Correct Answer
                                            </span>
                                          )}
                                          {question.options.length > 2 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                removeQuizOption(index, optIndex);
                                              }}
                                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                              title="Remove option"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    
                                    <div className="flex items-center justify-between pt-2">
                                      <button
                                        type="button"
                                        onClick={() => addQuizOption(index)}
                                        className="px-3 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                                      >
                                        + Add Option
                                      </button>
                                      
                                      {question.correctAnswer !== null && (
                                        <button
                                          type="button"
                                          onClick={() => clearCorrectAnswer(index)}
                                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                                        >
                                          Clear Selection
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {question.correctAnswer !== null && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                      <div className="flex items-center">
                                        <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium text-green-800">
                                          Correct answer selected: "{question.options[question.correctAnswer]}" (Option {String.fromCharCode(65 + question.correctAnswer)})
                                        </span>
                                  </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {question.type === 'true_false' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                                  <p className="text-sm text-gray-500 mb-3">Click on True or False to select the correct answer</p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div 
                                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                                        question.correctAnswer === 'true' 
                                          ? 'border-green-500 bg-green-50 shadow-md' 
                                          : 'border-gray-200 hover:border-gray-300'
                                      }`}
                                      onClick={() => updateQuizQuestion(index, 'correctAnswer', 'true')}
                                    >
                                      <div className="flex items-center justify-center space-x-3">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                          question.correctAnswer === 'true' 
                                            ? 'border-green-500 bg-green-500' 
                                            : 'border-gray-300'
                                        }`}>
                                          {question.correctAnswer === 'true' && (
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                  </div>
                                        <span className={`text-lg font-medium ${
                                          question.correctAnswer === 'true' ? 'text-green-700' : 'text-gray-700'
                                        }`}>
                                          True
                                        </span>
                                        {question.correctAnswer === 'true' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Correct
                                          </span>
                                        )}
                                </div>
                                    </div>
                                    
                                    <div 
                                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                                        question.correctAnswer === 'false' 
                                          ? 'border-green-500 bg-green-50 shadow-md' 
                                          : 'border-gray-200 hover:border-gray-300'
                                      }`}
                                      onClick={() => updateQuizQuestion(index, 'correctAnswer', 'false')}
                                    >
                                      <div className="flex items-center justify-center space-x-3">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                          question.correctAnswer === 'false' 
                                            ? 'border-green-500 bg-green-500' 
                                            : 'border-gray-300'
                                        }`}>
                                          {question.correctAnswer === 'false' && (
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                        <span className={`text-lg font-medium ${
                                          question.correctAnswer === 'false' ? 'text-green-700' : 'text-gray-700'
                                        }`}>
                                          False
                                        </span>
                                        {question.correctAnswer === 'false' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Correct
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {question.correctAnswer && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                      <div className="flex items-center">
                                        <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium text-green-800">
                                          Correct answer selected: {question.correctAnswer === 'true' ? 'True' : 'False'}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {question.type === 'short_answer' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                                  <p className="text-sm text-gray-500 mb-3">Enter the expected answer for this short answer question</p>
                                  <div className="relative">
                                  <input
                                    type="text"
                                    value={question.correctAnswer}
                                    onChange={(e) => updateQuizQuestion(index, 'correctAnswer', e.target.value)}
                                      className={`block w-full border-2 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors ${
                                        question.correctAnswer 
                                          ? 'border-green-300 bg-green-50' 
                                          : 'border-gray-300'
                                      }`}
                                    placeholder="Enter the correct answer"
                                  />
                                    {question.correctAnswer && (
                                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {question.correctAnswer && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                      <div className="flex items-center">
                                        <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium text-green-800">
                                          Correct answer set: "{question.correctAnswer}"
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Points</label>
                                  <input
                                    type="number"
                                    value={question.points}
                                    onChange={(e) => updateQuizQuestion(index, 'points', parseInt(e.target.value) || 1)}
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                    min="1"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Explanation (optional)</label>
                                  <input
                                    type="text"
                                    value={question.explanation}
                                    onChange={(e) => updateQuizQuestion(index, 'explanation', e.target.value)}
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                    placeholder="Explain why this is correct"
                                  />
                                </div>
                              </div>

                            </div>
                          </div>
                        ))}

                        {contentForm.quizQuestions.length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            <p>No questions added yet. Click "Add Question" to get started.</p>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                  </div>
                )}

                {/* Step 4: Attachments (Optional) */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-blue-900 mb-2">Attachments (Optional)</h3>
                      <p className="text-sm text-blue-700">Add additional files to support your content. These are completely optional.</p>
                    </div>

                    {/* Content Attachments */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">📄 Content Attachments</h4>
                      <p className="text-sm text-gray-600 mb-4">Files that support the main content (documents, images, videos, etc.)</p>
                      <div className="mt-1">
                        <input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.mp3,.wav"
                        />
                        <p className="mt-1 text-xs text-gray-500">Supported: Images, Videos, Audio, PDF, Office documents</p>
                        
                        {selectedFiles.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm font-medium text-gray-700">Selected Content Files:</p>
                            <div className="grid grid-cols-1 gap-2">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg">{getFileIcon(file)}</span>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const url = URL.createObjectURL(file);
                                        window.open(url, '_blank');
                                      }}
                                      className="text-blue-600 hover:text-blue-800 p-1 text-xs"
                                      title="Preview file"
                                    >
                                      👁️ Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeFile(index)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      </div>

                      {/* Quiz Attachments */}
                    {contentForm.hasQuiz && contentForm.quizQuestions.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">🧩 Quiz Attachments</h4>
                        <p className="text-sm text-gray-600 mb-4">Files specifically for quiz questions (images, documents, etc.)</p>
                        <div className="mt-1">
                          <input
                            type="file"
                            multiple
                            onChange={handleQuizFileSelect}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.mp3,.wav"
                          />
                          <p className="mt-1 text-xs text-gray-500">Additional files for quiz questions</p>
                          
                          {selectedQuizFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-sm font-medium text-gray-700">Selected Quiz Files:</p>
                              <div className="grid grid-cols-1 gap-2">
                                {selectedQuizFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-lg">{getFileIcon(file)}</span>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const url = URL.createObjectURL(file);
                                          window.open(url, '_blank');
                                        }}
                                        className="text-blue-600 hover:text-blue-800 p-1 text-xs"
                                        title="Preview file"
                                      >
                                        👁️ Preview
                                      </button>
                                    <button
                                      type="button"
                                      onClick={() => removeQuizFile(index)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                    >
                                      ✕
                                    </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                  </div>
                )}

                {/* Step 5: Preview & Confirm */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-green-900 mb-2">Preview & Confirm</h3>
                      <p className="text-sm text-green-700">This is exactly how your content will appear to users. Review everything before publishing.</p>
                    </div>

                    {/* User-Side Preview */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">User-Side Preview</h4>
                      
                      {/* Simulate the actual user interface */}
                      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                        {/* Image Section */}
                        <div className="relative h-48 bg-gradient-to-br from-emerald-100 to-teal-100 overflow-hidden">
                          {imagePreview ? (
                            <img 
                              src={imagePreview} 
                              alt={contentForm.title || 'Educational Resource'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-red-100">
                              <p className="text-red-600">No preview image</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Content Section */}
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {contentForm.category?.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">{contentForm.timeToRead} min read</span>
                          </div>
                          
                          <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                            {contentForm.title || 'No title provided'}
                          </h3>
                          
                          <p className="text-gray-600 mb-4 line-clamp-3">
                            {contentForm.description || 'No description provided'}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">Difficulty:</span>
                              <span className="text-sm font-medium text-gray-900 capitalize">{contentForm.difficulty}</span>
                            </div>
                            {contentForm.featured && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                ⭐ Featured
                              </span>
                            )}
                          </div>
                          
                          {contentForm.tags && (
                            <div className="mt-3">
                              <div className="flex flex-wrap gap-1">
                                {contentForm.tags.split(',').map((tag, index) => (
                                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    #{tag.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content Details Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Content Details</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Title</label>
                          <p className="text-gray-900">{contentForm.title || 'No title provided'}</p>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-500">Description</label>
                          <p className="text-gray-900">{contentForm.description || 'No description provided'}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Category</label>
                            <p className="text-gray-900 capitalize">{contentForm.category?.replace('_', ' ')}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Difficulty</label>
                            <p className="text-gray-900 capitalize">{contentForm.difficulty}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Time to Read</label>
                            <p className="text-gray-900">{contentForm.timeToRead} minutes</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Featured</label>
                            <p className="text-gray-900">{contentForm.featured ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                        
                        {contentForm.tags && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Tags</label>
                            <p className="text-gray-900">{contentForm.tags}</p>
                          </div>
                        )}
                        
                        {contentForm.themes && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Themes</label>
                            <p className="text-gray-900">{contentForm.themes}</p>
                          </div>
                        )}
                        
                        {contentForm.hasQuiz && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Quiz</label>
                            <p className="text-gray-900">{contentForm.quizTitle} ({contentForm.quizQuestions.length} questions)</p>
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium text-gray-500">Attachments</label>
                          <p className="text-gray-900">
                            {selectedFiles.length} content files, {selectedQuizFiles.length} quiz files
                          </p>
                      </div>
                    </div>
                    </div>

                    {/* Quiz Preview Section */}
                    {contentForm.hasQuiz && contentForm.quizQuestions.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Quiz Preview</h4>
                        
                        {contentForm.quizQuestions.map((question, questionIndex) => (
                          <div key={questionIndex} className="mb-6 p-4 border border-gray-200 rounded-lg">
                            <h5 className="text-md font-semibold text-gray-900 mb-3">
                              Question {questionIndex + 1}: {question.question}
                            </h5>
                            
                            {question.type === 'multiple_choice' && (
                              <div className="space-y-2">
                                {question.options.map((option, optionIndex) => (
                                  <div 
                                    key={optionIndex}
                                    className={`flex items-center p-3 border-2 rounded-lg ${
                                      question.correctAnswer === optionIndex 
                                        ? 'border-green-500 bg-green-50' 
                                        : 'border-gray-200'
                                    }`}
                                  >
                                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      question.correctAnswer === optionIndex 
                                        ? 'border-green-500 bg-green-500' 
                                        : 'border-gray-300'
                                    }`}>
                                      {question.correctAnswer === optionIndex && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="ml-3">
                                      <span className="text-sm font-medium text-gray-500">
                                        {String.fromCharCode(65 + optionIndex)}.
                                      </span>
                                      <span className={`ml-2 ${
                                        question.correctAnswer === optionIndex ? 'text-green-700' : 'text-gray-900'
                                      }`}>
                                        {option}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {question.type === 'true_false' && (
                              <div className="space-y-2">
                                <div className={`flex items-center p-3 border-2 rounded-lg ${
                                  question.correctAnswer === 'true' 
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-gray-200'
                                }`}>
                                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    question.correctAnswer === 'true' 
                                      ? 'border-green-500 bg-green-500' 
                                      : 'border-gray-300'
                                  }`}>
                                    {question.correctAnswer === 'true' && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="ml-3 text-gray-900">True</span>
                                </div>
                                <div className={`flex items-center p-3 border-2 rounded-lg ${
                                  question.correctAnswer === 'false' 
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-gray-200'
                                }`}>
                                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    question.correctAnswer === 'false' 
                                      ? 'border-green-500 bg-green-500' 
                                      : 'border-gray-300'
                                  }`}>
                                    {question.correctAnswer === 'false' && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="ml-3 text-gray-900">False</span>
                                </div>
                              </div>
                            )}

                            {question.type === 'short_answer' && (
                              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <span className="text-sm font-medium text-green-800">
                                  Correct Answer: "{question.correctAnswer}"
                                </span>
                              </div>
                            )}

                            {question.explanation && (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h6 className="text-sm font-medium text-blue-900 mb-1">Explanation:</h6>
                                <p className="text-sm text-blue-800">{question.explanation}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attachments Preview Section */}
                    {(selectedFiles.length > 0 || selectedQuizFiles.length > 0) && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Attachments Preview</h4>
                        
                        {selectedFiles.length > 0 && (
                          <div className="mb-6">
                            <h5 className="text-lg font-semibold text-gray-900 mb-4">📎 Content Attachments</h5>
                            <div className="space-y-4">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                  <span className="text-2xl">{getFileIcon(file)}</span>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                    <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Create a preview URL for the file
                                        const url = URL.createObjectURL(file);
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                      View
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedQuizFiles.length > 0 && (
                          <div>
                            <h5 className="text-lg font-semibold text-gray-900 mb-4">🧩 Quiz Attachments</h5>
                            <div className="space-y-4">
                              {selectedQuizFiles.map((file, index) => (
                                <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                  <span className="text-2xl">{getFileIcon(file)}</span>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                    <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Create a preview URL for the file
                                        const url = URL.createObjectURL(file);
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                      View
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Step Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <div className="flex space-x-3">
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      >
                        ← Previous
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCancelOptions(true)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div className="flex space-x-3">
                    {currentStep < 4 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          nextStep();
                        }}
                        className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                      >
                        Next →
                      </button>
                    ) : currentStep === 4 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          nextStep();
                        }}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                      >
                        Preview Content →
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : (editingContent ? 'Update Content' : 'Confirm & Create Content')}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-6 border w-[500px] max-w-[95vw] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Content Created Successfully!</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your content "{createdContent?.title}" has been created and is now available on the user side.
                </p>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-green-800">
                      The content is now live and visible to users
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-3 justify-center">
                  <button
                    onClick={() => {
                      setShowSuccess(false);
                      setCreatedContent(null);
                    }}
                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    Back to Content Management
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Options Modal */}
      {showCancelOptions && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-6 border w-[400px] max-w-[95vw] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {editingContent ? 'Cancel Content Editing' : 'Cancel Content Creation'}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {editingContent 
                    ? 'What would you like to do with your current changes?' 
                    : 'What would you like to do with your current progress?'
                  }
                </p>
                
                <div className="space-y-3">
                  {/* Only show "Save as Draft" for creating new content, not editing */}
                  {!editingContent && (
                    <button
                      onClick={handleSaveAsDraft}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save as Draft'}
                    </button>
                  )}
                  
                  <button
                    onClick={handleDiscardChanges}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Discard Changes
                  </button>
                  
                  <button
                    onClick={() => setShowCancelOptions(false)}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Continue {editingContent ? 'Editing' : 'Creating'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Changes Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative p-6 border w-[400px] max-w-[95vw] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Discard Changes</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to discard all changes? This action cannot be undone.
                </p>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDiscardConfirm(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDiscardChanges}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                  >
                    Discard Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Content Modal - User View Style */}
      {viewingContent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-4xl mx-auto px-6 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {viewingContent.title}
                    </h1>
                    <p className="text-lg text-gray-600">
                      {viewingContent.category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  </div>
                  <button
                    onClick={() => setViewingContent(null)}
                    className="p-3 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* Content Section */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                <div className="p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Content</h2>
                  
                  {/* Image */}
                  <div className="mb-6">
                    <div className="h-64 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg overflow-hidden">
                      {viewingContent.image && viewingContent.image.data ? (
                        <img 
                          src={viewingContent.image.data} 
                          alt={viewingContent.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <svg className="w-12 h-12 text-emerald-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <p className="text-emerald-600 font-medium">Educational Content</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Themes */}
                  {viewingContent.themes && viewingContent.themes.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Related Themes</h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingContent.themes.map((theme, index) => (
                          <span 
                            key={index}
                            className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {viewingContent.description}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Content</h3>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {viewingContent.content}
                    </div>
                  </div>

                  {/* Tags */}
                  {viewingContent.tags && viewingContent.tags.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingContent.tags.map((tag, index) => (
                          <span 
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content Attachments */}
                  {viewingContent.contentAttachments && viewingContent.contentAttachments.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">📎 Content Attachments</h3>
                      <div className="space-y-4">
                        {viewingContent.contentAttachments.map((attachment, index) => (
                          <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <span className="text-2xl">{getFileIcon(attachment)}</span>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{attachment.originalName || attachment.name}</div>
                              <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Convert relative URL to full backend URL
                                  const fullUrl = attachment.url.startsWith('http') 
                                    ? attachment.url 
                                    : `http://localhost:5000${attachment.url}`;
                                  console.log('Opening file:', fullUrl);
                                  console.log('Original URL:', attachment.url);
                                  window.open(fullUrl, '_blank', 'noopener,noreferrer');
                                }}
                                className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                              >
                                👁️ View
                              </button>
                              <button
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = attachment.url;
                                  link.download = attachment.originalName || attachment.name;
                                  link.click();
                                }}
                                className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded hover:bg-green-200"
                              >
                                📥 Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quiz Section */}
              {viewingContent.quiz && viewingContent.quiz.questions && viewingContent.quiz.questions.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                  <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Quiz</h2>
                    
                    {viewingContent.quiz.questions.map((question, questionIndex) => (
                      <div key={questionIndex} className="mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Question {questionIndex + 1}: {question.question}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {question.options.map((option, optionIndex) => (
                            <div 
                              key={optionIndex}
                              className={`flex items-center p-4 border-2 rounded-lg ${
                                question.correctAnswer === optionIndex 
                                  ? 'border-green-500 bg-green-50' 
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                question.correctAnswer === optionIndex 
                                  ? 'border-green-500 bg-green-500' 
                                  : 'border-gray-300'
                              }`}>
                                {question.correctAnswer === optionIndex && (
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div className="ml-3">
                                <span className="text-sm font-medium text-gray-500">
                                  {String.fromCharCode(65 + optionIndex)}.
                                </span>
                                <span className={`ml-2 ${
                                  question.correctAnswer === optionIndex ? 'text-green-700' : 'text-gray-900'
                                }`}>
                                  {option}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {question.explanation && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Explanation:</h4>
                            <p className="text-sm text-blue-800">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quiz Attachments */}
                    {viewingContent.quizAttachments && viewingContent.quizAttachments.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">🧩 Quiz Attachments</h3>
                        <div className="space-y-4">
                          {viewingContent.quizAttachments.map((attachment, index) => (
                            <div key={index} className="flex items-center space-x-4 p-4 border border-purple-200 rounded-lg hover:bg-purple-50">
                              <span className="text-2xl">{getFileIcon(attachment)}</span>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{attachment.originalName || attachment.name}</div>
                                <div className="text-xs text-gray-500">{formatFileSize(attachment.size)}</div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Convert relative URL to full backend URL
                                    const fullUrl = attachment.url.startsWith('http') 
                                      ? attachment.url 
                                      : `http://localhost:5000${attachment.url}`;
                                    console.log('Opening file:', fullUrl);
                                    console.log('Original URL:', attachment.url);
                                    window.open(fullUrl, '_blank', 'noopener,noreferrer');
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                                >
                                  👁️ View
                                </button>
                                <button
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = attachment.url;
                                    link.download = attachment.originalName || attachment.name;
                                    link.click();
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded hover:bg-green-200"
                                >
                                  📥 Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Admin Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Admin Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Status:</span> {getStatusBadge(viewingContent.status)}
                  </div>
                  <div>
                    <span className="font-medium">Difficulty:</span> {viewingContent.difficulty?.charAt(0).toUpperCase() + viewingContent.difficulty?.slice(1)}
                  </div>
                  <div>
                    <span className="font-medium">Time to Read:</span> {viewingContent.timeToRead} minutes
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {new Date(viewingContent.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  alertType === 'error' ? 'bg-red-100' : 
                  alertType === 'success' ? 'bg-green-100' : 
                  'bg-yellow-100'
                }`}>
                  {alertType === 'error' ? (
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : alertType === 'success' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="ml-4">
                  <h3 className={`text-lg font-medium ${
                    alertType === 'error' ? 'text-red-900' : 
                    alertType === 'success' ? 'text-green-900' : 
                    'text-yellow-900'
                  }`}>
                    {alertType === 'error' ? 'Error' : 
                     alertType === 'success' ? 'Success' : 
                     'Warning'}
                  </h3>
                  <p className={`mt-1 text-sm ${
                    alertType === 'error' ? 'text-red-700' : 
                    alertType === 'success' ? 'text-green-700' : 
                    'text-yellow-700'
                  }`}>
                    {alertMessage}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAlert(false)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    alertType === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' : 
                    alertType === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                    'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Archive Content</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    Are you sure you want to archive "{contentToArchive?.title}"? This content will be moved to archived status and won't be visible to users.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmArchiveContent}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Delete Content</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    Are you sure you want to delete "{contentToDelete?.title}"? This action cannot be undone and will permanently remove the content.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteContent}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Restore Content</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    Are you sure you want to restore "{contentToRestore?.title}"? This content will be moved back to published status and will be visible to users again.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestoreContent}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminEduContentManagement;
