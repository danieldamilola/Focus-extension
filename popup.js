// Popup script for Irreversible Focus extension

document.addEventListener('DOMContentLoaded', async () => {
  const domainsInput = document.getElementById('domainsInput');
  const lockButton = document.getElementById('lockButton');
  const deleteButton = document.getElementById('deleteButton');
  const inputSection = document.getElementById('inputSection');
  const lockedMessage = document.getElementById('lockedMessage');
  
  // Check if already locked
  const result = await chrome.storage.local.get(['isLocked']);
  
  if (result.isLocked === true) {
    // Hide all input elements - irreversibility enforced
    inputSection.classList.add('hidden');
    lockedMessage.classList.add('active');
    return;
  }
  
  // Load saved domains if any
  const savedData = await chrome.storage.local.get(['domains']);
  if (savedData.domains && savedData.domains.length > 0) {
    domainsInput.value = savedData.domains.join('\n');
  }
  
  // Clear button functionality
  deleteButton.addEventListener('click', () => {
    domainsInput.value = '';
    chrome.storage.local.remove(['domains']);
  });
  
  // Lock button functionality - THE IRREVERSIBLE ACTION
  lockButton.addEventListener('click', async () => {
    const domainsText = domainsInput.value.trim();
    
    if (!domainsText) {
      alert('Please enter at least one domain name.');
      return;
    }
    
    // Parse domains
    const domains = domainsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(domain => {
        // Normalize domain (remove http://, https://, www., trailing slashes)
        return domain
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '')
          .toLowerCase();
      });
    
    if (domains.length === 0) {
      alert('Please enter valid domain names.');
      return;
    }
    
    // Confirm the irreversible action
    const confirmed = confirm(
      '⚠️ WARNING: This action is IRREVERSIBLE!\n\n' +
      'Once you lock focus, you will NOT be able to:\n' +
      '- Remove domains from the block list\n' +
      '- Disable the extension\n' +
      '- Access the settings again\n\n' +
      'Are you absolutely sure you want to proceed?'
    );
    
    if (!confirmed) {
      return;
    }
    
    // Final confirmation
    const finalConfirm = confirm(
      'This is your LAST chance to cancel.\n\n' +
      'Clicking OK will lock focus FOREVER.\n\n' +
      'Proceed?'
    );
    
    if (!finalConfirm) {
      return;
    }
    
    // Save the locked state and domains
    // This is the point of no return
    await chrome.storage.local.set({
      isLocked: true,
      domains: domains
    });
    
    // Notify background script to update blocking rules
    chrome.runtime.sendMessage({
      action: 'updateRules',
      domains: domains
    }).catch(() => {
      // Service worker may not be active yet — rules will load from storage on wake
    });
    
    // Hide all input elements immediately
    inputSection.classList.add('hidden');
    lockedMessage.classList.add('active');
    
    // Show confirmation
    alert('Focus locked forever. The key has been thrown away.');
  });
});

