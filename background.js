// Background service worker for Irreversible Focus extension

// Initialize rules when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  await initializeRules();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateRules") {
    updateBlockingRules(message.domains).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error("Error updating rules:", error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
  return false;
});

// Initialize blocking rules
async function initializeRules() {
  const result = await chrome.storage.local.get(["isLocked", "domains"]);

  if (result.isLocked === true && result.domains && result.domains.length > 0) {
    await updateBlockingRules(result.domains);
  }
}

// Update blocking rules using declarativeNetRequest
async function updateBlockingRules(domains) {
  // Remove existing rules first
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map((rule) => rule.id);

  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
    });
  }

  // Create new rules for each domain
  const rules = domains.map((domain, index) => {
    // Create rules for both http and https
    return {
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          extensionPath: "/focus.html",
        },
      },
      condition: {
        urlFilter: `*://${domain}/*`,
        resourceTypes: ["main_frame", "sub_frame"],
      },
    };
  });

  // Add rules for www variants
  const wwwRules = domains.map((domain, index) => {
    return {
      id: domains.length + index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          extensionPath: "/focus.html",
        },
      },
      condition: {
        urlFilter: `*://www.${domain}/*`,
        resourceTypes: ["main_frame", "sub_frame"],
      },
    };
  });

  // Combine all rules
  const allRules = [...rules, ...wwwRules];

  // Update dynamic rules
  if (allRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: allRules,
    });
  }

  console.log(`Focus locked: ${domains.length} domain(s) blocked`);
}

// Also initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeRules();
});
