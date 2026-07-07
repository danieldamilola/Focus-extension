// Background service worker for Irreversible Focus extension

let updatingRules = false;

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
  if (updatingRules) return;
  updatingRules = true;
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map((rule) => rule.id);

    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });
    }

    const rules = domains.map((domain, index) => ({
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
    }));

    const wwwRules = domains.map((domain, index) => ({
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
    }));

    const allRules = [...rules, ...wwwRules];

    if (allRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: allRules,
      });
    }

    console.log(`Focus locked: ${domains.length} domain(s) blocked`);
  } finally {
    updatingRules = false;
  }
}

// Also initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeRules();
});

// React to storage changes (lock set while SW was inactive)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isLocked && changes.isLocked.newValue === true && changes.domains) {
    updateBlockingRules(changes.domains.newValue);
  }
});
