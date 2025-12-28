/**
 * Utility to disable Grammarly on all form elements
 * This prevents the "grm ERROR [iterable] Not supported: in app messages from Iterable" error
 */

export const disableGrammarly = () => {
  // Function to add Grammarly disable attributes to elements
  const addGrammarlyDisableAttributes = (element) => {
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      element.setAttribute('data-grammarly-disable', 'true');
      element.setAttribute('data-gramm', 'false');
      element.setAttribute('data-grammarly-disable-grammarly', 'true');
      
      // Also add the attributes to any child form elements
      const childFormElements = element.querySelectorAll('input, textarea, [contenteditable]');
      childFormElements.forEach(childElement => {
        childElement.setAttribute('data-grammarly-disable', 'true');
        childElement.setAttribute('data-gramm', 'false');
        childElement.setAttribute('data-grammarly-disable-grammarly', 'true');
      });
    }
  };

  // Function to process all form elements
  const processFormElements = () => {
    // Get all input elements
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
    inputs.forEach(addGrammarlyDisableAttributes);

    // Also process any dynamically added elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a form element
            if (node.matches && node.matches('input, textarea, [contenteditable]')) {
              addGrammarlyDisableAttributes(node);
            }
            // Check for form elements within the added node
            const formElements = node.querySelectorAll && node.querySelectorAll('input, textarea, [contenteditable]');
            if (formElements) {
              formElements.forEach(addGrammarlyDisableAttributes);
            }
          }
        });
      });
    });

    // Start observing
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  };

  // Run immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processFormElements);
  } else {
    processFormElements();
  }

  // Also run after a short delay to catch any late-loading elements
  setTimeout(processFormElements, 100);
  setTimeout(processFormElements, 500);
};

// Auto-disable Grammarly when this module is imported
if (typeof window !== 'undefined') {
  disableGrammarly();
}
