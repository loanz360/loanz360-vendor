(function() {
  'use strict';

  // Get script element and chatbot ID
  var script = document.currentScript || document.querySelector('script[data-chatbot-id]');
  var chatbotId = script.getAttribute('data-chatbot-id');

  if (!chatbotId) {
    console.error('Loans360 Chatbot: Missing data-chatbot-id attribute');
    return;
  }

  // Configuration
  var config = {
    apiBase: script.getAttribute('data-api-base') || 'https://loans360.com',
    position: script.getAttribute('data-position') || 'bottom-right',
    zIndex: script.getAttribute('data-z-index') || '9999'
  };

  // Create container
  var container = document.createElement('div');
  container.id = 'loans360-chatbot-container';
  container.style.cssText = 'position: fixed; z-index: ' + config.zIndex + ';';
  document.body.appendChild(container);

  // Load chatbot iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'loans360-chatbot-frame';
  iframe.src = config.apiBase + '/chatbot/embed/' + chatbotId;
  iframe.style.cssText = 'border: none; width: 100%; height: 100%; position: fixed; ' +
    getPositionStyle(config.position) + ' z-index: ' + config.zIndex + ';';
  iframe.allow = 'geolocation; microphone; camera';

  // Initially hide iframe
  iframe.style.display = 'none';

  container.appendChild(iframe);

  // Create floating button
  var button = document.createElement('button');
  button.id = 'loans360-chatbot-button';
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  button.style.cssText = getButtonStyle(config.position);

  container.appendChild(button);

  // State
  var isOpen = false;

  // Toggle chat
  button.onclick = function() {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    button.innerHTML = isOpen ?
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' :
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  };

  // Listen for messages from iframe
  window.addEventListener('message', function(event) {
    if (event.data.type === 'loans360-chatbot') {
      switch(event.data.action) {
        case 'close':
          isOpen = false;
          iframe.style.display = 'none';
          button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
          break;
        case 'open':
          isOpen = true;
          iframe.style.display = 'block';
          button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
          break;
        case 'resize':
          // Handle dynamic resize if needed
          break;
      }
    }
  });

  // Helper functions
  function getPositionStyle(position) {
    var styles = {
      'bottom-right': 'bottom: 80px; right: 16px; width: 400px; height: 600px; max-height: 80vh;',
      'bottom-left': 'bottom: 80px; left: 16px; width: 400px; height: 600px; max-height: 80vh;',
      'top-right': 'top: 80px; right: 16px; width: 400px; height: 600px; max-height: 80vh;',
      'top-left': 'top: 80px; left: 16px; width: 400px; height: 600px; max-height: 80vh;'
    };
    return styles[position] || styles['bottom-right'];
  }

  function getButtonStyle(position) {
    var positions = {
      'bottom-right': 'bottom: 16px; right: 16px;',
      'bottom-left': 'bottom: 16px; left: 16px;',
      'top-right': 'top: 16px; right: 16px;',
      'top-left': 'top: 16px; left: 16px;'
    };
    return 'position: fixed; ' + (positions[position] || positions['bottom-right']) +
      ' width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer; ' +
      'background: linear-gradient(135deg, #FF6B00 0%, #FF8533 100%); color: white; ' +
      'box-shadow: 0 4px 12px rgba(255, 107, 0, 0.4); transition: transform 0.2s, box-shadow 0.2s; ' +
      'display: flex; align-items: center; justify-content: center; z-index: ' + config.zIndex + ';';
  }

  // Add hover effect
  button.onmouseenter = function() {
    this.style.transform = 'scale(1.1)';
    this.style.boxShadow = '0 6px 16px rgba(255, 107, 0, 0.5)';
  };
  button.onmouseleave = function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '0 4px 12px rgba(255, 107, 0, 0.4)';
  };

  // Expose API for external control
  window.Loans360Chatbot = {
    open: function() {
      isOpen = true;
      iframe.style.display = 'block';
    },
    close: function() {
      isOpen = false;
      iframe.style.display = 'none';
    },
    toggle: function() {
      button.click();
    },
    isOpen: function() {
      return isOpen;
    }
  };

})();
