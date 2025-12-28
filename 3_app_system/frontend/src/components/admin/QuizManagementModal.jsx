import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api';

const QuizManagementModal = ({ isOpen, onClose, onSave, editingQuiz = null }) => {
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    questions: [],
    timeLimit: 30,
    passingScore: 70,
    maxAttempts: 3
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    type: 'multiple_choice',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    points: 1
  });
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(-1);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error'); // 'error', 'success', 'warning'

  // Helper function to show alerts
  const showAlertMessage = (message, type = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  useEffect(() => {
    if (editingQuiz) {
      setQuizForm({
        title: editingQuiz.title || '',
        description: editingQuiz.description || '',
        questions: editingQuiz.questions || [],
        timeLimit: editingQuiz.timeLimit || 30,
        passingScore: editingQuiz.passingScore || 70,
        maxAttempts: editingQuiz.maxAttempts || 3
      });
    } else {
      resetForm();
    }
  }, [editingQuiz, isOpen]);

  const resetForm = () => {
    setQuizForm({
      title: '',
      description: '',
      questions: [],
      timeLimit: 30,
      passingScore: 70,
      maxAttempts: 3
    });
    setCurrentQuestion({
      question: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      explanation: '',
      points: 1
    });
    setShowQuestionForm(false);
    setEditingQuestionIndex(-1);
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question.trim()) {
      showAlertMessage('Please enter a question', 'warning');
      return;
    }

    if (currentQuestion.type === 'multiple_choice' && !currentQuestion.correctAnswer) {
      showAlertMessage('Please select a correct answer', 'warning');
      return;
    }

    const newQuestion = { ...currentQuestion };
    if (currentQuestion.type === 'multiple_choice') {
      newQuestion.options = currentQuestion.options.filter(opt => opt.trim() !== '');
    }

    if (editingQuestionIndex >= 0) {
      const updatedQuestions = [...quizForm.questions];
      updatedQuestions[editingQuestionIndex] = newQuestion;
      setQuizForm({ ...quizForm, questions: updatedQuestions });
    } else {
      setQuizForm({ ...quizForm, questions: [...quizForm.questions, newQuestion] });
    }

    setCurrentQuestion({
      question: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      explanation: '',
      points: 1
    });
    setShowQuestionForm(false);
    setEditingQuestionIndex(-1);
  };

  const handleEditQuestion = (index) => {
    const question = quizForm.questions[index];
    setCurrentQuestion({ ...question });
    setEditingQuestionIndex(index);
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = (index) => {
    const updatedQuestions = quizForm.questions.filter((_, i) => i !== index);
    setQuizForm({ ...quizForm, questions: updatedQuestions });
  };

  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    
    if (!quizForm.title.trim()) {
      showAlertMessage('Please enter a quiz title', 'warning');
      return;
    }

    if (quizForm.questions.length === 0) {
      showAlertMessage('Please add at least one question', 'warning');
      return;
    }

    try {
      if (editingQuiz) {
        await adminApi.updateQuiz(editingQuiz._id, quizForm);
      } else {
        await adminApi.createQuiz(quizForm);
      }
      onSave();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving quiz:', error);
      showAlertMessage('Error saving quiz. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative p-6 border w-[1152px] max-w-[95vw] shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
            </h3>
            <button
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveQuiz} className="space-y-6">
            {/* Quiz Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Quiz Title</label>
                <input
                  type="text"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({...quizForm, title: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={quizForm.description}
                  onChange={(e) => setQuizForm({...quizForm, description: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time Limit (minutes)</label>
                  <input
                    type="number"
                    value={quizForm.timeLimit}
                    onChange={(e) => setQuizForm({...quizForm, timeLimit: parseInt(e.target.value) || 30})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Passing Score (%)</label>
                  <input
                    type="number"
                    value={quizForm.passingScore}
                    onChange={(e) => setQuizForm({...quizForm, passingScore: parseInt(e.target.value) || 70})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
                  <input
                    type="number"
                    value={quizForm.maxAttempts}
                    onChange={(e) => setQuizForm({...quizForm, maxAttempts: parseInt(e.target.value) || 3})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900">Questions ({quizForm.questions.length})</h4>
                <button
                  type="button"
                  onClick={() => setShowQuestionForm(true)}
                  className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  Add Question
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {quizForm.questions.map((question, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{question.question}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {question.type.replace('_', ' ').toUpperCase()} • {question.points} point{question.points !== 1 ? 's' : ''}
                        </p>
                        {question.type === 'multiple_choice' && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600">Options:</p>
                            <ul className="text-sm text-gray-500 ml-4">
                              {question.options.map((option, optIndex) => (
                                <li key={optIndex} className={option === question.correctAnswer ? 'text-green-600 font-medium' : ''}>
                                  {String.fromCharCode(65 + optIndex)}. {option}
                                  {option === question.correctAnswer && ' ✓'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          type="button"
                          onClick={() => handleEditQuestion(index)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(index)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {quizForm.questions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No questions added yet. Click "Add Question" to get started.</p>
                </div>
              )}
            </div>

            {/* Question Form Modal */}
            {showQuestionForm && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60 flex items-center justify-center p-4">
                <div className="relative p-6 border w-[896px] max-w-[95vw] shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">
                        {editingQuestionIndex >= 0 ? 'Edit Question' : 'Add New Question'}
                      </h4>
                      <button
                        onClick={() => {
                          setShowQuestionForm(false);
                          setEditingQuestionIndex(-1);
                          setCurrentQuestion({
                            question: '',
                            type: 'multiple_choice',
                            options: ['', '', '', ''],
                            correctAnswer: '',
                            explanation: '',
                            points: 1
                          });
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Question</label>
                        <textarea
                          value={currentQuestion.question}
                          onChange={(e) => setCurrentQuestion({...currentQuestion, question: e.target.value})}
                          rows={3}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Question Type</label>
                        <select
                          value={currentQuestion.type}
                          onChange={(e) => setCurrentQuestion({...currentQuestion, type: e.target.value})}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True/False</option>
                          <option value="short_answer">Short Answer</option>
                        </select>
                      </div>

                      {currentQuestion.type === 'multiple_choice' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Options</label>
                          <div className="space-y-2 mt-2">
                            {currentQuestion.options.map((option, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name="correctAnswer"
                                  value={option}
                                  checked={currentQuestion.correctAnswer === option}
                                  onChange={(e) => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})}
                                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                                />
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...currentQuestion.options];
                                    newOptions[index] = e.target.value;
                                    setCurrentQuestion({...currentQuestion, options: newOptions});
                                  }}
                                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentQuestion.type === 'true_false' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                          <div className="mt-2 space-x-4">
                            <label className="inline-flex items-center">
                              <input
                                type="radio"
                                name="correctAnswer"
                                value="true"
                                checked={currentQuestion.correctAnswer === 'true'}
                                onChange={(e) => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                              />
                              <span className="ml-2">True</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input
                                type="radio"
                                name="correctAnswer"
                                value="false"
                                checked={currentQuestion.correctAnswer === 'false'}
                                onChange={(e) => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                              />
                              <span className="ml-2">False</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {currentQuestion.type === 'short_answer' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                          <input
                            type="text"
                            value={currentQuestion.correctAnswer}
                            onChange={(e) => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Points</label>
                        <input
                          type="number"
                          value={currentQuestion.points}
                          onChange={(e) => setCurrentQuestion({...currentQuestion, points: parseInt(e.target.value) || 1})}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                          min="1"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Explanation (optional)</label>
                        <textarea
                          value={currentQuestion.explanation}
                          onChange={(e) => setCurrentQuestion({...currentQuestion, explanation: e.target.value})}
                          rows={2}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                          placeholder="Explain why this is the correct answer..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuestionForm(false);
                          setEditingQuestionIndex(-1);
                          setCurrentQuestion({
                            question: '',
                            type: 'multiple_choice',
                            options: ['', '', '', ''],
                            correctAnswer: '',
                            explanation: '',
                            points: 1
                          });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                      >
                        {editingQuestionIndex >= 0 ? 'Update Question' : 'Add Question'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
              >
                {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
              </button>
            </div>
          </form>
        </div>
      </div>

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
    </div>
  );
};

export default QuizManagementModal;
